const { supabase } = require('../config/supabase');

async function listProfessionalIdsWithBirthdayEnabled() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('professional_ui_settings')
    .select('professional_id')
    .eq('birthday_whatsapp_enabled', true);

  if (error) {
    if (/birthday_whatsapp_enabled|column/i.test(error.message || '')) return [];
    throw new Error(error.message);
  }

  return (data || []).map((row) => row.professional_id).filter(Boolean);
}

async function isBirthdayWhatsappEnabled(professionalId) {
  if (!supabase || !professionalId) return false;

  const { data, error } = await supabase
    .from('professional_ui_settings')
    .select('birthday_whatsapp_enabled')
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (error) {
    if (/birthday_whatsapp_enabled|column/i.test(error.message || '')) return false;
    throw new Error(error.message);
  }

  return data?.birthday_whatsapp_enabled === true;
}

async function getBirthdayMessageTemplate(professionalId) {
  if (!supabase || !professionalId) return null;

  const { data, error } = await supabase
    .from('professional_ui_settings')
    .select('birthday_whatsapp_message')
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (error) {
    if (/birthday_whatsapp_message|column/i.test(error.message || '')) return null;
    throw new Error(error.message);
  }

  const message = data?.birthday_whatsapp_message;
  return typeof message === 'string' && message.trim() ? message.trim() : null;
}

async function alreadySentBirthday(patientId, birthYear) {
  if (!supabase || !patientId || !birthYear) return false;

  const { data, error } = await supabase
    .from('patient_birthday_whatsapp_sent')
    .select('id')
    .eq('patient_id', patientId)
    .eq('birth_year', birthYear)
    .maybeSingle();

  if (error) {
    if (/patient_birthday_whatsapp_sent|relation|column/i.test(error.message || '')) return false;
    throw new Error(error.message);
  }

  return Boolean(data?.id);
}

async function recordBirthdaySent(params) {
  if (!supabase) return;

  const { error } = await supabase.from('patient_birthday_whatsapp_sent').upsert(
    {
      patient_id: params.patientId,
      professional_id: params.professionalId,
      birth_year: params.birthYear,
      channel: params.channel || 'evolution',
      provider_message_id: params.providerMessageId || null,
      sent_at: new Date().toISOString(),
    },
    { onConflict: 'patient_id,birth_year' }
  );

  if (error) throw new Error(error.message);
}

module.exports = {
  listProfessionalIdsWithBirthdayEnabled,
  isBirthdayWhatsappEnabled,
  getBirthdayMessageTemplate,
  alreadySentBirthday,
  recordBirthdaySent,
};
