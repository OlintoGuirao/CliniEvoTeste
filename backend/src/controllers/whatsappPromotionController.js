const { logger } = require('../utils/logger');
const { findProfessionalById } = require('../repositories/professionalRepository');
const { broadcastWhatsappPromotion } = require('../services/whatsappPromotionService');

async function postBroadcastWhatsappPromotion(req, res) {
  try {
    const { professionalId } = req.params;
    if (!professionalId) {
      return res.status(400).json({ error: 'professionalId é obrigatório' });
    }

    const professional = await findProfessionalById(professionalId);
    if (!professional) {
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }

    const summary = await broadcastWhatsappPromotion(professionalId, req.body || {});

    return res.json({
      ok: true,
      summary,
      message:
        summary.sent > 0
          ? `Promoção enviada para ${summary.sent} paciente(s).`
          : 'Nenhuma promoção foi enviada. Verifique telefones e conexão do WhatsApp.',
    });
  } catch (error) {
    logger.error('Erro ao enviar promoção WhatsApp', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Erro interno ao enviar promoção',
    });
  }
}

module.exports = {
  postBroadcastWhatsappPromotion,
};
