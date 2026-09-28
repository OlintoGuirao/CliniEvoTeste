const MENU_TEXT =
  `Como posso ajudar hoje?\n\n` +
  `1) Novo agendamento\n` +
  `2) Minhas consultas\n` +
  `3) Reagendar consulta\n` +
  `4) Cancelar consulta\n` +
  `5) Falar com o profissional\n` +
  `6) Ver promoções\n` +
  `7) Dúvidas frequentes\n` +
  `0) Sair\n\n` +
  `Responda com o número da opção ou 0 para sair.`;

function buildWelcomeMenuText({ includePromotions = false } = {}) {
  const lines = [
    'O que você gostaria de fazer?',
    '',
    '1) Conhecer serviços',
  ];
  if (includePromotions) lines.push('2) Ver promoções');
  lines.push(
    '3) Dúvidas frequentes',
    '4) Falar com o profissional',
    '5) Agendar consulta',
    '0) Sair',
    '',
    'Explore com calma — o cadastro só é pedido na hora de agendar.',
    '',
    'Responda com o número da opção ou *0* para sair.'
  );
  return lines.join('\n');
}

function buildWelcomeGreeting({ professionalName, firstName, isReturning = false }) {
  const prof = String(professionalName || 'nossa clínica').trim();
  if (isReturning && firstName) {
    return `Olá novamente, *${firstName}*! 👋\n\nBem-vinda à *${prof}*.`;
  }
  if (firstName) {
    return `Olá, *${firstName}*! 👋\n\nSeja bem-vinda à *${prof}*.`;
  }
  return `Olá! Seja bem-vinda à *${prof}*. 👋`;
}

function buildNotFoundAskNamePrompt() {
  return 'Hmm, não encontrei o seu cadastro. Por favor, me diga o seu *nome completo*.';
}

function buildBookingRegistrationNamePrompt() {
  return (
    `Para agendar sua consulta, precisamos de algumas informações básicas.\n\n` +
    `Precisamos delas para registrar sua consulta e garantir seu atendimento.\n\n` +
    `Qual o seu *nome completo*?\n\n` +
    `Digite *0* se preferir não se cadastrar agora.`
  );
}

function buildBookingRegistrationBirthDatePrompt(firstName) {
  const name = String(firstName || '').trim();
  return (
    `Obrigada${name ? `, ${name}` : ''}! 😊\n\n` +
    `Agora informe sua *data de nascimento* no formato *DD/MM/AAAA*.\n` +
    `Exemplo: 15/03/1990\n\n` +
    `Digite *0* se preferir não se cadastrar agora.`
  );
}

function buildRegistrationRefusalMessage(professionalName) {
  const prof = String(professionalName || 'profissional').trim();
  return (
    `Sem problemas! 😊\n\n` +
    `Se preferir não se cadastrar agora, posso ajudar com informações sobre serviços, promoções e dúvidas — ` +
    `ou conectar você à equipe da *${prof}* (opção *4*).`
  );
}

function buildMenuText({ includePromotions = false, includeFaq = false, includeTreatments = false } = {}) {
  const lines = [
    'Como posso ajudar hoje?',
    '',
    '1) Novo agendamento',
    '2) Minhas consultas',
    '3) Reagendar consulta',
    '4) Cancelar consulta',
    '5) Falar com o profissional',
  ];
  if (includePromotions) lines.push('6) Ver promoções');
  if (includeFaq) lines.push('7) Dúvidas frequentes');
  if (includeTreatments) lines.push('8) Meus tratamentos');
  lines.push('0) Sair', '', 'Responda com o número da opção ou *0* para sair.');
  return lines.join('\n');
}

function buildAudioReplyMessage() {
  return (
    `Recebi seu áudio, mas neste atendimento automático só consigo ler *mensagens digitadas*. 😊\n\n` +
    `Por favor, envie sua mensagem em texto para que eu possa ajudar.`
  );
}

const WAIT_ACK_MESSAGES = {
  greeting: 'Um momento, estou procurando seu cadastro... ⏳',
  atualizando_cadastro: 'Um momento, estou atualizando seu cadastro... ⏳',
  agendar: 'Um momento, vou buscar os procedimentos disponíveis... ⏳',
  horarios: 'Um momento, vou verificar os horários disponíveis... ⏳',
  consultas: 'Um momento, vou consultar suas consultas... ⏳',
  confirmar: 'Um momento, estou confirmando seu agendamento... ⏳',
  cancelando: 'Um momento, estou cancelando sua consulta... ⏳',
  reagendar: 'Um momento, vou buscar suas consultas para reagendar... ⏳',
  promocoes: 'Um momento, vou buscar as promoções disponíveis... ⏳',
  faq: 'Um momento, vou buscar as dúvidas frequentes... ⏳',
  tratamentos: 'Um momento, vou buscar seus tratamentos em andamento... ⏳',
  servicos: 'Um momento, vou buscar os serviços disponíveis... ⏳',
};

function timeOfDayWish() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Tenha um ótimo dia';
  if (hour >= 12 && hour < 18) return 'Tenha uma ótima tarde';
  return 'Tenha uma ótima noite';
}

function buildCordialFarewell(professionalName) {
  const name = String(professionalName || 'profissional').trim();
  return (
    `Foi um prazer ajudar! 💚\n` +
    `A equipe da *${name}* agradece o seu contato.\n` +
    `${timeOfDayWish()}!`
  );
}

function buildClosingHints() {
  return (
    `Quando quiser, é só digitar:\n\n` +
    `📅 agendar outra consulta\n` +
    `📋 ver seus agendamentos\n` +
    `🎁 ver promoções\n` +
    `❓ dúvidas frequentes\n` +
    `👨‍⚕️ falar com o profissional\n` +
    `👋 finalizar atendimento\n\n` +
    `Ou envie *oi* para ver o menu completo.`
  );
}

function buildSessionClosing(professionalName) {
  return (
    `${buildCordialFarewell(professionalName)}\n\n` +
    `Encontrou o que procurava? Se precisar de algo mais, é só enviar *oi*.\n\n` +
    `${buildClosingHints()}`
  );
}

function buildBirthDateConfirmMessage({ firstName, birthDateLabel }) {
  const name = String(firstName || '').trim();
  const greeting = name ? `Encontrei seu cadastro, *${name}*!` : 'Encontrei seu cadastro!';
  return (
    `${greeting} 😊\n\n` +
    `Sua data de nascimento cadastrada é *${birthDateLabel}*.\n\n` +
    `Está correta?\n\n` +
    `*1* — Sim, está correta\n` +
    `*2* — Não, quero atualizar\n` +
    `*0* — Sair`
  );
}

function buildBirthDateUpdatePrompt(firstName) {
  const name = String(firstName || '').trim();
  return (
    `${name ? `Certo, ${name}!` : 'Certo!'} Informe sua *data de nascimento* no formato *DD/MM/AAAA*.\n` +
    `Exemplo: 15/03/1990\n\n` +
    `Digite *0* para voltar ao menu.`
  );
}

function buildBirthDateUpdatedMessage(firstName) {
  const name = String(firstName || '').trim();
  return name ? `Cadastro atualizado com sucesso, ${name}! ✅` : 'Cadastro atualizado com sucesso! ✅';
}

function buildCancelConfirmMessage({ procedureName, appointmentDate, appointmentTime }) {
  return (
    `Confirme o *cancelamento*:\n\n` +
    `Procedimento: *${procedureName}*\n` +
    `Data: ${appointmentDate}\n` +
    `Horário: ${appointmentTime}\n\n` +
    `*1* — Sim, cancelar consulta\n` +
    `*2* — Não, voltar\n` +
    `*0* — Menu principal`
  );
}

function buildGreetingLine(firstName) {
  const name = String(firstName || '').trim();
  if (name) return `Olá, ${name}! 😊`;
  return 'Olá! 😊';
}

function buildHumanHandoffMessage(professionalName) {
  const name = String(professionalName || 'profissional').trim();
  return (
    `Perfeito! Vou avisar a *${name}* que você deseja falar com ela.\n\n` +
    `Em breve você receberá uma resposta por aqui. Obrigada pela paciência! 🙏`
  );
}

function buildBookingConfirmedMessage({ procedureName, clientName, appointmentDate, appointmentTime, professionalName }) {
  return (
    `✅ Agendamento confirmado!\n\n` +
    `Você receberá lembretes automáticos 24 horas e 1 hora antes da consulta.\n\n` +
    `Procedimento: *${procedureName}*\n` +
    `Nome: ${clientName || ''}\n` +
    `Data: ${appointmentDate}\n` +
    `Horário: ${appointmentTime}\n\n` +
    buildSessionClosing(professionalName)
  );
}

function buildRescheduleConfirmedMessage({ procedureName, appointmentDate, appointmentTime, professionalName }) {
  return (
    `✅ Consulta reagendada com sucesso!\n\n` +
    `Procedimento: *${procedureName}*\n` +
    `Nova data: ${appointmentDate}\n` +
    `Novo horário: ${appointmentTime}\n\n` +
    buildSessionClosing(professionalName)
  );
}

function buildCancelConfirmedMessage({ procedureName, appointmentDate, appointmentTime, professionalName }) {
  return (
    `Consulta cancelada com sucesso:\n` +
    `*${procedureName}*\n` +
    `${appointmentDate} às ${appointmentTime}\n\n` +
    buildSessionClosing(professionalName)
  );
}

/** Atalhos por emoji no encerramento e mensagens rápidas. */
function parseQuickAction(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  if (t.includes('📅')) return 'agendar';
  if (t.includes('📋')) return 'consultas';
  if (t.includes('🎁')) return 'promocoes';
  if (t.includes('❓')) return 'faq';
  if (/👨‍⚕|🧑‍⚕|👩‍⚕/.test(t)) return 'profissional';
  if (t.includes('👋')) return 'sair';
  return null;
}

module.exports = {
  MENU_TEXT,
  buildWelcomeMenuText,
  buildWelcomeGreeting,
  buildNotFoundAskNamePrompt,
  buildBookingRegistrationNamePrompt,
  buildBookingRegistrationBirthDatePrompt,
  buildRegistrationRefusalMessage,
  buildMenuText,
  buildAudioReplyMessage,
  WAIT_ACK_MESSAGES,
  buildCordialFarewell,
  buildClosingHints,
  buildSessionClosing,
  buildGreetingLine,
  buildHumanHandoffMessage,
  buildBookingConfirmedMessage,
  buildRescheduleConfirmedMessage,
  buildCancelConfirmedMessage,
  buildBirthDateConfirmMessage,
  buildBirthDateUpdatePrompt,
  buildBirthDateUpdatedMessage,
  buildCancelConfirmMessage,
  parseQuickAction,
};
