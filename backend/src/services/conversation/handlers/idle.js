'use strict';

const {
  isSairCommand,
  isGuestServicosCommand,
  isGuestPromocoesCommand,
  isGuestFaqCommand,
  isGuestProfissionalCommand,
  isGuestAgendarCommand,
  isGreeting,
  isMenuCommand,
  clearState,
  buildFarewellResponse,
  beginGuestServicesFlow,
  beginPromotionsFlow,
  beginFaqFlow,
  performHandoff,
  beginRegistrationForBooking,
  handleGreeting,
  beginWelcomeMenu,
  handleRegisteredPatientIdle,
} = require('../core');

async function handleGuestIdle({
  phone,
  profissionalId,
  text,
  professionalName,
  existingClient,
  current,
  normalizedText,
}) {
  if (isSairCommand(text)) {
    clearState(phone);
    return buildFarewellResponse(professionalName);
  }
  if (isGuestServicosCommand(text)) {
    return beginGuestServicesFlow({ phone, profissionalId, professionalName, existingClient });
  }
  if (isGuestPromocoesCommand(text)) {
    return beginPromotionsFlow({ phone, profissionalId, professionalName, existingClient });
  }
  if (isGuestFaqCommand(text)) {
    return beginFaqFlow({ phone, profissionalId, professionalName, existingClient });
  }
  if (isGuestProfissionalCommand(text)) {
    return performHandoff({
      phone,
      profissionalId,
      professionalName,
      patientName: existingClient?.name || current?.guestName || null,
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
  if (isGreeting(text) || isMenuCommand(text) || !normalizedText) {
    return handleGreeting({ phone, profissionalId, professionalName });
  }
  return beginWelcomeMenu({
    phone,
    profissionalId,
    professionalName,
    client: existingClient,
    guestName: current?.guestName || '',
  });
}

module.exports = {
  handleGuestIdle,
  handleRegisteredPatientIdle,
};
