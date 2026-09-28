import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicMaster } from '@/hooks/use-clinic-master';
import { supabase } from '@/integrations/supabase/client';
import {
  isClinicFrontDeskStaffTitle,
  resolveStaffTitleFromStorage,
  resolveStaffTitleIdFromProfile,
} from '@/lib/clinicTeamRoles';

type ClinicMemberRoleRow = {
  role: 'owner' | 'professional' | 'attendant';
  staff_title: string | null;
};

/**
 * Papel do membro da equipe da clínica (não-master).
 * Usado para restringir navegação de recepção/atendimento (secretária, recepcionista, atendente).
 */
export function useClinicMemberRole() {
  const { profile } = useAuth();
  const { isClinicAccount, isMaster, isLoading: masterLoading } = useClinicMaster();
  const isClinicMember = isClinicAccount && !isMaster;

  const query = useQuery({
    queryKey: ['clinic-member-role', profile?.id],
    enabled: Boolean(profile?.id && isClinicMember && !masterLoading),
    queryFn: async (): Promise<ClinicMemberRoleRow | null> => {
      const { data, error } = await (supabase as any)
        .from('organization_members')
        .select('role, staff_title')
        .eq('user_id', profile!.id)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as ClinicMemberRoleRow | null;
    },
    staleTime: 60_000,
  });

  const staffTitleId = useMemo(() => {
    if (query.data?.staff_title) {
      return resolveStaffTitleFromStorage(query.data.staff_title).staffTitle || null;
    }
    return resolveStaffTitleIdFromProfile(profile);
  }, [query.data?.staff_title, profile]);

  const isFrontDeskStaff =
    isClinicMember && isClinicFrontDeskStaffTitle(staffTitleId);

  /** Profissional clínico da clínica (não master, não recepção/atendimento). */
  const isClinicClinicalProfessional = isClinicMember && !isFrontDeskStaff;

  return {
    isClinicMember,
    /** Secretária, recepcionista ou atendente — menu operacional restrito */
    isFrontDeskStaff,
    /** @deprecated Use isFrontDeskStaff */
    isReceptionist: isFrontDeskStaff,
    /** Profissional da clínica (atende), sem menu financeiro/recepção */
    isClinicClinicalProfessional,
    staffTitleId,
    memberRole: query.data?.role ?? null,
    isLoading: isClinicMember && (masterLoading || query.isLoading),
  };
}
