import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS } from '@/api/queryKeys';
import { isClinicOnlyAccount } from '@/lib/accountType';
import {
  isClinicFrontDeskStaffTitle,
  resolveStaffTitleFromStorage,
} from '@/lib/clinicTeamRoles';

export const PATIENTS_QUERY_KEY = QUERY_KEYS.patients;

export interface PatientRow {
  id: string;
  full_name: string;
  nickname?: string | null;
  phone: string | null;
  date_of_birth: string | null;
  sex: string | null;
  profile_photo_url: string | null;
  treatment_start_date: string | null;
  is_active: boolean;
  created_at: string;
  registration_completed_at: string | null;
  professional_id?: string;
}

function sortPatientsByCreatedAtDesc(rows: PatientRow[]): PatientRow[] {
  return [...rows].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}

async function isClinicOpsMember(professionalId: string): Promise<boolean> {
  const { data: member } = await (supabase as any)
    .from('organization_members')
    .select('role, staff_title')
    .eq('user_id', professionalId)
    .limit(1)
    .maybeSingle();

  if (!member) return false;
  if (member.role === 'owner') return true;

  const staffTitleId = resolveStaffTitleFromStorage(member.staff_title).staffTitle || null;
  return isClinicFrontDeskStaffTitle(staffTitleId);
}

/**
 * Clínica: paciente “vinculado” ao profissional = `patients.professional_id`
 * (profissional responsável no cadastro) OU já teve consulta/atendimento/plano
 * odontológico com ele. Master/recepção vê todos os pacientes da clínica.
 */
async function fetchClinicPatients(professionalId: string): Promise<PatientRow[]> {
  if (await isClinicOpsMember(professionalId)) {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as PatientRow[];
  }

  const [ownedRes, apptRes, instRes] = await Promise.all([
    supabase.from('patients').select('*').eq('professional_id', professionalId),
    supabase
      .from('appointments')
      .select('patient_id')
      .eq('professional_id', professionalId)
      .not('patient_id', 'is', null),
    supabase.from('procedure_instances').select('patient_id').eq('professional_id', professionalId),
  ]);

  if (ownedRes.error) throw ownedRes.error;
  if (apptRes.error) throw apptRes.error;
  if (instRes.error) throw instRes.error;

  const byId = new Map<string, PatientRow>();
  for (const row of ownedRes.data ?? []) {
    byId.set(String(row.id), row as PatientRow);
  }

  const linkedIds = new Set<string>();
  for (const row of apptRes.data ?? []) {
    if (row.patient_id) linkedIds.add(String(row.patient_id));
  }
  for (const row of instRes.data ?? []) {
    if (row.patient_id) linkedIds.add(String(row.patient_id));
  }

  try {
    const dentalRes = await (supabase as any)
      .from('dental_treatment_plans')
      .select('patient_id')
      .or(`professional_id.eq.${professionalId},responsible_professional_id.eq.${professionalId}`);
    if (!dentalRes.error) {
      for (const row of (dentalRes.data ?? []) as Array<{ patient_id?: string | null }>) {
        if (row.patient_id) linkedIds.add(String(row.patient_id));
      }
    }
  } catch {
    // migration odontológica ainda não aplicada
  }

  const missingIds = [...linkedIds].filter((id) => !byId.has(id));
  if (missingIds.length > 0) {
    const { data: extra, error: extraError } = await supabase
      .from('patients')
      .select('*')
      .in('id', missingIds);
    if (extraError) throw extraError;
    for (const row of extra ?? []) {
      byId.set(String(row.id), row as PatientRow);
    }
  }

  return sortPatientsByCreatedAtDesc([...byId.values()]);
}

export async function fetchPatients(professionalId: string): Promise<PatientRow[]> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('account_type')
    .eq('id', professionalId)
    .maybeSingle();
  if (profileError) throw profileError;

  if (isClinicOnlyAccount(profile?.account_type)) {
    return fetchClinicPatients(professionalId);
  }

  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('professional_id', professionalId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PatientRow[];
}
