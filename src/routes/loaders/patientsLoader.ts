import { queryClient } from '@/core/queryClient';
import { supabase } from '@/integrations/supabase/client';
import { fetchPatients } from '@/api/patients';
import { patientsListKey } from '@/api/queryKeys';

/** Prefetch patients (QUERY_KEYS.patients + userId) so the page has data before render. */
export async function patientsLoader() {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return null;
  await queryClient.prefetchQuery({
    queryKey: patientsListKey(userId),
    queryFn: () => fetchPatients(userId),
  });
  return null;
}
