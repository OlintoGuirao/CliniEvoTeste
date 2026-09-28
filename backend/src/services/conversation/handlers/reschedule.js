'use strict';

const {
  isSairCommand,
  parseIndexPick,
  clearState,
  buildMenuResponse,
  beginDateSelection,
} = require('../core');

async function reschedule_pick({
  phone,
  profissionalId,
  text,
  professionalName,
  existingClient,
  current,
}) {
  if (isSairCommand(text)) {
    clearState(phone);
    return await buildMenuResponse({ client: existingClient, professionalName, profissionalId });
  }

  const pick = parseIndexPick(text);
  if (!pick) {
    return {
      reply: 'Responda com o *número da consulta* que deseja reagendar ou *0* para voltar.',
    };
  }

  const chosen = (current.rescheduleOptions || []).find((o) => o.pickIndex === pick);
  if (!chosen?.id) {
    return { reply: 'Consulta inválida. Escolha um número da lista ou *0* para voltar.' };
  }

  return beginDateSelection({
    phone,
    profissionalId,
    clientName: current.clientName || existingClient?.name || '',
    professionalName,
    procedureName: chosen.procedureName || 'Consulta',
    flowMode: 'reschedule',
    rescheduleAppointmentId: chosen.id,
  });
}

module.exports = {
  reschedule_pick,
};
