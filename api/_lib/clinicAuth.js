import { createClient } from '@supabase/supabase-js';
import { isSharedOrgType, normalizeAccountType, orgTypeLabel } from './accountType.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function getBearerToken(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}

export async function requireClinicOwner(request) {
  const token = getBearerToken(request);
  if (!token) {
    return { error: jsonResponse({ error: 'Token não informado. Faça login novamente.' }, 401) };
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return { error: jsonResponse({ error: 'Configuração do servidor inválida' }, 500) };
  }

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });
  const userData = await userRes.json().catch(() => ({}));
  if (!userRes.ok || !userData?.id) {
    return { error: jsonResponse({ error: 'Token expirado ou inválido. Faça login novamente.' }, 401) };
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const userId = String(userData.id);
  const { data: membership, error: mErr } = await admin
    .from('organization_members')
    .select('organization_id, role, branch_id, organizations!inner(id, name, type)')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .maybeSingle();

  if (mErr) {
    return { error: jsonResponse({ error: mErr.message }, 500) };
  }

  const org = membership?.organizations;
  const orgRow = Array.isArray(org) ? org[0] : org;
  const orgType = normalizeAccountType(orgRow?.type);
  if (!membership?.organization_id || !orgRow || !isSharedOrgType(orgType)) {
    return {
      error: jsonResponse({ error: 'Acesso restrito ao Admin/Master da organização.' }, 403),
    };
  }

  const label = orgTypeLabel(orgType);
  return {
    admin,
    ownerUserId: userId,
    organizationId: String(membership.organization_id),
    organization: {
      id: String(orgRow.id),
      name: String(orgRow.name || (orgType === 'salon' ? 'Salão' : 'Clínica')),
      type: orgType,
    },
    role: 'owner',
    orgLabel: label,
  };
}

/** Qualquer membro de clínica/salão (owner / professional / attendant). Solo → 403. */
export async function requireClinicMember(request) {
  const token = getBearerToken(request);
  if (!token) {
    return { error: jsonResponse({ error: 'Token não informado. Faça login novamente.' }, 401) };
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return { error: jsonResponse({ error: 'Configuração do servidor inválida' }, 500) };
  }

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });
  const userData = await userRes.json().catch(() => ({}));
  if (!userRes.ok || !userData?.id) {
    return { error: jsonResponse({ error: 'Token expirado ou inválido. Faça login novamente.' }, 401) };
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const userId = String(userData.id);
  const { data: membership, error: mErr } = await admin
    .from('organization_members')
    .select('organization_id, role, organizations!inner(id, name, type)')
    .eq('user_id', userId)
    .maybeSingle();

  if (mErr) {
    return { error: jsonResponse({ error: mErr.message }, 500) };
  }

  const org = membership?.organizations;
  const orgRow = Array.isArray(org) ? org[0] : org;
  const orgType = normalizeAccountType(orgRow?.type);
  if (!membership?.organization_id || !orgRow || !isSharedOrgType(orgType)) {
    return {
      error: jsonResponse({ error: 'Acesso restrito a membros da organização.' }, 403),
    };
  }

  return {
    admin,
    userId,
    organizationId: String(membership.organization_id),
    organization: {
      id: String(orgRow.id),
      name: String(orgRow.name || (orgType === 'salon' ? 'Salão' : 'Clínica')),
      type: orgType,
    },
    role: membership.role,
    isOwner: membership.role === 'owner',
  };
}
