import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { createBranchWithLogin } from '../../../api/_lib/createBranchWithLogin.js';
import { deleteBranchWithCleanup } from '../../../api/_lib/deleteBranchWithCleanup.js';
import { removeClinicMemberWithCleanup } from '../../../api/_lib/removeClinicMemberWithCleanup.js';
import {
  isClinicalCouncilBody,
  resolveProfileRegistryBody,
} from '../../../api/_lib/clinicTeamProfile.js';
import { buildClinicMasterDashboard } from '../../../api/_lib/clinicMasterDashboard.js';

const router = Router();

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@clinievo.com.br').trim();
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function requireClinicOwner(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não informado. Faça login novamente.' });
  }
  const token = authHeader.slice(7).trim();
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Configuração do servidor inválida' });
  }

  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    const userData = await userRes.json().catch(() => ({}));
    if (!userRes.ok || !userData?.id) {
      return res.status(401).json({ error: 'Token expirado ou inválido. Faça login novamente.' });
    }

    const admin = getAdminClient();
    const { data: membership, error } = await admin
      .from('organization_members')
      .select('organization_id, role, organizations!inner(id, name, type)')
      .eq('user_id', userData.id)
      .eq('role', 'owner')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    const org = membership?.organizations;
    const orgRow = Array.isArray(org) ? org[0] : org;
    const orgType = orgRow?.type === 'salon' ? 'salon' : orgRow?.type === 'clinic' ? 'clinic' : null;
    if (!membership?.organization_id || !orgType) {
      return res.status(403).json({ error: 'Acesso restrito ao Admin/Master da organização.' });
    }

    req.clinic = {
      admin,
      ownerUserId: String(userData.id),
      organizationId: String(membership.organization_id),
      organization: {
        id: String(orgRow.id),
        name: String(orgRow.name || (orgType === 'salon' ? 'Salão' : 'Clínica')),
        type: orgType,
      },
    };
    next();
  } catch (err) {
    console.error('requireClinicOwner:', err);
    return res.status(401).json({ error: 'Não autorizado.' });
  }
}

router.use(requireClinicOwner);

router.get('/team', async (req, res) => {
  try {
    const { admin, organizationId, organization } = req.clinic;
    const { data: members, error } = await admin
      .from('organization_members')
      .select('id, user_id, role, branch_id, staff_title, agenda_label_color, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    const rows = members || [];
    const ids = rows.map((m) => m.user_id).filter(Boolean);
    const branchIds = rows.map((m) => m.branch_id).filter(Boolean);
    let profilesById = new Map();
    let branchesById = new Map();
    if (ids.length) {
      const { data: profiles, error: pErr } = await admin
        .from('profiles')
        .select(
          'id, email, full_name, is_blocked, account_type, professional_registry_body, professional_registry_number, professional_specialty'
        )
        .in('id', ids);
      if (pErr) return res.status(500).json({ error: pErr.message });
      profilesById = new Map((profiles || []).map((p) => [p.id, p]));
    }
    if (branchIds.length) {
      const { data: branches, error: bErr } = await admin
        .from('organization_branches')
        .select('id, name')
        .in('id', branchIds);
      if (bErr) return res.status(500).json({ error: bErr.message });
      branchesById = new Map((branches || []).map((b) => [b.id, b]));
    }

    return res.json({
      organization,
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
            p?.account_type === 'clinic' || p?.account_type === 'salon'
              ? p.account_type
              : 'solo',
          professional_registry_body: p?.professional_registry_body ?? null,
          professional_registry_number: p?.professional_registry_number ?? null,
          professional_specialty: p?.professional_specialty ?? null,
          staff_title: m.staff_title ?? null,
          agenda_label_color: m.agenda_label_color ?? null,
        };
      }),
    });
  } catch (err) {
    console.error('clinic team list:', err);
    return res.status(500).json({ error: err.message || 'Erro ao listar equipe' });
  }
});

router.post('/team', async (req, res) => {
  try {
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
    } = req.body || {};
    if (!email || !password || !full_name || String(full_name).trim().length < 2) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 8 caracteres.' });
    }

    const { admin, organizationId, organization } = req.clinic;
    const { data, error } = await admin.auth.admin.createUser({
      email: String(email).trim(),
      password: String(password),
      email_confirm: true,
      user_metadata: { full_name: String(full_name).trim() },
    });
    if (error) {
      const msg = error.message || 'Erro ao criar profissional';
      if (msg.includes('already') || msg.includes('registered')) {
        return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
      }
      return res.status(500).json({ error: msg });
    }

    const userId = data?.user?.id;
    if (!userId) return res.status(500).json({ error: 'Usuário criado sem ID.' });

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { data: profileRow } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle();
      if (profileRow?.id) break;
      await new Promise((r) => setTimeout(r, 150));
    }

    await admin.from('organization_members').delete().eq('user_id', userId);
    const memberRole = role === 'attendant' ? 'attendant' : 'professional';
    const { error: addErr } = await admin.rpc('add_clinic_member', {
      p_organization_id: organizationId,
      p_user_id: userId,
      p_branch_id: branch_id || null,
      p_role: memberRole,
    });
    if (addErr) {
      const { error: legacyErr } = await admin.rpc('add_clinic_professional', {
        p_organization_id: organizationId,
        p_user_id: userId,
        p_branch_id: branch_id || null,
      });
      if (legacyErr) {
        await admin
          .from('profiles')
          .update({
            full_name: String(full_name).trim(),
            organization_id: organizationId,
            account_type: organization?.type === 'salon' ? 'salon' : 'clinic',
          })
          .eq('id', userId);
        const { error: memErr } = await admin.from('organization_members').upsert(
          {
            organization_id: organizationId,
            user_id: userId,
            role: memberRole,
            branch_id: branch_id || null,
            staff_title: staff_title || null,
            agenda_label_color: agenda_label_color || null,
          },
          { onConflict: 'organization_id,user_id' }
        );
        if (memErr) {
          return res.status(500).json({
            error: addErr.message || legacyErr.message || memErr.message,
          });
        }
      }
    }

    const { error: extrasErr } = await admin
      .from('organization_members')
      .update({
        staff_title: staff_title ?? null,
        agenda_label_color: agenda_label_color ?? null,
      })
      .eq('organization_id', organizationId)
      .eq('user_id', userId);
    if (extrasErr) {
      return res.status(500).json({ error: extrasErr.message });
    }

    const { error: profileErr } = await admin
      .from('profiles')
      .update({
        full_name: String(full_name).trim(),
        professional_registry_body: resolveProfileRegistryBody(
          professional_registry_body,
          staff_title
        ),
        professional_registry_number: professional_registry_body
          ? professional_registry_number || null
          : null,
        professional_specialty: professional_registry_body ? professional_specialty || null : null,
      })
      .eq('id', userId);
    if (profileErr) return res.status(500).json({ error: profileErr.message });

    return res.status(201).json({ ok: true, user_id: userId });
  } catch (err) {
    console.error('clinic team create:', err);
    return res.status(500).json({ error: err.message || 'Erro ao criar profissional' });
  }
});

router.patch('/team', async (req, res) => {
  try {
    const {
      user_id,
      full_name,
      branch_id,
      role,
      professional_registry_body,
      professional_registry_number,
      professional_specialty,
      staff_title,
      agenda_label_color,
    } = req.body || {};
    if (!user_id || !/^[0-9a-f-]{36}$/i.test(String(user_id))) {
      return res.status(400).json({ error: 'ID de usuário inválido.' });
    }

    const { admin, organizationId, organization, ownerUserId } = req.clinic;
    const { data: membership, error: findErr } = await admin
      .from('organization_members')
      .select('id, role')
      .eq('organization_id', organizationId)
      .eq('user_id', user_id)
      .maybeSingle();
    if (findErr) return res.status(500).json({ error: findErr.message });
    if (!membership) return res.status(404).json({ error: 'Membro não encontrado nesta clínica.' });

    if (membership.role === 'owner') {
      if (String(user_id) !== String(ownerUserId)) {
        return res.status(400).json({ error: 'Não é possível editar o Master por esta tela.' });
      }
      if (organization?.type !== 'salon') {
        return res.status(400).json({ error: 'Não é possível editar o Master por esta tela.' });
      }
      const memberPatch = {};
      if (staff_title !== undefined) memberPatch.staff_title = staff_title;
      if (agenda_label_color !== undefined) {
        memberPatch.agenda_label_color = agenda_label_color || null;
      }
      if (Object.keys(memberPatch).length > 0) {
        const { error: memErr } = await admin
          .from('organization_members')
          .update(memberPatch)
          .eq('organization_id', organizationId)
          .eq('user_id', user_id);
        if (memErr) return res.status(500).json({ error: memErr.message });
      }
      if (full_name && String(full_name).trim().length >= 2) {
        const { error: profileErr } = await admin
          .from('profiles')
          .update({ full_name: String(full_name).trim() })
          .eq('id', user_id);
        if (profileErr) return res.status(500).json({ error: profileErr.message });
      }
      return res.json({ ok: true, user_id });
    }

    if (String(user_id) === String(ownerUserId)) {
      return res.status(400).json({ error: 'Não é possível editar o Master por esta tela.' });
    }

    if (branch_id) {
      const { data: branch, error: branchErr } = await admin
        .from('organization_branches')
        .select('id')
        .eq('id', branch_id)
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (branchErr) return res.status(500).json({ error: branchErr.message });
      if (!branch) return res.status(400).json({ error: 'Filial inválida para esta clínica.' });
    }

    const memberPatch = {};
    if (role === 'professional' || role === 'attendant') memberPatch.role = role;
    if (branch_id !== undefined) memberPatch.branch_id = branch_id || null;
    if (staff_title !== undefined) memberPatch.staff_title = staff_title;
    if (agenda_label_color !== undefined) memberPatch.agenda_label_color = agenda_label_color || null;
    if (isClinicalCouncilBody(professional_registry_body)) {
      memberPatch.staff_title = null;
    }

    if (Object.keys(memberPatch).length > 0) {
      const { error: memErr } = await admin
        .from('organization_members')
        .update(memberPatch)
        .eq('organization_id', organizationId)
        .eq('user_id', user_id);
      if (memErr) return res.status(500).json({ error: memErr.message });
    }

    const profilePatch = {};
    if (full_name && String(full_name).trim().length >= 2) {
      profilePatch.full_name = String(full_name).trim();
    }
    if (professional_registry_body !== undefined || staff_title !== undefined) {
      profilePatch.professional_registry_body = resolveProfileRegistryBody(
        professional_registry_body,
        staff_title
      );
    }
    if (professional_registry_number !== undefined) {
      profilePatch.professional_registry_number = isClinicalCouncilBody(professional_registry_body)
        ? professional_registry_number || null
        : null;
    }
    if (professional_specialty !== undefined) {
      profilePatch.professional_specialty = isClinicalCouncilBody(professional_registry_body)
        ? professional_specialty || null
        : null;
    }

    if (Object.keys(profilePatch).length > 0) {
      const { error: profileErr } = await admin
        .from('profiles')
        .update(profilePatch)
        .eq('id', user_id);
      if (profileErr) return res.status(500).json({ error: profileErr.message });
    }

    return res.json({ ok: true, user_id });
  } catch (err) {
    console.error('clinic team update:', err);
    return res.status(500).json({ error: err.message || 'Erro ao atualizar membro' });
  }
});

router.get('/branches', async (req, res) => {
  try {
    const { admin, organizationId, organization } = req.clinic;
    const { data, error } = await admin
      .from('organization_branches')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ organization, branches: data ?? [] });
  } catch (err) {
    console.error('clinic branches list:', err);
    return res.status(500).json({ error: err.message || 'Erro ao listar filiais' });
  }
});

router.post('/branches', async (req, res) => {
  try {
    const {
      name,
      address,
      phone,
      accent_color,
      login_full_name,
      login_email,
      login_password,
    } = req.body || {};

    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ error: 'Nome da filial é obrigatório.' });
    }
    if (!login_full_name || String(login_full_name).trim().length < 2) {
      return res.status(400).json({ error: 'Nome do responsável é obrigatório.' });
    }
    if (!login_email || !String(login_email).trim()) {
      return res.status(400).json({ error: 'E-mail do login é obrigatório.' });
    }
    if (!login_password || String(login_password).length < 8) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 8 caracteres.' });
    }

    const { admin, organizationId } = req.clinic;
    const result = await createBranchWithLogin(admin, organizationId, {
      name: String(name).trim(),
      address: address ? String(address).trim() : null,
      phone: phone ? String(phone).trim() : null,
      accent_color: accent_color ? String(accent_color).trim() : null,
      login_full_name: String(login_full_name).trim(),
      login_email: String(login_email).trim(),
      login_password: String(login_password),
    });
    return res.status(201).json(result);
  } catch (err) {
    console.error('clinic branches create:', err);
    return res.status(500).json({ error: err.message || 'Erro ao criar filial' });
  }
});

router.patch('/branches', async (req, res) => {
  try {
    const { branch_id, ...patch } = req.body || {};
    if (!branch_id) return res.status(400).json({ error: 'branch_id é obrigatório.' });
    const { admin, organizationId } = req.clinic;
    const { data: existing } = await admin
      .from('organization_branches')
      .select('id')
      .eq('id', branch_id)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (!existing) return res.status(404).json({ error: 'Filial não encontrada.' });
    const updates = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined)
    );
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
    }
    const { data: branch, error } = await admin
      .from('organization_branches')
      .update(updates)
      .eq('id', branch_id)
      .select('*')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ branch });
  } catch (err) {
    console.error('clinic branches patch:', err);
    return res.status(500).json({ error: err.message || 'Erro ao atualizar filial' });
  }
});

router.delete('/branches', async (req, res) => {
  try {
    const branchId = String(req.query.branch_id || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(branchId)) {
      return res.status(400).json({ error: 'ID da filial inválido.' });
    }
    const { admin, organizationId } = req.clinic;
    const result = await deleteBranchWithCleanup(admin, organizationId, branchId);
    return res.json(result);
  } catch (err) {
    console.error('clinic branches delete:', err);
    return res.status(400).json({ error: err.message || 'Erro ao excluir filial' });
  }
});

router.delete('/team', async (req, res) => {
  try {
    const userId = String(req.query.user_id || '').trim();
    const result = await removeClinicMemberWithCleanup(
      req.clinic.admin,
      req.clinic.organizationId,
      userId,
      req.clinic.ownerUserId
    );
    return res.json(result);
  } catch (err) {
    console.error('clinic team remove:', err);
    const msg = err.message || 'Erro ao remover profissional';
    const status =
      msg.includes('inválido') || msg.includes('Master') || msg.includes('não encontrado')
        ? 400
        : 500;
    return res.status(status).json({ error: msg });
  }
});

const ORG_PROC_SELECT =
  'id, organization_id, procedure_id, is_active, price_oficial, price_parcerias, price_funcionarios, price_particular, price_convenio, created_at, updated_at';

const BRANCH_PRICE_SELECT =
  'id, organization_id, branch_id, procedure_id, price_oficial, price_parcerias, price_funcionarios, price_particular, price_convenio, created_at, updated_at';

function mapPriceFields(row) {
  return {
    price_oficial: row.price_oficial != null ? Number(row.price_oficial) : null,
    price_parcerias: row.price_parcerias != null ? Number(row.price_parcerias) : null,
    price_funcionarios: row.price_funcionarios != null ? Number(row.price_funcionarios) : null,
    price_particular: row.price_particular != null ? Number(row.price_particular) : null,
    price_convenio: row.price_convenio != null ? Number(row.price_convenio) : null,
  };
}

function mapBranchPrice(row) {
  return {
    id: row.id,
    organization_id: row.organization_id,
    branch_id: row.branch_id,
    procedure_id: row.procedure_id,
    ...mapPriceFields(row),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapOrgProcedure(row, procedure, branchPrices = []) {
  return {
    id: row.id,
    organization_id: row.organization_id,
    procedure_id: row.procedure_id,
    is_active: row.is_active,
    ...mapPriceFields(row),
    created_at: row.created_at,
    updated_at: row.updated_at,
    branch_prices: branchPrices,
    procedure: procedure
      ? {
          id: procedure.id,
          name: procedure.name,
          slug: procedure.slug,
          category: procedure.category,
          specialty: procedure.specialty ?? null,
          is_active: procedure.is_active,
        }
      : null,
  };
}

async function syncBranchPricesExpress(admin, organizationId, procedureId, useBranchPrices, branchPrices) {
  await admin
    .from('organization_procedure_branch_prices')
    .delete()
    .eq('organization_id', organizationId)
    .eq('procedure_id', procedureId);

  if (!useBranchPrices || !Array.isArray(branchPrices) || !branchPrices.length) return [];

  const branchIds = [...new Set(branchPrices.map((b) => b.branch_id).filter(Boolean))];
  if (!branchIds.length) return [];

  const { data: validBranches, error: vErr } = await admin
    .from('organization_branches')
    .select('id')
    .eq('organization_id', organizationId)
    .in('id', branchIds);
  if (vErr) throw new Error(vErr.message);

  const validSet = new Set((validBranches || []).map((b) => b.id));
  const parsePrice = (v) => {
    if (v === undefined || v === null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100) / 100;
  };

  const rows = branchPrices
    .filter((b) => validSet.has(b.branch_id))
    .map((b) => ({
      organization_id: organizationId,
      branch_id: b.branch_id,
      procedure_id: procedureId,
      price_oficial: parsePrice(b.price_oficial),
      price_parcerias: parsePrice(b.price_parcerias),
      price_funcionarios: parsePrice(b.price_funcionarios),
      price_particular: parsePrice(b.price_particular),
      price_convenio: parsePrice(b.price_convenio),
    }));

  if (!rows.length) return [];
  const { data: inserted, error } = await admin
    .from('organization_procedure_branch_prices')
    .insert(rows)
    .select(BRANCH_PRICE_SELECT);
  if (error) throw new Error(error.message);
  return (inserted || []).map(mapBranchPrice);
}

router.get('/master-dashboard', async (req, res) => {
  try {
    const { admin, organizationId, organization, ownerUserId } = req.clinic;
    if (organization.type !== 'clinic') {
      return res.status(403).json({ error: 'Dashboard disponível apenas para clínicas.' });
    }
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const mockRequest = { url: `http://local/api/clinic/master-dashboard${qs}` };
    const ctx = {
      admin,
      organizationId,
      organization,
      ownerUserId,
    };
    const payload = await buildClinicMasterDashboard(ctx, mockRequest);
    if (payload.error) {
      return res.status(payload.status ?? 400).json({ error: payload.error });
    }
    return res.json(payload);
  } catch (err) {
    console.error('clinic master-dashboard:', err);
    return res.status(500).json({ error: err.message || 'Erro ao carregar dashboard.' });
  }
});

router.get('/procedures', async (req, res) => {
  try {
    const { admin, organizationId, organization } = req.clinic;
    const [
      { data: globals, error: gErr },
      { data: orgRows, error: oErr },
      { data: branchRows, error: bErr },
    ] = await Promise.all([
      admin
        .from('procedures')
        .select('id, name, slug, category, specialty, is_active, is_global')
        .eq('is_active', true)
        .eq('is_global', true)
        .order('category')
        .order('name'),
      admin
        .from('organization_procedures')
        .select(ORG_PROC_SELECT)
        .eq('organization_id', organizationId)
        .order('updated_at', { ascending: false }),
      admin
        .from('organization_procedure_branch_prices')
        .select(BRANCH_PRICE_SELECT)
        .eq('organization_id', organizationId),
    ]);
    if (gErr) return res.status(500).json({ error: gErr.message });
    if (oErr) return res.status(500).json({ error: oErr.message });
    if (bErr) return res.status(500).json({ error: bErr.message });

    const procById = new Map((globals || []).map((p) => [p.id, p]));
    const branchByProcedure = new Map();
    for (const row of branchRows || []) {
      const list = branchByProcedure.get(row.procedure_id) || [];
      list.push(mapBranchPrice(row));
      branchByProcedure.set(row.procedure_id, list);
    }

    return res.json({
      organization,
      catalog: (globals || []).map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        category: p.category,
        specialty: p.specialty ?? null,
        is_active: p.is_active,
      })),
      organization_procedures: (orgRows || []).map((row) =>
        mapOrgProcedure(
          row,
          procById.get(row.procedure_id),
          branchByProcedure.get(row.procedure_id) || []
        )
      ),
    });
  } catch (err) {
    console.error('clinic procedures list:', err);
    return res.status(500).json({ error: err.message || 'Erro ao listar procedimentos' });
  }
});

router.put('/procedures', async (req, res) => {
  try {
    const {
      procedure_id,
      is_active,
      price_oficial,
      price_parcerias,
      price_funcionarios,
      price_particular,
      price_convenio,
      use_branch_prices,
      branch_prices,
    } = req.body || {};
    if (!procedure_id || !/^[0-9a-f-]{36}$/i.test(String(procedure_id))) {
      return res.status(400).json({ error: 'procedure_id inválido.' });
    }

    const parsePrice = (v) => {
      if (v === undefined) return undefined;
      if (v === null || v === '') return null;
      const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) return null;
      return Math.round(n * 100) / 100;
    };

    const { admin, organizationId } = req.clinic;
    const { data: proc, error: pErr } = await admin
      .from('procedures')
      .select('id, name, slug, category, specialty, is_active')
      .eq('id', procedure_id)
      .eq('is_active', true)
      .maybeSingle();
    if (pErr) return res.status(500).json({ error: pErr.message });
    if (!proc) return res.status(404).json({ error: 'Procedimento não encontrado.' });

    const payload = {
      organization_id: organizationId,
      procedure_id,
      is_active: is_active !== false,
    };
    const po = parsePrice(price_oficial);
    const pp = parsePrice(price_parcerias);
    const pf = parsePrice(price_funcionarios);
    const ppart = parsePrice(price_particular);
    const pconv = parsePrice(price_convenio);
    if (po !== undefined) payload.price_oficial = po;
    if (pp !== undefined) payload.price_parcerias = pp;
    if (pf !== undefined) payload.price_funcionarios = pf;
    if (ppart !== undefined) payload.price_particular = ppart;
    if (pconv !== undefined) payload.price_convenio = pconv;

    const { data: row, error } = await admin
      .from('organization_procedures')
      .upsert(payload, { onConflict: 'organization_id,procedure_id' })
      .select(ORG_PROC_SELECT)
      .single();
    if (error) return res.status(500).json({ error: error.message });

    const synced = await syncBranchPricesExpress(
      admin,
      organizationId,
      procedure_id,
      Boolean(use_branch_prices),
      Array.isArray(branch_prices) ? branch_prices : []
    );

    return res.json({ organization_procedure: mapOrgProcedure(row, proc, synced) });
  } catch (err) {
    console.error('clinic procedures upsert:', err);
    return res.status(500).json({ error: err.message || 'Erro ao salvar procedimento' });
  }
});

router.delete('/procedures', async (req, res) => {
  try {
    const procedureId = String(req.query.procedure_id || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(procedureId)) {
      return res.status(400).json({ error: 'procedure_id inválido.' });
    }
    const { admin, organizationId } = req.clinic;
    const { data: row, error } = await admin
      .from('organization_procedures')
      .update({ is_active: false })
      .eq('organization_id', organizationId)
      .eq('procedure_id', procedureId)
      .select(ORG_PROC_SELECT)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!row) return res.status(404).json({ error: 'Procedimento não está cadastrado nesta clínica.' });

    await admin
      .from('organization_procedure_branch_prices')
      .delete()
      .eq('organization_id', organizationId)
      .eq('procedure_id', procedureId);

    const { data: proc } = await admin
      .from('procedures')
      .select('id, name, slug, category, specialty, is_active')
      .eq('id', procedureId)
      .maybeSingle();

    return res.json({ organization_procedure: mapOrgProcedure(row, proc, []) });
  } catch (err) {
    console.error('clinic procedures deactivate:', err);
    return res.status(500).json({ error: err.message || 'Erro ao desativar procedimento' });
  }
});

export default router;

// silence unused in case ADMIN_EMAIL is needed later for logs
void ADMIN_EMAIL;
