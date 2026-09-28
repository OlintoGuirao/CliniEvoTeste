/**
 * Fórmulas do dashboard Master (serverless — espelho de src/lib/clinicMasterDashboardMetrics.ts).
 */

export function previousPeriod(dataInicio, dataFim) {
  const start = new Date(`${dataInicio}T12:00:00`);
  const end = new Date(`${dataFim}T12:00:00`);
  const days = Math.round((end - start) / 86400000) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { dataInicio: fmt(prevStart), dataFim: fmt(prevEnd) };
}

export function computeComparison(current, previous) {
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

export function computeConversionRate(closings, evaluations) {
  if (evaluations <= 0) {
    return { ratePercent: null, numerator: closings, denominator: 0 };
  }
  return {
    ratePercent: (closings / evaluations) * 100,
    numerator: closings,
    denominator: evaluations,
  };
}

export function computeTicketMedio(revenue, closings) {
  if (closings <= 0) return null;
  return revenue / closings;
}

export function buildTopTreatments(rows, limit = 5) {
  const total = rows.reduce((acc, r) => acc + r.value, 0);
  const sorted = [...rows].sort((a, b) => b.value - a.value).slice(0, limit);
  return sorted.map((r) => ({
    ...r,
    sharePercent: total > 0 ? (r.value / total) * 100 : 0,
  }));
}

export function monthEvolutionKeys(dataInicio, dataFim) {
  const start = new Date(`${dataInicio.slice(0, 7)}-01T12:00:00`);
  const end = new Date(`${dataFim.slice(0, 7)}-01T12:00:00`);
  const keys = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return keys;
}

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function formatMonthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS_PT[(m ?? 1) - 1]}/${String(y).slice(-2)}`;
}
