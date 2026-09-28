const { supabase } = require('../config/supabase');
const { phonesMatch } = require('../store/phoneUtils');

async function isWhatsappSecretaryEnabled(professionalId) {
  if (!supabase || !professionalId) return false;

  const { data, error } = await supabase
    .from('professional_ui_settings')
    .select('whatsapp_secretary_enabled')
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (error) {
    if (/whatsapp_secretary_enabled|column/i.test(error.message || '')) return false;
    throw new Error(error.message);
  }

  if (!data || data.whatsapp_secretary_enabled == null) return false;
  return data.whatsapp_secretary_enabled === true;
}

async function isAppointmentReminder24hEnabled(professionalId) {
  if (!supabase || !professionalId) return true;

  const { data, error } = await supabase
    .from('professional_ui_settings')
    .select('appointment_reminder_24h_enabled')
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (error) {
    if (/appointment_reminder_24h_enabled|column/i.test(error.message || '')) return true;
    throw new Error(error.message);
  }

  if (!data || data.appointment_reminder_24h_enabled == null) return true;
  return data.appointment_reminder_24h_enabled !== false;
}

async function isAppointmentReminder1hEnabled(professionalId) {
  if (!supabase || !professionalId) return true;

  const { data, error } = await supabase
    .from('professional_ui_settings')
    .select('appointment_reminder_1h_enabled')
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (error) {
    if (/appointment_reminder_1h_enabled|column/i.test(error.message || '')) return true;
    throw new Error(error.message);
  }

  if (!data || data.appointment_reminder_1h_enabled == null) return true;
  return data.appointment_reminder_1h_enabled !== false;
}

async function isAppointmentPresenceConfirmation24hEnabled(professionalId) {
  if (!supabase || !professionalId) return false;

  const { data, error } = await supabase
    .from('professional_ui_settings')
    .select('appointment_presence_confirmation_24h_enabled')
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (error) {
    if (/appointment_presence_confirmation_24h_enabled|column/i.test(error.message || '')) return false;
    throw new Error(error.message);
  }

  if (!data || data.appointment_presence_confirmation_24h_enabled == null) return false;
  return data.appointment_presence_confirmation_24h_enabled === true;
}

async function isAppointmentPresenceConfirmationEnabled(professionalId) {
  if (!supabase || !professionalId) return true;

  const { data, error } = await supabase
    .from('professional_ui_settings')
    .select('appointment_presence_confirmation_enabled')
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (error) {
    if (/appointment_presence_confirmation_enabled|column/i.test(error.message || '')) return true;
    throw new Error(error.message);
  }

  if (!data || data.appointment_presence_confirmation_enabled == null) return true;
  return data.appointment_presence_confirmation_enabled !== false;
}

async function isWhatsappPhoneIgnored(professionalId, phone, branchId = null) {
  if (!supabase || !professionalId || !phone) return false;

  let list = [];

  if (branchId) {
    const { data: branchData, error: branchError } = await supabase
      .from('branch_whatsapp_settings')
      .select('whatsapp_ignored_phones')
      .eq('branch_id', branchId)
      .maybeSingle();

    if (branchError) {
      if (/whatsapp_ignored_phones|column/i.test(branchError.message || '')) {
        list = [];
      } else {
        throw new Error(branchError.message);
      }
    } else {
      list = Array.isArray(branchData?.whatsapp_ignored_phones)
        ? branchData.whatsapp_ignored_phones
        : [];
    }
  }

  if (!list.length) {
    const { data, error } = await supabase
      .from('professional_ui_settings')
      .select('whatsapp_ignored_phones')
      .eq('professional_id', professionalId)
      .maybeSingle();

    if (error) {
      if (/whatsapp_ignored_phones|column/i.test(error.message || '')) return false;
      throw new Error(error.message);
    }

    list = Array.isArray(data?.whatsapp_ignored_phones) ? data.whatsapp_ignored_phones : [];
  }

  if (!list.length) return false;
  return list.some((ignoredPhone) => phonesMatch(ignoredPhone, phone));
}

async function getAppointmentReminder24hMessage(professionalId) {
  if (!supabase || !professionalId) return null;

  const { data, error } = await supabase
    .from('professional_ui_settings')
    .select('appointment_reminder_24h_message')
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (error) {
    if (/appointment_reminder_24h_message|column/i.test(error.message || '')) return null;
    throw new Error(error.message);
  }

  const message = data?.appointment_reminder_24h_message;
  if (typeof message !== 'string') return null;
  const trimmed = message.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function getAppointmentReminder1hMessage(professionalId) {
  if (!supabase || !professionalId) return null;

  const { data, error } = await supabase
    .from('professional_ui_settings')
    .select('appointment_reminder_1h_message')
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (error) {
    if (/appointment_reminder_1h_message|column/i.test(error.message || '')) return null;
    throw new Error(error.message);
  }

  const message = data?.appointment_reminder_1h_message;
  if (typeof message !== 'string') return null;
  const trimmed = message.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeReminder1hHours(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(24, Math.max(1, Math.round(n)));
}

async function getAppointmentReminder1hHours(professionalId) {
  if (!supabase || !professionalId) return 1;

  const { data, error } = await supabase
    .from('professional_ui_settings')
    .select('appointment_reminder_1h_hours')
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (error) {
    if (/appointment_reminder_1h_hours|column/i.test(error.message || '')) return 1;
    throw new Error(error.message);
  }

  return normalizeReminder1hHours(data?.appointment_reminder_1h_hours);
}

async function getAppointmentPresenceConfirmationMessage(professionalId) {
  if (!supabase || !professionalId) return null;

  const { data, error } = await supabase
    .from('professional_ui_settings')
    .select('appointment_presence_confirmation_message')
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (error) {
    if (/appointment_presence_confirmation_message|column/i.test(error.message || '')) return null;
    throw new Error(error.message);
  }

  const message = data?.appointment_presence_confirmation_message;
  if (typeof message !== 'string') return null;
  const trimmed = message.trim();
  return trimmed.length > 0 ? trimmed : null;
}

module.exports = {
  isWhatsappSecretaryEnabled,
  isAppointmentReminder24hEnabled,
  isAppointmentReminder1hEnabled,
  isAppointmentPresenceConfirmation24hEnabled,
  isAppointmentPresenceConfirmationEnabled,
  isWhatsappPhoneIgnored,
  getAppointmentReminder24hMessage,
  getAppointmentReminder1hMessage,
  getAppointmentReminder1hHours,
  getAppointmentPresenceConfirmationMessage,
};
