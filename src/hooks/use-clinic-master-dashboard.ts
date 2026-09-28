import { useQuery } from '@tanstack/react-query';
import { fetchClinicMasterDashboard } from '@/services/api/clinicMasterDashboardApi';
import type { MasterDashboardFilters } from '@/types/clinicMasterDashboard';

export const CLINIC_MASTER_DASHBOARD_QUERY_KEY = 'clinic-master-dashboard';

export function useClinicMasterDashboard(filters: MasterDashboardFilters, enabled: boolean) {
  return useQuery({
    queryKey: [CLINIC_MASTER_DASHBOARD_QUERY_KEY, filters],
    queryFn: () => fetchClinicMasterDashboard(filters),
    enabled: enabled && Boolean(filters.dataInicio && filters.dataFim),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
