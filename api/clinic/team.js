/**
 * /api/clinic/team
 * GET    — lista equipe da clínica (Master)
 * POST   — cria profissional na clínica (Master)
 * PATCH  — edita membro (nome, papel, filial) (Master)
 * DELETE — remove profissional da clínica (Master) ?user_id=
 */

import { enforceRateLimit } from '../_lib/rateLimit.js';
import { parseBody, clinicCreateProfessionalSchema, clinicUpdateMemberSchema } from '../_lib/schemas.js';
import { jsonResponse, requireClinicOwner } from '../_lib/clinicAuth.js';
import { removeClinicMemberWithCleanup } from '../_lib/removeClinicMemberWithCleanup.js';
import {
  isClinicalCouncilBody,
  resolveProfileRegistryBody,
} from '../_lib/clinicTeamProfile.js';

async function listTeam(ctx) {
  const { data: members, error } = await ctx.admin
    .from('organization_members')
    .select('id, user_id, role, branch_id, staff_title, agenda_label_color, agenda_label_nickname, agenda_sort_order, created_at')
    .eq('organization_id', ctx.organizationId)
    .order('agenda_sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return jsonResponse({ error: error.message }, 500);

  const rows = members || [];
  const ids = rows.map((m) => m.user_id).filter(Boolean);
  const branchIds = rows.map((m) => m.branch_id).filter(Boolean);
  let profilesById = new Map();
  let branchesById = new Map();
  if (ids.length) {
    const { data: profiles, error: pErr } = await ctx.admin
      .from('profiles')
      .select(
        'id, email, full_name, is_blocked, account_type, professional_registry_body, professional_registry_number, professional_specialty'
      )
      .in('id', ids);
    if (pErr) return jsonResponse({ error: pErr.message }, 500);
    profilesById = new Map((profiles || []).map((p) => [p.id, p]));
  }
  if (branchIds.length) {
    const { data: branches, error: bErr } = await ctx.admin
      .from('organization_branches')
      .select('id, name')
      .in('id', branchIds);
    if (bErr) return jsonResponse({ error: bErr.message }, 500);
    branchesById = new Map((branches || []).map((b) => [b.id, b]));
  }

  return jsonResponse({
    organization: ctx.organization,
    members: rows.map((m) => {
      const p = profilesById.get(m.user_id);
      const branch = m.branch_id ? branchesById.get(m.branch_id) : null;
      return {
        membership_id: m.id,
        user_id: m.user_id,
        role: m.role,
        branch_id: m.branch_id ?? null,
        branch_name: branch?.name ?? null,
        created_at: m.created_at,
        email: p?.email || '',
        full_name: p?.full_name ?? null,
        is_blocked: Boolean(p?.is_blocked),
        account_type:
          p?.account_type === 'clinic' || p?.account_type === 'salon' ? p.account_type : 'solo',
        professional_registry_body: p?.professional_registry_body ?? null,
        professional_registry_number: p?.professional_registry_number ?? null,
        professional_specialty: p?.professional_specialty ?? null,
        staff_title: m.staff_title ?? null,
        agenda_label_color: m.agenda_label_color ?? null,
        agenda_label_nickname: m.agenda_label_nickname ?? null,
        agenda_sort_order: m.agenda_sort_order ?? 0,
      };
    }),
  });
}

async function createProfessional(request, ctx) {
  const parsed = await parseBody(request, clinicCreateProfessionalSchema);
  if (parsed.error) {
    return jsonResponse({ error: parsed.error }, parsed.status ?? 400);
  }
  const {
    email,
    password,
    full_name,
    branch_id,
    role,
    professional_registry_body,
    professional_registry_number,
    professional_specialty,
    staff_title,
    agenda_label_color,
  } = parsed.data;

  const { data, error } = await ctx.admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (error) {
    const msg = error.message || 'Erro ao criar profissional';
    if (msg.includes('already') || msg.includes('registered')) {
      return jsonResponse({ error: 'Este e-mail já está cadastrado.' }, 409);
    }
    return jsonResponse({ error: msg }, 500);
  }

  const userId = data?.user?.id;
  if (!userId) {
    return jsonResponse({ error: 'Usuário criado sem ID.' }, 500);
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data: profileRow } = await ctx.admin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (profileRow?.id) break;
    await new Promise((r) => setTimeout(r, 150));
  }

  // Se o trigger/backfill criou org solo, remove membership solo antes de vincular à clínica
  await ctx.admin.from('organization_members').delete().eq('user_id', userId);

  const { error: addErr } = await ctx.admin.rpc('add_clinic_member', {
    p_organization_id: ctx.organizationId,
    p_user_id: userId,
    p_branch_id: branch_id ?? null,
    p_role: role,
  });

  if (addErr) {
    const { error: legacyErr } = await ctx.admin.rpc('add_clinic_professional', {
      p_organization_id: ctx.organizationId,
      p_user_id: userId,
      p_branch_id: branch_id ?? null,
    });

    if (legacyErr) {
      await ctx.admin
        .from('profiles')
        .update({
          full_name,
          organization_id: ctx.organizationId,
          account_type: ctx.organization?.type === 'salon' ? 'salon' : 'clinic',
        })
        .eq('id', userId);

      const { error: memErr } = await ctx.admin.from('organization_members').upsert(
        {
          organization_id: ctx.organizationId,
          user_id: userId,
          role: role || 'professional',
          branch_id: branch_id ?? null,
          staff_title: staff_title ?? null,
          agenda_label_color: agenda_label_color ?? null,
        },
        { onConflict: 'organization_id,user_id' }
      );

      if (memErr) {
        return jsonResponse(
          { error: addErr.message || legacyErr.message || memErr.message || 'Falha ao vincular à clínica.' },
          500
        );
      }
    }
  }

  const memberExtras = {
    staff_title: staff_title ?? null,
    agenda_label_color: agenda_label_color ?? null,
  };
  if (role) memberExtras.role = role;
  const { error: extrasErr } = await ctx.admin
    .from('organization_members')
    .update(memberExtras)
    .eq('organization_id', ctx.organizationId)
    .eq('user_id', userId);
  if (extrasErr) {
    return jsonResponse({ error: extrasErr.message }, 500);
  }

  await ctx.admin
    .from('profiles')
    .update({
      full_name,
      professional_registry_body: resolveProfileRegistryBody(
        professional_registry_body,
        staff_title
      ),
      professional_registry_number: professional_registry_body
        ? professional_registry_number ?? null
        : null,
      professional_specialty: professional_registry_body ? professional_specialty ?? null : null,
    })
    .eq('id', userId);

  return jsonResponse({ ok: true, user_id: userId }, 201);
}

/** Admin do salão pode editar próprio perfil (nome, função, cor da etiqueta). */
async function updateSalonOwnerMember(
  ctx,
  userId,
  { full_name, staff_title, agenda_label_color, agenda_label_nickname, agenda_sort_order }
) {
  const memberPatch = {};
  if (staff_title !== undefined) memberPatch.staff_title = staff_title;
  if (agenda_label_color !== undefined) memberPatch.agenda_label_color = agenda_label_color;
  if (agenda_label_nickname !== undefined) memberPatch.agenda_label_nickname = agenda_label_nickname;
  if (agenda_sort_order !== undefined) memberPatch.agenda_sort_order = agenda_sort_order;

  if (Object.keys(memberPatch).length > 0) {
    const { error: memErr } = await ctx.admin
      .from('organization_members')
      .update(memberPatch)
      .eq('organization_id', ctx.organizationId)
      .eq('user_id', userId);
    if (memErr) return jsonResponse({ error: memErr.message }, 500);
  }

  if (full_name && String(full_name).trim().length >= 2) {
    const { error: profileErr } = await ctx.admin
      .from('profiles')
      .update({ full_name: String(full_name).trim() })
      .eq('id', userId);
    if (profileErr) return jsonResponse({ error: profileErr.message }, 500);
  }

  return jsonResponse({ ok: true, user_id: userId });
}

async function updateMember(request, ctx) {
  const parsed = await parseBody(request, clinicUpdateMemberSchema);
  if (parsed.error) {
    return jsonResponse({ error: parsed.error }, parsed.status ?? 400);
  }

  const {
    user_id: userId,
    full_name,
    branch_id,
    role,
    professional_registry_body,
    professional_registry_number,
    professional_specialty,
    staff_title,
    agenda_label_color,
    agenda_label_nickname,
    agenda_sort_order,
  } = parsed.data;

  const { data: membership, error: findErr } = await ctx.admin
    .from('organization_members')
    .select('id, role')
    .eq('organization_id', ctx.organizationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (findErr) return jsonResponse({ error: findErr.message }, 500);
  if (!membership) return jsonResponse({ error: 'Membro não encontrado nesta clínica.' }, 404);

  if (membership.role === 'owner') {
    if (userId !== ctx.ownerUserId) {
      return jsonResponse({ error: 'Não é possível editar o Master por esta tela.' }, 400);
    }
    if (ctx.organization?.type !== 'salon') {
      return jsonResponse({ error: 'Não é possível editar o Master por esta tela.' }, 400);
    }
    return updateSalonOwnerMember(ctx, userId, {
      full_name,
      staff_title,
      agenda_label_color,
      agenda_label_nickname,
      agenda_sort_order,
    });
  }

  if (userId === ctx.ownerUserId) {
    return jsonResponse({ error: 'Não é possível editar o Master por esta tela.' }, 400);
  }

  if (branch_id) {
    const { data: branch, error: branchErr } = await ctx.admin
      .from('organization_branches')
      .select('id')
      .eq('id', branch_id)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();
    if (branchErr) return jsonResponse({ error: branchErr.message }, 500);
    if (!branch) return jsonResponse({ error: 'Filial inválida para esta clínica.' }, 400);
  }

  const memberPatch = {};
  if (role !== undefined) memberPatch.role = role;
  if (branch_id !== undefined) memberPatch.branch_id = branch_id;
  if (staff_title !== undefined) memberPatch.staff_title = staff_title;
  if (agenda_label_color !== undefined) memberPatch.agenda_label_color = agenda_label_color;
  if (agenda_label_nickname !== undefined) memberPatch.agenda_label_nickname = agenda_label_nickname;
  if (agenda_sort_order !== undefined) memberPatch.agenda_sort_order = agenda_sort_order;
  if (isClinicalCouncilBody(professional_registry_body)) {
    memberPatch.staff_title = null;
  }

  if (Object.keys(memberPatch).length > 0) {
    const { error: memErr } = await ctx.admin
      .from('organization_members')
      .update(memberPatch)
      .eq('organization_id', ctx.organizationId)
      .eq('user_id', userId);
    if (memErr) return jsonResponse({ error: memErr.message }, 500);
  }

  const profilePatch = {};
  if (full_name) profilePatch.full_name = full_name;
  if (professional_registry_body !== undefined || staff_title !== undefined) {
    profilePatch.professional_registry_body = resolveProfileRegistryBody(
      professional_registry_body,
      staff_title
    );
  }
  if (professional_registry_number !== undefined) {
    profilePatch.professional_registry_number = isClinicalCouncilBody(professional_registry_body)
      ? professional_registry_number
      : null;
  }
  if (professional_specialty !== undefined) {
    profilePatch.professional_specialty = isClinicalCouncilBody(professional_registry_body)
      ? professional_specialty
      : null;
  }

  if (Object.keys(profilePatch).length > 0) {
    const { error: profileErr } = await ctx.admin
      .from('profiles')
      .update(profilePatch)
      .eq('id', userId);
    if (profileErr) return jsonResponse({ error: profileErr.message }, 500);
  }

  return jsonResponse({ ok: true, user_id: userId });
}

async function removeProfessional(request, ctx) {
  const url = new URL(request.url);
  const userId = String(url.searchParams.get('user_id') || '').trim();
  try {
    const result = await removeClinicMemberWithCleanup(
      ctx.admin,
      ctx.organizationId,
      userId,
      ctx.ownerUserId
    );
    return jsonResponse(result);
  } catch (err) {
    const msg = err?.message || 'Erro ao remover membro';
    const status =
      msg.includes('inválido') || msg.includes('Master') || msg.includes('não encontrado')
        ? 400
        : 500;
    return jsonResponse({ error: msg }, status);
  }
}

export async function GET(request) {
  const blocked = await enforceRateLimit(request, 'clinic-team', 'Muitas requisições. Tente novamente em 1 minuto.');
  if (blocked) return blocked;
  const ctx = await requireClinicOwner(request);
  if (ctx.error) return ctx.error;
  return listTeam(ctx);
}

export async function POST(request) {
  const blocked = await enforceRateLimit(request, 'clinic-team', 'Muitas requisições. Tente novamente em 1 minuto.');
  if (blocked) return blocked;
  const ctx = await requireClinicOwner(request);
  if (ctx.error) return ctx.error;
  return createProfessional(request, ctx);
}

export async function PATCH(request) {
  const blocked = await enforceRateLimit(request, 'clinic-team', 'Muitas requisições. Tente novamente em 1 minuto.');
  if (blocked) return blocked;
  const ctx = await requireClinicOwner(request);
  if (ctx.error) return ctx.error;
  return updateMember(request, ctx);
}

export async function DELETE(request) {
  const blocked = await enforceRateLimit(request, 'clinic-team', 'Muitas requisições. Tente novamente em 1 minuto.');
  if (blocked) return blocked;
  const ctx = await requireClinicOwner(request);
  if (ctx.error) return ctx.error;
  return removeProfessional(request, ctx);
}
