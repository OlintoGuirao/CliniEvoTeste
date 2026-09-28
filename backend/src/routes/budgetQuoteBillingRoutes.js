const router = require('express').Router();
const {
  postCobrancaBudgetQuote,
  postRunDailyBudgetQuoteBilling,
  postRunBudgetQuoteBillingNowForProfessional,
} = require('../controllers/budgetQuoteBillingController');

router.post('/orcamento/cobrar/:professionalId/:quoteId', postCobrancaBudgetQuote);
router.post('/orcamento/cobranca/daily', postRunDailyBudgetQuoteBilling);
router.post('/orcamento/cobranca/run-now/:professionalId', postRunBudgetQuoteBillingNowForProfessional);

module.exports = router;
