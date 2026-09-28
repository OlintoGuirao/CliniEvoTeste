const router = require('express').Router();
const {
  postRunDailyBirthdayWhatsapp,
  postRunBirthdayNowForProfessional,
} = require('../controllers/birthdayWhatsappController');

router.post('/birthday-whatsapp/daily', postRunDailyBirthdayWhatsapp);
router.post('/birthday-whatsapp/run-now/:professionalId', postRunBirthdayNowForProfessional);

module.exports = router;
