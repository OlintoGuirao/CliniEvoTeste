import { usePageQuery } from '@/hooks/usePageQuery';
import { useQuery } from '@tanstack/react-query';
import { patientsListKey, futureClientIdsKey } from '@/api/queryKeys';
import { fetchPatients } from '@/api/patients';
import { getProceduresForProfile } from '@/lib/proceduresForProfile';
import { supabase } from '@/integrations/supabase/client';

/**
 * Centralized hook for the full patients list.
 * Uses shared query key so Patients page and Agenda (and others) share cache.
 */
export function usePatients(professionalId: string | undefined) {
  const main = usePageQuery({
    queryKey: patientsListKey(professionalId ?? ''),
    queryFn: () => fetchPatients(professionalId!),
    enabled: !!professionalId,
  });

  const futureQuery = useQuery({
    queryKey: futureClientIdsKey(professionalId ?? ''),
    queryFn: async (): Promise<string[]> => {
      if (!professionalId) return [];
      const procs = await getProceduresForProfile(professionalId);
      const avaliacaoProc = procs.find((p) => p.slug === 'avaliacao');
      const avaliacaoId = avaliacaoProc?.id;
      if (!avaliacaoId) return [];
      const { data: instances } = await supabase
        .from('procedure_instances')
        .select('patient_id')
        .eq('professional_id', professionalId)
        .eq('procedure_id', avaliacaoId);
      return [...new Set((instances ?? []).map((i: { patient_id: string }) => i.patient_id))];
    },
    enabled: !!professionalId,
  });

  const futureClientPatientIds = futureQuery.data ?? [];
  const isPageLoading =
    main.isPageLoading ||
    futureQuery.isLoading ||
    (futureQuery.isFetching && futureQuery.data === undefined);

  return {
    ...main,
    isPageLoading,
    patients: main.data ?? [],
    futureClientPatientIds,
  };
}
