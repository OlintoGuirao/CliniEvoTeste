const router = require('express').Router();
const { postEnviarSalonSessionPhotos } = require('../controllers/salonSessionPhotosController');

router.post('/salon/session-photos/enviar/:professionalId', postEnviarSalonSessionPhotos);

module.exports = router;
