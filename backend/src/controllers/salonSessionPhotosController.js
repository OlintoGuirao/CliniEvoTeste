const { sendSalonSessionPhotos } = require('../services/salonSessionPhotosService');
const { logger } = require('../utils/logger');

async function postEnviarSalonSessionPhotos(req, res) {
  try {
    const { professionalId } = req.params;
    const { patientId, sessionId, sessionDateLabel, procedureNames, sessionProfessionalId } =
      req.body || {};

    if (!professionalId) {
      return res.status(400).json({ error: 'Profissional não informado.' });
    }
    if (!patientId) {
      return res.status(400).json({ error: 'Paciente não informado.' });
    }
    if (!sessionId) {
      return res.status(400).json({ error: 'Sessão não informada.' });
    }

    const result = await sendSalonSessionPhotos({
      professionalId,
      patientId,
      sessionId,
      sessionDateLabel: typeof sessionDateLabel === 'string' ? sessionDateLabel : null,
      procedureNames: Array.isArray(procedureNames)
        ? procedureNames.map((n) => String(n || '').trim()).filter(Boolean)
        : [],
      sessionProfessionalId:
        typeof sessionProfessionalId === 'string' ? sessionProfessionalId : null,
    });

    return res.json({
      ok: true,
      message: 'Fotos enviadas pelo WhatsApp conectado.',
      result,
    });
  } catch (error) {
    logger.error('Erro ao enviar fotos de sessão salão', error?.message || error);
    return res.status(400).json({
      error: error?.message || 'Erro interno ao enviar fotos',
    });
  }
}

module.exports = {
  postEnviarSalonSessionPhotos,
};
