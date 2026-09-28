/** Template padrão do lembrete automático próximo (antes fixo em 1h). */
export const DEFAULT_APPOINTMENT_REMINDER_1H_MESSAGE =
  'Olá, {{nome}}! ⏰\n\n' +
  'Você tem {{consulta}} *hoje* {{horario}} (dia {{data}}) com *{{profissional}}*.\n\n' +
  'Aguardamos você! 💚';

export const APPOINTMENT_REMINDER_1H_HOURS_MIN = 1;
export const APPOINTMENT_REMINDER_1H_HOURS_MAX = 24;
export const DEFAULT_APPOINTMENT_REMINDER_1H_HOURS = 1;

export function normalizeAppointmentReminder1hHours(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_APPOINTMENT_REMINDER_1H_HOURS;
  return Math.min(
    APPOINTMENT_REMINDER_1H_HOURS_MAX,
    Math.max(APPOINTMENT_REMINDER_1H_HOURS_MIN, Math.round(n))
  );
}

export function formatReminderNearHoursLabel(hours: number): string {
  const h = normalizeAppointmentReminder1hHours(hours);
  return h === 1 ? '1 hora' : `${h} horas`;
}
