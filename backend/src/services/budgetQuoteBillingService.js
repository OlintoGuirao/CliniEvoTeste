const { logger } = require('../utils/logger');
const { sendMedia } = require('./whatsappService');
const { findProfessionalById } = require('../repositories/professionalRepository');
const budgetQuoteBillingRepository = require('../repositories/budgetQuoteBillingRepository');
const {
  buildCobrancaOrcamentoPixMessage,
  getBrazilBillingContext,
} = require('../lib/budgetQuoteBillingMessage');
const { generatePixBrCodeAndQrBase64 } = require('../lib/pixQr');
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

async function sendCobrancaForBudgetQuote(quoteId, options = {}) {
  const { force = false } = options;

  const quote = await budgetQuoteBillingRepository.findQuoteById(quoteId);
  if (!quote) throw new Error('Orçamento não encontrado');
  if (quote.status !== 'accepted') throw new Error('Orçamento não está aceito');

  const pendingPayments = await budgetQuoteBillingRepository.getPendingPayments(quote.id);
  if (pendingPayments.length === 0) {
    throw new Error('Nenhuma parcela pendente para este orçamento');
  }

  const pendingMonths = pendingPayments.map((p) => p.mes_referencia);
  const valorTotal = Number(
    pendingPayments.reduce((s, p) => s + Number(p.valor || 0), 0).toFixed(2)
  );

  const { mesReferencia: currentMes } = getBrazilBillingContext();
  if (!force) {
    const alreadySent = await budgetQuoteBillingRepository.alreadySentCobranca(quote.id, currentMes);
    if (alreadySent) {
      return { ok: true, skipped: true, reason: 'already_sent', mesReferencia: currentMes };
    }
  }

  const professional = await findProfessionalById(quote.professional_id);
  if (!professional?.whatsappInstanceId) {
    throw new Error('WhatsApp não conectado. Vincule em Configurações → Secretária WhatsApp.');
  }

  const patient = quote.patients;
  const phone = patient?.phone;
  if (!phone) throw new Error('Cadastre o telefone do paciente para enviar a cobrança.');

  const pixSettings = await fetchProfessionalPixSettings(quote.professional_id);

  const caption = buildCobrancaOrcamentoPixMessage({
    patientName: patient?.full_name,
    pendingMonthKeys: pendingMonths,
    valorTotal,
    quoteTitle: quote.title,
  });

  const { brCode, base64 } = await generatePixBrCodeAndQrBase64({
    pixKey: pixSettings.pixKey,
    receiverName: pixSettings.receiverName,
    amount: valorTotal,
    description: `Orcamento ${pendingMonths.length} mes(es)`,
  });

  const mediaResult = await sendMedia(professional.whatsappInstanceId, phone, {
    mediatype: 'image',
    media: base64,
    mimetype: 'image/png',
    caption,
    fileName: 'pix-orcamento.png',
  });

  await budgetQuoteBillingRepository.recordCobrancaForMonths({
    quoteId: quote.id,
    monthKeys: pendingMonths,
    channel: 'evolution_pix',
    providerMessageId: mediaResult.id,
  });

  return {
    ok: true,
    sent: true,
    mesReferencia: currentMes,
    pendingMonths,
    valorTotal,
    messageId: mediaResult.id,
    brCode,
    patientName: patient?.full_name || 'Paciente',
  };
}

async function runDailyBudgetQuoteBillingJob() {
  const { mesReferencia, dayOfMonth } = getBrazilBillingContext();
  const quotes = await budgetQuoteBillingRepository.findAcceptedQuotesDueToday(dayOfMonth);

  const summary = {
    mesReferencia,
    dayOfMonth,
    total: quotes.length,
    sent: 0,
    skipped: 0,
    errors: 0,
  };

  for (const quote of quotes) {
    try {
      const autoEnabled = await budgetQuoteBillingRepository.isAutoSendEnabled(quote.professional_id);
      if (!autoEnabled) {
        summary.skipped += 1;
        continue;
      }

      const pending = await budgetQuoteBillingRepository.getPendingPayments(quote.id);
      if (pending.length === 0) {
        summary.skipped += 1;
        continue;
      }

      const result = await sendCobrancaForBudgetQuote(quote.id, { force: false });
      if (result.skipped) summary.skipped += 1;
      else if (result.sent) summary.sent += 1;
    } catch (error) {
      summary.errors += 1;
      logger.warn('Falha na cobrança automática de orçamento', {
        quoteId: quote.id,
        professionalId: quote.professional_id,
        message: error?.message || String(error),
      });
    }
  }

  logger.info('Job de cobrança de orçamentos concluído', summary);
  return summary;
}

async function runBudgetQuoteBillingNowForProfessional(professionalId) {
  const professional = await findProfessionalById(professionalId);
  if (!professional) throw new Error('Profissional não encontrado');
  if (!professional.whatsappInstanceId) {
    throw new Error('WhatsApp não conectado. Vincule em Configurações → Secretária WhatsApp.');
  }

  await fetchProfessionalPixSettings(professionalId);

  const { mesReferencia } = getBrazilBillingContext();
  const quotes = await budgetQuoteBillingRepository.findAcceptedQuotesByProfessional(professionalId);

  const summary = {
    mesReferencia,
    total: quotes.length,
    sent: 0,
    skipped: 0,
    errors: 0,
    sentPatients: [],
    skippedPatients: [],
    errorPatients: [],
  };

  for (const quote of quotes) {
    const patientName = quote.patients?.full_name || 'Paciente';
    try {
      const pending = await budgetQuoteBillingRepository.getPendingPayments(quote.id);
      if (pending.length === 0) {
        summary.skipped += 1;
        summary.skippedPatients.push({ patientName, reason: 'sem_pendencia' });
        continue;
      }

      const result = await sendCobrancaForBudgetQuote(quote.id, { force: true });
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
    }
  }

  return summary;
}

module.exports = {
  sendCobrancaForBudgetQuote,
  runDailyBudgetQuoteBillingJob,
  runBudgetQuoteBillingNowForProfessional,
};
