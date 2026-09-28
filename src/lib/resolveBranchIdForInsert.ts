import { supabase } from '@/integrations/supabase/client';
import { isClinicOnlyAccount } from '@/lib/accountType';

/** branch_id para inserts financeiros; solo/salão retorna null (comportamento anterior). */
export async function resolveBranchIdForInsert(profile?: {
  id?: string;
  account_type?: string | null;
} | null): Promise<string | null> {
  if (!profile?.id || !isClinicOnlyAccount(profile.account_type)) {
    return null;
  }
  const { data, error } = await (supabase as any).rpc('get_user_default_branch_id');
  if (error) return null;
  return data ? String(data) : null;
}
