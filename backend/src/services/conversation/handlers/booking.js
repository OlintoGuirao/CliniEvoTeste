'use strict';

const {
  isSairCommand,
  parseIndexPick,
  clearState,
  upsertState,
  buildMenuResponse,
  beginTimeSelectionFromState,
  finalizeBooking,
  beginDateSelection,
  beginConfirmFromState,
  returnGuestOrMainMenu,
} = require('../core');

async function confirm_booking({
  phone,
  profissionalId,
  text,
  professionalName,
  existingClient,
  current,
  normalizedText,
}) {
  if (isSairCommand(text) || normalizedText === '0') {
    clearState(phone);
    return await buildMenuResponse({ client: existingClient, professionalName, profissionalId });
  }

  const pick = parseIndexPick(text);
  if (pick === 2) {
    return beginTimeSelectionFromState({ phone, current, professionalName });
  }
  if (pick !== 1) {
    return {
      reply: 'Responda *1* para confirmar, *2* para alterar horário ou *0* para cancelar.',
    };
  }

  return finalizeBooking({
    phone,
    profissionalId,
    professionalName,
    existingClient,
    current,
  });
}

async function time_pick({ phone, profissionalId, text, professionalName, existingClient, current }) {
  if (isSairCommand(text)) {
    return beginDateSelection({
      phone,
      profissionalId,
      clientName: current.clientName || existingClient?.name || '',
      professionalName,
      procedureName: current.selectedProcedure,
      flowMode: current.flowMode || 'book',
      rescheduleAppointmentId: current.rescheduleAppointmentId,
    });
  }

  const pick = parseIndexPick(text, (current.timeOptions || []).length);
  if (!pick) {
    return { reply: 'Responda com o *número do horário* da lista ou *0* para escolher outra data.' };
  }

  const chosen = (current.timeOptions || []).find((t) => t.pickIndex === pick);
  if (!chosen) {
    return { reply: 'Horário inválido. Escolha um número da lista ou *0* para voltar.' };
  }

  const nextState = {
    ...current,
    selectedDate: chosen.appointmentDate,
    selectedTime: chosen.appointmentTime,
  };
  upsertState(phone, nextState);
  return beginConfirmFromState({ phone, current: nextState });
}

async function date_pick({ phone, profissionalId, text, professionalName, existingClient, current }) {
  if (isSairCommand(text)) {
    clearState(phone);
    return await buildMenuResponse({ client: existingClient, professionalName, profissionalId });
  }

  const pick = parseIndexPick(text, (current.dateOptions || []).length);
  if (!pick) {
    return { reply: 'Responda com o *número da data* da lista ou *0* para voltar.' };
  }

  const chosen = (current.dateOptions || []).find((d) => d.pickIndex === pick);
  if (!chosen?.times?.length) {
    return { reply: 'Data inválida. Escolha um número da lista ou *0* para voltar.' };
  }

  const nextState = {
    ...current,
    selectedDate: chosen.appointmentDate,
    timeOptions: chosen.times,
  };
  upsertState(phone, nextState);
  return beginTimeSelectionFromState({ phone, current: nextState, professionalName });
}

async function procedure_pick({
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

  const pick = parseIndexPick(text, (current.procedureOptions || []).length);
  if (!pick) {
    return { reply: 'Responda com o *número do procedimento* ou *0* para voltar.' };
  }

  const chosen = (current.procedureOptions || []).find((p) => p.pickIndex === pick);
  if (!chosen) {
    return { reply: 'Procedimento inválido. Escolha um número da lista ou *0* para voltar.' };
  }

  return beginDateSelection({
    phone,
    profissionalId,
    clientName: current.clientName || existingClient?.name || '',
    professionalName,
    procedureName: chosen.name,
    flowMode: 'book',
    activePromotionId: current.activePromotionId || null,
    activePromotionTitle: current.activePromotionTitle || null,
  });
}

module.exports = {
  confirm_booking,
  time_pick,
  date_pick,
  procedure_pick,
};
