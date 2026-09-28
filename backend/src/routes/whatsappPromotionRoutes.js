const router = require('express').Router();
const { postBroadcastWhatsappPromotion } = require('../controllers/whatsappPromotionController');

router.post('/whatsapp-promotions/broadcast/:professionalId', postBroadcastWhatsappPromotion);

module.exports = router;
