const { sendSalonAppointmentConfirm } = require('../services/salonAppointmentConfirmService');
const { logger } = require('../utils/logger');

/**
 * Envio genérico de texto via Evolution (confirmação, lembrar, etc.).
 * Reusa a resolução de instância do fluxo de confirmação do salão.
 */
async function postEnviarWhatsappText(req, res) {
  try {
    const { professionalId } = req.params;
    const { patientId, phone, message, bookingProfessionalId } = req.body || {};

    if (!professionalId) {
      return res.status(400).json({ error: 'Profissional não informado.' });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Mensagem não informada.' });
    }
    if (!phone && !patientId) {
      return res.status(400).json({ error: 'Telefone ou paciente não informado.' });
    }

    const result = await sendSalonAppointmentConfirm({
      professionalId,
      bookingProfessionalId:
        typeof bookingProfessionalId === 'string' ? bookingProfessionalId : null,
      patientId: typeof patientId === 'string' ? patientId : null,
      phone: typeof phone === 'string' ? phone : null,
      message: String(message),
    });

    return res.json({
      ok: true,
      message: 'Mensagem enviada pelo WhatsApp conectado.',
      result,
    });
  } catch (error) {
    logger.error('Erro ao enviar texto WhatsApp (Evolution)', error?.message || error);
    return res.status(400).json({
      error: error?.message || 'Erro interno ao enviar mensagem',
    });
  }
}

module.exports = {
  postEnviarWhatsappText,
};
