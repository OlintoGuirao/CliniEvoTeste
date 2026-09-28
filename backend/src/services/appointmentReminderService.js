const { logger } = require('../utils/logger');
const { sendText, getConnectionStatus } = require('./whatsappService');
const {
  findProfessionalById,
  resolveReminderDisplayNames,
} = require('../repositories/professionalRepository');
const {
  listAppointmentsNeedingReminder24h,
  markReminder24hSentMany,
  listAppointmentsNeedingReminder1h,
  markReminder1hSentMany,
  listAppointmentsForReminderStatusByDate,
} = require('../repositories/appointmentsRepository');
const {
  parseAppointmentDateTimeBR,
  getBrazilTomorrowYmd,
  formatDateBRFromYmd,
} = require('../utils/time');
const {
  buildAppointmentReminder24hMessage,
  buildAppointmentReminder1hMessage,
  procedureNameFromAppointment,
} = require('../lib/appointmentReminderMessage');
const { groupReminderAppointments, getGroupTimeRange } = require('../lib/appointmentReminderGroups');
const { findClientByPhone } = require('../store/clientStore');
const {
  isAppointmentReminder24hEnabled,
  isAppointmentReminder1hEnabled,
  isAppointmentPresenceConfirmation24hEnabled,
  isAppointmentPresenceConfirmationEnabled,
  getAppointmentReminder24hMessage,
  getAppointmentReminder1hMessage,
  getAppointmentReminder1hHours,
  getAppointmentPresenceConfirmationMessage,
} = require('../repositories/professionalUiSettingsRepository');

const MS_HOUR = 60 * 60 * 1000;
// Janela ampla: job a cada ~15min + falhas de timezone/rede não perdem o envio
const REMINDER_24H_MIN = 22;
const REMINDER_24H_MAX = 26;
const REMINDER_NEAR_WINDOW_HOURS = 0.5;
const SEND_DELAY_MS = 1500;

function hoursUntilAppointment(appointmentDate, startTime) {
  const apptAt = parseAppointmentDateTimeBR(appointmentDate, startTime);
  if (!apptAt) return null;
  return (apptAt.getTime() - Date.now()) / MS_HOUR;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolvePatientPhone(appointment) {
  const direct = appointment?.pre_registration_phone;
  if (direct) return direct;

  if (appointment?.patient_id) {
    const { supabase } = require('../config/supabase');
    if (supabase) {
      const { data } = await supabase
        .from('patients')
        .select('phone')
        .eq('id', appointment.patient_id)
        .maybeSingle();
      if (data?.phone) return data.phone;
    }
  }

  return null;
}

/**
 * Cache por tick: se a instância caiu, não tenta enviar o restante e não marca como enviado
 * (próximo tick tenta de novo enquanto estiver na janela).
 */
async function assertInstanceConnected(instanceId, cache) {
  const key = String(instanceId || '').trim();
  if (!key) return { ok: false, reason: 'no_instance' };
  if (cache.has(key)) return cache.get(key);

  let result;
  try {
    const status = await getConnectionStatus(key);
    if (status?.unknown) {
      result = { ok: false, reason: 'connection_unknown' };
    } else if (status?.connected) {
      result = { ok: true };
    } else {
      result = { ok: false, reason: 'whatsapp_disconnected', state: status?.state };
    }
  } catch (error) {
    result = { ok: false, reason: 'connection_check_failed', message: error?.message };
  }

  cache.set(key, result);
  return result;
}

function groupHasReminder24hSent(group) {
  return (group || []).some((row) => Boolean(row?.reminder_24h_sent_at));
}

async function buildReminder24hStatusForProfessional(professionalId, appointmentDate) {
  const date = String(appointmentDate || '').trim() || getBrazilTomorrowYmd();
  const rows = await listAppointmentsForReminderStatusByDate(professionalId, date);
  const groups = groupReminderAppointments(rows);
  const items = [];

  let sent = 0;
  let pending = 0;
  let skippedNoPhone = 0;

  for (const group of groups) {
    const { first, startTime, endTime, ids } = getGroupTimeRange(group);
    const phone = await resolvePatientPhone(first);
    const hasSent = groupHasReminder24hSent(group);
    let status = 'sent';
    let reason = null;

    if (hasSent) {
      sent += 1;
      status = 'sent';
    } else if (!phone) {
      skippedNoPhone += 1;
      status = 'no_phone';
      reason = 'no_phone';
    } else {
      pending += 1;
      status = 'pending';
      reason = 'not_sent';
    }

    items.push({
      appointmentIds: ids,
      patientName: first?.full_name || 'Paciente',
      appointmentDate: first?.appointment_date || date,
      startTime,
      endTime,
      hasPhone: Boolean(phone),
      reminder24hSentAt: first?.reminder_24h_sent_at || null,
      status,
      reason,
    });
  }

  return {
    date,
    dateLabel: formatDateBRFromYmd(date),
    total: groups.length,
    sent,
    pending,
    skippedNoPhone,
    items,
  };
}

async function sendReminderForAppointmentGroup(group, connectionCache) {
  const { first, startTime, endTime, ids } = getGroupTimeRange(group);
  if (!first) return { ok: false, skipped: true, reason: 'empty_group' };

  const professional = await findProfessionalById(first.professional_id);
  if (!professional?.whatsappInstanceId) {
    return { ok: false, skipped: true, reason: 'no_whatsapp' };
  }

  const conn = await assertInstanceConnected(professional.whatsappInstanceId, connectionCache);
  if (!conn.ok) {
    return { ok: false, skipped: true, reason: conn.reason, state: conn.state };
  }

  const phone = await resolvePatientPhone(first);
  if (!phone) {
    return { ok: false, skipped: true, reason: 'no_phone' };
  }

  const patientName =
    first.full_name ||
    (await findClientByPhone({ phone, professionalId: first.professional_id }))?.name ||
    'Paciente';

  const withPresenceConfirmation = await isAppointmentPresenceConfirmation24hEnabled(
    first.professional_id
  );

  const display = await resolveReminderDisplayNames(first.professional_id);

  const text = buildAppointmentReminder24hMessage({
    patientName,
    procedureName: procedureNameFromAppointment(first, { isSalon: display.isSalon }),
    appointmentDate: first.appointment_date,
    appointmentTime: startTime,
    appointmentEndTime: endTime,
    professionalName: display.professionalName,
    salonName: display.salonName,
    isSalon: display.isSalon,
    template: await getAppointmentReminder24hMessage(first.professional_id),
    withPresenceConfirmation,
    presenceConfirmationTemplate: await getAppointmentPresenceConfirmationMessage(
      first.professional_id
    ),
  });

  const result = await sendText(professional.whatsappInstanceId, phone, text);
  await markReminder24hSentMany(ids);

  return {
    ok: true,
    sent: true,
    messageId: result?.id || null,
    count: ids.length,
    patientName,
  };
}

async function sendMissingReminder24hForProfessional(professionalId, opts = {}) {
  const professional = await findProfessionalById(professionalId);
  if (!professional) throw new Error('Profissional não encontrado');

  const date = String(opts.date || '').trim() || getBrazilTomorrowYmd();
  const onlyIds = Array.isArray(opts.appointmentIds)
    ? new Set(opts.appointmentIds.map(String).filter(Boolean))
    : null;

  const rows = await listAppointmentsForReminderStatusByDate(professionalId, date);
  const groups = groupReminderAppointments(rows);
  const connectionCache = new Map();
  const summary = {
    date,
    dateLabel: formatDateBRFromYmd(date),
    total: 0,
    sent: 0,
    skipped: 0,
    errors: 0,
    sentPatients: [],
    skippedPatients: [],
    errorPatients: [],
  };

  for (const group of groups) {
    const { first, startTime, ids } = getGroupTimeRange(group);
    if (onlyIds && !ids.some((id) => onlyIds.has(String(id)))) continue;
    if (groupHasReminder24hSent(group)) continue;

    summary.total += 1;

    try {
      const result = await sendReminderForAppointmentGroup(group, connectionCache);
      if (result.sent) {
        summary.sent += 1;
        summary.sentPatients.push({
          patientName: result.patientName || first?.full_name || 'Paciente',
          startTime,
          messageId: result.messageId,
        });
        await sleep(SEND_DELAY_MS);
      } else {
        summary.skipped += 1;
        summary.skippedPatients.push({
          patientName: first?.full_name || 'Paciente',
          startTime,
          reason: result.reason || 'skipped',
        });
        if (
          result.reason === 'whatsapp_disconnected' ||
          result.reason === 'connection_unknown' ||
          result.reason === 'connection_check_failed' ||
          result.reason === 'no_whatsapp'
        ) {
          logger.warn('Envio manual de lembrete 24h parado: WhatsApp indisponível', {
            professionalId,
            reason: result.reason,
          });
          break;
        }
      }
    } catch (error) {
      summary.errors += 1;
      summary.errorPatients.push({
        patientName: first?.full_name || 'Paciente',
        startTime,
        error: error?.message || String(error),
      });
      logger.warn('Falha no envio manual de lembrete 24h', {
        professionalId,
        appointmentId: first?.id,
        message: error?.message || String(error),
      });
      await sleep(SEND_DELAY_MS);
    }
  }

  return summary;
}

async function runAppointmentReminder24hJob() {
  const rows = await listAppointmentsNeedingReminder24h();
  const groups = groupReminderAppointments(rows);
  const summary = {
    total: rows.length,
    groups: groups.length,
    sent: 0,
    skipped: 0,
    errors: 0,
    disconnected: 0,
  };
  const connectionCache = new Map();

  for (const group of groups) {
    const { first, startTime, ids } = getGroupTimeRange(group);
    const hours = hoursUntilAppointment(first.appointment_date, startTime);
    if (hours == null || hours < REMINDER_24H_MIN || hours > REMINDER_24H_MAX) {
      summary.skipped += 1;
      continue;
    }

    try {
      const reminderEnabled = await isAppointmentReminder24hEnabled(first.professional_id);
      if (!reminderEnabled) {
        summary.skipped += 1;
        continue;
      }

      const result = await sendReminderForAppointmentGroup(group, connectionCache);
      if (result.sent) {
        summary.sent += 1;
        await sleep(SEND_DELAY_MS);
      } else {
        summary.skipped += 1;
        if (
          result.reason === 'whatsapp_disconnected' ||
          result.reason === 'connection_unknown' ||
          result.reason === 'connection_check_failed'
        ) {
          summary.disconnected += 1;
          logger.warn('Lembrete 24h adiado: WhatsApp desconectado/indisponível', {
            professionalId: first.professional_id,
            appointmentId: first?.id,
            reason: result.reason,
            state: result.state,
          });
        }
      }
    } catch (error) {
      summary.errors += 1;
      logger.warn('Falha ao enviar lembrete 24h', {
        appointmentId: first?.id,
        appointmentIds: ids,
        message: error?.message || String(error),
      });
      await sleep(SEND_DELAY_MS);
    }
  }

  logger.info('Job de lembrete 24h concluído', summary);
  return summary;
}

async function sendReminder1hForAppointmentGroup(group, connectionCache) {
  const { first, startTime, endTime, ids } = getGroupTimeRange(group);
  if (!first) return { ok: false, skipped: true, reason: 'empty_group' };

  const professional = await findProfessionalById(first.professional_id);
  if (!professional?.whatsappInstanceId) {
    return { ok: false, skipped: true, reason: 'no_whatsapp' };
  }

  const conn = await assertInstanceConnected(professional.whatsappInstanceId, connectionCache);
  if (!conn.ok) {
    return { ok: false, skipped: true, reason: conn.reason, state: conn.state };
  }

  const phone = await resolvePatientPhone(first);
  if (!phone) {
    return { ok: false, skipped: true, reason: 'no_phone' };
  }

  const patientName =
    first.full_name ||
    (await findClientByPhone({ phone, professionalId: first.professional_id }))?.name ||
    'Paciente';

  const withPresenceConfirmation = await isAppointmentPresenceConfirmationEnabled(
    first.professional_id
  );

  const display = await resolveReminderDisplayNames(first.professional_id);

  const text = buildAppointmentReminder1hMessage({
    patientName,
    procedureName: procedureNameFromAppointment(first, { isSalon: display.isSalon }),
    appointmentDate: first.appointment_date,
    appointmentTime: startTime,
    appointmentEndTime: endTime,
    professionalName: display.professionalName,
    salonName: display.salonName,
    isSalon: display.isSalon,
    template: await getAppointmentReminder1hMessage(first.professional_id),
    withPresenceConfirmation,
    presenceConfirmationTemplate: await getAppointmentPresenceConfirmationMessage(
      first.professional_id
    ),
  });

  const result = await sendText(professional.whatsappInstanceId, phone, text);
  await markReminder1hSentMany(ids);

  return { ok: true, sent: true, messageId: result?.id || null, count: ids.length };
}

async function runAppointmentReminder1hJob() {
  const rows = await listAppointmentsNeedingReminder1h();
  const groups = groupReminderAppointments(rows);
  const summary = {
    total: rows.length,
    groups: groups.length,
    sent: 0,
    skipped: 0,
    errors: 0,
    disconnected: 0,
  };
  const connectionCache = new Map();

  for (const group of groups) {
    const { first, startTime, ids } = getGroupTimeRange(group);
    const hours = hoursUntilAppointment(first.appointment_date, startTime);
    const targetHours = await getAppointmentReminder1hHours(first.professional_id);
    const minH = Math.max(0.15, targetHours - REMINDER_NEAR_WINDOW_HOURS);
    const maxH = targetHours + REMINDER_NEAR_WINDOW_HOURS;
    if (hours == null || hours < minH || hours > maxH) {
      summary.skipped += 1;
      continue;
    }

    try {
      const reminderEnabled = await isAppointmentReminder1hEnabled(first.professional_id);
      if (!reminderEnabled) {
        summary.skipped += 1;
        continue;
      }

      const result = await sendReminder1hForAppointmentGroup(group, connectionCache);
      if (result.sent) {
        summary.sent += 1;
        await sleep(SEND_DELAY_MS);
      } else {
        summary.skipped += 1;
        if (
          result.reason === 'whatsapp_disconnected' ||
          result.reason === 'connection_unknown' ||
          result.reason === 'connection_check_failed'
        ) {
          summary.disconnected += 1;
          logger.warn('Lembrete 1h adiado: WhatsApp desconectado/indisponível', {
            professionalId: first.professional_id,
            appointmentId: first?.id,
            reason: result.reason,
            state: result.state,
          });
        }
      }
    } catch (error) {
      summary.errors += 1;
      logger.warn('Falha ao enviar lembrete 1h', {
        appointmentId: first?.id,
        appointmentIds: ids,
        message: error?.message || String(error),
      });
      await sleep(SEND_DELAY_MS);
    }
  }

  logger.info('Job de lembrete 1h concluído', summary);
  return summary;
}

module.exports = {
  runAppointmentReminder24hJob,
  runAppointmentReminder1hJob,
  sendReminderForAppointmentGroup,
  sendReminder1hForAppointmentGroup,
  buildReminder24hStatusForProfessional,
  sendMissingReminder24hForProfessional,
};
