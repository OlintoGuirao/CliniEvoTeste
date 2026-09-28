import { format, parseISO, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { buildMonthRange, formatMonthLabel } from '@/lib/programaBotox';
import type { PagamentoProgramaBotox } from '@/hooks/use-faturamento';
import type { RecebimentoComNomes } from '@/types/faturamento';
import type { InsumoEntradaRow } from '@/hooks/use-insumos-entradas';

export type FluxoCaixaGranularity = 'dia' | 'mes';

export interface FluxoCaixaBucket {
  key: string;
  label: string;
  faturamento: number;
  insumos: number;
  /** Despesas fixas (salão). */
  despesasFixas: number;
  /** Despesas variáveis (salão). */
  despesasVariaveis: number;
  /** Insumos + despesas fixas + variáveis. */
  saidas: number;
  saldo: number;
}

export interface FluxoCaixaPieSlice {
  name: string;
  value: number;
  color: string;
}

/** Paleta ampla para distinguir cada procedimento no gráfico de pizza. */
export const FLUXO_PIE_PALETTE = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#8b5cf6',
  '#06b6d4',
  '#f59e0b',
  '#ec4899',
  '#14b8a6',
  '#6366f1',
  '#84cc16',
  '#f97316',
  '#a855f7',
  '#0ea5e9',
  '#e11d48',
  '#10b981',
  '#d946ef',
] as const;

const FLUXO_PIE_FIXED_COLORS: Record<string, string> = {
  'programa de botox': '#6366f1',
};

function hashFluxoPieLabel(label: string): number {
  const normalized = label.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickFluxoPieColor(label: string, usedColors: Set<string>): string {
  const fixed = FLUXO_PIE_FIXED_COLORS[label.trim().toLowerCase()];
  if (fixed && !usedColors.has(fixed)) {
    usedColors.add(fixed);
    return fixed;
  }

  let idx = hashFluxoPieLabel(label) % FLUXO_PIE_PALETTE.length;
  let guard = 0;
  while (usedColors.has(FLUXO_PIE_PALETTE[idx]) && guard < FLUXO_PIE_PALETTE.length) {
    idx = (idx + 1) % FLUXO_PIE_PALETTE.length;
    guard += 1;
  }
  const color = FLUXO_PIE_PALETTE[idx];
  usedColors.add(color);
  return color;
}

function assignFluxoPieColors(
  slices: Array<{ name: string; value: number }>
): FluxoCaixaPieSlice[] {
  const usedColors = new Set<string>();
  return slices.map((slice) => ({
    ...slice,
    color: pickFluxoPieColor(slice.name, usedColors),
  }));
}

export interface FluxoCaixaResumo {
  faturamentoTotal: number;
  insumosTotal: number;
  despesasFixasTotal: number;
  despesasVariaveisTotal: number;
  saidasTotal: number;
  saldo: number;
}

export function formatFluxoCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatFluxoCurrencyCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }
  if (abs >= 10_000) {
    return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }
  if (abs >= 1_000) {
    return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  }
  return formatFluxoCurrency(value);
}

function ymdFromIso(value: string): string {
  return String(value).slice(0, 10);
}

function daysInRange(dataInicio: string, dataFim: string): number {
  const start = parseISO(dataInicio);
  const end = parseISO(dataFim);
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return diff + 1;
}

export function getFluxoCaixaGranularity(dataInicio: string, dataFim: string): FluxoCaixaGranularity {
  return daysInRange(dataInicio, dataFim) <= 31 ? 'dia' : 'mes';
}

function buildDayKeys(dataInicio: string, dataFim: string): string[] {
  const keys: string[] = [];
  const cursor = parseISO(dataInicio);
  const end = parseISO(dataFim);
  while (cursor <= end) {
    keys.push(format(cursor, 'yyyy-MM-dd'));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function bucketLabel(key: string, granularity: FluxoCaixaGranularity): string {
  if (granularity === 'mes') return formatMonthLabel(key);
  return format(parseISO(key), 'dd/MM', { locale: ptBR });
}

export type FluxoCaixaDespesaLike = {
  expense_kind: 'fixed' | 'variable';
  amount: number;
  expense_date: string;
  /** Meses em que o valor se repete (padrão 1). */
  installment_months?: number | null;
  /** Parcelas (YYYY-MM-DD) já pagas. */
  paid_installment_dates?: string[] | null;
};

/** Datas de cada parcela mensal a partir da data inicial. */
export function expandExpenseInstallmentDates(
  expenseDate: string,
  installmentMonths?: number | null
): string[] {
  const start = ymdFromIso(expenseDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return [];
  const months = Math.min(120, Math.max(1, Math.floor(Number(installmentMonths) || 1)));
  const base = parseISO(start);
  if (Number.isNaN(base.getTime())) return [];
  const out: string[] = [];
  for (let i = 0; i < months; i += 1) {
    out.push(format(addMonths(base, i), 'yyyy-MM-dd'));
  }
  return out;
}

export function normalizePaidInstallmentDates(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const item of value) {
    const ymd = ymdFromIso(String(item ?? ''));
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) out.add(ymd);
  }
  return Array.from(out).sort();
}

/**
 * Parcela de referência no período (primeira no intervalo).
 * Se nenhuma cair no período, usa a parcela mais recente com data <= dataFim.
 */
export function resolveExpenseFocusInstallment(
  expense: FluxoCaixaDespesaLike,
  dataInicio: string,
  dataFim: string
): string | null {
  const dates = expandExpenseInstallmentDates(expense.expense_date, expense.installment_months);
  const inPeriod = dates.filter((d) => d >= dataInicio && d <= dataFim);
  if (inPeriod.length > 0) return inPeriod[0] ?? null;
  const beforeEnd = dates.filter((d) => d <= dataFim);
  return beforeEnd.length > 0 ? beforeEnd[beforeEnd.length - 1]! : null;
}

export type ExpensePaymentVisualStatus = 'paid' | 'overdue' | 'pending';

export function getExpenseInstallmentPaymentStatus(
  expense: FluxoCaixaDespesaLike,
  installmentDate: string | null,
  todayYmd = format(new Date(), 'yyyy-MM-dd')
): ExpensePaymentVisualStatus {
  if (!installmentDate) return 'pending';
  const paid = new Set(normalizePaidInstallmentDates(expense.paid_installment_dates));
  if (paid.has(installmentDate)) return 'paid';
  if (installmentDate < todayYmd) return 'overdue';
  return 'pending';
}

/** Soma do valor das parcelas que caem dentro do período [dataInicio, dataFim]. */
export function sumExpenseAmountInPeriod(
  expense: FluxoCaixaDespesaLike,
  dataInicio: string,
  dataFim: string
): number {
  const amount = Number(expense.amount) || 0;
  if (amount <= 0) return 0;
  let total = 0;
  for (const ymd of expandExpenseInstallmentDates(expense.expense_date, expense.installment_months)) {
    if (ymd >= dataInicio && ymd <= dataFim) total += amount;
  }
  return total;
}

export function expenseOverlapsPeriod(
  expense: FluxoCaixaDespesaLike,
  dataInicio: string,
  dataFim: string
): boolean {
  return sumExpenseAmountInPeriod(expense, dataInicio, dataFim) > 0;
}

export function buildFluxoCaixaBuckets(params: {
  dataInicio: string;
  dataFim: string;
  recebimentos: RecebimentoComNomes[];
  botoxPagamentos: PagamentoProgramaBotox[];
  insumos: InsumoEntradaRow[];
  /** Exclusivo salão — omitido em clínica/solo. */
  despesas?: FluxoCaixaDespesaLike[];
}): FluxoCaixaBucket[] {
  const granularity = getFluxoCaixaGranularity(params.dataInicio, params.dataFim);
  const keys =
    granularity === 'dia'
      ? buildDayKeys(params.dataInicio, params.dataFim)
      : buildMonthRange(
          params.dataInicio.slice(0, 7),
          params.dataFim.slice(0, 7)
        );

  const faturamentoMap = new Map<string, number>();
  const insumosMap = new Map<string, number>();
  const fixasMap = new Map<string, number>();
  const variaveisMap = new Map<string, number>();

  for (const key of keys) {
    faturamentoMap.set(key, 0);
    insumosMap.set(key, 0);
    fixasMap.set(key, 0);
    variaveisMap.set(key, 0);
  }

  const bucketKeyForDate = (ymd: string) => {
    if (granularity === 'dia') return ymd;
    return ymd.slice(0, 7);
  };

  for (const row of params.recebimentos) {
    const key = bucketKeyForDate(ymdFromIso(row.data));
    if (!faturamentoMap.has(key)) continue;
    faturamentoMap.set(key, (faturamentoMap.get(key) ?? 0) + Number(row.valor_total));
  }

  for (const row of params.botoxPagamentos) {
    const key = bucketKeyForDate(ymdFromIso(row.data_pagamento));
    if (!faturamentoMap.has(key)) continue;
    faturamentoMap.set(key, (faturamentoMap.get(key) ?? 0) + Number(row.valor));
  }

  for (const row of params.insumos) {
    const key = bucketKeyForDate(row.data_compra);
    if (!insumosMap.has(key)) continue;
    insumosMap.set(key, (insumosMap.get(key) ?? 0) + Number(row.valor_total));
  }

  for (const row of params.despesas ?? []) {
    const amount = Number(row.amount) || 0;
    if (amount <= 0) continue;
    const targetMap = row.expense_kind === 'fixed' ? fixasMap : variaveisMap;
    for (const ymd of expandExpenseInstallmentDates(row.expense_date, row.installment_months)) {
      const key = bucketKeyForDate(ymd);
      if (!targetMap.has(key)) continue;
      targetMap.set(key, (targetMap.get(key) ?? 0) + amount);
    }
  }

  return keys.map((key) => {
    const faturamento = faturamentoMap.get(key) ?? 0;
    const insumos = insumosMap.get(key) ?? 0;
    const despesasFixas = fixasMap.get(key) ?? 0;
    const despesasVariaveis = variaveisMap.get(key) ?? 0;
    const saidas = insumos + despesasFixas + despesasVariaveis;
    return {
      key,
      label: bucketLabel(key, granularity),
      faturamento,
      insumos,
      despesasFixas,
      despesasVariaveis,
      saidas,
      saldo: faturamento - saidas,
    };
  });
}

export function buildFluxoCaixaResumo(buckets: FluxoCaixaBucket[]): FluxoCaixaResumo {
  const faturamentoTotal = buckets.reduce((acc, b) => acc + b.faturamento, 0);
  const insumosTotal = buckets.reduce((acc, b) => acc + b.insumos, 0);
  const despesasFixasTotal = buckets.reduce((acc, b) => acc + b.despesasFixas, 0);
  const despesasVariaveisTotal = buckets.reduce((acc, b) => acc + b.despesasVariaveis, 0);
  const saidasTotal = insumosTotal + despesasFixasTotal + despesasVariaveisTotal;
  return {
    faturamentoTotal,
    insumosTotal,
    despesasFixasTotal,
    despesasVariaveisTotal,
    saidasTotal,
    saldo: faturamentoTotal - saidasTotal,
  };
}

export function buildFaturamentoPieData(
  recebimentos: RecebimentoComNomes[],
  botoxPagamentos: PagamentoProgramaBotox[]
): FluxoCaixaPieSlice[] {
  const map = new Map<string, number>();

  for (const row of recebimentos) {
    const name = row.procedimento_nome?.trim() || 'Procedimento';
    map.set(name, (map.get(name) ?? 0) + Number(row.valor_total));
  }

  const botoxTotal = botoxPagamentos.reduce((acc, p) => acc + Number(p.valor), 0);
  if (botoxTotal > 0) {
    map.set('Programa de Botox', (map.get('Programa de Botox') ?? 0) + botoxTotal);
  }

  return assignFluxoPieColors(
    Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
  );
}
