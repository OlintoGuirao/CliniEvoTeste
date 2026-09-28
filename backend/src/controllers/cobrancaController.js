const { sendCobrancaPix, previewPixQr } = require('../services/cobrancaService');
const { logger } = require('../utils/logger');

async function postEnviarCobrancaPix(req, res) {
  try {
    const { professionalId } = req.params;
    const { patientId, amount, description, message } = req.body || {};

    if (!professionalId) {
      return res.status(400).json({ error: 'Profissional não informado.' });
    }
    if (!patientId) {
      return res.status(400).json({ error: 'Selecione o paciente.' });
    }

    const result = await sendCobrancaPix({
      professionalId,
      patientId,
      amount,
      description,
      message,
    });

    return res.json({
      ok: true,
      message: 'Cobrança enviada pelo WhatsApp conectado.',
      result,
    });
  } catch (error) {
    logger.error('Erro ao enviar cobrança PIX', error?.message || error);
    return res.status(400).json({
      error: error?.message || 'Erro interno ao enviar cobrança',
    });
  }
}

async function postPreviewPixQr(req, res) {
  try {
    const { pixKey, receiverName, amount, description } = req.body || {};
    const result = await previewPixQr({ pixKey, receiverName, amount, description });
    return res.json({ ok: true, ...result });
  } catch (error) {
    logger.error('Erro ao gerar preview PIX', error?.message || error);
    return res.status(400).json({
      error: error?.message || 'Erro ao gerar QR Code PIX',
    });
  }
}

module.exports = {
  postEnviarCobrancaPix,
  postPreviewPixQr,
};
