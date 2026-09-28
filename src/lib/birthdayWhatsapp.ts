import { getChatbotApiBase } from '@/lib/programaBotoxBilling';

export const DEFAULT_BIRTHDAY_WHATSAPP_MESSAGE =
  'Olá, {{nome}}! 🎉\n\n' +
  'Parabéns pelo seu aniversário! Que seu dia seja incrível.\n\n' +
  'Um abraço,\n{{profissional}}';

export function buildBirthdayWhatsappPreview(
  template: string,
  patientName = 'Maria Silva',
  professionalName = 'Dra. Ana'
): string {
  const nome = patientName.trim() || 'Paciente';
  const primeiroNome = nome.split(/\s+/)[0] || nome;
  const profissional = professionalName.trim() || 'Profissional';
  const base = template.trim() || DEFAULT_BIRTHDAY_WHATSAPP_MESSAGE;

  return base
    .replace(/\{\{nome\}\}/gi, nome)
    .replace(/\{\{primeiro_nome\}\}/gi, primeiroNome)
    .replace(/\{\{profissional\}\}/gi, profissional);
}

export type BirthdayWhatsappTestSummary = {
  weekStart?: string;
  weekEnd?: string;
  runDate?: string;
  date?: string;
  total: number;
  sent: number;
  skipped: number;
  errors: number;
  sentPatients?: Array<{ patientName: string; messageId?: string | null }>;
  skippedPatients?: Array<{ patientName: string; reason: string }>;
  errorPatients?: Array<{ patientName: string; error: string }>;
};

export async function runBirthdayWhatsappTestNow(professionalId: string): Promise<{
  ok: boolean;
  message?: string;
  summary?: BirthdayWhatsappTestSummary;
  error?: string;
}> {
  const base = getChatbotApiBase();
  if (!base) {
    return { ok: false, error: 'Configure VITE_CHATBOT_API_URL para testar o envio de aniversário.' };
  }

  const res = await fetch(`${base}/birthday-whatsapp/run-now/${professionalId}`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: typeof data?.error === 'string' ? data.error : 'Falha ao testar aniversário' };
  }
  return {
    ok: true,
    message: typeof data?.message === 'string' ? data.message : undefined,
    summary: data?.summary as BirthdayWhatsappTestSummary | undefined,
  };
}
