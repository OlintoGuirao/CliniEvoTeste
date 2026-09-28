'use strict';

const {
  isSairCommand,
  parseIndexPick,
  clearState,
  buildMenuResponse,
  getPublicAppBaseUrl,
  buildTreatmentLinkMessage,
} = require('../core');

async function treatment_pick({
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
    return { reply: 'Responda com o *número do tratamento* ou *0* para voltar ao menu.' };
  }

  const chosen = (current.treatmentOptions || []).find((item) => item.pickIndex === pick);
  if (!chosen) {
    return { reply: 'Tratamento inválido. Escolha um número da lista ou *0* para voltar.' };
  }

  const baseUrl = getPublicAppBaseUrl();
  const reportUrl =
    chosen.reportSlug && chosen.pathPrefix
      ? `${baseUrl}${chosen.pathPrefix}${chosen.reportSlug}`
      : null;

  const message = buildTreatmentLinkMessage({
    patientName: existingClient?.name,
    clinicName: professionalName,
    procedureName: chosen.procedureName,
    reportUrl: reportUrl || '',
    kind: chosen.kind,
  });

  return {
    reply: reportUrl
      ? `${message}\n\nDigite *0* para voltar ao menu ou outro número para outro tratamento.`
      : message,
    stateStep: 'treatment_pick',
  };
}

module.exports = {
  treatment_pick,
};
