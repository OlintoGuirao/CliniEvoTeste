const router = require('express').Router();
const {
  whatsappWebhook,
  getEvolutionStatusByProfessional,
  getEvolutionQrByProfessional,
  postEvolutionPairByProfessional,
  disconnectEvolutionByProfessional,
  setEvolutionInstanceByProfessional,
  getUltraMsgQrByProfessional,
  disconnectUltraMsgByProfessional,
  setUltraMsgInstanceByProfessional,
} = require('../controllers/whatsappController');

router.get('/webhook/whatsapp', (req, res) => {
  res.json({
    ok: true,
    message: 'Webhook WhatsApp ativo. A Evolution API envia mensagens via POST nesta URL.',
  });
});

router.post('/webhook/whatsapp', whatsappWebhook);

router.get('/evolution/status/:professionalId', getEvolutionStatusByProfessional);
router.get('/evolution/qr/:professionalId', getEvolutionQrByProfessional);
router.post('/evolution/pair/:professionalId', postEvolutionPairByProfessional);
router.post('/evolution/disconnect/:professionalId', disconnectEvolutionByProfessional);
router.post('/evolution/instance/:professionalId', setEvolutionInstanceByProfessional);

// Rotas legadas (UltraMsg) — redirecionam para Evolution
router.get('/ultramsg/qr/:professionalId', getUltraMsgQrByProfessional);
router.post('/ultramsg/disconnect/:professionalId', disconnectUltraMsgByProfessional);
router.post('/ultramsg/instance/:professionalId', setUltraMsgInstanceByProfessional);

module.exports = router;
