import { supabase } from '@/integrations/supabase/client';

export type ClinicRecordType = {
  id: string;
  organization_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const TYPE_SELECT = 'id, organization_id, name, is_active, created_at, updated_at';

function formatTypeError(error: { message?: string; code?: string } | null | undefined, fallback: string): string {
  const msg = String(error?.message ?? '');
  if (
    error?.code === '23505' ||
    msg.includes('clinic_record_types_org_name_idx') ||
    msg.includes('duplicate key')
  ) {
    return 'Já existe um tipo de ficha com este nome nesta clínica.';
  }
  return msg || fallback;
}

export async function fetchClinicRecordTypes(opts?: {
  activeOnly?: boolean;
}): Promise<ClinicRecordType[]> {
  let query = supabase
    .from('clinic_record_types')
    .select(TYPE_SELECT)
    .order('name', { ascending: true });

  if (opts?.activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw new Error(formatTypeError(error, 'Não foi possível carregar os tipos de ficha.'));
  return (data ?? []) as ClinicRecordType[];
}

export async function createClinicRecordType(params: {
  organizationId: string;
  name: string;
}): Promise<ClinicRecordType> {
  const name = params.name.trim();
  if (!name) throw new Error('Informe o nome do tipo de ficha.');
  if (!params.organizationId) throw new Error('Organização da clínica não encontrada.');

  const { data, error } = await supabase
    .from('clinic_record_types')
    .insert({
      organization_id: params.organizationId,
      name,
      is_active: true,
    })
    .select(TYPE_SELECT)
    .single();

  if (error) throw new Error(formatTypeError(error, 'Não foi possível cadastrar o tipo de ficha.'));
  return data as ClinicRecordType;
}

export async function updateClinicRecordType(params: {
  id: string;
  name?: string;
  is_active?: boolean;
}): Promise<ClinicRecordType> {
  const payload: { name?: string; is_active?: boolean } = {};
  if (params.name != null) {
    const name = params.name.trim();
    if (!name) throw new Error('Informe o nome do tipo de ficha.');
    payload.name = name;
  }
  if (params.is_active != null) payload.is_active = params.is_active;

  const { data, error } = await supabase
    .from('clinic_record_types')
    .update(payload)
    .eq('id', params.id)
    .select(TYPE_SELECT)
    .single();

  if (error) throw new Error(formatTypeError(error, 'Não foi possível atualizar o tipo de ficha.'));
  return data as ClinicRecordType;
}

export async function deleteClinicRecordType(id: string): Promise<void> {
  const { error } = await supabase.from('clinic_record_types').delete().eq('id', id);
  if (error) throw new Error(formatTypeError(error, 'Não foi possível excluir o tipo de ficha.'));
}

export async function fetchPatientRecordTypeIds(patientId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('patient_record_types')
    .select('record_type_id')
    .eq('patient_id', patientId);
  if (error) throw new Error(formatTypeError(error, 'Não foi possível carregar os tipos de ficha do paciente.'));
  return (data ?? []).map((row) => String((row as { record_type_id: string }).record_type_id));
}

export async function replacePatientRecordTypes(patientId: string, recordTypeIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(recordTypeIds.filter(Boolean))];
  const { error: deleteError } = await supabase
    .from('patient_record_types')
    .delete()
    .eq('patient_id', patientId);
  if (deleteError) {
    throw new Error(formatTypeError(deleteError, 'Não foi possível atualizar os tipos de ficha.'));
  }
  if (uniqueIds.length === 0) return;

  const { error: insertError } = await supabase.from('patient_record_types').insert(
    uniqueIds.map((record_type_id) => ({
      patient_id: patientId,
      record_type_id,
    }))
  );
  if (insertError) {
    throw new Error(formatTypeError(insertError, 'Não foi possível salvar os tipos de ficha.'));
  }
}
