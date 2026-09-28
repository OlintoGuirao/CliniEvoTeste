const { logger } = require('../utils/logger');
const { runDailyBillingJob } = require('../services/botoxBillingService');
const { runDailyBudgetQuoteBillingJob } = require('../services/budgetQuoteBillingService');
const { getBrazilBillingContext } = require('../lib/botoxBillingMessage');

const MS_SECOND = 1000;
const MS_MINUTE = 60 * MS_SECOND;
const MS_HOUR = 60 * MS_MINUTE;

function isBillingEnabled() {
  return String(process.env.BOTOX_BILLING_ENABLED || 'true').toLowerCase() !== 'false';
}

function getBillingHour() {
  const hour = Number(process.env.BOTOX_BILLING_HOUR);
  return Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : 9;
}

function startBotoxBillingScheduler() {
  if (!isBillingEnabled()) {
    logger.info('Job de cobrança WhatsApp desabilitado (BOTOX_BILLING_ENABLED=false)');
    return;
  }

  const billingHour = getBillingHour();
  let lastRunKey = '';

  const tick = async () => {
    const { mesReferencia, dayOfMonth } = getBrazilBillingContext();
    const hourFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hour12: false,
    });
    const hourPart = hourFormatter.formatToParts(new Date()).find((p) => p.type === 'hour');
    const currentHour = Number(hourPart?.value ?? -1);
    if (currentHour !== billingHour) return;

    const runKey = `${mesReferencia}-${dayOfMonth}`;
    if (lastRunKey === runKey) return;
    lastRunKey = runKey;

    try {
      await runDailyBillingJob();
    } catch (error) {
      logger.error('Erro no scheduler de cobrança do programa de Botox', error?.message || error);
    }

    try {
      await runDailyBudgetQuoteBillingJob();
    } catch (error) {
      logger.error('Erro no scheduler de cobrança de orçamentos', error?.message || error);
      lastRunKey = '';
    }
  };

  setInterval(() => {
    void tick();
  }, MS_HOUR);

  setTimeout(() => {
    void tick();
  }, 15 * MS_SECOND);

  logger.info(
    `Scheduler de cobrança WhatsApp ativo (Botox + Orçamentos, hora ${billingHour}h, America/Sao_Paulo)`
  );
}

module.exports = { startBotoxBillingScheduler };
