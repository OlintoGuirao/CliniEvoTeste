/**
 * API do painel admin (Supabase direto; RLS restringe ao admin@clinievo.com.br).
 */

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  is_blocked?: boolean;
  blocked_at?: string | null;
  blocked_reason?: string | null;
  disabled_modules?: string[];
  account_type?: 'solo' | 'clinic' | 'salon';
  organization_id?: string | null;
  created_at?: string;
};
export type Procedure = {
  id: string;
  name: string;
  slug: string;
  category: string;
  specialty?: string | null;
  description?: string | null;
};
export type Permission = { id: string; profile_id: string; procedure_id: string; visible: boolean };

export type ProcedurePermissionsResponse = {
  profiles: Profile[];
  procedures: Procedure[];
  permissions: Permission[];
};

/** Obtém access token válido; limpa sessão local se o refresh token estiver inválido. */
async function getAdminAccessToken(): Promise<string> {
  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  const msg = String(refreshError?.message || '');
  if (refreshError && /refresh token|not found|invalid/i.test(msg)) {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // ignore
    }
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const token =
    refreshed.session?.access_token ||
    (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');
  return token;
}

export type AdminStats = {
  total_usuarios: number;
  usuarios_ativos: number;
  usuarios_bloqueados: number;
  total_procedimentos: number;
  total_perfis: number;
};

/** Estatísticas do dashboard admin (RPC). */
export async function fetchAdminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('get_admin_stats');
  if (error) throw new Error(error.message);
  const payload = data as (AdminStats & { error?: string }) | null;
  if (!payload || payload.error) throw new Error('Não autorizado');
  return payload;
}

export type DashboardInsights = {
  userGrowth: { date: string; count: number }[];
  proceduresCompleted: { date: string; count: number }[];
  distribution: { label: string; value: number }[];
};

/** Dados para gráficos do dashboard (últimos 30 dias). */
export async function fetchAdminDashboardInsights(): Promise<DashboardInsights> {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 30);
  const startStr = start.toISOString().slice(0, 10);

  const [profilesRes, instancesRes] = await Promise.all([
    supabase.from('profiles').select('created_at').gte('created_at', startStr),
    supabase
      .from('procedure_instances')
      .select('created_at')
      .gte('created_at', startStr),
  ]);

  const profileDates = (profilesRes.data ?? []).map((p) => (p.created_at as string).slice(0, 10));
  const instanceDates = (instancesRes.data ?? []).map((i) => (i.created_at as string).slice(0, 10));

  const days: string[] = [];
  for (let d = 0; d <= 30; d++) {
    const date = new Date(start);
    date.setDate(date.getDate() + d);
    days.push(date.toISOString().slice(0, 10));
  }

  const userGrowth = days.map((date) => {
    const count = profileDates.filter((pd) => pd === date).length;
    return { date, count };
  });

  const proceduresCompleted = days.map((date) => ({
    date,
    count: instanceDates.filter((id) => id === date).length,
  }));

  return { userGrowth, proceduresCompleted, distribution: [] };
}

/** Lista todos os perfis (apenas admin). */
export async function fetchAdminUsers(): Promise<Profile[]> {
  const { data, error } = await (supabase as any)
    .from('profiles')
    .select(
      'id, email, full_name, is_blocked, blocked_at, blocked_reason, created_at, disabled_modules, account_type, organization_id'
    )
    .order('full_name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}

/** Bloquear/desbloquear usuário. */
export async function setUserBlocked(params: {
  userId: string;
  blocked: boolean;
  reason?: string;
}): Promise<void> {
  const updates: { is_blocked: boolean; blocked_at: string | null; blocked_reason: string | null } = {
    is_blocked: params.blocked,
    blocked_at: params.blocked ? new Date().toISOString() : null,
    blocked_reason: params.blocked ? (params.reason ?? null) : null,
  };
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', params.userId);
  if (error) throw new Error(error.message);
}

/** Define módulos habilitados para um usuário (admin). Array vazio = todos habilitados. */
export async function setUserDisabledModules(params: { userId: string; disabledModules: string[] }): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ disabled_modules: params.disabledModules })
    .eq('id', params.userId);
  if (error) throw new Error(error.message);
}

/** Define o tipo de conta (solo | clinic | salon) e garante a organização. */
export async function setUserAccountType(params: {
  userId: string;
  accountType: 'solo' | 'clinic' | 'salon';
  organizationName?: string | null;
}): Promise<void> {
  const { error: rpcError } = await (supabase as any).rpc('ensure_profile_organization', {
    p_user_id: params.userId,
    p_account_type: params.accountType,
    p_org_name: params.organizationName?.trim() || null,
  });

  if (!rpcError) return;

  // Fallback se a migration ainda não estiver aplicada.
  const { error } = await (supabase as any)
    .from('profiles')
    .update({ account_type: params.accountType })
    .eq('id', params.userId);
  if (error) {
    const hint =
      params.accountType === 'salon'
        ? ' Aplique as migrations do tipo salon no Supabase.'
        : '';
    throw new Error((error.message || rpcError.message) + hint);
  }
}

/** Carrega profiles, procedures e permissions (permissões de procedimentos). */
export async function fetchProcedurePermissions(): Promise<ProcedurePermissionsResponse> {
  const [profilesRes, proceduresRes, permissionsRes] = await Promise.all([
    supabase.from('profiles').select('id, email, full_name').order('full_name'),
    (supabase as any)
      .from('procedures')
      .select('id, name, slug, category, specialty, description')
      .eq('is_active', true)
      .order('category')
      .order('name'),
    supabase.from('profile_procedure_permissions').select('id, profile_id, procedure_id, visible'),
  ]);
  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (proceduresRes.error) throw new Error(proceduresRes.error.message);
  if (permissionsRes.error) throw new Error(permissionsRes.error.message);
  return {
    profiles: profilesRes.data ?? [],
    procedures: (proceduresRes.data ?? []) as Procedure[],
    permissions: permissionsRes.data ?? [],
  };
}

/** Upsert de uma permissão procedimento por perfil. */
export async function upsertProcedurePermission(body: {
  profileId: string;
  procedureId: string;
  visible: boolean;
}): Promise<Permission> {
  const { data, error } = await supabase
    .from('profile_procedure_permissions')
    .upsert(
      { profile_id: body.profileId, procedure_id: body.procedureId, visible: body.visible },
      { onConflict: 'profile_id,procedure_id' }
    )
    .select('id, profile_id, procedure_id, visible')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createProcedure(body: {
  name: string;
  slug: string;
  category: string;
  specialty?: string | null;
  description?: string;
}): Promise<Procedure> {
  const payload = {
    name: body.name.trim(),
    slug: body.slug.trim().toLowerCase(),
    category: body.category.trim(),
    specialty: body.specialty?.trim() || null,
    description: body.description?.trim() || null,
    is_global: true,
    created_by: null,
    is_active: true,
  };
  const { data, error } = await (supabase as any)
    .from('procedures')
    .insert(payload)
    .select('id, name, slug, category, specialty, description')
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Procedure;
}

export async function updateProcedure(body: {
  procedureId: string;
  name: string;
  slug: string;
  category: string;
  specialty?: string | null;
  description?: string;
}): Promise<Procedure> {
  const { data, error } = await (supabase as any)
    .from('procedures')
    .update({
      name: body.name.trim(),
      slug: body.slug.trim().toLowerCase(),
      category: body.category.trim(),
      specialty: body.specialty?.trim() || null,
      description: body.description?.trim() || null,
    })
    .eq('id', body.procedureId)
    .select('id, name, slug, category, specialty, description')
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Procedure;
}

export async function deleteProcedure(procedureId: string): Promise<void> {
  const { error } = await supabase.from('procedures').delete().eq('id', procedureId);
  if (error) throw new Error(error.message);
}

export type ProcedureFieldType = 'text' | 'number' | 'select' | 'boolean' | 'date' | 'image';

export async function createProcedureField(body: {
  procedureId: string;
  fieldKey: string;
  label: string;
  fieldType: ProcedureFieldType;
  options?: string[];
  sortOrder?: number;
}): Promise<void> {
  const options = body.fieldType === 'select' ? (body.options ?? []).filter(Boolean) : [];
  const { error } = await supabase.from('procedure_fields').insert({
    procedure_id: body.procedureId,
    field_key: body.fieldKey.trim(),
    label: body.label.trim(),
    field_type: body.fieldType,
    options,
    sort_order: body.sortOrder ?? 0,
  });
  if (error) throw new Error(error.message);
}

export async function updateProcedureField(body: {
  fieldId: string;
  fieldKey: string;
  label: string;
  fieldType: ProcedureFieldType;
  options?: string[];
}): Promise<void> {
  const options = body.fieldType === 'select' ? (body.options ?? []).filter(Boolean) : [];
  const { error } = await supabase
    .from('procedure_fields')
    .update({
      field_key: body.fieldKey.trim(),
      label: body.label.trim(),
      field_type: body.fieldType,
      options,
    })
    .eq('id', body.fieldId);
  if (error) throw new Error(error.message);
}

export async function deleteProcedureField(fieldId: string): Promise<void> {
  const { error } = await supabase.from('procedure_fields').delete().eq('id', fieldId);
  if (error) throw new Error(error.message);
}

export type AdminActivityEntry = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  admin_email: string;
  created_at: string;
};

/** Últimas atividades do admin. */
export async function fetchAdminActivityLog(limit = 10): Promise<AdminActivityEntry[]> {
  const { data, error } = await supabase
    .from('admin_activity_log')
    .select('id, action, entity_type, entity_id, details, admin_email, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row): AdminActivityEntry => ({
    id: row.id,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    admin_email: row.admin_email,
    created_at: row.created_at,
    details:
      row.details && typeof row.details === 'object' && !Array.isArray(row.details)
        ? (row.details as Record<string, unknown>)
        : null,
  }));
}

/** Registra uma atividade no log (apenas admin). */
export async function logAdminActivity(entry: {
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  admin_email: string;
}): Promise<void> {
  const { error } = await supabase.from('admin_activity_log').insert({
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id ?? null,
    details: (entry.details ?? null) as Json,
    admin_email: entry.admin_email,
  });
  if (error) throw new Error(error.message);
}

/** Cria novo usuário (admin). */
export async function adminCreateUser(params: {
  email: string;
  password: string;
  full_name: string;
  account_type?: 'solo' | 'clinic' | 'salon';
  organization_name?: string | null;
}): Promise<{ user?: { id: string; email?: string }; account_type?: 'solo' | 'clinic' | 'salon' }> {
  const token = await getAdminAccessToken();

  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Erro ao criar perfil.');
  return json;
}

/** Gera link de redefinição de senha (admin). */
export async function generatePasswordResetLink(email: string): Promise<{ action_link: string | null }> {
  const token = await getAdminAccessToken();

  const res = await fetch('/api/admin/password-reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ email }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Erro ao gerar link de redefinição.');
  return { action_link: json?.action_link ?? null };
}

/** Define uma nova senha manualmente (admin). */
export async function adminSetUserPassword(params: { userId: string; password: string }): Promise<void> {
  const token = await getAdminAccessToken();

  const res = await fetch('/api/admin/set-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: params.userId, password: params.password }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Erro ao redefinir senha.');
}

/** Exclui um usuário permanentemente (admin). */
export async function adminDeleteUser(userId: string): Promise<void> {
  const token = await getAdminAccessToken();

  const res = await fetch('/api/admin/delete-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: userId }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Erro ao excluir usuário.');
}

