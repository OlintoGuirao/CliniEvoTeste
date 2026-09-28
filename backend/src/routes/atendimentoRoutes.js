const router = require('express').Router();
const {
  listConversations,
  getMessages,
  sendReply,
  closeConv,
  ensureOpenConversation,
  linkPatient,
} = require('../controllers/atendimentoController');
const { syncConversationsFromEvolution } = require('../controllers/atendimentoSyncController');

// Lista conversas abertas de um profissional
router.get('/atendimento/conversations/:professionalId', listConversations);

// Sincroniza chats da Evolution (central clínica)
router.post('/atendimento/conversations/:professionalId/sync', syncConversationsFromEvolution);

// Mensagens de uma conversa
router.get('/atendimento/conversations/:conversationId/messages', getMessages);

// Abre (ou reutiliza) conversa por telefone — recepção da clínica
router.post('/atendimento/conversations/open', ensureOpenConversation);

// Vincula paciente à conversa (central clínica)
router.post('/atendimento/conversations/:conversationId/link-patient', linkPatient);

// Profissional responde via CliniEvo
router.post('/atendimento/conversations/:conversationId/reply', sendReply);

// Encerra conversa (devolve ao bot)
router.post('/atendimento/conversations/:conversationId/close', closeConv);

module.exports = router;
