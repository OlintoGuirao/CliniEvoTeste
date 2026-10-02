import { differenceInYears, format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseSalonProcedureFromNotes } from '@/components/salon/SalonProfessionalRibbonLabel';
import { PROGRAMA_BOTOX_AGENDA_PREFIX } from '@/lib/programaBotox';
import { stripSalonAppointmentMetadataFromNotes } from '@/lib/salonAppointmentNotes';
import { parseLocalDate } from '@/lib/utils';

const PROCEDURE_CONTEXT_PREFIX = 'procedure_context:';

export function formatClinicAppointmentCode(id: string): string {
  const hex = id.replace(/-/g, '');
  const slice = hex.slice(-8);
  const n = Number.parseInt(slice, 16);
  if (Number.isFinite(n)) return String(n);
  return slice.toUpperCase();
}

export function clinicProcedureLabelFromNotes(notes: string | null | undefined): string | null {
  const fromStart = parseSalonProcedureFromNotes(notes).procedure;
  if (fromStart) return fromStart;

  // Fallback: "Procedimento: …" em qualquer linha (não só no início).
  const raw = notes?.trim();
  if (!raw) return null;
  for (const line of raw.split(/\r?\n/)) {
    const match = line.trim().match(/^Procedimento:\s*(.+)$/i);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return null;
}

/** Normaliza rótulo de tipo de atendimento da agenda clínica. */
function normalizeClinicAppointmentTypeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Agendamento do tipo Avaliação (agenda clínica).
 * Usado para abrir fluxo de plano/odontograma em vez de procedimentos autorizados.
 */
export function isClinicAvaliacaoAppointment(notes: string | null | undefined): boolean {
  const raw = notes?.trim();
  if (!raw) return false;

  // Preferência: linha "Procedimento: Avaliação"
  const label = clinicProcedureLabelFromNotes(raw);
  if (label) {
    const normalized = normalizeClinicAppointmentTypeLabel(label);
    if (normalized === 'avaliacao' || normalized.startsWith('avaliacao ')) return true;
  }

  // Fallback: metadata procedure_context:avaliacao (agenda clínica)
  if (/(^|\n)\s*procedure_context:\s*avaliacao\b/i.test(raw)) return true;

  return false;
}

export function stripClinicAppointmentMetadataFromNotes(
  notes: string | null | undefined
): string | null {
  const stripped = stripSalonAppointmentMetadataFromNotes(notes);
  if (!stripped) return null;
  const userLines = stripped
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (line.startsWith(PROCEDURE_CONTEXT_PREFIX)) return false;
      if (line.startsWith(PROGRAMA_BOTOX_AGENDA_PREFIX)) return false;
      return true;
    });
  return userLines.join('\n').trim() || null;
}

export function formatPatientBirthLabel(
  dateOfBirth: string | null | undefined,
  today: Date = new Date()
): string | null {
  if (!dateOfBirth) return null;
  const birth = parseLocalDate(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const age = differenceInYears(today, birth);
  const dateLabel = format(birth, 'dd/MM/yyyy');
  return Number.isFinite(age) && age >= 0 ? `${dateLabel} (${age} anos)` : dateLabel;
}

export function formatRelativePt(iso: string | null | undefined, now: Date = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return formatDistanceToNow(d, { locale: ptBR, addSuffix: true, includeSeconds: false });
}

export function formatAppointmentDateTimeLabel(date: Date, time: string): string {
  const dateLabel = format(date, "dd/MM/yyyy");
  const timeLabel = time.slice(0, 5);
  return `Data: ${dateLabel} • Horário: ${timeLabel}`;
}
