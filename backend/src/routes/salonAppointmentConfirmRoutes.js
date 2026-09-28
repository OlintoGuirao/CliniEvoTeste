const router = require('express').Router();
const { postEnviarSalonAppointmentConfirm } = require('../controllers/salonAppointmentConfirmController');

router.post('/salon/appointment-confirm/enviar/:professionalId', postEnviarSalonAppointmentConfirm);

module.exports = router;
