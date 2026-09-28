'use strict';

const {
  isSairCommand,
  parseIndexPick,
  clearState,
  upsertState,
  buildMenuResponse,
  beginCancelFlow,
  cancelAppointmentById,
  removeAppointmentById,
  formatDateBR,
  formatTimeBR,
  buildCancelConfirmMessage,
  buildCancelConfirmedMessage,
} = require('../core');

async function cancel_confirm({
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
  if (pick === 2) {
    return beginCancelFlow({ phone, profissionalId, professionalName });
  }
  if (pick !== 1) {
    return {
      reply: 'Responda *1* para confirmar o cancelamento, *2* para voltar ou *0* para o menu.',
    };
  }

  const chosen = current.pendingCancel;
  if (!chosen?.id) {
    clearState(phone);
    return await buildMenuResponse({ client: existingClient, professionalName, profissionalId });
  }

  try {
    const result = await cancelAppointmentById({
      appointmentId: chosen.id,
      professionalId: profissionalId,
      phone,
    });
    if (!result.ok) {
      return { reply: `Não foi possível cancelar: ${result.reason || 'erro desconhecido'}.` };
    }
    removeAppointmentById(chosen.id);
    clearState(phone);
    return {
      reply: buildCancelConfirmedMessage({
        procedureName: chosen.procedureName || 'Consulta',
        appointmentDate: formatDateBR(chosen.appointment_date),
        appointmentTime: formatTimeBR(chosen.start_time),
        professionalName,
      }),
      stateStep: 0,
    };
  } catch (_) {
    return { reply: 'Erro ao cancelar a consulta. Tente novamente ou digite *0*.' };
  }
}

async function cancel_pick({ phone, profissionalId, text, professionalName, existingClient, current }) {
  if (isSairCommand(text)) {
    clearState(phone);
    return await buildMenuResponse({ client: existingClient, professionalName, profissionalId });
  }

  const pick = parseIndexPick(text);
  if (!pick) {
    return {
      reply:
        'Por favor, responda com o *número da consulta* que deseja cancelar ou *0* para voltar.',
    };
  }

  const chosen = (current.cancelOptions || []).find((o) => o.pickIndex === pick);
  if (!chosen?.id) {
    return { reply: 'Consulta inválida. Escolha um número da lista ou *0* para voltar.' };
  }

  upsertState(phone, {
    ...current,
    step: 'cancel_confirm',
    pendingCancel: chosen,
  });

  return {
    reply: buildCancelConfirmMessage({
      procedureName: chosen.procedureName || 'Consulta',
      appointmentDate: formatDateBR(chosen.appointment_date),
      appointmentTime: formatTimeBR(chosen.start_time),
    }),
    stateStep: 'cancel_confirm',
  };
}

module.exports = {
  cancel_confirm,
  cancel_pick,
};
