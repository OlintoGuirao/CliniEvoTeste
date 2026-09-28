/**
 * POST /api/admin/password-reset
 * Gera link de redefinição de senha (recovery) para um usuário.
 * Observação: por segurança, senhas não podem ser "visualizadas".
 * Requer: Authorization: Bearer <access_token> do usuário admin.
 * Body: { email, redirect_to? }
 */

import { createClient } from '@supabase/supabase-js';
import { enforceRateLimit } from '../_lib/rateLimit.js';
import { insertAuditLog, getRequestMeta } from '../_lib/auditLog.js';
import { parseBody, adminPasswordResetSchema } from '../_lib/schemas.js';

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
  return { adminEmail: email };
}

export async function POST(request) {
  const blocked = await enforceRateLimit(
    request,
    'admin',
    'Muitas requisições. Tente novamente em 1 minuto.'
  );
  if (blocked) return blocked;

  const emailBlocked = await enforceRateLimit(
    request,
    'email',
    'Limite de envios de recuperação de senha atingido. Tente novamente mais tarde.'
  );
  if (emailBlocked) return emailBlocked;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(
      { error: 'Configuração do servidor inválida. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel.' },
      500
    );
  }

  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const parsed = await parseBody(request, adminPasswordResetSchema);
  if (parsed.error) return jsonResponse({ error: parsed.error }, parsed.status ?? 400);

  const { email, redirect_to } = parsed.data;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: redirect_to ? { redirectTo: redirect_to } : undefined,
  });

  if (error) {
    return jsonResponse({ error: error.message || 'Erro ao gerar link' }, 500);
  }

  const { ip, user_agent } = getRequestMeta(request);
  await insertAuditLog({
    user_id: null,
    action: 'password_reset_link_generated',
    entity: 'user',
    entity_id: data?.user?.id ?? null,
    ip,
    user_agent,
    details: { email, generated_by_admin: adminCheck.adminEmail },
  });

  return jsonResponse({ action_link: data?.properties?.action_link ?? null }, 200);
}

