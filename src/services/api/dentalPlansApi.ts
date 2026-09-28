import { supabase } from '@/integrations/supabase/client';
import {
  calcDentalItemTotal,
  generateDentalAuthorizationCode,
} from '@/lib/dentalPlanCalc';
import type { DentalSelectionLocation, DentalSelectionType } from '@/lib/dentalSelection';
import type { DentalToothCondition } from '@/lib/dentalFdi';
import type { ClinicPriceTier } from '@/lib/clinicPriceTiers';

export type DentalPlanStatus = 'open' | 'authorized' | 'negotiating' | 'finished' | 'cancelled';
export type DentalPlanItemStatus = 'pending' | 'authorized' | 'rejected' | 'done';

export type DentalTreatmentPlanRow = {
  id: string;
  patient_id: string;
  professional_id: string;
  responsible_professional_id: string;
  created_by: string;
  name: string;
  plan_type: string;
  origin: string | null;
  description: string | null;
  status: DentalPlanStatus;
  authorization_code: string | null;
  authorized_at: string | null;
  budget_quote_id: string | null;
  discount_type: 'percent' | 'amount' | null;
  discount_value: number;
  surcharge_type: 'percent' | 'amount' | null;
  surcharge_value: number;
  payment_terms: string | null;
  commercial_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DentalPlanItemRow = {
  id: string;
  treatment_plan_id: string;
  procedure_id: string | null;
  procedure_name: string;
  specialty: string | null;
  price_table: string;
  selection_type: DentalSelectionType;
  quantity: number;
  unit_price: number;
  discount_type: 'percent' | 'amount' | null;
  discount_value: number;
  surcharge_type: 'percent' | 'amount' | null;
  surcharge_value: number;
  total_value: number;
  status: DentalPlanItemStatus;
  notes: string | null;
  sort_order: number;
};

export type DentalPlanItemLocationRow = {
  id: string;
  plan_item_id: string;
  tooth_number: string | null;
  tooth_type: 'permanent' | 'deciduous' | null;
  face: string | null;
  root: string | null;
  region: string | null;
};

export type DentalToothConditionRow = {
  id: string;
  patient_id: string;
  tooth_number: string;
  condition: DentalToothCondition;
  updated_by: string;
  updated_at: string;
};

const db = () => supabase as unknown as { from: (table: string) => any };

export async function listDentalPlansForPatient(patientId: string): Promise<DentalTreatmentPlanRow[]> {
  const { data, error } = await db()
    .from('dental_treatment_plans')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DentalTreatmentPlanRow[];
}

export async function getDentalPlan(planId: string): Promise<DentalTreatmentPlanRow | null> {
  const { data, error } = await db()
    .from('dental_treatment_plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle();
  if (error) throw error;
  return (data as DentalTreatmentPlanRow | null) ?? null;
}

export async function createDentalPlan(params: {
  patientId: string;
  professionalId: string;
  responsibleProfessionalId: string;
  createdBy: string;
  name: string;
  planType?: string;
  origin?: string | null;
  description?: string | null;
}): Promise<DentalTreatmentPlanRow> {
  const { data, error } = await db()
    .from('dental_treatment_plans')
    .insert({
      patient_id: params.patientId,
      professional_id: params.professionalId,
      responsible_professional_id: params.responsibleProfessionalId,
      created_by: params.createdBy,
      name: params.name.trim(),
      plan_type: params.planType?.trim() || 'odontologico',
      origin: params.origin?.trim() || null,
      description: params.description?.trim() || null,
      status: 'open',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as DentalTreatmentPlanRow;
}

export async function updateDentalPlan(
  planId: string,
  patch: Partial<{
    name: string;
    origin: string | null;
    description: string | null;
    status: DentalPlanStatus;
    responsible_professional_id: string;
    discount_type: 'percent' | 'amount' | null;
    discount_value: number;
    surcharge_type: 'percent' | 'amount' | null;
    surcharge_value: number;
    payment_terms: string | null;
    commercial_notes: string | null;
    budget_quote_id: string | null;
  }>
): Promise<DentalTreatmentPlanRow> {
  const { data, error } = await db()
    .from('dental_treatment_plans')
    .update(patch)
    .eq('id', planId)
    .select('*')
    .single();
  if (error) throw error;
  return data as DentalTreatmentPlanRow;
}

export async function listDentalPlanItems(planId: string): Promise<{
  items: DentalPlanItemRow[];
  locations: DentalPlanItemLocationRow[];
}> {
  const { data: items, error } = await db()
    .from('dental_plan_items')
    .select('*')
    .eq('treatment_plan_id', planId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  const itemRows = (items ?? []) as DentalPlanItemRow[];
  if (itemRows.length === 0) return { items: [], locations: [] };

  const { data: locations, error: locErr } = await db()
    .from('dental_plan_item_locations')
    .select('*')
    .in(
      'plan_item_id',
      itemRows.map((i) => i.id)
    );
  if (locErr) throw locErr;
  return { items: itemRows, locations: (locations ?? []) as DentalPlanItemLocationRow[] };
}

export async function addDentalPlanItem(params: {
  planId: string;
  procedureId?: string | null;
  procedureName: string;
  specialty?: string | null;
  priceTable: ClinicPriceTier | string;
  selectionType: DentalSelectionType;
  quantity: number;
  unitPrice: number;
  discountType?: 'percent' | 'amount' | null;
  discountValue?: number;
  surchargeType?: 'percent' | 'amount' | null;
  surchargeValue?: number;
  notes?: string | null;
  locations: DentalSelectionLocation[];
  sortOrder?: number;
}): Promise<DentalPlanItemRow> {
  const discount_type = params.discountType ?? null;
  const discount_value = Number(params.discountValue) || 0;
  const surcharge_type = params.surchargeType ?? null;
  const surcharge_value = Number(params.surchargeValue) || 0;
  const total = calcDentalItemTotal({
    quantity: params.quantity,
    unitPrice: params.unitPrice,
    discountType: discount_type,
    discountValue: discount_value,
    surchargeType: surcharge_type,
    surchargeValue: surcharge_value,
  });
  const { data: item, error } = await db()
    .from('dental_plan_items')
    .insert({
      treatment_plan_id: params.planId,
      procedure_id: params.procedureId ?? null,
      procedure_name: params.procedureName.trim(),
      specialty: params.specialty?.trim() || null,
      price_table: params.priceTable,
      selection_type: params.selectionType,
      quantity: params.quantity,
      unit_price: params.unitPrice,
      discount_type,
      discount_value,
      surcharge_type,
      surcharge_value,
      total_value: total,
      status: 'pending',
      notes: params.notes?.trim() || null,
      sort_order: params.sortOrder ?? 0,
    })
    .select('*')
    .single();
  if (error) throw error;

  const itemRow = item as DentalPlanItemRow;
  if (params.locations.length > 0) {
    const rows = params.locations.map((loc) => ({
      plan_item_id: itemRow.id,
      tooth_number: loc.toothNumber ?? null,
      tooth_type: null,
      face: loc.face ?? null,
      root: loc.root ?? null,
      region: loc.region ?? null,
    }));
    const { error: locErr } = await db().from('dental_plan_item_locations').insert(rows);
    if (locErr) throw locErr;
  }
  return itemRow;
}

export async function deleteDentalPlan(planId: string): Promise<void> {
  const { error } = await db().from('dental_treatment_plans').delete().eq('id', planId);
  if (error) throw error;
}

export async function deleteDentalPlanItem(itemId: string): Promise<void> {
  const { error } = await db().from('dental_plan_items').delete().eq('id', itemId);
  if (error) throw error;
}

export async function updateDentalPlanItem(
  itemId: string,
  patch: Partial<{
    quantity: number;
    unit_price: number;
    discount_type: 'percent' | 'amount' | null;
    discount_value: number;
    surcharge_type: 'percent' | 'amount' | null;
    surcharge_value: number;
    notes: string | null;
    status: DentalPlanItemStatus;
    specialty: string | null;
    procedure_id: string | null;
    procedure_name: string;
  }>
): Promise<DentalPlanItemRow> {
  const { data: current, error: curErr } = await db()
    .from('dental_plan_items')
    .select('*')
    .eq('id', itemId)
    .single();
  if (curErr) throw curErr;
  const row = current as DentalPlanItemRow;
  const quantity = patch.quantity ?? row.quantity;
  const unit_price = patch.unit_price ?? Number(row.unit_price);
  const discount_type =
    patch.discount_type !== undefined ? patch.discount_type : row.discount_type;
  const discount_value =
    patch.discount_value !== undefined ? patch.discount_value : Number(row.discount_value);
  const surcharge_type =
    patch.surcharge_type !== undefined ? patch.surcharge_type : row.surcharge_type;
  const surcharge_value =
    patch.surcharge_value !== undefined ? patch.surcharge_value : Number(row.surcharge_value);
  const total_value = calcDentalItemTotal({
    quantity,
    unitPrice: unit_price,
    discountType: discount_type,
    discountValue: discount_value,
    surchargeType: surcharge_type,
    surchargeValue: surcharge_value,
  });
  const { data, error } = await db()
    .from('dental_plan_items')
    .update({
      ...patch,
      quantity,
      unit_price,
      discount_type,
      discount_value,
      surcharge_type,
      surcharge_value,
      total_value,
    })
    .eq('id', itemId)
    .select('*')
    .single();
  if (error) throw error;
  return data as DentalPlanItemRow;
}

export async function listPatientToothConditions(
  patientId: string
): Promise<DentalToothConditionRow[]> {
  const { data, error } = await db()
    .from('dental_tooth_conditions')
    .select('*')
    .eq('patient_id', patientId);
  if (error) throw error;
  return (data ?? []) as DentalToothConditionRow[];
}

export async function upsertPatientToothConditions(params: {
  patientId: string;
  updatedBy: string;
  teeth: string[];
  condition: DentalToothCondition;
}): Promise<void> {
  const rows = params.teeth.map((tooth) => ({
    patient_id: params.patientId,
    tooth_number: tooth,
    condition: params.condition,
    updated_by: params.updatedBy,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await db()
    .from('dental_tooth_conditions')
    .upsert(rows, { onConflict: 'patient_id,tooth_number' });
  if (error) throw error;
}

export async function requestDentalPlanAuthorization(planId: string): Promise<DentalTreatmentPlanRow> {
  const code = generateDentalAuthorizationCode();
  const { data, error } = await db()
    .from('dental_treatment_plans')
    .update({
      status: 'authorized',
      authorization_code: code,
      authorized_at: new Date().toISOString(),
    })
    .eq('id', planId)
    .select('*')
    .single();
  if (error) throw error;
  return data as DentalTreatmentPlanRow;
}

/** Cria orçamento comercial a partir do plano e marca status negotiating. */
export async function sendDentalPlanToNegotiation(params: {
  planId: string;
  professionalId: string;
  patientId: string;
  planName: string;
  notes?: string | null;
  items: Array<{
    id: string;
    procedure_id: string | null;
    procedure_name: string;
    quantity: number;
    unit_price: number;
    total_value: number;
    price_table: string;
  }>;
}): Promise<{ plan: DentalTreatmentPlanRow; budgetQuoteId: string }> {
  const { createBudgetQuote } = await import('@/services/api/budgetQuotesApi');
  const lines = params.items.map((item) => ({
    procedure_id: item.procedure_id?.trim() || `dental:${item.id}`,
    procedure_name: item.procedure_name,
    quantity: item.quantity,
    unit_price: Number(item.unit_price) || 0,
    price_tier: (['oficial', 'particular', 'parcerias', 'funcionarios', 'convenio'].includes(
      item.price_table
    )
      ? item.price_table
      : 'particular') as
      | 'oficial'
      | 'particular'
      | 'parcerias'
      | 'funcionarios'
      | 'convenio',
  }));

  const quote = await createBudgetQuote({
    professionalId: params.professionalId,
    patientId: params.patientId,
    title: params.planName,
    notes: params.notes ?? `Plano odontológico: ${params.planName}`,
    lines,
  });

  const plan = await updateDentalPlan(params.planId, {
    status: 'negotiating',
    budget_quote_id: quote.id,
  });

  return { plan, budgetQuoteId: quote.id };
}
