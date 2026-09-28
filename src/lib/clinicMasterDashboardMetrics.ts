/**
 * Fórmulas e helpers do dashboard Master da Clínica.
 *
 * Conversão: fechamentos / avaliações × 100 (denominador mínimo 1 evita divisão por zero na exibição).
 * Ticket médio: faturamento / fechamentos (recebimentos pagos + orçamentos aceitos).
 * Delta %: ((atual − anterior) / |anterior|) × 100; anterior = 0 → null.
 */

import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  MasterDashboardComparison,
  MasterDashboardPeriodPreset,
  MasterDashboardTopTreatment,
} from '@/types/clinicMasterDashboard';

export function formatYmd(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function periodFromPreset(preset: MasterDashboardPeriodPreset): {
  dataInicio: string;
  dataFim: string;
} {
  const today = new Date();
  const dataFim = formatYmd(today);

  switch (preset) {
    case 'hoje':
      return { dataInicio: dataFim, dataFim };
    case 'semana': {
      const start = startOfWeek(today, { weekStartsOn: 1 });
      const end = endOfWeek(today, { weekStartsOn: 1 });
      return { dataInicio: formatYmd(start), dataFim: formatYmd(end) };
    }
    case 'mes': {
      return {
        dataInicio: formatYmd(startOfMonth(today)),
        dataFim: formatYmd(endOfMonth(today)),
      };
    }
    case '6meses': {
      const start = startOfMonth(subMonths(today, 5));
      return { dataInicio: formatYmd(start), dataFim };
    }
    default:
      return {
        dataInicio: formatYmd(startOfMonth(today)),
        dataFim: formatYmd(endOfMonth(today)),
      };
  }
}

export function previousPeriod(dataInicio: string, dataFim: string): {
  dataInicio: string;
  dataFim: string;
} {
  const start = parseISO(dataInicio);
  const end = parseISO(dataFim);
  const days = differenceInCalendarDays(end, start) + 1;
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  return { dataInicio: formatYmd(prevStart), dataFim: formatYmd(prevEnd) };
}

export function computeComparison(current: number, previous: number): MasterDashboardComparison {
  if (previous === 0) {
    return {
      value: current,
      previousValue: previous,
      deltaPercent: current === 0 ? 0 : null,
      trend: current > 0 ? 'up' : 'neutral',
    };
  }
  const deltaPercent = ((current - previous) / Math.abs(previous)) * 100;
  return {
    value: current,
    previousValue: previous,
    deltaPercent,
    trend: deltaPercent > 0 ? 'up' : deltaPercent < 0 ? 'down' : 'neutral',
  };
}

export function computeConversionRate(closings: number, evaluations: number): {
  ratePercent: number | null;
  numerator: number;
  denominator: number;
} {
  const denominator = evaluations;
  if (denominator <= 0) {
    return { ratePercent: null, numerator: closings, denominator: 0 };
  }
  return {
    ratePercent: (closings / denominator) * 100,
    numerator: closings,
    denominator,
  };
}

export function computeTicketMedio(revenue: number, closings: number): number | null {
  if (closings <= 0) return null;
  return revenue / closings;
}

export function buildTopTreatments(
  rows: Array<{ procedureId: string | null; name: string; value: number; quantity: number }>,
  limit = 5
): MasterDashboardTopTreatment[] {
  const total = rows.reduce((acc, r) => acc + r.value, 0);
  const sorted = [...rows].sort((a, b) => b.value - a.value).slice(0, limit);
  return sorted.map((r) => ({
    ...r,
    sharePercent: total > 0 ? (r.value / total) * 100 : 0,
  }));
}

export function monthEvolutionKeys(dataInicio: string, dataFim: string): string[] {
  const start = startOfMonth(parseISO(dataInicio));
  const end = startOfMonth(parseISO(dataFim));
  const keys: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    keys.push(format(cursor, 'yyyy-MM'));
    cursor = addDays(endOfMonth(cursor), 1);
    cursor = startOfMonth(cursor);
  }
  return keys;
}

export function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  return format(d, 'MMM/yy', { locale: ptBR });
}

export function percentDiff(a: number, b: number): number | null {
  if (b === 0) return a === 0 ? 0 : null;
  return ((a - b) / Math.abs(b)) * 100;
}

export function exportRowsToCsv(filename: string, headers: string[], rows: string[][]): void {
  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
