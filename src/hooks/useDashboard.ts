import { useQuery } from '@tanstack/react-query';
import { dashboardKey } from '@/api/queryKeys';
import { fetchDashboardData, type DashboardData, type DashboardSalonScope } from '@/api/dashboard';

/**
 * Single batched request for all dashboard data.
 * Replaces multiple useState + useEffect fetches with one cached query.
 */
export function useDashboard(
  professionalId: string | undefined,
  options?: { enabled?: boolean; salonScope?: DashboardSalonScope }
) {
  const salonScope = options?.salonScope;
  return useQuery({
    queryKey: [
      ...dashboardKey(professionalId ?? ''),
      salonScope?.professionalIds?.join(',') ?? 'solo',
    ],
    queryFn: () => fetchDashboardData(professionalId!, { salonScope }),
    enabled: options?.enabled !== false && !!professionalId,
  });
}

export type { DashboardData, DashboardSalonScope };
