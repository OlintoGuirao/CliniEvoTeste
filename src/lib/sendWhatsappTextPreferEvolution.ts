import { getChatbotApiBase, phoneToWhatsAppDigits } from '@/lib/programaBotoxBilling';
import { openWhatsAppWithFallback } from '@/lib/reportShare';

export type SendWhatsappTextParams = {
  professionalId: string;
  phone: string;
  message: string;
  patientId?: string | null;
  bookingProfessionalId?: string | null;
  /** Preferir abrir app → wa.me (padrão) em vez de só window.open(wa.me). */
  preferAppOpen?: boolean;
};

export type SendWhatsappTextResult = {
  /** true se saiu pelo WhatsApp conectado (Evolution). */
  viaEvolution: boolean;
  /** true se abriu wa.me / app como fallback (ou único caminho). */
  viaWaMe: boolean;
  error?: string;
};

async function trySendViaEvolution(params: SendWhatsappTextParams): Promise<{
  ok: boolean;
  error?: string;
}> {
  const base = getChatbotApiBase();
  if (!base) {
    return {
      ok: false,
      error: 'API do chatbot não configurada. Suba o backend (porta 4000) e tente de novo.',
    };
  }

  let res: Response;
  try {
    res = await fetch(`${base}/whatsapp/send-text/${params.professionalId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: params.patientId ?? null,
        bookingProfessionalId: params.bookingProfessionalId ?? null,
        phone: params.phone,
        message: params.message,
      }),
    });
  } catch {
    return {
      ok: false,
      error: 'Backend do WhatsApp indisponível (verifique se está rodando na porta 4000).',
    };
  }

  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    const err =
      typeof data?.error === 'string'
        ? data.error
        : typeof data?.message === 'string'
          ? data.message
          : res.status === 502 || res.status === 503 || res.status === 504
            ? 'Backend do WhatsApp indisponível. Reinicie o servidor e tente de novo.'
            : `Falha ao enviar pelo WhatsApp conectado (HTTP ${res.status}).`;
    return { ok: false, error: err };
  }
  return { ok: true };
}

function openWaMe(phone: string, message: string, preferAppOpen?: boolean) {
  const digits = phoneToWhatsAppDigits(phone) || phone.replace(/\D/g, '');
  if (!digits) return;
  if (preferAppOpen !== false) {
    openWhatsAppWithFallback({ phone: digits, text: message });
    return;
  }
  window.open(
    `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
    '_blank',
    'noopener,noreferrer'
  );
}

/**
 * Padrão do produto: tenta Evolution (WhatsApp conectado).
 * Se falhar (desconectado, API fora, etc.), abre wa.me com a mesma mensagem —
 * exceto quando o número claramente não tem WhatsApp.
 */
export async function sendWhatsappTextPreferEvolution(
  params: SendWhatsappTextParams
): Promise<SendWhatsappTextResult> {
  const message = String(params.message || '').trim();
  const phone = String(params.phone || '').trim();
  if (!message) {
    return { viaEvolution: false, viaWaMe: false, error: 'Mensagem vazia.' };
  }
  if (!phone && !params.patientId) {
    return { viaEvolution: false, viaWaMe: false, error: 'Telefone não informado.' };
  }

  try {
    const evolution = await trySendViaEvolution(params);
    if (evolution.ok) {
      return { viaEvolution: true, viaWaMe: false };
    }

    const errText = String(evolution.error || '');
    const numberInvalidOnWhatsApp = /não tem WhatsApp|nao tem WhatsApp|inválido/i.test(errText);
    if (numberInvalidOnWhatsApp) {
      return { viaEvolution: false, viaWaMe: false, error: errText };
    }

    if (phone) {
      openWaMe(phone, message, params.preferAppOpen);
      return { viaEvolution: false, viaWaMe: true, error: evolution.error };
    }
    return { viaEvolution: false, viaWaMe: false, error: evolution.error };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Erro ao enviar WhatsApp.';
    if (phone) {
      openWaMe(phone, message, params.preferAppOpen);
      return { viaEvolution: false, viaWaMe: true, error: err };
    }
    return { viaEvolution: false, viaWaMe: false, error: err };
  }
}
