import { normalizePhoneDigits } from '@/lib/phone';
import type { Conversation } from '@/services/api/atendimentoApi';

export type AtendimentoQueueFilter =
  | 'all'
  | 'waiting_you'
  | 'waiting_client'
  | 'no_patient';

export type AtendimentoLinkedPatient = {
  id: string;
  full_name: string;
  phone: string | null;
};

export const ATENDIMENTO_QUICK_REPLIES: Array<{ id: string; label: string; body: string }> = [
  {
    id: 'greeting',
    label: 'Saudação',
    body: 'Olá! Sou da recepção. Em que posso ajudar?',
  },
  {
    id: 'confirm',
    label: 'Confirmar presença',
    body: 'Olá! Pode confirmar sua presença na consulta de hoje, por favor?',
  },
  {
    id: 'wait',
    label: 'Aguarde um momento',
    body: 'Recebi sua mensagem. Vou verificar e já retorno, ok?',
  },
  {
    id: 'thanks',
    label: 'Agradecer',
    body: 'Obrigada pelo contato! Qualquer dúvida, estamos à disposição.',
  },
];

export function phonesMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const left = normalizePhoneDigits(a);
  const right = normalizePhoneDigits(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 9 && right.length >= 9 && left.slice(-9) === right.slice(-9)) return true;
  if (left.length >= 8 && right.length >= 8 && left.slice(-8) === right.slice(-8)) return true;
  return false;
}

export function matchPatientByPhone<T extends { id: string; full_name: string; phone: string | null }>(
  patients: T[],
  phone: string | null | undefined
): T | null {
  if (!phone || patients.length === 0) return null;
  return patients.find((p) => phonesMatch(p.phone, phone)) ?? null;
}

export function resolveConversationPatient(
  conv: Conversation | null | undefined,
  patients: AtendimentoLinkedPatient[]
): AtendimentoLinkedPatient | null {
  if (!conv) return null;
  if (conv.patient_id) {
    const byId = patients.find((p) => p.id === conv.patient_id);
    if (byId) return byId;
    if (conv.patient_name) {
      return { id: conv.patient_id, full_name: conv.patient_name, phone: conv.patient_phone };
    }
  }
  return matchPatientByPhone(patients, conv.patient_phone);
}

export function conversationQueueStatus(
  conv: Conversation
): 'waiting_you' | 'waiting_client' {
  if (conv.last_sender_type === 'patient') return 'waiting_you';
  if (conv.last_sender_type === 'professional' || conv.last_sender_type === 'bot') {
    return 'waiting_client';
  }
  // Sem histórico de remetente: trata como aguardando a clínica
  return 'waiting_you';
}

export function filterClinicConversations(opts: {
  conversations: Conversation[];
  patients: AtendimentoLinkedPatient[];
  filter: AtendimentoQueueFilter;
  search: string;
}): Conversation[] {
  const q = opts.search.trim().toLowerCase();
  return opts.conversations.filter((conv) => {
    const linked = resolveConversationPatient(conv, opts.patients);
    const queue = conversationQueueStatus(conv);

    if (opts.filter === 'waiting_you' && queue !== 'waiting_you') return false;
    if (opts.filter === 'waiting_client' && queue !== 'waiting_client') return false;
    if (opts.filter === 'no_patient' && linked) return false;

    if (!q) return true;
    const hay = [
      conv.patient_name,
      conv.patient_phone,
      linked?.full_name,
      linked?.phone,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export function countClinicConversationFilters(
  conversations: Conversation[],
  patients: AtendimentoLinkedPatient[]
): Record<AtendimentoQueueFilter, number> {
  return {
    all: conversations.length,
    waiting_you: conversations.filter((c) => conversationQueueStatus(c) === 'waiting_you').length,
    waiting_client: conversations.filter((c) => conversationQueueStatus(c) === 'waiting_client')
      .length,
    no_patient: conversations.filter((c) => !resolveConversationPatient(c, patients)).length,
  };
}
