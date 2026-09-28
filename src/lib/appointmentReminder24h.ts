import { collapseNestedWhatsappMarkers, normalizeWhatsappMarkers } from '@/lib/whatsappFormatting';

/** Template padrão do lembrete automático 24h (igual ao texto atual do backend). */
export const DEFAULT_APPOINTMENT_REMINDER_24H_MESSAGE =
  'Olá, {{nome}}! 😊\n\n' +
  'Lembrete: você tem {{consulta}} {{data}} {{horario}} com *{{profissional}}*.\n\n' +
  'Até lá! 💚';

function formatHorarioLabel(startTime: string, endTime?: string | null): string {
  const start = (startTime || '').slice(0, 5);
  const end = (endTime || '').slice(0, 5);
  if (start && end && end !== start) {
    return `das ${start} às ${end}`;
  }
  return `às ${start}`;
}

function isGenericProcedureLabel(procedureName: string): boolean {
  const lower = procedureName.trim().toLowerCase();
  if (!lower) return true;
  return (
    lower === 'consulta' ||
    lower === 'sua consulta' ||
    lower === 'atendimento' ||
    lower === 'seu atendimento'
  );
}

function formatConsultaPhrase(procedureName: string, isSalon = false): string {
  const defaultLabel = isSalon ? 'Atendimento' : 'Consulta';
  const proc = procedureName.trim() || defaultLabel;
  if (isGenericProcedureLabel(proc)) {
    return isSalon ? 'um *Atendimento*' : 'uma *Consulta*';
  }
  return isSalon ? `um atendimento de *${proc}*` : `uma consulta de *${proc}*`;
}

export function buildAppointmentReminder24hPreview(
  template: string,
  vars: {
    nome?: string;
    procedimento?: string;
    dia?: string;
    data?: string;
    hora?: string;
    horaFim?: string;
    profissional?: string;
    nomeSalao?: string;
    isSalon?: boolean;
  } = {}
): string {
  const isSalon = Boolean(vars.isSalon);
  const nomeCompleto = (vars.nome || 'Maria Silva').trim() || 'Paciente';
  const primeiroNome = nomeCompleto.split(/\s+/)[0] || nomeCompleto;
  const defaultProc = isSalon ? 'Atendimento' : 'Consulta';
  const rawProc = (vars.procedimento || defaultProc).trim() || defaultProc;
  const procedimento = isGenericProcedureLabel(rawProc) ? defaultProc : rawProc;
  const consulta = formatConsultaPhrase(procedimento, isSalon);
  const dia = (vars.dia || 'sexta-feira').trim() || 'sexta-feira';
  const data = (vars.data || 'amanhã dia (14/08/2026)').trim();
  const start = (vars.hora || '10:30').trim().slice(0, 5);
  const end = (vars.horaFim || '').trim().slice(0, 5);
  const hasRange = Boolean(end && end !== start);
  const horario = formatHorarioLabel(start, hasRange ? end : null);
  const profissional = (vars.profissional || (isSalon ? 'Ana' : 'Dra. Ana')).trim() || 'Profissional';
  const nomeSalao = (vars.nomeSalao || (isSalon ? 'Salão Aura' : profissional)).trim() || profissional;
  let base = template.trim() || DEFAULT_APPOINTMENT_REMINDER_24H_MESSAGE;
  if (hasRange) {
    base = base.replace(/às\s*\*\{\{hora\}\}\*/gi, '{{horario}}');
    base = base.replace(/às\s*\{\{hora\}\}/gi, '{{horario}}');
  }
  base = base.replace(/uma\s+consulta\s+de\s*\*\{\{procedimento\}\}\*/gi, '{{consulta}}');
  base = base.replace(/um\s+atendimento\s+de\s*\*\{\{procedimento\}\}\*/gi, '{{consulta}}');
  base = base.replace(/consulta\s+de\s*\*\{\{procedimento\}\}\*/gi, '{{consulta}}');
  base = base.replace(/atendimento\s+de\s*\*\{\{procedimento\}\}\*/gi, '{{consulta}}');

  return collapseNestedWhatsappMarkers(
    normalizeWhatsappMarkers(
      base
        .replace(/\{\{nome\}\}/gi, primeiroNome)
        .replace(/\{\{primeiro_nome\}\}/gi, primeiroNome)
        .replace(/\{\{nome_completo\}\}/gi, nomeCompleto)
        .replace(/\{\{consulta\}\}/gi, consulta)
        .replace(/\{\{procedimento\}\}/gi, procedimento)
        .replace(/\{\{dia\}\}/gi, dia)
        .replace(/\{\{dia_semana\}\}/gi, dia)
        .replace(/\{\{data\}\}/gi, data)
        .replace(/\{\{horario\}\}/gi, horario)
        .replace(/\{\{hora\}\}/gi, hasRange ? `${start} às ${end}` : start)
        .replace(/\{\{hora_fim\}\}/gi, hasRange ? end : start)
        .replace(/\{\{profissional\}\}/gi, profissional)
        .replace(/\{\{nome_salao\}\}/gi, nomeSalao)
        .replace(/\{\{clinica\}\}/gi, nomeSalao)
    )
  );
}

/** Espelha o append do backend (appointmentReminderMessage.js). */
export const DEFAULT_PRESENCE_CONFIRMATION_PROMPT =
  'Confirme sua presença:\n\n' +
  '*1* — Confirmo minha presença\n' +
  '*2* — Preciso reagendar\n' +
  '*3* — Preciso cancelar\n\n' +
  'Aguardamos você! 💚';

/** @deprecated use DEFAULT_PRESENCE_CONFIRMATION_PROMPT */
export const PRESENCE_CONFIRMATION_PROMPT_TEXT = DEFAULT_PRESENCE_CONFIRMATION_PROMPT;

export function resolvePresenceConfirmationPrompt(template?: string | null): string {
  const trimmed = String(template || '').trim();
  return trimmed || DEFAULT_PRESENCE_CONFIRMATION_PROMPT;
}

export function appendPresenceConfirmationPrompt(
  message: string,
  template?: string | null
): string {
  const base = String(message || '').trimEnd();
  return `${base}\n\n${resolvePresenceConfirmationPrompt(template)}`;
}

const PRESENCE_CONFIRMATION_PLACEHOLDER_RE = /\{\{\s*confirmacao_presenca\s*\}\}/gi;

/**
 * Insere o bloco de confirmação onde estiver {{confirmacao_presenca}}.
 * Sem o placeholder, acrescenta no final. Sem confirmação ativa, remove o placeholder.
 */
export function applyPresenceConfirmation(
  message: string,
  presenceConfirmationTemplate?: string | null,
  withConfirmation = true
): string {
  const raw = String(message || '');
  const hasPlaceholder = PRESENCE_CONFIRMATION_PLACEHOLDER_RE.test(raw);
  PRESENCE_CONFIRMATION_PLACEHOLDER_RE.lastIndex = 0;

  if (!withConfirmation) {
    return raw
      .replace(PRESENCE_CONFIRMATION_PLACEHOLDER_RE, '')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd();
  }

  const prompt = resolvePresenceConfirmationPrompt(presenceConfirmationTemplate);

  if (hasPlaceholder) {
    return raw
      .replace(PRESENCE_CONFIRMATION_PLACEHOLDER_RE, prompt)
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd();
  }

  return appendPresenceConfirmationPrompt(raw, prompt);
}
