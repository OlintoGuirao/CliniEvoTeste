const { formatDateBRFromYmd, formatWeekdayNameBRFromYmd } = require('../utils/time');
const { extractProcedureFromNotes } = require('./appointmentNotes');

const DEFAULT_APPOINTMENT_REMINDER_24H_MESSAGE =
  'Olá, {{nome}}! 😊\n\n' +
  'Lembrete: você tem {{consulta}} {{data}} {{horario}} com *{{profissional}}*.\n\n' +
  'Até lá! 💚';

const DEFAULT_APPOINTMENT_REMINDER_1H_MESSAGE =
  'Olá, {{nome}}! ⏰\n\n' +
  'Você tem {{consulta}} *hoje* {{horario}} (dia {{data}}) com *{{profissional}}*.\n\n' +
  'Aguardamos você! 💚';

function firstNameFrom(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || '';
}

function isTomorrowBR(appointmentDate) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const tomorrow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return appointmentDate === tomorrow;
}

function formatDateLabel(appointmentDate) {
  const br = formatDateBRFromYmd(appointmentDate);
  if (isTomorrowBR(appointmentDate)) return `amanhã dia (${br})`;
  return `dia (${br})`;
}

function isGenericProcedureLabel(procedureName) {
  const lower = String(procedureName || '')
    .trim()
    .toLowerCase();
  if (!lower) return true;
  return (
    lower === 'consulta' ||
    lower === 'sua consulta' ||
    lower === 'atendimento' ||
    lower === 'seu atendimento'
  );
}

function hasCustomObservation(procedureName) {
  return !isGenericProcedureLabel(procedureName);
}

/** Sem observação: "uma *Consulta*" / "um *Atendimento*". Com observação: "… de *Nome*". */
function formatConsultaPhrase(procedureName, options = {}) {
  const isSalon = Boolean(options.isSalon);
  const defaultLabel = isSalon ? 'Atendimento' : 'Consulta';
  const proc = String(procedureName || '').trim() || defaultLabel;
  if (!hasCustomObservation(proc)) {
    return isSalon ? 'um *Atendimento*' : 'uma *Consulta*';
  }
  return isSalon ? `um atendimento de *${proc}*` : `uma consulta de *${proc}*`;
}

function formatHorarioLabel(startTime, endTime) {
  const start = String(startTime || '').slice(0, 5);
  const end = String(endTime || '').slice(0, 5);
  if (start && end && end !== start) {
    return `das ${start} às ${end}`;
  }
  return `às ${start}`;
}

function normalizeReminderTemplate(template, hasRange) {
  let base = String(template || '').trim() || DEFAULT_APPOINTMENT_REMINDER_24H_MESSAGE;
  if (hasRange) {
    // Templates antigos com "às *{{hora}}*" passam a usar o intervalo completo.
    base = base.replace(/às\s*\*\{\{hora\}\}\*/gi, '{{horario}}');
    base = base.replace(/às\s*\{\{hora\}\}/gi, '{{horario}}');
  }
  // Templates antigos com "consulta de *{{procedimento}}*" → frase com/sem observação.
  base = base.replace(/uma\s+consulta\s+de\s*\*\{\{procedimento\}\}\*/gi, '{{consulta}}');
  base = base.replace(/um\s+atendimento\s+de\s*\*\{\{procedimento\}\}\*/gi, '{{consulta}}');
  base = base.replace(/consulta\s+de\s*\*\{\{procedimento\}\}\*/gi, '{{consulta}}');
  base = base.replace(/atendimento\s+de\s*\*\{\{procedimento\}\}\*/gi, '{{consulta}}');
  return base;
}

function normalizeWhatsappMarkers(text) {
  let s = String(text || '');
  const slots = [];
  s = s.replace(/\{\{\s*[a-z0-9_]+\s*\}\}/gi, (m) => {
    const i = slots.length;
    slots.push(m);
    return `\uE000${i}\uE000`;
  });
  s = s.replace(/\*\s*([^*\n]+?)\s*\*/g, (_m, inner) => `*${String(inner).trim()}*`);
  s = s.replace(/_\s*([^_\n]+?)\s*_/g, (_m, inner) => `_${String(inner).trim()}_`);
  s = s.replace(/~\s*([^~\n]+?)\s*~/g, (_m, inner) => `~${String(inner).trim()}~`);
  return s.replace(/\uE000(\d+)\uE000/g, (_m, i) => slots[Number(i)] ?? '');
}

function collapseNestedWhatsappMarkers(text) {
  let s = String(text || '');
  const collapseOne = (marker) => {
    const esc = marker === '*' ? '\\*' : `\\${marker}`;
    const re = new RegExp(`${esc}([^${marker}\\n]*(?:${esc}[^${marker}\\n]*)+)${esc}`, 'g');
    return s.replace(re, (full) => {
      const inner = full.slice(1, -1).split(marker).join('');
      return `${marker}${inner.trim()}${marker}`;
    });
  };
  for (let i = 0; i < 6; i += 1) {
    const prev = s;
    s = collapseOne('*');
    s = collapseOne('_');
    s = collapseOne('~');
    s = s.replace(/(\*[^*\n]+\*)\*+/g, '$1');
    s = s.replace(/\*+(\*[^*\n]+\*)/g, '$1');
    if (s === prev) break;
  }
  return s;
}

function applyReminderTemplate(template, vars) {
  const base = String(template || '').trim() || DEFAULT_APPOINTMENT_REMINDER_24H_MESSAGE;
  return collapseNestedWhatsappMarkers(
    normalizeWhatsappMarkers(
      base
        .replace(/\{\{nome\}\}/gi, vars.primeiroNome)
        .replace(/\{\{primeiro_nome\}\}/gi, vars.primeiroNome)
        .replace(/\{\{nome_completo\}\}/gi, vars.nomeCompleto)
        .replace(/\{\{consulta\}\}/gi, vars.consulta)
        .replace(/\{\{procedimento\}\}/gi, vars.procedimento)
        .replace(/\{\{dia\}\}/gi, vars.dia || '')
        .replace(/\{\{dia_semana\}\}/gi, vars.dia || '')
        .replace(/\{\{data\}\}/gi, vars.data)
        .replace(/\{\{horario\}\}/gi, vars.horario)
        .replace(/\{\{hora\}\}/gi, vars.hora)
        .replace(/\{\{hora_fim\}\}/gi, vars.horaFim || vars.hora)
        .replace(/\{\{profissional\}\}/gi, vars.profissional)
        .replace(/\{\{nome_salao\}\}/gi, vars.nomeSalao || vars.profissional)
        .replace(/\{\{clinica\}\}/gi, vars.nomeSalao || vars.profissional)
    )
  );
}

function appendPresenceConfirmationPrompt(message, template) {
  const base = String(message || '').trimEnd();
  const prompt =
    String(template || '').trim() ||
    'Confirme sua presença:\n\n' +
      '*1* — Confirmo minha presença\n' +
      '*2* — Preciso reagendar\n' +
      '*3* — Preciso cancelar\n\n' +
      'Aguardamos você! 💚';
  return `${base}\n\n${prompt}`;
}

const PRESENCE_CONFIRMATION_PLACEHOLDER_RE = /\{\{\s*confirmacao_presenca\s*\}\}/gi;

/**
 * Insere o bloco de confirmação onde estiver {{confirmacao_presenca}}.
 * Se o placeholder não existir, acrescenta no final (comportamento antigo).
 * Se withConfirmation for false, remove o placeholder sem inserir texto.
 */
function applyPresenceConfirmation(message, presenceConfirmationTemplate, withConfirmation) {
  const raw = String(message || '');
  const hasPlaceholder = PRESENCE_CONFIRMATION_PLACEHOLDER_RE.test(raw);
  PRESENCE_CONFIRMATION_PLACEHOLDER_RE.lastIndex = 0;

  if (!withConfirmation) {
    return raw
      .replace(PRESENCE_CONFIRMATION_PLACEHOLDER_RE, '')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd();
  }

  const prompt =
    String(presenceConfirmationTemplate || '').trim() ||
    'Confirme sua presença:\n\n' +
      '*1* — Confirmo minha presença\n' +
      '*2* — Preciso reagendar\n' +
      '*3* — Preciso cancelar\n\n' +
      'Aguardamos você! 💚';

  if (hasPlaceholder) {
    return raw
      .replace(PRESENCE_CONFIRMATION_PLACEHOLDER_RE, prompt)
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd();
  }

  return appendPresenceConfirmationPrompt(raw, prompt);
}

function resolveProcedureLabel(procedureName, isSalon) {
  const defaultLabel = isSalon ? 'Atendimento' : 'Consulta';
  const proc = String(procedureName || '').trim();
  if (!proc || isGenericProcedureLabel(proc)) return defaultLabel;
  return proc;
}

function buildAppointmentReminder24hMessage({
  patientName,
  procedureName,
  appointmentDate,
  appointmentTime,
  appointmentEndTime,
  professionalName,
  salonName,
  isSalon,
  template,
  withPresenceConfirmation,
  presenceConfirmationTemplate,
}) {
  const nomeCompleto = String(patientName || '').trim() || 'Paciente';
  const primeiroNome = firstNameFrom(nomeCompleto) || 'tudo bem';
  const dateLabel = formatDateLabel(appointmentDate);
  const dia = formatWeekdayNameBRFromYmd(appointmentDate);
  const start = String(appointmentTime || '').slice(0, 5);
  const end = String(appointmentEndTime || '').slice(0, 5);
  const hasRange = Boolean(end && end !== start);
  const horario = formatHorarioLabel(start, hasRange ? end : null);
  const salon = Boolean(isSalon);
  const proc = resolveProcedureLabel(procedureName, salon);
  const consulta = formatConsultaPhrase(proc, { isSalon: salon });
  const prof = String(professionalName || 'profissional').trim();
  const salao = String(salonName || prof).trim() || prof;

  const resolvedTemplate = normalizeReminderTemplate(template, hasRange);

  let message = applyReminderTemplate(resolvedTemplate, {
    primeiroNome,
    nomeCompleto,
    consulta,
    procedimento: proc,
    dia,
    data: dateLabel,
    horario,
    hora: hasRange ? `${start} às ${end}` : start,
    horaFim: hasRange ? end : start,
    profissional: prof,
    nomeSalao: salao,
  });

  message = applyPresenceConfirmation(
    message,
    presenceConfirmationTemplate,
    withPresenceConfirmation
  );

  return message;
}

function procedureNameFromAppointment(row, options = {}) {
  const extracted = extractProcedureFromNotes(row?.notes);
  return resolveProcedureLabel(extracted, Boolean(options.isSalon));
}

function buildAppointmentReminder1hMessage({
  patientName,
  procedureName,
  appointmentDate,
  appointmentTime,
  appointmentEndTime,
  professionalName,
  salonName,
  isSalon,
  template,
  withPresenceConfirmation,
  presenceConfirmationTemplate,
}) {
  const firstName = firstNameFrom(patientName) || 'tudo bem';
  const nomeCompleto = String(patientName || '').trim() || firstName;
  const dateLabel = formatDateBRFromYmd(appointmentDate);
  const dia = formatWeekdayNameBRFromYmd(appointmentDate);
  const start = String(appointmentTime || '').slice(0, 5);
  const end = String(appointmentEndTime || '').slice(0, 5);
  const hasRange = Boolean(end && end !== start);
  const horario = formatHorarioLabel(start, hasRange ? end : null);
  const salon = Boolean(isSalon);
  const proc = resolveProcedureLabel(procedureName, salon);
  const consulta = formatConsultaPhrase(proc, { isSalon: salon });
  const prof = String(professionalName || 'profissional').trim();
  const salao = String(salonName || prof).trim() || prof;

  const rawTemplate = String(template || '').trim() || DEFAULT_APPOINTMENT_REMINDER_1H_MESSAGE;
  let message = applyReminderTemplate(normalizeReminderTemplate(rawTemplate, hasRange), {
    primeiroNome: firstName,
    nomeCompleto,
    consulta,
    procedimento: proc,
    dia,
    data: dateLabel,
    horario,
    hora: hasRange ? `${start} às ${end}` : start,
    horaFim: hasRange ? end : start,
    profissional: prof,
    nomeSalao: salao,
  });

  message = applyPresenceConfirmation(
    message,
    presenceConfirmationTemplate,
    withPresenceConfirmation
  );

  return message;
}

function buildPresenceConfirmedMessage({ procedureName, appointmentTime, appointmentEndTime, professionalName }) {
  const start = String(appointmentTime || '').slice(0, 5);
  const end = String(appointmentEndTime || '').slice(0, 5);
  const hasRange = Boolean(end && end !== start);
  const horario = hasRange ? `das ${start} às ${end}` : `às ${start}`;
  return (
    `Presença confirmada! ✅\n\n` +
    `Consulta: *${procedureName || 'Consulta'}* ${horario}\n` +
    `Equipe *${String(professionalName || 'da clínica').trim()}*\n\n` +
    `Até já! 💚`
  );
}

function buildPresenceDeclinedMessage(professionalName) {
  return (
    `Sem problemas! Para *cancelar* ou *reagendar*, envie *oi* e escolha a opção *3* ou *4* do menu.\n\n` +
    `Ou digite *5* para falar com a equipe da *${String(professionalName || 'clínica').trim()}*.`
  );
}

module.exports = {
  DEFAULT_APPOINTMENT_REMINDER_24H_MESSAGE,
  DEFAULT_APPOINTMENT_REMINDER_1H_MESSAGE,
  formatHorarioLabel,
  formatConsultaPhrase,
  appendPresenceConfirmationPrompt,
  applyPresenceConfirmation,
  buildAppointmentReminder24hMessage,
  buildAppointmentReminder1hMessage,
  buildPresenceConfirmedMessage,
  buildPresenceDeclinedMessage,
  procedureNameFromAppointment,
};
