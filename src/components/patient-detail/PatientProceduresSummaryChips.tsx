import { CalendarDays, Stethoscope, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

type PatientProceduresSummaryChipsProps = {
  lastSessionDate: string | null;
  activeProceduresCount: number;
  totalSessionsCount: number;
  className?: string;
  /** Salão: rótulos de atendimento em vez de sessão clínica. */
  variant?: 'clinical' | 'salon';
};

function SummaryStatCard({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-lg border border-border/50 bg-background/80 px-3 py-2.5 shadow-sm',
        className
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="text-[10px] font-medium uppercase tracking-wide md:text-xs md:normal-case md:tracking-normal">
          {label}
        </span>
      </div>
      <p className="text-sm font-semibold text-foreground leading-tight">{value}</p>
    </div>
  );
}

export function PatientProceduresSummaryChips({
  lastSessionDate,
  activeProceduresCount,
  totalSessionsCount,
  className,
  variant = 'clinical',
}: PatientProceduresSummaryChipsProps) {
  const isSalon = variant === 'salon';
  const cards = [
    lastSessionDate
      ? {
          key: 'last-session',
          icon: CalendarDays,
          label: isSalon ? 'Último atendimento' : 'Última sessão',
          value: lastSessionDate,
        }
      : null,
    !isSalon && activeProceduresCount > 0
      ? {
          key: 'active',
          icon: Stethoscope,
          label: 'Procedimentos ativos',
          value: `${activeProceduresCount} ativo${activeProceduresCount !== 1 ? 's' : ''}`,
        }
      : null,
    {
      key: 'sessions',
      icon: ClipboardList,
      label: isSalon ? 'Atendimentos' : 'Sessões',
      value: isSalon
        ? totalSessionsCount === 1
          ? '1 realizado'
          : `${totalSessionsCount} realizados`
        : totalSessionsCount === 1
          ? '1 realizada'
          : `${totalSessionsCount} realizadas`,
    },
  ].filter(Boolean) as Array<{
    key: string;
    icon: typeof CalendarDays;
    label: string;
    value: string;
  }>;

  return (
    <div
      className={cn(
        'grid w-full min-w-0 gap-2 lg:flex-1',
        cards.length === 1 && 'grid-cols-1',
        cards.length === 2 && 'grid-cols-1 sm:grid-cols-2',
        cards.length >= 3 && 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
        className
      )}
    >
      {cards.map((card) => (
        <SummaryStatCard
          key={card.key}
          icon={card.icon}
          label={card.label}
          value={card.value}
        />
      ))}
    </div>
  );
}
