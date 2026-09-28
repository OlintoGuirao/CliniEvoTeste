const { logger } = require('../utils/logger');
const { sendMedia } = require('./whatsappService');
const { findProfessionalById } = require('../repositories/professionalRepository');
const programaBotoxRepository = require('../repositories/programaBotoxRepository');
const {
  buildCobrancaBotoxPixMessage,
  getBrazilBillingContext,
} = require('../lib/botoxBillingMessage');
const {
  generatePixBrCodeAndQrBase64,
} = require('../lib/pixQr');
const { supabase } = require('../config/supabase');

async function fetchProfessionalPixSettings(professionalId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('pix_key, pix_key_type, pix_receiver_name, full_name, app_name')
    .eq('id', professionalId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.pix_key) {
    throw new Error('Cadastre sua chave PIX em Cobrança antes de enviar.');
  }

  const personalName = data.full_name || 'Profissional';
  const displayName = String(data.app_name || '').trim() || personalName;
  const receiverName = String(data.pix_receiver_name || '').trim() || displayName;

  return {
    pixKey: String(data.pix_key).trim(),
    receiverName,
    displayName,
  };
}

/**
 * Envia cobrança PIX (QR) com soma dos meses pendentes.
 */
async function sendCobrancaForPrograma(programaId, options = {}) {
  const { force = false } = options;

  const programa = await programaBotoxRepository.findProgramaById(programaId);
  if (!programa) throw new Error('Programa não encontrado');
  if (programa.status !== 'ativo') throw new Error('Programa não está ativo');

  const pendingMonths = await programaBotoxRepository.getPendingMonths(programa);
  if (pendingMonths.length === 0) {
    throw new Error('Nenhuma mensalidade pendente para este paciente');
  }

  const { mesReferencia: currentMes } = getBrazilBillingContext();
  if (!force) {
    const alreadySent = await programaBotoxRepository.alreadySentCobranca(programa.id, currentMes);
    if (alreadySent) {
      return { ok: true, skipped: true, reason: 'already_sent', mesReferencia: currentMes };
    }
  }

  const professional = await findProfessionalById(programa.professional_id);
  if (!professional?.whatsappInstanceId) {
    throw new Error('WhatsApp não conectado. Vincule em Configurações → Secretária WhatsApp.');
  }

  const patient = programa.patients;
  const phone = patient?.phone;
  if (!phone) throw new Error('Cadastre o telefone do paciente para enviar a cobrança.');

  const pixSettings = await fetchProfessionalPixSettings(programa.professional_id);
  const valorMensalidade = await programaBotoxRepository.resolveValorMensalidade(programa);
  const valorTotal = Number((valorMensalidade * pendingMonths.length).toFixed(2));

  const caption = buildCobrancaBotoxPixMessage({
    patientName: patient?.full_name,
    pendingMonthKeys: pendingMonths,
    valorMensalidade,
    valorTotal,
  });

  const { brCode, base64 } = await generatePixBrCodeAndQrBase64({
    pixKey: pixSettings.pixKey,
    receiverName: pixSettings.receiverName,
    amount: valorTotal,
    description: `Programa Botox ${pendingMonths.length} mes(es)`,
  });

  const mediaResult = await sendMedia(professional.whatsappInstanceId, phone, {
    mediatype: 'image',
    media: base64,
    mimetype: 'image/png',
    caption,
    fileName: 'pix-botox.png',
  });

  await programaBotoxRepository.recordCobrancaForMonths({
    programaId: programa.id,
    monthKeys: pendingMonths,
    channel: 'evolution_pix',
    providerMessageId: mediaResult.id,
  });

  return {
    ok: true,
    sent: true,
    mesReferencia: currentMes,
    pendingMonths,
    valorMensalidade,
    valorTotal,
    messageId: mediaResult.id,
    brCode,
    patientName: patient?.full_name || 'Paciente',
  };
}

async function runDailyBillingJob() {
  const { mesReferencia, dayOfMonth } = getBrazilBillingContext();
  const programas = await programaBotoxRepository.findActiveProgramasDueToday(dayOfMonth);

  const summary = {
    mesReferencia,
    dayOfMonth,
    total: programas.length,
    sent: 0,
    skipped: 0,
    errors: 0,
  };

  for (const programa of programas) {
    try {
      const autoEnabled = await programaBotoxRepository.isAutoSendEnabled(programa.professional_id);
      if (!autoEnabled) {
        summary.skipped += 1;
        continue;
      }

      const pendingMonths = await programaBotoxRepository.getPendingMonths(programa);
      if (pendingMonths.length === 0) {
        summary.skipped += 1;
        continue;
      }

      const result = await sendCobrancaForPrograma(programa.id, { force: false });

      if (result.skipped) summary.skipped += 1;
      else if (result.sent) summary.sent += 1;
    } catch (error) {
      summary.errors += 1;
      logger.warn('Falha na cobrança automática do programa de Botox', {
        programaId: programa.id,
        professionalId: programa.professional_id,
        message: error?.message || String(error),
      });
    }
  }

  logger.info('Job de cobrança do programa de Botox concluído', summary);
  return summary;
}

/** Envia agora para todos os programas ativos com pelo menos um mês pendente. */
async function runBillingNowForProfessional(professionalId) {
  const professional = await findProfessionalById(professionalId);
  if (!professional) throw new Error('Profissional não encontrado');
  if (!professional.whatsappInstanceId) {
    throw new Error('WhatsApp não conectado. Vincule em Configurações → Secretária WhatsApp.');
  }

  // Valida PIX uma vez antes do loop
  await fetchProfessionalPixSettings(professionalId);

  const { mesReferencia } = getBrazilBillingContext();
  const programas = await programaBotoxRepository.findActiveProgramasByProfessional(professionalId);

  const summary = {
    mesReferencia,
    total: programas.length,
    sent: 0,
    skipped: 0,
    errors: 0,
    sentPatients: [],
    skippedPatients: [],
    errorPatients: [],
  };

  for (const programa of programas) {
    const patientName = programa.patients?.full_name || 'Paciente';
    try {
      const pendingMonths = await programaBotoxRepository.getPendingMonths(programa);
      if (pendingMonths.length === 0) {
        summary.skipped += 1;
        summary.skippedPatients.push({ patientName, reason: 'sem_pendencia' });
        continue;
      }

      const result = await sendCobrancaForPrograma(programa.id, { force: true });

      if (result.sent) {
        summary.sent += 1;
        summary.sentPatients.push({
          patientName,
          messageId: result.messageId,
          pendingMonths: result.pendingMonths,
          valorTotal: result.valorTotal,
        });
      } else if (result.skipped) {
        summary.skipped += 1;
        summary.skippedPatients.push({ patientName, reason: result.reason || 'skipped' });
      }
    } catch (error) {
      summary.errors += 1;
      summary.errorPatients.push({
        patientName,
        error: error?.message || String(error),
      });
      logger.warn('Falha no envio de cobrança PIX do programa de Botox', {
        programaId: programa.id,
        professionalId,
        message: error?.message || String(error),
      });
    }
  }

  logger.info('Envio de cobrança PIX do programa de Botox concluído', {
    professionalId,
    mesReferencia,
    sent: summary.sent,
    skipped: summary.skipped,
    errors: summary.errors,
  });

  return summary;
}

module.exports = {
  sendCobrancaForPrograma,
  runDailyBillingJob,
  runBillingNowForProfessional,
  getBrazilBillingContext,
};
