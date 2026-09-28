import { supabase } from '@/integrations/supabase/client';
import type { ClinicMemberRole } from '@/services/api/clinicTeamApi';
import { updateClinicMember } from '@/services/api/clinicTeamApi';

export type SalonAgendaMemberSortable = {
  user_id: string;
  full_name: string | null;
  role: ClinicMemberRole;
  agenda_sort_order?: number | null;
  agenda_label_nickname?: string | null;
  agenda_label_color?: string | null;
  is_blocked?: boolean;
  staff_title?: string | null;
};

/** Apelido na agenda ou primeiro nome como fallback. */
export function resolveSalonAgendaDisplayLabel(member: {
  full_name?: string | null;
  agenda_label_nickname?: string | null;
}): string {
  const nickname = member.agenda_label_nickname?.trim();
  if (nickname) return nickname;
  const name = member.full_name?.trim();
  if (!name) return '?';
  const first = name.split(/\s+/)[0];
  return first || name;
}

export function isSalonAgendaBookableMember(member: SalonAgendaMemberSortable): boolean {
  return !member.is_blocked && member.role !== 'attendant';
}

export function sortSalonAgendaMembers<T extends SalonAgendaMemberSortable>(members: T[]): T[] {
  return [...members].sort((a, b) => {
    const ao = a.agenda_sort_order ?? 0;
    const bo = b.agenda_sort_order ?? 0;
    if (ao !== bo) return ao - bo;
    if (a.role === 'owner' && b.role !== 'owner') return -1;
    if (b.role === 'owner' && a.role !== 'owner') return 1;
    return (a.full_name ?? '').localeCompare(b.full_name ?? '', 'pt-BR');
  });
}

export function mapSalonAgendaProfessional(member: SalonAgendaMemberSortable) {
  return {
    userId: member.user_id,
    name: member.full_name?.trim() || 'Profissional',
    displayLabel: resolveSalonAgendaDisplayLabel(member),
    color: member.agenda_label_color ?? null,
    sortOrder: member.agenda_sort_order ?? 0,
  };
}

export type SalonAgendaProfessional = ReturnType<typeof mapSalonAgendaProfessional>;

export const salonAgendaTeamQueryKey = (organizationId: string | null | undefined) =>
  ['salon-agenda-team', organizationId ?? ''] as const;

/** Lê ordem/apelido direto do Supabase (fonte da verdade da agenda do salão). */
export async function fetchSalonAgendaTeamMembers(
  organizationId: string
): Promise<SalonAgendaMemberSortable[]> {
  const { data: members, error } = await (supabase as any)
    .from('organization_members')
    .select(
      'user_id, role, staff_title, agenda_label_color, agenda_label_nickname, agenda_sort_order'
    )
    .eq('organization_id', organizationId);

  if (error) {
    const msg = String(error.message || '');
    if (/agenda_label_nickname|agenda_sort_order|column .* does not exist/i.test(msg)) {
      throw new Error(
        'Falta aplicar a migration 20260902120000_salon_agenda_member_order no Supabase.'
      );
    }
    throw new Error(msg || 'Não foi possível carregar a equipe da agenda.');
  }

  const rows = (members ?? []) as Array<{
    user_id: string;
    role: ClinicMemberRole;
    staff_title?: string | null;
    agenda_label_color?: string | null;
    agenda_label_nickname?: string | null;
    agenda_sort_order?: number | null;
  }>;

  if (!rows.length) return [];

  const ids = rows.map((m) => m.user_id);
  const { data: profiles, error: pErr } = await (supabase as any)
    .from('profiles')
    .select('id, full_name, is_blocked')
    .in('id', ids);
  if (pErr) throw new Error(pErr.message);

  const byId = new Map(
    ((profiles ?? []) as Array<{ id: string; full_name: string | null; is_blocked?: boolean }>).map(
      (p) => [p.id, p]
    )
  );

  return sortSalonAgendaMembers(
    rows.map((m) => {
      const p = byId.get(m.user_id);
      return {
        user_id: m.user_id,
        role: m.role,
        full_name: p?.full_name ?? null,
        is_blocked: Boolean(p?.is_blocked),
        staff_title: m.staff_title ?? null,
        agenda_label_color: m.agenda_label_color ?? null,
        agenda_label_nickname: m.agenda_label_nickname ?? null,
        agenda_sort_order: m.agenda_sort_order ?? 0,
      };
    })
  );
}

/** Grava e relê do banco para confirmar persistência. */
export async function saveAndReloadSalonAgendaProfessionalsOrder(
  organizationId: string,
  items: Array<{
    user_id: string;
    agenda_label_nickname?: string | null;
    agenda_sort_order: number;
  }>
): Promise<SalonAgendaMemberSortable[]> {
  const payload = items.map((item, index) => ({
    user_id: item.user_id,
    agenda_label_nickname: item.agenda_label_nickname?.trim() || null,
    agenda_sort_order: Number.isFinite(item.agenda_sort_order) ? item.agenda_sort_order : index,
  }));

  const { error: rpcError } = await (supabase as any).rpc('save_salon_agenda_professionals_order', {
    p_items: payload,
  });

  if (rpcError) {
    // Fallback: API com service role (mesmo caminho da cor da etiqueta).
    try {
      await Promise.all(
        payload.map((item) =>
          updateClinicMember({
            user_id: item.user_id,
            agenda_label_nickname: item.agenda_label_nickname,
            agenda_sort_order: item.agenda_sort_order,
          })
        )
      );
    } catch (apiErr) {
      const msg = String(rpcError.message || '');
      if (/function .* does not exist|Could not find the function/i.test(msg)) {
        throw new Error(
          'Falta aplicar a migration 20260902170000_salon_agenda_professionals_order_rpc no Supabase.'
        );
      }
      throw apiErr instanceof Error
        ? apiErr
        : new Error(msg || 'Não foi possível salvar a ordem da agenda.');
    }
  }

  let reloaded = await fetchSalonAgendaTeamMembers(organizationId);
  let byId = new Map(reloaded.map((m) => [m.user_id, m]));
  let confirmed = payload.every((item) => {
    const row = byId.get(item.user_id);
    if (!row) return false;
    const savedNick = row.agenda_label_nickname?.trim() || null;
    const wantNick = item.agenda_label_nickname?.trim() || null;
    return savedNick === wantNick && Number(row.agenda_sort_order ?? 0) === Number(item.agenda_sort_order);
  });

  if (!confirmed) {
    // Fallback direto no cliente (precisa da policy 20260902171000).
    await Promise.all(
      payload.map(async (item) => {
        const { error } = await (supabase as any)
          .from('organization_members')
          .update({
            agenda_label_nickname: item.agenda_label_nickname,
            agenda_sort_order: item.agenda_sort_order,
          })
          .eq('organization_id', organizationId)
          .eq('user_id', item.user_id);
        if (error) throw new Error(error.message);
      })
    );

    await Promise.all(
      payload.map((item) =>
        updateClinicMember({
          user_id: item.user_id,
          agenda_label_nickname: item.agenda_label_nickname,
          agenda_sort_order: item.agenda_sort_order,
        }).catch(() => undefined)
      )
    );

    reloaded = await fetchSalonAgendaTeamMembers(organizationId);
    byId = new Map(reloaded.map((m) => [m.user_id, m]));
    confirmed = payload.every((item) => {
      const row = byId.get(item.user_id);
      if (!row) return false;
      const savedNick = row.agenda_label_nickname?.trim() || null;
      const wantNick = item.agenda_label_nickname?.trim() || null;
      return (
        savedNick === wantNick && Number(row.agenda_sort_order ?? 0) === Number(item.agenda_sort_order)
      );
    });
  }

  if (!confirmed) {
    throw new Error(
      'O banco não confirmou a alteração. Aplique as migrations 20260902120000 e 20260902170000 e tente novamente.'
    );
  }

  return reloaded;
}
