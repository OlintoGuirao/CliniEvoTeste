import { useMemo } from 'react';
import { format, differenceInYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';
import {
  EVOLUCAO_METRICAS,
  buildEmagrecimentoChartPoints,
  buildEmagrecimentoChartSeriesKeys,
  getEmagrecimentoFieldLabel,
  pickCompositionKeys,
  pickTroncoKeys,
  type ProcedureFieldLike,
  type SessionLike,
} from '@/lib/emagrecimentoRelatorio';

const CHART_PALETTE = ['#0d9488', '#0284c7', '#16a34a', '#ca8a04', '#9333ea', '#db2777'];

export type EmagrecimentoFieldRow = ProcedureFieldLike & { id: string; sort_order: number };

export type EmagrecimentoSessionRow = SessionLike & { observacoes?: string | null };

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '.'));
  return Number.isFinite(n) ? n : null;
}

function sessionFreshnessMs(session: EmagrecimentoSessionRow): number {
  const updatedAt = session.updated_at ? Date.parse(session.updated_at) : Number.NaN;
  if (Number.isFinite(updatedAt)) return updatedAt;
  const createdAt = session.created_at ? Date.parse(session.created_at) : Number.NaN;
  if (Number.isFinite(createdAt)) return createdAt;
  return Date.parse(session.session_date);
}

function toDateKey(value: string): string {
  const trimmed = String(value ?? '').trim();
  return trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed;
}

function dedupeSessionsByDatePreferringFirst(sessions: EmagrecimentoSessionRow[]): EmagrecimentoSessionRow[] {
  if (sessions.length <= 1) return sessions;
  const byDate = new Map<string, EmagrecimentoSessionRow>();
  for (const session of sessions) {
    const key = toDateKey(session.session_date);
    if (!byDate.has(key)) byDate.set(key, session);
  }
  return Array.from(byDate.values());
}

function valueForIndicator(data: Record<string, unknown>, indicatorKey: string): number | null {
  if (indicatorKey === 'peso') return toNum(data.peso_atual ?? data.peso_inicial);
  return toNum(data[indicatorKey]);
}

function formatSignedDelta(n: number, unit: string): string {
  const safe = Math.abs(n) < 1e-9 ? 0 : n;
  const sign = safe > 0 ? '+' : safe < 0 ? '−' : '';
  const abs = Math.abs(safe);
  const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(abs);
  const u = unit ? ` ${unit}` : '';
  return sign === '' ? `${fmt}${u}` : `${sign}${fmt}${u}`;
}

export type SummaryRow = {
  key: string;
  label: string;
  unit: string;
  lowerIsBetter: boolean;
  ultimo: string;
  geral: string;
  geralTone: 'good' | 'bad' | 'neutral';
  /** Valor na última sessão formatado (ex.: "97,0 kg"). */
  currentDisplay: string;
  /** Diferença última sessão − anterior; null se não houver sessão anterior. */
  sessionDiff: number | null;
  /** Tom da variação sessão a sessão (bom/ruim conforme lowerIsBetter). */
  sessionDeltaTone: 'good' | 'bad' | 'neutral';
};

export function useEmagrecimentoRelatorioComputed(args: {
  fields: EmagrecimentoFieldRow[];
  sessions: EmagrecimentoSessionRow[];
  instanceData: Record<string, unknown>;
  displayStartDate: string | null;
  patientDob: string | null;
}): {
  firstSession: EmagrecimentoSessionRow | null;
  latestSession: EmagrecimentoSessionRow | null;
  latestData: Record<string, unknown>;
  previousData: Record<string, unknown>;
  baselineData: Record<string, unknown>;
  chartData: ReturnType<typeof buildEmagrecimentoChartPoints>;
  chartSeriesKeys: string[];
  chartConfig: Record<string, { label: string; color?: string }>;
  compositionKeys: string[];
  troncoKeys: string[];
  summaryRows: SummaryRow[];
  numericFields: EmagrecimentoFieldRow[];
  hasPesoField: boolean;
  patientAge: number | null;
  lastEvalDate: string;
} {
  const { fields, sessions, instanceData, displayStartDate, patientDob } = args;
  const uniqueSessions = useMemo(() => dedupeSessionsByDatePreferringFirst(sessions), [sessions]);

  const sortedSessions = useMemo(() => {
    if (uniqueSessions.length <= 1) return uniqueSessions;
    return [...uniqueSessions].sort((a, b) => {
      const dateDiff = new Date(b.session_date).getTime() - new Date(a.session_date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return sessionFreshnessMs(b) - sessionFreshnessMs(a);
    });
  }, [uniqueSessions]);

  const firstSession = sortedSessions.length > 0 ? sortedSessions[sortedSessions.length - 1]! : null;
  const latestSession = sortedSessions.length > 0 ? sortedSessions[0]! : null;

  const latestData = (latestSession?.data as Record<string, unknown>) ?? {};
  const previousData = (sortedSessions.length >= 2 ? (sortedSessions[1]!.data as Record<string, unknown>) : {}) ?? {};

  const baselineData = useMemo(
    () => ({ ...instanceData, ...(firstSession?.data as Record<string, unknown> | undefined) }),
    [instanceData, firstSession?.data]
  );

  const numericFields = useMemo(() => fields.filter((f) => f.field_type === 'number'), [fields]);
  const hasPesoField = useMemo(
    () => numericFields.some((f) => f.field_key === 'peso_inicial' || f.field_key === 'peso_atual'),
    [numericFields]
  );

  const chartData = useMemo(
    () =>
      buildEmagrecimentoChartPoints({
        numericFields,
        sessions: uniqueSessions,
        instanceData,
        firstSession,
        displayStartDate,
      }),
    [numericFields, uniqueSessions, instanceData, firstSession, displayStartDate]
  );

  const chartSeriesKeys = useMemo(
    () => buildEmagrecimentoChartSeriesKeys(chartData, numericFields, hasPesoField),
    [chartData, numericFields, hasPesoField]
  );

  const chartConfig = useMemo(() => {
    const cfg: Record<string, { label: string; color?: string }> = {};
    chartSeriesKeys.forEach((key, i) => {
      const field = numericFields.find(
        (f) => (f.field_key === 'peso_inicial' || f.field_key === 'peso_atual' ? 'peso' : f.field_key) === key
      );
      cfg[key] = {
        label: key === 'peso' ? 'Peso (kg)' : getEmagrecimentoFieldLabel(fields, field?.field_key ?? key),
        color: CHART_PALETTE[i % CHART_PALETTE.length],
      };
    });
    return cfg;
  }, [chartSeriesKeys, numericFields, fields]);

  const compositionKeys = useMemo(
    () => pickCompositionKeys(chartSeriesKeys, numericFields),
    [chartSeriesKeys, numericFields]
  );
  const troncoKeys = useMemo(() => pickTroncoKeys(chartSeriesKeys), [chartSeriesKeys]);

  const summaryRows = useMemo(() => {
    const rows: SummaryRow[] = [];
    const orderedKeys: { key: string; label: string; unit: string; lowerIsBetter: boolean }[] = [];
    const seen = new Set<string>();
    const pushMetric = (key: string, label: string, unit: string, lowerIsBetter: boolean) => {
      if (seen.has(key)) return;
      seen.add(key);
      orderedKeys.push({ key, label, unit, lowerIsBetter });
    };

    pushMetric('peso', 'Peso', 'kg', true);
    for (const m of EVOLUCAO_METRICAS) {
      if (m.key === 'peso_atual') continue;
      pushMetric(m.key, m.label.replace(/\s*\(cm\)\s*$/i, ''), 'cm', true);
    }
    for (const k of chartSeriesKeys) {
      if (k === 'peso' || k === 'imc') continue;
      if (seen.has(k)) continue;
      const field = numericFields.find((f) => f.field_key === k);
      if (!field) continue;
      const lab = getEmagrecimentoFieldLabel(fields, k);
      const unitGuess = /%|pct|percent/i.test(k + lab) ? '%' : /peso|kg|massa/i.test(lab) ? 'kg' : 'cm';
      pushMetric(k, lab, unitGuess, true);
    }

    for (const { key, label, unit, lowerIsBetter } of orderedKeys) {
      const latest = valueForIndicator(latestData, key);
      const prev = valueForIndicator(previousData, key);
      const base = valueForIndicator(baselineData, key);
      if (latest == null && base == null) continue;

      const sessionDiff =
        latest != null && prev != null && sortedSessions.length >= 2 ? latest - prev : null;

      const ultimo = sessionDiff != null ? formatSignedDelta(sessionDiff, unit) : '—';

      let sessionDeltaTone: 'good' | 'bad' | 'neutral' = 'neutral';
      if (sessionDiff != null) {
        if (Math.abs(sessionDiff) < 1e-9) sessionDeltaTone = 'neutral';
        else if (lowerIsBetter) sessionDeltaTone = sessionDiff < 0 ? 'good' : 'bad';
        else sessionDeltaTone = sessionDiff > 0 ? 'good' : 'bad';
      }

      const currentDisplay =
        latest != null
          ? `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(latest)} ${unit}`.trim()
          : '—';

      let geral = '—';
      let geralTone: 'good' | 'bad' | 'neutral' = 'neutral';
      if (latest != null && base != null) {
        const diff = latest - base;
        geral = formatSignedDelta(diff, unit);
        if (Math.abs(diff) < 1e-9) geralTone = 'neutral';
        else if (lowerIsBetter) geralTone = diff < 0 ? 'good' : 'bad';
        else geralTone = diff > 0 ? 'good' : 'bad';
      }

      rows.push({
        key,
        label,
        unit,
        lowerIsBetter,
        ultimo,
        geral,
        geralTone,
        currentDisplay,
        sessionDiff,
        sessionDeltaTone,
      });
    }

    return rows;
  }, [latestData, previousData, baselineData, chartSeriesKeys, numericFields, fields, sortedSessions.length]);

  const patientAge =
    patientDob != null && /^\d{4}-\d{2}-\d{2}/.test(patientDob)
      ? differenceInYears(new Date(), parseLocalDate(patientDob.slice(0, 10)))
      : null;

  const lastEvalDate =
    latestSession?.session_date != null
      ? format(parseLocalDate(latestSession.session_date), 'dd/MM/yyyy', { locale: ptBR })
      : '—';

  return {
    firstSession,
    latestSession,
    latestData,
    previousData,
    baselineData,
    chartData,
    chartSeriesKeys,
    chartConfig,
    compositionKeys,
    troncoKeys,
    summaryRows,
    numericFields,
    hasPesoField,
    patientAge,
    lastEvalDate,
  };
}

export type PatientSex = Database['public']['Enums']['patient_sex'];
