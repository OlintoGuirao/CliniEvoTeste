const SLOT_MINUTES = 30;

function timeToMinutes(time) {
  const raw = String(time || '').slice(0, 5);
  const [h, m] = raw.split(':').map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function patientGroupKey(row) {
  if (row?.patient_id) return `p:${row.patient_id}`;
  const phone = String(row?.pre_registration_phone || '').replace(/\D/g, '');
  if (phone) return `ph:${phone}`;
  const name = String(row?.full_name || '')
    .trim()
    .toLowerCase();
  return `n:${name || 'unknown'}`;
}

function sortByStartTime(rows) {
  return [...rows].sort((a, b) => {
    const am = timeToMinutes(a.start_time) ?? 0;
    const bm = timeToMinutes(b.start_time) ?? 0;
    return am - bm;
  });
}

/**
 * Agrupa slots do mesmo paciente em bloco (appointment_block_id)
 * ou em cadeia consecutiva de 30 min no mesmo dia.
 */
function groupReminderAppointments(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const used = new Set();
  const groups = [];

  const byBlock = new Map();
  for (const row of list) {
    const blockId = row?.appointment_block_id;
    if (!blockId) continue;
    if (!byBlock.has(blockId)) byBlock.set(blockId, []);
    byBlock.get(blockId).push(row);
  }

  for (const blockRows of byBlock.values()) {
    const sorted = sortByStartTime(blockRows);
    for (const row of sorted) used.add(row.id);
    groups.push(sorted);
  }

  const remaining = list.filter((row) => !used.has(row.id));
  const buckets = new Map();
  for (const row of remaining) {
    const key = `${row.professional_id}|${row.appointment_date}|${patientGroupKey(row)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }

  for (const bucket of buckets.values()) {
    const sorted = sortByStartTime(bucket);
    let current = [];
    for (const row of sorted) {
      if (current.length === 0) {
        current = [row];
        continue;
      }
      const prev = current[current.length - 1];
      const prevMin = timeToMinutes(prev.start_time);
      const nextMin = timeToMinutes(row.start_time);
      if (prevMin != null && nextMin != null && nextMin - prevMin === SLOT_MINUTES) {
        current.push(row);
      } else {
        groups.push(current);
        current = [row];
      }
    }
    if (current.length) groups.push(current);
  }

  return groups;
}

function getGroupTimeRange(group) {
  const sorted = sortByStartTime(group);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const startTime = String(first?.start_time || '').slice(0, 5);
  const endTime = String(last?.start_time || '').slice(0, 5);
  return {
    first,
    last,
    startTime,
    endTime: endTime && endTime !== startTime ? endTime : null,
    ids: sorted.map((row) => row.id).filter(Boolean),
  };
}

module.exports = {
  SLOT_MINUTES,
  groupReminderAppointments,
  getGroupTimeRange,
  timeToMinutes,
};
