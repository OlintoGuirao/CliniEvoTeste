import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatFluxoCurrency } from '@/lib/fluxoCaixa';
import type { MasterDashboardComparison } from '@/types/clinicMasterDashboard';
import { cn } from '@/lib/utils';

interface MasterKpiCardProps {
  title: string;
  icon: LucideIcon;
  value: string;
  subtitle?: string;
  comparison?: MasterDashboardComparison;
  isLoading?: boolean;
  isError?: boolean;
  empty?: boolean;
  onDetails?: () => void;
  tooltip?: string;
}

export function MasterKpiCard({
  title,
  icon: Icon,
  value,
  subtitle,
  comparison,
  isLoading,
  isError,
  empty,
  onDetails,
  tooltip,
}: MasterKpiCardProps) {
  if (isLoading) {
    return (
      <Card className="min-h-[120px]">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="min-h-[120px] border-destructive/40">
        <CardContent className="p-4">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-destructive mt-2">Não foi possível carregar este indicador.</p>
        </CardContent>
      </Card>
    );
  }

  const delta = comparison?.deltaPercent;
  const trend = comparison?.trend ?? 'neutral';
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;

  return (
    <Card className="min-h-[120px]" title={tooltip}>
      <CardContent className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{empty ? '—' : value}</p>
            {subtitle ? <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p> : null}
          </div>
          <div className="rounded-lg bg-primary/10 p-2 shrink-0">
            <Icon className="h-5 w-5 text-primary" aria-hidden />
          </div>
        </div>
        {!empty && delta != null ? (
          <p
            className={cn(
              'text-xs flex items-center gap-1',
              trend === 'up' && 'text-emerald-600 dark:text-emerald-400',
              trend === 'down' && 'text-red-600 dark:text-red-400',
              trend === 'neutral' && 'text-muted-foreground'
            )}
          >
            <TrendIcon className="h-3.5 w-3.5" aria-hidden />
            {delta >= 0 ? '+' : ''}
            {delta.toFixed(1)}% vs período anterior
          </p>
        ) : !empty && comparison && comparison.previousValue === 0 && comparison.value > 0 ? (
          <p className="text-xs text-muted-foreground">Sem base no período anterior</p>
        ) : null}
        {onDetails ? (
          <Button variant="link" className="h-auto p-0 text-xs self-start" onClick={onDetails}>
            Ver detalhes
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function formatKpiNumber(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n);
}

export function formatKpiMoney(n: number): string {
  return formatFluxoCurrency(n);
}

export function MasterDashboardManagementLinks() {
  const links = [
    { href: '/settings', label: 'Configurações do sistema', disabled: false },
    { href: '/settings/equipe', label: 'Usuários e permissões', disabled: false },
    { href: '/settings/filiais', label: 'Filiais', disabled: false },
    { href: '/settings/procedimentos', label: 'Procedimentos e preços', disabled: false },
    { href: '/settings/origens', label: 'Origens', disabled: false },
    { href: '/settings/tipos-ficha', label: 'Tipos de ficha', disabled: false },
    { href: '#', label: 'Metas e objetivos', disabled: true, hint: 'Em breve' },
    { href: '/settings/whatsapp', label: 'Integrações (WhatsApp)', disabled: true, hint: 'Acesso pela equipe' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {links.map((item) =>
        item.disabled ? (
          <Button key={item.label} variant="outline" className="justify-start h-auto py-3 opacity-60" disabled>
            <span className="text-left">
              <span className="block text-sm">{item.label}</span>
              {item.hint ? <span className="block text-xs text-muted-foreground">{item.hint}</span> : null}
            </span>
          </Button>
        ) : (
          <Button key={item.href} variant="outline" className="justify-start h-auto py-3" asChild>
            <Link to={item.href}>{item.label}</Link>
          </Button>
        )
      )}
    </div>
  );
}
