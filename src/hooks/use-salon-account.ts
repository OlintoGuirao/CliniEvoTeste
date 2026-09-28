import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isSalonAccount, normalizeAccountType } from '@/lib/accountType';
import { getUiCopy, type UiCopy } from '@/lib/uiCopy';

/**
 * Conta Salão / Cabeleireiro — fluxo separado de clínica e de profissional único.
 * - Terminologia própria (Salão / Atendimento / Clientes)
 * - Admin do salão = owner (pode atender e gerenciar equipe)
 * - Não altera menu/gates de clínica nem de solo
 */
export function useSalonAccount() {
  const { profile } = useAuth();
  const isSalon = isSalonAccount(profile?.account_type);
  const accountType = normalizeAccountType(profile?.account_type);

  const query = useQuery({
    queryKey: ['salon-admin', profile?.id, profile?.organization_id],
    enabled: Boolean(profile?.id && isSalon),
    queryFn: async (): Promise<{ isOwner: boolean }> => {
      const { data: isOwner, error } = await (supabase as any).rpc('is_clinic_owner');
      if (error) throw new Error(error.message);
      return { isOwner: Boolean(isOwner) };
    },
    staleTime: 60_000,
  });

  const isSalonAdmin = isSalon && query.data?.isOwner === true;
  const copy: UiCopy = getUiCopy(isSalon ? 'salon' : 'solo');

  return {
    isSalonAccount: isSalon,
    isSalonAdmin,
    organizationId: profile?.organization_id ?? null,
    accountType,
    copy,
    isLoading: isSalon && query.isLoading,
  };
}
