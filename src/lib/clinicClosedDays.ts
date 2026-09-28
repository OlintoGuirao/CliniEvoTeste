import { format } from 'date-fns';

export type ClinicClosedDay = {
  id: string;
  closed_date: string;
  note: string | null;
};

export const DEFAULT_CLINIC_CLOSED_NOTE = 'Agenda pessoal';

export function formatDateKey(day: Date): string {
  return format(day, 'yyyy-MM-dd');
}

export function isClinicClosedOnDay(day: Date, days: ClinicClosedDay[]): boolean {
  const key = formatDateKey(day);
  return days.some((item) => item.closed_date === key);
}

export function getClinicClosedDayForDate(day: Date, days: ClinicClosedDay[]): ClinicClosedDay | null {
  const key = formatDateKey(day);
  return days.find((item) => item.closed_date === key) ?? null;
}
