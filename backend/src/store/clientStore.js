const { v4: uuidv4 } = require('uuid');
const { normalizePhone } = require('./conversationStateStore');
const { phoneLookupVariants, phonesMatch } = require('./phoneUtils');
const { supabase } = require('../config/supabase');

const clients = [];

function mapPatientRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    professionalId: row.professional_id,
    name: row.full_name || '',
    phone: normalizePhone(row.phone) || '',
    dateOfBirth: row.date_of_birth || null,
    birthDateConfirmedAt: row.whatsapp_birth_date_confirmed_at || null,
    registrationCompletedAt: row.registration_completed_at || null,
    source: 'supabase',
  };
}

function isBirthDateConfirmed(client) {
  return Boolean(client?.birthDateConfirmedAt);
}

/** Mesmo critério da aba Pacientes: só cadastro com registration_completed_at. */
function isPatientFullyRegistered(client) {
  if (!client) return false;
  if (client.registrationCompletedAt) return true;
  if (client.source === 'supabase') return false;
  const name = String(client.name || '').trim();
  const dob = String(client.dateOfBirth || '').trim();
  return name.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(dob);
}

function isRecognizedPatient(client) {
  return isPatientFullyRegistered(client);
}

async function findClientByPhone({ phone, professionalId, registeredOnly = false }) {
  const variants = phoneLookupVariants(phone);
  const professional = String(professionalId || '');
  if (!variants.length || !professional) return null;

  const matchesRegistered = (row) => {
    if (!phonesMatch(row.phone, phone)) return false;
    if (registeredOnly && !row.registration_completed_at) return false;
    return true;
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('patients')
      .select(
        'id, full_name, phone, professional_id, date_of_birth, whatsapp_birth_date_confirmed_at, registration_completed_at'
      )
      .eq('professional_id', professional)
      .not('phone', 'is', null);

    if (error) {
      if (/whatsapp_birth_date_confirmed_at|registration_completed_at|column/i.test(error.message || '')) {
        const fallback = await supabase
          .from('patients')
          .select('id, full_name, phone, professional_id, date_of_birth')
          .eq('professional_id', professional)
          .not('phone', 'is', null);
        if (fallback.error) throw new Error(fallback.error.message);
        const match = (fallback.data || []).find((row) => phonesMatch(row.phone, phone));
        if (match) {
          const mapped = mapPatientRow(match);
          if (registeredOnly) return null;
          return mapped;
        }
      } else {
        throw new Error(error.message);
      }
    } else {
      const match = (data || []).find(matchesRegistered);
      if (match) return mapPatientRow(match);
    }
  }

  return (
    clients.find(
      (c) =>
        phonesMatch(c.phone, phone) &&
        String(c.professionalId || '') === professional &&
        (!registeredOnly || c.registrationCompletedAt)
    ) || null
  );
}

async function createClient({ name, phone, professionalId, dateOfBirth }) {
  const normalized = normalizePhone(phone);
  const professional = String(professionalId || '');
  const trimmedName = String(name || '').trim();
  const dob = String(dateOfBirth || '').trim() || null;

  const existing = await findClientByPhone({ phone: normalized, professionalId: professional });
  if (existing) {
    if (dob && !existing.dateOfBirth) {
      return updateClientBirthDate({ patientId: existing.id, professionalId: professional, dateOfBirth: dob });
    }
    return existing;
  }

  if (supabase && professional && trimmedName) {
    const nowIso = new Date().toISOString();
    const inserted = await supabase
      .from('patients')
      .insert({
        professional_id: professional,
        full_name: trimmedName,
        phone: normalized || null,
        date_of_birth: dob,
        whatsapp_birth_date_confirmed_at: dob ? nowIso : null,
        registration_completed_at: dob ? nowIso : null,
      })
      .select(
        'id, full_name, phone, professional_id, date_of_birth, whatsapp_birth_date_confirmed_at, registration_completed_at'
      )
      .single();

    if (inserted.error) throw new Error(inserted.error.message);
    return mapPatientRow(inserted.data);
  }

  const client = {
    id: uuidv4(),
    professionalId: professional,
    name: trimmedName,
    phone: normalized,
    dateOfBirth: dob,
    createdAt: new Date().toISOString(),
    source: 'memory',
  };
  clients.push(client);
  return client;
}

async function updateClientBirthDate({ patientId, professionalId, dateOfBirth }) {
  const dob = String(dateOfBirth || '').trim();
  if (!patientId || !professionalId || !dob) return null;

  if (supabase) {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('patients')
      .update({
        date_of_birth: dob,
        whatsapp_birth_date_confirmed_at: nowIso,
        registration_completed_at: nowIso,
      })
      .eq('id', patientId)
      .eq('professional_id', professionalId)
      .select(
        'id, full_name, phone, professional_id, date_of_birth, whatsapp_birth_date_confirmed_at, registration_completed_at'
      )
      .single();

    if (error) throw new Error(error.message);
    return mapPatientRow(data);
  }

  const local = clients.find((c) => c.id === patientId && String(c.professionalId) === String(professionalId));
  if (local) {
    local.dateOfBirth = dob;
    local.birthDateConfirmedAt = new Date().toISOString();
    return local;
  }
  return null;
}

async function markBirthDateConfirmed({ patientId, professionalId }) {
  if (!patientId || !professionalId) return null;
  const confirmedAt = new Date().toISOString();

  if (supabase) {
    const { data, error } = await supabase
      .from('patients')
      .update({ whatsapp_birth_date_confirmed_at: confirmedAt })
      .eq('id', patientId)
      .eq('professional_id', professionalId)
      .select('id, full_name, phone, professional_id, date_of_birth, whatsapp_birth_date_confirmed_at')
      .single();

    if (error) throw new Error(error.message);
    return mapPatientRow(data);
  }

  const local = clients.find(
    (c) => c.id === patientId && String(c.professionalId) === String(professionalId)
  );
  if (local) {
    local.birthDateConfirmedAt = confirmedAt;
    return local;
  }
  return null;
}

module.exports = {
  clients,
  findClientByPhone,
  createClient,
  updateClientBirthDate,
  markBirthDateConfirmed,
  isPatientFullyRegistered,
  isRecognizedPatient,
  isBirthDateConfirmed,
};
