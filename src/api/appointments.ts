import { supabase } from '@/integrations/supabase/client';

export interface AppointmentRow {
  id: string;
  patient_id: string | null;
  full_name: string | null;
  pre_registration_phone: string | null;
  appointment_date: string;
  start_time: string;
  notes: string | null;
  patients?: { full_name?: string } | null;
}

/**
 * Fetches appointments for a professional in a date range.
 * Used by useAppointments and agendaLoader for consistent cache keys.
 */
export async function fetchAppointments(
  professionalId: string,
  startDate: string,
  endDate: string
): Promise<AppointmentRow[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, patient_id, full_name, pre_registration_phone, appointment_date, start_time, notes, patients(full_name)')
    .eq('professional_id', professionalId)
    .gte('appointment_date', startDate)
    .lte('appointment_date', endDate)
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AppointmentRow[];
}
