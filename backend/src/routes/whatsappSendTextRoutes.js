const router = require('express').Router();
const { postEnviarWhatsappText } = require('../controllers/whatsappSendTextController');

/** Texto genérico via Evolution (confirmação, lembrar, etc.). */
router.post('/whatsapp/send-text/:professionalId', postEnviarWhatsappText);

module.exports = router;
