import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { VacationPeriod } from '@/services/api/dynamicProcedureFieldSettingsApi';

export function VacationPeriodBanner({
  periods,
  className,
}: {
  periods: VacationPeriod[];
  className?: string;
}) {
  if (periods.length === 0) return null;

  return (
    <div
      className={
        className ??
        'rounded-xl border border-rose-300/70 bg-rose-50/90 dark:bg-rose-950/40 dark:border-rose-800/60 px-3 py-2.5 text-rose-900 dark:text-rose-100 shadow-sm'
      }
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
        Período de férias
      </p>
      <div className="mt-1 space-y-1">
        {periods.map((period) => (
          <p key={period.id} className="text-sm font-medium">
            {(period.message?.trim() || 'Férias')}: agenda bloqueada de{' '}
            {format(parseISO(period.start_date), "d 'de' MMM", { locale: ptBR })} até{' '}
            {format(parseISO(period.end_date), "d 'de' MMM yyyy", { locale: ptBR })}.
          </p>
        ))}
      </div>
    </div>
  );
}
