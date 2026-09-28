const { v4: uuidv4 } = require('uuid');
const { loadInitialData, persistClients, persistAppointments } = require('./persistence');
const {
  insertAppointmentInSupabase,
  updateAppointmentScheduleInSupabase,
  normalizeTimeToDb,
} = require('../repositories/appointmentsRepository');
const { normalizePhone } = require('./conversationStateStore');
const { logger } = require('../utils/logger');

const professionals = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Profissional Exemplo',
    apiKey: 'PROFESSIONAL_API_KEY_EXEMPLO',
    whatsappInstanceId: process.env.EVOLUTION_DEFAULT_INSTANCE || 'pro-demo',
    ultramsgInstanceId: process.env.EVOLUTION_DEFAULT_INSTANCE || 'pro-demo',
    phoneDefaultCountryCode: '55',
  },
];

const initialData = loadInitialData();
const clients = initialData.clients;
const appointments = initialData.appointments;

function getProfessionalById(professionalId) {
  return professionals.find((p) => p.id === professionalId) || null;
}

function getProfessionalByWhatsAppInstance(instanceName) {
  if (!instanceName) return null;
  return (
    professionals.find(
      (p) => p.whatsappInstanceId === instanceName || p.ultramsgInstanceId === instanceName
    ) || null
  );
}

function upsertClient({ professionalId, phone, name }) {
  const existing = clients.find((c) => c.professionalId === professionalId && c.phone === phone);
  if (existing) {
    existing.name = name || existing.name;
    persistClients(clients);
    return existing;
  }
  const client = { id: uuidv4(), professionalId, phone, name: name || '' };
  clients.push(client);
  persistClients(clients);
  return client;
}

function getAppointmentsByProfessionalId(professionalId) {
  return appointments
    .filter((a) => a.professionalId === professionalId)
    .sort((a, b) => (a.appointmentDate + a.appointmentTime).localeCompare(b.appointmentDate + b.appointmentTime));
}

async function createAppointment({ professionalId, phone, clientName, service, appointmentDate, appointmentTime }) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedTime = normalizeTimeToDb(appointmentTime).slice(0, 5);
  const client = upsertClient({ professionalId, phone: normalizedPhone, name: clientName });
  const appointment = {
    id: uuidv4(),
    professionalId,
    clientId: client.id,
    phone: normalizedPhone,
    clientName: client.name,
    service,
    appointmentDate,
    appointmentTime: normalizedTime,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };

  try {
    const dbRow = await insertAppointmentInSupabase({
      professionalId,
      phone: normalizedPhone,
      clientName: client.name,
      service,
      appointmentDate,
      appointmentTime: normalizedTime,
    });
    if (dbRow?.id) appointment.id = dbRow.id;
    logger.info('Consulta salva no Supabase (agenda)', {
      appointmentId: appointment.id,
      appointmentDate,
      appointmentTime: normalizedTime,
    });
  } catch (e) {
    logger.error('Falha ao inserir appointment no Supabase; mantendo local', e?.message || e);
  }

  appointments.push(appointment);
  persistAppointments(appointments);
  return appointment;
}

function isSlotBookedLocal({ professionalId, appointmentDate, appointmentTime }) {
  const timeKey = String(appointmentTime).slice(0, 5);
  return appointments.some(
    (a) =>
      a.professionalId === professionalId &&
      a.appointmentDate === appointmentDate &&
      String(a.appointmentTime).slice(0, 5) === timeKey &&
      a.status === 'confirmed'
  );
}

function removeAppointmentById(appointmentId) {
  const idx = appointments.findIndex((a) => a.id === appointmentId);
  if (idx >= 0) {
    appointments.splice(idx, 1);
    persistAppointments(appointments);
    return true;
  }
  return false;
}

async function updateAppointmentSchedule({ appointmentId, appointmentDate, appointmentTime }) {
  const normalizedTime = normalizeTimeToDb(appointmentTime).slice(0, 5);
  const apt = appointments.find((a) => a.id === appointmentId);
  if (apt) {
    apt.appointmentDate = appointmentDate;
    apt.appointmentTime = normalizedTime;
    persistAppointments(appointments);
  }

  try {
    await updateAppointmentScheduleInSupabase({
      appointmentId,
      appointmentDate,
      appointmentTime: normalizedTime,
    });
  } catch (e) {
    logger.error('Falha ao reagendar no Supabase', e?.message || e);
    throw e;
  }

  return apt;
}

module.exports = {
  professionals,
  clients,
  appointments,
  getProfessionalById,
  getProfessionalByWhatsAppInstance,
  upsertClient,
  getAppointmentsByProfessionalId,
  createAppointment,
  isSlotBookedLocal,
  removeAppointmentById,
  updateAppointmentSchedule,
};
