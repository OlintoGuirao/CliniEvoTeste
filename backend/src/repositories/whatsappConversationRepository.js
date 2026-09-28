const { supabase } = require('../config/supabase');
const { logger } = require('../utils/logger');

const DEFAULT_BOT_NAME = 'Secretária Virtual';

/**
 * Abre ou reabre uma conversa de atendimento humano para o telefone dado.
 * Se já existir uma conversa 'open' para este profissional + telefone, retorna ela.
 */
async function openConversation({ professionalId, phone, patientName }) {
  if (!supabase) return null;

  const { data: existing } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('professional_id', professionalId)
    .eq('patient_phone', phone)
    .eq('status', 'open')
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .insert({
      professional_id: professionalId,
      patient_phone: phone,
      patient_name: patientName || null,
      status: 'open',
    })
    .select('id')
    .single();

  if (error) {
    logger.warn('Falha ao criar conversa de atendimento', {
      professionalId,
      phone,
      message: error.message,
    });
    return null;
  }
  return data;
}

/**
 * Salva uma mensagem na conversa e atualiza o preview/timestamp.
 * @param {'patient'|'bot'|'professional'} [senderType]
 */
async function saveMessage({
  conversationId,
  professionalId,
  direction,
  body,
  providerMessageId,
  senderType,
}) {
  if (!supabase || !conversationId) return null;

  const resolvedSender =
    senderType ||
    (direction === 'inbound' ? 'patient' : 'professional');

  const preview = String(body || '').slice(0, 120);
  const now = new Date().toISOString();

  const [{ data: msg, error: msgErr }] = await Promise.all([
    supabase
      .from('whatsapp_messages')
      .insert({
        conversation_id: conversationId,
        professional_id: professionalId,
        direction,
        sender_type: resolvedSender,
        body,
        sent_at: now,
        provider_message_id: providerMessageId || null,
      })
      .select('id')
      .single(),
    supabase
      .from('whatsapp_conversations')
      .update({
        last_message_at: now,
        last_message_preview: preview,
        last_sender_type: resolvedSender,
      })
      .eq('id', conversationId),
  ]);

  if (msgErr) {
    logger.warn('Falha ao salvar mensagem de atendimento', {
      conversationId,
      message: msgErr.message,
    });
  }
  return msg;
}

async function closeConversation(conversationId) {
  if (!supabase) return;
  await supabase
    .from('whatsapp_conversations')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', conversationId);
}

async function listOpenConversations(professionalId) {
  if (!supabase) return [];

  const baseSelect =
    'id, patient_phone, patient_name, last_message_at, last_message_preview, opened_at, status';
  const fullSelect =
    'id, patient_phone, patient_name, patient_id, last_message_at, last_message_preview, last_sender_type, opened_at, status';

  const run = async (select) =>
    supabase
      .from('whatsapp_conversations')
      .select(select)
      .eq('professional_id', professionalId)
      .eq('status', 'open')
      .order('last_message_at', { ascending: false });

  let { data, error } = await run(fullSelect);
  if (error) {
    const fallback = await run(baseSelect);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    logger.warn('Falha ao listar conversas', { professionalId, message: error.message });
    return [];
  }
  return data || [];
}

/**
 * Vincula (ou desvincula) um paciente à conversa de atendimento.
 */
async function linkConversationPatient({ conversationId, patientId, patientName }) {
  if (!supabase || !conversationId) return null;

  const fullUpdates = {
    patient_id: patientId || null,
  };
  if (patientName != null) {
    fullUpdates.patient_name = patientName || null;
  }

  const fullSelect =
    'id, patient_phone, patient_name, patient_id, last_message_at, last_message_preview, last_sender_type, opened_at, status';
  const baseSelect =
    'id, patient_phone, patient_name, last_message_at, last_message_preview, opened_at, status';

  let { data, error } = await supabase
    .from('whatsapp_conversations')
    .update(fullUpdates)
    .eq('id', conversationId)
    .select(fullSelect)
    .maybeSingle();

  // Migration ainda não aplicada: grava pelo menos o nome e avisa
  if (error && /patient_id|last_sender_type|schema cache/i.test(error.message || '')) {
    logger.warn('Colunas de contexto ausentes; aplicando só patient_name', {
      conversationId,
      message: error.message,
    });
    const nameOnly = {};
    if (patientName != null) nameOnly.patient_name = patientName || null;
    if (Object.keys(nameOnly).length === 0) {
      const err = new Error(
        'Migration pendente: aplique 20260910180000_clinic_atendimento_context.sql no Supabase para vincular pacientes.'
      );
      err.code = 'MIGRATION_REQUIRED';
      throw err;
    }
    const fallback = await supabase
      .from('whatsapp_conversations')
      .update(nameOnly)
      .eq('id', conversationId)
      .select(baseSelect)
      .maybeSingle();
    if (fallback.error) {
      logger.warn('Falha ao vincular paciente à conversa', {
        conversationId,
        message: fallback.error.message,
      });
      const err = new Error(fallback.error.message);
      err.code = 'LINK_FAILED';
      throw err;
    }
    const err = new Error(
      'Migration pendente: aplique 20260910180000_clinic_atendimento_context.sql no Supabase para vincular pacientes.'
    );
    err.code = 'MIGRATION_REQUIRED';
    throw err;
  }

  if (error) {
    logger.warn('Falha ao vincular paciente à conversa', {
      conversationId,
      message: error.message,
    });
    const err = new Error(error.message);
    err.code = 'LINK_FAILED';
    throw err;
  }
  return data;
}

async function getConversationMessages(conversationId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('id, direction, sender_type, body, sent_at, provider_message_id')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true });

  if (error) {
    logger.warn('Falha ao listar mensagens da conversa', {
      conversationId,
      message: error.message,
    });
    return [];
  }
  return data || [];
}

async function findOpenConversation(professionalId, phone) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('whatsapp_conversations')
    .select('id, professional_id')
    .eq('professional_id', professionalId)
    .eq('patient_phone', phone)
    .eq('status', 'open')
    .maybeSingle();
  return data || null;
}

async function getWhatsappBotName(professionalId) {
  if (!supabase || !professionalId) return DEFAULT_BOT_NAME;
  const { data, error } = await supabase
    .from('professional_ui_settings')
    .select('whatsapp_bot_name')
    .eq('professional_id', professionalId)
    .maybeSingle();
  if (error || !data?.whatsapp_bot_name?.trim()) return DEFAULT_BOT_NAME;
  return String(data.whatsapp_bot_name).trim();
}

/**
 * Garante conversa aberta (reabre a última fechada ou cria nova).
 */
async function ensureOpenConversation({ professionalId, phone, patientName }) {
  if (!supabase) return null;

  const { data: existingOpen } = await supabase
    .from('whatsapp_conversations')
    .select('id, patient_name')
    .eq('professional_id', professionalId)
    .eq('patient_phone', phone)
    .eq('status', 'open')
    .maybeSingle();

  if (existingOpen) {
    if (patientName && !existingOpen.patient_name) {
      await supabase
        .from('whatsapp_conversations')
        .update({ patient_name: patientName })
        .eq('id', existingOpen.id);
    }
    return existingOpen;
  }

  const { data: closedRows } = await supabase
    .from('whatsapp_conversations')
    .select('id, patient_name')
    .eq('professional_id', professionalId)
    .eq('patient_phone', phone)
    .eq('status', 'closed')
    .order('last_message_at', { ascending: false })
    .limit(1);

  const closed = closedRows?.[0];
  if (closed?.id) {
    const updates = {
      status: 'open',
      closed_at: null,
      opened_at: new Date().toISOString(),
    };
    if (patientName && !closed.patient_name) {
      updates.patient_name = patientName;
    }
    await supabase.from('whatsapp_conversations').update(updates).eq('id', closed.id);
    return { id: closed.id };
  }

  return openConversation({ professionalId, phone, patientName });
}

/**
 * Registra mensagem recebida/enviada pelo webhook (bot ou paciente).
 */
async function recordWebhookMessage({
  professionalId,
  phone,
  patientName,
  direction,
  body,
  senderType,
  providerMessageId,
}) {
  const messageBody = String(body || '').trim();
  if (!messageBody) return null;

  const conv = await ensureOpenConversation({ professionalId, phone, patientName });
  if (!conv?.id) return null;

  return saveMessage({
    conversationId: conv.id,
    professionalId,
    direction,
    senderType,
    body: messageBody,
    providerMessageId: providerMessageId || null,
  });
}

/**
 * Abre conversa de handoff e grava a mensagem de transferência como enviada pelo bot.
 */
async function openHandoffConversation({
  professionalId,
  phone,
  patientName,
  botReplyText,
}) {
  try {
    const conv = await ensureOpenConversation({ professionalId, phone, patientName });
    if (!conv?.id) {
      logger.warn('Handoff: conversa não criada (supabase/tabela?)', {
        professionalId,
        phone,
      });
      return null;
    }
    if (botReplyText) {
      await saveMessage({
        conversationId: conv.id,
        professionalId,
        direction: 'outbound',
        senderType: 'bot',
        body: botReplyText,
      });
    }
    logger.info('Handoff: conversa aberta no atendimento', {
      conversationId: conv.id,
      professionalId,
      phone,
    });
    return conv;
  } catch (error) {
    logger.error('Handoff: falha ao abrir conversa de atendimento', {
      professionalId,
      phone,
      message: error?.message || String(error),
    });
    return null;
  }
}

/**
 * Atualiza preview/timestamp de uma conversa já aberta (ou abre se não existir).
 * Usado na sincronização dos chats da Evolution para a central da clínica.
 */
async function upsertConversationPreview({
  professionalId,
  phone,
  patientName,
  preview,
  lastMessageAt,
  lastSenderType,
}) {
  if (!supabase || !professionalId || !phone) return null;

  const conv = await ensureOpenConversation({
    professionalId,
    phone,
    patientName: patientName || null,
  });
  if (!conv?.id) return null;

  const updates = {
    last_message_at: lastMessageAt || new Date().toISOString(),
  };
  if (preview != null) updates.last_message_preview = String(preview).slice(0, 120);
  if (patientName) updates.patient_name = patientName;
  if (lastSenderType) updates.last_sender_type = lastSenderType;

  const { error } = await supabase
    .from('whatsapp_conversations')
    .update(updates)
    .eq('id', conv.id);

  if (error) {
    // Compatível se last_sender_type ainda não existir
    const { error: fallbackErr } = await supabase
      .from('whatsapp_conversations')
      .update({
        last_message_at: updates.last_message_at,
        last_message_preview: updates.last_message_preview,
        ...(patientName ? { patient_name: patientName } : {}),
      })
      .eq('id', conv.id);
    if (fallbackErr) {
      logger.warn('Falha ao atualizar preview da conversa', {
        conversationId: conv.id,
        message: fallbackErr.message,
      });
    }
  }

  return conv;
}

module.exports = {
  openConversation,
  ensureOpenConversation,
  recordWebhookMessage,
  openHandoffConversation,
  saveMessage,
  closeConversation,
  listOpenConversations,
  linkConversationPatient,
  upsertConversationPreview,
  getConversationMessages,
  findOpenConversation,
  getWhatsappBotName,
  DEFAULT_BOT_NAME,
};
