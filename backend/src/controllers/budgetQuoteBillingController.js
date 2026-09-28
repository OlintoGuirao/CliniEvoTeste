const { logger } = require('../utils/logger');
const {
  sendCobrancaForBudgetQuote,
  runDailyBudgetQuoteBillingJob,
  runBudgetQuoteBillingNowForProfessional,
} = require('../services/budgetQuoteBillingService');
const { findProfessionalById } = require('../repositories/professionalRepository');
const budgetQuoteBillingRepository = require('../repositories/budgetQuoteBillingRepository');

async function postCobrancaBudgetQuote(req, res) {
  try {
    const { professionalId, quoteId } = req.params;
    if (!professionalId || !quoteId) {
      return res.status(400).json({ error: 'professionalId e quoteId são obrigatórios' });
    }

    const professional = await findProfessionalById(professionalId);
    if (!professional) {
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }

    const quote = await budgetQuoteBillingRepository.findQuoteById(quoteId);
    if (!quote) {
      return res.status(404).json({ error: 'Orçamento não encontrado' });
    }
    if (quote.professional_id !== professionalId) {
      return res.status(403).json({ error: 'Orçamento não pertence a este profissional' });
    }

    const result = await sendCobrancaForBudgetQuote(quoteId, { force: true });
    return res.json({
      ok: true,
      ...result,
      message: 'Cobrança enviada pelo WhatsApp conectado.',
    });
  } catch (error) {
    logger.error('Erro ao enviar cobrança de orçamento', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Erro interno ao enviar cobrança',
    });
  }
}

async function postRunDailyBudgetQuoteBilling(req, res) {
  try {
    const cronSecret = String(process.env.BOTOX_BILLING_CRON_SECRET || '').trim();
    const provided = String(req.header('x-cron-secret') || '').trim();
    if (cronSecret && provided !== cronSecret) {
      return res.status(403).json({ error: 'Cron secret inválido' });
    }

    const summary = await runDailyBudgetQuoteBillingJob();
    return res.json({ ok: true, summary });
  } catch (error) {
    logger.error('Erro no job de cobrança de orçamentos', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Erro interno no job de cobrança',
    });
  }
}

async function postRunBudgetQuoteBillingNowForProfessional(req, res) {
  try {
    const { professionalId } = req.params;
    if (!professionalId) {
      return res.status(400).json({ error: 'professionalId é obrigatório' });
    }

    const professional = await findProfessionalById(professionalId);
    if (!professional) {
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }

    const summary = await runBudgetQuoteBillingNowForProfessional(professionalId);
    return res.json({
      ok: true,
      summary,
      message:
        summary.sent > 0
          ? `${summary.sent} cobrança(s) PIX enviada(s) aos orçamentos com parcela pendente.`
          : 'Nenhuma cobrança enviada. Verifique PIX, WhatsApp, telefone e parcelas pendentes.',
    });
  } catch (error) {
    logger.error('Erro no envio de cobrança PIX de orçamento', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Erro interno no envio de cobrança',
    });
  }
}

module.exports = {
  postCobrancaBudgetQuote,
  postRunDailyBudgetQuoteBilling,
  postRunBudgetQuoteBillingNowForProfessional,
};
