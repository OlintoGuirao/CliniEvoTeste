import { Scale, TrendingDown, Calendar, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProcedureSummaryData {
  /** Variação de peso (kg): negativo = redução */
  pesoTotalKg: number | null;
  /** Redução média de medidas (cm): positivo = redução média */
  reducaoMediaCm: number | null;
  /** Número de sessões realizadas */
  sessoesRealizadas: number;
  /** Tempo de tratamento em dias */
  tempoTratamentoDias: number;
  /** Região tratada (quando o procedimento tem esse campo) */
  regiaoTratada?: string | null;
  /** Botox: produto utilizado */
  produtoUtilizado?: string | null;
}

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  variant?: 'default' | 'success' | 'muted';
  className?: string;
  valueClassName?: string;
}

function SummaryCard({ icon, label, value, sub, variant = 'default', className, valueClassName }: SummaryCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-3.5 py-3.5 sm:px-4 sm:py-4 xl:px-5 xl:py-5 transition-all duration-200',
        variant === 'success' && 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20',
        variant === 'muted' && 'border-border/60 bg-muted/20',
        variant === 'default' && 'border-border/70 bg-card shadow-sm',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-9 w-9 xl:h-10 xl:w-10 shrink-0 items-center justify-center rounded-xl',
            variant === 'success' && 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
            variant === 'muted' && 'bg-muted text-muted-foreground',
            variant === 'default' && 'bg-primary/10 text-primary'
          )}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground leading-snug">
            {label}
          </p>
          <p
            className={cn(
              'mt-1 text-xl sm:text-2xl font-bold tabular-nums leading-tight whitespace-nowrap',
              variant === 'success' && 'text-green-700 dark:text-green-300',
              variant === 'default' && 'text-foreground',
              variant === 'muted' && 'text-foreground',
              valueClassName
            )}
          >
            {value}
          </p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

/** Procedimentos que usam métricas de peso e medidas (ex.: emagrecimento). Só nesses exibimos Peso total e Redução média. */
const SLUGS_COM_PESO_E_MEDIDAS = ['emagrecimento-reducao-medidas'] as const;

function formatSignedKg(value: number): string {
  const safe = Math.abs(value) < 1e-9 ? 0 : value;
  const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const absStr = fmt.format(Math.abs(safe));
  if (safe > 0) return `+${absStr} kg`;
  if (safe < 0) return `-${absStr} kg`;
  return '0,0 kg';
}

function formatTempoTratamento(dias: number): string {
  if (dias >= 365) {
    const anos = Math.floor(dias / 365);
    return anos === 1 ? '1 ano' : `${anos} anos`;
  }
  if (dias >= 30) {
    const meses = Math.floor(dias / 30);
    return meses === 1 ? '1 mês' : `${meses} meses`;
  }
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

export function ProcedureSummary({
  data,
  slug,
  rightAction,
}: {
  data: ProcedureSummaryData;
  /** Slug do procedimento: só exibe Peso total e Redução média para procedimentos de peso/medidas. */
  slug?: string | null;
  /** Conteúdo opcional à direita do título (ex.: botão Exportar PDF). */
  rightAction?: React.ReactNode;
}) {
  const mostraPesoEMedidas = slug != null && (SLUGS_COM_PESO_E_MEDIDAS as readonly string[]).includes(slug);

  const pesoLabel =
    data.pesoTotalKg != null
      ? formatSignedKg(data.pesoTotalKg)
      : '—';
  const pesoVariant = data.pesoTotalKg != null && data.pesoTotalKg < 0 ? 'success' : 'default';

  const reducaoLabel =
    data.reducaoMediaCm != null
      ? data.reducaoMediaCm > 0
        ? `−${data.reducaoMediaCm.toFixed(1).replace('.', ',')} cm`
        : data.reducaoMediaCm < 0
          ? `+${Math.abs(data.reducaoMediaCm).toFixed(1).replace('.', ',')} cm`
          : '0,0 cm'
      : '—';
  const reducaoVariant = data.reducaoMediaCm != null && data.reducaoMediaCm > 0 ? 'success' : 'default';

  const tempoStr = formatTempoTratamento(data.tempoTratamentoDias);

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Resumo da Evolução</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Visão geral do resultado do tratamento</p>
        </div>
        {rightAction && (
          <div className="shrink-0 self-start lg:self-center w-full lg:w-auto">
            {rightAction}
          </div>
        )}
      </div>
      <div
        className={
          mostraPesoEMedidas
            ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4'
            : 'grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4'
        }
      >
        {mostraPesoEMedidas && (
          <>
            <SummaryCard
              icon={<Scale className="w-5 h-5" />}
              label="Peso total"
              value={pesoLabel}
              variant={pesoVariant}
            />
            <SummaryCard
              icon={<TrendingDown className="w-5 h-5" />}
              label="Redução média de medidas"
              value={reducaoLabel}
              variant={reducaoVariant}
            />
          </>
        )}
        {data.regiaoTratada != null && String(data.regiaoTratada).trim() !== '' && (
          <SummaryCard
            icon={<MapPin className="w-5 h-5" />}
            label="Região tratada"
            value={String(data.regiaoTratada).trim()}
            variant="default"
            className="sm:col-span-2 xl:col-span-2"
            valueClassName="text-sm sm:text-base font-medium leading-relaxed whitespace-normal"
          />
        )}
        <SummaryCard
          icon={<Calendar className="w-5 h-5" />}
          label="Sessões realizadas"
          value={String(data.sessoesRealizadas)}
          variant="default"
        />
        <SummaryCard
          icon={<Clock className="w-5 h-5" />}
          label="Tempo de tratamento"
          value={data.tempoTratamentoDias > 0 ? tempoStr : '—'}
          variant="muted"
        />
      </div>
    </div>
  );
}
