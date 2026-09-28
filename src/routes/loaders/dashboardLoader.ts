import { queryClient } from '@/core/queryClient';
import { supabase } from '@/integrations/supabase/client';
import { fetchPatients } from '@/api/patients';
import { fetchDashboardData } from '@/api/dashboard';
import { patientsListKey, dashboardKey } from '@/api/queryKeys';

/** Prefetch patients and dashboard data so Dashboard and navigation are instant. */
export async function dashboardLoader() {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return null;
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: patientsListKey(userId),
      queryFn: () => fetchPatients(userId),
    }),
    queryClient.prefetchQuery({
      queryKey: dashboardKey(userId),
      queryFn: () => fetchDashboardData(userId),
    }),
  ]);
  return null;
}
