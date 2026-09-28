import { getChatbotApiBase } from '@/lib/programaBotoxBilling';

export type BudgetQuoteBillingSummary = {
  mesReferencia: string;
  total: number;
  sent: number;
  skipped: number;
  errors: number;
  sentPatients?: Array<{ patientName: string; messageId?: string | null }>;
  skippedPatients?: Array<{ patientName: string; reason: string }>;
  errorPatients?: Array<{ patientName: string; error: string }>;
};

export async function runBudgetQuoteBillingNow(professionalId: string): Promise<{
  ok: boolean;
  message?: string;
  summary?: BudgetQuoteBillingSummary;
  error?: string;
}> {
  const base = getChatbotApiBase();
  if (!base) {
    return { ok: false, error: 'Configure VITE_CHATBOT_API_URL para testar a cobrança automática.' };
  }

  const res = await fetch(`${base}/orcamento/cobranca/run-now/${professionalId}`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: typeof data?.error === 'string' ? data.error : 'Falha ao enviar cobrança' };
  }
  return {
    ok: true,
    message: typeof data?.message === 'string' ? data.message : undefined,
    summary: data?.summary as BudgetQuoteBillingSummary | undefined,
  };
}
