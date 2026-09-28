'use strict';

const {
  isSairCommand,
  parseIndexPick,
  clearState,
  buildFarewellResponse,
  markBirthDateConfirmed,
  buildMenuResponse,
  beginBirthDateUpdateFlow,
  parseBirthDateInput,
  updateClientBirthDate,
  firstNameFrom,
  buildBirthDateUpdatedMessage,
  beginWelcomeMenu,
  buildRegistrationRefusalMessage,
  createClient,
  beginDateSelection,
  beginProcedureSelection,
  beginRegistrationBirthDate,
} = require('../core');

async function confirm_birthdate({
  phone,
  profissionalId,
  text,
  professionalName,
  existingClient,
  current,
}) {
  if (isSairCommand(text)) {
    clearState(phone);
    return buildFarewellResponse(professionalName);
  }

  const pick = parseIndexPick(text);
  if (pick === 1) {
    let client = existingClient;
    if (current.clientId) {
      client =
        (await markBirthDateConfirmed({
          patientId: current.clientId,
          professionalId: profissionalId,
        })) || client;
    }
    clearState(phone);
    return await buildMenuResponse({ client, professionalName, profissionalId });
  }
  if (pick === 2) {
    return beginBirthDateUpdateFlow({ phone, current });
  }

  return {
    reply: 'Responda *1* se a data está correta, *2* para atualizar ou *0* para sair.',
  };
}

async function update_birthdate({
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
    return await buildMenuResponse({ client: existingClient, professionalName, profissionalId });
  }

  const dob = parseBirthDateInput(normalizedText);
  if (!dob) {
    return {
      reply: 'Data inválida. Use o formato *DD/MM/AAAA* (ex: 15/03/1990) ou digite *0* para voltar.',
    };
  }

  let client = existingClient;
  if (current.clientId) {
    client = await updateClientBirthDate({
      patientId: current.clientId,
      professionalId: profissionalId,
      dateOfBirth: dob,
    });
  }

  clearState(phone);
  return await buildMenuResponse({
    client,
    professionalName,
    profissionalId,
    extraLine: buildBirthDateUpdatedMessage(firstNameFrom(client?.name || current.clientName)),
  });
}

async function cadastro_nascimento({
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
    return beginWelcomeMenu({
      phone,
      profissionalId,
      professionalName,
      client: existingClient,
      guestName: current?.guestName || current?.clientName || '',
      extraLine: buildRegistrationRefusalMessage(professionalName),
    });
  }

  const dob = parseBirthDateInput(normalizedText);
  if (!dob) {
    return {
      reply: 'Data inválida. Use o formato *DD/MM/AAAA* (ex: 15/03/1990) ou digite *0* para voltar.',
    };
  }

  let client = existingClient;
  if (current.clientId && client?.id === current.clientId) {
    client = await updateClientBirthDate({
      patientId: current.clientId,
      professionalId: profissionalId,
      dateOfBirth: dob,
    });
  } else {
    client = await createClient({
      name: current.clientName,
      phone,
      professionalId: profissionalId,
      dateOfBirth: dob,
    });
  }

  if (current.flowMode === 'booking') {
    const procedureName = String(
      current.selectedProcedure || current.activePromotionProcedureName || ''
    ).trim();
    if (procedureName) {
      return beginDateSelection({
        phone,
        profissionalId,
        clientName: client?.name || current.clientName,
        professionalName,
        procedureName,
        flowMode: 'book',
        activePromotionId: current.activePromotionId || null,
        activePromotionTitle: current.activePromotionTitle || null,
        introLine: 'Cadastro confirmado! Agora vamos agendar sua consulta. 😊',
      });
    }
    return beginProcedureSelection({
      phone,
      profissionalId,
      clientName: client?.name || current.clientName,
      professionalName,
      activePromotionId: current.activePromotionId || null,
      activePromotionTitle: current.activePromotionTitle || null,
      introLine: 'Cadastro confirmado! Agora vamos agendar sua consulta. 😊',
    });
  }

  clearState(phone);
  return await buildMenuResponse({
    client,
    professionalName,
    profissionalId,
    extraLine: 'Cadastro confirmado! 😊',
  });
}

async function cadastro_nome({
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
    return beginWelcomeMenu({
      phone,
      profissionalId,
      professionalName,
      client: existingClient,
      guestName: current?.guestName || '',
      extraLine: buildRegistrationRefusalMessage(professionalName),
    });
  }
  if (normalizedText.replace(/\s+/g, ' ').trim().length < 2) {
    return { reply: 'Nome inválido. Informe seu *nome completo* ou digite *0* para voltar.' };
  }

  return beginRegistrationBirthDate({
    phone,
    profissionalId,
    clientName: normalizedText,
    clientId: existingClient?.id || null,
    forBooking: current.flowMode === 'booking',
    preserved: {
      activePromotionId: current.activePromotionId || null,
      activePromotionTitle: current.activePromotionTitle || null,
      activePromotionProcedureId: current.activePromotionProcedureId || null,
      activePromotionProcedureName: current.activePromotionProcedureName || null,
      selectedProcedure: current.selectedProcedure || current.activePromotionProcedureName || null,
      guestName: normalizedText,
    },
  });
}

module.exports = {
  confirm_birthdate,
  update_birthdate,
  cadastro_nascimento,
  cadastro_nome,
};
