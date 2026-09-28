const { supabase } = require('../config/supabase');
const { phoneLookupVariants, phonesMatch } = require('../store/phoneUtils');
const { isBirthdayInWeek } = require('../lib/birthdayMessage');

function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d]/g, '');
}

async function findOrCreatePatientByPhone(params) {
  if (!supabase) return null;

  const professionalId = params.professionalId;
  const fullName = String(params.fullName || '').trim();
  const phone = normalizePhone(params.phone);
  const variants = phoneLookupVariants(phone);

  if (!professionalId || !fullName) return null;

  if (variants.length) {
    const { data, error } = await supabase
      .from('patients')
      .select('id, full_name, phone, professional_id')
      .eq('professional_id', professionalId)
      .not('phone', 'is', null);

    if (error) throw new Error(error.message);
    const match = (data || []).find((row) => phonesMatch(row.phone, phone));
    if (match) return match;
  }

  const inserted = await supabase
    .from('patients')
    .insert({
      professional_id: professionalId,
      full_name: fullName,
      phone: phone || null,
    })
    .select('id, full_name, phone, professional_id')
    .single();

  if (inserted.error) throw new Error(inserted.error.message);
  return inserted.data;
}

function patientPhoneKey(phone) {
  const digits = normalizePhone(phone);
  if (!digits) return '';
  if (digits.length >= 12 && digits.startsWith('55')) return digits.slice(-11);
  return digits;
}

/**
 * Pacientes elegíveis para envio em massa (promoções WhatsApp).
 * Mesmo critério da aba Pacientes: cadastro completo (registration_completed_at),
 * excluindo pré-cadastros / futuros clientes (avaliação sem ficha completa).
 */
async function listPatientsWithPhoneForProfessional(professionalId) {
  if (!supabase || !professionalId) return [];

  const { data, error } = await supabase
    .from('patients')
    .select('id, full_name, phone, registration_completed_at')
    .eq('professional_id', professionalId)
    .not('registration_completed_at', 'is', null)
    .not('phone', 'is', null)
    .order('registration_completed_at', { ascending: false });

  if (error) throw new Error(error.message);

  const seen = new Set();
  const patients = [];
  for (const row of data || []) {
    if (!row?.registration_completed_at) continue;
    const key = patientPhoneKey(row.phone);
    if (!key || key.length < 10) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    patients.push({
      id: row.id,
      fullName: String(row.full_name || 'Paciente').trim() || 'Paciente',
      phone: row.phone,
    });
  }

  return patients;
}

/**
 * Pacientes com aniversário na semana (segunda a domingo), cadastro completo + telefone.
 */
async function listPatientsWithBirthdayInWeek(professionalId, weekStart, weekEnd) {
  if (!supabase || !professionalId || !weekStart || !weekEnd) return [];

  const { data, error } = await supabase
    .from('patients')
    .select('id, full_name, phone, date_of_birth, registration_completed_at')
    .eq('professional_id', professionalId)
    .not('date_of_birth', 'is', null)
    .not('registration_completed_at', 'is', null)
    .not('phone', 'is', null);

  if (error) throw new Error(error.message);

  const seen = new Set();
  const patients = [];
  for (const row of data || []) {
    if (!row?.registration_completed_at) continue;
    if (!isBirthdayInWeek(row.date_of_birth, weekStart, weekEnd)) continue;
    const key = patientPhoneKey(row.phone);
    if (!key || key.length < 10) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    patients.push({
      id: row.id,
      fullName: String(row.full_name || 'Paciente').trim() || 'Paciente',
      phone: row.phone,
      dateOfBirth: row.date_of_birth,
    });
  }

  return patients;
}

module.exports = {
  findOrCreatePatientByPhone,
  listPatientsWithPhoneForProfessional,
  listPatientsWithBirthdayInWeek,
};
