const { supabase } = require('../config/supabase');

const PROFILE_WHATSAPP_COLUMN = 'ultramsg_instance_id';

async function findProfessionalById(professionalId) {
  if (!supabase || !professionalId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select(`id, full_name, email, app_name, account_type, organization_id, ${PROFILE_WHATSAPP_COLUMN}`)
    .eq('id', professionalId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return mapProfessionalRow(data);
}

function mapProfessionalRow(data, extras = {}) {
  if (!data) return null;
  const appName = String(data.app_name || '').trim() || null;
  const personalName = data.full_name || data.email || 'Profissional';
  const accountType = String(data.account_type || '').trim().toLowerCase() || null;
  return {
    id: data.id,
    name: personalName,
    appName,
    accountType,
    organizationId: data.organization_id || extras.organizationId || null,
    /** Nome exibido ao paciente (clínica/app); prioriza app_name sobre full_name. */
    displayName: appName || personalName,
    whatsappInstanceId: data[PROFILE_WHATSAPP_COLUMN] || extras.whatsappInstanceId || null,
    /** @deprecated use whatsappInstanceId */
    ultramsgInstanceId: data[PROFILE_WHATSAPP_COLUMN] || extras.whatsappInstanceId || null,
    branchId: extras.branchId || null,
    branchName: extras.branchName || null,
  };
}

async function findOrgOwnerProfile(organizationId) {
  const { data: member, error: memErr } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();
  if (memErr) throw new Error(memErr.message);
  if (!member?.user_id) return null;
  return findProfessionalById(member.user_id);
}

async function findProfessionalByWhatsappInstance(instanceId) {
  if (!supabase || !instanceId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select(`id, full_name, email, app_name, account_type, organization_id, ${PROFILE_WHATSAPP_COLUMN}`)
    .eq(PROFILE_WHATSAPP_COLUMN, instanceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) return mapProfessionalRow(data);

  const { data: branch, error: branchErr } = await supabase
    .from('organization_branches')
    .select('id, organization_id, name, whatsapp_instance_id')
    .eq('whatsapp_instance_id', instanceId)
    .eq('is_active', true)
    .maybeSingle();

  if (branchErr) throw new Error(branchErr.message);
  if (!branch?.organization_id) return null;

  const owner = await findOrgOwnerProfile(branch.organization_id);
  if (!owner) return null;

  return {
    ...owner,
    whatsappInstanceId: branch.whatsapp_instance_id,
    ultramsgInstanceId: branch.whatsapp_instance_id,
    branchId: branch.id,
    branchName: branch.name,
  };
}

/** @deprecated use findProfessionalByWhatsappInstance */
const findProfessionalByUltraMsgInstance = findProfessionalByWhatsappInstance;

/** Conta clínica (organization) — não inclui profissional único nem salão. */
async function isClinicProfessionalAccount(professionalId) {
  if (!supabase || !professionalId) return false;

  const { data, error } = await supabase
    .from('profiles')
    .select('account_type')
    .eq('id', professionalId)
    .maybeSingle();

  if (error || !data) return false;
  return String(data.account_type || '').trim().toLowerCase() === 'clinic';
}

/**
 * Nomes para templates de lembrete WhatsApp.
 * Salão: profissional = pessoa do horário; nome_salao = marca (app_name do dono).
 */
async function resolveReminderDisplayNames(professionalId) {
  const professional = await findProfessionalById(professionalId);
  if (!professional) {
    return {
      isSalon: false,
      professionalName: 'profissional',
      salonName: 'profissional',
    };
  }

  let isSalon = professional.accountType === 'salon';
  let salonName = professional.appName || null;

  if (!isSalon || !salonName) {
    let orgId = professional.organizationId || null;
    if (!orgId && supabase) {
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', professionalId)
        .limit(1)
        .maybeSingle();
      orgId = membership?.organization_id || null;
    }
    if (orgId) {
      const owner = await findOrgOwnerProfile(orgId);
      if (owner) {
        if (owner.accountType === 'salon') isSalon = true;
        salonName = owner.appName || salonName || owner.displayName;
      }
    }
  }

  const professionalName = isSalon
    ? professional.name || professional.displayName
    : professional.displayName;

  return {
    isSalon,
    professionalName: String(professionalName || 'profissional').trim() || 'profissional',
    salonName: String(salonName || professional.displayName || 'profissional').trim() || 'profissional',
  };
}

function parseProfileTimeToMinutes(value) {
  const raw = String(value || '').trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function parseLunchBreaksFromProfile(data) {
  const breaks = [];
  if (Array.isArray(data?.lunch_breaks)) {
    for (const row of data.lunch_breaks) {
      const startMin = parseProfileTimeToMinutes(row?.start);
      const endMin = parseProfileTimeToMinutes(row?.end);
      if (startMin != null && endMin != null && endMin > startMin) {
        breaks.push({ startMin, endMin });
      }
    }
  }
  if (!breaks.length) {
    const startMin = parseProfileTimeToMinutes(data?.lunch_start_time);
    const endMin = parseProfileTimeToMinutes(data?.lunch_end_time);
    if (startMin != null && endMin != null && endMin > startMin) {
      breaks.push({ startMin, endMin });
    }
  }
  return breaks;
}

const DEFAULT_SCHEDULE = {
  workStartMin: 8 * 60,
  workEndMin: 18 * 60,
  workDays: [1, 2, 3, 4, 5],
  lunchBreaks: [],
  lunchStartMin: null,
  lunchEndMin: null,
  clinicClosedDates: new Set(),
  slotMinutes: 30,
};

async function getProfessionalClinicClosedDates(professionalId) {
  if (!supabase || !professionalId) return new Set();

  const { data, error } = await supabase
    .from('professional_clinic_closed_days')
    .select('closed_date')
    .eq('professional_id', professionalId);

  if (error || !data) return new Set();
  return new Set(data.map((row) => String(row.closed_date)));
}

async function getProfessionalSchedule(professionalId) {
  if (!supabase || !professionalId) return { ...DEFAULT_SCHEDULE };

  const { data, error } = await supabase
    .from('profiles')
    .select('work_start_time, work_end_time, work_days, lunch_start_time, lunch_end_time, lunch_breaks')
    .eq('id', professionalId)
    .maybeSingle();

  if (error || !data) return { ...DEFAULT_SCHEDULE };

  const workStartMin = parseProfileTimeToMinutes(data.work_start_time) ?? DEFAULT_SCHEDULE.workStartMin;
  const workEndMin = parseProfileTimeToMinutes(data.work_end_time) ?? DEFAULT_SCHEDULE.workEndMin;
  const lunchBreaks = parseLunchBreaksFromProfile(data);
  const lunchStartMin = lunchBreaks[0]?.startMin ?? null;
  const lunchEndMin = lunchBreaks[0]?.endMin ?? null;
  const workDays = Array.isArray(data.work_days)
    ? data.work_days.map((d) => Number(d)).filter((d) => Number.isInteger(d))
    : DEFAULT_SCHEDULE.workDays;
  const clinicClosedDates = await getProfessionalClinicClosedDates(professionalId);

  return {
    workStartMin,
    workEndMin: workEndMin > workStartMin ? workEndMin : workStartMin + 8 * 60,
    workDays: workDays.length ? workDays : DEFAULT_SCHEDULE.workDays,
    lunchBreaks,
    lunchStartMin,
    lunchEndMin,
    clinicClosedDates,
    slotMinutes: 30,
  };
}

async function clearWhatsappInstanceByProfessionalId(professionalId) {
  if (!supabase || !professionalId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .update({ [PROFILE_WHATSAPP_COLUMN]: null })
    .eq('id', professionalId)
    .select(`id, full_name, email, ${PROFILE_WHATSAPP_COLUMN}`)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return mapProfessionalRow(data);
}

/** @deprecated */
const clearUltraMsgInstanceByProfessionalId = clearWhatsappInstanceByProfessionalId;

async function setWhatsappInstanceByProfessionalId(professionalId, instanceId) {
  if (!supabase || !professionalId) return null;
  const normalized = String(instanceId || '').trim();
  if (!normalized) return null;

  const { data, error } = await supabase
    .from('profiles')
    .update({ [PROFILE_WHATSAPP_COLUMN]: normalized })
    .eq('id', professionalId)
    .select(`id, full_name, email, ${PROFILE_WHATSAPP_COLUMN}`)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return mapProfessionalRow(data);
}

/** @deprecated */
const setUltraMsgInstanceByProfessionalId = setWhatsappInstanceByProfessionalId;

module.exports = {
  findProfessionalByWhatsappInstance,
  findProfessionalByUltraMsgInstance,
  findProfessionalById,
  isClinicProfessionalAccount,
  resolveReminderDisplayNames,
  getProfessionalSchedule,
  getProfessionalClinicClosedDates,
  clearWhatsappInstanceByProfessionalId,
  clearUltraMsgInstanceByProfessionalId,
  setWhatsappInstanceByProfessionalId,
  setUltraMsgInstanceByProfessionalId,
};
