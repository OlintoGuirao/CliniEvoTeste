const { logger } = require('../utils/logger');
const {
  runWeeklyBirthdayJob,
  runBirthdayNowForProfessional,
} = require('../services/birthdayWhatsappService');
const { findProfessionalById } = require('../repositories/professionalRepository');

async function postRunDailyBirthdayWhatsapp(req, res) {
  try {
    const cronSecret = String(process.env.BIRTHDAY_WHATSAPP_CRON_SECRET || '').trim();
    const provided = String(req.header('x-cron-secret') || '').trim();
    if (cronSecret && provided !== cronSecret) {
      return res.status(403).json({ error: 'Cron secret inválido' });
    }

    const summary = await runWeeklyBirthdayJob();
    return res.json({ ok: true, summary });
  } catch (error) {
    logger.error('Erro no job de aniversário WhatsApp', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Erro interno no job de aniversário',
    });
  }
}

async function postRunBirthdayNowForProfessional(req, res) {
  try {
    const { professionalId } = req.params;
    if (!professionalId) {
      return res.status(400).json({ error: 'professionalId é obrigatório' });
    }

    const professional = await findProfessionalById(professionalId);
    if (!professional) {
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }

    const summary = await runBirthdayNowForProfessional(professionalId, { force: true });
    return res.json({
      ok: true,
      summary,
      message:
        summary.sent > 0
          ? `${summary.sent} mensagem(ns) de aniversário enviada(s) para teste.`
          : summary.total > 0
            ? 'Nenhuma mensagem enviada (verifique telefone e WhatsApp conectado).'
            : 'Nenhum aniversariante desta semana com cadastro completo e telefone.',
    });
  } catch (error) {
    logger.error('Erro no teste de aniversário WhatsApp', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Erro interno no teste de aniversário',
    });
  }
}

module.exports = {
  postRunDailyBirthdayWhatsapp,
  postRunBirthdayNowForProfessional,
};
