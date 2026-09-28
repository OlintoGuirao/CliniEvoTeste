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
import {
  BarChart3,
  Building2,
  Package,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { MobileBottomSafeSpacer } from '@/components/layout/mobile';
import { FiltroPeriodo, type FiltroPeriodoValue } from '@/components/faturamento/FiltroPeriodo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  BrowserTabs,
  BrowserTabsContent,
  BrowserTabsList,
  BrowserTabsTrigger,
} from '@/components/ui/browser-tabs';
import { SalonFluxoCaixaExpensesSection } from '@/components/salon/SalonFluxoCaixaExpensesSection';
import { SalonFluxoCaixaInsumosSection } from '@/components/salon/SalonFluxoCaixaInsumosSection';
import { useChartMobileBehavior } from '@/hooks/use-chart-mobile-behavior';
import { useFaturamento } from '@/hooks/use-faturamento';
import { useInsumosEntradas } from '@/hooks/use-insumos-entradas';
import { useSalonCashExpenses } from '@/hooks/use-salon-cash-expenses';
import {
  buildFaturamentoPieData,
  buildFluxoCaixaBuckets,
  buildFluxoCaixaResumo,
  formatFluxoCurrency,
  getFluxoCaixaGranularity,
} from '@/lib/fluxoCaixa';
import { formatMonthLabel } from '@/lib/programaBotox';
import { cn } from '@/lib/utils';

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

/** Fluxo de caixa unificado — exclusivo conta Salão. */
export default function SalonFluxoCaixaPage() {
  const [periodo, setPeriodo] = useState<FiltroPeriodoValue>(getDefaultPeriod);
  const [tab, setTab] = useState('visao');
  const { isMobile, tooltipTrigger, renderChartDot } = useChartMobileBehavior();

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

  const filtrosPeriodo = useMemo(
    () => ({ dataInicio: periodo.dataInicio, dataFim: periodo.dataFim }),
    [periodo]
  );

  const { list, botoxList, isLoading: loadingFaturamento } = useFaturamento(filtrosFaturamento);
  const { list: insumosList, isLoading: loadingInsumos } = useInsumosEntradas(filtrosPeriodo);
  const {
    list: despesasList,
    fixed,
    variable,
    fixedTotal,
    variableTotal,
    isLoading: loadingDespesas,
  } = useSalonCashExpenses(filtrosPeriodo);

  const buckets = useMemo(
    () =>
      buildFluxoCaixaBuckets({
        dataInicio: periodo.dataInicio,
        dataFim: periodo.dataFim,
        recebimentos: list,
        botoxPagamentos: botoxList,
        insumos: insumosList,
        despesas: despesasList,
      }),
    [periodo.dataInicio, periodo.dataFim, list, botoxList, insumosList, despesasList]
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
  const isLoading = loadingFaturamento || loadingInsumos || loadingDespesas;
  const hasData = buckets.some((b) => b.faturamento > 0 || b.saidas > 0);

  const barChartScrollable = chartBuckets.length > 8;
  const barChartMinWidth = Math.max(280, chartBuckets.length * (isMobile ? 42 : 48));
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
          Faturamento, insumos e despesas (fixas e variáveis) do salão em uma única tela.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-1.5 md:pb-2 p-3 md:p-6">
          <CardTitle className="text-sm md:text-base">Filtro de período</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          <FiltroPeriodo value={periodo} onChange={setPeriodo} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 md:gap-3">
        <Card>
          <CardHeader className="pb-1 p-2.5 md:p-4">
            <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              Faturamento
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2.5 pb-2.5 md:px-4 md:pb-4 pt-0">
            <p className="text-sm md:text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {formatFluxoCurrency(resumo.faturamentoTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 p-2.5 md:p-4">
            <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-red-600" />
              Insumos
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2.5 pb-2.5 md:px-4 md:pb-4 pt-0">
            <p className="text-sm md:text-lg font-bold text-red-700 dark:text-red-400 tabular-nums">
              {formatFluxoCurrency(resumo.insumosTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 p-2.5 md:p-4">
            <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-orange-600" />
              Fixas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2.5 pb-2.5 md:px-4 md:pb-4 pt-0">
            <p className="text-sm md:text-lg font-bold text-orange-700 dark:text-orange-400 tabular-nums">
              {formatFluxoCurrency(resumo.despesasFixasTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 p-2.5 md:p-4">
            <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
              Variáveis
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2.5 pb-2.5 md:px-4 md:pb-4 pt-0">
            <p className="text-sm md:text-lg font-bold text-amber-700 dark:text-amber-400 tabular-nums">
              {formatFluxoCurrency(resumo.despesasVariaveisTotal)}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-2 lg:col-span-1">
          <CardHeader className="pb-1 p-2.5 md:p-4">
            <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" />
              Saldo
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2.5 pb-2.5 md:px-4 md:pb-4 pt-0">
            <p
              className={cn(
                'text-sm md:text-lg font-bold tabular-nums',
                resumo.saldo >= 0 ? 'text-foreground' : 'text-red-700 dark:text-red-400'
              )}
            >
              {formatFluxoCurrency(resumo.saldo)}
            </p>
          </CardContent>
        </Card>
      </div>

      <BrowserTabs value={tab} onValueChange={setTab}>
        <BrowserTabsList className="w-full flex-wrap h-auto gap-1">
          <BrowserTabsTrigger value="visao">Visão geral</BrowserTabsTrigger>
          <BrowserTabsTrigger value="insumos">Insumos</BrowserTabsTrigger>
          <BrowserTabsTrigger value="fixas">Despesas fixas</BrowserTabsTrigger>
          <BrowserTabsTrigger value="variaveis">Despesas variáveis</BrowserTabsTrigger>
        </BrowserTabsList>

        <BrowserTabsContent value="visao" className="space-y-3 sm:space-y-4 mt-3">
          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Carregando fluxo de caixa…
              </CardContent>
            </Card>
          ) : !hasData ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Nenhum lançamento neste período. Use as abas para registrar insumos e despesas.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="min-w-0">
                <CardHeader className="p-3 md:p-6 pb-2">
                  <CardTitle className="text-sm md:text-base">
                    {granularity === 'dia' ? 'Fluxo diário' : 'Fluxo mensal'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Verde: faturamento · Vermelho: saídas (insumos + despesas)
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 md:p-6 pt-0">
                  <div
                    className={cn(
                      'min-w-0',
                      barChartScrollable &&
                        'overflow-x-auto overscroll-x-contain touch-pan-x -mx-1 px-1 pb-1'
                    )}
                  >
                    <div style={{ minWidth: barChartScrollable ? barChartMinWidth : undefined }}>
                      <ChartContainer
                        config={{
                          faturamento: { label: 'Faturamento', color: '#22c55e' },
                          saidas: { label: 'Saídas', color: '#ef4444' },
                        }}
                        className="aspect-auto h-[220px] w-full sm:h-[260px]"
                      >
                        <BarChart data={chartBuckets} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="shortLabel"
                            tick={{ fontSize: isMobile ? 10 : 11 }}
                            interval={xAxisInterval}
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
                                formatter={(value, name) => [
                                  formatFluxoCurrency(Number(value)),
                                  String(name),
                                ]}
                              />
                            }
                          />
                          <Bar dataKey="faturamento" fill="var(--color-faturamento)" name="Faturamento" radius={[4, 4, 0, 0]} maxBarSize={32} />
                          <Bar dataKey="saidas" fill="var(--color-saidas)" name="Saídas" radius={[4, 4, 0, 0]} maxBarSize={32} />
                        </BarChart>
                      </ChartContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-3 lg:grid-cols-2">
                <Card className="min-w-0">
                  <CardHeader className="p-3 md:p-6 pb-2">
                    <CardTitle className="text-sm md:text-base">Faturamento por serviço</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 md:p-6 pt-0">
                    {pieData.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">Sem faturamento.</p>
                    ) : (
                      <>
                        <ChartContainer
                          config={Object.fromEntries(
                            pieData.map((slice, index) => [
                              `slice${index}`,
                              { label: slice.name, color: slice.color },
                            ])
                          )}
                          className="aspect-auto h-[200px] w-full"
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
                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="72%">
                              {pieData.map((slice) => (
                                <Cell key={slice.name} fill={slice.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ChartContainer>
                        <ul className="mt-3 space-y-2 border-t pt-3">
                          {pieData.map((slice) => (
                            <li key={slice.name} className="flex justify-between gap-2 text-xs sm:text-sm">
                              <span className="flex items-center gap-2 min-w-0">
                                <span
                                  className="h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: slice.color }}
                                />
                                <span className="truncate">{slice.name}</span>
                              </span>
                              <span className="font-medium tabular-nums shrink-0">
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
                    <CardDescription className="text-xs">
                      Faturamento menos insumos e despesas
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-3 md:p-6 pt-0">
                    <ChartContainer
                      config={{ saldo: { label: 'Saldo', color: 'hsl(var(--primary))' } }}
                      className="aspect-auto h-[200px] w-full"
                    >
                      <LineChart data={chartBuckets} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="shortLabel"
                          tick={{ fontSize: isMobile ? 10 : 11 }}
                          interval={xAxisInterval}
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
            </>
          )}
        </BrowserTabsContent>

        <BrowserTabsContent value="insumos" className="mt-3">
          <Card>
            <CardContent className="p-3 md:p-6">
              <SalonFluxoCaixaInsumosSection
                list={insumosList}
                total={resumo.insumosTotal}
                isLoading={loadingInsumos}
              />
            </CardContent>
          </Card>
        </BrowserTabsContent>

        <BrowserTabsContent value="fixas" className="mt-3">
          <Card>
            <CardContent className="p-3 md:p-6">
              <SalonFluxoCaixaExpensesSection
                kind="fixed"
                title="Despesas fixas"
                description="Custos recorrentes do salão (aluguel, salários, internet, etc.)."
                rows={fixed}
                total={fixedTotal}
                dataInicio={periodo.dataInicio}
                dataFim={periodo.dataFim}
                isLoading={loadingDespesas}
              />
            </CardContent>
          </Card>
        </BrowserTabsContent>

        <BrowserTabsContent value="variaveis" className="mt-3">
          <Card>
            <CardContent className="p-3 md:p-6">
              <SalonFluxoCaixaExpensesSection
                kind="variable"
                title="Despesas variáveis"
                description="Gastos pontuais ou que mudam conforme o movimento (marketing, manutenção, etc.)."
                rows={variable}
                total={variableTotal}
                dataInicio={periodo.dataInicio}
                dataFim={periodo.dataFim}
                isLoading={loadingDespesas}
              />
            </CardContent>
          </Card>
        </BrowserTabsContent>
      </BrowserTabs>

      <MobileBottomSafeSpacer />
    </div>
  );
}
