import { parseSalonProcedureFromNotes } from '@/components/salon/SalonProfessionalRibbonLabel';
import { procedureSlugFromAppointmentNotes } from '@/lib/programaBotox';

export const SALON_PROCEDURE_ID_PREFIX = 'salon_procedure:';
export const SALON_RECURRING_SCHEDULE_PREFIX = 'salon_recurring_schedule:';

export function salonRecurringScheduleTag(scheduleId: string): string {
  return `${SALON_RECURRING_SCHEDULE_PREFIX}${scheduleId.trim()}`;
}

export function appendSalonRecurringScheduleToNotes(
  existingNotes: string | null | undefined,
  scheduleId: string
): string {
  const tag = `${SALON_RECURRING_SCHEDULE_PREFIX}${scheduleId.trim()}`;
  const base = String(existingNotes ?? '').trim();
  if (!base) return tag;
  if (base.split(/\r?\n/).some((line) => line.trim().startsWith(SALON_RECURRING_SCHEDULE_PREFIX))) {
    return base;
  }
  return `${base}\n${tag}`;
}

export function buildSalonAppointmentNotesForBooking(params: {
  procedureName: string;
  procedureId: string;
  scheduleId?: string | null;
  extraNotes?: string | null;
}): string {
  const procLine = `Procedimento: ${params.procedureName.trim()}`;
  let notes = appendSalonProcedureIdToNotes(procLine, params.procedureId);
  if (params.scheduleId) {
    notes = appendSalonRecurringScheduleToNotes(notes, params.scheduleId);
  }
  const extra = String(params.extraNotes ?? '').trim();
  if (extra) {
    notes = notes ? `${notes}\n${extra}` : extra;
  }
  return notes;
}

export function appendSalonProcedureIdToNotes(
  existingNotes: string | null | undefined,
  procedureId: string
): string {
  const tag = `${SALON_PROCEDURE_ID_PREFIX}${procedureId.trim()}`;
  const base = String(existingNotes ?? '').trim();
  if (!base) return tag;
  if (base.split(/\r?\n/).some((line) => line.trim().startsWith(SALON_PROCEDURE_ID_PREFIX))) {
    return base;
  }
  return `${base}\n${tag}`;
}

export function salonProcedureIdFromAppointmentNotes(
  notes: string | null | undefined
): string | null {
  if (!notes) return null;
  for (const raw of String(notes).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith(SALON_PROCEDURE_ID_PREFIX)) continue;
    const id = line.slice(SALON_PROCEDURE_ID_PREFIX.length).trim();
    if (/^[0-9a-f-]{36}$/i.test(id)) return id;
  }
  return null;
}

/** IDs de procedimentos do salão registrados na sessão (observações). */
export function salonProcedureIdsFromObservacoes(
  observacoes: string | null | undefined
): string[] {
  if (!observacoes) return [];
  const ids: string[] = [];
  for (const raw of String(observacoes).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith(SALON_PROCEDURE_ID_PREFIX)) continue;
    const id = line.slice(SALON_PROCEDURE_ID_PREFIX.length).trim();
    if (/^[0-9a-f-]{36}$/i.test(id)) ids.push(id);
  }
  return ids;
}

export function salonProcedureNameFromAppointmentNotes(
  notes: string | null | undefined
): string | null {
  return parseSalonProcedureFromNotes(notes ?? null).procedure;
}

/** Monta rota de consulta/atendimento com procedimento vinculado ao agendamento. */
export function buildConsultationHrefFromAppointment(opts: {
  patientId?: string | null;
  notes?: string | null;
  procedureSlug?: string | null;
  appointmentId?: string | null;
}): string {
  const slug = opts.procedureSlug ?? procedureSlugFromAppointmentNotes(opts.notes ?? null);
  const salonId = salonProcedureIdFromAppointmentNotes(opts.notes ?? null);
  const salonName = salonProcedureNameFromAppointmentNotes(opts.notes ?? null);

  const params = new URLSearchParams();
  if (slug) params.set('procedure', slug);
  else if (salonId) params.set('salonProcedure', salonId);
  else if (salonName) params.set('salonProcedureName', salonName);
  if (opts.appointmentId) params.set('appointmentId', opts.appointmentId);

  const q = params.toString();
  if (opts.patientId) return `/consultation/${opts.patientId}${q ? `?${q}` : ''}`;
  return `/consultation${q ? `?${q}` : ''}`;
}

/** Profissional da clínica: inicia atendimento nos planos odontológicos do paciente. */
export function buildClinicProfessionalAttendanceHref(patientId: string): string {
  return `/patients/${patientId}?tab=planos-odontologicos`;
}

/** Href de início conforme o tipo de conta (clínica → planos odontológicos). */
export function buildAttendanceStartHrefFromAppointment(opts: {
  patientId?: string | null;
  notes?: string | null;
  procedureSlug?: string | null;
  appointmentId?: string | null;
  isClinicAccount?: boolean;
}): string {
  if (opts.isClinicAccount && opts.patientId) {
    return buildClinicProfessionalAttendanceHref(opts.patientId);
  }
  return buildConsultationHrefFromAppointment(opts);
}

export function appendSalonProcedureQueryParams(
  params: URLSearchParams,
  opts: {
    notes?: string | null;
    procedureSlug?: string | null;
    appointmentId?: string | null;
  }
): void {
  const slug = opts.procedureSlug ?? procedureSlugFromAppointmentNotes(opts.notes ?? null);
  const salonId = salonProcedureIdFromAppointmentNotes(opts.notes ?? null);
  const salonName = salonProcedureNameFromAppointmentNotes(opts.notes ?? null);

  if (slug) params.set('procedure', slug);
  else if (salonId) params.set('salonProcedure', salonId);
  else if (salonName) params.set('salonProcedureName', salonName);
  if (opts.appointmentId) params.set('appointmentId', opts.appointmentId);
}

/** Observações legíveis na agenda/ficha (remove metadados técnicos). */
export function stripSalonAppointmentMetadataFromNotes(
  notes: string | null | undefined
): string | null {
  if (!notes?.trim()) return null;
  const userLines: string[] = [];
  for (const raw of notes.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^Procedimento:/i.test(line)) continue;
    if (line.startsWith(SALON_PROCEDURE_ID_PREFIX)) continue;
    if (line.startsWith(SALON_RECURRING_SCHEDULE_PREFIX)) continue;
    userLines.push(line);
  }
  return userLines.join('\n').trim() || null;
}

/** Observações legíveis na ficha (remove metadados de procedimento/valor). */
export function formatSalonSessionNotesForDisplay(notes: string | null | undefined): {
  userNotes: string | null;
  valorLine: string | null;
} {
  if (!notes?.trim()) return { userNotes: null, valorLine: null };
  let valorLine: string | null = null;
  const userLines: string[] = [];
  for (const raw of notes.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^Procedimento:/i.test(line)) continue;
    if (line.startsWith(SALON_PROCEDURE_ID_PREFIX)) continue;
    if (line.startsWith(SALON_RECURRING_SCHEDULE_PREFIX)) continue;
    const valorMatch = line.match(/^Valor:\s*(.+)$/i);
    if (valorMatch) {
      if (!valorLine) valorLine = valorMatch[1]?.trim() || null;
      continue;
    }
    userLines.push(line);
  }
  const userNotes = userLines.join('\n').trim() || null;
  return { userNotes, valorLine };
}
