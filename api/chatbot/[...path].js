/**
 * Fallback serverless proxy (dev / se rewrite externo não aplicar).
 * Em produção o vercel.json encaminha /api/chatbot/* direto para a VPS.
 */

import { enforceRateLimit } from '../_lib/rateLimit.js';

const BACKEND = (process.env.CHATBOT_BACKEND_URL || 'http://129.121.52.242:4000').replace(
  /\/+$/,
  ''
);

function jsonError(message, status = 502) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function proxyRequest(request) {
  if (request.method !== 'OPTIONS') {
    const limited = await enforceRateLimit(
      request,
      'chatbot',
      'Muitas requisições ao chatbot. Tente novamente em 1 minuto.'
    );
    if (limited) return limited;
  }

  const url = new URL(request.url);
  const subPath = url.pathname.replace(/^\/api\/chatbot\/?/, '');
  const target = `${BACKEND}/${subPath}${url.search}`;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const accept = request.headers.get('accept');
  if (accept) headers.set('accept', accept);

  const init = { method: request.method, headers };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(target, init);
    const responseHeaders = new Headers();
    const upstreamType = upstream.headers.get('content-type');
    if (upstreamType) responseHeaders.set('content-type', upstreamType);

    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return jsonError('Backend do chatbot indisponível. Tente novamente em instantes.');
  }
}

export async function GET(request) {
  return proxyRequest(request);
}

export async function POST(request) {
  return proxyRequest(request);
}

export async function PUT(request) {
  return proxyRequest(request);
}

export async function PATCH(request) {
  return proxyRequest(request);
}

export async function DELETE(request) {
  return proxyRequest(request);
}

export async function OPTIONS(request) {
  return proxyRequest(request);
}
