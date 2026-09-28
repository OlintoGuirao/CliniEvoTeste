import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicMemberRole } from '@/hooks/use-clinic-member-role';
import { fetchClinicAgendaProfessionals } from '@/lib/clinicAgendaBooking';
import type { DashboardSalonScope } from '@/api/dashboard';

export type ClinicFrontDeskScope = DashboardSalonScope & {
  whatsappProfessionalId: string;
};

/**
 * Escopo da recepção da clínica: profissionais da clínica + WhatsApp do master (owner).
 *
 * Não usa `/api/clinic/team` (restrito ao master). Usa a RPC
 * `list_clinic_agenda_professionals`, acessível a qualquer membro da clínica.
 */
export function useClinicFrontDeskScope() {
  const { profile } = useAuth();
  const { isFrontDeskStaff, isLoading: roleLoading } = useClinicMemberRole();

  const prosQuery = useQuery({
    queryKey: ['clinic-front-desk-agenda-pros', profile?.id],
    enabled: Boolean(isFrontDeskStaff && profile?.id),
    queryFn: fetchClinicAgendaProfessionals,
    staleTime: 60_000,
    retry: 1,
  });

  const scope = useMemo((): ClinicFrontDeskScope | null => {
    if (!isFrontDeskStaff || !profile?.id) return null;

    const members = prosQuery.data ?? [];
    const owner = members.find((m) => m.role === 'owner');
    // Sem owner na lista ainda (loading/erro): não inventa o id da recepção —
    // isso listaria conversas vazias no WhatsApp do master.
    const whatsappProfessionalId = owner?.userId || '';

    const professionalIds =
      members.length > 0
        ? members.map((m) => m.userId)
        : whatsappProfessionalId
          ? [whatsappProfessionalId]
          : [];

    const professionalNameById: Record<string, string> = {};
    for (const m of members) {
      professionalNameById[m.userId] = m.name?.trim() || 'Profissional';
    }

    if (!whatsappProfessionalId) return null;

    return {
      professionalIds,
      professionalNameById,
      whatsappProfessionalId,
    };
  }, [isFrontDeskStaff, profile?.id, prosQuery.data]);

  return {
    isFrontDeskStaff,
    scope,
    isLoading: roleLoading || (isFrontDeskStaff && prosQuery.isLoading),
    error: prosQuery.error instanceof Error ? prosQuery.error.message : null,
  };
}
