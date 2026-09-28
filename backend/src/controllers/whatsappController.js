const { logger } = require('../utils/logger');
const { handleWhatsAppWebhook } = require('../services/whatsappWebhookService');
const {
  findProfessionalById,
  findProfessionalByWhatsappInstance,
  setWhatsappInstanceByProfessionalId,
} = require('../repositories/professionalRepository');
const {
  getInstanceQr,
  getInstancePairingCode,
  getConnectionStatus,
  resolveInstanceNameForProfessional,
  disconnectInstance,
  inferConnectedFromEvolutionPayload,
} = require('../services/whatsappService');

const INSTANCE_ID_REGEX = /^[a-zA-Z0-9_-]{3,64}$/;

async function whatsappWebhook(req, res) {
  try {
    logger.info('POST /webhook/whatsapp', {
      hasBody: !!req.body,
      keys: req.body ? Object.keys(req.body).slice(0, 12) : [],
    });
    const result = await handleWhatsAppWebhook(req.body);
    return res.json(result);
  } catch (e) {
    logger.error('Erro webhook whatsapp', e?.message || e);
    return res.status(500).json({ error: 'Erro interno no webhook' });
  }
}

async function getEvolutionStatusByProfessional(req, res) {
  try {
    const professionalId = req.params.professionalId;
    if (!professionalId) {
      return res.status(400).json({ error: 'professionalId é obrigatório' });
    }

    const professional = await findProfessionalById(professionalId);
    if (!professional) {
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }

    const instanceName = await resolveInstanceNameForProfessional(professional);
    const result = await getConnectionStatus(instanceName);
    const connected = result.connected || inferConnectedFromEvolutionPayload(result.raw);

    return res.json({
      ok: true,
      professionalId: professional.id,
      professionalName: professional.name,
      instanceId: instanceName,
      state: result.state || null,
      qr: null,
      connected,
    });
  } catch (e) {
    logger.error('Erro ao consultar status da Evolution', e?.message || e);
    return res.status(500).json({
      error: e?.message || 'Erro interno ao consultar status da Evolution API',
    });
  }
}

async function getEvolutionQrByProfessional(req, res) {
  try {
    const professionalId = req.params.professionalId;
    if (!professionalId) {
      return res.status(400).json({ error: 'professionalId é obrigatório' });
    }

    const professional = await findProfessionalById(professionalId);
    if (!professional) {
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }

    const instanceName = await resolveInstanceNameForProfessional(professional);
    const forceRestart =
      String(req.query.forceRestart || req.query.force || '').trim() === '1' ||
      String(req.query.forceRestart || req.query.force || '').toLowerCase() === 'true';
    const result = await getInstanceQr(instanceName, { forceRestart });
    const connected = result.connected || inferConnectedFromEvolutionPayload(result.raw);

    return res.json({
      ok: true,
      professionalId: professional.id,
      professionalName: professional.name,
      instanceId: instanceName,
      state: result.state || null,
      qr: connected ? null : result.qr,
      connected,
    });
  } catch (e) {
    logger.error('Erro ao buscar QR da Evolution', e?.message || e);
    return res.status(500).json({
      error: e?.message || 'Erro interno ao buscar QR da Evolution API',
    });
  }
}

async function postEvolutionPairByProfessional(req, res) {
  try {
    const professionalId = req.params.professionalId;
    if (!professionalId) {
      return res.status(400).json({ error: 'professionalId é obrigatório' });
    }

    const number = String(req.body?.number || req.query.number || '').trim();
    if (!number) {
      return res.status(400).json({ error: 'Informe o número do WhatsApp (com DDD)' });
    }

    const professional = await findProfessionalById(professionalId);
    if (!professional) {
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }

    const instanceName = await resolveInstanceNameForProfessional(professional);
    const result = await getInstancePairingCode(instanceName, number);
    const connected = result.connected || inferConnectedFromEvolutionPayload(result.raw);

    if (!connected && !result.pairingCode) {
      return res.status(422).json({
        ok: false,
        error:
          'Não foi possível gerar o código agora. Confira o número (com DDD), aguarde alguns segundos e tente de novo — ou use o QR Code.',
        professionalId: professional.id,
        instanceId: instanceName,
        connected: false,
      });
    }

    return res.json({
      ok: true,
      professionalId: professional.id,
      professionalName: professional.name,
      instanceId: instanceName,
      state: result.state || null,
      phone: result.phone,
      pairingCode: connected ? null : result.pairingCode,
      qr: null,
      connected,
      message: connected
        ? 'WhatsApp já está conectado.'
        : 'Digite este código no celular: Aparelhos conectados → Vincular com número de telefone.',
    });
  } catch (e) {
    logger.error('Erro ao gerar código de pareamento Evolution', e?.message || e);
    return res.status(500).json({
      error: e?.message || 'Erro interno ao gerar código de pareamento',
    });
  }
}

async function disconnectEvolutionByProfessional(req, res) {
  try {
    const professionalId = req.params.professionalId;
    if (!professionalId) {
      return res.status(400).json({ error: 'professionalId é obrigatório' });
    }

    const professional = await findProfessionalById(professionalId);
    if (!professional) {
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }
    if (!professional.whatsappInstanceId) {
      return res.status(400).json({ error: 'Profissional sem instância WhatsApp configurada' });
    }

    const instanceId = professional.whatsappInstanceId;
    const disconnected = await disconnectInstance(instanceId);

    return res.json({
      ok: disconnected.ok,
      professionalId: professional.id,
      instanceId,
      profileWhatsappInstanceId: instanceId,
      qr: null,
      connected: false,
      message: disconnected.ok
        ? 'WhatsApp desconectado. Use Conectar para vincular novamente na mesma instância.'
        : 'Não foi possível desconectar na Evolution. Tente novamente em instantes.',
    });
  } catch (e) {
    logger.error('Erro ao desconectar instância Evolution', e?.message || e);
    return res.status(500).json({ error: 'Erro interno ao desconectar WhatsApp' });
  }
}

async function setEvolutionInstanceByProfessional(req, res) {
  try {
    const professionalId = req.params.professionalId;
    const instanceId = String(req.body?.instanceId || '').trim();

    if (!professionalId) {
      return res.status(400).json({ error: 'professionalId é obrigatório' });
    }
    if (!instanceId) {
      return res.status(400).json({ error: 'instanceId é obrigatório' });
    }
    if (!INSTANCE_ID_REGEX.test(instanceId)) {
      return res.status(400).json({ error: 'instanceId inválido' });
    }

    const updated = await setWhatsappInstanceByProfessionalId(professionalId, instanceId);
    if (!updated) {
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }

    return res.json({
      ok: true,
      professionalId: updated.id,
      instanceId: updated.whatsappInstanceId,
      message: 'Instância Evolution vinculada ao perfil.',
    });
  } catch (e) {
    logger.error('Erro ao vincular instância Evolution no perfil', e?.message || e);
    return res.status(500).json({ error: 'Erro interno ao vincular instância' });
  }
}

// Aliases legados (UltraMsg) — mesmos handlers Evolution
const getUltraMsgQrByProfessional = getEvolutionQrByProfessional;
const disconnectUltraMsgByProfessional = disconnectEvolutionByProfessional;
const setUltraMsgInstanceByProfessional = setEvolutionInstanceByProfessional;

module.exports = {
  whatsappWebhook,
  getEvolutionStatusByProfessional,
  getEvolutionQrByProfessional,
  postEvolutionPairByProfessional,
  disconnectEvolutionByProfessional,
  setEvolutionInstanceByProfessional,
  getUltraMsgQrByProfessional,
  disconnectUltraMsgByProfessional,
  setUltraMsgInstanceByProfessional,
};
