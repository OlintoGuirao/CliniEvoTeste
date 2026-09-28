const { findProfessionalByWhatsappInstance, isClinicProfessionalAccount } = require('../repositories/professionalRepository');
const { isWhatsappSecretaryEnabled, isWhatsappPhoneIgnored } = require('../repositories/professionalUiSettingsRepository');
const {
  recordWebhookMessage,
  findOpenConversation,
  saveMessage,
} = require('../repositories/whatsappConversationRepository');
const { findClientByPhone } = require('../store/clientStore');
const { normalizePhone } = require('../store/conversationStateStore');
const { pushDebugEvent } = require('../store/debugStore');
const { pickText, pickPhone, pickInstanceName, pickInteraction, isIncomingTextMessage, isIncomingAudioMessage } = require('../utils/parseWebhook');
const { normalizeListRowId } = require('../lib/whatsappInteractive');
const { buildAudioReplyMessage } = require('../lib/botMessages');
const { processMessage, resolveWaitAckMessage, tryHandlePresenceResponse } = require('./conversationService');
const { maybeEnhanceReply } = require('./aiReplyService');
const whatsappService = require('./whatsappService');
const { sendPromotionToPatient } = require('./whatsappPromotionService');
const { logger } = require('../utils/logger');

async function resolvePatientName(professionalId, phone) {
  try {
    const client = await findClientByPhone({ phone, professionalId });
    return client?.name?.trim() || null;
  } catch {
    return null;
  }
}

async function persistInboundAtendimento({ professionalId, phone, text }) {
  if (!(await isClinicProfessionalAccount(professionalId))) return;
  const patientName = await resolvePatientName(professionalId, phone);
  await recordWebhookMessage({
    professionalId,
    phone,
    patientName,
    direction: 'inbound',
    body: text,
    senderType: 'patient',
  });
}

async function persistOutboundBotAtendimento({
  professionalId,
  phone,
  body,
  providerMessageId,
}) {
  if (!(await isClinicProfessionalAccount(professionalId))) return;
  await recordWebhookMessage({
    professionalId,
    phone,
    direction: 'outbound',
    body,
    senderType: 'bot',
    providerMessageId: providerMessageId || null,
  });
}

function buildInstanceCandidates(instanceNameRaw) {
  const value = String(instanceNameRaw || '').trim();
  if (!value) return [];

  const set = new Set([value]);
  const lower = value.toLowerCase();
  const digitsOnly = value.replace(/[^\d]/g, '');

  if (lower.startsWith('instance')) {
    const tailDigits = value.slice('instance'.length).replace(/[^\d]/g, '');
    if (tailDigits) set.add(tailDigits);
  } else if (digitsOnly) {
    set.add(`instance${digitsOnly}`);
  }

  if (lower.startsWith('pro-')) {
    set.add(value);
  }

  return Array.from(set);
}

async function sendTextReply({ professional, normalizedPhone, text, status = 'sending' }) {
  if (!text?.trim()) return;
  pushDebugEvent({
    type: 'outgoing',
    phone: normalizedPhone,
    instanceId: professional.whatsappInstanceId,
    professionalId: professional.id,
    text,
    status,
  });
  const sendResult = await whatsappService.sendText(
    professional.whatsappInstanceId,
    normalizedPhone,
    text
  );
  pushDebugEvent({
    type: 'provider',
    phone: normalizedPhone,
    instanceId: professional.whatsappInstanceId,
    professionalId: professional.id,
    providerMessageId: sendResult?.id ?? null,
    sent: sendResult?.sent ?? null,
    providerMessage: sendResult?.message ?? null,
    raw: sendResult,
  });
}

async function handlePresenceOnlyWhenSecretaryPaused({
  professional,
  instanceName,
  phone,
  text,
}) {
  const normalizedPhone = normalizePhone(phone);
  const presenceResponse = await tryHandlePresenceResponse({
    phone: normalizedPhone,
    profissionalId: professional.id,
    professionalName: professional.displayName,
    text,
  });

  if (!presenceResponse?.reply) {
    return null;
  }

  logger.info('Secretária pausada — processando confirmação de presença', {
    instanceName,
    phone: normalizedPhone,
    professionalId: professional.id,
    text,
  });
  pushDebugEvent({
    type: 'incoming',
    phone: normalizedPhone,
    instanceId: instanceName,
    professionalId: professional.id,
    text,
    reason: 'presence_confirmation_while_secretary_paused',
  });

  await sendTextReply({
    professional,
    normalizedPhone,
    text: presenceResponse.reply,
    status: 'presence_confirmation',
  });

  return { ok: true, presenceConfirmation: true };
}

async function handleIncomingAudioMessage(body) {
  const instanceName = pickInstanceName(body);
  const phone = pickPhone(body);

  if (!phone || !instanceName) {
    return { ok: false, reason: 'Payload de áudio sem phone/instanceId' };
  }

  let professional = null;
  const candidates = buildInstanceCandidates(instanceName);
  try {
    for (const candidate of candidates) {
      professional = await findProfessionalByWhatsappInstance(candidate);
      if (professional) break;
    }
  } catch (e) {
    logger.error('Erro ao buscar profissional no banco (áudio)', e?.message || e);
    return { ok: false, reason: 'Falha ao consultar profissional no banco' };
  }

  if (!professional) {
    return { ok: false, reason: 'Profissional não encontrado pela instância', instanceName, candidates };
  }

  let secretaryEnabled = false;
  try {
    secretaryEnabled = await isWhatsappSecretaryEnabled(professional.id);
  } catch (e) {
    logger.warn('Falha ao ler whatsapp_secretary_enabled; mantendo secretária pausada', {
      professionalId: professional.id,
      message: e?.message,
    });
  }

  if (!secretaryEnabled) {
    logger.info('Secretária pausada — áudio ignorado', {
      instanceName,
      phone: normalizePhone(phone),
      professionalId: professional.id,
    });
    return { ok: true, ignored: true, reason: 'whatsapp_secretary_disabled' };
  }

  const normalizedPhone = normalizePhone(phone);

  let phoneIgnored = false;
  try {
    phoneIgnored = await isWhatsappPhoneIgnored(professional.id, normalizedPhone, professional.branchId);
  } catch (e) {
    logger.warn('Falha ao ler whatsapp_ignored_phones; processando áudio', {
      professionalId: professional.id,
      message: e?.message,
    });
  }

  if (phoneIgnored) {
    if (await isClinicProfessionalAccount(professional.id)) {
      try {
        await persistInboundAtendimento({
          professionalId: professional.id,
          phone: normalizedPhone,
          text: '[Áudio recebido]',
        });
      } catch (error) {
        logger.warn('Falha ao registrar áudio no atendimento (número bloqueado)', {
          message: error?.message,
        });
      }
    }
    logger.info('Número bloqueado — bot não responde', {
      instanceName,
      phone: normalizedPhone,
      professionalId: professional.id,
    });
    return { ok: true, ignored: true, reason: 'whatsapp_phone_ignored' };
  }

  const reply = buildAudioReplyMessage();
  logger.info('Áudio recebido — pedindo mensagem digitada', {
    instanceName,
    phone: normalizedPhone,
    professionalId: professional.id,
  });
  pushDebugEvent({
    type: 'incoming',
    phone: normalizedPhone,
    instanceId: instanceName,
    professionalId: professional.id,
    text: '[audio]',
    reason: 'audio_message',
  });

  await sendTextReply({
    professional,
    normalizedPhone,
    text: reply,
    status: 'audio_reply',
  });

  return { ok: true, audioHandled: true };
}

async function handleWhatsAppWebhook(body) {
  if (isIncomingAudioMessage(body)) {
    return handleIncomingAudioMessage(body);
  }

  if (!isIncomingTextMessage(body)) {
    const eventType = String(body?.event || body?.eventType || '').slice(0, 40);
    logger.info('Webhook ignorado', {
      event: eventType,
      fromMe: body?.data?.key?.fromMe ?? body?.fromMe ?? null,
      hasText: Boolean(pickText(body)),
      status: body?.data?.status ?? body?.status ?? null,
    });
    return { ok: true, ignored: true, reason: 'Evento ignorado (status/fromMe/loop/evento sem texto)' };
  }

  const instanceName = pickInstanceName(body);
  const phone = pickPhone(body);
  const rawInteraction = pickInteraction(body);
  const text = normalizeListRowId(rawInteraction) || rawInteraction;

  if (!phone || !text) {
    return { ok: false, reason: 'Payload sem phone/text' };
  }

  if (!instanceName) {
    return { ok: false, reason: 'Payload sem instanceId/instanceName para identificar o profissional' };
  }

  let professional = null;
  const candidates = buildInstanceCandidates(instanceName);
  try {
    for (const candidate of candidates) {
      professional = await findProfessionalByWhatsappInstance(candidate);
      if (professional) break;
    }
  } catch (e) {
    logger.error('Erro ao buscar profissional no banco', e?.message || e);
    return { ok: false, reason: 'Falha ao consultar profissional no banco' };
  }

  if (!professional) {
    return { ok: false, reason: 'Profissional não encontrado pela instância', instanceName, candidates };
  }

  const normalizedPhone = normalizePhone(phone);

  let phoneIgnored = false;
  try {
    phoneIgnored = await isWhatsappPhoneIgnored(professional.id, normalizedPhone, professional.branchId);
  } catch (e) {
    logger.warn('Falha ao ler whatsapp_ignored_phones; processando mensagem', {
      professionalId: professional.id,
      message: e?.message,
    });
  }

  if (phoneIgnored) {
    if (await isClinicProfessionalAccount(professional.id)) {
      try {
        await persistInboundAtendimento({
          professionalId: professional.id,
          phone: normalizedPhone,
          text,
        });
      } catch (error) {
        logger.warn('Falha ao registrar mensagem no atendimento (número bloqueado)', {
          message: error?.message,
        });
      }
    }
    logger.info('Número bloqueado — bot não responde', {
      instanceName,
      phone: normalizedPhone,
      professionalId: professional.id,
    });
    pushDebugEvent({
      type: 'ignored',
      phone: normalizedPhone,
      instanceId: instanceName,
      professionalId: professional.id,
      text,
      reason: 'whatsapp_phone_ignored',
    });
    return { ok: true, ignored: true, reason: 'Número na lista de ignorados' };
  }

  let secretaryEnabled = false;
  try {
    secretaryEnabled = await isWhatsappSecretaryEnabled(professional.id);
  } catch (e) {
    logger.warn('Falha ao ler whatsapp_secretary_enabled; mantendo secretária pausada', {
      professionalId: professional.id,
      message: e?.message,
    });
  }

  if (!secretaryEnabled) {
    const presenceHandled = await handlePresenceOnlyWhenSecretaryPaused({
      professional,
      instanceName,
      phone,
      text,
    });
    if (presenceHandled) {
      return presenceHandled;
    }

    try {
      await persistInboundAtendimento({
        professionalId: professional.id,
        phone: normalizedPhone,
        text,
      });
    } catch (error) {
      logger.warn('Falha ao registrar mensagem no atendimento (secretária pausada)', {
        message: error?.message,
      });
    }

    logger.info('Secretária pausada — mensagem ignorada', {
      instanceName,
      phone: normalizePhone(phone),
      professionalId: professional.id,
    });
    pushDebugEvent({
      type: 'ignored',
      phone: normalizePhone(phone),
      instanceId: instanceName,
      professionalId: professional.id,
      text,
      reason: 'whatsapp_secretary_disabled',
    });
    return { ok: true, ignored: true, reason: 'Secretária virtual desativada pelo profissional' };
  }

  logger.info('Webhook recebido', { instanceName, phone: normalizedPhone, text });
  pushDebugEvent({
    type: 'incoming',
    phone: normalizedPhone,
    instanceId: instanceName,
    professionalId: professional.id,
    text,
  });

  try {
    await persistInboundAtendimento({
      professionalId: professional.id,
      phone: normalizedPhone,
      text,
    });
  } catch (error) {
    logger.warn('Falha ao registrar mensagem no atendimento', { message: error?.message });
  }

  const waitAck = await resolveWaitAckMessage({
    phone: normalizedPhone,
    profissionalId: professional.id,
    text,
  });
  if (waitAck) {
    try {
      await whatsappService.sendText(professional.whatsappInstanceId, normalizedPhone, waitAck);
      pushDebugEvent({
        type: 'outgoing',
        phone: normalizedPhone,
        instanceId: professional.whatsappInstanceId,
        professionalId: professional.id,
        text: waitAck,
        status: 'wait_ack',
      });
    } catch (error) {
      logger.warn('Falha ao enviar mensagem de aguarde', { message: error?.message });
    }
  }

  const response = await processMessage({
    phone: normalizedPhone,
    profissionalId: professional.id,
    text,
    professionalName: professional.displayName,
  });

  if (response?.ignored && !response?.reply && !response?.interactive) {
    logger.info('Mensagem ignorada pelo fluxo', {
      to: normalizedPhone,
      reason: response.reason || 'sem resposta',
    });
    if (response?.stateStep === 'human_handoff') {
      isClinicProfessionalAccount(professional.id)
        .then((isClinic) => {
          if (isClinic) return null;
          return findOpenConversation(professional.id, normalizedPhone);
        })
        .then((conv) => {
          if (conv?.id) {
            return saveMessage({
              conversationId: conv.id,
              professionalId: professional.id,
              direction: 'inbound',
              senderType: 'patient',
              body: text,
            });
          }
        })
        .catch(() => {});
    }
    return { ok: true, ignored: true };
  }

  if (response?.promotionDelivery) {
    try {
      const delivery = response.promotionDelivery;
      const mediaResult = await sendPromotionToPatient({
        instanceName: professional.whatsappInstanceId,
        contentType: delivery.contentType,
        messageText: delivery.messageText,
        mediaUrl: delivery.mediaUrl,
        mediaMimeType: delivery.mediaMimeType,
        phone: normalizedPhone,
      });
      pushDebugEvent({
        type: 'outgoing',
        phone: normalizedPhone,
        instanceId: professional.whatsappInstanceId,
        professionalId: professional.id,
        text: `[promoção:${delivery.contentType}]`,
        status: 'sending',
      });
      pushDebugEvent({
        type: 'provider',
        phone: normalizedPhone,
        instanceId: professional.whatsappInstanceId,
        professionalId: professional.id,
        providerMessageId: mediaResult?.id ?? null,
        sent: mediaResult?.sent ?? null,
        providerMessage: mediaResult?.message ?? null,
        raw: mediaResult,
      });
    } catch (error) {
      logger.error('Falha ao enviar mídia da promoção via menu', error?.message || error);
      await whatsappService.sendText(
        professional.whatsappInstanceId,
        normalizedPhone,
        'Não foi possível enviar a promoção agora. Tente novamente em instantes.'
      );
    }
  }

  if (response?.reply || response?.interactive) {
    let finalReply = null;
    if (response.reply) {
      finalReply = await maybeEnhanceReply({
        baseReply: response.reply,
        incomingText: text,
        professionalName: professional.displayName,
        stateStep: response?.stateStep,
      });
    }

    logger.info('Enviando resposta', {
      to: normalizedPhone,
      instanceId: professional.whatsappInstanceId,
      mode: response?.interactive?.type || 'text',
      preview: finalReply ? finalReply.slice(0, 80) : '(lista interativa)',
    });
    pushDebugEvent({
      type: 'outgoing',
      phone: normalizedPhone,
      instanceId: professional.whatsappInstanceId,
      professionalId: professional.id,
      text: finalReply || `[list:${response?.interactive?.payload?.buttonText || 'opções'}]`,
      status: 'sending',
    });
    const sendResult = await whatsappService.sendBotReply({
      instanceName: professional.whatsappInstanceId,
      number: normalizedPhone,
      reply: finalReply,
      interactive: response.interactive,
    });
    try {
      const outboundBody =
        finalReply ||
        `[${response?.interactive?.payload?.buttonText || response?.interactive?.type || 'Menu'}]`;
      await persistOutboundBotAtendimento({
        professionalId: professional.id,
        phone: normalizedPhone,
        body: outboundBody,
        providerMessageId: sendResult?.id,
      });
    } catch (error) {
      logger.warn('Falha ao registrar resposta do bot no atendimento', { message: error?.message });
    }
    logger.info('Resposta enviada (provider)', {
      to: normalizedPhone,
      providerMessageId: sendResult?.id,
      sent: sendResult?.sent,
      providerMessage: sendResult?.message,
    });
    pushDebugEvent({
      type: 'provider',
      phone: normalizedPhone,
      instanceId: professional.whatsappInstanceId,
      professionalId: professional.id,
      providerMessageId: sendResult?.id ?? null,
      sent: sendResult?.sent ?? null,
      providerMessage: sendResult?.message ?? null,
      raw: sendResult,
    });
  }

  return { ok: true };
}

module.exports = { handleWhatsAppWebhook };
