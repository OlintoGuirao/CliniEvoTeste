import { supabase } from '@/integrations/supabase/client';

export type OrganizationBranch = {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  whatsapp_instance_id: string | null;
  pix_key: string | null;
  pix_key_type: string | null;
  pix_receiver_name: string | null;
  accent_color: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
};

const BRANCH_SELECT =
  'id, organization_id, name, address, phone, is_active, whatsapp_instance_id, pix_key, pix_key_type, pix_receiver_name, accent_color, logo_url, created_at, updated_at';

function normalizeBranchName(name: string): string {
  return name.trim().toLocaleLowerCase('pt-BR');
}

function formatBranchError(
  error: { message?: string; code?: string } | string | null | undefined,
  fallback: string
): string {
  if (error == null) return fallback;
  if (typeof error === 'string') {
    const trimmed = error.trim();
    if (!trimmed) return fallback;
    if (
      trimmed.includes('organization_branches_org_name_unique') ||
      trimmed.includes('duplicate key')
    ) {
      return 'Já existe uma filial com este nome nesta clínica. Escolha outro nome (ex.: Unidade Centro, Filial Norte).';
    }
    if (trimmed.includes('already') || trimmed.includes('registered')) {
      return 'Este e-mail já está cadastrado.';
    }
    return trimmed;
  }

  const msg = String(error.message || '');
  if (
    error.code === '23505' ||
    msg.includes('organization_branches_org_name_unique') ||
    msg.includes('duplicate key')
  ) {
    return 'Já existe uma filial com este nome nesta clínica. Escolha outro nome (ex.: Unidade Centro, Filial Norte).';
  }
  if (msg.includes('already') || msg.includes('registered')) {
    return 'Este e-mail já está cadastrado.';
  }
  return msg || fallback;
}

async function assertBranchNameAvailable(name: string, excludeBranchId?: string): Promise<void> {
  const normalized = normalizeBranchName(name);
  const { data, error } = await (supabase as any)
    .from('organization_branches')
    .select('id, name');
  if (error) throw new Error(formatBranchError(error, 'Não foi possível validar o nome.'));
  const taken = (data ?? []).some(
    (row: { id: string; name: string }) =>
      row.id !== excludeBranchId && normalizeBranchName(row.name) === normalized
  );
  if (taken) {
    throw new Error(
      'Já existe uma filial com este nome nesta clínica. Escolha outro nome (ex.: Unidade Centro, Filial Norte).'
    );
  }
}

async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');
  return token;
}

/** Master: todas as filiais da org (via RLS). */
export async function fetchClinicBranchesAdmin(): Promise<OrganizationBranch[]> {
  const { data, error } = await (supabase as any)
    .from('organization_branches')
    .select(BRANCH_SELECT)
    .order('created_at', { ascending: true });

  if (error) {
    // Migration de branding ainda não aplicada
    if (/accent_color|logo_url/i.test(error.message)) {
      const { data: fallback, error: fbErr } = await (supabase as any)
        .from('organization_branches')
        .select(
          'id, organization_id, name, address, phone, is_active, whatsapp_instance_id, pix_key, pix_key_type, pix_receiver_name, created_at, updated_at'
        )
        .order('created_at', { ascending: true });
      if (fbErr) throw new Error(fbErr.message);
      return ((fallback ?? []) as OrganizationBranch[]).map((b) => ({
        ...b,
        accent_color: null,
        logo_url: null,
      }));
    }
    throw new Error(error.message);
  }
  return (data ?? []) as OrganizationBranch[];
}

export async function createClinicBranch(params: {
  name: string;
  address?: string | null;
  phone?: string | null;
  accent_color?: string | null;
  login_full_name: string;
  login_email: string;
  login_password: string;
}): Promise<{ branch: OrganizationBranch; login: { user_id: string; email: string } }> {
  await assertBranchNameAvailable(params.name);

  const token = await getAuthToken();
  const res = await fetch('/api/clinic/branches', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: params.name.trim(),
      address: params.address?.trim() || null,
      phone: params.phone?.trim() || null,
      accent_color: params.accent_color?.trim() || null,
      login_full_name: params.login_full_name.trim(),
      login_email: params.login_email.trim(),
      login_password: params.login_password,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatBranchError(json?.error, 'Não foi possível criar a filial.'));
  }
  return {
    branch: json.branch as OrganizationBranch,
    login: json.login as { user_id: string; email: string },
  };
}

export async function updateClinicBranch(params: {
  branch_id: string;
  name?: string;
  address?: string | null;
  phone?: string | null;
  is_active?: boolean;
  whatsapp_instance_id?: string | null;
  pix_key?: string | null;
  pix_key_type?: string | null;
  pix_receiver_name?: string | null;
  accent_color?: string | null;
  logo_url?: string | null;
}): Promise<OrganizationBranch> {
  const { branch_id, ...patch } = params;
  const updates = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined)
  );
  if (!Object.keys(updates).length) {
    throw new Error('Nenhum campo para atualizar.');
  }

  if (typeof updates.name === 'string') {
    await assertBranchNameAvailable(updates.name, branch_id);
    updates.name = updates.name.trim();
  }

  const { data, error } = await (supabase as any)
    .from('organization_branches')
    .update(updates)
    .eq('id', branch_id)
    .select(BRANCH_SELECT)
    .maybeSingle();
  if (error) {
    if (/accent_color|logo_url/i.test(error.message || '')) {
      throw new Error(
        'Aplique a migration 20260826220000_branch_branding.sql no Supabase para salvar cor e logo da filial.'
      );
    }
    throw new Error(formatBranchError(error, 'Não foi possível atualizar a filial.'));
  }
  if (!data) throw new Error('Filial não encontrada.');
  return data as OrganizationBranch;
}

export async function deleteClinicBranch(branchId: string): Promise<{ name: string }> {
  const token = await getAuthToken();

  try {
    const res = await fetch(`/api/clinic/branches?branch_id=${encodeURIComponent(branchId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      return { name: String(json?.name || 'Filial') };
    }

    const apiError = typeof json?.error === 'string' ? json.error : undefined;
    if (res.status === 404 && !apiError) {
      return deleteClinicBranchViaSupabase(branchId);
    }
    throw new Error(formatBranchError(apiError, 'Não foi possível excluir a filial.'));
  } catch (err) {
    if (err instanceof Error && err.message !== 'Failed to fetch') {
      throw err;
    }
    try {
      return await deleteClinicBranchViaSupabase(branchId);
    } catch (fallbackErr) {
      throw new Error(
        fallbackErr instanceof Error
          ? fallbackErr.message
          : 'Servidor indisponível. Execute npm run server e tente novamente.'
      );
    }
  }
}

/** Fallback quando a API local não está rodando (sem remoção de login Auth de atendentes). */
async function deleteClinicBranchViaSupabase(branchId: string): Promise<{ name: string }> {
  const { data: branch, error: findErr } = await (supabase as any)
    .from('organization_branches')
    .select('id, name, organization_id')
    .eq('id', branchId)
    .maybeSingle();

  if (findErr) throw new Error(formatBranchError(findErr, 'Não foi possível excluir a filial.'));
  if (!branch) throw new Error('Filial não encontrada.');

  const { data: members, error: memErr } = await (supabase as any)
    .from('organization_members')
    .select('user_id, role')
    .eq('branch_id', branchId);

  if (memErr) throw new Error(formatBranchError(memErr, 'Não foi possível excluir a filial.'));

  const hasAttendant = (members ?? []).some((m: { role: string }) => m.role === 'attendant');
  if (hasAttendant) {
    throw new Error(
      'Para excluir filial com login de atendente, inicie o servidor local (npm run server) e tente novamente.'
    );
  }

  const hasProfessional = (members ?? []).some((m: { role: string }) => m.role === 'professional');
  if (hasProfessional) {
    throw new Error(
      'Esta filial ainda tem profissionais vinculados. Remova-os em Equipe antes de excluir.'
    );
  }

  const { count, error: countErr } = await (supabase as any)
    .from('organization_branches')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', branch.organization_id);

  if (countErr) throw new Error(formatBranchError(countErr, 'Não foi possível excluir a filial.'));

  const isLastBranch = (count ?? 0) <= 1;

  const { error: delErr } = await (supabase as any)
    .from('organization_branches')
    .delete()
    .eq('id', branchId);

  if (delErr) throw new Error(formatBranchError(delErr, 'Não foi possível excluir a filial.'));

  if (isLastBranch) {
    const { data: org, error: orgErr } = await (supabase as any)
      .from('organizations')
      .select('name')
      .eq('id', branch.organization_id)
      .maybeSingle();

    if (orgErr) throw new Error(formatBranchError(orgErr, 'Filial excluída, mas falhou ao recriar a Matriz.'));

    const matrizName = String(org?.name || '').trim() || 'Matriz';
    const { error: recreateErr } = await (supabase as any)
      .from('organization_branches')
      .insert({
        organization_id: branch.organization_id,
        name: matrizName,
      });

    if (recreateErr) {
      throw new Error(
        formatBranchError(
          recreateErr,
          'Filial excluída, mas não foi possível recriar a unidade padrão (Matriz).'
        )
      );
    }
  }

  return { name: String(branch.name || 'Filial') };
}

/** Filiais ativas acessíveis ao usuário logado (RLS). */
export async function fetchAccessibleBranches(): Promise<OrganizationBranch[]> {
  const { data, error } = await (supabase as any)
    .from('organization_branches')
    .select(BRANCH_SELECT)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) {
    if (/accent_color|logo_url/i.test(error.message)) {
      const { data: fallback, error: fbErr } = await (supabase as any)
        .from('organization_branches')
        .select(
          'id, organization_id, name, address, phone, is_active, whatsapp_instance_id, pix_key, pix_key_type, pix_receiver_name, created_at, updated_at'
        )
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (fbErr) throw new Error(fbErr.message);
      return ((fallback ?? []) as OrganizationBranch[]).map((b) => ({
        ...b,
        accent_color: null,
        logo_url: null,
      }));
    }
    throw new Error(error.message);
  }
  return (data ?? []) as OrganizationBranch[];
}

export async function fetchMemberBranchId(userId: string): Promise<string | null> {
  // Preferir RPC (evita erro com múltiplos memberships / maybeSingle)
  try {
    const viaRpc = await fetchDefaultBranchId();
    if (viaRpc) return viaRpc;
  } catch {
    /* fallback abaixo */
  }

  const { data, error } = await (supabase as any)
    .from('organization_members')
    .select('branch_id')
    .eq('user_id', userId)
    .not('branch_id', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.branch_id ? String(data.branch_id) : null;
}

export async function fetchDefaultBranchId(): Promise<string | null> {
  const { data, error } = await (supabase as any).rpc('get_user_default_branch_id');
  if (error) throw new Error(error.message);
  return data ? String(data) : null;
}
