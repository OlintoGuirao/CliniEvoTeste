import { supabase } from '@/integrations/supabase/client';
import type { AccountType } from '@/lib/accountType';
import {
  isClinicalCouncilBody,
  resolveProfileRegistryBody,
} from '@/lib/clinicTeamRoles';

export type ClinicMemberRole = 'owner' | 'professional' | 'attendant';

export type ClinicTeamMember = {
  membership_id: string;
  user_id: string;
  role: ClinicMemberRole;
  branch_id?: string | null;
  branch_name?: string | null;
  created_at: string;
  email: string;
  full_name: string | null;
  is_blocked: boolean;
  account_type: AccountType;
  professional_registry_body?: string | null;
  professional_registry_number?: string | null;
  professional_specialty?: string | null;
  staff_title?: string | null;
  agenda_label_color?: string | null;
  agenda_label_nickname?: string | null;
  agenda_sort_order?: number | null;
};

export type ClinicTeamResponse = {
  organization: {
    id: string;
    name: string;
    type: AccountType;
  };
  members: ClinicTeamMember[];
};

async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');
  return token;
}

export async function fetchClinicTeam(): Promise<ClinicTeamResponse> {
  const token = await getAuthToken();
  const res = await fetch('/api/clinic/team', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Não foi possível carregar a equipe.');
  return json as ClinicTeamResponse;
}

export async function createClinicProfessional(params: {
  email: string;
  password: string;
  full_name: string;
  branch_id?: string | null;
  role?: 'professional' | 'attendant';
  professional_registry_body?: string | null;
  professional_registry_number?: string | null;
  professional_specialty?: string | null;
  staff_title?: string | null;
  agenda_label_color?: string | null;
}): Promise<{ user_id: string }> {
  const token = await getAuthToken();
  const res = await fetch('/api/clinic/team', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Não foi possível criar o profissional.');
  return { user_id: String(json?.user_id || '') };
}

export async function updateClinicMember(params: {
  user_id: string;
  full_name?: string;
  branch_id?: string | null;
  role?: 'professional' | 'attendant';
  professional_registry_body?: string | null;
  professional_registry_number?: string | null;
  professional_specialty?: string | null;
  staff_title?: string | null;
  agenda_label_color?: string | null;
  agenda_label_nickname?: string | null;
  agenda_sort_order?: number | null;
}): Promise<void> {
  const token = await getAuthToken();

  try {
    const res = await fetch('/api/clinic/team', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) return;

    // Servidor antigo sem PATCH → fallback Supabase
    if (res.status === 404 || res.status === 405) {
      await updateClinicMemberViaSupabase(params);
      return;
    }
    throw new Error(
      typeof json?.error === 'string' ? json.error : 'Não foi possível atualizar o membro.'
    );
  } catch (err) {
    if (err instanceof TypeError || (err instanceof Error && /failed to fetch/i.test(err.message))) {
      await updateClinicMemberViaSupabase(params);
      return;
    }
    throw err;
  }
}

/** Salão: grava apelido + ordem da agenda em lote (RPC, persiste de fato no banco). */
export async function saveSalonAgendaProfessionalsOrder(
  items: Array<{
    user_id: string;
    agenda_label_nickname?: string | null;
    agenda_sort_order: number;
  }>
): Promise<void> {
  const payload = items.map((item, index) => ({
    user_id: item.user_id,
    agenda_label_nickname: item.agenda_label_nickname?.trim() || null,
    agenda_sort_order: Number.isFinite(item.agenda_sort_order) ? item.agenda_sort_order : index,
  }));

  const { error } = await (supabase as any).rpc('save_salon_agenda_professionals_order', {
    p_items: payload,
  });

  if (error) {
    const msg = String(error.message || '');
    if (/agenda_label_nickname|agenda_sort_order|column .* does not exist/i.test(msg)) {
      throw new Error(
        'Falta aplicar a migration da ordem/apelido da agenda no Supabase (20260902120000 e 20260902170000).'
      );
    }
    if (/function .* does not exist|Could not find the function/i.test(msg)) {
      throw new Error(
        'Falta aplicar a migration 20260902170000_salon_agenda_professionals_order_rpc no Supabase.'
      );
    }
    throw new Error(msg || 'Não foi possível salvar a ordem da agenda.');
  }
}

async function updateClinicMemberViaSupabase(params: {
  user_id: string;
  full_name?: string;
  branch_id?: string | null;
  role?: 'professional' | 'attendant';
  professional_registry_body?: string | null;
  professional_registry_number?: string | null;
  professional_specialty?: string | null;
  staff_title?: string | null;
  agenda_label_color?: string | null;
  agenda_label_nickname?: string | null;
  agenda_sort_order?: number | null;
}): Promise<void> {
  const memberPatch: Record<string, unknown> = {};
  if (params.role) memberPatch.role = params.role;
  if (params.branch_id !== undefined) memberPatch.branch_id = params.branch_id;
  if (params.staff_title !== undefined) memberPatch.staff_title = params.staff_title;
  if (params.agenda_label_color !== undefined) {
    memberPatch.agenda_label_color = params.agenda_label_color;
  }
  if (params.agenda_label_nickname !== undefined) {
    memberPatch.agenda_label_nickname = params.agenda_label_nickname;
  }
  if (params.agenda_sort_order !== undefined) {
    memberPatch.agenda_sort_order = params.agenda_sort_order;
  }

  if (Object.keys(memberPatch).length > 0) {
    const { error } = await (supabase as any)
      .from('organization_members')
      .update(memberPatch)
      .eq('user_id', params.user_id);
    if (error) {
      throw new Error(
        /policy|rls|permission/i.test(error.message)
          ? 'Sem permissão para editar. Reinicie o servidor (npm run server) e tente novamente.'
          : error.message
      );
    }
  }

  if (
    params.full_name ||
    params.professional_registry_body !== undefined ||
    params.professional_registry_number !== undefined ||
    params.professional_specialty !== undefined ||
    params.staff_title !== undefined
  ) {
    const profilePatch: Record<string, unknown> = {};
    if (params.full_name && params.full_name.trim().length >= 2) {
      profilePatch.full_name = params.full_name.trim();
    }
    if (params.professional_registry_body !== undefined || params.staff_title !== undefined) {
      profilePatch.professional_registry_body = resolveProfileRegistryBody(
        params.professional_registry_body,
        params.staff_title
      );
    }
    if (params.professional_registry_number !== undefined) {
      profilePatch.professional_registry_number = isClinicalCouncilBody(
        params.professional_registry_body
      )
        ? params.professional_registry_number
        : null;
    }
    if (params.professional_specialty !== undefined) {
      profilePatch.professional_specialty = isClinicalCouncilBody(params.professional_registry_body)
        ? params.professional_specialty
        : null;
    }
    const { error } = await (supabase as any)
      .from('profiles')
      .update(profilePatch)
      .eq('id', params.user_id);
    if (error) throw new Error(error.message);
  }
}

export async function removeClinicProfessional(userId: string): Promise<void> {
  const token = await getAuthToken();
  const res = await fetch(`/api/clinic/team?user_id=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Não foi possível remover o profissional.');
}

/** Admin: lista membros de uma organização. */
export async function fetchOrganizationMembersAdmin(
  organizationId: string
): Promise<ClinicTeamMember[]> {
  const { data: members, error } = await (supabase as any)
    .from('organization_members')
    .select('id, user_id, role, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (members ?? []) as Array<{
    id: string;
    user_id: string;
    role: ClinicMemberRole;
    created_at: string;
  }>;
  if (!rows.length) return [];

  const ids = rows.map((m) => m.user_id);
  const { data: profiles, error: pErr } = await (supabase as any)
    .from('profiles')
    .select('id, email, full_name, is_blocked, account_type')
    .in('id', ids);
  if (pErr) throw new Error(pErr.message);

  const byId = new Map(
    ((profiles ?? []) as Array<{
      id: string;
      email: string;
      full_name: string | null;
      is_blocked?: boolean;
      account_type?: AccountType;
    }>).map((p) => [p.id, p])
  );

  return rows.map((m) => {
    const p = byId.get(m.user_id);
    return {
      membership_id: m.id,
      user_id: m.user_id,
      role: m.role,
      created_at: m.created_at,
      email: p?.email ?? '',
      full_name: p?.full_name ?? null,
      is_blocked: Boolean(p?.is_blocked),
      account_type:
        p?.account_type === 'clinic' || p?.account_type === 'salon' ? p.account_type : 'solo',
    };
  });
}
