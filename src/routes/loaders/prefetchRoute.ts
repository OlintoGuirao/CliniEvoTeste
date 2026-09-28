import { queryClient } from '@/core/queryClient';
import { supabase } from '@/integrations/supabase/client';
import { fetchPatients } from '@/api/patients';
import { fetchDashboardData } from '@/api/dashboard';
import { patientsListKey, dashboardKey } from '@/api/queryKeys';
import { prefetchRouteChunk } from '@/routes/chunkPrefetch';

/** Prefetch route data + lazy chunk on nav link hover for instant navigation. */
export async function prefetchRoute(path: string) {
  prefetchRouteChunk(path);
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return;
  const prefetchable = ['/patients', '/agenda', '/dashboard'];
  if (prefetchable.includes(path)) {
    await queryClient.prefetchQuery({
      queryKey: patientsListKey(userId),
      queryFn: () => fetchPatients(userId),
    });
  }
  if (path === '/dashboard') {
    await queryClient.prefetchQuery({
      queryKey: dashboardKey(userId),
      queryFn: () => fetchDashboardData(userId),
    });
  }
}
