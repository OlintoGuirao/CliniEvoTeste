/**
 * POST /api/audit
 * Registra ação sensível a partir do frontend (ex.: geração de PDF, exclusão).
 * Requer: Authorization: Bearer <access_token>
 * Body: { action: string, entity: string, entity_id?: string, details?: object }
 */

import { enforceRateLimit } from './_lib/rateLimit.js';
import { insertAuditLog, getRequestMeta } from './_lib/auditLog.js';
import { parseBody, auditBodySchema } from './_lib/schemas.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getUserIdFromToken(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
  });
  const data = await res.json().catch(() => ({}));
  return data?.id ?? null;
}

export async function POST(request) {
  const blocked = await enforceRateLimit(
    request,
    'global',
    'Muitas requisições. Tente novamente em 1 minuto.'
  );
  if (blocked) return blocked;

  const userId = await getUserIdFromToken(request);
  if (!userId) {
    return jsonResponse({ error: 'Não autorizado' }, 401);
  }

  const parsed = await parseBody(request, auditBodySchema);
  if (parsed.error) {
    return jsonResponse({ error: parsed.error }, parsed.status ?? 400);
  }

  const { ip, user_agent } = getRequestMeta(request);
  await insertAuditLog({
    user_id: userId,
    action: parsed.data.action,
    entity: parsed.data.entity,
    entity_id: parsed.data.entity_id ?? null,
    ip,
    user_agent,
    details: parsed.data.details ?? null,
  });

  return jsonResponse({ ok: true }, 200);
}
