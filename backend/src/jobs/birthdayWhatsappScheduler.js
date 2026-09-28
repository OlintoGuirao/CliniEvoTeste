const { logger } = require('../utils/logger');
const { runWeeklyBirthdayJob } = require('../services/birthdayWhatsappService');
const { getBrazilWeekBirthdayContext } = require('../lib/birthdayMessage');

const MS_SECOND = 1000;
const MS_MINUTE = 60 * MS_SECOND;
const MS_HOUR = 60 * MS_MINUTE;

function isBirthdayWhatsappEnabled() {
  return String(process.env.BIRTHDAY_WHATSAPP_ENABLED || 'true').toLowerCase() !== 'false';
}

function getBirthdayHour() {
  const hour = Number(process.env.BIRTHDAY_WHATSAPP_HOUR);
  return Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : 9;
}

function startBirthdayWhatsappScheduler() {
  if (!isBirthdayWhatsappEnabled()) {
    logger.info('Job de aniversário WhatsApp desabilitado (BIRTHDAY_WHATSAPP_ENABLED=false)');
    return;
  }

  const birthdayHour = getBirthdayHour();
  let lastRunKey = '';

  const tick = async () => {
    const { weekStart, isoDayOfWeek } = getBrazilWeekBirthdayContext();
    if (isoDayOfWeek !== 1) return;

    const hourFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hour12: false,
    });
    const hourPart = hourFormatter.formatToParts(new Date()).find((p) => p.type === 'hour');
    const currentHour = Number(hourPart?.value ?? -1);
    if (currentHour !== birthdayHour) return;

    const runKey = `week-${weekStart.year}-${weekStart.month}-${weekStart.day}`;
    if (lastRunKey === runKey) return;
    lastRunKey = runKey;

    try {
      await runWeeklyBirthdayJob();
    } catch (error) {
      logger.error('Erro no scheduler de aniversário WhatsApp', error?.message || error);
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
    `Scheduler de aniversário WhatsApp ativo (segundas às ${birthdayHour}h, America/Sao_Paulo)`
  );
}

module.exports = { startBirthdayWhatsappScheduler };
