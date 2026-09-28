const router = require('express').Router();
const { postEnviarCobrancaPix, postPreviewPixQr } = require('../controllers/cobrancaController');

router.post('/cobranca/enviar/:professionalId', postEnviarCobrancaPix);
router.post('/cobranca/preview-qr', postPreviewPixQr);

module.exports = router;
