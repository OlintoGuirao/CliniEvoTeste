import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Calendar,
  ClipboardCheck,
  DollarSign,
  HandCoins,
  Loader2,
  RefreshCw,
  Stethoscope,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useChartMobileBehavior } from '@/hooks/use-chart-mobile-behavior';
import { BranchFilterSelect } from '@/components/clinic/BranchFilterSelect';
import { useClinicBranchScope } from '@/contexts/ClinicBranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicMasterDashboard } from '@/hooks/use-clinic-master-dashboard';
import { fetchClinicTeam } from '@/services/api/clinicTeamApi';
import { fetchClinicProceduresAdmin } from '@/services/api/clinicProceduresApi';
import { STATUS_LABEL } from '@/types/faturamento';
import { FLUXO_PIE_PALETTE, formatFluxoCurrency } from '@/lib/fluxoCaixa';
import { exportRowsToCsv } from '@/lib/clinicMasterDashboardMetrics';
import { dashboardGreeting } from '@/lib/dashboardHelpers';
import { cn } from '@/lib/utils';
import {
  MasterDashboardPeriodFilter,
  defaultMasterPeriod,
  type MasterDashboardPeriodValue,
} from '@/components/clinic/master-dashboard/MasterDashboardPeriodFilter';
import {
  MasterDashboardManagementLinks,
  MasterKpiCard,
  formatKpiMoney,
  formatKpiNumber,
} from '@/components/clinic/master-dashboard/MasterDashboardParts';
import type {
  MasterDashboardDetailKind,
  MasterDashboardDetailRow,
} from '@/types/clinicMasterDashboard';
import { MobileBottomSafeSpacer } from '@/components/layout/mobile';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const chartConfig = {
  value: { label: 'Valor', color: 'hsl(var(--primary))' },
  vendas: { label: 'Vendas', color: 'hsl(var(--primary))' },
};

function DetailSheet({
  open,
  onOpenChange,
  title,
  rows,
  filtersSummary,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  rows: MasterDashboardDetailRow[];
  filtersSummary: string;
}) {
  const exportCsv = () => {
    exportRowsToCsv(
      `${title.toLowerCase().replace(/\s+/g, '-')}.csv`,
      ['Data', 'Descrição', 'Complemento', 'Valor', 'Status', 'Unidade', 'Profissional'],
      rows.map((r) => [
        r.date,
        r.label,
        r.secondary ?? '',
        r.amount != null ? String(r.amount) : '',
        r.status ?? '',
        r.branchName ?? '',
        r.professionalName ?? '',
      ])
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{filtersSummary}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
            Exportar CSV
          </Button>
        </div>
        <div className="mt-4 border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    Nenhum registro no período selecionado.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.label}</div>
                      {r.secondary ? (
                        <div className="text-xs text-muted-foreground">{r.secondary}</div>
                      ) : null}
                      {r.professionalName ? (
                        <div className="text-xs text-muted-foreground">{r.professionalName}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.amount != null ? formatFluxoCurrency(r.amount) : r.status ? STATUS_LABEL[r.status as keyof typeof STATUS_LABEL] ?? r.status : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ClinicMasterDashboard() {
  const { profile } = useAuth();
  const { branches, selectedBranchId, isMaster } = useClinicBranchScope();
  const [period, setPeriod] = useState<MasterDashboardPeriodValue>(defaultMasterPeriod);
  const [professionalId, setProfessionalId] = useState<string>('all');
  const [procedureId, setProcedureId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detailKind, setDetailKind] = useState<MasterDashboardDetailKind | null>(null);
  const [compareBranchIds, setCompareBranchIds] = useState<string[]>([]);
  const { tooltipTrigger, renderChartDot } = useChartMobileBehavior();

  const filters = useMemo(
    () => ({
      dataInicio: period.dataInicio,
      dataFim: period.dataFim,
      branchId: selectedBranchId,
      professionalId: professionalId === 'all' ? null : professionalId,
      procedureId: procedureId === 'all' ? null : procedureId,
      status: statusFilter === 'all' ? null : statusFilter,
    }),
    [period, selectedBranchId, professionalId, procedureId, statusFilter]
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useClinicMasterDashboard(filters, isMaster);

  const teamQuery = useQuery({
    queryKey: ['clinic-team-master-dashboard'],
    queryFn: fetchClinicTeam,
    enabled: isMaster,
    staleTime: 60_000,
  });

  const proceduresQuery = useQuery({
    queryKey: ['clinic-procedures-master-dashboard'],
    queryFn: fetchClinicProceduresAdmin,
    enabled: isMaster,
    staleTime: 120_000,
  });

  const firstName = profile?.full_name?.split(/\s+/)[0] || 'Master';
  const greeting = dashboardGreeting();
  const orgName = data?.organization.name ?? 'Clínica';
  const branchLabel =
    selectedBranchId == null
      ? 'Visão consolidada'
      : branches.find((b) => b.id === selectedBranchId)?.name ?? 'Unidade';

  const filtersSummary = `Período: ${period.dataInicio} a ${period.dataFim} · ${branchLabel}`;

  const detailRows = detailKind && data ? data.details[detailKind] : [];
  const detailTitles: Record<MasterDashboardDetailKind, string> = {
    appointments: 'Agendamentos',
    evaluations: 'Avaliações',
    closings: 'Fechamentos',
    revenue: 'Vendas / Faturamento',
    expenses: 'Despesas (insumos)',
  };

  const multiBranch = (data?.branches.length ?? 0) > 1;
  const comparedBranches = useMemo(() => {
    if (!data) return [];
    if (!multiBranch) return data.branchComparison.slice(0, 1);
    const ids =
      compareBranchIds.length > 0
        ? compareBranchIds
        : data.branchComparison.slice(0, 2).map((b) => b.branchId);
    return data.branchComparison.filter((b) => ids.includes(b.branchId));
  }, [data, multiBranch, compareBranchIds]);

  const toggleCompareBranch = (id: string) => {
    setCompareBranchIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-2 min-w-0">
      <header className="min-w-0 space-y-1">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">
              {greeting}, {firstName}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Visão geral de <span className="font-medium text-foreground">{orgName}</span> · {branchLabel}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Ajuste período, unidade e recortes analíticos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MasterDashboardPeriodFilter value={period} onChange={setPeriod} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Unidade</Label>
              <BranchFilterSelect />
            </div>
            <div className="space-y-2">
              <Label>Profissional</Label>
              <Select value={professionalId} onValueChange={setProfessionalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {(teamQuery.data?.members ?? []).map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tratamento</Label>
              <Select value={procedureId} onValueChange={setProcedureId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {(proceduresQuery.data?.catalog ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status (vendas)</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Erro ao carregar dashboard</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : 'Tente novamente.'}</AlertDescription>
        </Alert>
      ) : null}

      <section aria-labelledby="master-kpis-heading">
        <h2 id="master-kpis-heading" className="sr-only">
          Indicadores principais
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
          <MasterKpiCard
            title="Agendamentos"
            icon={Calendar}
            value={formatKpiNumber(data?.kpis.appointments.total ?? 0)}
            subtitle={
              data?.kpis.appointments.today != null
                ? `${data.kpis.appointments.today} hoje`
                : undefined
            }
            comparison={data?.kpis.appointments.comparison}
            isLoading={isLoading}
            isError={isError}
            onDetails={() => setDetailKind('appointments')}
            tooltip="Total de consultas agendadas da equipe no período"
          />
          <MasterKpiCard
            title="Avaliações"
            icon={Stethoscope}
            value={formatKpiNumber(data?.kpis.evaluations.total ?? 0)}
            comparison={data?.kpis.evaluations.comparison}
            isLoading={isLoading}
            isError={isError}
            onDetails={() => setDetailKind('evaluations')}
            tooltip="Procedimentos de avaliação iniciados no período"
          />
          <MasterKpiCard
            title="Fechamentos"
            icon={ClipboardCheck}
            value={formatKpiNumber(data?.kpis.closings.total ?? 0)}
            comparison={data?.kpis.closings.comparison}
            isLoading={isLoading}
            isError={isError}
            onDetails={() => setDetailKind('closings')}
            tooltip="Orçamentos aceitos + recebimentos pagos"
          />
          <MasterKpiCard
            title="Faturamento"
            icon={Wallet}
            value={formatKpiMoney(data?.kpis.revenue.total ?? 0)}
            comparison={data?.kpis.revenue.comparison}
            isLoading={isLoading}
            isError={isError}
            onDetails={() => setDetailKind('revenue')}
          />
          <MasterKpiCard
            title="Despesas"
            icon={HandCoins}
            value={formatKpiMoney(data?.kpis.expenses.total ?? 0)}
            comparison={data?.kpis.expenses.comparison}
            isLoading={isLoading}
            isError={isError}
            onDetails={() => setDetailKind('expenses')}
            tooltip="Entradas NF de insumos no período"
          />
          <MasterKpiCard
            title="Ticket médio"
            icon={DollarSign}
            value={
              data?.kpis.ticketMedio.total
                ? formatKpiMoney(data.kpis.ticketMedio.total)
                : '—'
            }
            comparison={data?.kpis.ticketMedio.comparison}
            isLoading={isLoading}
            isError={isError}
            empty={!data?.kpis.closings.total}
            tooltip="Faturamento ÷ fechamentos"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversão geral</CardTitle>
            <CardDescription>{data?.conversion.formula}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : data?.conversion.denominator === 0 ? (
              <p className="text-sm text-muted-foreground">Sem avaliações no período para calcular conversão.</p>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums">
                  {data?.conversion.ratePercent != null ? `${data.conversion.ratePercent.toFixed(1)}%` : '—'}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({data?.conversion.numerator} fech. / {data?.conversion.denominator} aval.)
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Melhor tratamento em vendas</CardTitle>
            <CardDescription>Por faturamento no período</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : !data?.topTreatment ? (
              <p className="text-sm text-muted-foreground">Nenhuma venda registrada no período.</p>
            ) : (
              <div>
                <p className="font-semibold text-lg">{data.topTreatment.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatFluxoCurrency(data.topTreatment.value)} · {data.topTreatment.sharePercent.toFixed(1)}% do total
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 tratamentos</CardTitle>
            <CardDescription>Faturamento por procedimento</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[240px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !data?.topTreatments.length ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem dados para exibir.</p>
            ) : (
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <BarChart data={data.topTreatments} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatFluxoCurrency(Number(v))} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <ChartTooltip
                    trigger={tooltipTrigger}
                    content={
                      <ChartTooltipContent formatter={(v) => formatFluxoCurrency(Number(v))} />
                    }
                  />
                  <Bar dataKey="value" fill="var(--color-value)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução de vendas</CardTitle>
            <CardDescription>Faturamento por mês no intervalo selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[240px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !data?.salesEvolution.some((p) => p.value > 0) ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem vendas no período.</p>
            ) : (
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <LineChart data={data.salesEvolution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatFluxoCurrency(Number(v))} width={72} />
                  <ChartTooltip
                    trigger={tooltipTrigger}
                    content={
                      <ChartTooltipContent formatter={(v) => formatFluxoCurrency(Number(v))} />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-vendas)"
                    strokeWidth={2}
                    dot={renderChartDot}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendas por status</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : !data?.salesByStatus.length ? (
            <p className="text-sm text-muted-foreground">Sem vendas ou orçamentos no período.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <ChartContainer config={chartConfig} className="h-[220px] mx-auto max-w-[280px]">
                <PieChart>
                  <Pie data={data.salesByStatus} dataKey="value" nameKey="label" innerRadius={50} outerRadius={80}>
                    {data.salesByStatus.map((_, i) => (
                      <Cell key={i} fill={FLUXO_PIE_PALETTE[i % FLUXO_PIE_PALETTE.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip trigger={tooltipTrigger} content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
              <ul className="space-y-2 text-sm">
                {data.salesByStatus.map((s, i) => (
                  <li key={s.status} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: FLUXO_PIE_PALETTE[i % FLUXO_PIE_PALETTE.length] }}
                    />
                    <span className="flex-1">{s.label}</span>
                    <span className="tabular-nums text-muted-foreground">{s.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-5 w-5" />
            Meta vs realizado
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.goalProgress.hasGoal ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma meta cadastrada. Quando a funcionalidade de metas estiver disponível, configure objetivos de
              vendas para acompanhar o realizado aqui.
            </p>
          ) : null}
          <p className="text-sm mt-2">
            Realizado no período:{' '}
            <span className="font-semibold">{formatFluxoCurrency(data?.goalProgress.achieved ?? 0)}</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparativo de unidades</CardTitle>
          <CardDescription>
            {multiBranch
              ? 'Selecione filiais para comparar indicadores lado a lado'
              : 'Sua clínica possui uma única unidade'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {multiBranch ? (
            <div className="flex flex-wrap gap-2">
              {(data?.branches ?? []).map((b) => (
                <Button
                  key={b.id}
                  size="sm"
                  variant={compareBranchIds.includes(b.id) ? 'default' : 'outline'}
                  onClick={() => toggleCompareBranch(b.id)}
                >
                  {b.name}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-right">Agend.</TableHead>
                  <TableHead className="text-right">Aval.</TableHead>
                  <TableHead className="text-right">Fech.</TableHead>
                  <TableHead className="text-right">Fatur.</TableHead>
                  <TableHead className="text-right">Desp.</TableHead>
                  <TableHead className="text-right">Conv.</TableHead>
                  <TableHead className="text-right">Ticket</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparedBranches.map((b) => (
                  <TableRow key={b.branchId}>
                    <TableCell className="font-medium">{b.branchName}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.appointments}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.evaluations}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.closings}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatFluxoCurrency(b.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatFluxoCurrency(b.expenses)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {b.conversionPercent != null ? `${b.conversionPercent.toFixed(1)}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {b.ticketMedio != null ? formatFluxoCurrency(b.ticketMedio) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {data?.branchRanking.length ? (
            <div className="rounded-lg border p-3 bg-muted/30">
              <p className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Ranking por faturamento
              </p>
              <ol className="mt-2 space-y-1 text-sm list-decimal list-inside">
                {data.branchRanking.map((b, i) => (
                  <li key={b.branchId}>
                    {b.branchName} — {formatFluxoCurrency(b.revenue)}
                    {i === 0 && data.branchRanking.length > 1 ? (
                      <span className="text-muted-foreground ml-1">(referência)</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Insights e oportunidades</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : !data?.insights.length ? (
            <p className="text-sm text-muted-foreground">
              Dados insuficientes para gerar insights automáticos neste período.
            </p>
          ) : (
            data.insights.map((ins) => (
              <div
                key={ins.id}
                className={cn(
                  'rounded-lg border p-3 text-sm',
                  ins.type === 'warning' && 'border-amber-500/40 bg-amber-500/5',
                  ins.type === 'success' && 'border-emerald-500/40 bg-emerald-500/5',
                  ins.type === 'opportunity' && 'border-primary/30 bg-primary/5'
                )}
              >
                <p className="font-medium">{ins.title}</p>
                <p className="text-muted-foreground mt-1">{ins.description}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ações rápidas</CardTitle>
          <CardDescription>Fluxos existentes do sistema</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button variant="outline" className="justify-start h-auto py-3" disabled title="Disponível para profissionais da equipe">
            Novo agendamento
            <span className="block text-xs text-muted-foreground font-normal">Operação da equipe</span>
          </Button>
          <Button variant="outline" className="justify-start h-auto py-3" disabled title="Disponível para profissionais da equipe">
            Nova avaliação
            <span className="block text-xs text-muted-foreground font-normal">Operação da equipe</span>
          </Button>
          <Button variant="outline" className="justify-start h-auto py-3" asChild>
            <Link to="/faturamento">Registrar venda / faturamento</Link>
          </Button>
          <Button variant="outline" className="justify-start h-auto py-3" asChild>
            <Link to="/insumos-nf">Lançar despesa (insumos NF)</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gestão</CardTitle>
        </CardHeader>
        <CardContent>
          <MasterDashboardManagementLinks />
        </CardContent>
      </Card>

      <DetailSheet
        open={detailKind != null}
        onOpenChange={(o) => !o && setDetailKind(null)}
        title={detailKind ? detailTitles[detailKind] : ''}
        rows={detailRows}
        filtersSummary={filtersSummary}
      />

      <MobileBottomSafeSpacer />
    </div>
  );
}
