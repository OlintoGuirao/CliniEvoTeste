import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isClinicOnlyAccount, normalizeAccountType } from '@/lib/accountType';

export type ClinicMembership = {
  organization_id: string;
  role: 'owner' | 'professional' | 'attendant';
};

/**
 * Master da clínica = account_type clinic + is_clinic_owner.
 * Contas solo e salão NÃO entram neste fluxo (enabled=false → isMaster=false).
 * Salão usa useSalonAccount — fluxo separado.
 */
export function useClinicMaster() {
  const { profile } = useAuth();
  const isClinicAccount = isClinicOnlyAccount(profile?.account_type);

  const query = useQuery({
    queryKey: ['clinic-master', profile?.id, profile?.organization_id],
    enabled: Boolean(profile?.id && isClinicAccount),
    queryFn: async (): Promise<{ isOwner: boolean; membership: ClinicMembership | null }> => {
      const { data: isOwner, error: ownerError } = await (supabase as any).rpc('is_clinic_owner');
      if (ownerError) throw new Error(ownerError.message);

      if (!isOwner) {
        return { isOwner: false, membership: null };
      }

      const organizationId = profile?.organization_id ? String(profile.organization_id) : null;
      if (!organizationId) {
        return { isOwner: true, membership: null };
      }

      return {
        isOwner: true,
        membership: {
          organization_id: organizationId,
          role: 'owner',
        },
      };
    },
    staleTime: 60_000,
  });

  const isMaster = isClinicAccount && query.data?.isOwner === true;

  return {
    isClinicAccount,
    isSalonAccount: false as const,
    isMaster,
    /** Só master de clínica esconde agenda/consulta/pacientes. */
    hideOperationalNav: isMaster,
    membership: query.data?.membership ?? null,
    organizationId: query.data?.membership?.organization_id ?? profile?.organization_id ?? null,
    isLoading: isClinicAccount && query.isLoading,
    accountType: normalizeAccountType(profile?.account_type),
  };
}
