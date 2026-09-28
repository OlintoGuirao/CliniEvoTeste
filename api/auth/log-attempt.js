/**
 * POST /api/auth/log-attempt
 * Registra tentativa de login e aplica lockout anti brute-force.
 *
 * Body:
 * - { checkOnly: true } — só verifica se o IP está bloqueado (sem gravar auditoria)
 * - { success: boolean } — registra sucesso/falha
 *
 * Regras:
 * - Rate limit auth: 30 req/min/IP (+ global implícito via auth preset)
 * - 5 falhas em 15 min no IP → 429 até expirar a janela
 */

import {
  enforceRateLimit,
  getClientIP,
  getLoginFailMeta,
  incrLoginFail,
  clearLoginFail,
  loginBlockedResponse,
  rateLimitHeaders,
} from '../_lib/rateLimit.js';
import { insertAuditLog, getRequestMeta } from '../_lib/auditLog.js';
import { parseBody, authLogAttemptSchema } from '../_lib/schemas.js';

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

export async function POST(request) {
  const blockedByAuth = await enforceRateLimit(
    request,
    'auth',
    'Muitas requisições de autenticação. Tente novamente em 1 minuto.'
  );
  if (blockedByAuth) return blockedByAuth;

  const ip = getClientIP(request);
  const meta = await getLoginFailMeta(ip);
  if (meta.blocked) {
    return loginBlockedResponse(meta);
  }

  const parsed = await parseBody(request, authLogAttemptSchema);
  if (parsed.error) {
    return jsonResponse({ error: parsed.error }, parsed.status ?? 400);
  }

  const { success, checkOnly } = parsed.data;

  if (checkOnly) {
    return jsonResponse(
      { ok: true, blocked: false, remaining: meta.remaining },
      200,
      rateLimitHeaders({
        limit: meta.limit,
        remaining: meta.remaining,
        resetEpochSec: meta.resetEpochSec,
        success: true,
      })
    );
  }

  if (success === false) {
    const count = await incrLoginFail(ip);
    if (count >= meta.limit) {
      const after = await getLoginFailMeta(ip);
      return loginBlockedResponse(after);
    }
  } else if (success === true) {
    await clearLoginFail(ip);
  }

  const { ip: ipMeta, user_agent } = getRequestMeta(request);
  await insertAuditLog({
    user_id: null,
    action: success ? 'login_success' : 'login_failure',
    entity: 'auth',
    entity_id: null,
    ip: ipMeta,
    user_agent,
    details: { success },
  });

  const afterMeta = await getLoginFailMeta(ip);
  return jsonResponse(
    { ok: true },
    200,
    rateLimitHeaders({
      limit: afterMeta.limit,
      remaining: afterMeta.remaining,
      resetEpochSec: afterMeta.resetEpochSec,
      success: true,
    })
  );
}
