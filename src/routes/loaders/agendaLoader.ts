import { startOfWeek, endOfWeek } from 'date-fns';
import { queryClient } from '@/core/queryClient';
import { supabase } from '@/integrations/supabase/client';
import { fetchPatients } from '@/api/patients';
import { fetchAppointments } from '@/api/appointments';
import { patientsListKey, appointmentsKey } from '@/api/queryKeys';

/** Prefetch patients and weekly appointments so Agenda has data when opened. */
export async function agendaLoader() {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return null;
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: patientsListKey(userId),
      queryFn: () => fetchPatients(userId),
    }),
    queryClient.prefetchQuery({
      queryKey: appointmentsKey(userId, weekStartStr, weekEndStr),
      queryFn: () => fetchAppointments(userId, weekStartStr, weekEndStr),
    }),
  ]);
  return null;
}
