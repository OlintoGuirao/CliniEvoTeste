const { logger } = require('../utils/logger');
const { findProfessionalById } = require('../repositories/professionalRepository');
const {
  buildReminder24hStatusForProfessional,
  sendMissingReminder24hForProfessional,
} = require('../services/appointmentReminderService');
const { getBrazilTomorrowYmd } = require('../utils/time');

async function getReminder24hStatus(req, res) {
  try {
    const { professionalId } = req.params;
    if (!professionalId) {
      return res.status(400).json({ error: 'professionalId é obrigatório' });
    }

    const professional = await findProfessionalById(professionalId);
    if (!professional) {
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }

    const date =
      String(req.query.date || '').trim() || getBrazilTomorrowYmd();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date inválida (use YYYY-MM-DD)' });
    }

    const status = await buildReminder24hStatusForProfessional(professionalId, date);
    return res.json({ ok: true, ...status });
  } catch (error) {
    logger.error('Erro ao consultar status de lembretes 24h', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Erro interno ao consultar status de lembretes',
    });
  }
}

async function postSendMissingReminder24h(req, res) {
  try {
    const { professionalId } = req.params;
    if (!professionalId) {
      return res.status(400).json({ error: 'professionalId é obrigatório' });
    }

    const professional = await findProfessionalById(professionalId);
    if (!professional) {
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }

    const date =
      String(req.body?.date || req.query.date || '').trim() || getBrazilTomorrowYmd();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date inválida (use YYYY-MM-DD)' });
    }

    const appointmentIds = Array.isArray(req.body?.appointmentIds)
      ? req.body.appointmentIds
      : undefined;

    const summary = await sendMissingReminder24hForProfessional(professionalId, {
      date,
      appointmentIds,
    });

    let message;
    if (summary.sent > 0) {
      message = `${summary.sent} lembrete(s) 24h enviado(s) para ${summary.dateLabel}.`;
    } else if (summary.errors > 0) {
      message = 'Nenhum lembrete enviado. Verifique WhatsApp e telefone dos pacientes.';
    } else if (summary.skipped > 0) {
      message =
        'Nenhum lembrete enviado (WhatsApp desconectado, sem telefone ou já enviados).';
    } else {
      message = 'Não há lembretes pendentes para essa data.';
    }

    return res.json({ ok: true, summary, message });
  } catch (error) {
    logger.error('Erro ao enviar lembretes 24h faltantes', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Erro interno ao enviar lembretes faltantes',
    });
  }
}

module.exports = {
  getReminder24hStatus,
  postSendMissingReminder24h,
};
