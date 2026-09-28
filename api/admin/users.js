/**
 * POST /api/admin/users
 * Cria novo usuário (apenas admin). Body: { email, password, full_name, account_type?, organization_name? }
 * Requer: Authorization: Bearer <access_token> do usuário admin.
 */

import { createClient } from '@supabase/supabase-js';
import { enforceRateLimit } from '../_lib/rateLimit.js';
import { insertAuditLog, getRequestMeta } from '../_lib/auditLog.js';
import { parseBody, adminCreateUserSchema } from '../_lib/schemas.js';

// Fallback para evitar 500 por falta de ADMIN_EMAIL quando o admin padrão é usado.
// Em produção, o ideal é definir ADMIN_EMAIL nas variáveis de ambiente.
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

/** Valida o token e garante que o usuário é o admin. */
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
    const msg = res.status === 401 || data?.msg === 'Invalid Refresh Token' || data?.error === 'invalid_token'
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

  // ADMIN_EMAIL sempre terá valor por causa do fallback acima.
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({
      error: 'Configuração do servidor inválida. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel.',
    }, 500);
  }

  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const parsed = await parseBody(request, adminCreateUserSchema);
  if (parsed.error) {
    return jsonResponse({ error: parsed.error }, parsed.status ?? 400);
  }
  const { email, password, full_name, account_type, organization_name } = parsed.data;
  const accountType =
    account_type === 'clinic' ? 'clinic' : account_type === 'salon' ? 'salon' : 'solo';

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: full_name || null,
      account_type: accountType,
    },
  });

  if (error) {
    const msg = error.message || 'Erro ao criar perfil';
    if (msg.includes('already') || msg.includes('registered')) {
      return jsonResponse({ error: 'Este e-mail já está cadastrado.' }, 409);
    }
    return jsonResponse({ error: msg }, 500);
  }

  const userId = data?.user?.id ?? null;
  if (userId) {
    // Aguarda o trigger criar o profile e vincula a organização (solo/clinic).
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      if (profileRow?.id) break;
      await new Promise((r) => setTimeout(r, 150));
    }

    const orgName =
      organization_name ||
      (accountType === 'clinic' || accountType === 'salon' ? full_name : null) ||
      full_name ||
      email;

    const { error: orgError } = await supabase.rpc('ensure_profile_organization', {
      p_user_id: userId,
      p_account_type: accountType,
      p_org_name: orgName,
    });

    if (orgError) {
      // Fallback direto se a RPC ainda não existir no banco.
      const { error: updError } = await supabase
        .from('profiles')
        .update({ account_type: accountType })
        .eq('id', userId);
      if (updError) {
        const hint =
          accountType === 'salon'
            ? ' Aplique as migrations do tipo salon no Supabase (20260830120000 e 20260830120100).'
            : '';
        return jsonResponse(
          {
            error:
              (updError.message || orgError.message || 'Não foi possível definir o tipo de conta.') +
              hint,
          },
          500
        );
      }
    }

    const { data: verify } = await supabase
      .from('profiles')
      .select('account_type')
      .eq('id', userId)
      .maybeSingle();
    if (verify && verify.account_type !== accountType) {
      return jsonResponse(
        {
          error:
            accountType === 'salon'
              ? 'Tipo salon não gravou no banco. Aplique as migrations 20260830120000 e 20260830120100 no Supabase.'
              : `Tipo de conta esperado "${accountType}", mas ficou "${verify.account_type}".`,
        },
        500
      );
    }
  }

  const { ip, user_agent } = getRequestMeta(request);
  await insertAuditLog({
    user_id: null,
    action: 'user_created',
    entity: 'user',
    entity_id: userId,
    ip,
    user_agent,
    details: {
      email,
      account_type: accountType,
      created_by_admin: adminCheck.adminEmail,
    },
  });

  return jsonResponse(
    {
      ...data,
      account_type: accountType,
    },
    201
  );
}
