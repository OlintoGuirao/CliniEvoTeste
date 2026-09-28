import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { patientsListKey } from '@/api/queryKeys';
import type { PatientRow } from '@/api/patients';

/** Optimistic update: toggle is_active for a patient. */
export function useUpdatePatientActive(professionalId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ patientId, isActive }: { patientId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('patients')
        .update({ is_active: isActive })
        .eq('id', patientId);
      if (error) throw error;
      return { patientId, isActive };
    },
    onMutate: async ({ patientId, isActive }) => {
      if (!professionalId) return undefined;
      const key = patientsListKey(professionalId);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<PatientRow[]>(key);
      queryClient.setQueryData<PatientRow[]>(key, (old) =>
        (old ?? []).map((p) => (p.id === patientId ? { ...p, is_active: isActive } : p))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev != null && professionalId) {
        queryClient.setQueryData(patientsListKey(professionalId), ctx.prev);
      }
    },
    onSettled: () => {
      if (professionalId) {
        queryClient.invalidateQueries({ queryKey: patientsListKey(professionalId) });
      }
    },
  });
}

/** Optimistic delete: remove patient from list. */
export function useDeletePatient(professionalId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patientId: string) => {
      const { error } = await supabase.from('patients').delete().eq('id', patientId);
      if (error) {
        const msg = String(error.message || '');
        if (error.code === '23503' || /recebimentos|foreign key|violates foreign key/i.test(msg)) {
          throw new Error(
            'Não foi possível excluir: existem recebimentos ou outros registros financeiros vinculados a este paciente.'
          );
        }
        throw new Error(msg || 'Erro ao excluir paciente.');
      }
      return patientId;
    },
    onMutate: async (patientId) => {
      if (!professionalId) return undefined;
      const key = patientsListKey(professionalId);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<PatientRow[]>(key);
      queryClient.setQueryData<PatientRow[]>(key, (old) => (old ?? []).filter((p) => p.id !== patientId));
      return { prev };
    },
    onError: (_err, _patientId, ctx) => {
      if (ctx?.prev != null && professionalId) {
        queryClient.setQueryData(patientsListKey(professionalId), ctx.prev);
      }
    },
    onSettled: () => {
      if (professionalId) {
        queryClient.invalidateQueries({ queryKey: patientsListKey(professionalId) });
      }
    },
  });
}
