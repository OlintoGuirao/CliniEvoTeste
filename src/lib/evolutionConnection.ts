import { getChatbotApiBase } from '@/lib/programaBotoxBilling';

export type EvolutionConnectionPayload = {
  connected?: boolean;
  instanceId?: string;
  qr?: string | null;
  error?: string;
};

const INVALID_RESPONSE_ERROR =
  'Backend do chatbot indisponível ou desatualizado. Tente novamente em instantes.';

async function parseEvolutionJson(res: Response): Promise<EvolutionConnectionPayload | null> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('json')) return null;
  try {
    return (await res.json()) as EvolutionConnectionPayload;
  } catch {
    return null;
  }
}

function backendUnavailableMessage(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'Backend do chatbot indisponível. Rode `npm run backend` ou configure CHATBOT_BACKEND_URL no .env.';
    }
  }
  return INVALID_RESPONSE_ERROR;
}

/** Verifica conexão Evolution (status ou QR). */
export async function fetchEvolutionConnection(
  professionalId: string
): Promise<{ ok: true; data: EvolutionConnectionPayload } | { ok: false; error: string }> {
  const base = getChatbotApiBase();
  if (!base) {
    return { ok: false, error: 'Configure VITE_CHATBOT_API_URL para conectar o WhatsApp.' };
  }

  const urlBase = base.replace(/\/$/, '');

  try {
    const statusRes = await fetch(`${urlBase}/evolution/status/${professionalId}`);
    let res = statusRes;
    let data = await parseEvolutionJson(statusRes);

    if (statusRes.status === 404 || !data) {
      res = await fetch(`${urlBase}/evolution/qr/${professionalId}`);
      data = await parseEvolutionJson(res);
    }

    if (!data) {
      return { ok: false, error: res.ok ? INVALID_RESPONSE_ERROR : backendUnavailableMessage() };
    }
    if (!res.ok) {
      return { ok: false, error: data.error || 'Falha ao verificar conexão' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: backendUnavailableMessage() };
  }
}

export async function requestEvolutionQr(
  professionalId: string
): Promise<{ ok: true; data: EvolutionConnectionPayload } | { ok: false; error: string }> {
  const base = getChatbotApiBase();
  if (!base) {
    return { ok: false, error: 'Configure VITE_CHATBOT_API_URL para conectar o WhatsApp.' };
  }

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/evolution/qr/${professionalId}`);
    const data = await parseEvolutionJson(res);
    if (!data) {
      return { ok: false, error: res.ok ? INVALID_RESPONSE_ERROR : backendUnavailableMessage() };
    }
    if (!res.ok) {
      return { ok: false, error: data.error || 'Falha ao gerar QR Code' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: backendUnavailableMessage() };
  }
}
