import { supabase } from '@/integrations/supabase/client';

export type SalonProcedure = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const SELECT =
  'id, organization_id, name, description, is_active, created_at, updated_at';

async function getSalonOrganizationId(): Promise<string> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.id) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('organization_id, account_type')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile?.organization_id || profile.account_type !== 'salon') {
    throw new Error('Organização do salão não encontrada.');
  }
  return profile.organization_id;
}

export async function fetchSalonProcedures(): Promise<SalonProcedure[]> {
  const { data, error } = await supabase
    .from('salon_procedures')
    .select(SELECT)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message || 'Não foi possível carregar procedimentos.');
  return (data ?? []) as SalonProcedure[];
}

export async function createSalonProcedure(body: {
  name: string;
  description?: string | null;
}): Promise<SalonProcedure> {
  const name = body.name.trim();
  if (name.length < 2) {
    throw new Error('Nome do procedimento é obrigatório (mín. 2 caracteres).');
  }

  const organizationId = await getSalonOrganizationId();
  const description = body.description != null ? String(body.description).trim() : null;

  const { data, error } = await supabase
    .from('salon_procedures')
    .insert({
      organization_id: organizationId,
      name,
      description: description || null,
      is_active: true,
    })
    .select(SELECT)
    .single();

  if (error) throw new Error(error.message || 'Não foi possível criar o procedimento.');
  return data as SalonProcedure;
}

export async function updateSalonProcedure(
  id: string,
  body: { name?: string; description?: string | null; is_active?: boolean }
): Promise<SalonProcedure> {
  const payload: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 2) {
      throw new Error('Nome do procedimento é obrigatório (mín. 2 caracteres).');
    }
    payload.name = name;
  }
  if (body.description !== undefined) {
    const description = String(body.description ?? '').trim();
    payload.description = description || null;
  }
  if (body.is_active !== undefined) {
    payload.is_active = Boolean(body.is_active);
  }
  if (!Object.keys(payload).length) {
    throw new Error('Nada para atualizar.');
  }

  const { data, error } = await supabase
    .from('salon_procedures')
    .update(payload)
    .eq('id', id)
    .select(SELECT)
    .maybeSingle();

  if (error) throw new Error(error.message || 'Não foi possível atualizar o procedimento.');
  if (!data) throw new Error('Procedimento não encontrado.');
  return data as SalonProcedure;
}

export async function deactivateSalonProcedure(id: string): Promise<SalonProcedure> {
  return updateSalonProcedure(id, { is_active: false });
}
