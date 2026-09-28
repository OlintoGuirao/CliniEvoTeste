const { isSlotBookedLocal } = require('../store/memoryStore');
const { listBookedSlotsForProfessional } = require('../repositories/appointmentsRepository');
const { getProfessionalSchedule } = require('../repositories/professionalRepository');
const { formatDateYYYYMMDD, minutesToTimeStr, nowPlusDays } = require('../utils/time');

function isLunchMinute(min, lunchBreaks) {
  for (const item of lunchBreaks || []) {
    const startMin = item?.startMin;
    const endMin = item?.endMin;
    if (startMin == null || endMin == null || endMin <= startMin) continue;
    if (min >= startMin && min < endMin) return true;
  }
  return false;
}

function generateTimesForDay(schedule) {
  const { workStartMin, workEndMin, lunchBreaks, slotMinutes } = schedule;
  const times = [];
  for (let min = workStartMin; min < workEndMin; min += slotMinutes) {
    if (isLunchMinute(min, lunchBreaks)) continue;
    times.push(minutesToTimeStr(min));
  }
  return times;
}

function slotKey(appointmentDate, appointmentTime) {
  return `${appointmentDate}|${String(appointmentTime).slice(0, 5)}`;
}

async function loadBookedSlotKeys({ professionalId, dates, dayTimes }) {
  const booked = new Set();

  for (const appointmentDate of dates) {
    for (const appointmentTime of dayTimes) {
      if (
        isSlotBookedLocal({
          professionalId,
          appointmentDate,
          appointmentTime,
        })
      ) {
        booked.add(slotKey(appointmentDate, appointmentTime));
      }
    }
  }

  if (!dates.length) return booked;

  try {
    const remote = await listBookedSlotsForProfessional({
      professionalId,
      fromDate: dates[0],
      toDate: dates[dates.length - 1],
    });
    for (const row of remote) {
      booked.add(slotKey(row.appointmentDate, row.appointmentTime));
    }
  } catch {
    // Mantém apenas cache local se Supabase falhar.
  }

  return booked;
}

async function getAvailableSlotsForProfessional({
  professionalId,
  daysAhead = 7,
  limit = null,
  excludeSlot = null,
}) {
  const schedule = await getProfessionalSchedule(professionalId);
  const dayTimes = generateTimesForDay(schedule);
  const dates = [];

  for (let dayOffset = 1; dayOffset <= daysAhead; dayOffset++) {
    const day = nowPlusDays(dayOffset);
    if (!schedule.workDays.includes(day.getDay())) continue;
    const dateKey = formatDateYYYYMMDD(day);
    if (schedule.clinicClosedDates?.has?.(dateKey)) continue;
    dates.push(dateKey);
  }

  const booked = await loadBookedSlotKeys({ professionalId, dates, dayTimes });
  if (excludeSlot?.appointmentDate && excludeSlot?.appointmentTime) {
    booked.delete(slotKey(excludeSlot.appointmentDate, excludeSlot.appointmentTime));
  }
  const slots = [];

  for (const appointmentDate of dates) {
    for (const appointmentTime of dayTimes) {
      if (booked.has(slotKey(appointmentDate, appointmentTime))) continue;
      slots.push({ appointmentDate, appointmentTime });
      if (limit && slots.length >= limit) return slots;
    }
  }

  return slots;
}

function groupSlotsByDate(slots) {
  const byDate = new Map();
  for (const s of slots || []) {
    if (!byDate.has(s.appointmentDate)) byDate.set(s.appointmentDate, []);
    byDate.get(s.appointmentDate).push(s);
  }
  return byDate;
}

async function getAvailableSlotsGroupedByDate({
  professionalId,
  daysAhead = 14,
  maxDates = 10,
  excludeSlot = null,
}) {
  const slots = await getAvailableSlotsForProfessional({
    professionalId,
    daysAhead,
    limit: null,
    excludeSlot,
  });
  const byDate = groupSlotsByDate(slots);
  const dates = Array.from(byDate.keys()).slice(0, maxDates);
  return { dates, slotsByDate: byDate, allSlots: slots };
}

async function isSlotBooked({ professionalId, appointmentDate, appointmentTime, excludeSlot = null }) {
  const timeKey = String(appointmentTime).slice(0, 5);
  if (
    excludeSlot &&
    excludeSlot.appointmentDate === appointmentDate &&
    String(excludeSlot.appointmentTime).slice(0, 5) === timeKey
  ) {
    return false;
  }

  if (
    isSlotBookedLocal({
      professionalId,
      appointmentDate,
      appointmentTime,
    })
  ) {
    return true;
  }

  try {
    const remote = await listBookedSlotsForProfessional({
      professionalId,
      fromDate: appointmentDate,
      toDate: appointmentDate,
    });
    return remote.some(
      (s) =>
        s.appointmentDate === appointmentDate &&
        String(s.appointmentTime).slice(0, 5) === timeKey
    );
  } catch {
    return false;
  }
}

function tryParseSlotSelection(text) {
  const trimmed = String(text || '').trim();
  const asIndex = Number(trimmed);
  if (Number.isInteger(asIndex) && asIndex >= 1) return { type: 'index', value: asIndex };

  const m = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const hh = String(parseInt(m[1], 10)).padStart(2, '0');
    return { type: 'time', value: `${hh}:${m[2]}` };
  }

  return { type: 'unknown', value: null };
}

module.exports = {
  getAvailableSlotsForProfessional,
  getAvailableSlotsGroupedByDate,
  groupSlotsByDate,
  tryParseSlotSelection,
  isSlotBooked,
};
