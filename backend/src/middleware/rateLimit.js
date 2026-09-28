/**
 * Rate limit em memória por IP (processo Node).
 * Adequado para uma única instância PM2; para cluster/multi-host, use Redis depois.
 */

const GLOBAL = { windowMs: 60_000, max: 100, prefix: 'rl:g' };
const WEBHOOK = { windowMs: 60_000, max: 300, prefix: 'rl:webhook' };

/** @type {Map<string, { count: number, resetAt: number }>} */
const buckets = new Map();

function getClientIP(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0].trim();
  }
  if (typeof req.headers['x-real-ip'] === 'string' && req.headers['x-real-ip'].trim()) {
    return req.headers['x-real-ip'].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function consume(ip, preset) {
  const now = Date.now();
  const bucket = Math.floor(now / preset.windowMs);
  const key = `${preset.prefix}:${ip}:${bucket}`;
  let entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: (bucket + 1) * preset.windowMs };
    buckets.set(key, entry);
  }
  entry.count += 1;

  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }

  const remaining = Math.max(0, preset.max - entry.count);
  const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  const resetEpochSec = Math.ceil(entry.resetAt / 1000);
  return {
    ok: entry.count <= preset.max,
    limit: preset.max,
    remaining,
    retryAfterSec,
    resetEpochSec,
  };
}

function send429(res, result, message) {
  res.setHeader('RateLimit-Limit', String(result.limit));
  res.setHeader('RateLimit-Remaining', '0');
  res.setHeader('RateLimit-Reset', String(result.resetEpochSec));
  res.setHeader('Retry-After', String(result.retryAfterSec));
  res.setHeader('Cache-Control', 'no-store');
  return res.status(429).json({
    error: message || 'Too Many Requests',
  });
}

function attachHeaders(res, result) {
  res.setHeader('RateLimit-Limit', String(result.limit));
  res.setHeader('RateLimit-Remaining', String(result.remaining));
  res.setHeader('RateLimit-Reset', String(result.resetEpochSec));
}

/**
 * Middleware global: 100 req/min/IP. Ignora /health e OPTIONS.
 * Webhook WhatsApp: 300 req/min/IP (tráfego Evolution).
 */
function rateLimitMiddleware(req, res, next) {
  if (req.method === 'OPTIONS') return next();
  if (req.path === '/health' || req.url === '/health') return next();

  const ip = getClientIP(req);
  const isWebhook =
    req.path === '/webhook/whatsapp' ||
    String(req.url || '').startsWith('/webhook/whatsapp');
  const preset = isWebhook ? WEBHOOK : GLOBAL;
  const result = consume(ip, preset);

  attachHeaders(res, result);

  if (!result.ok) {
    return send429(
      res,
      result,
      isWebhook
        ? 'Webhook rate limit excedido. Tente novamente em breve.'
        : 'Muitas requisições. Tente novamente em 1 minuto.'
    );
  }
  return next();
}

module.exports = { rateLimitMiddleware, getClientIP };
