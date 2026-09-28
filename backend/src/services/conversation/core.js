const { getState, upsertState, clearState } = require('../../store/conversationStateStore');
const {
  openHandoffConversation,
} = require('../../repositories/whatsappConversationRepository');
const { logger } = require('../../utils/logger');
const {
  getAvailableSlotsGroupedByDate,
  tryParseSlotSelection,
  isSlotBooked,
} = require('../schedulingService');
const {
  createAppointment,
  appointments,
  removeAppointmentById,
  updateAppointmentSchedule,
} = require('../../store/memoryStore');
const {
  findClientByPhone,
  createClient,
  updateClientBirthDate,
  markBirthDateConfirmed,
  isPatientFullyRegistered,
  isRecognizedPatient,
  isBirthDateConfirmed,
} = require('../../store/clientStore');
const {
  listUpcomingAppointmentsByPhone,
  cancelAppointmentById,
  getAppointmentById,
  findAppointmentAwaitingPresenceResponse,
  markPresenceConfirmed,
  markPresenceDeclined,
} = require('../../repositories/appointmentsRepository');
const { listProceduresForProfessional, getProcedureNameById } = require('../../repositories/proceduresRepository');
const { phonesMatch } = require('../../store/phoneUtils');
const { parseBirthDateInput } = require('../../lib/birthDateUtils');
const { extractProcedureFromNotes } = require('../../lib/appointmentNotes');
const { formatDateBRFromYmd, formatDateWithWeekdayBR } = require('../../utils/time');
const {
  MENU_TEXT,
  buildMenuText,
  WAIT_ACK_MESSAGES,
  buildCordialFarewell,
  buildGreetingLine,
  buildHumanHandoffMessage,
  buildBookingConfirmedMessage,
  buildRescheduleConfirmedMessage,
  buildCancelConfirmedMessage,
  buildBirthDateConfirmMessage,
  buildBirthDateUpdatePrompt,
  buildBirthDateUpdatedMessage,
  buildCancelConfirmMessage,
  buildSessionClosing,
  buildClosingHints,
  buildWelcomeMenuText,
  buildWelcomeGreeting,
  buildNotFoundAskNamePrompt,
  buildBookingRegistrationNamePrompt,
  buildBookingRegistrationBirthDatePrompt,
  buildRegistrationRefusalMessage,
  parseQuickAction,
} = require('../../lib/botMessages');
const {
  buildWelcomeMenuList,
  buildMainMenuList,
  buildProceduresList,
  buildDatesList,
  buildTimesList,
  buildConsultasViewList,
  buildCancelList,
  buildRescheduleList,
  buildPromotionsList,
  buildFaqList,
  buildTreatmentsList,
} = require('../../lib/whatsappInteractive');
const { listActiveMenuPromotions } = require('../../repositories/whatsappPromotionRepository');
const { listFaqItemsForProfessional } = require('../../repositories/whatsappBotFaqRepository');
const {
  listActiveTreatmentsForPatient,
  countActiveTreatmentsForPatient,
} = require('../../repositories/patientTreatmentsRepository');
const {
  viewPromotionViaMenu,
  getPromotionDetailsForMenu,
  reservePromotionForBooking,
} = require('../whatsappPromotionService');
const {
  buildPresenceConfirmedMessage,
  buildPresenceDeclinedMessage,
  procedureNameFromAppointment,
} = require('../../lib/appointmentReminderMessage');
const { isAppointmentPresenceConfirmationEnabled, isAppointmentPresenceConfirmation24hEnabled } = require('../../repositories/professionalUiSettingsRepository');
const { getPublicAppBaseUrl, buildTreatmentLinkMessage } = require('../../lib/reportShareMessage');

const DATE_OFFER_LIMIT = 10;

function normalizeText(t) {
  return String(t || '').trim().toLowerCase();
}

function isGreeting(text) {
  const t = normalizeText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return /^(oi|ola|bom dia|boa tarde|boa noite|hey|e ai|eae|hello|hi|menu|inicio)\b/.test(t);
}

function isAgendarCommand(text) {
  const t = normalizeText(text);
  return t === '1' || t === 'agendar' || t.includes('agendar consulta') || t.includes('agendar');
}

function isVerConsultasCommand(text) {
  const t = normalizeText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return (
    t === '2' ||
    t.includes('minhas consultas') ||
    t.includes('ver consultas') ||
    t.includes('verificar horario')
  );
}

function isReagendarCommand(text) {
  const t = normalizeText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return t === '3' || t.includes('reagendar');
}

function isCancelarCommand(text) {
  const t = normalizeText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return t === '4' || t.includes('cancelar consulta') || (t.includes('cancelar') && !t.includes('reagendar'));
}

function isFalarProfissionalCommand(text) {
  const t = normalizeText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return (
    t === '5' ||
    t.includes('falar com o profissional') ||
    t.includes('falar com profissional') ||
    t.includes('atendimento humano')
  );
}

function isPromocoesCommand(text) {
  const t = normalizeText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return (
    t === '6' ||
    t.includes('ver promocoes') ||
    t.includes('promocoes') ||
    t.includes('promocao') ||
    t.includes('promocoes da clinica')
  );
}

function isFaqCommand(text) {
  const t = normalizeText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return (
    t === '7' ||
    t.includes('duvidas frequentes') ||
    t.includes('duvidas') ||
    t.includes('faq') ||
    t.includes('perguntas frequentes')
  );
}

function isTreatmentsCommand(text) {
  const t = normalizeText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return (
    t === '8' ||
    t.includes('meus tratamentos') ||
    t.includes('tratamentos ativos') ||
    t.includes('acompanhamento')
  );
}

function isGuestServicosCommand(text) {
  const t = normalizeText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return (
    t === '1' ||
    t.includes('conhecer servicos') ||
    t.includes('especialidades') ||
    t.includes('servicos da clinica')
  );
}

function isGuestPromocoesCommand(text) {
  const t = normalizeText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return t === '2' || t.includes('ver promocoes') || t.includes('promocoes') || t.includes('promocao');
}

function isGuestFaqCommand(text) {
  const t = normalizeText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return t === '3' || t.includes('duvidas frequentes') || t.includes('duvidas') || t.includes('faq');
}

function isGuestProfissionalCommand(text) {
  const t = normalizeText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return (
    t === '4' ||
    t.includes('falar com o profissional') ||
    t.includes('falar com profissional') ||
    t.includes('atendimento humano')
  );
}

function isGuestAgendarCommand(text) {
  const t = normalizeText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return t === '5' || t.includes('agendar consulta') || (t.includes('agendar') && !t.includes('reagendar'));
}

function isSairCommand(text) {
  const t = normalizeText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return t === '0' || t === 'sair' || t === 'exit';
}

function isMenuCommand(text) {
  const t = normalizeText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return t === 'menu' || t === 'inicio' || t.includes('voltar ao menu') || t.includes('ver menu');
}

function isIdleState(state) {
  return !state || state.step === 0 || state.step == null;
}

function formatDateBR(dateStr) {
  return formatDateBRFromYmd(dateStr);
}

function formatTimeBR(timeStr) {
  return String(timeStr || '').slice(0, 5);
}

function firstNameFrom(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || '';
}

function enrichAppointments(items) {
  return (items || []).map((item) => ({
    ...item,
    procedureName: extractProcedureFromNotes(item.notes),
  }));
}

function buildDatesMessage({ dateOptions }) {
  const preview = (dateOptions || [])
    .map((d) => `*${d.pickIndex}* — ${formatDateWithWeekdayBR(d.appointmentDate)}`)
    .join('\n');
  return (
    `Escolha uma data:\n\n` +
    `${preview}\n\n` +
    `Responda com o *número da data*.\n` +
    `Digite *0* para voltar.`
  );
}

function buildTimesMessage({ appointmentDate, timeOptions }) {
  const preview = (timeOptions || [])
    .map((t) => `*${t.pickIndex}* — ${formatTimeBR(t.appointmentTime)}`)
    .join('\n');
  return (
    `Horários disponíveis para *${formatDateBR(appointmentDate)}*:\n\n` +
    `${preview}\n\n` +
    `Responda com o *número do horário*.\n` +
    `Digite *0* para escolher outra data.`
  );
}

function buildConfirmMessage({ procedureName, appointmentDate, appointmentTime }) {
  return (
    `Confirme seu agendamento:\n\n` +
    `Procedimento: *${procedureName}*\n` +
    `Data: ${formatDateBR(appointmentDate)}\n` +
    `Horário: ${formatTimeBR(appointmentTime)}\n\n` +
    `*1* — Confirmar\n` +
    `*2* — Alterar horário\n` +
    `*0* — Cancelar`
  );
}

function formatAppointmentsList(items) {
  return enrichAppointments(items)
    .map(
      (s, idx) =>
        `*${idx + 1}* — *${s.procedureName}*\n` +
        `   ${formatDateBR(s.appointment_date)} às ${formatTimeBR(s.start_time)}`
    )
    .join('\n\n');
}

function sortConsultas(items, sort = 'asc') {
  const copy = [...(items || [])];
  copy.sort((a, b) => {
    const ka = `${a.appointment_date} ${a.start_time}`;
    const kb = `${b.appointment_date} ${b.start_time}`;
    return sort === 'desc' ? kb.localeCompare(ka) : ka.localeCompare(kb);
  });
  return copy;
}

function uniqueProcedureNames(items) {
  return [...new Set((items || []).map((item) => item.procedureName).filter(Boolean))];
}

function buildConsultaDetailMessage(item, professionalName) {
  return (
    `Detalhes da consulta:\n\n` +
    `Procedimento: *${item.procedureName || 'Consulta'}*\n` +
    `Data: ${formatDateBR(item.appointment_date)}\n` +
    `Horário: ${formatTimeBR(item.start_time)}\n` +
    `Profissional: *${professionalName}*\n\n` +
    `Para *reagendar*, use a opção *3* do menu.\n` +
    `Para *cancelar*, use a opção *4* do menu.\n` +
    `Digite *0* para voltar ao menu.`
  );
}

function renderConsultasListResponse({ upcoming, professionalName, extraIntro = '' }) {
  const intro = extraIntro ? `${extraIntro}\n\n` : '';
  return {
    reply:
      `${intro}Suas consultas com ${professionalName}:\n\n` +
      `${formatAppointmentsList(upcoming)}\n\n` +
      `Toque em uma consulta na lista para ver detalhes.\n` +
      `Para *reagendar* ou *cancelar*, use as opções *3* ou *4* do menu.\n\n` +
      buildClosingHints(),
    interactive: buildConsultasViewList({ upcoming }),
    stateStep: 'consultas_list',
  };
}

async function buildMenuResponse({ client, professionalName, extraLine = '', profissionalId }) {
  const includePromotions = profissionalId
    ? (await listActiveMenuPromotions(profissionalId)).length > 0
    : false;
  const includeFaq = profissionalId
    ? (await listFaqItemsForProfessional(profissionalId)).length > 0
    : false;
  const includeTreatments =
    profissionalId && client?.id
      ? (await countActiveTreatmentsForPatient({
          patientId: client.id,
          professionalId: profissionalId,
        })) > 0
      : false;
  const greeting = buildGreetingLine(
    isRecognizedPatient(client) ? firstNameFrom(client?.name) : ''
  );
  const line = extraLine ? `${extraLine}\n\n` : '';
  return {
    reply: `${line}${greeting}\n\n${buildMenuText({ includePromotions, includeFaq, includeTreatments })}`,
    interactive: buildMainMenuList({
      greetingLine: `${greeting}\n\nComo posso ajudar hoje?`,
      includePromotions,
      includeFaq,
      includeTreatments,
    }),
    stateStep: 0,
  };
}

function buildFarewellResponse(professionalName) {
  return {
    reply: buildSessionClosing(professionalName),
    stateStep: 0,
  };
}

function parseIndexPick(text, maxIndex = null) {
  const pick = Number(String(text || '').trim());
  if (!Number.isInteger(pick) || pick < 1) return null;
  if (maxIndex != null && pick > maxIndex) return null;
  return pick;
}

function performHandoff({ phone, profissionalId, professionalName, patientName = null }) {
  upsertState(phone, {
    phone,
    step: 'human_handoff',
    profissionalId,
    createdAt: Date.now(),
  });
  const handoffReply = `${buildHumanHandoffMessage(professionalName)}\n\n${buildCordialFarewell(professionalName)}`;
  openHandoffConversation({
    professionalId: profissionalId,
    phone,
    patientName: patientName || null,
    botReplyText: handoffReply,
  }).catch((err) => {
    logger.error('Falha ao persistir handoff WhatsApp', {
      profissionalId,
      phone,
      message: err?.message || String(err),
    });
  });
  return {
    reply: handoffReply,
    stateStep: 'human_handoff',
  };
}

/** Timeout do handoff humano: após isso, o bot volta a atender. */
const HUMAN_HANDOFF_TIMEOUT_MS = 30 * 60 * 1000;

function resolveIdleAction(text) {
  const quick = parseQuickAction(text);
  if (quick) return quick;
  if (isSairCommand(text)) return 'sair';
  if (isFalarProfissionalCommand(text)) return 'profissional';
  if (isCancelarCommand(text)) return 'cancelar';
  if (isReagendarCommand(text)) return 'reagendar';
  if (isVerConsultasCommand(text)) return 'consultas';
  if (isAgendarCommand(text)) return 'agendar';
  if (isPromocoesCommand(text)) return 'promocoes';
  if (isFaqCommand(text)) return 'faq';
  if (isTreatmentsCommand(text)) return 'tratamentos';
  if (isGreeting(text) || isMenuCommand(text) || !String(text || '').trim()) return 'greeting';
  return null;
}

async function handleRegisteredPatientIdle({
  phone,
  profissionalId,
  professionalName,
  existingClient,
  text,
  current,
}) {
  const presenceResponse = await tryHandlePresenceResponse({
    phone,
    profissionalId,
    professionalName,
    text,
  });
  if (presenceResponse) return presenceResponse;

  const action = resolveIdleAction(text);
  const requireRegistered = async (fn) => {
    if (!isPatientFullyRegistered(existingClient)) {
      return handleGreeting({ phone, profissionalId, professionalName });
    }
    return fn();
  };

  switch (action) {
    case 'sair':
      clearState(phone);
      return buildFarewellResponse(professionalName);
    case 'agendar':
      return requireRegistered(() =>
        beginProcedureSelection({
          phone,
          profissionalId,
          clientName: existingClient.name,
          professionalName,
        })
      );
    case 'consultas':
      return requireRegistered(() =>
        beginViewConsultas({ phone, profissionalId, professionalName })
      );
    case 'profissional':
      return performHandoff({
        phone,
        profissionalId,
        professionalName,
        patientName: existingClient?.name || current?.guestName || null,
      });
    case 'promocoes':
      return requireRegistered(() =>
        beginPromotionsFlow({ phone, profissionalId, professionalName, existingClient })
      );
    case 'faq':
      return requireRegistered(() =>
        beginFaqFlow({ phone, profissionalId, professionalName, existingClient })
      );
    case 'cancelar':
      return requireRegistered(() =>
        beginCancelFlow({ phone, profissionalId, professionalName })
      );
    case 'reagendar':
      return requireRegistered(() =>
        beginRescheduleFlow({ phone, profissionalId, professionalName })
      );
    case 'tratamentos':
      return requireRegistered(() =>
        beginTreatmentsFlow({ phone, profissionalId, professionalName, existingClient })
      );
    case 'greeting':
      return handleGreeting({ phone, profissionalId, professionalName });
    default:
      return buildMenuResponse({ client: existingClient, professionalName, profissionalId });
  }
}

async function resolveWaitAckMessage({ phone, profissionalId, text }) {
  const current = getState(phone);

  if (current?.step === 'human_handoff') return null;

  if (current?.step === 'confirm_booking' && current.profissionalId === profissionalId) {
    if (isSairCommand(text)) return null;
    const pick = parseIndexPick(text);
    if (pick === 1 || pick === 2) return WAIT_ACK_MESSAGES.confirmar;
    return null;
  }

  if (
    (current?.step === 'date_pick' || current?.step === 'time_pick') &&
    current.profissionalId === profissionalId
  ) {
    if (isSairCommand(text)) return null;
    const pick = parseIndexPick(text);
    if (pick) return WAIT_ACK_MESSAGES.horarios;
    return null;
  }

  if (current?.step === 'cancel_confirm' && current.profissionalId === profissionalId) {
    if (isSairCommand(text)) return null;
    const pick = parseIndexPick(text);
    if (pick === 1) return WAIT_ACK_MESSAGES.cancelando;
    return null;
  }

  if (
    (current?.step === 'cancel_pick' || current?.step === 'reschedule_pick') &&
    current.profissionalId === profissionalId
  ) {
    if (isSairCommand(text)) return null;
    const pick = parseIndexPick(text);
    if (pick) {
      return current.step === 'cancel_pick' ? null : WAIT_ACK_MESSAGES.reagendar;
    }
    return null;
  }

  if (current?.step === 'confirm_birthdate' && current.profissionalId === profissionalId) {
    if (isSairCommand(text)) return null;
    const pick = parseIndexPick(text);
    if (pick === 1 || pick === 2) return null;
    return null;
  }

  if (current?.step === 'update_birthdate' && current.profissionalId === profissionalId) {
    if (isSairCommand(text)) return null;
    if (parseBirthDateInput(String(text || '').trim())) return WAIT_ACK_MESSAGES.atualizando_cadastro;
    return null;
  }

  if (current?.step === 'faq_pick' && current.profissionalId === profissionalId) {
    if (isSairCommand(text)) return null;
    const pick = parseIndexPick(text);
    if (pick) return WAIT_ACK_MESSAGES.faq;
    return null;
  }

  if (current?.step === 'procedure_pick' && current.profissionalId === profissionalId) {
    if (isSairCommand(text)) return null;
    const pick = parseIndexPick(text);
    if (pick) return WAIT_ACK_MESSAGES.horarios;
    return null;
  }

  if (current?.step === 'promotion_pick' && current.profissionalId === profissionalId) {
    if (isSairCommand(text)) return null;
    const pick = parseIndexPick(text);
    if (pick) return WAIT_ACK_MESSAGES.promocoes;
    return null;
  }

  if (current?.step === 'promo_details_offer' && current.profissionalId === profissionalId) {
    if (isSairCommand(text)) return null;
    const pick = parseIndexPick(text);
    if (pick === 1 || pick === 2) return WAIT_ACK_MESSAGES.promocoes;
    return null;
  }

  if (current?.step === 'promo_schedule_offer' && current.profissionalId === profissionalId) {
    if (isSairCommand(text)) return null;
    const pick = parseIndexPick(text);
    if (pick === 1) return WAIT_ACK_MESSAGES.agendar;
    return null;
  }

  if (current?.step === 'treatment_pick' && current.profissionalId === profissionalId) {
    if (isSairCommand(text)) return null;
    const pick = parseIndexPick(text);
    if (pick) return WAIT_ACK_MESSAGES.tratamentos;
    return null;
  }

  if (!isIdleState(current)) return null;

  const quickAction = parseQuickAction(text);
  if (quickAction === 'agendar') return WAIT_ACK_MESSAGES.agendar;
  if (quickAction === 'consultas') return WAIT_ACK_MESSAGES.consultas;
  if (quickAction === 'profissional') return null;

  if (current?.step === 'guest_services' && current.profissionalId === profissionalId) {
    if (isSairCommand(text)) return null;
    const pick = parseIndexPick(text);
    if (pick) return WAIT_ACK_MESSAGES.agendar;
    return null;
  }

  if (isGreeting(text) || isMenuCommand(text)) return WAIT_ACK_MESSAGES.greeting;
  if (isVerConsultasCommand(text)) return WAIT_ACK_MESSAGES.consultas;
  if (isAgendarCommand(text)) return WAIT_ACK_MESSAGES.agendar;
  if (isReagendarCommand(text)) return WAIT_ACK_MESSAGES.reagendar;
  if (isCancelarCommand(text)) return WAIT_ACK_MESSAGES.cancelando;
  if (isPromocoesCommand(text)) return WAIT_ACK_MESSAGES.promocoes;
  if (isFaqCommand(text)) return WAIT_ACK_MESSAGES.faq;
  if (isTreatmentsCommand(text)) return WAIT_ACK_MESSAGES.tratamentos;
  if (isFalarProfissionalCommand(text)) return null;

  return null;
}

function listUpcomingFromMemory({ professionalId, phone }) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const nowTime = now.toTimeString().slice(0, 8);
  return (appointments || [])
    .filter((a) => String(a.professionalId || '') === String(professionalId || ''))
    .filter((a) => phonesMatch(a.phone, phone))
    .filter((a) => {
      if (!a?.appointmentDate) return false;
      if (a.appointmentDate > today) return true;
      if (a.appointmentDate < today) return false;
      return String(a.appointmentTime || '00:00:00') >= nowTime;
    })
    .sort((a, b) => `${a.appointmentDate} ${a.appointmentTime}`.localeCompare(`${b.appointmentDate} ${b.appointmentTime}`))
    .slice(0, 10)
    .map((a) => ({
      id: a.id,
      appointment_date: a.appointmentDate,
      start_time: a.appointmentTime,
      full_name: a.clientName || null,
      notes: a.service ? `Agendado via WhatsApp. Serviço: ${a.service}` : 'Agendado via WhatsApp',
    }));
}

async function fetchUpcomingAppointments({ professionalId, phone }) {
  let upcoming = [];
  try {
    upcoming = await listUpcomingAppointmentsByPhone({ professionalId, phone });
  } catch (_) {
    upcoming = [];
  }
  if (!upcoming.length) {
    upcoming = listUpcomingFromMemory({ professionalId, phone });
  }
  return enrichAppointments(upcoming).slice(0, 50);
}

async function beginWelcomeMenu({
  phone,
  profissionalId,
  professionalName,
  client,
  guestName = '',
  extraLine = '',
}) {
  const recognized = isRecognizedPatient(client) ? client : null;
  const nameForGreeting =
    String(recognized?.name || guestName || client?.name || '').trim() || '';
  const greeting = buildWelcomeGreeting({
    professionalName,
    firstName: firstNameFrom(nameForGreeting),
    isReturning: Boolean(recognized),
  });
  const line = extraLine ? `${extraLine}\n\n` : '';
  const includePromotions = profissionalId
    ? (await listActiveMenuPromotions(profissionalId)).length > 0
    : false;
  clearState(phone);
  upsertState(phone, {
    phone,
    step: 0,
    profissionalId,
    createdAt: Date.now(),
    isGuest: true,
    guestName: nameForGreeting || null,
  });
  return {
    reply: `${line}${greeting}\n\n${buildWelcomeMenuText({ includePromotions })}`,
    interactive: buildWelcomeMenuList({
      greetingLine: `${greeting}\n\nExplore nossos serviços com calma.`,
      includePromotions,
    }),
    stateStep: 0,
  };
}

function beginWelcomeAskName({ phone, profissionalId }) {
  upsertState(phone, {
    phone,
    step: 'welcome_ask_name',
    profissionalId,
    isGuest: true,
    createdAt: Date.now(),
  });
  return {
    reply: buildNotFoundAskNamePrompt(),
    stateStep: 'welcome_ask_name',
  };
}

async function beginGuestServicesFlow({ phone, profissionalId, professionalName, existingClient }) {
  const previous = getState(phone);
  const proceduresRaw = await listProceduresForProfessional(profissionalId);
  const procedures = proceduresRaw.map((p, idx) => ({
    pickIndex: idx + 1,
    id: p.id,
    name: p.name,
    category: p.category,
  }));

  if (!procedures.length) {
    return beginWelcomeMenu({
      phone,
      profissionalId,
      professionalName,
      client: existingClient,
      guestName: previous?.guestName || existingClient?.name || '',
      extraLine: 'No momento não há serviços cadastrados para exibir.',
    });
  }

  const preview = procedures
    .map((p) => `*${p.pickIndex}* — ${p.name}${p.category ? ` (${p.category})` : ''}`)
    .join('\n');

  upsertState(phone, {
    phone,
    step: 'guest_services',
    profissionalId,
    createdAt: Date.now(),
    isGuest: true,
    guestName: previous?.guestName || existingClient?.name || null,
    procedureOptions: procedures,
  });

  return {
    reply:
      `Conheça nossos serviços:\n\n` +
      `${preview}\n\n` +
      `Toque no *número* do serviço para *agendar* diretamente.\n` +
      `Digite *0* para voltar ao menu.`,
    interactive: buildProceduresList({ procedures }),
    stateStep: 'guest_services',
  };
}

async function beginGuestBookingForProcedure({
  phone,
  profissionalId,
  professionalName,
  existingClient,
  chosen,
  current = null,
}) {
  const procedureLabel = `*${chosen.name}*${chosen.category ? ` (${chosen.category})` : ''}`;
  const preserved = {
    activePromotionId: current?.activePromotionId || null,
    activePromotionTitle: current?.activePromotionTitle || null,
    selectedProcedure: chosen.name,
  };

  if (isPatientFullyRegistered(existingClient)) {
    return beginDateSelection({
      phone,
      profissionalId,
      clientName: existingClient?.name || '',
      professionalName,
      procedureName: chosen.name,
      flowMode: 'book',
      activePromotionId: preserved.activePromotionId,
      activePromotionTitle: preserved.activePromotionTitle,
      introLine: `${procedureLabel}\n\nVamos agendar sua consulta?`,
    });
  }

  const clientName = String(existingClient?.name || current?.guestName || '').trim();
  if (clientName.length >= 2) {
    const result = await beginRegistrationBirthDate({
      phone,
      profissionalId,
      clientName,
      clientId: existingClient?.id || null,
      forBooking: true,
      preserved,
    });
    return {
      ...result,
      reply: `Você escolheu: ${procedureLabel}\n\n${result.reply}`,
    };
  }

  const result = await beginRegistrationName({ phone, profissionalId, forBooking: true, preserved });
  return {
    ...result,
    reply: `Você escolheu: ${procedureLabel}\n\n${result.reply}`,
  };
}

async function beginRegistrationForBooking({
  phone,
  profissionalId,
  professionalName,
  existingClient,
  current = null,
}) {
  const preserved = {
    activePromotionId: current?.activePromotionId || null,
    activePromotionTitle: current?.activePromotionTitle || null,
    activePromotionProcedureId: current?.activePromotionProcedureId || null,
    activePromotionProcedureName: current?.activePromotionProcedureName || null,
    selectedProcedure:
      current?.selectedProcedure || current?.activePromotionProcedureName || null,
    guestName: current?.guestName || null,
  };
  const clientName = String(existingClient?.name || current?.guestName || '').trim();
  if (clientName.length >= 2) {
    return beginRegistrationBirthDate({
      phone,
      profissionalId,
      clientName,
      clientId: existingClient?.id || null,
      forBooking: true,
      preserved,
    });
  }
  return beginRegistrationName({ phone, profissionalId, forBooking: true, preserved });
}

async function beginRegistrationName({ phone, profissionalId, forBooking = true, preserved = {} }) {
  upsertState(phone, {
    phone,
    step: 'cadastro_nome',
    profissionalId,
    flowMode: forBooking ? 'booking' : 'registration',
    isGuest: true,
    createdAt: Date.now(),
    ...preserved,
  });
  return {
    reply: buildBookingRegistrationNamePrompt(),
    stateStep: 'cadastro_nome',
  };
}

async function beginRegistrationBirthDate({
  phone,
  profissionalId,
  clientName,
  clientId,
  forBooking = true,
  preserved = {},
}) {
  upsertState(phone, {
    phone,
    step: 'cadastro_nascimento',
    profissionalId,
    clientName: String(clientName || '').trim(),
    clientId: clientId || null,
    flowMode: forBooking ? 'booking' : 'registration',
    isGuest: true,
    createdAt: Date.now(),
    ...preserved,
  });
  return {
    reply: buildBookingRegistrationBirthDatePrompt(firstNameFrom(clientName)),
    stateStep: 'cadastro_nascimento',
  };
}

async function returnGuestOrMainMenu({ phone, profissionalId, professionalName, client, extraLine = '' }) {
  const previous = getState(phone);
  const fresh = client || (await findClientByPhone({ phone, professionalId: profissionalId }));
  if (isPatientFullyRegistered(fresh)) {
    return buildMenuResponse({ client: fresh, professionalName, profissionalId, extraLine });
  }
  return beginWelcomeMenu({
    phone,
    profissionalId,
    professionalName,
    client: fresh,
    guestName: previous?.guestName || fresh?.name || '',
    extraLine,
  });
}

async function beginBirthDateConfirmFlow({ phone, profissionalId, client }) {
  const birthDateLabel = formatDateBR(client.dateOfBirth);
  upsertState(phone, {
    phone,
    step: 'confirm_birthdate',
    profissionalId,
    clientId: client.id,
    clientName: client.name,
    createdAt: Date.now(),
  });
  return {
    reply: buildBirthDateConfirmMessage({
      firstName: firstNameFrom(client.name),
      birthDateLabel,
    }),
    stateStep: 'confirm_birthdate',
  };
}

function beginBirthDateUpdateFlow({ phone, current }) {
  upsertState(phone, {
    ...current,
    step: 'update_birthdate',
  });
  return {
    reply: buildBirthDateUpdatePrompt(firstNameFrom(current.clientName)),
    stateStep: 'update_birthdate',
  };
}

async function beginFaqFlow({ phone, profissionalId, professionalName, existingClient }) {
  const faqItems = await listFaqItemsForProfessional(profissionalId);
  if (!faqItems.length) {
    return returnGuestOrMainMenu({
      phone,
      profissionalId,
      professionalName,
      client: existingClient,
      extraLine: 'Ainda não há dúvidas frequentes cadastradas.',
    });
  }

  const preview = faqItems.map((item) => `*${item.pickIndex}* — ${item.question}`).join('\n');

  upsertState(phone, {
    phone,
    step: 'faq_pick',
    profissionalId,
    createdAt: Date.now(),
    faqOptions: faqItems,
  });

  return {
    reply:
      `Dúvidas frequentes:\n\n` +
      `${preview}\n\n` +
      `Responda com o *número da pergunta*.\n` +
      `Digite *0* para voltar ao menu.`,
    interactive: buildFaqList({ faqItems }),
    stateStep: 'faq_pick',
  };
}

async function beginPromotionsFlow({ phone, profissionalId, professionalName, existingClient }) {
  const rows = await listActiveMenuPromotions(profissionalId);
  const promotions = rows.map((row, idx) => ({
    pickIndex: idx + 1,
    id: row.id,
    title: String(row.title || row.message_text || 'Promoção').trim().slice(0, 80) || 'Promoção',
    maxParticipants: row.max_participants,
    claimedCount: Number(row.claimed_count || 0),
    procedureId: row.procedure_id || null,
  }));

  if (!promotions.length) {
    return returnGuestOrMainMenu({
      phone,
      profissionalId,
      professionalName,
      client: existingClient,
      extraLine: 'No momento não há promoções disponíveis.',
    });
  }

  const preview = promotions
    .map((promo) => {
      const slots =
        promo.maxParticipants == null
          ? 'agendamentos ilimitados'
          : `${Math.max(0, promo.maxParticipants - promo.claimedCount)} agendamento(s) restante(s)`;
      return `*${promo.pickIndex}* — ${promo.title} (${slots})`;
    })
    .join('\n');

  upsertState(phone, {
    phone,
    step: 'promotion_pick',
    profissionalId,
    createdAt: Date.now(),
    promotionOptions: promotions,
  });

  return {
    reply:
      `Promoções disponíveis:\n\n` +
      `${preview}\n\n` +
      `Responda com o *número da promoção*.\n` +
      `Digite *0* para voltar.`,
    interactive: buildPromotionsList({ promotions }),
    stateStep: 'promotion_pick',
  };
}

async function handlePromotionSelection({
  phone,
  profissionalId,
  professionalName,
  existingClient,
  current,
  pick,
}) {
  const chosen = (current.promotionOptions || []).find((p) => p.pickIndex === pick);
  if (!chosen?.id) {
    return { reply: 'Promoção inválida. Escolha um número da lista ou *0* para voltar.' };
  }

  try {
    const result = await viewPromotionViaMenu({
      promotionId: chosen.id,
      professionalId: profissionalId,
      phone,
    });

    if (!result.promotionId) {
      clearState(phone);
      return {
        reply: result.reply || 'Esta promoção não está mais disponível.',
        stateStep: 0,
      };
    }

    const procedureId = result.procedureId || chosen.procedureId || null;
    let procedureName = null;
    if (procedureId) {
      procedureName = await getProcedureNameById(procedureId);
    }

    upsertState(phone, {
      phone,
      step: 'promo_details_offer',
      profissionalId,
      createdAt: Date.now(),
      clientName: existingClient?.name || current?.guestName || '',
      guestName: current?.guestName || null,
      activePromotionId: result.promotionId,
      activePromotionTitle: result.promotionTitle || chosen.title,
      activePromotionProcedureId: procedureId,
      activePromotionProcedureName: procedureName,
      selectedProcedure: procedureName || null,
      promotionHasDetails: result.hasDetails !== false,
    });

    return {
      reply: result.reply || null,
      stateStep: 'promo_details_offer',
    };
  } catch (error) {
    clearState(phone);
    return returnGuestOrMainMenu({
      phone,
      profissionalId,
      professionalName,
      client: existingClient,
      extraLine: 'Não foi possível carregar a promoção agora. Tente novamente em instantes.',
    });
  }
}

/**
 * Após escolher agendar com promoção: usa o procedimento vinculado
 * (pula a lista) ou cai na seleção manual se não houver vínculo.
 */
async function beginBookingFromPromotion({
  phone,
  profissionalId,
  professionalName,
  existingClient,
  current,
}) {
  const procedureName = String(
    current?.activePromotionProcedureName || current?.selectedProcedure || ''
  ).trim();
  const clientName = String(
    current?.clientName || existingClient?.name || current?.guestName || ''
  ).trim();

  const preservedCurrent = {
    ...current,
    selectedProcedure: procedureName || current?.selectedProcedure || null,
    activePromotionId: current?.activePromotionId || null,
    activePromotionTitle: current?.activePromotionTitle || null,
    activePromotionProcedureId: current?.activePromotionProcedureId || null,
    activePromotionProcedureName: procedureName || null,
  };

  if (!isPatientFullyRegistered(existingClient)) {
    return beginRegistrationForBooking({
      phone,
      profissionalId,
      professionalName,
      existingClient,
      current: preservedCurrent,
    });
  }

  if (procedureName) {
    return beginDateSelection({
      phone,
      profissionalId,
      clientName,
      professionalName,
      procedureName,
      flowMode: 'book',
      activePromotionId: current?.activePromotionId || null,
      activePromotionTitle: current?.activePromotionTitle || null,
      introLine: `Agendando *${procedureName}* com a promoção *${current?.activePromotionTitle || 'especial'}*.`,
    });
  }

  return beginProcedureSelection({
    phone,
    profissionalId,
    clientName,
    professionalName,
    activePromotionId: current?.activePromotionId || null,
    activePromotionTitle: current?.activePromotionTitle || null,
    introLine: current?.activePromotionTitle
      ? `Promoção *${current.activePromotionTitle}*. Escolha o procedimento:`
      : '',
  });
}

async function beginProcedureSelection({
  phone,
  profissionalId,
  clientName,
  professionalName,
  activePromotionId = null,
  activePromotionTitle = null,
  introLine = '',
}) {
  const proceduresRaw = await listProceduresForProfessional(profissionalId);
  const procedures = proceduresRaw.map((p, idx) => ({
    pickIndex: idx + 1,
    id: p.id,
    name: p.name,
    category: p.category,
  }));

  if (!procedures.length) {
    return returnGuestOrMainMenu({
      phone,
      profissionalId,
      professionalName,
      client: { name: clientName },
      extraLine: 'No momento não há procedimentos disponíveis para agendamento online.',
    });
  }

  const preview = procedures.map((p) => `*${p.pickIndex}* — ${p.name}`).join('\n');
  const prefix = introLine ? `${introLine}\n\n` : '';

  upsertState(phone, {
    phone,
    step: 'procedure_pick',
    profissionalId,
    createdAt: Date.now(),
    clientName: String(clientName || '').trim(),
    procedureOptions: procedures,
    flowMode: 'book',
    activePromotionId: activePromotionId || null,
    activePromotionTitle: activePromotionTitle || null,
  });

    return {
      reply:
      `${prefix}Qual *procedimento* deseja agendar?\n\n` +
      `${preview}\n\n` +
      `Responda com o *número do procedimento*.\n` +
      `Digite *0* para voltar.`,
    interactive: buildProceduresList({ professionalName, procedures }),
    stateStep: 'procedure_pick',
  };
}

async function beginDateSelection({
  phone,
  profissionalId,
  clientName,
  professionalName,
  procedureName,
  flowMode = 'book',
  rescheduleAppointmentId = null,
  activePromotionId = null,
  activePromotionTitle = null,
  introLine = '',
}) {
  let excludeSlot = null;
  if (rescheduleAppointmentId) {
    try {
      const row = await getAppointmentById(rescheduleAppointmentId);
      if (row) {
        excludeSlot = {
          appointmentDate: row.appointment_date,
          appointmentTime: String(row.start_time || '').slice(0, 5),
        };
      }
    } catch (_) {
      excludeSlot = null;
    }
  }

  const { dates, slotsByDate } = await getAvailableSlotsGroupedByDate({
    professionalId: profissionalId,
    daysAhead: 14,
    maxDates: DATE_OFFER_LIMIT,
    excludeSlot,
  });

  const dateOptions = dates.map((d, idx) => ({
    pickIndex: idx + 1,
    appointmentDate: d,
    times: (slotsByDate.get(d) || []).map((t, tIdx) => ({
      pickIndex: tIdx + 1,
      appointmentDate: t.appointmentDate,
      appointmentTime: t.appointmentTime,
    })),
  }));

  if (!dateOptions.length) {
    clearState(phone);
    return await buildMenuResponse({
      client: { name: clientName },
      professionalName,
      profissionalId,
      extraLine: `Sem horários disponíveis para *${procedureName}* no momento.`,
    });
  }

  upsertState(phone, {
    phone,
    step: 'date_pick',
    profissionalId,
    createdAt: Date.now(),
    clientName: String(clientName || '').trim(),
    selectedProcedure: String(procedureName || '').trim(),
    dateOptions,
    flowMode,
    rescheduleAppointmentId: rescheduleAppointmentId || null,
    activePromotionId: activePromotionId || null,
    activePromotionTitle: activePromotionTitle || null,
  });

  return {
    reply: `${introLine ? `${introLine}\n\n` : ''}${buildDatesMessage({ dateOptions })}`,
    interactive: buildDatesList({ procedureName, dateOptions }),
    stateStep: 'date_pick',
  };
}

function beginTimeSelectionFromState({ phone, current, professionalName }) {
  const procedureName = current.selectedProcedure || 'Consulta';
  const timeOptions = current.timeOptions || [];

  upsertState(phone, {
    ...current,
    step: 'time_pick',
    createdAt: Date.now(),
  });

  return {
    reply: buildTimesMessage({
      appointmentDate: current.selectedDate,
      timeOptions,
    }),
    interactive: buildTimesList({
      procedureName,
      appointmentDate: current.selectedDate,
      timeOptions,
    }),
    stateStep: 'time_pick',
  };
}

function beginConfirmFromState({ phone, current }) {
  upsertState(phone, {
    ...current,
    step: 'confirm_booking',
    createdAt: Date.now(),
  });

  return {
    reply: buildConfirmMessage({
      procedureName: current.selectedProcedure || 'Consulta',
      appointmentDate: current.selectedDate,
      appointmentTime: current.selectedTime,
    }),
    stateStep: 'confirm_booking',
  };
}

async function beginViewConsultas({ phone, profissionalId, professionalName }) {
  const upcoming = await fetchUpcomingAppointments({ professionalId: profissionalId, phone });
  const client = await findClientByPhone({ phone, professionalId: profissionalId });

    if (!upcoming.length) {
    return await buildMenuResponse({
      client,
      professionalName,
      profissionalId,
      extraLine: 'Você não tem consultas futuras no momento.',
    });
  }

  if (upcoming.length === 1) {
    return renderConsultasListResponse({ upcoming, professionalName });
  }

  upsertState(phone, {
    phone,
    step: 'consultas_browse',
    profissionalId,
    createdAt: Date.now(),
    consultasRaw: upcoming,
  });

      return {
    reply:
      `Você tem *${upcoming.length}* consultas futuras.\n\n` +
      `Como deseja visualizar?\n\n` +
      `*1* — Mais próximas primeiro\n` +
      `*2* — Mais distantes primeiro\n` +
      `*3* — Filtrar por procedimento\n` +
      `*0* — Voltar ao menu`,
    stateStep: 'consultas_browse',
  };
}

async function beginTreatmentsFlow({ phone, profissionalId, professionalName, existingClient }) {
  if (!existingClient?.id) {
    return await buildMenuResponse({
      client: existingClient,
      professionalName,
      profissionalId,
      extraLine: 'Não encontramos tratamentos ativos no seu cadastro.',
    });
  }

  const treatmentsRaw = await listActiveTreatmentsForPatient({
    patientId: existingClient.id,
    professionalId: profissionalId,
  });

  if (!treatmentsRaw.length) {
    return await buildMenuResponse({
      client: existingClient,
      professionalName,
      profissionalId,
      extraLine: 'Você não tem tratamentos em andamento no momento.',
    });
  }

  const treatments = treatmentsRaw.map((item, idx) => ({ ...item, pickIndex: idx + 1 }));
  const preview = treatments.map((item) => `*${item.pickIndex}* — ${item.procedureName}`).join('\n');

  upsertState(phone, {
    phone,
    step: 'treatment_pick',
    profissionalId,
    createdAt: Date.now(),
    treatmentOptions: treatments,
  });

    return {
    reply:
      `Seus tratamentos em andamento:\n\n` +
      `${preview}\n\n` +
      `Responda com o *número do tratamento*.\n` +
      `Digite *0* para voltar ao menu.`,
    interactive: buildTreatmentsList({ treatments }),
    stateStep: 'treatment_pick',
  };
}

async function tryHandlePresenceResponse({ phone, profissionalId, professionalName, text }) {
  const pick = parseIndexPick(text);
  if (pick !== 1 && pick !== 2 && pick !== 3) return null;

  const pending = await findAppointmentAwaitingPresenceResponse({
    professionalId: profissionalId,
    phone,
  });
  if (!pending) return null;

  const since1h = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const hasRecent1h =
    pending.reminder_1h_sent_at && pending.reminder_1h_sent_at >= since1h;

  if (hasRecent1h) {
    const presenceEnabled = await isAppointmentPresenceConfirmationEnabled(profissionalId);
    if (!presenceEnabled) return null;
  } else if (pending.reminder_24h_sent_at) {
    const presenceEnabled = await isAppointmentPresenceConfirmation24hEnabled(profissionalId);
    if (!presenceEnabled) return null;
  } else {
    return null;
  }

  if (pick === 1) {
    await markPresenceConfirmed(pending.id);
    return {
      reply: buildPresenceConfirmedMessage({
        procedureName: procedureNameFromAppointment(pending),
        appointmentTime: pending.start_time,
        professionalName,
      }),
      stateStep: 0,
    };
  }

  await markPresenceDeclined(pending.id);

  if (pick === 2) {
    return await beginRescheduleFlow({ phone, profissionalId, professionalName });
  }

  return await beginCancelFlow({ phone, profissionalId, professionalName });
}

async function beginCancelFlow({ phone, profissionalId, professionalName }) {
  const upcoming = await fetchUpcomingAppointments({ professionalId: profissionalId, phone });
  const client = await findClientByPhone({ phone, professionalId: profissionalId });

  if (!upcoming.length) {
    return await buildMenuResponse({
      client,
      professionalName,
      profissionalId,
      extraLine: 'Você não tem consultas futuras para cancelar.',
    });
  }

    upsertState(phone, {
      phone,
    step: 'cancel_pick',
      profissionalId,
      createdAt: Date.now(),
    cancelOptions: upcoming.map((item, idx) => ({
      pickIndex: idx + 1,
      id: item.id,
      appointment_date: item.appointment_date,
      start_time: item.start_time,
      procedureName: item.procedureName,
    })),
  });

    return {
      reply:
      `Qual consulta deseja *cancelar*?\n\n` +
      `${formatAppointmentsList(upcoming)}\n\n` +
      `Responda com o *número da consulta*.\n` +
      `Digite *0* para voltar ao menu.`,
    interactive: buildCancelList({ upcoming }),
    stateStep: 'cancel_pick',
  };
}

async function beginRescheduleFlow({ phone, profissionalId, professionalName }) {
  const upcoming = await fetchUpcomingAppointments({ professionalId: profissionalId, phone });
  const client = await findClientByPhone({ phone, professionalId: profissionalId });

  if (!upcoming.length) {
    return await buildMenuResponse({
      client,
      professionalName,
      profissionalId,
      extraLine: 'Você não tem consultas futuras para reagendar.',
    });
  }

    upsertState(phone, {
      phone,
    step: 'reschedule_pick',
      profissionalId,
      createdAt: Date.now(),
    rescheduleOptions: upcoming.map((item, idx) => ({
      pickIndex: idx + 1,
      id: item.id,
      appointment_date: item.appointment_date,
      start_time: item.start_time,
      procedureName: item.procedureName,
    })),
  });

    return {
    reply:
      `Qual consulta deseja *reagendar*?\n\n` +
      `${formatAppointmentsList(upcoming)}\n\n` +
      `Responda com o *número da consulta*.\n` +
      `Digite *0* para voltar ao menu.`,
    interactive: buildRescheduleList({ upcoming }),
    stateStep: 'reschedule_pick',
  };
}

async function finalizeBooking({
  phone,
  profissionalId,
  professionalName,
  existingClient,
  current,
}) {
  const procedureName = current.selectedProcedure || 'Consulta';
  const appointmentDate = current.selectedDate;
  const appointmentTime = current.selectedTime;
  const clientName = current.clientName || existingClient?.name || '';

  let excludeSlot = null;
  if (current.flowMode === 'reschedule' && current.rescheduleAppointmentId) {
    try {
      const row = await getAppointmentById(current.rescheduleAppointmentId);
      if (row) {
        excludeSlot = {
          appointmentDate: row.appointment_date,
          appointmentTime: String(row.start_time || '').slice(0, 5),
        };
      }
    } catch (_) {
      excludeSlot = null;
    }
  }

  const booked = await isSlotBooked({
    professionalId: profissionalId,
    appointmentDate,
    appointmentTime,
    excludeSlot,
  });
  if (booked) {
    return {
      reply: 'Esse horário acabou de ser reservado. Escolha outro horário ou digite *0* para voltar.',
      stateStep: current.step,
    };
  }

  if (current.flowMode === 'reschedule' && current.rescheduleAppointmentId) {
    await updateAppointmentSchedule({
      appointmentId: current.rescheduleAppointmentId,
      appointmentDate,
      appointmentTime,
    });

    clearState(phone);
    return {
      reply: buildRescheduleConfirmedMessage({
        procedureName,
        appointmentDate: formatDateBR(appointmentDate),
        appointmentTime: formatTimeBR(appointmentTime),
        professionalName,
      }),
      stateStep: 0,
    };
  }

  const appointment = await createAppointment({
    professionalId: profissionalId,
    phone,
    clientName,
    service: procedureName,
    appointmentDate,
    appointmentTime,
  });

  let promoNote = '';
  if (current.activePromotionId) {
    const reserved = await reservePromotionForBooking({
      promotionId: current.activePromotionId,
      professionalId: profissionalId,
      phone,
      appointmentId: appointment?.id || null,
      patientId: existingClient?.id || null,
    });

    if (reserved.ok) {
      promoNote = `\n\n🎁 Promoção *${current.activePromotionTitle || 'especial'}* garantida no seu agendamento!`;
    } else if (reserved.reason === 'sold_out') {
      promoNote = `\n\n${reserved.soldOutMessage || 'Poxa, acabou a promoção 😔'} Sua consulta foi confirmada normalmente.`;
    }
  }

  clearState(phone);
    return {
      reply:
      buildBookingConfirmedMessage({
        procedureName,
        clientName,
        appointmentDate: formatDateBR(appointmentDate),
        appointmentTime: formatTimeBR(appointmentTime),
        professionalName,
      }) + promoNote,
      stateStep: 0,
    };
  }

async function handleGreeting({ phone, profissionalId, professionalName }) {
  const client = await findClientByPhone({ phone, professionalId: profissionalId });

  if (isPatientFullyRegistered(client)) {
    if (isBirthDateConfirmed(client)) {
      return await buildMenuResponse({ client, professionalName, profissionalId });
    }
    return beginBirthDateConfirmFlow({ phone, profissionalId, client });
  }

  const knownName = String(client?.name || '').trim();
  if (knownName.length >= 2) {
    return beginWelcomeMenu({
      phone,
      profissionalId,
      professionalName,
      client,
      guestName: knownName,
    });
  }

  return beginWelcomeAskName({ phone, profissionalId });
}

module.exports = {
  DATE_OFFER_LIMIT,
  HUMAN_HANDOFF_TIMEOUT_MS,
  normalizeText,
  isGreeting,
  isAgendarCommand,
  isVerConsultasCommand,
  isReagendarCommand,
  isCancelarCommand,
  isFalarProfissionalCommand,
  isPromocoesCommand,
  isFaqCommand,
  isTreatmentsCommand,
  isGuestServicosCommand,
  isGuestPromocoesCommand,
  isGuestFaqCommand,
  isGuestProfissionalCommand,
  isGuestAgendarCommand,
  isSairCommand,
  isMenuCommand,
  isIdleState,
  formatDateBR,
  formatTimeBR,
  firstNameFrom,
  enrichAppointments,
  buildDatesMessage,
  buildTimesMessage,
  buildConfirmMessage,
  formatAppointmentsList,
  sortConsultas,
  uniqueProcedureNames,
  buildConsultaDetailMessage,
  renderConsultasListResponse,
  buildMenuResponse,
  buildFarewellResponse,
  parseIndexPick,
  performHandoff,
  resolveIdleAction,
  handleRegisteredPatientIdle,
  resolveWaitAckMessage,
  listUpcomingFromMemory,
  fetchUpcomingAppointments,
  beginWelcomeMenu,
  beginWelcomeAskName,
  beginGuestServicesFlow,
  beginGuestBookingForProcedure,
  beginRegistrationForBooking,
  beginRegistrationName,
  beginRegistrationBirthDate,
  returnGuestOrMainMenu,
  beginBirthDateConfirmFlow,
  beginBirthDateUpdateFlow,
  beginFaqFlow,
  beginPromotionsFlow,
  handlePromotionSelection,
  beginBookingFromPromotion,
  beginProcedureSelection,
  beginDateSelection,
  beginTimeSelectionFromState,
  beginConfirmFromState,
  beginViewConsultas,
  beginTreatmentsFlow,
  tryHandlePresenceResponse,
  beginCancelFlow,
  beginRescheduleFlow,
  finalizeBooking,
  handleGreeting,
  getState,
  upsertState,
  clearState,
  findClientByPhone,
  createClient,
  updateClientBirthDate,
  markBirthDateConfirmed,
  isPatientFullyRegistered,
  cancelAppointmentById,
  removeAppointmentById,
  parseBirthDateInput,
  getPromotionDetailsForMenu,
  getPublicAppBaseUrl,
  buildTreatmentLinkMessage,
  buildCancelConfirmMessage,
  buildCancelConfirmedMessage,
  buildBirthDateUpdatedMessage,
  buildRegistrationRefusalMessage,
};

