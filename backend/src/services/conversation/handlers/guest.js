'use strict';

const {
  isSairCommand,
  isMenuCommand,
  isGuestAgendarCommand,
  parseIndexPick,
  clearState,
  buildFarewellResponse,
  beginWelcomeMenu,
  beginRegistrationForBooking,
  beginGuestBookingForProcedure,
} = require('../core');

async function guest_services({
  phone,
  profissionalId,
  text,
  professionalName,
  existingClient,
  current,
}) {
  if (isSairCommand(text) || isMenuCommand(text)) {
    return beginWelcomeMenu({
      phone,
      profissionalId,
      professionalName,
      client: existingClient,
      guestName: current?.guestName || '',
    });
  }
  if (isGuestAgendarCommand(text)) {
    return beginRegistrationForBooking({
      phone,
      profissionalId,
      professionalName,
      existingClient,
      current,
    });
  }

  const pick = parseIndexPick(text, (current.procedureOptions || []).length);
  if (!pick) {
    return {
      reply:
        'Responda com o *número do serviço* para agendar, digite *agendar* sem escolher, ou *0* para voltar ao menu.',
      stateStep: 'guest_services',
    };
  }

  const chosen = (current.procedureOptions || []).find((p) => p.pickIndex === pick);
  if (!chosen) {
    return { reply: 'Serviço inválido. Escolha um número da lista ou *0* para voltar.' };
  }

  return beginGuestBookingForProcedure({
    phone,
    profissionalId,
    professionalName,
    existingClient,
    chosen,
    current,
  });
}

async function welcome_ask_name({
  phone,
  profissionalId,
  text,
  professionalName,
  existingClient,
  normalizedText,
}) {
  if (isSairCommand(text)) {
    clearState(phone);
    return buildFarewellResponse(professionalName);
  }
  if (normalizedText.replace(/\s+/g, ' ').trim().length < 2) {
    return {
      reply: 'Nome inválido. Por favor, me diga o seu *nome completo*.',
      stateStep: 'welcome_ask_name',
    };
  }
  return beginWelcomeMenu({
    phone,
    profissionalId,
    professionalName,
    client: existingClient,
    guestName: normalizedText,
  });
}

module.exports = {
  guest_services,
  welcome_ask_name,
};
