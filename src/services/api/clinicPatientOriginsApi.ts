import { supabase } from '@/integrations/supabase/client';

export type ClinicPatientOrigin = {
  id: string;
  organization_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const ORIGIN_SELECT = 'id, organization_id, name, is_active, created_at, updated_at';

function formatOriginError(error: { message?: string; code?: string } | null | undefined, fallback: string): string {
  const msg = String(error?.message ?? '');
  if (
    error?.code === '23505' ||
    msg.includes('clinic_patient_origins_org_name_idx') ||
    msg.includes('duplicate key')
  ) {
    return 'Já existe uma origem com este nome nesta clínica.';
  }
  return msg || fallback;
}

export async function fetchClinicPatientOrigins(opts?: {
  activeOnly?: boolean;
}): Promise<ClinicPatientOrigin[]> {
  let query = supabase
    .from('clinic_patient_origins')
    .select(ORIGIN_SELECT)
    .order('name', { ascending: true });

  if (opts?.activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw new Error(formatOriginError(error, 'Não foi possível carregar as origens.'));
  return (data ?? []) as ClinicPatientOrigin[];
}

export async function createClinicPatientOrigin(params: {
  organizationId: string;
  name: string;
}): Promise<ClinicPatientOrigin> {
  const name = params.name.trim();
  if (!name) throw new Error('Informe o nome da origem.');
  if (!params.organizationId) throw new Error('Organização da clínica não encontrada.');

  const { data, error } = await supabase
    .from('clinic_patient_origins')
    .insert({
      organization_id: params.organizationId,
      name,
      is_active: true,
    })
    .select(ORIGIN_SELECT)
    .single();

  if (error) throw new Error(formatOriginError(error, 'Não foi possível cadastrar a origem.'));
  return data as ClinicPatientOrigin;
}

export async function updateClinicPatientOrigin(params: {
  id: string;
  name?: string;
  is_active?: boolean;
}): Promise<ClinicPatientOrigin> {
  const payload: { name?: string; is_active?: boolean } = {};
  if (params.name != null) {
    const name = params.name.trim();
    if (!name) throw new Error('Informe o nome da origem.');
    payload.name = name;
  }
  if (params.is_active != null) payload.is_active = params.is_active;

  const { data, error } = await supabase
    .from('clinic_patient_origins')
    .update(payload)
    .eq('id', params.id)
    .select(ORIGIN_SELECT)
    .single();

  if (error) throw new Error(formatOriginError(error, 'Não foi possível atualizar a origem.'));
  return data as ClinicPatientOrigin;
}

export async function deleteClinicPatientOrigin(id: string): Promise<void> {
  const { error } = await supabase.from('clinic_patient_origins').delete().eq('id', id);
  if (error) throw new Error(formatOriginError(error, 'Não foi possível excluir a origem.'));
}

export function originNameById(
  origins: readonly ClinicPatientOrigin[],
  originId: string | null | undefined
): string {
  if (!originId) return '';
  return origins.find((origin) => origin.id === originId)?.name ?? '';
}
