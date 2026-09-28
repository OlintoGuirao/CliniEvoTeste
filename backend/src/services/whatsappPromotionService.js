const { logger } = require('../utils/logger');
const { sendText, sendMedia } = require('./whatsappService');
const { reserveOutboundSend } = require('./whatsappWarmupService');
const { findProfessionalById } = require('../repositories/professionalRepository');
const { listPatientsWithPhoneForProfessional } = require('../repositories/patientsRepository');
const {
  insertPromotion,
  updatePromotionStats,
  getPromotionById,
  hasPromotionBooking,
  recordPromotionRecipient,
  tryReservePromotionBooking,
  promotionHasSlots,
  derivePromotionStatus,
} = require('../repositories/whatsappPromotionRepository');

const VALID_CONTENT_TYPES = new Set(['text', 'text_image', 'image', 'video']);
const SEND_DELAY_MS = Number(process.env.WHATSAPP_PROMOTION_DELAY_MS) || 1500;
const DEFAULT_SOLD_OUT_MESSAGE = 'Poxa, acabou a promoção 😔';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeContentType(value) {
  const t = String(value || '').trim();
  return VALID_CONTENT_TYPES.has(t) ? t : null;
}

function normalizeMaxParticipants(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function promotionTitleFromPayload(payload) {
  const title = String(payload?.title || '').trim();
  if (title) return title.slice(0, 80);
  const messageText = String(payload?.messageText || '').trim();
  if (messageText) return messageText.slice(0, 80);
  return 'Promoção';
}

function promotionDisplayTitle(promotion) {
  return (
    String(promotion?.title || promotion?.message_text || 'Promoção').trim().slice(0, 80) || 'Promoção'
  );
}

function validatePromotionPayload(payload) {
  const contentType = normalizeContentType(payload?.contentType);
  if (!contentType) {
    throw new Error('Tipo de conteúdo inválido. Use: text, text_image, image ou video.');
  }

  const messageText = String(payload?.messageText || '').trim();
  const mediaUrl = String(payload?.mediaUrl || '').trim();
  const mediaMimeType = String(payload?.mediaMimeType || '').trim() || null;

  if (contentType === 'text' && !messageText) {
    throw new Error('Informe o texto da promoção.');
  }
  if (contentType === 'text_image') {
    if (!messageText) throw new Error('Informe o texto da promoção.');
    if (!mediaUrl) throw new Error('Envie uma imagem para a promoção.');
  }
  if (contentType === 'image' && !mediaUrl) {
    throw new Error('Envie uma imagem para a promoção.');
  }
  if (contentType === 'video' && !mediaUrl) {
    throw new Error('Envie um vídeo para a promoção.');
  }

  return {
    contentType,
    messageText,
    detailsText: String(payload?.detailsText || '').trim(),
    mediaUrl,
    mediaMimeType,
    title: promotionTitleFromPayload(payload),
    maxParticipants: normalizeMaxParticipants(payload?.maxParticipants),
    menuEnabled: payload?.menuEnabled !== false,
    soldOutMessage: String(payload?.soldOutMessage || '').trim() || DEFAULT_SOLD_OUT_MESSAGE,
    procedureId: String(payload?.procedureId || '').trim() || null,
  };
}

async function sendPromotionToPatient({ instanceName, contentType, messageText, mediaUrl, mediaMimeType, phone }) {
  if (contentType === 'text') {
    return sendText(instanceName, phone, messageText);
  }

  if (contentType === 'text_image' || contentType === 'image') {
    return sendMedia(instanceName, phone, {
      mediatype: 'image',
      media: mediaUrl,
      mimetype: mediaMimeType || 'image/jpeg',
      caption: contentType === 'text_image' ? messageText : messageText || undefined,
    });
  }

  return sendMedia(instanceName, phone, {
    mediatype: 'video',
    media: mediaUrl,
    mimetype: mediaMimeType || 'video/mp4',
    caption: messageText || undefined,
  });
}

function buildPromotionSchedulePrompt(promoTitle) {
  return (
    `\n\nPara garantir *${promoTitle}*, agende sua consulta agora:\n` +
    `*1* — Agendar consulta\n` +
    `*0* — Voltar ao menu`
  );
}

function buildPromotionDetailsOfferPrompt(promoTitle, { hasDetails = true } = {}) {
  const detailsLine = hasDetails ? `*1* — Ver detalhes completos\n` : '';
  return (
    `Promoção: *${promoTitle}*\n\n` +
    `${detailsLine}` +
    `*2* — Agendar com esta promoção\n` +
    `*0* — Voltar ao menu`
  );
}

function promotionTeaserText(promotion) {
  const title = promotionDisplayTitle(promotion);
  const teaser = String(promotion.message_text || '').trim();
  if (teaser && teaser.length <= 160) return teaser;
  if (teaser) return `${teaser.slice(0, 157)}...`;
  return `Confira a promoção *${title}* disponível na clínica.`;
}

function promotionHasExtraDetails(promotion) {
  const details = String(promotion?.details_text || '').trim();
  const message = String(promotion?.message_text || '').trim();
  const media = String(promotion?.media_url || '').trim();
  return Boolean(details || (message && message.length > 160) || media);
}

async function viewPromotionViaMenu({ promotionId, professionalId, phone }) {
  const promotion = await getPromotionById(promotionId, professionalId);
  if (!promotion || !promotion.menu_enabled) {
    return { reply: 'Esta promoção não está mais disponível.' };
  }

  if (!promotionHasSlots(promotion)) {
    return {
      reply: String(promotion.sold_out_message || DEFAULT_SOLD_OUT_MESSAGE).trim(),
    };
  }

  if (await hasPromotionBooking(promotionId, phone)) {
    return {
      reply: 'Você já garantiu esta promoção com seu agendamento! 😊',
    };
  }

  const promoTitle = promotionDisplayTitle(promotion);
  const hasDetails = promotionHasExtraDetails(promotion);
  const teaser = promotionTeaserText(promotion);
  const offerPrompt = buildPromotionDetailsOfferPrompt(promoTitle, { hasDetails });

  return {
    reply: `${teaser}\n\n${offerPrompt}`,
    promotionId: promotion.id,
    promotionTitle: promoTitle,
    procedureId: promotion.procedure_id || null,
    hasDetails,
  };
}

async function getPromotionDetailsForMenu({ promotionId, professionalId }) {
  const promotion = await getPromotionById(promotionId, professionalId);
  if (!promotion) return { reply: 'Esta promoção não está mais disponível.' };

  const promoTitle = promotionDisplayTitle(promotion);
  const details =
    String(promotion.details_text || '').trim() ||
    String(promotion.message_text || '').trim() ||
    'Sem detalhes adicionais para esta promoção.';

  const contentType = promotion.content_type;
  const messageText = String(promotion.message_text || '').trim();
  const mediaUrl = String(promotion.media_url || '').trim();
  const mediaMimeType = promotion.media_mime_type || null;

  const reply =
    `*${promoTitle}*\n\n` +
    `${details}\n\n` +
    buildPromotionDetailsOfferPrompt(promoTitle, { hasDetails: false }).replace(
      '*1* — Ver detalhes completos\n',
      ''
    );

  if (contentType === 'text' || !mediaUrl) {
    return { reply, promotionId: promotion.id, promotionTitle: promoTitle };
  }

  return {
    reply,
    promotionDelivery: {
      contentType,
      messageText,
      mediaUrl,
      mediaMimeType,
    },
    promotionId: promotion.id,
    promotionTitle: promoTitle,
  };
}

async function reservePromotionForBooking({
  promotionId,
  professionalId,
  phone,
  appointmentId,
  patientId,
}) {
  const promotion = await getPromotionById(promotionId, professionalId);
  if (!promotion) {
    return { ok: false, reason: 'not_found' };
  }

  const result = await tryReservePromotionBooking({
    promotionId,
    professionalId,
    phone,
    appointmentId,
    patientId,
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      soldOutMessage: String(promotion.sold_out_message || DEFAULT_SOLD_OUT_MESSAGE).trim(),
    };
  }

  return { ok: true, promotion: result.promotion };
}

async function broadcastWhatsappPromotion(professionalId, payload) {
  const professional = await findProfessionalById(professionalId);
  if (!professional) throw new Error('Profissional não encontrado');
  if (!professional.whatsappInstanceId) {
    throw new Error('WhatsApp não conectado. Vincule em Secretária WhatsApp e escaneie o QR Code.');
  }

  const {
    contentType,
    messageText,
    detailsText,
    mediaUrl,
    mediaMimeType,
    title,
    maxParticipants,
    menuEnabled,
    soldOutMessage,
    procedureId,
  } = validatePromotionPayload(payload);

  const patients = await listPatientsWithPhoneForProfessional(professionalId);
  if (!patients.length) {
    throw new Error(
      'Nenhum paciente cadastrado na aba Pacientes com telefone para receber a promoção.'
    );
  }

  const promotionRow = await insertPromotion({
    professional_id: professionalId,
    title,
    content_type: contentType,
    message_text: messageText || null,
    details_text: detailsText || null,
    media_url: mediaUrl || null,
    media_storage_path: payload?.mediaStoragePath || null,
    media_mime_type: mediaMimeType,
    max_participants: maxParticipants,
    claimed_count: 0,
    menu_enabled: menuEnabled,
    sold_out_message: soldOutMessage,
    procedure_id: procedureId,
    status: 'sending',
    total_recipients: patients.length,
    sent_count: 0,
    failed_count: 0,
  });

  const summary = {
    promotionId: promotionRow?.id || null,
    total: patients.length,
    sent: 0,
    failed: 0,
    sentPatients: [],
    failedPatients: [],
  };

  for (let i = 0; i < patients.length; i++) {
    const patient = patients[i];

    try {
      // Trava de maturidade: só conta/limita disparos de promoção (não secretária/lembretes/cobrança).
      await reserveOutboundSend(professionalId);

      const result = await sendPromotionToPatient({
        instanceName: professional.whatsappInstanceId,
        contentType,
        messageText,
        mediaUrl,
        mediaMimeType,
        phone: patient.phone,
      });

      await recordPromotionRecipient({
        promotionId: promotionRow.id,
        professionalId,
        patientId: patient.id,
        phone: patient.phone,
        source: 'broadcast',
      });

      summary.sent += 1;
      summary.sentPatients.push({
        patientName: patient.fullName,
        messageId: result?.id || null,
      });
    } catch (error) {
      const warmupBlocked = error?.code === 'WHATSAPP_WARMUP_LIMIT';
      summary.failed += 1;
      summary.failedPatients.push({
        patientName: patient.fullName,
        error: error?.message || String(error),
      });
      logger.warn('Falha ao enviar promoção WhatsApp', {
        professionalId,
        patientId: patient.id,
        message: error?.message || String(error),
        warmupBlocked,
      });

      if (warmupBlocked) {
        const remaining = patients.slice(i + 1);
        for (const skipped of remaining) {
          summary.failed += 1;
          summary.failedPatients.push({
            patientName: skipped.fullName,
            error: error?.message || String(error),
          });
        }
        break;
      }
    }

    if (i < patients.length - 1) {
      await sleep(SEND_DELAY_MS);
    }
  }

  if (promotionRow?.id) {
    const status =
      summary.failed === summary.total && summary.sent === 0
        ? 'failed'
        : derivePromotionStatus(
            { max_participants: maxParticipants, claimed_count: 0 },
            menuEnabled
          );

    await updatePromotionStats(promotionRow.id, {
      status,
      totalRecipients: summary.total,
      sentCount: summary.sent,
      failedCount: summary.failed,
      claimedCount: 0,
    });
  }

  logger.info('Promoção WhatsApp concluída', {
    professionalId,
    promotionId: promotionRow?.id,
    sent: summary.sent,
    failed: summary.failed,
  });

  return summary;
}

module.exports = {
  broadcastWhatsappPromotion,
  viewPromotionViaMenu,
  getPromotionDetailsForMenu,
  reservePromotionForBooking,
  sendPromotionToPatient,
  validatePromotionPayload,
  buildPromotionSchedulePrompt,
  buildPromotionDetailsOfferPrompt,
};
