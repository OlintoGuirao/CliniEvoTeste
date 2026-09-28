import { supabase } from '@/integrations/supabase/client';
import type { ProcedureSpecialty } from '@/lib/procedureSpecialty';

export type ClinicProcedureCatalogItem = {
  id: string;
  name: string;
  slug: string;
  category: string;
  specialty: ProcedureSpecialty | string | null;
  is_active: boolean;
};

export type OrganizationProcedureBranchPrice = {
  id?: string;
  organization_id?: string;
  branch_id: string;
  procedure_id?: string;
  price_oficial: number | null;
  price_parcerias: number | null;
  price_funcionarios: number | null;
  price_particular: number | null;
  price_convenio: number | null;
};

export type OrganizationProcedureRow = {
  id: string;
  organization_id: string;
  procedure_id: string;
  is_active: boolean;
  price_oficial: number | null;
  price_parcerias: number | null;
  price_funcionarios: number | null;
  price_particular: number | null;
  price_convenio: number | null;
  created_at: string;
  updated_at: string;
  branch_prices?: OrganizationProcedureBranchPrice[];
  procedure: ClinicProcedureCatalogItem | null;
};

export type ClinicProceduresResponse = {
  organization: { id: string; name: string; type: 'clinic' };
  catalog: ClinicProcedureCatalogItem[];
  organization_procedures: OrganizationProcedureRow[];
};

export type OrganizationProcedurePricesPayload = {
  defaults: Array<{
    procedure_id: string;
    price_oficial: number | null;
    price_parcerias: number | null;
    price_funcionarios: number | null;
    price_particular: number | null;
    price_convenio: number | null;
  }>;
  branchOverrides: Array<{
    branch_id: string;
    procedure_id: string;
    price_oficial: number | null;
    price_parcerias: number | null;
    price_funcionarios: number | null;
    price_particular: number | null;
    price_convenio: number | null;
  }>;
};

const ORG_PROC_SELECT =
  'id, organization_id, procedure_id, is_active, price_oficial, price_parcerias, price_funcionarios, price_particular, price_convenio, created_at, updated_at';

const BRANCH_PRICE_SELECT =
  'id, organization_id, branch_id, procedure_id, price_oficial, price_parcerias, price_funcionarios, price_particular, price_convenio, created_at, updated_at';

const PROCEDURE_SELECT = 'id, name, slug, category, specialty, is_active, is_global';

function mapPrices(row: Record<string, unknown>) {
  return {
    price_oficial: row.price_oficial != null ? Number(row.price_oficial) : null,
    price_parcerias: row.price_parcerias != null ? Number(row.price_parcerias) : null,
    price_funcionarios: row.price_funcionarios != null ? Number(row.price_funcionarios) : null,
    price_particular: row.price_particular != null ? Number(row.price_particular) : null,
    price_convenio: row.price_convenio != null ? Number(row.price_convenio) : null,
  };
}

function mapCatalogItem(p: Record<string, unknown>): ClinicProcedureCatalogItem {
  return {
    id: String(p.id),
    name: String(p.name),
    slug: String(p.slug),
    category: String(p.category),
    specialty: (p.specialty as ProcedureSpecialty | string | null) ?? null,
    is_active: Boolean(p.is_active),
  };
}

function mapBranchPrice(row: Record<string, unknown>): OrganizationProcedureBranchPrice {
  return {
    id: row.id != null ? String(row.id) : undefined,
    organization_id: row.organization_id != null ? String(row.organization_id) : undefined,
    branch_id: String(row.branch_id),
    procedure_id: row.procedure_id != null ? String(row.procedure_id) : undefined,
    ...mapPrices(row),
  };
}

function mapOrgRow(
  row: Record<string, unknown>,
  procedure: ClinicProcedureCatalogItem | null,
  branchPrices: OrganizationProcedureBranchPrice[] = []
): OrganizationProcedureRow {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    procedure_id: String(row.procedure_id),
    is_active: Boolean(row.is_active),
    ...mapPrices(row),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    branch_prices: branchPrices,
    procedure,
  };
}

async function getClinicOrganizationContext(): Promise<{ id: string; name: string }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.id) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id, account_type')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile?.organization_id || profile.account_type !== 'clinic') {
    throw new Error('Organização da clínica não encontrada.');
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', profile.organization_id)
    .maybeSingle();

  if (orgError) throw new Error(orgError.message);
  if (!org?.id) throw new Error('Organização da clínica não encontrada.');

  return { id: String(org.id), name: String(org.name || 'Clínica') };
}

async function syncBranchPrices(
  organizationId: string,
  procedureId: string,
  useBranchPrices: boolean,
  branchPrices: Array<{
    branch_id: string;
    price_oficial?: number | null;
    price_parcerias?: number | null;
    price_funcionarios?: number | null;
    price_particular?: number | null;
    price_convenio?: number | null;
  }> = []
): Promise<OrganizationProcedureBranchPrice[]> {
  const { error: deleteError } = await supabase
    .from('organization_procedure_branch_prices')
    .delete()
    .eq('organization_id', organizationId)
    .eq('procedure_id', procedureId);

  if (deleteError) throw new Error(deleteError.message);

  if (!useBranchPrices || !branchPrices.length) return [];

  const branchIds = [...new Set(branchPrices.map((b) => b.branch_id).filter(Boolean))];
  if (!branchIds.length) return [];

  const { data: validBranches, error: branchError } = await supabase
    .from('organization_branches')
    .select('id')
    .eq('organization_id', organizationId)
    .in('id', branchIds);

  if (branchError) throw new Error(branchError.message);

  const validSet = new Set((validBranches ?? []).map((b) => String(b.id)));
  const rows = branchPrices
    .filter((b) => validSet.has(b.branch_id))
    .map((b) => ({
      organization_id: organizationId,
      branch_id: b.branch_id,
      procedure_id: procedureId,
      price_oficial: b.price_oficial ?? null,
      price_parcerias: b.price_parcerias ?? null,
      price_funcionarios: b.price_funcionarios ?? null,
      price_particular: b.price_particular ?? null,
      price_convenio: b.price_convenio ?? null,
    }));

  if (!rows.length) return [];

  const { data: inserted, error: insertError } = await supabase
    .from('organization_procedure_branch_prices')
    .insert(rows)
    .select(BRANCH_PRICE_SELECT);

  if (insertError) throw new Error(insertError.message);
  return (inserted ?? []).map((row) => mapBranchPrice(row as Record<string, unknown>));
}

/** Admin da clínica — catálogo global + preços da organização (via RLS). */
export async function fetchClinicProceduresAdmin(): Promise<ClinicProceduresResponse> {
  const organization = await getClinicOrganizationContext();

  const [globalsRes, orgRes, branchRes] = await Promise.all([
    supabase
      .from('procedures')
      .select(PROCEDURE_SELECT)
      .eq('is_active', true)
      .eq('is_global', true)
      .order('category')
      .order('name'),
    supabase
      .from('organization_procedures')
      .select(ORG_PROC_SELECT)
      .eq('organization_id', organization.id)
      .order('updated_at', { ascending: false }),
    supabase
      .from('organization_procedure_branch_prices')
      .select(BRANCH_PRICE_SELECT)
      .eq('organization_id', organization.id),
  ]);

  if (globalsRes.error) throw new Error(globalsRes.error.message);
  if (orgRes.error) throw new Error(orgRes.error.message);
  if (branchRes.error) throw new Error(branchRes.error.message);

  const procById = new Map(
    (globalsRes.data ?? []).map((p) => [String(p.id), mapCatalogItem(p as Record<string, unknown>)])
  );

  const missingIds = (orgRes.data ?? [])
    .map((r) => String(r.procedure_id))
    .filter((id) => !procById.has(id));

  if (missingIds.length) {
    const { data: extra, error: extraError } = await supabase
      .from('procedures')
      .select(PROCEDURE_SELECT)
      .in('id', missingIds);

    if (extraError) throw new Error(extraError.message);
    for (const p of extra ?? []) {
      procById.set(String(p.id), mapCatalogItem(p as Record<string, unknown>));
    }
  }

  const branchByProcedure = new Map<string, OrganizationProcedureBranchPrice[]>();
  for (const row of branchRes.data ?? []) {
    const procedureId = String(row.procedure_id);
    const list = branchByProcedure.get(procedureId) ?? [];
    list.push(mapBranchPrice(row as Record<string, unknown>));
    branchByProcedure.set(procedureId, list);
  }

  const organization_procedures = (orgRes.data ?? []).map((row) =>
    mapOrgRow(
      row as Record<string, unknown>,
      procById.get(String(row.procedure_id)) ?? null,
      branchByProcedure.get(String(row.procedure_id)) ?? []
    )
  );

  return {
    organization: { id: organization.id, name: organization.name, type: 'clinic' },
    catalog: (globalsRes.data ?? []).map((p) => mapCatalogItem(p as Record<string, unknown>)),
    organization_procedures,
  };
}

export async function upsertClinicProcedure(body: {
  procedure_id: string;
  is_active?: boolean;
  price_oficial?: number | null;
  price_parcerias?: number | null;
  price_funcionarios?: number | null;
  price_particular?: number | null;
  price_convenio?: number | null;
  use_branch_prices?: boolean;
  branch_prices?: Array<{
    branch_id: string;
    price_oficial?: number | null;
    price_parcerias?: number | null;
    price_funcionarios?: number | null;
    price_particular?: number | null;
    price_convenio?: number | null;
  }>;
}): Promise<OrganizationProcedureRow> {
  const organization = await getClinicOrganizationContext();

  const { data: proc, error: procError } = await supabase
    .from('procedures')
    .select('id, name, slug, category, specialty, is_active')
    .eq('id', body.procedure_id)
    .eq('is_active', true)
    .maybeSingle();

  if (procError) throw new Error(procError.message);
  if (!proc) throw new Error('Procedimento não encontrado.');

  const payload: Record<string, unknown> = {
    organization_id: organization.id,
    procedure_id: body.procedure_id,
    is_active: body.is_active !== false,
  };
  if (body.price_oficial !== undefined) payload.price_oficial = body.price_oficial;
  if (body.price_parcerias !== undefined) payload.price_parcerias = body.price_parcerias;
  if (body.price_funcionarios !== undefined) payload.price_funcionarios = body.price_funcionarios;
  if (body.price_particular !== undefined) payload.price_particular = body.price_particular;
  if (body.price_convenio !== undefined) payload.price_convenio = body.price_convenio;

  const { data: row, error } = await supabase
    .from('organization_procedures')
    .upsert(payload, { onConflict: 'organization_id,procedure_id' })
    .select(ORG_PROC_SELECT)
    .single();

  if (error) throw new Error(error.message);

  const syncedBranchPrices = await syncBranchPrices(
    organization.id,
    body.procedure_id,
    Boolean(body.use_branch_prices),
    body.branch_prices ?? []
  );

  return mapOrgRow(row as Record<string, unknown>, mapCatalogItem(proc as Record<string, unknown>), syncedBranchPrices);
}

export async function deactivateClinicProcedure(procedureId: string): Promise<OrganizationProcedureRow> {
  const organization = await getClinicOrganizationContext();

  const { data: row, error } = await supabase
    .from('organization_procedures')
    .update({ is_active: false })
    .eq('organization_id', organization.id)
    .eq('procedure_id', procedureId)
    .select(ORG_PROC_SELECT)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) throw new Error('Procedimento não está cadastrado nesta clínica.');

  await syncBranchPrices(organization.id, procedureId, false);

  const { data: proc } = await supabase
    .from('procedures')
    .select('id, name, slug, category, specialty, is_active')
    .eq('id', procedureId)
    .maybeSingle();

  return mapOrgRow(
    row as Record<string, unknown>,
    proc ? mapCatalogItem(proc as Record<string, unknown>) : null,
    []
  );
}

function mapPriceRow(row: Record<string, unknown>) {
  return {
    procedure_id: String(row.procedure_id),
    price_oficial: row.price_oficial != null ? Number(row.price_oficial) : null,
    price_parcerias: row.price_parcerias != null ? Number(row.price_parcerias) : null,
    price_funcionarios: row.price_funcionarios != null ? Number(row.price_funcionarios) : null,
    price_particular: row.price_particular != null ? Number(row.price_particular) : null,
    price_convenio: row.price_convenio != null ? Number(row.price_convenio) : null,
  };
}

/** Leitura via RLS para qualquer membro da clínica (consulta/orçamento). */
export async function fetchOrganizationProcedurePrices(): Promise<OrganizationProcedurePricesPayload> {
  const [defaultsRes, branchRes] = await Promise.all([
    supabase
      .from('organization_procedures')
      .select(
        'procedure_id, price_oficial, price_parcerias, price_funcionarios, price_particular, price_convenio'
      )
      .eq('is_active', true),
    supabase
      .from('organization_procedure_branch_prices')
      .select(
        'branch_id, procedure_id, price_oficial, price_parcerias, price_funcionarios, price_particular, price_convenio'
      ),
  ]);

  if (defaultsRes.error) throw new Error(defaultsRes.error.message);
  if (branchRes.error) throw new Error(branchRes.error.message);

  return {
    defaults: (defaultsRes.data ?? []).map((row) => mapPriceRow(row as Record<string, unknown>)),
    branchOverrides: (branchRes.data ?? []).map((row) => ({
      branch_id: String(row.branch_id),
      ...mapPriceRow(row as Record<string, unknown>),
    })),
  };
}
