import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { isClinicOnlyAccount } from '@/lib/accountType';
import { fetchClinicPatientOrigins } from '@/services/api/clinicPatientOriginsApi';

export function clinicPatientOriginsKey(organizationId: string | null | undefined, activeOnly?: boolean) {
  return ['clinic-patient-origins', organizationId ?? '', activeOnly ? 'active' : 'all'] as const;
}

export function useClinicPatientOrigins(opts?: { activeOnly?: boolean }) {
  const { profile } = useAuth();
  const isClinicAccount = isClinicOnlyAccount(profile?.account_type);
  const organizationId = profile?.organization_id ?? null;

  const query = useQuery({
    queryKey: clinicPatientOriginsKey(organizationId, opts?.activeOnly),
    enabled: Boolean(isClinicAccount && organizationId),
    queryFn: () => fetchClinicPatientOrigins({ activeOnly: opts?.activeOnly }),
  });

  return {
    origins: query.data ?? [],
    isClinicAccount,
    organizationId,
    isLoading: Boolean(isClinicAccount && organizationId && query.isLoading),
    isError: query.isError,
    error: query.error,
  };
}
