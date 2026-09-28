import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { isClinicOnlyAccount } from '@/lib/accountType';
import { fetchClinicRecordTypes, fetchPatientRecordTypeIds } from '@/services/api/clinicRecordTypesApi';

export function clinicRecordTypesKey(organizationId: string | null | undefined, activeOnly?: boolean) {
  return ['clinic-record-types', organizationId ?? '', activeOnly ? 'active' : 'all'] as const;
}

export function patientRecordTypesKey(patientId: string | null | undefined) {
  return ['patient-record-types', patientId ?? ''] as const;
}

export function useClinicRecordTypes(opts?: { activeOnly?: boolean }) {
  const { profile } = useAuth();
  const isClinicAccount = isClinicOnlyAccount(profile?.account_type);
  const organizationId = profile?.organization_id ?? null;

  const query = useQuery({
    queryKey: clinicRecordTypesKey(organizationId, opts?.activeOnly),
    enabled: Boolean(isClinicAccount && organizationId),
    queryFn: () => fetchClinicRecordTypes({ activeOnly: opts?.activeOnly }),
  });

  return {
    recordTypes: query.data ?? [],
    isClinicAccount,
    organizationId,
    isLoading: Boolean(isClinicAccount && organizationId && query.isLoading),
    isError: query.isError,
    error: query.error,
  };
}

export function usePatientRecordTypeIds(patientId: string | null | undefined) {
  const query = useQuery({
    queryKey: patientRecordTypesKey(patientId),
    enabled: Boolean(patientId),
    queryFn: () => fetchPatientRecordTypeIds(patientId!),
  });

  return {
    recordTypeIds: query.data ?? [],
    isLoading: Boolean(patientId && query.isLoading),
    isError: query.isError,
  };
}
