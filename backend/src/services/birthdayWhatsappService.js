const { logger } = require('../utils/logger');
const { sendText } = require('./whatsappService');
const { findProfessionalById } = require('../repositories/professionalRepository');
const { listPatientsWithBirthdayInWeek } = require('../repositories/patientsRepository');
const birthdayWhatsappRepository = require('../repositories/birthdayWhatsappRepository');
const {
  buildBirthdayMessage,
  getBrazilWeekBirthdayContext,
  getBirthdayOccurrenceYear,
} = require('../lib/birthdayMessage');

async function sendBirthdayForPatient(patient, professional, options = {}) {
  const { force = false, birthYear: birthYearOverride, template } = options;
  const birthYear = birthYearOverride || getBrazilWeekBirthdayContext().year;

  if (!force) {
    const alreadySent = await birthdayWhatsappRepository.alreadySentBirthday(patient.id, birthYear);
    if (alreadySent) {
      return { ok: true, skipped: true, reason: 'already_sent', patientName: patient.fullName };
    }
  }

  if (!professional?.whatsappInstanceId) {
    throw new Error('WhatsApp não conectado. Vincule em Configurações → Secretária WhatsApp.');
  }

  const messageTemplate =
    template ?? (await birthdayWhatsappRepository.getBirthdayMessageTemplate(professional.id));
  const text = buildBirthdayMessage(messageTemplate, patient.fullName, professional.displayName);
  const result = await sendText(professional.whatsappInstanceId, patient.phone, text);

  await birthdayWhatsappRepository.recordBirthdaySent({
    patientId: patient.id,
    professionalId: professional.id,
    birthYear,
    channel: 'evolution',
    providerMessageId: result.id,
  });

  return {
    ok: true,
    sent: true,
    patientName: patient.fullName,
    messageId: result.id,
  };
}

async function runWeeklyBirthdayJob() {
  const { year, month, day, weekStart, weekEnd } = getBrazilWeekBirthdayContext();
  const professionalIds = await birthdayWhatsappRepository.listProfessionalIdsWithBirthdayEnabled();

  const summary = {
    weekStart: `${weekStart.year}-${String(weekStart.month).padStart(2, '0')}-${String(weekStart.day).padStart(2, '0')}`,
    weekEnd: `${weekEnd.year}-${String(weekEnd.month).padStart(2, '0')}-${String(weekEnd.day).padStart(2, '0')}`,
    runDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    professionals: professionalIds.length,
    total: 0,
    sent: 0,
    skipped: 0,
    errors: 0,
  };

  for (const professionalId of professionalIds) {
    try {
      const professional = await findProfessionalById(professionalId);
      if (!professional?.whatsappInstanceId) {
        continue;
      }

      const patients = await listPatientsWithBirthdayInWeek(professionalId, weekStart, weekEnd);
      const template = await birthdayWhatsappRepository.getBirthdayMessageTemplate(professionalId);

      for (const patient of patients) {
        summary.total += 1;
        const birthYear = getBirthdayOccurrenceYear(patient.dateOfBirth, weekStart);
        try {
          const result = await sendBirthdayForPatient(patient, professional, {
            force: false,
            birthYear,
            template,
          });
          if (result.skipped) summary.skipped += 1;
          else if (result.sent) summary.sent += 1;
        } catch (error) {
          summary.errors += 1;
          logger.warn('Falha no parabéns de aniversário', {
            professionalId,
            patientId: patient.id,
            message: error?.message || String(error),
          });
        }
      }
    } catch (error) {
      logger.warn('Falha ao processar aniversários do profissional', {
        professionalId,
        message: error?.message || String(error),
      });
    }
  }

  logger.info('Job semanal de aniversário WhatsApp concluído', summary);
  return summary;
}

/** Teste manual: envia para aniversariantes da semana atual. */
async function runBirthdayNowForProfessional(professionalId, options = {}) {
  const { force = true } = options;
  const professional = await findProfessionalById(professionalId);
  if (!professional) throw new Error('Profissional não encontrado');
  if (!professional.whatsappInstanceId) {
    throw new Error('WhatsApp não conectado. Vincule em Configurações → Secretária WhatsApp.');
  }

  const enabled = await birthdayWhatsappRepository.isBirthdayWhatsappEnabled(professionalId);
  if (!enabled) {
    throw new Error('Ative o envio automático de aniversário antes de testar.');
  }

  const { year, month, day, weekStart, weekEnd } = getBrazilWeekBirthdayContext();
  const patients = await listPatientsWithBirthdayInWeek(professionalId, weekStart, weekEnd);
  const template = await birthdayWhatsappRepository.getBirthdayMessageTemplate(professionalId);

  const summary = {
    weekStart: `${weekStart.year}-${String(weekStart.month).padStart(2, '0')}-${String(weekStart.day).padStart(2, '0')}`,
    weekEnd: `${weekEnd.year}-${String(weekEnd.month).padStart(2, '0')}-${String(weekEnd.day).padStart(2, '0')}`,
    runDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    total: patients.length,
    sent: 0,
    skipped: 0,
    errors: 0,
    sentPatients: [],
    skippedPatients: [],
    errorPatients: [],
  };

  for (const patient of patients) {
    const birthYear = getBirthdayOccurrenceYear(patient.dateOfBirth, weekStart);
    try {
      const result = await sendBirthdayForPatient(patient, professional, {
        force,
        birthYear,
        template,
      });
      if (result.skipped) {
        summary.skipped += 1;
        summary.skippedPatients.push({ patientName: patient.fullName, reason: result.reason || 'skipped' });
      } else if (result.sent) {
        summary.sent += 1;
        summary.sentPatients.push({ patientName: patient.fullName, messageId: result.messageId });
      }
    } catch (error) {
      summary.errors += 1;
      summary.errorPatients.push({
        patientName: patient.fullName,
        error: error?.message || String(error),
      });
    }
  }

  return summary;
}

module.exports = {
  sendBirthdayForPatient,
  runWeeklyBirthdayJob,
  runBirthdayNowForProfessional,
};
