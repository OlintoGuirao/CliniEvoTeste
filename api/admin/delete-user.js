/**
 * POST /api/admin/delete-user
 * Exclui um usuário permanentemente (auth + perfil em cascata).
 * Requer: Authorization: Bearer <access_token> do usuário admin.
 * Body: { user_id }
 */

import { createClient } from '@supabase/supabase-js';
import { enforceRateLimit } from '../_lib/rateLimit.js';
import { insertAuditLog, getRequestMeta } from '../_lib/auditLog.js';
import { parseBody, adminDeleteUserSchema } from '../_lib/schemas.js';
import { deleteUserWithCleanup } from '../_lib/deleteUserWithCleanup.js';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@clinievo.com.br').trim();
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function requireAdmin(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: jsonResponse({ error: 'Token não informado. Faça login novamente.' }, 401) };
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return { error: jsonResponse({ error: 'Token não informado. Faça login novamente.' }, 401) };
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { error: jsonResponse({ error: 'Configuração do servidor inválida' }, 500) };
  }
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.email) {
    const msg =
      res.status === 401 || data?.msg === 'Invalid Refresh Token' || data?.error === 'invalid_token'
        ? 'Token expirado ou inválido. Faça login novamente.'
        : 'Não autorizado. Faça login novamente.';
    return { error: jsonResponse({ error: msg }, 401) };
  }
  const email = String(data.email).trim();
  if (email !== ADMIN_EMAIL) {
    return { error: jsonResponse({ error: 'Acesso restrito ao administrador' }, 403) };
  }
  return { adminEmail: email, adminUserId: data.id };
}

export async function POST(request) {
  const blocked = await enforceRateLimit(
    request,
    'admin',
    'Muitas requisições. Tente novamente em 1 minuto.'
  );
  if (blocked) return blocked;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(
      { error: 'Configuração do servidor inválida. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel.' },
      500
    );
  }

  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const parsed = await parseBody(request, adminDeleteUserSchema);
  if (parsed.error) return jsonResponse({ error: parsed.error }, parsed.status ?? 400);

  const { user_id } = parsed.data;

  if (user_id === adminCheck.adminUserId) {
    return jsonResponse({ error: 'Você não pode excluir a si mesmo.' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: targetUser, error: fetchError } = await supabase.auth.admin.getUserById(user_id);
  if (fetchError || !targetUser?.user) {
    return jsonResponse({ error: 'Usuário não encontrado.' }, 404);
  }

  const targetEmail = String(targetUser.user.email || '').trim();
  if (targetEmail === ADMIN_EMAIL) {
    return jsonResponse({ error: 'Não é permitido excluir o usuário administrador.' }, 400);
  }

  try {
    await deleteUserWithCleanup(supabase, user_id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao excluir usuário';
    return jsonResponse({ error: msg }, 500);
  }

  const { ip, user_agent } = getRequestMeta(request);
  await insertAuditLog({
    user_id: null,
    action: 'user_deleted',
    entity: 'user',
    entity_id: user_id,
    ip,
    user_agent,
    details: { email: targetEmail, deleted_by_admin: adminCheck.adminEmail },
  });

  return jsonResponse({ ok: true, user_id }, 200);
}
