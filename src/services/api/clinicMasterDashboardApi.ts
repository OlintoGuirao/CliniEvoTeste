import { supabase } from '@/integrations/supabase/client';
import type { MasterDashboardFilters, MasterDashboardResponse } from '@/types/clinicMasterDashboard';

async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');
  return token;
}

function buildQuery(filters: MasterDashboardFilters): string {
  const params = new URLSearchParams({
    dataInicio: filters.dataInicio,
    dataFim: filters.dataFim,
  });
  if (filters.branchId) params.set('branchId', filters.branchId);
  if (filters.professionalId) params.set('professionalId', filters.professionalId);
  if (filters.procedureId) params.set('procedureId', filters.procedureId);
  if (filters.status) params.set('status', filters.status);
  return params.toString();
}

export async function fetchClinicMasterDashboard(
  filters: MasterDashboardFilters
): Promise<MasterDashboardResponse> {
  const token = await getAuthToken();
  const res = await fetch(`/api/clinic/master-dashboard?${buildQuery(filters)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String((body as { error?: string }).error || 'Não foi possível carregar o dashboard.'));
  }
  return body as MasterDashboardResponse;
}
