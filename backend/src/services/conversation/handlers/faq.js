'use strict';

const { isSairCommand, parseIndexPick, clearState, returnGuestOrMainMenu } = require('../core');

async function faq_pick({ phone, profissionalId, text, professionalName, existingClient, current }) {
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
    return { reply: 'Responda com o *número da pergunta* ou *0* para voltar ao menu.' };
  }

  const chosen = (current.faqOptions || []).find((item) => item.pickIndex === pick);
  if (!chosen) {
    return { reply: 'Pergunta inválida. Escolha um número da lista ou *0* para voltar.' };
  }

  return {
    reply:
      `*${chosen.question}*\n\n` +
      `${chosen.answer}\n\n` +
      `Digite *0* para voltar ao menu ou outro número para ver outra dúvida.`,
    stateStep: 'faq_pick',
  };
}

module.exports = {
  faq_pick,
};
