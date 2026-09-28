/**
 * Insere registro em audit_logs. Usar apenas em serverless com SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function insertAuditLog(entry) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  await supabase.from('audit_logs').insert({
    user_id: entry.user_id ?? null,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entity_id ?? null,
    ip: entry.ip ?? null,
    user_agent: entry.user_agent ?? null,
    details: entry.details ?? null,
  });
}

export function getRequestMeta(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || null;
  const user_agent = request.headers.get('user-agent') || null;
  return { ip, user_agent };
}
