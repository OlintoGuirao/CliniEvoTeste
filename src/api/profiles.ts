import { supabase } from '@/integrations/supabase/client';
import type { Profile } from '@/types/auth';

/**
 * Busca o perfil do usuário no Supabase.
 * Usado pelo AuthProvider (hidratação + setQueryData) e por useProfile (queryFn).
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}
