import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import {
  linesToJson,
  parseBudgetPaymentMethod,
  parseBudgetQuoteStatus,
  parseLinesFromJson,
  parseTreatmentTimeUnit,
  type BudgetPaymentMethod,
  type BudgetQuoteLine,
  type BudgetQuoteStatus,
  type BudgetTreatmentTimeUnit,
} from '@/lib/budgetQuote';

export type BudgetQuoteRow = {
  id: string;
  professional_id: string;
  patient_id: string;
  title: string | null;
  notes: string | null;
  treatment_time: number | null;
  treatment_time_unit: BudgetTreatmentTimeUnit | null;
  status: BudgetQuoteStatus;
  responded_at: string | null;
  patient_payment_day: number | null;
  patient_payment_method: BudgetPaymentMethod | null;
  accepted_treatment_time: number | null;
  accepted_treatment_time_unit: BudgetTreatmentTimeUnit | null;
  schedule_start_month: string | null;
  lines: Json;
  created_at: string;
  updated_at: string;
  patients?: { full_name: string | null; phone: string | null } | null;
};

export type BudgetQuotePaymentRow = {
  id: string;
  budget_quote_id: string;
  mes_referencia: string;
  valor: number;
  data_pagamento: string | null;
  created_at: string;
};

function mapQuoteRow(row: Record<string, unknown>): BudgetQuoteRow {
  return {
    id: String(row.id),
    professional_id: String(row.professional_id),
    patient_id: String(row.patient_id),
    title: typeof row.title === 'string' ? row.title : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
    treatment_time:
      typeof row.treatment_time === 'number'
        ? row.treatment_time
        : row.treatment_time != null
          ? Number(row.treatment_time)
          : null,
    treatment_time_unit: parseTreatmentTimeUnit(row.treatment_time_unit),
    status: parseBudgetQuoteStatus(row.status),
    responded_at: typeof row.responded_at === 'string' ? row.responded_at : null,
    patient_payment_day:
      typeof row.patient_payment_day === 'number'
        ? row.patient_payment_day
        : row.patient_payment_day != null
          ? Number(row.patient_payment_day)
          : null,
    patient_payment_method: parseBudgetPaymentMethod(row.patient_payment_method),
    accepted_treatment_time:
      typeof row.accepted_treatment_time === 'number'
        ? row.accepted_treatment_time
        : row.accepted_treatment_time != null
          ? Number(row.accepted_treatment_time)
          : null,
    accepted_treatment_time_unit: parseTreatmentTimeUnit(row.accepted_treatment_time_unit),
    schedule_start_month: typeof row.schedule_start_month === 'string' ? row.schedule_start_month : null,
    lines: (row.lines as Json) ?? [],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    patients:
      row.patients && typeof row.patients === 'object'
        ? {
            full_name:
              typeof (row.patients as { full_name?: unknown }).full_name === 'string'
                ? (row.patients as { full_name: string }).full_name
                : null,
            phone:
              typeof (row.patients as { phone?: unknown }).phone === 'string'
                ? (row.patients as { phone: string }).phone
                : null,
          }
        : null,
  };
}

export async function fetchBudgetQuotesForProfessional(professionalId: string): Promise<BudgetQuoteRow[]> {
  const { data, error } = await supabase
    .from('budget_quotes')
    .select('*, patients:patient_id(full_name, phone)')
    .eq('professional_id', professionalId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapQuoteRow(r as Record<string, unknown>));
}

export async function fetchBudgetQuote(id: string): Promise<BudgetQuoteRow | null> {
  const { data, error } = await supabase.from('budget_quotes').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapQuoteRow(data as Record<string, unknown>);
}

export async function createBudgetQuote(params: {
  professionalId: string;
  patientId: string;
  title?: string | null;
  notes?: string | null;
  treatmentTime?: number | null;
  treatmentTimeUnit?: BudgetTreatmentTimeUnit | null;
  lines: BudgetQuoteLine[];
}): Promise<BudgetQuoteRow> {
  const hasTime =
    params.treatmentTime != null &&
    Number.isInteger(params.treatmentTime) &&
    params.treatmentTime > 0 &&
    (params.treatmentTimeUnit === 'meses' || params.treatmentTimeUnit === 'sessoes');
  const { data, error } = await supabase
    .from('budget_quotes')
    .insert({
      professional_id: params.professionalId,
      patient_id: params.patientId,
      title: params.title?.trim() || null,
      notes: params.notes?.trim() || null,
      treatment_time: hasTime ? params.treatmentTime! : null,
      treatment_time_unit: hasTime ? params.treatmentTimeUnit! : null,
      lines: linesToJson(params.lines),
      status: 'open',
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapQuoteRow(data as Record<string, unknown>);
}

export async function updateBudgetQuote(params: {
  id: string;
  patientId: string;
  title?: string | null;
  notes?: string | null;
  treatmentTime?: number | null;
  treatmentTimeUnit?: BudgetTreatmentTimeUnit | null;
  lines: BudgetQuoteLine[];
}): Promise<void> {
  const hasTime =
    params.treatmentTime != null &&
    Number.isInteger(params.treatmentTime) &&
    params.treatmentTime > 0 &&
    (params.treatmentTimeUnit === 'meses' || params.treatmentTimeUnit === 'sessoes');
  const { error } = await supabase
    .from('budget_quotes')
    .update({
      patient_id: params.patientId,
      title: params.title?.trim() || null,
      notes: params.notes?.trim() || null,
      treatment_time: hasTime ? params.treatmentTime! : null,
      treatment_time_unit: hasTime ? params.treatmentTimeUnit! : null,
      lines: linesToJson(params.lines),
    })
    .eq('id', params.id);
  if (error) throw error;
}

export async function deleteBudgetQuote(id: string): Promise<void> {
  // Reabre planos odontológicos em negociação (trigger no banco reforça após migration).
  try {
    const { data: linkedPlans } = await (supabase as any)
      .from('dental_treatment_plans')
      .select('id, authorization_code')
      .eq('budget_quote_id', id)
      .eq('status', 'negotiating');

    for (const plan of (linkedPlans ?? []) as Array<{
      id: string;
      authorization_code: string | null;
    }>) {
      const nextStatus =
        plan.authorization_code && plan.authorization_code.trim() !== ''
          ? 'authorized'
          : 'open';
      await (supabase as any)
        .from('dental_treatment_plans')
        .update({ budget_quote_id: null, status: nextStatus })
        .eq('id', plan.id);
    }
  } catch (e) {
    console.warn('dental_treatment_plans cleanup:', e);
  }

  const { error } = await supabase.from('budget_quotes').delete().eq('id', id);
  if (error) throw error;
}

export async function ensureBudgetQuotePublicSlug(budgetQuoteId: string): Promise<string> {
  const { data, error } = await supabase.rpc('ensure_budget_quote_public_link', {
    p_budget_quote_id: budgetQuoteId,
  });
  if (error) throw error;
  const slug = typeof data === 'string' ? data : null;
  if (!slug) throw new Error('Slug não retornado');
  return slug;
}

export function getLinesFromRow(row: BudgetQuoteRow): BudgetQuoteLine[] {
  return parseLinesFromJson(row.lines);
}

export async function fetchBudgetQuotePayments(budgetQuoteId: string): Promise<BudgetQuotePaymentRow[]> {
  const { data, error } = await supabase
    .from('budget_quote_payments')
    .select('*')
    .eq('budget_quote_id', budgetQuoteId)
    .order('mes_referencia', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: String(r.id),
    budget_quote_id: String(r.budget_quote_id),
    mes_referencia: String(r.mes_referencia),
    valor: Number(r.valor),
    data_pagamento: r.data_pagamento ? String(r.data_pagamento) : null,
    created_at: String(r.created_at),
  }));
}

export async function markBudgetQuotePaymentPaid(paymentId: string): Promise<void> {
  const { error } = await supabase
    .from('budget_quote_payments')
    .update({ data_pagamento: new Date().toISOString() })
    .eq('id', paymentId);
  if (error) throw error;
}

export async function unmarkBudgetQuotePaymentPaid(paymentId: string): Promise<void> {
  const { error } = await supabase
    .from('budget_quote_payments')
    .update({ data_pagamento: null })
    .eq('id', paymentId);
  if (error) throw error;
}

export async function publicRejectBudgetQuote(slug: string): Promise<void> {
  const { error } = await supabase.rpc('public_reject_budget_quote', { p_slug: slug });
  if (error) throw error;
}

export async function publicAcceptBudgetQuote(params: {
  slug: string;
  paymentDay: number;
  paymentMethod: BudgetPaymentMethod;
  treatmentTime: number;
  treatmentTimeUnit: BudgetTreatmentTimeUnit;
}): Promise<void> {
  const { error } = await supabase.rpc('public_accept_budget_quote', {
    p_slug: params.slug,
    p_payment_day: params.paymentDay,
    p_payment_method: params.paymentMethod,
    p_treatment_time: params.treatmentTime,
    p_treatment_time_unit: params.treatmentTimeUnit,
  });
  if (error) throw error;
}
