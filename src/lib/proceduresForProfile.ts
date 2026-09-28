import { supabase } from '@/integrations/supabase/client';
import { isClinicOnlyAccount } from '@/lib/accountType';
import { isClinicDentalCatalogProcedure } from '@/lib/clinicDentalProcedures';

/**
 * Retorna os procedimentos visíveis para o perfil, respeitando
 * profile_procedure_permissions (painel admin).
 * Se não houver permissões cadastradas para o perfil, retorna todos (comportamento legado),
 * exceto catálogo odontológico — exclusivo de conta clínica.
 */
export async function getProceduresForProfile(profileId: string) {
  const [{ data, error }, profileRes] = await Promise.all([
    supabase.rpc('get_procedures_for_profile', {
      p_profile_id: profileId,
    }),
    supabase.from('profiles').select('account_type').eq('id', profileId).maybeSingle(),
  ]);
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
    category: string;
    specialty?: string | null;
    description?: string | null;
    is_global: boolean;
    created_by: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;

  if (isClinicOnlyAccount(profileRes.data?.account_type)) {
    return rows;
  }

  // Defesa no app (também coberto pela RPC após migration 20260909150000)
  return rows.filter((p) => !isClinicDentalCatalogProcedure(p));
}
