import { getChatbotApiBase, phoneToWhatsAppDigits } from '@/lib/programaBotoxBilling';
import {
  DEFAULT_WHATSAPP_MANUAL_MESSAGES,
  applyWhatsappPlaceholders,
} from '@/lib/whatsappManualTemplates';

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

export type PixSettings = {
  pix_key: string | null;
  pix_key_type: PixKeyType | null;
  pix_receiver_name: string | null;
};

const PIX_KEY_TYPE_LABELS: Record<PixKeyType, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  phone: 'Telefone',
  random: 'Chave aleatória',
};

export function getPixKeyTypeLabel(type: PixKeyType | null | undefined): string {
  if (!type) return 'Chave PIX';
  return PIX_KEY_TYPE_LABELS[type] ?? 'Chave PIX';
}

export function normalizePixKeyForStorage(type: PixKeyType, raw: string): string {
  const trimmed = raw.trim();
  if (type === 'email') return trimmed.toLowerCase();
  if (type === 'phone' || type === 'cpf' || type === 'cnpj') return trimmed.replace(/\D/g, '');
  return trimmed;
}

export function maskPixKey(type: PixKeyType | null | undefined, key: string | null | undefined): string {
  if (!key) return '';
  const value = key.trim();
  if (!value) return '';

  if (type === 'email') {
    const [local, domain] = value.split('@');
    if (!domain) return value;
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${'*'.repeat(Math.max(1, local.length - visible.length))}@${domain}`;
  }

  if (type === 'phone') {
    const digits = value.replace(/\D/g, '');
    return `•••• ${digits.slice(-4)}`;
  }

  if (type === 'cpf' && digitsLength(value) === 11) {
    return `•••.•••.•••-${digitsOnly(value).slice(-2)}`;
  }

  if (type === 'cnpj' && digitsLength(value) === 14) {
    return `••.•••.•••/••••-${digitsOnly(value).slice(-2)}`;
  }

  if (type === 'random') {
    return `${value.slice(0, 4)}••••${value.slice(-4)}`;
  }

  return value;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function digitsLength(value: string): number {
  return digitsOnly(value).length;
}

export function validatePixKey(type: PixKeyType, raw: string): string | null {
  const value = normalizePixKeyForStorage(type, raw);
  if (!value) return 'Informe a chave PIX.';

  if (type === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'E-mail inválido.';
    return null;
  }

  if (type === 'cpf') {
    if (digitsLength(value) !== 11) return 'CPF deve ter 11 dígitos.';
    return null;
  }

  if (type === 'cnpj') {
    if (digitsLength(value) !== 14) return 'CNPJ deve ter 14 dígitos.';
    return null;
  }

  if (type === 'phone') {
    if (digitsLength(value) < 10 || digitsLength(value) > 13) return 'Telefone inválido.';
    return null;
  }

  if (type === 'random') {
    if (value.length < 8) return 'Chave aleatória inválida.';
    return null;
  }

  return null;
}

export function sanitizePixReceiverName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 25)
    .toUpperCase();
}

export function parsePixAmountBrl(input: string): number | null {
  const normalized = input.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

export function formatPixAmountBrl(amount: number): string {
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export async function generatePixQrDataUrl(params: {
  pixKey: string;
  receiverName: string;
  amount?: number | null;
  description?: string | null;
}): Promise<{ brCode: string; dataUrl: string } | null> {
  const base = getChatbotApiBase();
  if (!base) return null;

  const res = await fetch(`${base}/cobranca/preview-qr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pixKey: params.pixKey.trim(),
      receiverName: sanitizePixReceiverName(params.receiverName || 'RECEBEDOR'),
      amount: params.amount ?? null,
      description: params.description?.trim() || null,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data?.dataUrl !== 'string' || typeof data?.brCode !== 'string') {
    return null;
  }

  return { brCode: data.brCode, dataUrl: data.dataUrl };
}

export function buildCobrancaPixMessage(params: {
  patientName: string;
  professionalName: string;
  amount: number;
  description?: string | null;
  template?: string | null;
}): string {
  const normalizeDescriptionForMessage = (value: unknown): string =>
    String(value || '').replace(/\s+/g, ' ').trim();

  const valor = formatPixAmountBrl(params.amount);
  const desc = normalizeDescriptionForMessage(params.description);
  const referencia = desc ? `Referente à ${desc}, ` : '';

  return applyWhatsappPlaceholders(
    params.template?.trim() || DEFAULT_WHATSAPP_MANUAL_MESSAGES.cobranca_pix,
    {
      nome: params.patientName,
      profissional: params.professionalName,
      valor,
      descricao: desc,
      referencia,
    }
  );
}

export function buildCobrancaPixWaMeUrl(params: {
  phone: string | null | undefined;
  patientName: string;
  professionalName: string;
  amount: number;
  description?: string | null;
  brCode?: string | null;
  template?: string | null;
}): string | null {
  const wa = phoneToWhatsAppDigits(params.phone);
  if (!wa) return null;

  let text = buildCobrancaPixMessage({
    patientName: params.patientName,
    professionalName: params.professionalName,
    amount: params.amount,
    description: params.description,
    template: params.template,
  });

  if (params.brCode) {
    text += `\n\nCopia e cola PIX:\n${params.brCode}`;
  }

  return `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
}

export async function sendCobrancaPixViaEvolution(params: {
  professionalId: string;
  patientId: string;
  amount: number;
  description?: string | null;
  message?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const base = getChatbotApiBase();
  if (!base) {
    return { ok: false, error: 'Configure VITE_CHATBOT_API_URL para enviar pelo WhatsApp conectado.' };
  }

  const res = await fetch(`${base}/cobranca/enviar/${params.professionalId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId: params.patientId,
      amount: params.amount,
      description: params.description?.trim() || null,
      message: params.message?.trim() || null,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: typeof data?.error === 'string' ? data.error : 'Falha ao enviar cobrança' };
  }

  return { ok: true };
}
