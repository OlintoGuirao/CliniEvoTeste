import { supabase } from '@/integrations/supabase/client';

export type ClinicAgendaProfessional = {
  userId: string;
  name: string;
  specialty?: string | null;
  role?: 'owner' | 'professional' | 'attendant' | string | null;
};

export type ClinicAgendaProcedure = {
  id: string;
  name: string;
  slug: string;
};

/** Tipos fixos de atendimento na agenda da clínica. */
export const CLINIC_AGENDA_APPOINTMENT_TYPES: ClinicAgendaProcedure[] = [
  { id: 'avaliacao', name: 'Avaliação', slug: 'avaliacao' },
  { id: 'tratamento', name: 'Tratamento', slug: 'tratamento' },
  { id: 'retorno', name: 'Retorno', slug: 'retorno' },
];

export {
  CLINIC_APPOINTMENT_STATUS_OPTIONS as CLINIC_AGENDA_STATUS_OPTIONS,
  DEFAULT_CLINIC_APPOINTMENT_STATUS,
  type ClinicAppointmentStatus as ClinicAgendaStatus,
} from '@/lib/clinicAppointmentStatus';

export async function fetchClinicAgendaProfessionals(): Promise<ClinicAgendaProfessional[]> {
  const { data, error } = await (supabase as any).rpc('list_clinic_agenda_professionals');
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    user_id: string;
    full_name: string | null;
    professional_specialty?: string | null;
    role?: string | null;
  }>;
  return rows.map((row) => ({
    userId: String(row.user_id),
    name: row.full_name?.trim() || 'Profissional',
    specialty: row.professional_specialty ?? null,
    role: row.role ?? null,
  }));
}

/** @deprecated Use CLINIC_AGENDA_APPOINTMENT_TYPES — tipos fixos da agenda clínica. */
export async function fetchClinicAgendaProcedures(): Promise<ClinicAgendaProcedure[]> {
  return CLINIC_AGENDA_APPOINTMENT_TYPES;
}
