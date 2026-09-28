/**
 * /api/clinic/branches
 * GET    — lista filiais da clínica (Master)
 * POST   — cria filial (Master)
 * PATCH  — atualiza filial (Master)
 * DELETE — exclui filial (Master); query ?branch_id=
 */

import { enforceRateLimit } from '../_lib/rateLimit.js';
import { parseBody } from '../_lib/schemas.js';
import { z } from 'zod';
import { jsonResponse, requireClinicOwner } from '../_lib/clinicAuth.js';
import { createBranchWithLogin } from '../_lib/createBranchWithLogin.js';
import { deleteBranchWithCleanup } from '../_lib/deleteBranchWithCleanup.js';

const createBranchSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório').max(120).transform((v) => v.trim()),
  address: z.string().max(300).nullable().optional().transform((v) => v?.trim() || null),
  phone: z.string().max(30).nullable().optional().transform((v) => v?.trim() || null),
  accent_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida')
    .nullable()
    .optional(),
  login_full_name: z.string().min(2, 'Nome do responsável é obrigatório').max(200).transform((v) => v.trim()),
  login_email: z.string().min(1, 'E-mail é obrigatório').max(255).email('E-mail inválido'),
  login_password: z
    .string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .max(512, 'Senha muito longa'),
});

const updateBranchSchema = z.object({
  branch_id: z.string().uuid('ID da filial inválido'),
  name: z.string().min(2).max(120).optional().transform((v) => v?.trim()),
  address: z.string().max(300).nullable().optional().transform((v) => (v === undefined ? undefined : v?.trim() || null)),
  phone: z.string().max(30).nullable().optional().transform((v) => (v === undefined ? undefined : v?.trim() || null)),
  is_active: z.boolean().optional(),
  whatsapp_instance_id: z.string().max(120).nullable().optional(),
  pix_key: z.string().max(120).nullable().optional(),
  pix_key_type: z.string().max(30).nullable().optional(),
  pix_receiver_name: z.string().max(120).nullable().optional(),
  accent_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida')
    .nullable()
    .optional(),
  logo_url: z.string().max(500).nullable().optional(),
});

async function listBranches(ctx) {
  const { data, error } = await ctx.admin
    .from('organization_branches')
    .select('id, organization_id, name, address, phone, is_active, whatsapp_instance_id, pix_key, pix_key_type, pix_receiver_name, accent_color, logo_url, created_at, updated_at')
    .eq('organization_id', ctx.organizationId)
    .order('created_at', { ascending: true });

  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ organization: ctx.organization, branches: data ?? [] });
}

async function createBranch(request, ctx) {
  const parsed = await parseBody(request, createBranchSchema);
  if (parsed.error) {
    return jsonResponse({ error: parsed.error }, parsed.status ?? 400);
  }

  try {
    const result = await createBranchWithLogin(ctx.admin, ctx.organizationId, parsed.data);
    return jsonResponse(result, 201);
  } catch (err) {
    return jsonResponse({ error: err.message || 'Não foi possível criar a filial.' }, 500);
  }
}

async function updateBranch(request, ctx) {
  const parsed = await parseBody(request, updateBranchSchema);
  if (parsed.error) {
    return jsonResponse({ error: parsed.error }, parsed.status ?? 400);
  }

  const { branch_id, ...patch } = parsed.data;
  const { data: existing, error: findErr } = await ctx.admin
    .from('organization_branches')
    .select('id')
    .eq('id', branch_id)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();

  if (findErr) return jsonResponse({ error: findErr.message }, 500);
  if (!existing) return jsonResponse({ error: 'Filial não encontrada.' }, 404);

  const updates = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined)
  );
  if (!Object.keys(updates).length) {
    return jsonResponse({ error: 'Nenhum campo para atualizar.' }, 400);
  }

  const { data: branch, error } = await ctx.admin
    .from('organization_branches')
    .update(updates)
    .eq('id', branch_id)
    .select('*')
    .maybeSingle();

  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ branch });
}

async function deleteBranch(request, ctx) {
  const url = new URL(request.url);
  const branchId = String(url.searchParams.get('branch_id') || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(branchId)) {
    return jsonResponse({ error: 'ID da filial inválido.' }, 400);
  }

  try {
    const result = await deleteBranchWithCleanup(ctx.admin, ctx.organizationId, branchId);
    return jsonResponse(result);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : 'Não foi possível excluir a filial.';
    return jsonResponse({ error: message || 'Não foi possível excluir a filial.' }, 400);
  }
}

export async function GET(request) {
  const blocked = await enforceRateLimit(request, 'clinic-branches', 'Muitas requisições. Tente novamente em 1 minuto.');
  if (blocked) return blocked;
  const ctx = await requireClinicOwner(request);
  if (ctx.error) return ctx.error;
  return listBranches(ctx);
}

export async function POST(request) {
  const blocked = await enforceRateLimit(request, 'clinic-branches', 'Muitas requisições. Tente novamente em 1 minuto.');
  if (blocked) return blocked;
  const ctx = await requireClinicOwner(request);
  if (ctx.error) return ctx.error;
  return createBranch(request, ctx);
}

export async function PATCH(request) {
  const blocked = await enforceRateLimit(request, 'clinic-branches', 'Muitas requisições. Tente novamente em 1 minuto.');
  if (blocked) return blocked;
  const ctx = await requireClinicOwner(request);
  if (ctx.error) return ctx.error;
  return updateBranch(request, ctx);
}

export async function DELETE(request) {
  const blocked = await enforceRateLimit(request, 'clinic-branches', 'Muitas requisições. Tente novamente em 1 minuto.');
  if (blocked) return blocked;
  const ctx = await requireClinicOwner(request);
  if (ctx.error) return ctx.error;
  return deleteBranch(request, ctx);
}
