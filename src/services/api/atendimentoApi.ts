import { getChatbotApiBase } from '@/lib/programaBotoxBilling';

function apiBase() {
  const base = getChatbotApiBase();
  if (!base) throw new Error('URL da API do chatbot não configurada.');
  return base.replace(/\/$/, '');
}

export type Conversation = {
  id: string;
  patient_phone: string;
  patient_name: string | null;
  patient_id?: string | null;
  last_sender_type?: 'patient' | 'bot' | 'professional' | null;
  status: 'open' | 'closed';
  opened_at: string;
  last_message_at: string;
  last_message_preview: string | null;
};

export type Message = {
  id: string;
  direction: 'inbound' | 'outbound';
  sender_type?: 'patient' | 'bot' | 'professional';
  body: string;
  sent_at: string;
  provider_message_id: string | null;
};

export async function ensureAtendimentoConversation(params: {
  professionalId: string;
  phone: string;
  patientName?: string | null;
}): Promise<{ id: string }> {
  const res = await fetch(`${apiBase()}/atendimento/conversations/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Falha ao abrir conversa');
  }
  const json = await res.json();
  const id = String((json as { conversation?: { id?: string } }).conversation?.id || '');
  if (!id) throw new Error('Conversa não retornada pelo servidor');
  return { id };
}

export async function fetchConversations(professionalId: string): Promise<Conversation[]> {
  const res = await fetch(`${apiBase()}/atendimento/conversations/${professionalId}`);
  if (!res.ok) throw new Error('Falha ao carregar conversas');
  const json = await res.json();
  return json.conversations as Conversation[];
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const res = await fetch(`${apiBase()}/atendimento/conversations/${conversationId}/messages`);
  if (!res.ok) throw new Error('Falha ao carregar mensagens');
  const json = await res.json();
  return json.messages as Message[];
}

export async function sendReply(
  conversationId: string,
  opts: {
    professionalId: string;
    body: string;
    phone: string;
  }
): Promise<void> {
  const res = await fetch(`${apiBase()}/atendimento/conversations/${conversationId}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Falha ao enviar mensagem');
  }
}

export async function closeConversation(conversationId: string, phone?: string): Promise<void> {
  const res = await fetch(`${apiBase()}/atendimento/conversations/${conversationId}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) throw new Error('Falha ao encerrar conversa');
}

export async function linkConversationPatient(
  conversationId: string,
  opts: { patientId: string | null; patientName?: string | null }
): Promise<Conversation> {
  const res = await fetch(
    `${apiBase()}/atendimento/conversations/${conversationId}/link-patient`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Falha ao vincular paciente');
  }
  const json = await res.json();
  return (json as { conversation: Conversation }).conversation;
}

export async function syncConversations(professionalId: string): Promise<{
  conversations: Conversation[];
  imported: number;
  found: number;
}> {
  const res = await fetch(`${apiBase()}/atendimento/conversations/${professionalId}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Falha ao sincronizar conversas');
  }
  const json = await res.json();
  return {
    conversations: (json.conversations ?? []) as Conversation[],
    imported: Number(json.imported || 0),
    found: Number(json.found || 0),
  };
}
