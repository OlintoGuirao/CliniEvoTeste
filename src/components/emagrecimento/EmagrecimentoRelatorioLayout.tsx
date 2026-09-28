import { type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Share2, Copy, ChartColumn, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Area, AreaChart } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { Database } from '@/integrations/supabase/types';
import { calcImc } from '@/lib/emagrecimentoRelatorio';
import type { EmagrecimentoFieldRow } from '@/hooks/useEmagrecimentoRelatorioComputed';
import type { EmagrecimentoChartPoint } from '@/lib/emagrecimentoRelatorio';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ImcSilhouetteScale } from '@/components/emagrecimento/ImcSilhouetteScale';
import { useIsMobile } from '@/hooks/useIsMobile';

const CHART_PALETTE = ['#0d9488', '#0284c7', '#16a34a', '#ca8a04', '#9333ea', '#db2777'];
const SUMMARY_ICON_BY_KEY: Record<string, string> = {
  peso: '/Peso.png',
  busto_cm: '/Busto.png',
  cintura_cm: '/Cintura.png',
  quadril_cm: '/Quadril.png',
  braco_cm: '/Braco.png',
  abdomen_superior_cm: '/Abdomen.png',
  abdomen_inferior_cm: '/Abdomen.png',
  protocolo: '/Protocolo.png',
  seringa: '/Seringa.png',
};

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return `rgba(106, 13, 173, ${alpha})`;
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/** Eixo Y só desta série: evita que medidas com valores parecidos fiquem todas sobrepostas num único gráfico. */
function yDomainForTroncoSeries(data: EmagrecimentoChartPoint[], key: string): [number, number] {
  const vals = data
    .map((d) => d[key])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (vals.length === 0) return [0, 100];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (Math.abs(max - min) < 1e-6) {
    const c = min;
    return [Math.max(0, c - 2), c + 2];
  }
  const pad = Math.max((max - min) * 0.12, 0.25);
  return [min - pad, max + pad];
}

function sexLabel(sex: Database['public']['Enums']['patient_sex'] | null | undefined): string {
  if (sex === 'male') return 'Masculino';
  if (sex === 'female') return 'Feminino';
  if (sex === 'other') return 'Outro';
  return '—';
}

function imcBand(imc: number): { text: string; tone: 'ok' | 'warn' | 'bad' } {
  if (imc < 18.5) return { text: 'Abaixo do peso', tone: 'warn' };
  if (imc < 25) return { text: 'Normal', tone: 'ok' };
  if (imc < 30) return { text: 'Sobrepeso', tone: 'warn' };
  return { text: 'Obesidade', tone: 'bad' };
}

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '.'));
  return Number.isFinite(n) ? n : null;
}

export type EmagrecimentoRelatorioLayoutProps = {
  variant: 'public' | 'auth';
  primary: string;
  patientName: string;
  patientSex: Database['public']['Enums']['patient_sex'] | null;
  patientAge: number | null;
  lastEvalDate: string;
  latestData: Record<string, unknown>;
  baselineData: Record<string, unknown>;
  summaryRows: Array<{
    key: string;
    label: string;
    ultimo: string;
    geral: string;
    geralTone: 'good' | 'bad' | 'neutral';
    currentDisplay: string;
    sessionDiff: number | null;
    sessionDeltaTone: 'good' | 'bad' | 'neutral';
  }>;
  fields: EmagrecimentoFieldRow[];
  pesoInput: string;
  setPesoInput: (v: string) => void;
  alturaInput: string;
  setAlturaInput: (v: string) => void;
  chartData: EmagrecimentoChartPoint[];
  chartSeriesKeys: string[];
  chartConfig: Record<string, { label: string; color?: string }>;
  compositionKeys: string[];
  troncoKeys: string[];
  /** auth: voltar à ficha */
  authBackHref?: string;
  /** auth: link público para copiar / WhatsApp */
  publicReportUrl?: string;
  onWhatsAppPublicLink?: () => void;
  /** rodapé auth */
  backFooterHref?: string;
  /** texto opcional abaixo do título (público) */
  publicNotice?: ReactNode;
};

export function EmagrecimentoRelatorioLayout(props: EmagrecimentoRelatorioLayoutProps) {
  const {
    variant,
    primary,
    patientName,
    patientSex,
    patientAge,
    lastEvalDate,
    latestData,
    baselineData,
    summaryRows,
    fields,
    pesoInput,
    setPesoInput,
    alturaInput,
    setAlturaInput,
    chartData,
    chartSeriesKeys,
    chartConfig,
    compositionKeys,
    troncoKeys,
    authBackHref,
    publicReportUrl,
    onWhatsAppPublicLink,
    backFooterHref,
    publicNotice,
  } = props;

  const isMobile = useIsMobile();

  /** Margens e eixo X legíveis em telas estreitas (datas inclinadas). */
  const chartMarginMain = isMobile
    ? { top: 6, right: 2, bottom: 40, left: 4 }
    : { top: 8, right: 8, bottom: 8, left: 8 };
  const chartMarginTronco = isMobile
    ? { top: 6, right: 4, bottom: 36, left: 2 }
    : { top: 8, right: 10, bottom: 8, left: 4 };

  const imcComputed = (() => {
    const peso = parseFloat(pesoInput.replace(',', '.'));
    const altura = parseFloat(alturaInput.replace(',', '.'));
    if (!Number.isFinite(peso) || !Number.isFinite(altura)) return null;
    return calcImc(peso, altura);
  })();

  const imcDisplay = (() => {
    if (imcComputed == null) return { text: 'Preencha peso e altura', tone: 'neutral' as const };
    const band = imcBand(imcComputed);
    return { text: `${imcComputed.toFixed(1)} (${band.text})`, tone: band.tone };
  })();

  /** Link público: só exibe dados da última sessão; não permite alterar valores. */
  const isPublicView = variant === 'public';
  const displayOrDash = (raw: string) => (raw.trim() !== '' ? raw : '—');

  const renderSummaryGrid = (mode: 'session' | 'overall') => {
    if (summaryRows.length === 0) {
      return <p className="text-sm text-muted-foreground">Adicione sessões com medidas para ver o resumo.</p>;
    }

    const rowByKey = new Map(summaryRows.map((row) => [row.key, row]));
    const mainRows = [
      rowByKey.get('busto_cm'),
      rowByKey.get('cintura_cm'),
      rowByKey.get('quadril_cm'),
      rowByKey.get('braco_cm'),
      rowByKey.get('abdomen_superior_cm'),
      rowByKey.get('abdomen_inferior_cm'),
    ].filter((row): row is (typeof summaryRows)[number] => Boolean(row));

    const deltaLabel = mode === 'session' ? 'Sessão' : 'Total';
    const pesoRow = rowByKey.get('peso');
    const produtoUsadoRaw = latestData.produto_usado ?? latestData.produto_utilizado;
    const produtoUsado =
      typeof produtoUsadoRaw === 'string' && produtoUsadoRaw.trim().length > 0 ? produtoUsadoRaw.trim() : '—';
    const dosagemRaw = latestData.ml ?? latestData.mg;
    const dosagemNum = toNum(dosagemRaw);
    const dosagem = dosagemNum != null ? new Intl.NumberFormat('pt-BR').format(dosagemNum) : '—';

    const renderDelta = (row: (typeof summaryRows)[number]) => {
      const deltaText = mode === 'session' ? row.ultimo : row.geral;
      const tone = mode === 'session' ? row.sessionDeltaTone : row.geralTone;
      const hasDelta = deltaText !== '—';
      const isNegative = deltaText.includes('−');
      const isPositive = deltaText.includes('+');

      if (!hasDelta) {
        return <span className="text-xs text-muted-foreground">Sem referência</span>;
      }

      return (
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${
            tone === 'good'
              ? 'text-green-600 dark:text-green-400'
              : tone === 'bad'
                ? 'text-red-600 dark:text-red-400'
                : 'text-muted-foreground'
          }`}
        >
          {isNegative ? (
            <TrendingDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : isPositive ? (
            <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          {deltaText}
        </span>
      );
    };

    return (
      <div
        className="overflow-hidden rounded-xl border"
        style={{
          borderColor: withAlpha(primary, 0.24),
          backgroundImage: `linear-gradient(to bottom, ${withAlpha(primary, 0.14)}, ${withAlpha(primary, 0.1)}, ${withAlpha(primary, 0.16)})`,
        }}
      >
        <div className="border-b bg-background/85 px-4 py-3" style={{ borderColor: withAlpha(primary, 0.24) }}>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:text-base">
            <span className="inline-flex items-center gap-2 font-semibold uppercase tracking-wide text-primary">
              <img src={SUMMARY_ICON_BY_KEY.peso} alt="" className="h-5 w-5 shrink-0" />
              Peso:
            </span>
            <span className="text-xl font-bold text-foreground">{pesoRow?.currentDisplay ?? '—'}</span>
            {pesoRow ? (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                {deltaLabel}: {renderDelta(pesoRow)}
              </span>
            ) : null}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-0 border-b md:grid-cols-2" style={{ borderColor: withAlpha(primary, 0.24) }}>
          <div className="space-y-2 px-4 py-3 md:border-r" style={{ borderColor: withAlpha(primary, 0.24) }}>
            <p className="text-sm font-semibold text-foreground">Circunferências</p>
            {mainRows
              .filter((row) => ['busto_cm', 'cintura_cm', 'quadril_cm'].includes(row.key))
              .map((row) => (
                <div key={`${mode}-top-${row.key}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <img
                      src={SUMMARY_ICON_BY_KEY[row.key] ?? SUMMARY_ICON_BY_KEY.peso}
                      alt=""
                      className="h-6 w-6 shrink-0"
                    />
                    {row.label}
                  </span>
                  <div className="text-right">
                    <p className="font-medium text-foreground">{row.currentDisplay}</p>
                    {renderDelta(row)}
                  </div>
                </div>
              ))}
          </div>

          <div className="space-y-2 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Detalhamento de corpo</p>
            {mainRows
              .filter((row) => ['braco_cm', 'abdomen_superior_cm', 'abdomen_inferior_cm'].includes(row.key))
              .map((row) => (
                <div key={`${mode}-body-${row.key}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <img
                      src={SUMMARY_ICON_BY_KEY[row.key] ?? SUMMARY_ICON_BY_KEY.peso}
                      alt=""
                      className="h-6 w-6 shrink-0"
                    />
                    {row.label}
                  </span>
                  <div className="text-right">
                    <p className="font-medium text-foreground">{row.currentDisplay}</p>
                    {renderDelta(row)}
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-background/85 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Protocolo de tratamento</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <img src={SUMMARY_ICON_BY_KEY.protocolo} alt="" className="h-6 w-6 shrink-0" />
              Produto usado: <span className="font-medium text-foreground">{produtoUsado}</span>
              <span className="hidden shrink-0 sm:inline">|</span>
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <img src={SUMMARY_ICON_BY_KEY.seringa} alt="" className="h-6 w-6 shrink-0" />
              Dosagem (mg): <span className="font-medium text-foreground">{dosagem}</span>
            </span>
          </div>
        </div>
      </div>
    );
  };

  const cardClass =
    'rounded-[20px] border border-black/[0.06] bg-white p-4 shadow-[0_2px_4px_rgba(0,0,0,0.05)] mb-4 sm:p-6 sm:mb-6 print:shadow-none print:border-border';

  const inputClass =
    'w-full min-w-0 rounded-[15px] border-0 px-3 py-2.5 text-sm text-[#4A4A4A] outline-none transition-shadow placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-offset-0 sm:px-4 sm:py-3 sm:text-base';

  const copyPublicLink = () => {
    if (!publicReportUrl) return;
    void navigator.clipboard.writeText(publicReportUrl).then(
      () => toast.success('Link copiado.'),
      () => toast.error('Não foi possível copiar.')
    );
  };

  return (
    <div
      className="relative min-h-screen w-full max-w-[100vw] min-w-0 overflow-x-hidden pb-10 font-sans antialiased print:bg-white print:pb-0 print:overflow-visible"
      style={
        {
          backgroundColor: withAlpha(primary, 0.04),
          color: '#4A4A4A',
          ['--report-primary' as string]: primary,
        } as CSSProperties
      }
    >
      <div className="mx-auto w-full min-w-0 max-w-4xl px-3 py-5 sm:px-4 sm:py-6 md:px-8 md:py-10">
        {variant === 'auth' && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <Button variant="outline" size="sm" className="gap-2 rounded-xl" asChild>
              <Link to={authBackHref ?? '#'}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Voltar à ficha
              </Link>
            </Button>
            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
              {publicReportUrl ? (
                <div className="flex flex-col gap-1 rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-xs text-[#5a5a5a] sm:max-w-md">
                  <span className="font-medium text-[#3d3d3d]">Link público (paciente não precisa logar)</span>
                  <span className="break-all font-mono text-[11px] leading-snug">{publicReportUrl}</span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-lg h-8 text-xs" onClick={copyPublicLink}>
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      Copiar
                    </Button>
                    {onWhatsAppPublicLink ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 rounded-lg h-8 text-xs border-[#25D366]/40 text-[#128C7E]"
                        onClick={onWhatsAppPublicLink}
                      >
                        <Share2 className="h-3.5 w-3.5" aria-hidden />
                        WhatsApp
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        <header className="mb-6 w-full min-w-0 max-w-full text-center sm:mb-8">
          <h1 className="hyphens-auto text-balance break-words text-xl font-bold tracking-tight text-[#2d2d2d] sm:text-2xl md:text-3xl">
            {patientName || 'Paciente'} — Relatório de Avaliação Corporal
          </h1>
          <p className="mt-2 text-base text-[#5a5a5a] sm:text-lg">Emagrecimento / Redução de Medidas</p>
          {publicNotice ? <div className="mx-auto mt-3 w-full min-w-0 max-w-full px-0.5">{publicNotice}</div> : null}
        </header>

        <section className={cn(cardClass, 'w-full min-w-0 max-w-full')}>
          <h2 className="mb-3 text-lg font-semibold text-[#3d3d3d] sm:mb-4 sm:text-xl">Dados do paciente</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
            <div className="min-w-0 break-words">
              <span className="font-medium" style={{ color: primary }}>
                Nome:{' '}
              </span>
              {patientName || '—'}
            </div>
            <div className="min-w-0 break-words">
              <span className="font-medium" style={{ color: primary }}>
                Gênero:{' '}
              </span>
              {sexLabel(patientSex)}
            </div>
            <div className="min-w-0 break-words">
              <span className="font-medium" style={{ color: primary }}>
                Idade:{' '}
              </span>
              {patientAge != null ? `${patientAge} anos` : '—'}
            </div>
            <div className="min-w-0 break-words">
              <span className="font-medium" style={{ color: primary }}>
                Altura (cadastro):{' '}
              </span>
              {toNum(latestData.altura_cm ?? baselineData.altura_cm) != null
                ? `${toNum(latestData.altura_cm ?? baselineData.altura_cm)} cm`
                : '—'}
            </div>
            <div className="min-w-0 break-words md:col-span-2">
              <span className="font-medium" style={{ color: primary }}>
                Última avaliação:{' '}
              </span>
              {lastEvalDate}
            </div>
          </div>
        </section>

        <Card className="mb-4 w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-border/80 bg-card text-card-foreground shadow-sm sm:mb-6 print:border-border print:shadow-none">
          <CardHeader className="min-w-0 border-b border-border bg-muted/30 p-3 pb-3 md:p-4 md:pb-4">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base font-semibold tracking-tight sm:text-lg">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg md:h-9 md:w-9"
                style={{ color: primary, backgroundColor: withAlpha(primary, 0.14) }}
              >
                <ChartColumn className="h-4 w-4 md:h-5 md:w-5" aria-hidden />
              </span>
              Evolução Geral
            </CardTitle>
            <CardDescription className="mt-1 text-xs md:text-sm">
              Comparação entre a última e a primeira sessão.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 p-3 pt-2 md:p-4 md:pt-3">{renderSummaryGrid('overall')}</CardContent>
        </Card>

        <Card className="mb-4 w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-border/80 bg-card text-card-foreground shadow-sm sm:mb-6 print:border-border print:shadow-none">
          <CardHeader className="min-w-0 border-b border-border bg-muted/30 p-3 pb-3 md:p-4 md:pb-4">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base font-semibold tracking-tight sm:text-lg">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg md:h-9 md:w-9"
                style={{ color: primary, backgroundColor: withAlpha(primary, 0.14) }}
              >
                <ChartColumn className="h-4 w-4 md:h-5 md:w-5" aria-hidden />
              </span>
              Evolução de Medidas
            </CardTitle>
            <CardDescription className="mt-1 text-xs md:text-sm">
              Comparação entre sessão atual e anterior.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 p-3 pt-2 md:p-4 md:pt-3">{renderSummaryGrid('session')}</CardContent>
        </Card>

        <section className={cn(cardClass, 'w-full min-w-0 max-w-full')}>
          <h2 className="mb-3 text-lg font-semibold text-[#3d3d3d] sm:mb-4 sm:text-xl">Composição corporal e IMC</h2>
          {isPublicView ? (
            <p className="mb-4 text-sm text-[#5a5a5a]">Valores da última avaliação (somente leitura).</p>
          ) : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor={isPublicView ? undefined : 'peso'} className="mb-1.5 text-[#4A4A4A]">
                Peso atual (kg)
              </Label>
              {isPublicView ? (
                <div
                  id="peso"
                  className={cn(
                    inputClass,
                    'flex min-h-11 items-center sm:min-h-10',
                    !pesoInput.trim() && 'text-muted-foreground'
                  )}
                  style={{ backgroundColor: `${primary}14`, boxShadow: `inset 0 0 0 1px ${primary}33` }}
                >
                  {displayOrDash(pesoInput)}
                </div>
              ) : (
                <Input
                  id="peso"
                  type="text"
                  inputMode="decimal"
                  className={inputClass}
                  style={{ backgroundColor: `${primary}14`, boxShadow: `inset 0 0 0 1px ${primary}33` }}
                  value={pesoInput}
                  onChange={(e) => setPesoInput(e.target.value)}
                  placeholder="Ex.: 70,5"
                />
              )}
            </div>
            <div>
              <Label htmlFor={isPublicView ? undefined : 'altura'} className="mb-1.5 text-[#4A4A4A]">
                Altura (cm)
              </Label>
              {isPublicView ? (
                <div
                  id="altura"
                  className={cn(
                    inputClass,
                    'flex min-h-11 items-center sm:min-h-10',
                    !alturaInput.trim() && 'text-muted-foreground'
                  )}
                  style={{ backgroundColor: `${primary}14`, boxShadow: `inset 0 0 0 1px ${primary}33` }}
                >
                  {displayOrDash(alturaInput)}
                </div>
              ) : (
                <Input
                  id="altura"
                  type="text"
                  inputMode="decimal"
                  className={inputClass}
                  style={{ backgroundColor: `${primary}14`, boxShadow: `inset 0 0 0 1px ${primary}33` }}
                  value={alturaInput}
                  onChange={(e) => setAlturaInput(e.target.value)}
                  placeholder="Ex.: 175"
                />
              )}
            </div>
            <div className="md:col-span-2">
              <Label htmlFor={isPublicView ? undefined : 'imc_display'} className="mb-1.5 text-[#4A4A4A]">
                IMC
              </Label>
              {isPublicView ? (
                <div
                  id="imc_display"
                  className={cn(
                    inputClass,
                    'flex min-h-11 items-center sm:min-h-10',
                    imcDisplay.tone === 'ok' && 'text-emerald-600',
                    imcDisplay.tone === 'warn' && 'text-amber-600',
                    imcDisplay.tone === 'bad' && 'text-red-600'
                  )}
                  style={{ backgroundColor: `${primary}14`, boxShadow: `inset 0 0 0 1px ${primary}33` }}
                >
                  {imcDisplay.text}
                </div>
              ) : (
                <Input
                  id="imc_display"
                  readOnly
                  className={`${inputClass} ${
                    imcDisplay.tone === 'ok'
                      ? 'text-emerald-600'
                      : imcDisplay.tone === 'warn'
                        ? 'text-amber-600'
                        : imcDisplay.tone === 'bad'
                          ? 'text-red-600'
                          : ''
                  }`}
                  style={{ backgroundColor: `${primary}14`, boxShadow: `inset 0 0 0 1px ${primary}33` }}
                  value={imcDisplay.text}
                />
              )}
            </div>
          </div>
          <ImcSilhouetteScale imc={imcComputed} patientSex={patientSex} />
        </section>

        <section className={cn(cardClass, 'w-full min-w-0 max-w-full')}>
          <h2 className="mb-3 text-lg font-semibold text-[#3d3d3d] sm:mb-4 sm:text-xl">Evolução</h2>

          <div className="mb-8 min-w-0 max-w-full sm:mb-10">
            <h3 className="mb-2 text-base font-medium text-[#3d3d3d] sm:mb-3 sm:text-lg">Evolução do peso (kg)</h3>
            {chartData.length === 0 || !chartSeriesKeys.includes('peso') ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem dados de peso no período.</p>
            ) : (
              <ChartContainer
                config={{ peso: { label: 'Peso (kg)', color: primary } }}
                className="h-[220px] w-full min-w-0 sm:h-[260px] md:h-[280px]"
              >
                <LineChart data={chartData} margin={chartMarginMain}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: isMobile ? 9 : 11 }}
                    interval="preserveStartEnd"
                    angle={isMobile ? -32 : 0}
                    textAnchor={isMobile ? 'end' : 'middle'}
                    height={isMobile ? 48 : 28}
                  />
                  <YAxis
                    tick={{ fontSize: isMobile ? 9 : 11 }}
                    tickFormatter={(v) => (isMobile ? `${v}` : `${v} kg`)}
                    width={isMobile ? 36 : 48}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="peso"
                    name="Peso (kg)"
                    stroke="var(--color-peso)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </LineChart>
              </ChartContainer>
            )}
          </div>

          {compositionKeys.length > 0 ? (
            <div className="mb-8 sm:mb-10">
              <h3 className="mb-2 text-base font-medium text-[#3d3d3d] sm:mb-3 sm:text-lg">Composição corporal</h3>
              {compositionKeys.length >= 2 ? (
                <ChartContainer
                  config={Object.fromEntries(
                    compositionKeys.map((k, i) => [k, { label: chartConfig[k]?.label ?? k, color: CHART_PALETTE[i % CHART_PALETTE.length] }])
                  )}
                  className="h-[240px] w-full min-w-0 sm:h-[280px] md:h-[300px]"
                >
                  <AreaChart data={chartData} margin={chartMarginMain}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fontSize: isMobile ? 9 : 11 }}
                      interval="preserveStartEnd"
                      angle={isMobile ? -32 : 0}
                      textAnchor={isMobile ? 'end' : 'middle'}
                      height={isMobile ? 48 : 28}
                    />
                    <YAxis tick={{ fontSize: isMobile ? 9 : 11 }} width={isMobile ? 32 : 40} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    {compositionKeys.map((k) => (
                      <Area
                        key={k}
                        type="monotone"
                        dataKey={k}
                        name={chartConfig[k]?.label ?? k}
                        stackId="comp"
                        stroke={`var(--color-${k})`}
                        fill={`var(--color-${k})`}
                        fillOpacity={0.35}
                        connectNulls
                      />
                    ))}
                  </AreaChart>
                </ChartContainer>
              ) : (
                <ChartContainer
                  config={{
                    [compositionKeys[0]!]: {
                      label: chartConfig[compositionKeys[0]!]?.label ?? compositionKeys[0],
                      color: primary,
                    },
                  }}
                  className="h-[220px] w-full min-w-0 sm:h-[260px] md:h-[280px]"
                >
                  <LineChart data={chartData} margin={chartMarginMain}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fontSize: isMobile ? 9 : 11 }}
                      interval="preserveStartEnd"
                      angle={isMobile ? -32 : 0}
                      textAnchor={isMobile ? 'end' : 'middle'}
                      height={isMobile ? 48 : 28}
                    />
                    <YAxis tick={{ fontSize: isMobile ? 9 : 11 }} width={isMobile ? 32 : 40} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey={compositionKeys[0]}
                      name={chartConfig[compositionKeys[0]!]?.label}
                      stroke={`var(--color-${compositionKeys[0]})`}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </div>
          ) : null}

          <div>
            <h3 className="mb-1 text-base font-medium text-[#3d3d3d] sm:text-lg">Medidas do tronco (cm)</h3>
            <p className="mb-3 text-xs text-[#5a5a5a] sm:mb-4 sm:text-sm">
              Cada medida tem o próprio gráfico e escala vertical. Assim dá para ver a evolução mesmo quando busto,
              cintura e abdômen têm valores parecidos.
            </p>
            {troncoKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem medidas de tronco registradas.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
                {troncoKeys.map((k, i) => {
                  const color = CHART_PALETTE[i % CHART_PALETTE.length];
                  const label = chartConfig[k]?.label ?? k;
                  return (
                    <div
                      key={k}
                      className="min-w-0 rounded-xl border border-black/[0.06] bg-white/60 p-2.5 shadow-sm sm:p-3 print:border-border print:shadow-none"
                    >
                      <p className="mb-2 text-xs font-medium text-[#3d3d3d] sm:text-sm">{label}</p>
                      <ChartContainer
                        id={`tronco-${k}`}
                        config={{ [k]: { label, color } }}
                        className="aspect-auto h-[190px] w-full min-w-0 sm:h-[210px] md:h-[220px]"
                      >
                        <LineChart data={chartData} margin={chartMarginTronco}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="dateLabel"
                            tick={{ fontSize: isMobile ? 8 : 10 }}
                            interval="preserveStartEnd"
                            angle={isMobile ? -32 : 0}
                            textAnchor={isMobile ? 'end' : 'middle'}
                            height={isMobile ? 44 : 24}
                          />
                          <YAxis
                            domain={yDomainForTroncoSeries(chartData, k)}
                            tick={{ fontSize: isMobile ? 8 : 10 }}
                            tickFormatter={(v) => `${v}`}
                            width={isMobile ? 34 : 40}
                          />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line
                            type="monotone"
                            dataKey={k}
                            name={label}
                            stroke={`var(--color-${k})`}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls
                          />
                        </LineChart>
                      </ChartContainer>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {variant === 'auth' && backFooterHref ? (
          <p className="mt-4 text-center text-xs text-muted-foreground print:hidden">
            <Link to={backFooterHref} className="hover:underline" style={{ color: primary }}>
              Voltar ao paciente
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
