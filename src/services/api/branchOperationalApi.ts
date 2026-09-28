import { supabase } from '@/integrations/supabase/client';
import type {
  BranchJourneyEvent,
  BranchJourneyFollowUp,
  BranchOperationalFilters,
  BranchPatientJourney,
  CreateBranchJourneyInput,
  CreateFollowUpInput,
  JourneyStage,
  TransitionJourneyInput,
} from '@/types/branchOperationalJourney';

const JOURNEY_SELECT =
  '*, patients(full_name, phone)';

export async function fetchBranchJourneys(
  branchId: string,
  filters: BranchOperationalFilters = {}
): Promise<BranchPatientJourney[]> {
  let q = supabase
    .from('branch_patient_journeys')
    .select(JOURNEY_SELECT)
    .eq('branch_id', branchId)
    .order('updated_at', { ascending: false });

  if (filters.stage) q = q.eq('current_stage', filters.stage);
  if (filters.assignedUserId) q = q.eq('assigned_user_id', filters.assignedUserId);
  if (filters.captureChannel) q = q.eq('capture_channel', filters.captureChannel);
  if (filters.priority) q = q.eq('priority', filters.priority);
  if (filters.dataInicio) q = q.gte('updated_at', `${filters.dataInicio}T00:00:00`);
  if (filters.dataFim) q = q.lte('updated_at', `${filters.dataFim}T23:59:59`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as BranchPatientJourney[];
}

export async function fetchBranchJourneyById(id: string): Promise<BranchPatientJourney> {
  const { data, error } = await supabase
    .from('branch_patient_journeys')
    .select(JOURNEY_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Jornada não encontrada.');
  return data as BranchPatientJourney;
}

export async function createBranchJourney(
  branchId: string | null,
  input: CreateBranchJourneyInput
): Promise<BranchPatientJourney> {
  const { data, error } = await supabase.rpc('create_branch_patient_journey', {
    p_branch_id: branchId,
    p_patient_id: input.patientId ?? null,
    p_capture_channel: input.captureChannel ?? null,
    p_capture_detail: input.captureDetail ?? null,
    p_lead_name: input.leadName ?? null,
    p_lead_phone: input.leadPhone ?? null,
    p_lead_email: input.leadEmail ?? null,
    p_first_contact_at: input.firstContactAt ?? null,
    p_notes: input.notes ?? null,
    p_assigned_user_id: input.assignedUserId ?? null,
  });
  if (error) throw new Error(error.message);
  return fetchBranchJourneyById(String((data as BranchPatientJourney).id));
}

export async function transitionBranchJourney(input: TransitionJourneyInput): Promise<BranchPatientJourney> {
  const { data, error } = await supabase.rpc('transition_branch_journey_stage', {
    p_journey_id: input.journeyId,
    p_to_stage: input.toStage,
    p_notes: input.notes ?? null,
    p_payload: input.payload ?? {},
  });
  if (error) throw new Error(error.message);
  return fetchBranchJourneyById(String((data as BranchPatientJourney).id));
}

export async function updateBranchJourneyFields(
  journeyId: string,
  patch: Partial<
    Pick<
      BranchPatientJourney,
      | 'patient_id'
      | 'appointment_id'
      | 'budget_quote_id'
      | 'procedure_instance_id'
      | 'no_show_reason'
      | 'no_schedule_reason'
      | 'no_close_reason'
      | 'satisfaction'
      | 'satisfaction_notes'
      | 'notes'
      | 'priority'
    >
  >
): Promise<void> {
  const { error } = await supabase
    .from('branch_patient_journeys')
    .update(patch)
    .eq('id', journeyId);
  if (error) throw new Error(error.message);
}

export async function fetchJourneyEvents(journeyId: string): Promise<BranchJourneyEvent[]> {
  const { data, error } = await supabase
    .from('branch_journey_events')
    .select('*')
    .eq('journey_id', journeyId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as BranchJourneyEvent[];
}

export async function fetchJourneyFollowUps(journeyId: string): Promise<BranchJourneyFollowUp[]> {
  const { data, error } = await supabase
    .from('branch_journey_follow_ups')
    .select('*')
    .eq('journey_id', journeyId)
    .order('due_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BranchJourneyFollowUp[];
}

export async function fetchBranchFollowUps(branchId: string): Promise<BranchJourneyFollowUp[]> {
  const { data, error } = await supabase
    .from('branch_journey_follow_ups')
    .select('*')
    .eq('branch_id', branchId)
    .in('status', ['pending', 'overdue'])
    .order('due_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BranchJourneyFollowUp[];
}

export async function createJourneyFollowUp(input: CreateFollowUpInput): Promise<BranchJourneyFollowUp> {
  const { data, error } = await supabase.rpc('create_branch_journey_follow_up', {
    p_journey_id: input.journeyId,
    p_due_at: input.dueAt,
    p_reason: input.reason,
    p_priority: input.priority ?? 'normal',
    p_assigned_user_id: input.assignedUserId ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) throw new Error(error.message);
  return data as BranchJourneyFollowUp;
}

export async function completeFollowUp(followUpId: string): Promise<void> {
  const { error } = await supabase
    .from('branch_journey_follow_ups')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', followUpId);
  if (error) throw new Error(error.message);
}

export async function linkPatientToJourney(journeyId: string, patientId: string): Promise<void> {
  await updateBranchJourneyFields(journeyId, { patient_id: patientId });
  await transitionBranchJourney({
    journeyId,
    toStage: 'cadastro_inicial' as JourneyStage,
    notes: 'Paciente vinculado ao cadastro existente',
  });
}

export async function findJourneysByPatientInBranch(
  branchId: string,
  patientId: string
): Promise<BranchPatientJourney[]> {
  const { data, error } = await supabase
    .from('branch_patient_journeys')
    .select(JOURNEY_SELECT)
    .eq('branch_id', branchId)
    .eq('patient_id', patientId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as BranchPatientJourney[];
}
