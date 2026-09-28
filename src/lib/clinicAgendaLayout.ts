import {
  resolveClinicAppointmentStatus,
  type ClinicAppointmentStatus,
} from '@/lib/clinicAppointmentStatus';
import { clinicProcedureLabelFromNotes } from '@/lib/clinicAppointmentDetails';

export const CLINIC_AGENDA_SLOT_MINUTES = 30;

export type ClinicAgendaLayoutAppointment = {
  id: string;
  patient_id: string | null;
  full_name: string | null;
  notes: string | null;
  appointment_date: string;
  start_time: string;
  is_encaixe?: boolean;
  appointment_block_id?: string | null;
  is_block_start?: boolean;
  professional_id?: string;
  patients?: { full_name?: string } | null;
  clinic_status?: string | null;
  presence_confirmed_at?: string | null;
};

export type ClinicProcedureAccent = {
  key: string;
  cardClassName: string;
  barClassName: string;
  timeClassName: string;
};

const ACCENTS: ClinicProcedureAccent[] = [
  {
    key: 'blue',
    cardClassName: 'bg-blue-50 border-blue-100 text-blue-950',
    barClassName: 'border-l-blue-500',
    timeClassName: 'text-blue-700/80',
  },
  {
    key: 'green',
    cardClassName: 'bg-emerald-50 border-emerald-100 text-emerald-950',
    barClassName: 'border-l-emerald-500',
    timeClassName: 'text-emerald-700/80',
  },
  {
    key: 'sky',
    cardClassName: 'bg-sky-50 border-sky-100 text-sky-950',
    barClassName: 'border-l-sky-500',
    timeClassName: 'text-sky-700/80',
  },
  {
    key: 'violet',
    cardClassName: 'bg-violet-50 border-violet-100 text-violet-950',
    barClassName: 'border-l-violet-500',
    timeClassName: 'text-violet-700/80',
  },
  {
    key: 'orange',
    cardClassName: 'bg-orange-50 border-orange-100 text-orange-950',
    barClassName: 'border-l-orange-500',
    timeClassName: 'text-orange-700/80',
  },
];

const CANCELLED_STATUSES = new Set<ClinicAppointmentStatus>([
  'cancelled_by_professional',
  'cancelled_by_patient',
  'no_show',
  'rescheduled',
]);

export function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const [h, m] = String(value).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function minutesToTime(min: number): string {
  const normalized = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function addMinutesToTime(time: string, minutes: number): string {
  const start = timeToMinutes(time);
  if (start == null) return time.slice(0, 5);
  return minutesToTime(start + minutes);
}

export function clinicTimeRangeLabel(
  start: string,
  minutes = CLINIC_AGENDA_SLOT_MINUTES
): string {
  const from = start.length >= 5 ? start.slice(0, 5) : start;
  return `${from} - ${addMinutesToTime(from, minutes)}`;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function clinicProcedureAccent(procedure: string | null | undefined): ClinicProcedureAccent {
  const key = String(procedure ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (!key.trim()) return ACCENTS[0]!;
  if (/(botox|toxina)/.test(key)) return ACCENTS[0]!;
  if (/(emagrec|medida|peso)/.test(key)) return ACCENTS[1]!;
  if (/(preench|acido|ácido)/.test(key)) return ACCENTS[3]!;
  if (/laser/.test(key)) return ACCENTS[4]!;
  return ACCENTS[hashString(key) % ACCENTS.length]!;
}

export function formatClinicPatientName(name: string): string {
  const s = name.trim();
  if (s.length < 3) return s;
  const compact = s.replace(/\s/g, '');
  if (compact.length < 3 || compact !== compact.toUpperCase()) return s;
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function clinicAppointmentPatientName(appointment: ClinicAgendaLayoutAppointment): string {
  const raw = appointment.patient_id
    ? appointment.patients?.full_name ?? 'Paciente'
    : appointment.full_name ?? 'Pré-cadastro';
  return formatClinicPatientName(raw);
}

export function clinicAppointmentProcedureLabel(
  appointment: ClinicAgendaLayoutAppointment
): string | null {
  return clinicProcedureLabelFromNotes(appointment.notes);
}

export function clinicAppointmentResolvedStatus(
  appointment: ClinicAgendaLayoutAppointment
): ClinicAppointmentStatus {
  return resolveClinicAppointmentStatus({
    clinicStatus: appointment.clinic_status,
    presenceConfirmedAt: appointment.presence_confirmed_at,
  });
}

export function isClinicPendingAppointment(appointment: ClinicAgendaLayoutAppointment): boolean {
  return clinicAppointmentResolvedStatus(appointment) === 'to_confirm';
}

export function isClinicConfirmedAppointment(appointment: ClinicAgendaLayoutAppointment): boolean {
  const status = clinicAppointmentResolvedStatus(appointment);
  return status === 'confirmed' || status === 'confirmed_by_patient';
}

export function isClinicActiveAppointment(appointment: ClinicAgendaLayoutAppointment): boolean {
  return !CANCELLED_STATUSES.has(clinicAppointmentResolvedStatus(appointment));
}

export type ClinicDaySummary = {
  confirmed: number;
  pending: number;
  free: number;
};

export function clinicDaySummary(params: {
  appointments: ClinicAgendaLayoutAppointment[];
  timeSlots: string[];
  isBookable: (time: string) => boolean;
}): ClinicDaySummary {
  const confirmed = params.appointments.filter(isClinicConfirmedAppointment).length;
  const pending = params.appointments.filter(isClinicPendingAppointment).length;
  const free = params.timeSlots.filter((time) => params.isBookable(time)).length;
  return { confirmed, pending, free };
}

export function clinicNextFreeTimes(
  timeSlots: string[],
  isBookable: (time: string) => boolean,
  limit = 5
): string[] {
  return timeSlots.filter(isBookable).slice(0, limit);
}
