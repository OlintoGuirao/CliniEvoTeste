const router = require('express').Router();
const {
  postCobrancaProgramaBotox,
  postRunDailyBotoxBilling,
  postRunBillingNowForProfessional,
} = require('../controllers/botoxBillingController');

router.post('/programa-botox/cobrar/:professionalId/:programaId', postCobrancaProgramaBotox);
router.post('/programa-botox/cobranca/daily', postRunDailyBotoxBilling);
router.post('/programa-botox/cobranca/run-now/:professionalId', postRunBillingNowForProfessional);

module.exports = router;
