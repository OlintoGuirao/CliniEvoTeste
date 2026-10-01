import { supabase } from '@/integrations/supabase/client';

export type ClinicProcedureSessionStatus = 'draft' | 'in_progress' | 'finished' | 'cancelled';
export type ClinicProcedureSignatureStatus = 'none' | 'pending' | 'signed';

export type ClinicProcedureSessionRow = {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  treatment_plan_id: string | null;
  plan_item_id: string | null;
  professional_id: string;
  status: ClinicProcedureSessionStatus;
  observations: string | null;
  clinical_analysis: string | null;
  clinical_conclusion: string | null;
  signature_status: ClinicProcedureSignatureStatus;
  signature_requested_at: string | null;
  signature_signed_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

const db = () => supabase as unknown as { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function listClinicProcedureSessionsForPatient(
  patientId: string
): Promise<ClinicProcedureSessionRow[]> {
  const { data, error } = await db()
    .from('clinic_procedure_sessions')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClinicProcedureSessionRow[];
}

export async function listClinicProcedureSessionsForPlanItem(
  planItemId: string
): Promise<ClinicProcedureSessionRow[]> {
  const { data, error } = await db()
    .from('clinic_procedure_sessions')
    .select('*')
    .eq('plan_item_id', planItemId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClinicProcedureSessionRow[];
}

export async function getClinicProcedureSession(
  sessionId: string
): Promise<ClinicProcedureSessionRow | null> {
  const { data, error } = await db()
    .from('clinic_procedure_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return (data as ClinicProcedureSessionRow | null) ?? null;
}

export async function findOpenClinicProcedureSession(params: {
  patientId: string;
  planItemId: string;
}): Promise<ClinicProcedureSessionRow | null> {
  const { data, error } = await db()
    .from('clinic_procedure_sessions')
    .select('*')
    .eq('patient_id', params.patientId)
    .eq('plan_item_id', params.planItemId)
    .in('status', ['draft', 'in_progress'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ClinicProcedureSessionRow | null) ?? null;
}

export async function createClinicProcedureSession(params: {
  patientId: string;
  professionalId: string;
  appointmentId?: string | null;
  treatmentPlanId?: string | null;
  planItemId?: string | null;
  observations?: string | null;
  clinicalAnalysis?: string | null;
  clinicalConclusion?: string | null;
  status?: ClinicProcedureSessionStatus;
}): Promise<ClinicProcedureSessionRow> {
  const status = params.status ?? 'draft';
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from('clinic_procedure_sessions')
    .insert({
      patient_id: params.patientId,
      professional_id: params.professionalId,
      appointment_id: params.appointmentId ?? null,
      treatment_plan_id: params.treatmentPlanId ?? null,
      plan_item_id: params.planItemId ?? null,
      observations: params.observations?.trim() || null,
      clinical_analysis: params.clinicalAnalysis?.trim() || null,
      clinical_conclusion: params.clinicalConclusion?.trim() || null,
      status,
      started_at: status === 'in_progress' || status === 'finished' ? now : null,
      finished_at: status === 'finished' ? now : null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ClinicProcedureSessionRow;
}

export async function updateClinicProcedureSession(
  sessionId: string,
  patch: Partial<{
    observations: string | null;
    clinical_analysis: string | null;
    clinical_conclusion: string | null;
    status: ClinicProcedureSessionStatus;
    signature_status: ClinicProcedureSignatureStatus;
    signature_requested_at: string | null;
    signature_signed_at: string | null;
    appointment_id: string | null;
    started_at: string | null;
    finished_at: string | null;
  }>
): Promise<ClinicProcedureSessionRow> {
  const { data, error } = await db()
    .from('clinic_procedure_sessions')
    .update(patch)
    .eq('id', sessionId)
    .select('*')
    .single();
  if (error) throw error;
  return data as ClinicProcedureSessionRow;
}
