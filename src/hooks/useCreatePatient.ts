import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS, patientsListKey } from '@/api/queryKeys';
import type { PatientRow } from '@/api/patients';
import { cepDigits } from '@/lib/viaCep';

export type CreatePatientPayload = {
  professional_id: string;
  full_name: string;
  nickname?: string | null;
  cpf?: string | null;
  date_of_birth?: string | null;
  sex?: string | null;
  profession?: string | null;
  address?: string | null;
  address_number?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  zip_code?: string | null;
  origin_id?: string | null;
  phone?: string | null;
  referred_by?: string | null;
  referred_by_patient_id?: string | null;
  treatment_start_date?: string | null;
  consultation_objective?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  general_notes?: string | null;
  is_minor?: boolean;
  legal_responsible_name?: string | null;
  registration_completed_at: string;
};

/** Optimistic create: add patient to list immediately, rollback on error, invalidate on settled. */
export function useCreatePatient(professionalId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreatePatientPayload): Promise<PatientRow> => {
      const { data, error } = await supabase
        .from('patients')
        .insert([
          {
            professional_id: payload.professional_id,
            full_name: payload.full_name,
            nickname: payload.nickname?.trim() || null,
            cpf: payload.cpf?.trim() || null,
            date_of_birth: payload.date_of_birth || null,
            sex: payload.sex || null,
            profession: payload.profession?.trim() || null,
            address: payload.address?.trim() || null,
            address_number: payload.address_number?.trim() || null,
            city: payload.city?.trim() || null,
            neighborhood: payload.neighborhood?.trim() || null,
            zip_code: cepDigits(payload.zip_code) || null,
            origin_id: payload.origin_id || null,
            phone: payload.phone || null,
            referred_by: payload.referred_by?.trim() || null,
            referred_by_patient_id: payload.referred_by_patient_id || null,
            treatment_start_date: payload.treatment_start_date || null,
            consultation_objective: payload.consultation_objective?.trim() || null,
            emergency_contact_name: payload.emergency_contact_name?.trim() || null,
            emergency_contact_phone: payload.emergency_contact_phone?.trim() || null,
            general_notes: payload.general_notes?.trim() || null,
            is_minor: Boolean(payload.is_minor),
            legal_responsible_name: payload.is_minor
              ? payload.legal_responsible_name?.trim() || null
              : null,
            registration_completed_at: payload.registration_completed_at,
            is_active: true,
          },
        ])
        .select()
        .single();
      if (error) throw error;
      return data as PatientRow;
    },
    onMutate: async (newPatient) => {
      const assignedId = newPatient.professional_id;
      const cacheIds = [...new Set([assignedId, professionalId].filter(Boolean))] as string[];
      if (cacheIds.length === 0) return undefined;

      const previousByKey = new Map<string, PatientRow[] | undefined>();
      for (const id of cacheIds) {
        const key = patientsListKey(id);
        await queryClient.cancelQueries({ queryKey: key });
        previousByKey.set(id, queryClient.getQueryData<PatientRow[]>(key));
      }

      const optimistic: PatientRow = {
        id: `optimistic-${crypto.randomUUID()}`,
        full_name: newPatient.full_name,
        phone: newPatient.phone ?? null,
        date_of_birth: newPatient.date_of_birth ?? null,
        sex: newPatient.sex ?? null,
        profile_photo_url: null,
        treatment_start_date: newPatient.treatment_start_date ?? null,
        is_active: true,
        is_minor: Boolean(newPatient.is_minor),
        legal_responsible_name: newPatient.is_minor
          ? newPatient.legal_responsible_name?.trim() || null
          : null,
        created_at: new Date().toISOString(),
        registration_completed_at: newPatient.registration_completed_at,
        professional_id: assignedId,
      };

      for (const id of cacheIds) {
        queryClient.setQueryData<PatientRow[]>(patientsListKey(id), (old = []) => [
          optimistic,
          ...old,
        ]);
      }

      return { previousByKey };
    },
    onError: (_err, _vars, context) => {
      if (!context?.previousByKey) return;
      for (const [id, previous] of context.previousByKey) {
        if (previous !== undefined) {
          queryClient.setQueryData(patientsListKey(id), previous);
        }
      }
    },
    onSettled: (_data, _err, variables) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.patients });
      if (variables?.professional_id) {
        void queryClient.invalidateQueries({
          queryKey: patientsListKey(variables.professional_id),
        });
      }
      if (professionalId && professionalId !== variables?.professional_id) {
        void queryClient.invalidateQueries({ queryKey: patientsListKey(professionalId) });
      }
    },
  });
}
