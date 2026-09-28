function isDirectIpHttpsUrl(url: string): boolean {
  return /^https:\/\/\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/.*)?$/i.test(url);
}

/** URL same-origin do proxy Vercel → backend HTTP na VPS */
function productionChatbotProxyBase(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/api/chatbot`;
}

export function getChatbotApiBase(): string {
  const configured = String(import.meta.env.VITE_CHATBOT_API_URL || '').trim();
  if (configured) {
    const base = configured.replace(/\/+$/, '');
    // Backend na VPS (porta 4000) é HTTP; https://IP causa ERR_SSL_PROTOCOL_ERROR
    if (isDirectIpHttpsUrl(base)) return productionChatbotProxyBase();
    return base;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Dev: proxy Vite /api/chatbot → backend :4000 (igual produção)
    if (host === 'localhost' || host === '127.0.0.1') {
      return `${window.location.origin}/api/chatbot`;
    }
    return productionChatbotProxyBase();
  }
  return '';
}

export function phoneToWhatsAppDigits(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return `55${digits}`;
}

export function buildCobrancaBotoxMessage(patientName: string, professionalName: string): string {
  return (
    `Olá, ${patientName}! Aqui é ${professionalName}. ` +
    'Passando para lembrar que a mensalidade do seu programa de Botox está pendente. ' +
    'Por favor, entre em contato para regularizar o pagamento. Qualquer dúvida, estamos à disposição.'
  );
}

export function buildCobrancaBotoxWaMeUrl(phone: string | null | undefined, patientName: string, professionalName: string): string | null {
  const wa = phoneToWhatsAppDigits(phone);
  if (!wa) return null;
  const text = buildCobrancaBotoxMessage(patientName, professionalName);
  return `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
}

export type BotoxBillingTestSummary = {
  mesReferencia: string;
  total: number;
  sent: number;
  skipped: number;
  errors: number;
  sentPatients?: Array<{ patientName: string; messageId?: string | null }>;
  skippedPatients?: Array<{ patientName: string; reason: string }>;
  errorPatients?: Array<{ patientName: string; error: string }>;
};

export async function runBotoxBillingTestNow(professionalId: string): Promise<{
  ok: boolean;
  message?: string;
  summary?: BotoxBillingTestSummary;
  error?: string;
}> {
  const base = getChatbotApiBase();
  if (!base) {
    return { ok: false, error: 'Configure VITE_CHATBOT_API_URL para testar a cobrança automática.' };
  }

  const res = await fetch(`${base}/programa-botox/cobranca/run-now/${professionalId}`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: typeof data?.error === 'string' ? data.error : 'Falha ao testar cobrança' };
  }
  return {
    ok: true,
    message: typeof data?.message === 'string' ? data.message : undefined,
    summary: data?.summary as BotoxBillingTestSummary | undefined,
  };
}

export async function sendCobrancaViaEvolution(params: {
  professionalId: string;
  programaId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const base = getChatbotApiBase();
  if (!base) {
    return { ok: false, error: 'Configure VITE_CHATBOT_API_URL para enviar pelo WhatsApp conectado.' };
  }

  const res = await fetch(`${base}/programa-botox/cobrar/${params.professionalId}/${params.programaId}`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: typeof data?.error === 'string' ? data.error : 'Falha ao enviar cobrança' };
  }
  return { ok: true };
}
