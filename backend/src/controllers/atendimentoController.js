const { logger } = require('../utils/logger');
const {
  listOpenConversations,
  getConversationMessages,
  saveMessage,
  closeConversation,
  ensureOpenConversation: openOrReopenConversation,
  linkConversationPatient,
} = require('../repositories/whatsappConversationRepository');
const { findProfessionalById } = require('../repositories/professionalRepository');
const { sendText } = require('../services/whatsappService');
const { clearState } = require('../store/conversationStateStore');

async function listConversations(req, res) {
  const { professionalId } = req.params;
  if (!professionalId) return res.status(400).json({ error: 'professionalId é obrigatório' });
  try {
    const data = await listOpenConversations(professionalId);
    // Oculta conversas fantasma geradas por @lid / números inválidos
    const conversations = (data || []).filter((c) => {
      const phone = String(c?.patient_phone || '');
      if (phone.includes('@lid')) return false;
      if (/^\d+$/.test(phone) && phone.length > 13) return false;
      return true;
    });
    return res.json({ ok: true, conversations });
  } catch (e) {
    logger.error('Erro ao listar conversas', e?.message);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

async function getMessages(req, res) {
  const { conversationId } = req.params;
  if (!conversationId) return res.status(400).json({ error: 'conversationId é obrigatório' });
  try {
    const data = await getConversationMessages(conversationId);
    return res.json({ ok: true, messages: data });
  } catch (e) {
    logger.error('Erro ao listar mensagens', e?.message);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

async function sendReply(req, res) {
  const { conversationId } = req.params;
  const { professionalId, body, phone } = req.body;

  if (!conversationId || !professionalId || !body || !phone) {
    return res.status(400).json({ error: 'conversationId, professionalId, body e phone são obrigatórios' });
  }

  try {
    const professional = await findProfessionalById(professionalId);
    if (!professional?.whatsappInstanceId) {
      return res.status(422).json({ error: 'WhatsApp não conectado' });
    }

    const sendResult = await sendText(professional.whatsappInstanceId, phone, body);

    await saveMessage({
      conversationId,
      professionalId,
      direction: 'outbound',
      senderType: 'professional',
      body,
      providerMessageId: sendResult?.id || null,
    });

    return res.json({ ok: true, providerMessageId: sendResult?.id || null });
  } catch (e) {
    logger.error('Erro ao enviar resposta de atendimento', e?.message);
    return res.status(500).json({ error: e?.message || 'Erro interno' });
  }
}

async function closeConv(req, res) {
  const { conversationId } = req.params;
  const { phone } = req.body;

  if (!conversationId) return res.status(400).json({ error: 'conversationId é obrigatório' });

  try {
    await closeConversation(conversationId);
    // Limpa o estado do bot para que o paciente possa usar a secretária novamente
    if (phone) clearState(phone);
    return res.json({ ok: true });
  } catch (e) {
    logger.error('Erro ao encerrar conversa', e?.message);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

async function ensureOpenConversation(req, res) {
  const { professionalId, phone, patientName } = req.body || {};
  if (!professionalId || !phone) {
    return res.status(400).json({ error: 'professionalId e phone são obrigatórios' });
  }
  try {
    const conv = await openOrReopenConversation({
      professionalId,
      phone,
      patientName: patientName || null,
    });
    if (!conv?.id) {
      return res.status(500).json({ error: 'Não foi possível abrir a conversa' });
    }
    return res.json({ ok: true, conversation: conv });
  } catch (e) {
    logger.error('Erro ao abrir conversa de atendimento', e?.message);
    return res.status(500).json({ error: e?.message || 'Erro interno' });
  }
}

async function linkPatient(req, res) {
  const { conversationId } = req.params;
  const { patientId, patientName } = req.body || {};
  if (!conversationId) {
    return res.status(400).json({ error: 'conversationId é obrigatório' });
  }
  try {
    const conversation = await linkConversationPatient({
      conversationId,
      patientId: patientId || null,
      patientName: patientName ?? null,
    });
    if (!conversation) {
      return res.status(500).json({ error: 'Não foi possível vincular o paciente' });
    }
    return res.json({ ok: true, conversation });
  } catch (e) {
    logger.error('Erro ao vincular paciente na conversa', e?.message);
    const status = e?.code === 'MIGRATION_REQUIRED' ? 422 : 500;
    return res.status(status).json({ error: e?.message || 'Erro interno' });
  }
}

module.exports = {
  listConversations,
  getMessages,
  sendReply,
  closeConv,
  ensureOpenConversation,
  linkPatient,
};
