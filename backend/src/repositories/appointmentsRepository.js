const { supabase } = require('../config/supabase');
const { buildAppointmentNotes } = require('../lib/appointmentNotes');
const { findOrCreatePatientByPhone } = require('./patientsRepository');
const { phoneLookupVariants, phonesMatch } = require('../store/phoneUtils');
const { normalizePhone } = require('../store/conversationStateStore');

function normalizeTimeToDb(time) {
  const t = String(time || '').trim();
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return t;
  return `${String(parseInt(m[1], 10)).padStart(2, '0')}:${m[2]}:${m[3] || '00'}`;
}

function timeKeysMatch(a, b) {
  return normalizeTimeToDb(a) === normalizeTimeToDb(b);
}

function nowDateAndTimeParts() {
  try {
    const { getBrazilDateTimeParts } = require('../utils/time');
    return getBrazilDateTimeParts();
  } catch {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return {
      today: `${yyyy}-${mm}-${dd}`,
      nowTime: `${hh}:${mi}:${ss}`,
    };
  }
}

async function insertAppointmentInSupabase(params) {
  if (!supabase) return null;

  let patientId = null;
  try {
    const patient = await findOrCreatePatientByPhone({
      professionalId: params.professionalId,
      fullName: params.clientName || 'Paciente',
      phone: params.phone || '',
    });
    patientId = patient?.id ?? null;
  } catch (_) {
    // Mantém fallback para pré-cadastro se criação/consulta de paciente falhar.
    patientId = null;
  }

  const payload = {
    professional_id: params.professionalId,
    patient_id: patientId,
    full_name: params.clientName || null,
    pre_registration_phone: normalizePhone(params.phone) || null,
    appointment_date: params.appointmentDate,
    start_time: normalizeTimeToDb(params.appointmentTime),
    notes: buildAppointmentNotes(params.service),
  };

  const { data, error } = await supabase
    .from('appointments')
    .insert(payload)
    .select('id, professional_id, full_name, pre_registration_phone, appointment_date, start_time, notes')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function listUpcomingAppointmentsByPhone(params) {
  const professionalId = String(params?.professionalId || '').trim();
  const variants = phoneLookupVariants(params?.phone);
  if (!supabase || !professionalId || !variants.length) return [];

  const { today, nowTime } = nowDateAndTimeParts();

  let patientId = null;
  const { findClientByPhone } = require('../store/clientStore');
  const patient = await findClientByPhone({ phone: params.phone, professionalId });
  if (patient?.id) patientId = patient.id;

  const byPhoneQuery = await supabase
    .from('appointments')
    .select('id, full_name, pre_registration_phone, appointment_date, start_time, notes, patient_id')
    .eq('professional_id', professionalId)
    .in('pre_registration_phone', variants)
    .gte('appointment_date', today)
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(50);

  if (byPhoneQuery.error) throw new Error(byPhoneQuery.error.message);

  let byPatient = { data: [] };
  if (patientId) {
    byPatient = await supabase
      .from('appointments')
      .select('id, full_name, pre_registration_phone, appointment_date, start_time, notes, patient_id')
      .eq('professional_id', professionalId)
      .eq('patient_id', patientId)
      .gte('appointment_date', today)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(50);
    if (byPatient.error) throw new Error(byPatient.error.message);
  }

  const unique = new Map();
  for (const item of [...(byPhoneQuery.data || []), ...(byPatient.data || [])]) {
    if (!item?.id) continue;
    unique.set(item.id, item);
  }

  return Array.from(unique.values()).filter((a) => {
    if (!a?.appointment_date) return false;
    if (a.appointment_date > today) return true;
    if (a.appointment_date < today) return false;
    return String(a.start_time || '00:00:00') >= nowTime;
  });
}

async function listBookedSlotsForProfessional({ professionalId, fromDate, toDate }) {
  if (!supabase || !professionalId) return [];

  const { data, error } = await supabase
    .from('appointments')
    .select('appointment_date, start_time')
    .eq('professional_id', professionalId)
    .gte('appointment_date', fromDate)
    .lte('appointment_date', toDate);

  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    appointmentDate: row.appointment_date,
    appointmentTime: normalizeTimeToDb(row.start_time).slice(0, 5),
  }));
}

async function cancelAppointmentById({ appointmentId, professionalId, phone }) {
  if (!supabase || !appointmentId || !professionalId) {
    return { ok: false, reason: 'Configuração inválida' };
  }

  const { data: row, error } = await supabase
    .from('appointments')
    .select('id, professional_id, appointment_date, start_time, full_name, pre_registration_phone, patient_id')
    .eq('id', appointmentId)
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return { ok: false, reason: 'Consulta não encontrada' };

  const phoneOk =
    phonesMatch(row.pre_registration_phone, phone) ||
    (row.patient_id &&
      (await (async () => {
        const { findClientByPhone } = require('../store/clientStore');
        const patient = await findClientByPhone({ phone, professionalId });
        return patient?.id === row.patient_id;
      })()));

  if (!phoneOk) return { ok: false, reason: 'Consulta não pertence a este telefone' };

  const { error: delError } = await supabase.from('appointments').delete().eq('id', appointmentId);
  if (delError) throw new Error(delError.message);

  return {
    ok: true,
    appointment: {
      id: row.id,
      appointment_date: row.appointment_date,
      start_time: row.start_time,
      full_name: row.full_name,
    },
  };
}

async function getAppointmentById(appointmentId) {
  if (!supabase || !appointmentId) return null;

  const { data, error } = await supabase
    .from('appointments')
    .select('id, professional_id, appointment_date, start_time, notes')
    .eq('id', appointmentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function updateAppointmentScheduleInSupabase({ appointmentId, appointmentDate, appointmentTime }) {
  if (!supabase || !appointmentId) return null;

  const { data, error } = await supabase
    .from('appointments')
    .update({
      appointment_date: appointmentDate,
      start_time: normalizeTimeToDb(appointmentTime),
      reminder_24h_sent_at: null,
      reminder_1h_sent_at: null,
      presence_confirmed_at: null,
      presence_declined_at: null,
    })
    .eq('id', appointmentId)
    .select('id, appointment_date, start_time')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function listAppointmentsNeedingReminder24h() {
  if (!supabase) return [];

  const { today } = nowDateAndTimeParts();
  // +3 dias em calendário BRT (today já vem de America/Sao_Paulo)
  const base = new Date(`${today}T12:00:00-03:00`);
  base.setDate(base.getDate() + 3);
  const toDate = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, professional_id, full_name, pre_registration_phone, appointment_date, start_time, notes, reminder_24h_sent_at, patient_id, appointment_block_id, is_block_start'
    )
    .gte('appointment_date', today)
    .lte('appointment_date', toDate)
    .is('reminder_24h_sent_at', null)
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(500);

  if (error) throw new Error(error.message);
  return data || [];
}

async function markReminder24hSent(appointmentId) {
  if (!supabase || !appointmentId) return;
  const { error } = await supabase
    .from('appointments')
    .update({ reminder_24h_sent_at: new Date().toISOString() })
    .eq('id', appointmentId);
  if (error) throw new Error(error.message);
}

async function markReminder24hSentMany(appointmentIds) {
  if (!supabase) return;
  const ids = [...new Set((appointmentIds || []).filter(Boolean))];
  if (!ids.length) return;
  const { error } = await supabase
    .from('appointments')
    .update({ reminder_24h_sent_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw new Error(error.message);
}

async function listAppointmentsNeedingReminder1h() {
  if (!supabase) return [];

  const { today } = nowDateAndTimeParts();
  const base = new Date(`${today}T12:00:00-03:00`);
  base.setDate(base.getDate() + 2);
  const toDate = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, professional_id, full_name, pre_registration_phone, appointment_date, start_time, notes, reminder_1h_sent_at, patient_id, appointment_block_id, is_block_start'
    )
    .gte('appointment_date', today)
    .lte('appointment_date', toDate)
    .is('reminder_1h_sent_at', null)
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(500);

  if (error) throw new Error(error.message);
  return data || [];
}

async function markReminder1hSent(appointmentId) {
  if (!supabase || !appointmentId) return;
  const { error } = await supabase
    .from('appointments')
    .update({ reminder_1h_sent_at: new Date().toISOString() })
    .eq('id', appointmentId);
  if (error) throw new Error(error.message);
}

async function markReminder1hSentMany(appointmentIds) {
  if (!supabase) return;
  const ids = [...new Set((appointmentIds || []).filter(Boolean))];
  if (!ids.length) return;
  const { error } = await supabase
    .from('appointments')
    .update({ reminder_1h_sent_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw new Error(error.message);
}

async function markPresenceConfirmed(appointmentId) {
  if (!supabase || !appointmentId) return;
  const { error } = await supabase
    .from('appointments')
    .update({ presence_confirmed_at: new Date().toISOString() })
    .eq('id', appointmentId);
  if (error) throw new Error(error.message);
}

async function markPresenceDeclined(appointmentId) {
  if (!supabase || !appointmentId) return;
  const { error } = await supabase
    .from('appointments')
    .update({ presence_declined_at: new Date().toISOString() })
    .eq('id', appointmentId);
  if (error) throw new Error(error.message);
}

async function findAppointmentAwaitingPresenceResponse({ professionalId, phone }) {
  if (!supabase || !professionalId || !phone) return null;

  const since1h = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, professional_id, full_name, pre_registration_phone, appointment_date, start_time, notes, reminder_24h_sent_at, reminder_1h_sent_at, patient_id, presence_confirmed_at, presence_declined_at'
    )
    .eq('professional_id', professionalId)
    .gte('appointment_date', today)
    .is('presence_confirmed_at', null)
    .is('presence_declined_at', null)
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(50);

  if (error) throw new Error(error.message);

  const { phonesMatch } = require('../store/phoneUtils');
  for (const row of data || []) {
    let matched = phonesMatch(row.pre_registration_phone, phone);
    if (!matched && row.patient_id) {
      const { data: patient } = await supabase
        .from('patients')
        .select('phone')
        .eq('id', row.patient_id)
        .maybeSingle();
      matched = phonesMatch(patient?.phone, phone);
    }
    if (!matched) continue;

    const hasRecent1h = row.reminder_1h_sent_at && row.reminder_1h_sent_at >= since1h;
    const has24hAwaiting = row.reminder_24h_sent_at && !row.reminder_1h_sent_at;
    if (hasRecent1h || has24hAwaiting) return row;
  }

  return null;
}

async function listAppointmentsForReminderStatusByDate(professionalId, appointmentDate) {
  if (!supabase) return [];
  const pid = String(professionalId || '').trim();
  const date = String(appointmentDate || '').trim();
  if (!pid || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];

  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, professional_id, full_name, pre_registration_phone, appointment_date, start_time, notes, reminder_24h_sent_at, patient_id, appointment_block_id, is_block_start'
    )
    .eq('professional_id', pid)
    .eq('appointment_date', date)
    .order('start_time', { ascending: true })
    .limit(500);

  if (error) throw new Error(error.message);
  return data || [];
}

module.exports = {
  insertAppointmentInSupabase,
  listUpcomingAppointmentsByPhone,
  listBookedSlotsForProfessional,
  cancelAppointmentById,
  getAppointmentById,
  updateAppointmentScheduleInSupabase,
  listAppointmentsNeedingReminder24h,
  markReminder24hSent,
  markReminder24hSentMany,
  listAppointmentsNeedingReminder1h,
  markReminder1hSent,
  markReminder1hSentMany,
  markPresenceConfirmed,
  markPresenceDeclined,
  findAppointmentAwaitingPresenceResponse,
  listAppointmentsForReminderStatusByDate,
  normalizeTimeToDb,
  timeKeysMatch,
};
