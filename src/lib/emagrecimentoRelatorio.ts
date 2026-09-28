import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/utils';

/** Métricas corporais para resumo / medidas (mesmo conjunto da ficha de emagrecimento). */
export const EVOLUCAO_METRICAS: { key: string; label: string; unit?: 'cm' | 'kg' }[] = [
  { key: 'peso_atual', label: 'Peso (kg)', unit: 'kg' },
  { key: 'braco_cm', label: 'Braço (cm)' },
  { key: 'busto_cm', label: 'Busto' },
  { key: 'quadril_cm', label: 'Quadril' },
  { key: 'cintura_cm', label: 'Cintura' },
  { key: 'abdomen_inferior_cm', label: 'Abdômen Inferior' },
  { key: 'abdomen_superior_cm', label: 'Abdômen Superior' },
];

export type ProcedureFieldLike = { field_key: string; field_type: string; label: string };

export type SessionLike = {
  id: string;
  session_date: string;
  data: unknown;
  created_at?: string;
  updated_at?: string;
};

function toNum(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateKey(value: string): string {
  const trimmed = String(value ?? '').trim();
  return trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed;
}

function sessionFreshnessMs(session: SessionLike): number {
  const updatedAt = session.updated_at ? Date.parse(session.updated_at) : Number.NaN;
  if (Number.isFinite(updatedAt)) return updatedAt;
  const createdAt = session.created_at ? Date.parse(session.created_at) : Number.NaN;
  if (Number.isFinite(createdAt)) return createdAt;
  return Date.parse(session.session_date);
}

function dedupeSessionsByDatePreferringFirst(sessions: SessionLike[]): SessionLike[] {
  if (sessions.length <= 1) return sessions;
  const byDate = new Map<string, SessionLike>();
  for (const session of sessions) {
    const dateKey = toDateKey(session.session_date);
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, session);
    }
  }
  return Array.from(byDate.values());
}

/** IMC = peso (kg) / (altura em m)². Altura em cm; se entre 0.5 e 3, trata como metros. */
export function calcImc(pesoKg: number | null | undefined, alturaCm: number | null | undefined): number | null {
  if (pesoKg == null || alturaCm == null || pesoKg <= 0 || alturaCm <= 0) return null;
  let altCm = alturaCm;
  if (alturaCm >= 0.5 && alturaCm <= 3) altCm = alturaCm * 100;
  const alturaM = altCm / 100;
  const imc = pesoKg / (alturaM * alturaM);
  const rounded = Math.round(imc * 10) / 10;
  if (rounded < 5 || rounded > 100) return null;
  return rounded;
}

export function getEmagrecimentoFieldLabel(fields: ProcedureFieldLike[], fieldKey: string): string {
  if (fieldKey === 'peso') return 'Peso (kg)';
  if (fieldKey === 'abdomen_superior_cm') return 'Abdômen superior (cm)';
  if (fieldKey === 'cintura_cm') return 'Cintura (cm)';
  if (fieldKey === 'abdomen_inferior_cm') return 'Abdômen inferior (cm)';
  if (fieldKey === 'braco_cm') return 'Braço (cm)';
  if (fieldKey === 'busto_cm') return 'Busto (cm)';
  if (fieldKey === 'quadril_cm') return 'Quadril (cm)';
  return fields.find((f) => f.field_key === fieldKey)?.label ?? fieldKey;
}

export type EmagrecimentoChartPoint = {
  date: string;
  dateLabel: string;
  peso?: number | null;
  [key: string]: string | number | null | undefined;
};

function dedupeChartPointsByDateKeepLast(points: EmagrecimentoChartPoint[]): EmagrecimentoChartPoint[] {
  if (points.length <= 1) return points;
  const byDate = new Map<string, EmagrecimentoChartPoint>();
  for (const point of points) {
    byDate.set(toDateKey(point.date), point);
  }
  return Array.from(byDate.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function buildEmagrecimentoChartPoints(args: {
  numericFields: ProcedureFieldLike[];
  sessions: SessionLike[];
  instanceData: Record<string, unknown>;
  firstSession: SessionLike | null;
  displayStartDate: string | null | undefined;
}): EmagrecimentoChartPoint[] {
  const { numericFields, sessions, instanceData, firstSession, displayStartDate } = args;
  const hasPesoField = numericFields.some((f) => f.field_key === 'peso_inicial' || f.field_key === 'peso_atual');
  const points: EmagrecimentoChartPoint[] = [];
  const firstSessionDateKey = firstSession?.session_date ? toDateKey(firstSession.session_date) : null;
  const displayStartDateKey = displayStartDate ? toDateKey(displayStartDate) : null;
  // Evita projetar o ponto inicial no futuro: se a data de início estiver após a 1a sessão real,
  // usa a data da 1a sessão para não "mover" os dados iniciais para o fim do gráfico.
  const startDate =
    displayStartDateKey && firstSessionDateKey && displayStartDateKey > firstSessionDateKey
      ? firstSessionDateKey
      : (displayStartDateKey ?? undefined);
  const initialData = instanceData;
  const fallbackInitialData = (firstSession?.data as Record<string, unknown>) ?? {};
  const hasInitialData = Object.keys(initialData).length > 0;
  const initialSource = hasInitialData ? initialData : fallbackInitialData;
  const initialDate = startDate ?? firstSession?.session_date;
  if (initialDate) {
    const point: EmagrecimentoChartPoint = {
      date: initialDate,
      dateLabel: format(parseLocalDate(initialDate), 'dd/MM/yy', { locale: ptBR }),
    };
    numericFields.forEach((f) => {
      const key = f.field_key;
      if (key === 'imc') {
        const peso = toNum(initialSource.peso_inicial ?? initialSource.peso_atual);
        const alt = toNum(initialSource.altura_cm);
        const v = calcImc(peso, alt);
        if (v != null) point[key] = v;
      } else if (key === 'peso_inicial' || key === 'peso_atual') {
        const v = toNum(initialSource.peso_inicial ?? initialSource.peso_atual);
        if (v != null) point.peso = v;
      } else {
        const v = toNum(initialSource[key]);
        if (v != null) point[key] = v;
      }
    });
    point.peso = hasPesoField ? toNum(initialSource.peso_inicial ?? initialSource.peso_atual) : undefined;
    points.push(point);
  }
  const uniqueSessions = dedupeSessionsByDatePreferringFirst(sessions);
  const sortedSessions = [...uniqueSessions].sort((a, b) => {
    const dateDiff = new Date(a.session_date).getTime() - new Date(b.session_date).getTime();
    if (dateDiff !== 0) return dateDiff;
    return sessionFreshnessMs(a) - sessionFreshnessMs(b);
  });
  sortedSessions.forEach((s) => {
    if (!hasInitialData && firstSession && s.id === firstSession.id) return;
    const dataObj = (s.data as Record<string, unknown>) ?? {};
    const point: EmagrecimentoChartPoint = {
      date: s.session_date,
      dateLabel: format(parseLocalDate(s.session_date), 'dd/MM/yy', { locale: ptBR }),
    };
    numericFields.forEach((f) => {
      const key = f.field_key;
      if (key === 'imc') {
        const v = calcImc(toNum(dataObj.peso_atual), toNum(dataObj.altura_cm));
        if (v != null) point[key] = v;
      } else if (key === 'peso_inicial' || key === 'peso_atual') {
        const v = toNum(dataObj.peso_atual);
        if (v != null) point.peso = v;
      } else {
        const v = toNum(dataObj[key]);
        if (v != null) point[key] = v;
      }
    });
    point.peso = hasPesoField ? toNum(dataObj.peso_atual) : undefined;
    points.push(point);
  });
  const sorted = points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return dedupeChartPointsByDateKeepLast(sorted);
}

export function buildEmagrecimentoChartSeriesKeys(
  chartData: EmagrecimentoChartPoint[],
  numericFields: ProcedureFieldLike[],
  hasPesoField: boolean
): string[] {
  const keys = new Set<string>();
  numericFields.forEach((f) => {
    const key = f.field_key === 'peso_inicial' || f.field_key === 'peso_atual' ? 'peso' : f.field_key;
    if (key === 'peso') {
      if (hasPesoField) keys.add('peso');
    } else if (chartData.some((d) => d[key] != null && typeof d[key] === 'number')) {
      keys.add(key);
    }
  });
  return Array.from(keys);
}

/** Chaves de composição (gordura / massa magra / músculo) para gráfico empilhado ou multilinhas. */
export function pickCompositionKeys(seriesKeys: string[], numericFields: ProcedureFieldLike[]): string[] {
  const labels = new Map<string, string>();
  numericFields.forEach((f) => {
    const k = f.field_key === 'peso_inicial' || f.field_key === 'peso_atual' ? 'peso' : f.field_key;
    labels.set(k, f.label);
  });
  return seriesKeys.filter((k) => {
    if (k === 'peso' || k === 'imc') return false;
    const lab = (labels.get(k) ?? k).toLowerCase();
    return /gordura|massa|magr|músculo|musculo|visceral|%/.test(lab) || /_pct|percent|pct/i.test(k);
  });
}

const TRONCO_ORDER = [
  'busto_cm',
  'cintura_cm',
  'abdomen_superior_cm',
  'abdomen_inferior_cm',
  'quadril_cm',
  'torax_cm',
  'peito_cm',
] as const;

export function pickTroncoKeys(seriesKeys: string[]): string[] {
  const set = new Set(seriesKeys);
  return TRONCO_ORDER.filter((k) => set.has(k));
}
