import { parseISO } from 'date-fns';
import type { VacationPeriod } from '@/services/api/dynamicProcedureFieldSettingsApi';

/** Períodos de férias que incluem o dia informado (comparação por data local). */
export function getVacationPeriodsForDay(day: Date, periods: VacationPeriod[]): VacationPeriod[] {
  const dayTime = new Date(day);
  dayTime.setHours(0, 0, 0, 0);

  return periods.filter((period) => {
    const start = parseISO(period.start_date);
    const end = parseISO(period.end_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return dayTime.getTime() >= start.getTime() && dayTime.getTime() <= end.getTime();
  });
}
