import { getChatbotApiBase } from '@/lib/programaBotoxBilling';

export type Reminder24hStatusItem = {
  appointmentIds: string[];
  patientName: string;
  appointmentDate: string;
  startTime: string;
  endTime: string | null;
  hasPhone: boolean;
  reminder24hSentAt: string | null;
  status: 'sent' | 'pending' | 'no_phone';
  reason: string | null;
};

export type Reminder24hStatus = {
  date: string;
  dateLabel: string;
  total: number;
  sent: number;
  pending: number;
  skippedNoPhone: number;
  items: Reminder24hStatusItem[];
};

export type Reminder24hSendMissingSummary = {
  date: string;
  dateLabel: string;
  total: number;
  sent: number;
  skipped: number;
  errors: number;
  sentPatients?: Array<{ patientName: string; startTime?: string; messageId?: string | null }>;
  skippedPatients?: Array<{ patientName: string; startTime?: string; reason: string }>;
  errorPatients?: Array<{ patientName: string; startTime?: string; error: string }>;
};

export async function fetchReminder24hStatus(
  professionalId: string,
  date?: string
): Promise<{ ok: boolean; status?: Reminder24hStatus; error?: string }> {
  const base = getChatbotApiBase();
  if (!base) {
    return { ok: false, error: 'Configure VITE_CHATBOT_API_URL para consultar lembretes.' };
  }

  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  const res = await fetch(`${base}/appointment-reminders/24h/status/${professionalId}${qs}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data?.error === 'string' ? data.error : 'Falha ao consultar lembretes',
    };
  }

  return {
    ok: true,
    status: {
      date: String(data.date || ''),
      dateLabel: String(data.dateLabel || data.date || ''),
      total: Number(data.total) || 0,
      sent: Number(data.sent) || 0,
      pending: Number(data.pending) || 0,
      skippedNoPhone: Number(data.skippedNoPhone) || 0,
      items: Array.isArray(data.items) ? data.items : [],
    },
  };
}

export async function sendMissingReminder24h(
  professionalId: string,
  opts?: { date?: string; appointmentIds?: string[] }
): Promise<{
  ok: boolean;
  message?: string;
  summary?: Reminder24hSendMissingSummary;
  error?: string;
}> {
  const base = getChatbotApiBase();
  if (!base) {
    return { ok: false, error: 'Configure VITE_CHATBOT_API_URL para enviar lembretes.' };
  }

  const res = await fetch(`${base}/appointment-reminders/24h/send-missing/${professionalId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: opts?.date,
      appointmentIds: opts?.appointmentIds,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data?.error === 'string' ? data.error : 'Falha ao enviar lembretes faltantes',
    };
  }

  return {
    ok: true,
    message: typeof data?.message === 'string' ? data.message : undefined,
    summary: data?.summary as Reminder24hSendMissingSummary | undefined,
  };
}
