/**
 * Rate limit por IP para endpoints /api (Vercel serverless).
 *
 * Store: Upstash Redis (REST) quando configurado; senão memória no isolate
 * (útil em dev; em produção serverless o ideal é Redis para contagem compartilhada).
 *
 * Presets:
 * - global: 100 req / min / IP  (anti-DoS)
 * - admin:  30 req / min / IP  (rotas admin)
 * - auth:   30 req / min / IP  (log-attempt / auth API)
 * - email:   5 req / hora / IP (recovery / e-mail)
 * - chatbot: 60 req / min / IP (proxy)
 *
 * Login fail lockout: 5 falhas / 15 min / IP → bloqueio até expirar a janela.
 */

export const PRESETS = {
  global: { windowMs: 60_000, max: 100, prefix: 'rl:g' },
  admin: { windowMs: 60_000, max: 30, prefix: 'rl:admin' },
  auth: { windowMs: 60_000, max: 30, prefix: 'rl:auth' },
  email: { windowMs: 3_600_000, max: 5, prefix: 'rl:email' },
  chatbot: { windowMs: 60_000, max: 60, prefix: 'rl:chatbot' },
};

export const LOGIN_FAIL = {
  windowMs: 900_000, // 15 min
  max: 5,
  prefix: 'rl:login_fail',
};

/** @type {Map<string, { count: number, resetAt: number }>} */
const memoryBuckets = new Map();

function hasRedis() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/** Em produção, sem Redis o memory store ainda limita por isolate (melhor que aberto). */
function preferFailOpen() {
  return process.env.RATE_LIMIT_FAIL_OPEN === 'true';
}

export function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  if (realIP) return realIP.trim();
  return 'unknown';
}

async function redisCommand(command, args = []) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const res = await fetch(url.replace(/\/$/, ''), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([command, ...args]),
  });
  const data = await res.json().catch(() => ({}));
  if (data?.error) return null;
  return data?.result;
}

function memoryConsume(key, windowMs, max) {
  const now = Date.now();
  let entry = memoryBuckets.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    memoryBuckets.set(key, entry);
  }
  entry.count += 1;
  // Evita crescimento infinito em cold instances longas
  if (memoryBuckets.size > 5_000) {
    for (const [k, v] of memoryBuckets) {
      if (v.resetAt <= now) memoryBuckets.delete(k);
    }
  }
  const remaining = Math.max(0, max - entry.count);
  const resetEpochSec = Math.ceil(entry.resetAt / 1000);
  const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return {
    success: entry.count <= max,
    limit: max,
    remaining,
    resetEpochSec,
    retryAfterSec,
  };
}

async function redisConsume(key, windowMs, max) {
  const ttlSec = Math.max(1, Math.ceil(windowMs / 1000));
  const count = await redisCommand('INCR', [key]);
  if (count == null) return null;
  if (count === 1) {
    await redisCommand('EXPIRE', [key, ttlSec]);
  }
  let pttl = await redisCommand('PTTL', [key]);
  if (pttl == null || pttl < 0) pttl = windowMs;
  const now = Date.now();
  const resetEpochSec = Math.ceil((now + Number(pttl)) / 1000);
  const retryAfterSec = Math.max(1, Math.ceil(Number(pttl) / 1000));
  return {
    success: count <= max,
    limit: max,
    remaining: Math.max(0, max - count),
    resetEpochSec,
    retryAfterSec,
  };
}

/**
 * Consome 1 unidade do bucket.
 * @param {string} ip
 * @param {{ windowMs: number, max: number, prefix: string }} preset
 */
export async function consumeLimit(ip, preset) {
  const bucket = Math.floor(Date.now() / preset.windowMs);
  const key = `${preset.prefix}:${ip}:${bucket}`;

  if (hasRedis()) {
    try {
      const result = await redisConsume(key, preset.windowMs, preset.max);
      if (result) return result;
      if (preferFailOpen()) {
        return {
          success: true,
          limit: preset.max,
          remaining: preset.max,
          resetEpochSec: Math.ceil((Date.now() + preset.windowMs) / 1000),
          retryAfterSec: Math.ceil(preset.windowMs / 1000),
        };
      }
    } catch {
      if (preferFailOpen()) {
        return {
          success: true,
          limit: preset.max,
          remaining: preset.max,
          resetEpochSec: Math.ceil((Date.now() + preset.windowMs) / 1000),
          retryAfterSec: Math.ceil(preset.windowMs / 1000),
        };
      }
    }
  }

  return memoryConsume(key, preset.windowMs, preset.max);
}

/** @deprecated Use enforceRateLimit — mantido para compatibilidade. */
export async function rateLimit(request, presetName = 'global') {
  const preset = PRESETS[presetName] || PRESETS.global;
  const ip = getClientIP(request);
  const result = await consumeLimit(ip, preset);
  return {
    success: result.success,
    remaining: result.remaining,
    limit: result.limit,
    resetEpochSec: result.resetEpochSec,
    retryAfterSec: result.retryAfterSec,
    ip,
  };
}

export function rateLimitHeaders(result) {
  return {
    'RateLimit-Limit': String(result.limit ?? 0),
    'RateLimit-Remaining': String(Math.max(0, result.remaining ?? 0)),
    'RateLimit-Reset': String(result.resetEpochSec ?? 0),
    ...(result.success
      ? {}
      : { 'Retry-After': String(result.retryAfterSec ?? 60) }),
  };
}

export function tooManyRequestsResponse(result, message) {
  const body = {
    error:
      message ||
      'Muitas requisições. Tente novamente mais tarde.',
  };
  return new Response(JSON.stringify(body), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...rateLimitHeaders({ ...result, success: false }),
    },
  });
}

/**
 * Aplica o preset e retorna Response 429 ou null se ok.
 * @param {Request} request
 * @param {keyof typeof PRESETS} [presetName]
 * @param {string} [message]
 */
export async function enforceRateLimit(request, presetName = 'global', message) {
  const rl = await rateLimit(request, presetName);
  if (!rl.success) {
    return tooManyRequestsResponse(rl, message);
  }
  return null;
}

// --- Login fail lockout (5 / 15 min) ---

function loginFailKey(ip) {
  return `${LOGIN_FAIL.prefix}:${ip}`;
}

export async function getLoginFailCount(ip) {
  const key = loginFailKey(ip);
  if (hasRedis()) {
    try {
      const raw = await redisCommand('GET', [key]);
      return parseInt(raw ?? 0, 10) || 0;
    } catch {
      /* fallthrough */
    }
  }
  const entry = memoryBuckets.get(key);
  if (!entry || entry.resetAt <= Date.now()) return 0;
  return entry.count;
}

export async function getLoginFailMeta(ip) {
  const key = loginFailKey(ip);
  if (hasRedis()) {
    try {
      const raw = await redisCommand('GET', [key]);
      const count = parseInt(raw ?? 0, 10) || 0;
      let pttl = await redisCommand('PTTL', [key]);
      if (pttl == null || pttl < 0) pttl = LOGIN_FAIL.windowMs;
      return {
        count,
        blocked: count >= LOGIN_FAIL.max,
        resetEpochSec: Math.ceil((Date.now() + Number(pttl)) / 1000),
        retryAfterSec: Math.max(1, Math.ceil(Number(pttl) / 1000)),
        limit: LOGIN_FAIL.max,
        remaining: Math.max(0, LOGIN_FAIL.max - count),
      };
    } catch {
      /* fallthrough */
    }
  }
  const entry = memoryBuckets.get(key);
  const now = Date.now();
  if (!entry || entry.resetAt <= now) {
    return {
      count: 0,
      blocked: false,
      resetEpochSec: Math.ceil((now + LOGIN_FAIL.windowMs) / 1000),
      retryAfterSec: Math.ceil(LOGIN_FAIL.windowMs / 1000),
      limit: LOGIN_FAIL.max,
      remaining: LOGIN_FAIL.max,
    };
  }
  return {
    count: entry.count,
    blocked: entry.count >= LOGIN_FAIL.max,
    resetEpochSec: Math.ceil(entry.resetAt / 1000),
    retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    limit: LOGIN_FAIL.max,
    remaining: Math.max(0, LOGIN_FAIL.max - entry.count),
  };
}

export async function incrLoginFail(ip) {
  const key = loginFailKey(ip);
  if (hasRedis()) {
    try {
      const count = await redisCommand('INCR', [key]);
      if (count === 1) {
        await redisCommand('EXPIRE', [key, Math.ceil(LOGIN_FAIL.windowMs / 1000)]);
      }
      return parseInt(count ?? 0, 10) || 0;
    } catch {
      /* fallthrough */
    }
  }
  const result = memoryConsume(key, LOGIN_FAIL.windowMs, LOGIN_FAIL.max);
  // memoryConsume always increments; return count = limit - remaining + (over?)
  const entry = memoryBuckets.get(key);
  return entry?.count ?? result.limit - result.remaining;
}

export async function clearLoginFail(ip) {
  const key = loginFailKey(ip);
  if (hasRedis()) {
    try {
      await redisCommand('DEL', [key]);
    } catch {
      /* ignore */
    }
  }
  memoryBuckets.delete(key);
}

export function loginBlockedResponse(meta) {
  return tooManyRequestsResponse(
    {
      limit: meta.limit,
      remaining: 0,
      resetEpochSec: meta.resetEpochSec,
      retryAfterSec: meta.retryAfterSec,
      success: false,
    },
    'Muitas tentativas de login falhas. Tente novamente em 15 minutos.'
  );
}
