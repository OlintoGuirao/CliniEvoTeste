const { logger } = require('../utils/logger');
const {
  runAppointmentReminder24hJob,
  runAppointmentReminder1hJob,
} = require('../services/appointmentReminderService');

const MS_MINUTE = 60 * 1000;

function isReminderEnabled() {
  return String(process.env.APPOINTMENT_REMINDER_ENABLED || 'true').toLowerCase() !== 'false';
}

function getIntervalMinutes() {
  const n = Number(process.env.APPOINTMENT_REMINDER_INTERVAL_MINUTES);
  return Number.isFinite(n) && n >= 5 ? n : 15;
}

function startAppointmentReminderScheduler() {
  if (!isReminderEnabled()) {
    logger.info('Lembretes de consulta desabilitados (APPOINTMENT_REMINDER_ENABLED=false)');
    return;
  }

  const intervalMinutes = getIntervalMinutes();
  const intervalMs = intervalMinutes * MS_MINUTE;
  let running = false;

  const tick = async () => {
    if (running) {
      logger.warn('Tick de lembretes ignorado: execução anterior ainda em andamento');
      return;
    }
    running = true;
    try {
      await runAppointmentReminder24hJob();
      await runAppointmentReminder1hJob();
    } catch (error) {
      logger.error('Erro no scheduler de lembretes de consulta', error?.message || error);
    } finally {
      running = false;
    }
  };

  setInterval(() => {
    void tick();
  }, intervalMs);

  setTimeout(() => {
    void tick();
  }, 20 * 1000);

  logger.info(`Scheduler de lembretes 24h e 1h ativo (a cada ${intervalMinutes} min)`);
}

module.exports = { startAppointmentReminderScheduler };
