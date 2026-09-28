import { useMemo, useState } from 'react';
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
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart3, Package, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { MobileBottomSafeSpacer } from '@/components/layout/mobile';
import { FiltroPeriodo, type FiltroPeriodoValue } from '@/components/faturamento/FiltroPeriodo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useChartMobileBehavior } from '@/hooks/use-chart-mobile-behavior';
import { useFaturamento } from '@/hooks/use-faturamento';
import { useInsumosEntradas } from '@/hooks/use-insumos-entradas';
import { useSalonAccount } from '@/hooks/use-salon-account';
import {
  buildFaturamentoPieData,
  buildFluxoCaixaBuckets,
  buildFluxoCaixaResumo,
  formatFluxoCurrency,
  getFluxoCaixaGranularity,
} from '@/lib/fluxoCaixa';
import { formatMonthLabel } from '@/lib/programaBotox';
import { BranchFilterSelect } from '@/components/clinic/BranchFilterSelect';
import { useClinicBranchScope } from '@/contexts/ClinicBranchContext';
import { cn } from '@/lib/utils';
import SalonFluxoCaixaPage from '@/pages/SalonFluxoCaixaPage';

function getDefaultPeriod(): FiltroPeriodoValue {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { preset: 'mes', dataInicio: start, dataFim: end };
}

function chartBucketLabel(
  key: string,
  granularity: ReturnType<typeof getFluxoCaixaGranularity>
): string {
  if (granularity === 'mes') return formatMonthLabel(key);
  return format(parseISO(key), 'dd/MM', { locale: ptBR });
}

export default function FluxoCaixaPage() {
  const { isSalonAccount } = useSalonAccount();
  if (isSalonAccount) {
    return <SalonFluxoCaixaPage />;
  }

  return <ClinicSoloFluxoCaixaPage />;
}

/** Fluxo de caixa somente leitura — clínica e profissional único (inalterado). */
function ClinicSoloFluxoCaixaPage() {
  const [periodo, setPeriodo] = useState<FiltroPeriodoValue>(getDefaultPeriod);
  const { isMobile, tooltipTrigger, renderChartDot } = useChartMobileBehavior();
  const { mode, isMaster } = useClinicBranchScope();

  const filtrosFaturamento = useMemo(
    () => ({
      dataInicio: periodo.dataInicio,
      dataFim: periodo.dataFim,
      procedimentoId: null,
      formaPagamento: null,
      status: null,
    }),
    [periodo]
  );

  const filtrosInsumos = useMemo(
    () => ({
      dataInicio: periodo.dataInicio,
      dataFim: periodo.dataFim,
    }),
    [periodo]
  );

  const { list, botoxList, isLoading: loadingFaturamento } = useFaturamento(filtrosFaturamento);
  const { list: insumosList, isLoading: loadingInsumos } = useInsumosEntradas(filtrosInsumos);

  const buckets = useMemo(
    () =>
      buildFluxoCaixaBuckets({
        dataInicio: periodo.dataInicio,
        dataFim: periodo.dataFim,
        recebimentos: list,
        botoxPagamentos: botoxList,
        insumos: insumosList,
      }),
    [periodo.dataInicio, periodo.dataFim, list, botoxList, insumosList]
  );

  const granularity = getFluxoCaixaGranularity(periodo.dataInicio, periodo.dataFim);

  const chartBuckets = useMemo(
    () =>
      buckets.map((bucket) => ({
        ...bucket,
        shortLabel: chartBucketLabel(bucket.key, granularity),
      })),
    [buckets, granularity]
  );

  const resumo = useMemo(() => buildFluxoCaixaResumo(buckets), [buckets]);
  const pieData = useMemo(() => buildFaturamentoPieData(list, botoxList), [list, botoxList]);
  const isLoading = loadingFaturamento || loadingInsumos;
  const hasData = buckets.some((b) => b.faturamento > 0 || b.insumos > 0);

  const barChartTitle =
    granularity === 'dia' ? 'Fluxo de caixa diário' : 'Fluxo de caixa mensal';

  const barSlotWidth = isMobile ? 42 : 48;
  const barChartMinWidth = Math.max(280, chartBuckets.length * barSlotWidth);
  const barChartScrollable = chartBuckets.length > 8;
  const xAxisInterval = Math.max(0, Math.ceil(chartBuckets.length / (isMobile ? 5 : 7)) - 1);

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4 md:space-y-6 animate-fade-in">
      <PageBreadcrumb
        segments={[
          { label: 'Início', path: '/dashboard' },
          { label: 'Fluxo de caixa' },
        ]}
        className="mb-1 hidden md:block"
      />

      <div className="flex flex-col gap-1 min-w-0">
        <h1 className="text-base md:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <BarChart3 className="w-5 h-5 md:w-7 md:h-7 text-primary shrink-0" />
          <span className="min-w-0">Fluxo de caixa</span>
        </h1>
        <p className="text-muted-foreground text-xs md:text-sm">
          Visão comparativa entre faturamento e compras de insumos no período. Somente leitura.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-1.5 md:pb-2 p-3 md:p-6">
          <CardTitle className="text-sm md:text-base">Filtro de período</CardTitle>
          <CardDescription className="text-xs">
            Ajuste o intervalo para atualizar os gráficos automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0 space-y-3">
          <FiltroPeriodo value={periodo} onChange={setPeriodo} />
          {mode === 'master' && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">
                {isMaster ? 'Visão consolidada da clínica' : 'Filial'}
              </p>
              <BranchFilterSelect />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
        <Card>
          <CardHeader className="pb-1 md:pb-2 p-2.5 md:p-6">
            <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-600 shrink-0" />
              <span className="min-w-0 leading-tight">Faturamento</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2.5 pb-2.5 md:px-6 md:pb-6 pt-0">
            <p className="text-sm sm:text-lg md:text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums break-words">
              {formatFluxoCurrency(resumo.faturamentoTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 md:pb-2 p-2.5 md:p-6">
            <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-600 shrink-0" />
              <span className="min-w-0 leading-tight">Compras de insumos</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2.5 pb-2.5 md:px-6 md:pb-6 pt-0">
            <p className="text-sm sm:text-lg md:text-2xl font-bold text-red-700 dark:text-red-400 tabular-nums break-words">
              {formatFluxoCurrency(resumo.insumosTotal)}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-2 lg:col-span-1">
          <CardHeader className="pb-1 md:pb-2 p-2.5 md:p-6">
            <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
              <span className="min-w-0 leading-tight">Saldo do período</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2.5 pb-2.5 md:px-6 md:pb-6 pt-0">
            <p
              className={cn(
                'text-sm sm:text-lg md:text-2xl font-bold tabular-nums break-words',
                resumo.saldo >= 0 ? 'text-foreground' : 'text-red-700 dark:text-red-400'
              )}
            >
              {formatFluxoCurrency(resumo.saldo)}
            </p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Carregando dados do fluxo de caixa…
          </CardContent>
        </Card>
      ) : !hasData ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum lançamento de faturamento ou insumos neste período.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3 sm:gap-4">
          <Card className="min-w-0">
            <CardHeader className="p-3 md:p-6 pb-2 space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="text-sm md:text-base">{barChartTitle}</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Barras verdes: faturamento · Barras vermelhas: compras de insumos
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3 text-[10px] md:text-xs shrink-0">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                    Faturamento
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
                    Insumos
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0 min-w-0">
              <div
                className={cn(
                  'min-w-0',
                  barChartScrollable &&
                    'overflow-x-auto overscroll-x-contain touch-pan-x -mx-1 px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]'
                )}
              >
                <div style={{ minWidth: barChartScrollable ? barChartMinWidth : undefined }}>
                  <ChartContainer
                    config={{
                      faturamento: { label: 'Faturamento', color: '#22c55e' },
                      insumos: { label: 'Insumos', color: '#ef4444' },
                    }}
                    className="aspect-auto h-[220px] w-full min-w-0 sm:h-[260px] md:h-[280px]"
                  >
                    <BarChart
                      data={chartBuckets}
                      margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                      barCategoryGap="18%"
                      barGap={2}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="shortLabel"
                        tick={{ fontSize: isMobile ? 10 : 11 }}
                        interval={xAxisInterval}
                        minTickGap={8}
                      />
                      <YAxis
                        tickFormatter={(v) => formatFluxoCurrency(Number(v))}
                        width={isMobile ? 72 : 84}
                        tick={{ fontSize: isMobile ? 9 : 10 }}
                      />
                      <ChartTooltip
                        trigger={tooltipTrigger}
                        content={
                          <ChartTooltipContent
                            labelFormatter={(_, payload) => {
                              const key = payload?.[0]?.payload?.key as string | undefined;
                              if (!key) return '';
                              if (granularity === 'mes') return formatMonthLabel(key);
                              return format(parseISO(key), "dd 'de' MMMM", { locale: ptBR });
                            }}
                            formatter={(value, name) => [formatFluxoCurrency(Number(value)), String(name)]}
                          />
                        }
                      />
                      <Bar
                        dataKey="faturamento"
                        fill="var(--color-faturamento)"
                        radius={[4, 4, 0, 0]}
                        name="Faturamento"
                        maxBarSize={32}
                      />
                      <Bar
                        dataKey="insumos"
                        fill="var(--color-insumos)"
                        radius={[4, 4, 0, 0]}
                        name="Insumos"
                        maxBarSize={32}
                      />
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="p-3 md:p-6 pb-2">
              <CardTitle className="text-sm md:text-base">Faturamento por origem</CardTitle>
              <CardDescription className="text-xs">Distribuição no período selecionado</CardDescription>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0 min-w-0">
              {pieData.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Sem faturamento no período.</p>
              ) : (
                <>
                  <ChartContainer
                    config={Object.fromEntries(
                      pieData.map((slice, index) => [
                        `slice${index}`,
                        { label: slice.name, color: slice.color },
                      ])
                    )}
                    className="aspect-auto h-[200px] w-full min-w-0 sm:h-[240px] md:h-[260px]"
                  >
                    <PieChart>
                      <ChartTooltip
                        trigger={tooltipTrigger}
                        content={
                          <ChartTooltipContent
                            formatter={(value, _name, item) => [
                              formatFluxoCurrency(Number(value)),
                              item?.payload?.name ?? 'Item',
                            ]}
                          />
                        }
                      />
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius="72%"
                        label={false}
                        labelLine={false}
                      >
                        {pieData.map((slice) => (
                          <Cell key={slice.name} fill={slice.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <ul className="mt-3 space-y-2 border-t border-border/60 pt-3">
                    {pieData.map((slice) => (
                      <li key={slice.name} className="flex items-start justify-between gap-3 text-xs sm:text-sm">
                        <span className="flex min-w-0 items-start gap-2">
                          <span
                            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-border/40"
                            style={{ backgroundColor: slice.color }}
                            aria-hidden
                          />
                          <span className="min-w-0 break-words leading-snug">{slice.name}</span>
                        </span>
                        <span className="shrink-0 font-medium tabular-nums text-foreground">
                          {formatFluxoCurrency(slice.value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="p-3 md:p-6 pb-2">
              <CardTitle className="text-sm md:text-base">Evolução do saldo</CardTitle>
              <CardDescription className="text-xs flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Faturamento menos compras de insumos em cada {granularity === 'dia' ? 'dia' : 'mês'}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0 min-w-0">
              <ChartContainer
                config={{
                  saldo: { label: 'Saldo', color: 'hsl(var(--primary))' },
                }}
                className="aspect-auto h-[200px] w-full min-w-0 sm:h-[240px] md:h-[260px]"
              >
                <LineChart data={chartBuckets} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="shortLabel"
                    tick={{ fontSize: isMobile ? 10 : 11 }}
                    interval={xAxisInterval}
                    minTickGap={8}
                  />
                  <YAxis
                    tickFormatter={(v) => formatFluxoCurrency(Number(v))}
                    width={isMobile ? 72 : 84}
                    tick={{ fontSize: isMobile ? 9 : 10 }}
                  />
                  <ChartTooltip
                    trigger={tooltipTrigger}
                    content={
                      <ChartTooltipContent
                        formatter={(value) => [formatFluxoCurrency(Number(value)), 'Saldo']}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="saldo"
                    stroke="var(--color-saldo)"
                    strokeWidth={2.5}
                    dot={renderChartDot}
                    activeDot={{ r: isMobile ? 8 : 6 }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <MobileBottomSafeSpacer />
    </div>
  );
}
