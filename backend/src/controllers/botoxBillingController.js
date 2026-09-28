const { logger } = require('../utils/logger');
const {
  sendCobrancaForPrograma,
  runDailyBillingJob,
  runBillingNowForProfessional,
} = require('../services/botoxBillingService');
const { findProfessionalById } = require('../repositories/professionalRepository');
const programaBotoxRepository = require('../repositories/programaBotoxRepository');

async function postCobrancaProgramaBotox(req, res) {
  try {
    const { professionalId, programaId } = req.params;
    if (!professionalId || !programaId) {
      return res.status(400).json({ error: 'professionalId e programaId são obrigatórios' });
    }

    const professional = await findProfessionalById(professionalId);
    if (!professional) {
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }

    const programa = await programaBotoxRepository.findProgramaById(programaId);
    if (!programa) {
      return res.status(404).json({ error: 'Programa não encontrado' });
    }
    if (programa.professional_id !== professionalId) {
      return res.status(403).json({ error: 'Programa não pertence a este profissional' });
    }

    const result = await sendCobrancaForPrograma(programaId, { force: true });
    return res.json({
      ok: true,
      ...result,
      message: 'Cobrança enviada pelo WhatsApp conectado.',
    });
  } catch (error) {
    logger.error('Erro ao enviar cobrança do programa de Botox', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Erro interno ao enviar cobrança',
    });
  }
}

async function postRunDailyBotoxBilling(req, res) {
  try {
    const cronSecret = String(process.env.BOTOX_BILLING_CRON_SECRET || '').trim();
    const provided = String(req.header('x-cron-secret') || '').trim();
    if (cronSecret && provided !== cronSecret) {
      return res.status(403).json({ error: 'Cron secret inválido' });
    }

    const summary = await runDailyBillingJob();
    return res.json({ ok: true, summary });
  } catch (error) {
    logger.error('Erro no job de cobrança do programa de Botox', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Erro interno no job de cobrança',
    });
  }
}

async function postRunBillingNowForProfessional(req, res) {
  try {
    const { professionalId } = req.params;
    if (!professionalId) {
      return res.status(400).json({ error: 'professionalId é obrigatório' });
    }

    const professional = await findProfessionalById(professionalId);
    if (!professional) {
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }

    const summary = await runBillingNowForProfessional(professionalId);
    return res.json({
      ok: true,
      summary,
      message:
        summary.sent > 0
          ? `${summary.sent} cobrança(s) PIX enviada(s) aos pacientes com mensalidade pendente.`
          : 'Nenhuma cobrança enviada. Verifique PIX cadastrado, WhatsApp conectado, telefone e meses pendentes.',
    });
  } catch (error) {
    logger.error('Erro no envio de cobrança PIX do programa de Botox', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Erro interno no envio de cobrança',
    });
  }
}

module.exports = {
  postCobrancaProgramaBotox,
  postRunDailyBotoxBilling,
  postRunBillingNowForProfessional,
};
