import type { Json } from '@/integrations/supabase/types';

export type BudgetQuoteLine = {
  procedure_id: string;
  procedure_name: string;
  quantity: number;
  unit_price: number;
  /** Tipo de preço da clínica (só contas clinic). */
  price_tier?: 'oficial' | 'particular' | 'parcerias' | 'funcionarios' | 'convenio';
};

export type BudgetTreatmentTimeUnit = 'meses' | 'sessoes';
export type BudgetQuoteStatus = 'open' | 'accepted' | 'rejected';
export type BudgetPaymentMethod = 'dinheiro' | 'cartao' | 'pix';

export type BudgetQuotePublicPayload = {
  title: string | null;
  notes: string | null;
  treatment_time: number | null;
  treatment_time_unit: BudgetTreatmentTimeUnit | null;
  status: BudgetQuoteStatus;
  responded_at: string | null;
  lines: BudgetQuoteLine[];
  updated_at: string;
  patient: { full_name: string | null } | null;
  professional: {
    full_name: string | null;
    app_name: string | null;
    accent_color: string | null;
    theme_palette: string | null;
    app_logo_url: string | null;
  } | null;
};

export const BUDGET_PAYMENT_METHOD_LABELS: Record<BudgetPaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'PIX',
};

export function formatTreatmentTimeLabel(
  value: number | null | undefined,
  unit: BudgetTreatmentTimeUnit | null | undefined
): string | null {
  if (value == null || !Number.isInteger(value) || value < 1 || !unit) return null;
  if (unit === 'meses') return value === 1 ? '1 mês' : `${value} meses`;
  return value === 1 ? '1 sessão' : `${value} sessões`;
}

export function parseTreatmentTimeUnit(raw: unknown): BudgetTreatmentTimeUnit | null {
  return raw === 'meses' || raw === 'sessoes' ? raw : null;
}

export function parseBudgetQuoteStatus(raw: unknown): BudgetQuoteStatus {
  if (raw === 'accepted' || raw === 'rejected' || raw === 'open') return raw;
  return 'open';
}

export function parseBudgetPaymentMethod(raw: unknown): BudgetPaymentMethod | null {
  return raw === 'dinheiro' || raw === 'cartao' || raw === 'pix' ? raw : null;
}

/** YYYY-MM da 1ª parcela a partir da data de aceite e dia preferido (1–28). */
export function computeScheduleStartMonth(acceptedAt: Date, paymentDay: number): string {
  const day = Math.min(28, Math.max(1, Math.floor(paymentDay)));
  const y = acceptedAt.getFullYear();
  const m = acceptedAt.getMonth(); // 0-based
  const acceptDay = acceptedAt.getDate();
  let yy = y;
  let mm = m;
  if (acceptDay >= day) {
    mm += 1;
    if (mm > 11) {
      mm = 0;
      yy += 1;
    }
  }
  return `${yy}-${String(mm + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(mesKey: string): string {
  const [ys, ms] = mesKey.split('-');
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return mesKey;
  const d = new Date(y, m - 1, 1);
  const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function lineTotal(line: Pick<BudgetQuoteLine, 'quantity' | 'unit_price'>): number {
  const q = Number(line.quantity);
  const u = Number(line.unit_price);
  if (!Number.isFinite(q) || !Number.isFinite(u)) return 0;
  return Math.round(q * u * 100) / 100;
}

export function grandTotal(lines: BudgetQuoteLine[]): number {
  const t = lines.reduce((acc, l) => acc + lineTotal(l), 0);
  return Math.round(t * 100) / 100;
}

export function formatBrl(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function emptyLine(): BudgetQuoteLine {
  return { procedure_id: '', procedure_name: '', quantity: 1, unit_price: 0 };
}

export function normalizeLinesForSave(lines: BudgetQuoteLine[]): BudgetQuoteLine[] {
  return lines
    .filter((l) => l.procedure_id.trim().length > 0)
    .map((l) => {
      const base: BudgetQuoteLine = {
        procedure_id: l.procedure_id.trim(),
        procedure_name: (l.procedure_name || '').trim() || 'Procedimento',
        quantity: Math.max(0.01, Number(l.quantity) || 1),
        unit_price: Math.max(0, Math.round((Number(l.unit_price) || 0) * 100) / 100),
      };
      if (l.price_tier) base.price_tier = l.price_tier;
      return base;
    });
}

export function linesToJson(lines: BudgetQuoteLine[]): Json {
  return JSON.parse(JSON.stringify(lines)) as Json;
}

export function parseLinesFromJson(raw: Json | null | undefined): BudgetQuoteLine[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: BudgetQuoteLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const procedure_id = typeof o.procedure_id === 'string' ? o.procedure_id : '';
    const procedure_name = typeof o.procedure_name === 'string' ? o.procedure_name : '';
    const quantity = typeof o.quantity === 'number' ? o.quantity : Number(o.quantity) || 1;
    const unit_price = typeof o.unit_price === 'number' ? o.unit_price : Number(o.unit_price) || 0;
    const tierRaw = typeof o.price_tier === 'string' ? o.price_tier : '';
    const price_tier =
      tierRaw === 'oficial' ||
      tierRaw === 'particular' ||
      tierRaw === 'parcerias' ||
      tierRaw === 'funcionarios' ||
      tierRaw === 'convenio'
        ? tierRaw
        : undefined;
    out.push({
      procedure_id,
      procedure_name,
      quantity,
      unit_price,
      ...(price_tier ? { price_tier } : {}),
    });
  }
  return out;
}

export function parsePublicPayload(raw: Json): BudgetQuotePublicPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const lines = parseLinesFromJson(o.lines as Json);
  const patient = o.patient && typeof o.patient === 'object' ? (o.patient as { full_name: string | null }) : null;
  const professional =
    o.professional && typeof o.professional === 'object'
      ? (o.professional as BudgetQuotePublicPayload['professional'])
      : null;
  const updated_at = typeof o.updated_at === 'string' ? o.updated_at : '';
  return {
    title: typeof o.title === 'string' ? o.title : null,
    notes: typeof o.notes === 'string' ? o.notes : null,
    treatment_time: (() => {
      const n = typeof o.treatment_time === 'number' ? o.treatment_time : Number(o.treatment_time);
      return Number.isInteger(n) && n > 0 ? n : null;
    })(),
    treatment_time_unit: parseTreatmentTimeUnit(o.treatment_time_unit),
    status: parseBudgetQuoteStatus(o.status),
    responded_at: typeof o.responded_at === 'string' ? o.responded_at : null,
    lines,
    updated_at,
    patient,
    professional,
  };
}
