/**
 * /api/clinic/procedures
 * GET    — catálogo + preços da org (+ overrides por filial)
 * PUT    — ativa/atualiza preços (só Master)
 * DELETE — desativa na org ?procedure_id= (só Master)
 */

import { enforceRateLimit } from '../_lib/rateLimit.js';
import { parseBody, clinicUpsertProcedureSchema } from '../_lib/schemas.js';
import { jsonResponse, requireClinicMember, requireClinicOwner } from '../_lib/clinicAuth.js';

const ORG_PROC_SELECT =
  'id, organization_id, procedure_id, is_active, price_oficial, price_parcerias, price_funcionarios, price_particular, price_convenio, created_at, updated_at';

const BRANCH_PRICE_SELECT =
  'id, organization_id, branch_id, procedure_id, price_oficial, price_parcerias, price_funcionarios, price_particular, price_convenio, created_at, updated_at';

function mapPrices(row) {
  return {
    price_oficial: row.price_oficial != null ? Number(row.price_oficial) : null,
    price_parcerias: row.price_parcerias != null ? Number(row.price_parcerias) : null,
    price_funcionarios: row.price_funcionarios != null ? Number(row.price_funcionarios) : null,
    price_particular: row.price_particular != null ? Number(row.price_particular) : null,
    price_convenio: row.price_convenio != null ? Number(row.price_convenio) : null,
  };
}

function mapOrgRow(row, procedure, branchPrices = []) {
  return {
    id: row.id,
    organization_id: row.organization_id,
    procedure_id: row.procedure_id,
    is_active: row.is_active,
    ...mapPrices(row),
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

function mapBranchPrice(row) {
  return {
    id: row.id,
    organization_id: row.organization_id,
    branch_id: row.branch_id,
    procedure_id: row.procedure_id,
    ...mapPrices(row),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listProcedures(ctx) {
  const [
    { data: globals, error: gErr },
    { data: orgRows, error: oErr },
    { data: branchRows, error: bErr },
  ] = await Promise.all([
    ctx.admin
      .from('procedures')
      .select('id, name, slug, category, specialty, is_active, is_global')
      .eq('is_active', true)
      .eq('is_global', true)
      .order('category')
      .order('name'),
    ctx.admin
      .from('organization_procedures')
      .select(ORG_PROC_SELECT)
      .eq('organization_id', ctx.organizationId)
      .order('updated_at', { ascending: false }),
    ctx.admin
      .from('organization_procedure_branch_prices')
      .select(BRANCH_PRICE_SELECT)
      .eq('organization_id', ctx.organizationId),
  ]);

  if (gErr) return jsonResponse({ error: gErr.message }, 500);
  if (oErr) return jsonResponse({ error: oErr.message }, 500);
  if (bErr) return jsonResponse({ error: bErr.message }, 500);

  const procById = new Map((globals || []).map((p) => [p.id, p]));
  const missingIds = (orgRows || [])
    .map((r) => r.procedure_id)
    .filter((id) => !procById.has(id));
  if (missingIds.length) {
    const { data: extra } = await ctx.admin
      .from('procedures')
      .select('id, name, slug, category, specialty, is_active, is_global')
      .in('id', missingIds);
    for (const p of extra || []) procById.set(p.id, p);
  }

  const branchByProcedure = new Map();
  for (const row of branchRows || []) {
    const list = branchByProcedure.get(row.procedure_id) || [];
    list.push(mapBranchPrice(row));
    branchByProcedure.set(row.procedure_id, list);
  }

  const organization_procedures = (orgRows || []).map((row) =>
    mapOrgRow(row, procById.get(row.procedure_id), branchByProcedure.get(row.procedure_id) || [])
  );

  return jsonResponse({
    organization: ctx.organization,
    catalog: (globals || []).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      category: p.category,
      specialty: p.specialty ?? null,
      is_active: p.is_active,
    })),
    organization_procedures,
  });
}

async function syncBranchPrices(ctx, procedureId, useBranchPrices, branchPrices) {
  await ctx.admin
    .from('organization_procedure_branch_prices')
    .delete()
    .eq('organization_id', ctx.organizationId)
    .eq('procedure_id', procedureId);

  if (!useBranchPrices || !Array.isArray(branchPrices) || branchPrices.length === 0) {
    return [];
  }

  const branchIds = [...new Set(branchPrices.map((b) => b.branch_id).filter(Boolean))];
  if (!branchIds.length) return [];

  const { data: validBranches, error: vErr } = await ctx.admin
    .from('organization_branches')
    .select('id')
    .eq('organization_id', ctx.organizationId)
    .in('id', branchIds);
  if (vErr) throw new Error(vErr.message);

  const validSet = new Set((validBranches || []).map((b) => b.id));
  const rows = branchPrices
    .filter((b) => validSet.has(b.branch_id))
    .map((b) => ({
      organization_id: ctx.organizationId,
      branch_id: b.branch_id,
      procedure_id: procedureId,
      price_oficial: b.price_oficial ?? null,
      price_parcerias: b.price_parcerias ?? null,
      price_funcionarios: b.price_funcionarios ?? null,
      price_particular: b.price_particular ?? null,
      price_convenio: b.price_convenio ?? null,
    }));

  if (!rows.length) return [];

  const { data: inserted, error } = await ctx.admin
    .from('organization_procedure_branch_prices')
    .insert(rows)
    .select(BRANCH_PRICE_SELECT);
  if (error) throw new Error(error.message);
  return (inserted || []).map(mapBranchPrice);
}

async function upsertProcedure(request, ctx) {
  const parsed = await parseBody(request, clinicUpsertProcedureSchema);
  if (parsed.error) {
    return jsonResponse({ error: parsed.error }, parsed.status ?? 400);
  }
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
  } = parsed.data;

  const { data: proc, error: pErr } = await ctx.admin
    .from('procedures')
    .select('id, name, slug, category, specialty, is_active')
    .eq('id', procedure_id)
    .eq('is_active', true)
    .maybeSingle();
  if (pErr) return jsonResponse({ error: pErr.message }, 500);
  if (!proc) return jsonResponse({ error: 'Procedimento não encontrado.' }, 404);

  const payload = {
    organization_id: ctx.organizationId,
    procedure_id,
    is_active: is_active !== false,
  };
  if (price_oficial !== undefined) payload.price_oficial = price_oficial;
  if (price_parcerias !== undefined) payload.price_parcerias = price_parcerias;
  if (price_funcionarios !== undefined) payload.price_funcionarios = price_funcionarios;
  if (price_particular !== undefined) payload.price_particular = price_particular;
  if (price_convenio !== undefined) payload.price_convenio = price_convenio;

  const { data: row, error } = await ctx.admin
    .from('organization_procedures')
    .upsert(payload, { onConflict: 'organization_id,procedure_id' })
    .select(ORG_PROC_SELECT)
    .single();

  if (error) return jsonResponse({ error: error.message }, 500);

  let syncedBranchPrices = [];
  try {
    syncedBranchPrices = await syncBranchPrices(
      ctx,
      procedure_id,
      Boolean(use_branch_prices),
      branch_prices || []
    );
  } catch (err) {
    return jsonResponse({ error: err.message || 'Erro ao salvar preços por filial.' }, 500);
  }

  return jsonResponse({
    organization_procedure: mapOrgRow(row, proc, syncedBranchPrices),
  });
}

async function deactivateProcedure(request, ctx) {
  const url = new URL(request.url);
  const procedureId = url.searchParams.get('procedure_id');
  if (!procedureId) {
    return jsonResponse({ error: 'procedure_id é obrigatório.' }, 400);
  }

  const { data: row, error } = await ctx.admin
    .from('organization_procedures')
    .update({ is_active: false })
    .eq('organization_id', ctx.organizationId)
    .eq('procedure_id', procedureId)
    .select(ORG_PROC_SELECT)
    .maybeSingle();

  if (error) return jsonResponse({ error: error.message }, 500);
  if (!row) return jsonResponse({ error: 'Procedimento não está cadastrado nesta clínica.' }, 404);

  await ctx.admin
    .from('organization_procedure_branch_prices')
    .delete()
    .eq('organization_id', ctx.organizationId)
    .eq('procedure_id', procedureId);

  const { data: proc } = await ctx.admin
    .from('procedures')
    .select('id, name, slug, category, specialty, is_active')
    .eq('id', procedureId)
    .maybeSingle();

  return jsonResponse({ organization_procedure: mapOrgRow(row, proc, []) });
}

export async function GET(request) {
  const blocked = await enforceRateLimit(request, 'admin', 'Muitas requisições. Tente novamente em 1 minuto.');
  if (blocked) return blocked;
  const auth = await requireClinicMember(request);
  if (auth.error) return auth.error;
  return listProcedures(auth);
}

export async function PUT(request) {
  const blocked = await enforceRateLimit(request, 'admin', 'Muitas requisições. Tente novamente em 1 minuto.');
  if (blocked) return blocked;
  const auth = await requireClinicOwner(request);
  if (auth.error) return auth.error;
  return upsertProcedure(request, auth);
}

export async function DELETE(request) {
  const blocked = await enforceRateLimit(request, 'admin', 'Muitas requisições. Tente novamente em 1 minuto.');
  if (blocked) return blocked;
  const auth = await requireClinicOwner(request);
  if (auth.error) return auth.error;
  return deactivateProcedure(request, auth);
}
