'use strict';

const {
  isSairCommand,
  parseIndexPick,
  clearState,
  upsertState,
  returnGuestOrMainMenu,
  getPromotionDetailsForMenu,
  beginBookingFromPromotion,
  handlePromotionSelection,
} = require('../core');

async function promo_details_offer({
  phone,
  profissionalId,
  text,
  professionalName,
  existingClient,
  current,
}) {
  if (isSairCommand(text)) {
    clearState(phone);
    return returnGuestOrMainMenu({
      phone,
      profissionalId,
      professionalName,
      client: existingClient,
    });
  }

  const pick = parseIndexPick(text);
  if (pick === 1 && current.promotionHasDetails !== false) {
    try {
      const details = await getPromotionDetailsForMenu({
        promotionId: current.activePromotionId,
        professionalId: profissionalId,
      });
      if (!details.promotionId) {
        return { reply: details.reply || 'Promoção indisponível.' };
      }
      upsertState(phone, {
        ...current,
        step: 'promo_details_offer',
        promotionHasDetails: false,
      });
      return {
        reply: details.reply,
        promotionDelivery: details.promotionDelivery || null,
        stateStep: 'promo_details_offer',
      };
    } catch (_) {
      return { reply: 'Não foi possível carregar os detalhes agora. Tente novamente.' };
    }
  }

  if (pick === 2) {
    return beginBookingFromPromotion({
      phone,
      profissionalId,
      professionalName,
      existingClient,
      current,
    });
  }

  return {
    reply:
      current.promotionHasDetails === false
        ? 'Responda *2* para agendar ou *0* para voltar ao menu.'
        : 'Responda *1* para ver detalhes, *2* para agendar ou *0* para voltar.',
  };
}

async function promo_schedule_offer({
  phone,
  profissionalId,
  text,
  professionalName,
  existingClient,
  current,
}) {
  if (isSairCommand(text)) {
    clearState(phone);
    return returnGuestOrMainMenu({
      phone,
      profissionalId,
      professionalName,
      client: existingClient,
    });
  }

  const pick = parseIndexPick(text);
  if (pick !== 1) {
    return {
      reply: 'Responda *1* para agendar com a promoção ou *0* para voltar ao menu.',
    };
  }

  return beginBookingFromPromotion({
    phone,
    profissionalId,
    professionalName,
    existingClient,
    current,
  });
}

async function promotion_pick({
  phone,
  profissionalId,
  text,
  professionalName,
  existingClient,
  current,
}) {
  if (isSairCommand(text)) {
    clearState(phone);
    return returnGuestOrMainMenu({
      phone,
      profissionalId,
      professionalName,
      client: existingClient,
    });
  }

  const pick = parseIndexPick(text);
  if (!pick) {
    return { reply: 'Responda com o *número da promoção* ou *0* para voltar.' };
  }

  return handlePromotionSelection({
    phone,
    profissionalId,
    professionalName,
    existingClient,
    current,
    pick,
  });
}

module.exports = {
  promotion_pick,
  promo_details_offer,
  promo_schedule_offer,
};
