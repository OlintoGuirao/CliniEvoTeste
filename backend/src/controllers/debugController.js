const { listAllDebugEvents, listDebugEventsByPhone } = require('../store/debugStore');
const { handleWhatsAppWebhook } = require('../services/whatsappWebhookService');

async function getDebugEvents(req, res) {
  const limit = Number(req.query.limit || 100);
  return res.json({
    items: listAllDebugEvents(limit),
  });
}

async function getDebugEventsByPhone(req, res) {
  const { phone } = req.params;
  return res.json({
    phone,
    items: listDebugEventsByPhone(phone),
  });
}

async function simulateIncoming(req, res) {
  const { instanceId, from, text } = req.body || {};
  if (!instanceId || !from || !text) {
    return res.status(400).json({
      error: 'Campos obrigatórios: instanceId, from, text',
    });
  }

  try {
    const result = await handleWhatsAppWebhook({
      instanceId,
      from,
      text,
    });
    return res.json({ ok: true, simulated: true, result });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      simulated: true,
      error: e?.message || 'Erro ao simular incoming',
    });
  }
}

module.exports = {
  getDebugEvents,
  getDebugEventsByPhone,
  simulateIncoming,
};
