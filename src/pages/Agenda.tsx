import { useEffect, useState, useMemo, useRef, useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePatients } from '@/hooks/usePatients';
import { useSalonAccount } from '@/hooks/use-salon-account';
import { useUiCopy } from '@/hooks/use-ui-copy';
import { queryKeys, patientsListKey } from '@/api/queryKeys';
import { fetchPatients } from '@/api/patients';
import { normalizePhoneDigits, formatPhoneDisplay, findExistingPatientByPhone, findPatientByPhoneAndName } from '@/lib/phone';
import { formatPatientDisplayName, patientMatchesSearch } from '@/lib/patientDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Calendar as DateCalendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  CalendarDays,
  UserPlus,
  ChevronsUpDown,
  ArrowLeft,
  Search,
  Bell,
  Loader2,
  Pin,
  Eye,
  Plus,
  Pencil,
  Wallet,
} from 'lucide-react';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { PageLoading } from '@/components/layout/PageLoading';
import { MobileBottomSafeSpacer } from '@/components/layout/mobile';
import { cn } from '@/lib/utils';
import { format, addDays, startOfWeek, startOfMonth, isSameDay, parseISO, startOfDay } from 'date-fns';
import {
  type ClinicAgendaView,
  clinicAgendaFetchRange,
  clinicAgendaVisibleDays,
  persistClinicAgendaView,
  readClinicAgendaView,
  shiftClinicAgendaAnchor,
  stepToWorkingDay,
} from '@/lib/clinicAgendaView';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { appendProcedureContextToNotes } from '@/lib/programaBotox';
import {
  fetchProfessionalUiSettings,
  type VacationPeriod,
  type ClinicClosedDay,
} from '@/services/api/dynamicProcedureFieldSettingsApi';
import { getLunchBreaksFromProfile, getLunchBreakLabelForTime, isTimeInLunchBreaks } from '@/lib/lunchBreaks';
import {
  DEFAULT_CLINIC_CLOSED_NOTE,
  getClinicClosedDayForDate,
  isClinicClosedOnDay,
} from '@/lib/clinicClosedDays';
import {
  fetchLaserUnavailablePeriods,
  getLaserBlockForDay,
  laserBlockLabel,
  type LaserUnavailablePeriod,
} from '@/lib/depilacaoLaser';
import { isDepilacaoLaserModuleEnabled } from '@/lib/professionalModules';
import { isClinicOnlyAccount, isSalonAccount } from '@/lib/accountType';
import {
  ClinicPatientSearchEmpty,
  ClinicQuickPatientDialog,
} from '@/components/clinic/ClinicQuickPatientDialog';
import { ClinicAgendaBookingFields } from '@/components/clinic/ClinicAgendaBookingFields';
import { ClinicAppointmentDetailsDialog } from '@/components/clinic/ClinicAppointmentDetailsDialog';
import { ClinicAgendaBoard } from '@/components/clinic/ClinicAgendaBoard';
import {
  clinicProcedureLabelFromNotes,
  stripClinicAppointmentMetadataFromNotes,
} from '@/lib/clinicAppointmentDetails';
import { useClinicMemberRole } from '@/hooks/use-clinic-member-role';
import { useClinicMaster } from '@/hooks/use-clinic-master';
import {
  CLINIC_AGENDA_APPOINTMENT_TYPES,
  fetchClinicAgendaProfessionals,
  type ClinicAgendaStatus,
} from '@/lib/clinicAgendaBooking';
import {
  clinicAppointmentStatusOption,
  clinicStatusWritePayload,
  DEFAULT_CLINIC_APPOINTMENT_STATUS,
  resolveClinicAppointmentStatus,
} from '@/lib/clinicAppointmentStatus';
import { completedAppointmentKey, isAppointmentCompleted } from '@/lib/dashboardHelpers';
import { salonAgendaSlotStyle, salonStaffRoleLabel, salonRibbonPalette } from '@/lib/salonTeamRoles';
import {
  fetchSalonAgendaTeamMembers,
  isSalonAgendaBookableMember,
  mapSalonAgendaProfessional,
  salonAgendaTeamQueryKey,
  sortSalonAgendaMembers,
} from '@/lib/salonAgendaProfessionals';
import { appendSalonProcedureIdToNotes, formatSalonSessionNotesForDisplay, salonProcedureNameFromAppointmentNotes, stripSalonAppointmentMetadataFromNotes } from '@/lib/salonAppointmentNotes';
import { sendWhatsappTextPreferEvolution } from '@/lib/sendWhatsappTextPreferEvolution';
import { loadWhatsappManualTemplates } from '@/lib/loadWhatsappManualTemplates';
import {
  buildAppointmentConfirmVars,
  buildManualReminderVars,
  resolveWhatsappManualMessage,
  type WhatsappManualTemplatesMap,
} from '@/lib/whatsappManualTemplates';
import {
  SalonProfessionalRibbonLabel,
  parseAllSalonProceduresFromNotes,
  parseSalonProcedureFromNotes,
} from '@/components/salon/SalonProfessionalRibbonLabel';
import { SalonProcedureCombobox } from '@/components/salon/SalonProcedureCombobox';
import {
  SalonAgendaLancamentoDialog,
  type SalonAgendaLancamentoTarget,
} from '@/components/salon/SalonAgendaLancamentoDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const SLOT_MINUTES = 30;

const CUSTOM_STATUS_PRESETS = ['Pilates', 'Curso', 'Reunião', 'Pessoal'] as const;

function slotKey(date: Date, time: string): string {
  return `${format(date, 'yyyy-MM-dd')}_${time}`;
}

function slotBlockLookupKey(blockDate: string, time: string, professionalId?: string | null): string {
  const base = `${blockDate}_${timeToKey(time)}`;
  return professionalId ? `${base}_${professionalId}` : base;
}

function isDayBeforeToday(day: Date, todayStart: Date): boolean {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  return dayStart.getTime() < todayStart.getTime();
}

function findAgendaCompletedSession(
  apt: { patient_id: string | null; appointment_date: string; professional_id: string | null },
  sessions:
    | readonly {
        id?: string;
        patient_id: string;
        session_date: string;
        professional_id: string;
        observacoes?: string | null;
      }[]
    | undefined,
  fallbackProfessionalId: string
) {
  if (!apt.patient_id || !sessions?.length) return null;
  const aptDate = apt.appointment_date.slice(0, 10);
  const proId = apt.professional_id ?? fallbackProfessionalId;
  const strict =
    sessions.find(
      (s) =>
        s.patient_id === apt.patient_id &&
        String(s.session_date).slice(0, 10) === aptDate &&
        s.professional_id === proId
    ) ?? null;
  if (strict) return strict;
  return (
    sessions.find(
      (s) => s.patient_id === apt.patient_id && String(s.session_date).slice(0, 10) === aptDate
    ) ?? null
  );
}

function getSalonScrollTargetSlot(timeSlots: string[], day: Date, now = new Date()): string | null {
  if (!timeSlots.length || !isSameDay(day, now)) return null;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  let target: string | null = timeSlots[0] ?? null;
  for (const time of timeSlots) {
    const [h, m] = time.split(':').map(Number);
    const slotMins = h * 60 + m;
    target = time;
    if (slotMins >= nowMins) break;
  }
  return target;
}

function getAgendaScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      node.scrollHeight > node.clientHeight + 8
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/** Rola o container da agenda (overflow-auto do layout) até o card do dia. */
function scrollSalonDayIntoView(dayKey: string): boolean {
  const el = document.getElementById(`agenda-salon-day-${dayKey}`);
  if (!el) return false;
  const parent = getAgendaScrollParent(el);
  const headerOffset = 112;
  if (parent) {
    const parentRect = parent.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const nextTop = parent.scrollTop + (elRect.top - parentRect.top) - headerOffset;
    parent.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
  } else {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  return true;
}

function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function getTimeSlots(startTime: string, endTime: string): string[] {
  const slots: string[] = [];
  const startMin = timeToMinutes(startTime) ?? 8 * 60;
  const endMin = timeToMinutes(endTime) ?? 18 * 60;
  if (endMin <= startMin) return [];
  for (let t = startMin; t < endMin; t += SLOT_MINUTES) {
    slots.push(minutesToTime(t));
  }
  return slots;
}

/** Ordena horários conforme a grade (índices em `slotOrder`). */
function sortTimesBySlotOrder(times: string[], slotOrder: string[]): string[] {
  const ix = (t: string) => slotOrder.indexOf(t);
  return [...new Set(times)]
    .filter((t) => ix(t) >= 0)
    .sort((a, b) => ix(a) - ix(b));
}

function contiguousSlotIndices(sortedTimes: string[], slotOrder: string[]): number[] {
  return sortedTimes.map((t) => slotOrder.indexOf(t));
}

function areIndicesContiguous(indices: number[]): boolean {
  if (indices.length <= 1) return true;
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== indices[i - 1] + 1) return false;
  }
  return true;
}

interface Patient {
  id: string;
  full_name: string;
  nickname?: string | null;
  phone: string | null;
  is_active?: boolean;
}

function getAgendaPatientLabel(patient: Patient, isSalon: boolean): string {
  return isSalon ? formatPatientDisplayName(patient.full_name, patient.nickname) : patient.full_name;
}

function filterAgendaPatients(patients: Patient[], query: string, isSalon: boolean): Patient[] {
  const q = query.trim().toLowerCase();
  if (!q) return patients;
  return patients.filter((patient) =>
    isSalon ? patientMatchesSearch(patient, q) : patient.full_name.toLowerCase().includes(q)
  );
}

interface Appointment {
  id: string;
  patient_id: string | null;
  full_name: string | null;
  pre_registration_phone: string | null;
  appointment_date: string;
  start_time: string;
  notes: string | null;
  is_encaixe?: boolean;
  appointment_block_id?: string | null;
  is_block_start?: boolean;
  professional_id?: string;
  patients?: { full_name: string } | null;
  presence_confirmed_at?: string | null;
  clinic_status?: string | null;
}

interface AgendaSlotBlock {
  id: string;
  block_date: string;
  start_time: string;
  label: string;
  professional_id?: string;
}

function timeToKey(t: string): string {
  return t.length === 5 ? t : t.slice(0, 5);
}

/** Suaviza nomes gravados só em MAIÚSCULAS para leitura na agenda/modal. */
function formatPatientNameForUi(name: string): string {
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

function displayAppointmentName(a: Appointment): string {
  const raw = a.patient_id
    ? (a.patients as { full_name?: string })?.full_name ?? 'Paciente'
    : (a.full_name ?? 'Pré-cadastro');
  return formatPatientNameForUi(raw);
}

function displayAppointmentNote(a: Appointment, forClinic = false): string | null {
  if (forClinic) {
    const procedure = clinicProcedureLabelFromNotes(a.notes);
    const rest = stripClinicAppointmentMetadataFromNotes(a.notes);
    if (procedure && rest) return `${procedure} · ${rest}`;
    return procedure || rest;
  }
  const note = a.notes?.trim();
  return note ? note : null;
}

function displaySalonSlotMeta(a: Appointment, isSalonSlot: boolean) {
  const note = a.notes?.trim();
  if (!isSalonSlot || !note) {
    return { procedure: null as string | null, restNote: note ? stripSalonAppointmentMetadataFromNotes(note) : null };
  }
  const { procedure, rest } = parseSalonProcedureFromNotes(note);
  return { procedure, restNote: stripSalonAppointmentMetadataFromNotes(rest ?? note) };
}

type SalonProfessionalLabel = {
  name: string;
  color: string | null;
  title?: string;
};

function SalonProcedureChip({
  label,
  density,
  variant = 'slot',
}: {
  label: string;
  density: 'mobile' | 'desktop';
  variant?: 'slot' | 'dialog';
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full self-start truncate rounded-md border border-border/60 bg-background/70 px-1.5 font-medium leading-tight text-muted-foreground',
        variant === 'dialog' ? 'py-0.5 text-xs' : 'py-px',
        variant === 'slot' && (density === 'desktop' ? 'text-[8px] lg:text-[9px]' : 'text-[8px]')
      )}
      title={label}
    >
      {label}
    </span>
  );
}

function SalonSlotAppointmentBlock({
  app,
  density,
  professionalLabel,
  nameClassName,
  variant = 'slot',
}: {
  app: Appointment;
  density: 'mobile' | 'desktop';
  professionalLabel?: (app: Appointment) => SalonProfessionalLabel | null;
  nameClassName: string;
  variant?: 'slot' | 'dialog';
}) {
  const isSalonSlot = Boolean(professionalLabel);
  const proLabel = professionalLabel?.(app) ?? null;
  const { procedure, restNote } = displaySalonSlotMeta(app, isSalonSlot);

  return (
    <div className={cn('flex min-w-0 flex-col', variant === 'dialog' ? 'gap-1.5' : 'gap-0.5')}>
      {proLabel ? (
        <SalonProfessionalRibbonLabel
          name={proLabel.name}
          color={proLabel.color}
          density={density}
          title={proLabel.title}
          className={variant === 'dialog' ? 'max-w-full' : undefined}
        />
      ) : null}
      <span
        className={cn(
          nameClassName,
          'block min-w-0 break-words [overflow-wrap:anywhere]',
          variant === 'slot' &&
            '[display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden'
        )}
      >
        {displayAppointmentName(app)}
      </span>
      {procedure ? (
        <SalonProcedureChip label={procedure} density={density} variant={variant} />
      ) : null}
      {restNote ? (
        <span
          className={cn(
            'leading-tight text-muted-foreground [overflow-wrap:anywhere]',
            variant === 'dialog' ? 'text-xs' : 'text-[9px] [display:-webkit-box] [-webkit-line-clamp:1] [-webkit-box-orient:vertical] overflow-hidden'
          )}
        >
          Obs: {restNote}
        </span>
      ) : null}
    </div>
  );
}

/** Ordem da lista = ordem de exibição: [0] principal, demais encaixes no mesmo horário. */
/** Regulares primeiro, encaixes depois; empate por id (estável). */
function compareAppointmentsInSlot(a: Appointment, b: Appointment): number {
  const aEnc = !!a.is_encaixe;
  const bEnc = !!b.is_encaixe;
  if (aEnc !== bEnc) return aEnc ? 1 : -1;
  return a.id.localeCompare(b.id);
}

function splitPrincipalAndEncaixes(apps: Appointment[]): {
  principal: Appointment | undefined;
  encaixes: Appointment[];
} {
  if (apps.length === 0) return { principal: undefined, encaixes: [] };
  return { principal: apps[0], encaixes: apps.slice(1) };
}

/** Salão: vários profissionais no mesmo horário (não é encaixe). */
function isSalonMultiProfessionalSlot(apps: Appointment[]): boolean {
  if (apps.length <= 1) return false;
  if (apps.some((a) => a.is_encaixe)) return false;
  const proIds = apps.map((a) => a.professional_id).filter(Boolean);
  return new Set(proIds).size === apps.length;
}

function OcupadoStatusBadge() {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-amber-200/80 bg-amber-100/70 px-1.5 py-px text-[9px] font-medium leading-none text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
      title="Horário com mais de uma consulta"
    >
      <span className="h-1 w-1 shrink-0 rounded-full bg-amber-500" aria-hidden />
      Ocupado
    </span>
  );
}

/**
 * Lista pacientes no slot (lista já ordenada: regulares primeiro, encaixes depois).
 * [0] = paciente principal na UI; demais = "+ Encaixe:".
 */
function AgendaSlotPatientList({
  apps,
  density,
  professionalLabel,
  forClinic = false,
}: {
  apps: Appointment[];
  density: 'mobile' | 'desktop';
  professionalLabel?: (app: Appointment) => SalonProfessionalLabel | null;
  forClinic?: boolean;
}) {
  const { principal, encaixes } = splitPrincipalAndEncaixes(apps);
  if (!principal) return null;

  const hasEncaixes = encaixes.length > 0;
  const isDesktop = density === 'desktop';
  const isSalonSlot = Boolean(professionalLabel);

  const namePrincipal = isDesktop
    ? 'text-[10px] font-semibold leading-tight text-foreground lg:text-[11px]'
    : 'text-[10px] font-semibold leading-tight text-foreground sm:text-[11px]';

  const encaixeClasses = isDesktop
    ? 'text-[9px] leading-tight text-muted-foreground lg:text-[10px]'
    : 'text-[9px] leading-tight text-muted-foreground sm:text-[10px]';

  const badgePrincipal =
    'inline-flex shrink-0 rounded border border-primary/30 bg-primary/10 px-1 py-px text-[8px] font-semibold uppercase leading-none tracking-wide text-primary';

  if (isSalonSlot && isSalonMultiProfessionalSlot(apps)) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
        {apps.map((a) => (
          <SalonSlotAppointmentBlock
            key={a.id}
            app={a}
            density={density}
            professionalLabel={professionalLabel}
            nameClassName={namePrincipal}
          />
        ))}
      </div>
    );
  }

  if (isSalonSlot && !hasEncaixes) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <SalonSlotAppointmentBlock
          app={principal}
          density={density}
          professionalLabel={professionalLabel}
          nameClassName={namePrincipal}
        />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
      {hasEncaixes ? (
        <div className="flex min-w-0 items-start gap-1">
          <span className={badgePrincipal} title="Consulta regular neste horário">
            Principal
          </span>
          <div className="min-w-0 flex-1">
            {isSalonSlot ? (
              <SalonSlotAppointmentBlock
                app={principal}
                density={density}
                professionalLabel={professionalLabel}
                nameClassName={namePrincipal}
              />
            ) : (
              <>
                <span
                  className={cn(
                    namePrincipal,
                    'block min-w-0 break-words [overflow-wrap:anywhere] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden'
                  )}
                >
                  {displayAppointmentName(principal)}
                </span>
                {displayAppointmentNote(principal, forClinic) && (
                  <span className="mt-0.5 block text-[9px] leading-tight text-muted-foreground [display:-webkit-box] [-webkit-line-clamp:1] [-webkit-box-orient:vertical] overflow-hidden">
                    Obs: {displayAppointmentNote(principal, forClinic)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="min-w-0">
          <span
            className={cn(
              namePrincipal,
              'block break-words [overflow-wrap:anywhere] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden'
            )}
          >
            {displayAppointmentName(principal)}
          </span>
          {displayAppointmentNote(principal, forClinic) && (
            <span className="mt-0.5 block text-[9px] leading-tight text-muted-foreground [display:-webkit-box] [-webkit-line-clamp:1] [-webkit-box-orient:vertical] overflow-hidden">
              Obs: {displayAppointmentNote(principal, forClinic)}
            </span>
          )}
        </div>
      )}

      {encaixes.map((a) => (
        <div
          key={a.id}
          className={cn(
            'flex items-start gap-0.5 border-l border-muted-foreground/30 pl-1.5 ml-px',
            encaixeClasses
          )}
        >
          <span className="shrink-0 font-medium text-muted-foreground/85" title="Encaixe">
            + Enc.
          </span>
          <div className="min-w-0 flex-1">
            {isSalonSlot ? (
              <SalonSlotAppointmentBlock
                app={a}
                density={density}
                professionalLabel={professionalLabel}
                nameClassName="text-[9px] font-normal leading-tight text-foreground sm:text-[10px]"
              />
            ) : (
              <>
                <span className="block min-w-0 break-words font-normal [overflow-wrap:anywhere] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">
                  {displayAppointmentName(a)}
                </span>
                {displayAppointmentNote(a, forClinic) && (
                  <span className="mt-0.5 block text-[9px] leading-tight text-muted-foreground [display:-webkit-box] [-webkit-line-clamp:1] [-webkit-box-orient:vertical] overflow-hidden">
                    Obs: {displayAppointmentNote(a, forClinic)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Formata telefone para link wa.me (apenas dígitos, com 55 se Brasil). */
function phoneToWhatsApp(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return '55' + digits;
  return '55' + digits;
}

function buildWhatsAppAppointmentMessage(
  patientName: string,
  professionalName: string,
  date: Date,
  timesSorted: string[],
  options?: {
    consultationLower?: string;
    procedureName?: string | null;
    templates?: WhatsappManualTemplatesMap | null;
    nomeSalao?: string | null;
  }
): { enabled: boolean; message: string } {
  const dayName = format(date, 'EEEE', { locale: ptBR });
  const dateStr = format(date, "d 'de' MMMM", { locale: ptBR });
  const timeLabel = timeToKey(timesSorted[0] ?? '');
  const multiSlotList =
    timesSorted.length > 1 ? timesSorted.map((t) => timeToKey(t)).join(', ') : null;
  const vars = buildAppointmentConfirmVars({
    patientName,
    professionalName,
    dayName,
    dateStr,
    timeLabel,
    consultationLower: options?.consultationLower,
    procedureName: options?.procedureName,
    multiSlotList,
    nomeSalao: options?.nomeSalao,
  });
  return resolveWhatsappManualMessage(options?.templates, 'appointment_confirm', vars);
}

function buildWhatsAppAppointmentReminderMessage(
  professionalName: string,
  dateFormatted: string,
  timeStr: string,
  options?: {
    patientName?: string | null;
    consultationLower?: string;
    procedureName?: string | null;
    templates?: WhatsappManualTemplatesMap | null;
    nomeSalao?: string | null;
  }
): { enabled: boolean; message: string } {
  const vars = buildManualReminderVars({
    patientName: options?.patientName,
    professionalName,
    dateFormatted,
    timeStr,
    consultationLower: options?.consultationLower,
    procedureName: options?.procedureName,
    nomeSalao: options?.nomeSalao,
  });
  return resolveWhatsappManualMessage(options?.templates, 'manual_reminder', vars);
}

export default function Agenda() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const professionalId = profile?.id ?? user?.id;
  const [searchParams] = useSearchParams();
  const patientIdFromUrl = searchParams.get('patientId') ?? '';
  const procedureSlugFromUrl = searchParams.get('procedureSlug') ?? '';
  const dateParam = searchParams.get('date') ?? '';
  const scopeParam = (searchParams.get('scope') ?? '').toLowerCase();
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    return startOfWeek(d, { weekStartsOn: 0 });
  });
  const [clinicView, setClinicView] = useState<ClinicAgendaView>(readClinicAgendaView);
  const [clinicDay, setClinicDay] = useState(() => startOfDay(new Date()));
  const [clinicDatePickerOpen, setClinicDatePickerOpen] = useState(false);
  const [clinicAgendaFilterProId, setClinicAgendaFilterProId] = useState('all');

  useEffect(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const d = parseISO(dateParam);
      setClinicDay(startOfDay(d));
      if (scopeParam === 'month') {
        setWeekStart(startOfMonth(d));
        setClinicView('mes');
      } else {
        setWeekStart(startOfWeek(d, { weekStartsOn: 0 }));
      }
    }
  }, [dateParam, scopeParam]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [agendaLabelColor, setAgendaLabelColor] = useState<string | null>(null);
  const isSalon = isSalonAccount(profile?.account_type);
  const isClinic = isClinicOnlyAccount(profile?.account_type);
  const workingDays = useMemo(() => {
    return new Set(profile?.work_days ?? [1, 2, 3, 4, 5]);
  }, [profile?.work_days]);
  const { isFrontDeskStaff } = useClinicMemberRole();
  const { isMaster: isClinicMaster } = useClinicMaster();
  const uiCopy = useUiCopy();
  const { isSalonAdmin, organizationId } = useSalonAccount();
  const [salonPastDaysExpanded, setSalonPastDaysExpanded] = useState<Record<string, boolean>>({});
  const [salonDatePickerOpen, setSalonDatePickerOpen] = useState(false);
  const [salonPickerDate, setSalonPickerDate] = useState(() => new Date());
  const [salonFocusDate, setSalonFocusDate] = useState<string | null>(
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null
  );
  const [salonScrollToken, setSalonScrollToken] = useState(0);
  const salonScrollPendingRef = useRef(!dateParam);
  const salonScrollToDateRef = useRef<string | null>(
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null
  );
  const salonFocusDateRef = useRef<string | null>(salonFocusDate);
  const agendaHasLoadedRef = useRef(false);

  const requestSalonScrollToDate = useCallback((dayKey: string) => {
    salonScrollToDateRef.current = dayKey;
    salonScrollPendingRef.current = true;
    setSalonScrollToken((n) => n + 1);
  }, []);

  const goToSalonDate = useCallback(
    (date: Date) => {
      const dayKey = format(date, 'yyyy-MM-dd');
      const todayStart = startOfDay(new Date());
      salonFocusDateRef.current = dayKey;
      setSalonFocusDate(dayKey);
      setSalonPickerDate(date);
      setWeekStart(startOfWeek(date, { weekStartsOn: 0 }));
      setSalonPastDaysExpanded((prev) =>
        isDayBeforeToday(date, todayStart) ? { ...prev, [dayKey]: true } : prev
      );
      setSalonDatePickerOpen(false);
      requestSalonScrollToDate(dayKey);
    },
    [requestSalonScrollToDate]
  );

  /** "Hoje": volta ao comportamento da semana atual com scroll para o dia de hoje. */
  const goToSalonToday = useCallback(() => {
    const now = new Date();
    const dayKey = format(now, 'yyyy-MM-dd');
    salonFocusDateRef.current = null;
    setSalonFocusDate(null);
    setSalonPickerDate(now);
    setWeekStart(startOfWeek(now, { weekStartsOn: 0 }));
    setSalonDatePickerOpen(false);
    requestSalonScrollToDate(dayKey);
  }, [requestSalonScrollToDate]);

  const shiftSalonWeek = useCallback((deltaDays: number) => {
    salonFocusDateRef.current = null;
    setSalonFocusDate(null);
    setWeekStart((d) => addDays(d, deltaDays));
  }, []);

  useEffect(() => {
    if (isSalon && !dateParam) {
      salonScrollPendingRef.current = true;
    }
  }, [isSalon, dateParam]);

  useEffect(() => {
    if (!isSalon) return;
    const focus = salonFocusDateRef.current;
    if (focus) {
      try {
        const focusDate = parseISO(focus);
        const todayStart = startOfDay(new Date());
        if (isDayBeforeToday(focusDate, todayStart)) {
          setSalonPastDaysExpanded({ [focus]: true });
          return;
        }
      } catch {
        /* ignore */
      }
    }
    setSalonPastDaysExpanded({});
  }, [isSalon, weekStart, salonScrollToken]);

  const salonTeamQuery = useQuery({
    queryKey: salonAgendaTeamQueryKey(organizationId),
    enabled: Boolean(isSalon && isSalonAdmin && organizationId),
    queryFn: () => fetchSalonAgendaTeamMembers(organizationId!),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const salonProceduresQuery = useQuery({
    queryKey: ['salon-procedures-agenda', profile?.id],
    enabled: Boolean(isSalon && profile?.id),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('salon_procedures')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name');
      if (error) throw new Error(error.message);
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
    staleTime: 60_000,
  });

  const clinicProfessionalsQuery = useQuery({
    queryKey: ['clinic-agenda-professionals', profile?.id],
    enabled: Boolean(isClinic && profile?.id),
    queryFn: async () => {
      try {
        return await fetchClinicAgendaProfessionals();
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });

  const clinicAgendaProcedures = CLINIC_AGENDA_APPOINTMENT_TYPES;

  const clinicBookableProfessionals = useMemo(() => {
    if (!isClinic) return [];
    const list = clinicProfessionalsQuery.data ?? [];
    if (list.length > 0) return list;
    if (professionalId) {
      return [{ userId: professionalId, name: profile?.full_name?.trim() || 'Você', specialty: null }];
    }
    return [];
  }, [isClinic, clinicProfessionalsQuery.data, professionalId, profile?.full_name]);

  const clinicVisibleAppointments = useMemo(() => {
    if (clinicAgendaFilterProId === 'all') return appointments;
    return appointments.filter((a) => a.professional_id === clinicAgendaFilterProId);
  }, [appointments, clinicAgendaFilterProId]);

  const salonBookableProfessionals = useMemo(() => {
    if (!isSalon || !professionalId) return [];
    if (isSalonAdmin && salonTeamQuery.data?.length) {
      const members = sortSalonAgendaMembers(
        salonTeamQuery.data.filter(isSalonAgendaBookableMember)
      );
      return members.map((m) => ({
        ...mapSalonAgendaProfessional(m),
        subtitle: salonStaffRoleLabel(m.staff_title),
      }));
    }
    return [
      {
        ...mapSalonAgendaProfessional({
          user_id: professionalId,
          full_name: profile?.full_name ?? 'Você',
          role: 'professional',
          agenda_label_color: agendaLabelColor,
        }),
        subtitle: salonStaffRoleLabel(null),
      },
    ];
  }, [
    isSalon,
    isSalonAdmin,
    salonTeamQuery.data,
    professionalId,
    profile?.full_name,
    agendaLabelColor,
  ]);

  const salonLabelColorByUserId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const p of salonBookableProfessionals) {
      map.set(p.userId, p.color);
    }
    return map;
  }, [salonBookableProfessionals]);

  const showSalonProfessionalColumns = isSalon && salonBookableProfessionals.length > 1;

  const salonAgendaProfessionalIds = useMemo(() => {
    const ids = salonBookableProfessionals.map((p) => p.userId);
    return ids.length > 0 ? ids : professionalId ? [professionalId] : [];
  }, [salonBookableProfessionals, professionalId]);

  const clinicAgendaProfessionalIds = useMemo(() => {
    if (!isClinic) return [];
    const ids = [...new Set(clinicBookableProfessionals.map((p) => p.userId).filter(Boolean))];
    if (professionalId && !ids.includes(professionalId)) ids.push(professionalId);
    return ids;
  }, [isClinic, clinicBookableProfessionals, professionalId]);

  const agendaProIds = useMemo(() => {
    if (isSalon && salonAgendaProfessionalIds.length > 0) return salonAgendaProfessionalIds;
    if (isClinic && clinicAgendaProfessionalIds.length > 0) return clinicAgendaProfessionalIds;
    return professionalId ? [professionalId] : [];
  }, [
    isSalon,
    salonAgendaProfessionalIds,
    isClinic,
    clinicAgendaProfessionalIds,
    professionalId,
  ]);

  const agendaWeekStartStr = format(
    isClinic ? clinicAgendaFetchRange({ view: clinicView, day: clinicDay, weekStart, workingDays }).start : weekStart,
    'yyyy-MM-dd'
  );
  const agendaWeekEndStr = format(
    isClinic ? clinicAgendaFetchRange({ view: clinicView, day: clinicDay, weekStart, workingDays }).end : addDays(weekStart, 6),
    'yyyy-MM-dd'
  );

  const weekPatientIds = useMemo(
    () =>
      [
        ...new Set(
          appointments.map((a) => a.patient_id).filter((id): id is string => Boolean(id))
        ),
      ],
    [appointments]
  );

  const completedSessionsQuery = useQuery({
    queryKey: [
      'agenda-completed-sessions',
      agendaWeekStartStr,
      salonAgendaProfessionalIds.join(','),
      clinicAgendaProfessionalIds.join(','),
      weekPatientIds.join(','),
    ],
    enabled: Boolean(professionalId),
    queryFn: async () => {
      const proIds = agendaProIds.length > 0 ? agendaProIds : [professionalId!];
      let q = supabase
        .from('patient_sessions')
        .select('id, patient_id, session_date, professional_id, observacoes')
        .gte('session_date', agendaWeekStartStr)
        .lte('session_date', agendaWeekEndStr);
      q =
        proIds.length === 1
          ? q.eq('professional_id', proIds[0]!)
          : q.in('professional_id', proIds);
      if (weekPatientIds.length > 0) {
        q = q.in('patient_id', weekPatientIds);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        patient_id: string;
        session_date: string;
        professional_id: string;
        observacoes?: string | null;
      }>;
    },
    staleTime: 15_000,
  });

  const completedAppointmentKeys = useMemo(() => {
    const set = new Set<string>();
    for (const row of completedSessionsQuery.data ?? []) {
      set.add(
        completedAppointmentKey(
          row.patient_id,
          String(row.session_date).slice(0, 10),
          row.professional_id ?? professionalId ?? ''
        )
      );
    }
    return set;
  }, [completedSessionsQuery.data, professionalId]);

  const isAgendaAppointmentCompleted = useCallback(
    (apt: Appointment) => {
      if (!professionalId) return false;
      return isAppointmentCompleted(
        {
          patientId: apt.patient_id,
          appointmentDate: apt.appointment_date,
          professionalId: apt.professional_id,
          fallbackProfessionalId: professionalId,
          notes: apt.notes,
        },
        completedAppointmentKeys,
        completedSessionsQuery.data
      );
    },
    [completedAppointmentKeys, completedSessionsQuery.data, professionalId]
  );

  const resolveSalonOccupiedStyle = (apps: Appointment[]) => {
    if (!isSalon || apps.length === 0) return undefined;
    if (isSalonMultiProfessionalSlot(apps)) {
      return {
        backgroundColor: 'hsl(var(--muted) / 0.45)',
        borderColor: 'hsl(var(--border))',
      };
    }
    const proId = apps[0].professional_id ?? professionalId;
    const color = proId ? salonLabelColorByUserId.get(proId) ?? agendaLabelColor : agendaLabelColor;
    return salonAgendaSlotStyle(color);
  };

  const resolveCustomBlockStyle = (isVacationBlock: boolean) => {
    if (isVacationBlock) return undefined;
    return salonAgendaSlotStyle(agendaSlotBlockColor);
  };

  const resolveCustomBlockAccent = (isVacationBlock: boolean) => {
    if (isVacationBlock || !agendaSlotBlockColor) return null;
    return salonRibbonPalette(agendaSlotBlockColor);
  };

  const salonProfessionalByUserId = useMemo(
    () => new Map(salonBookableProfessionals.map((p) => [p.userId, p])),
    [salonBookableProfessionals]
  );

  const resolveSalonProfessionalLabel = useCallback(
    (app: Appointment): SalonProfessionalLabel | null => {
      if (!isSalon || !app.professional_id) return null;
      const pro = salonProfessionalByUserId.get(app.professional_id);
      if (!pro?.name) return null;
      return { name: pro.displayLabel, color: pro.color, title: pro.name };
    },
    [isSalon, salonProfessionalByUserId]
  );

  const salonSlotProfessionalLabel = isSalon ? resolveSalonProfessionalLabel : undefined;

  const { patients: patientsRaw, isPageLoading: patientsLoading } = usePatients(professionalId ?? undefined);
  const patients = useMemo(
    () => patientsRaw.filter((p) => p.is_active !== false),
    [patientsRaw]
  );

  /**
   * Busca robusta de paciente por telefone: tenta o cache local primeiro
   * (instantâneo) e, em seguida, consulta o banco via util compartilhado.
   * O util cobre formatos com/sem 55, com qualquer máscara, e dá preferência
   * a pacientes com cadastro completo e ativos.
   */
  async function findPatientByPhoneRemote(
    phone: string | null | undefined
  ): Promise<Patient | null> {
    const target = normalizePhoneDigits(phone);
    if (!target || !professionalId) return null;

    const localMatch = patientsRaw.find((p) => {
      const norm = normalizePhoneDigits(p.phone);
      if (norm === target) return true;
      if (target.length >= 9 && norm.length >= 9 && norm.slice(-9) === target.slice(-9)) return true;
      if (target.length >= 8 && norm.length >= 8 && norm.slice(-8) === target.slice(-8)) return true;
      return false;
    });
    if (localMatch) return localMatch;

    const remote = await findExistingPatientByPhone({ professionalId, phone: target });
    return (remote as unknown as Patient) ?? null;
  }
  const [dialogOpen, setDialogOpen] = useState(false);
  const [slotDate, setSlotDate] = useState<Date | null>(null);
  const [slotTime, setSlotTime] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [preRegistrationName, setPreRegistrationName] = useState('');
  const [preRegistrationPhone, setPreRegistrationPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [detailEncaixeNotes, setDetailEncaixeNotes] = useState('');
  const [saving, setSaving] = useState(false);
  /** Horário já ocupado: lista de consultas + fluxo de encaixe extra. */
  const [occupiedSlot, setOccupiedSlot] = useState<{
    date: Date;
    time: string;
    appointments: Appointment[];
  } | null>(null);
  const [salonLancamentoTarget, setSalonLancamentoTarget] =
    useState<SalonAgendaLancamentoTarget | null>(null);
  const [salonLancamentoOpen, setSalonLancamentoOpen] = useState(false);

  useEffect(() => {
    if (occupiedSlot) {
      void queryClient.invalidateQueries({ queryKey: ['agenda-completed-sessions'] });
    }
  }, [occupiedSlot, queryClient]);

  const [detailEncaixeExpanded, setDetailEncaixeExpanded] = useState(false);
  const [detailSavingEncaixe, setDetailSavingEncaixe] = useState(false);
  const [showOccupiedSlotEncaixe, setShowOccupiedSlotEncaixe] = useState(true);
  const [agendaSlotBlockColor, setAgendaSlotBlockColor] = useState<string | null>(null);
  const [vacationPeriods, setVacationPeriods] = useState<VacationPeriod[]>([]);
  const [clinicClosedDays, setClinicClosedDays] = useState<ClinicClosedDay[]>([]);
  const [laserUnavailablePeriods, setLaserUnavailablePeriods] = useState<LaserUnavailablePeriod[]>([]);
  const [patientComboboxOpen, setPatientComboboxOpen] = useState(false);
  const [dialogPatients, setDialogPatients] = useState<Patient[]>([]);
  const [dialogPatientsLoading, setDialogPatientsLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [clinicQuickRegisterOpen, setClinicQuickRegisterOpen] = useState(false);
  const [clinicQuickRegisterName, setClinicQuickRegisterName] = useState('');
  const patientDropdownRef = useRef<HTMLDivElement>(null);
  /** Marcar o próximo agendamento como encaixe (checkbox no modal). */
  const [isEncaixe, setIsEncaixe] = useState(false);
  /** Fluxo pós-agendamento: escolher horário livre no mesmo dia para um encaixe extra. */
  const [encaixeFlowActive, setEncaixeFlowActive] = useState(false);
  /** Clínica: botão Adicionar — data do dia selecionado + horário editável (pode ser encaixe). */
  const [clinicManualAdd, setClinicManualAdd] = useState(false);

  /** Vários intervalos da grade para um único agendamento (procedimento longo). */
  const [bulkSlotTimes, setBulkSlotTimes] = useState<string[] | null>(null);
  /** Seleção na grade após segurar 1s (criar bloco ou estender atendimento). */
  const [longProcedureSelection, setLongProcedureSelection] = useState<{
    date: Date;
    times: string[];
    /** Horários do atendimento original (modo estender) — não removíveis. */
    lockedTimes?: string[];
    extendSource?: Appointment;
    salonProfessionalId?: string;
  } | null>(null);
  /** Oferta ao segurar em horário ocupado. */
  const [extendOffer, setExtendOffer] = useState<{
    date: Date;
    time: string;
    appointments: Appointment[];
    salonProfessionalId?: string;
  } | null>(null);
  const [extendingAppointment, setExtendingAppointment] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextSlotClickRef = useRef(false);
  const fetchScheduleRef = useRef<(opts?: { silent?: boolean }) => Promise<void>>(async () => {});
  const slotDragRef = useRef<{
    mode: 'extend' | 'create';
    date: Date;
    dateStr: string;
    lockedTimes: string[];
    extendSource?: Appointment;
    salonProfessionalId?: string;
    pointerId: number;
    pointerType: string;
    originX: number;
    originY: number;
    activated: boolean;
    onMove: (e: PointerEvent) => void;
    onUp: (e: PointerEvent) => void;
  } | null>(null);

  const [slotBlocks, setSlotBlocks] = useState<AgendaSlotBlock[]>([]);
  const [emptySlotChoiceOpen, setEmptySlotChoiceOpen] = useState(false);
  const [emptySlotChoice, setEmptySlotChoice] = useState<{ date: Date; time: string } | null>(null);
  const [salonSelectedProfessionalId, setSalonSelectedProfessionalId] = useState('');
  const [salonSelectedProcedureId, setSalonSelectedProcedureId] = useState('');
  /** Profissionais ainda livres neste horário (agendar junto a outro atendimento). */
  const [salonSlotAvailableProIds, setSalonSlotAvailableProIds] = useState<string[] | null>(null);
  const [bookingProfessionalId, setBookingProfessionalId] = useState<string | null>(null);
  const [bookingProcedureName, setBookingProcedureName] = useState<string | null>(null);
  const [bookingSalonProcedureId, setBookingSalonProcedureId] = useState<string | null>(null);
  const [bookingClinicProcedureId, setBookingClinicProcedureId] = useState('');
  const [bookingAgendaStatus, setBookingAgendaStatus] = useState<ClinicAgendaStatus>(
    DEFAULT_CLINIC_APPOINTMENT_STATUS
  );

  useEffect(() => {
    if (!isClinic || bookingProfessionalId) return;
    if (clinicBookableProfessionals.length === 1) {
      setBookingProfessionalId(clinicBookableProfessionals[0]!.userId);
      return;
    }
    if (!isFrontDeskStaff && professionalId) {
      setBookingProfessionalId(professionalId);
    }
  }, [
    isClinic,
    bookingProfessionalId,
    clinicBookableProfessionals,
    isFrontDeskStaff,
    professionalId,
  ]);

  function selectClinicProcedure(procedureId: string) {
    setBookingClinicProcedureId(procedureId);
    const proc = clinicAgendaProcedures.find((p) => p.id === procedureId);
    setBookingProcedureName(proc?.name ?? null);
  }
  const [defineStatusOpen, setDefineStatusOpen] = useState(false);
  const [defineStatusCtx, setDefineStatusCtx] = useState<{
    date: Date;
    time: string;
    replaceAppointments?: boolean;
    professionalId?: string;
  } | null>(null);
  const [defineStatusLabel, setDefineStatusLabel] = useState('');
  const [manageCustomOpen, setManageCustomOpen] = useState(false);
  const [manageCustomCtx, setManageCustomCtx] = useState<{
    date: Date;
    time: string;
    blockId: string;
    label: string;
    professionalId?: string;
  } | null>(null);
  const [slotBlockReplaceConfirmOpen, setSlotBlockReplaceConfirmOpen] = useState(false);
  const [pendingDefineAfterConfirm, setPendingDefineAfterConfirm] = useState<{
    date: Date;
    time: string;
    professionalId?: string;
  } | null>(null);
  const [savingSlotBlock, setSavingSlotBlock] = useState(false);

  const isWorkingDay = (day: Date) => workingDays.has(day.getDay());

  const lunchBreaks = useMemo(
    () => getLunchBreaksFromProfile(profile),
    [profile?.lunch_breaks, profile?.lunch_start_time, profile?.lunch_end_time]
  );

  const isLunchTime = (time: string) => isTimeInLunchBreaks(time, lunchBreaks);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const visibleDays = useMemo(() => {
    if (!isClinic) return weekDays;
    return clinicAgendaVisibleDays({
      view: clinicView,
      day: clinicDay,
      weekStart,
      workingDays,
    });
  }, [isClinic, clinicView, clinicDay, weekStart, workingDays, weekDays]);

  const agendaRange = useMemo(() => {
    if (!isClinic) {
      return { start: weekStart, end: addDays(weekStart, 6) };
    }
    return clinicAgendaFetchRange({ view: clinicView, day: clinicDay, weekStart, workingDays });
  }, [isClinic, clinicView, clinicDay, weekStart, workingDays]);

  const agendaRangeStartStr = format(agendaRange.start, 'yyyy-MM-dd');
  const agendaRangeEndStr = format(agendaRange.end, 'yyyy-MM-dd');
  const clinicUsesCardLayout = isClinic && clinicView === 'dia';
  const clinicMonthWeekdays = useMemo(() => {
    const ids = [...new Set(visibleDays.map((day) => day.getDay()))].sort((a, b) => a - b);
    return ids.length > 0 ? ids : [1, 2, 3, 4, 5];
  }, [visibleDays]);

  const changeClinicView = useCallback(
    (next: ClinicAgendaView) => {
      setClinicView(next);
      persistClinicAgendaView(next);
      const context = clinicDay;
      if (next === 'dia') {
        const day = stepToWorkingDay(context, workingDays, 1);
        setClinicDay(day);
        setWeekStart(startOfWeek(day, { weekStartsOn: 0 }));
        return;
      }
      if (next === 'semana') {
        setWeekStart(startOfWeek(context, { weekStartsOn: 0 }));
        return;
      }
      setWeekStart(startOfMonth(context));
    },
    [clinicView, clinicDay, weekStart, workingDays]
  );

  const shiftClinicPeriod = useCallback(
    (direction: 1 | -1) => {
      const next = shiftClinicAgendaAnchor({
        view: clinicView,
        day: clinicDay,
        weekStart,
        workingDays,
        direction,
      });
      setClinicDay(next.day);
      setWeekStart(next.weekStart);
    },
    [clinicView, clinicDay, weekStart, workingDays]
  );

  const goToClinicDate = useCallback(
    (date: Date) => {
      const day = startOfDay(date);
      setClinicDay(stepToWorkingDay(day, workingDays, 1));
      if (clinicView === 'mes') {
        setWeekStart(startOfMonth(day));
      } else {
        setWeekStart(startOfWeek(day, { weekStartsOn: 0 }));
      }
      setClinicDatePickerOpen(false);
    },
    [clinicView, workingDays]
  );

  const goToClinicToday = useCallback(() => {
    goToClinicDate(new Date());
  }, [goToClinicDate]);

  const openClinicDayView = useCallback(
    (date: Date) => {
      const day = startOfDay(date);
      setClinicDay(stepToWorkingDay(day, workingDays, 1));
      setWeekStart(startOfWeek(day, { weekStartsOn: 0 }));
      setClinicView('dia');
      persistClinicAgendaView('dia');
      setClinicDatePickerOpen(false);
    },
    [workingDays]
  );

  const timeSlots = useMemo(() => {
    const start = profile?.work_start_time ?? '08:00';
    const end = profile?.work_end_time ?? '18:00';
    const base = getTimeSlots(timeToKey(String(start)), timeToKey(String(end)));

    const extraTimes = new Set<string>();
    appointments.forEach((a) => {
      if (a.appointment_date < agendaRangeStartStr || a.appointment_date > agendaRangeEndStr) return;
      const t = timeToKey(a.start_time);
      if (!base.includes(t)) extraTimes.add(t);
    });

    const merged = [...base, ...extraTimes];
    merged.sort((a, b) => (timeToMinutes(a) ?? 0) - (timeToMinutes(b) ?? 0));
    return merged;
  }, [
    profile?.work_start_time,
    profile?.work_end_time,
    appointments,
    agendaRangeStartStr,
    agendaRangeEndStr,
  ]);

  useEffect(() => {
    if (!professionalId) return;
    let cancelled = false;
    void (async () => {
      try {
        const ui = await fetchProfessionalUiSettings({ professionalId });
        if (!cancelled) {
          setShowOccupiedSlotEncaixe(ui.show_occupied_slot_encaixe);
          setAgendaSlotBlockColor(ui.agenda_slot_block_color);
          setVacationPeriods(ui.vacation_periods ?? []);
          setClinicClosedDays(ui.clinic_closed_days ?? []);
        }
      } catch {
        if (!cancelled) {
          setShowOccupiedSlotEncaixe(true);
          setAgendaSlotBlockColor(null);
          setVacationPeriods([]);
          setClinicClosedDays([]);
        }
      }

      try {
        if (isDepilacaoLaserModuleEnabled(profile)) {
          const periods = await fetchLaserUnavailablePeriods(professionalId);
          if (!cancelled) setLaserUnavailablePeriods(periods);
        } else if (!cancelled) {
          setLaserUnavailablePeriods([]);
        }
      } catch {
        if (!cancelled) setLaserUnavailablePeriods([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [professionalId, profile]);

  useEffect(() => {
    if (showOccupiedSlotEncaixe) return;
    setDetailEncaixeExpanded(false);
  }, [showOccupiedSlotEncaixe]);

  useEffect(() => {
    if (!professionalId || !isSalon) {
      setAgendaLabelColor(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await (supabase as any)
        .from('organization_members')
        .select('agenda_label_color')
        .eq('user_id', professionalId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error(error);
        return;
      }
      setAgendaLabelColor(
        typeof data?.agenda_label_color === 'string' ? data.agenda_label_color : null
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [professionalId, isSalon]);

  useEffect(() => {
    if (!emptySlotChoiceOpen || !isSalon || !professionalId) return;
    if (salonSlotAvailableProIds?.length) {
      if (salonSlotAvailableProIds.length === 1) {
        setSalonSelectedProfessionalId(salonSlotAvailableProIds[0]!);
      } else {
        setSalonSelectedProfessionalId('');
      }
    } else {
      setSalonSelectedProfessionalId(professionalId);
    }
    setSalonSelectedProcedureId('');
  }, [emptySlotChoiceOpen, isSalon, professionalId, salonSlotAvailableProIds]);

  useEffect(() => {
    if (!professionalId) {
      setLoading(false);
      return;
    }
    if (isClinic && clinicProfessionalsQuery.isLoading) return;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const start = agendaRangeStartStr;
    const end = agendaRangeEndStr;
    const scheduleProIds = agendaProIds.length > 0 ? agendaProIds : [professionalId];

    const fetchSchedule = async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent) || (isSalon && agendaHasLoadedRef.current);
      if (!silent) setLoading(true);
      let apptsQuery = supabase
        .from('appointments')
        .select(
          isClinic
            ? 'id, patient_id, full_name, pre_registration_phone, appointment_date, start_time, notes, is_encaixe, appointment_block_id, is_block_start, professional_id, presence_confirmed_at, clinic_status, patients(full_name)'
            : 'id, patient_id, full_name, pre_registration_phone, appointment_date, start_time, notes, is_encaixe, appointment_block_id, is_block_start, professional_id, patients(full_name)'
        )
        .gte('appointment_date', start)
        .lte('appointment_date', end)
        .order('appointment_date')
        .order('start_time')
        .order('id');
      apptsQuery =
        scheduleProIds.length === 1
          ? apptsQuery.eq('professional_id', scheduleProIds[0]!)
          : apptsQuery.in('professional_id', scheduleProIds);

      let blocksQuery = supabase
        .from('agenda_slot_blocks')
        .select('id, block_date, start_time, label, professional_id')
        .gte('block_date', start)
        .lte('block_date', end)
        .order('block_date')
        .order('start_time');
      blocksQuery =
        scheduleProIds.length === 1
          ? blocksQuery.eq('professional_id', scheduleProIds[0]!)
          : blocksQuery.in('professional_id', scheduleProIds);

      const [apptsRes, blocksRes] = await Promise.all([
        apptsQuery,
        blocksQuery,
      ]);

      if (cancelled) return;
      if (apptsRes.error) {
        console.error(apptsRes.error);
        if (!silent) toast.error('Erro ao carregar agenda.');
      } else {
        setAppointments((apptsRes.data as Appointment[]) || []);
      }
      void queryClient.invalidateQueries({ queryKey: ['agenda-completed-sessions'] });
      if (blocksRes.error) {
        console.error(blocksRes.error);
        if (!apptsRes.error && !silent) toast.error('Erro ao carregar bloqueios da agenda.');
        setSlotBlocks([]);
      } else {
        setSlotBlocks((blocksRes.data as AgendaSlotBlock[]) || []);
      }
      agendaHasLoadedRef.current = true;
      if (!silent) setLoading(false);
    };

    fetchScheduleRef.current = fetchSchedule;
    void fetchSchedule();

    const startPollFallback = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => {
        if (document.visibilityState === 'visible') {
          void fetchSchedule({ silent: true });
        }
      }, 30000);
    };

    const stopPollFallback = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const channel = supabase.channel(`agenda-page-${professionalId}-${start}-${scheduleProIds.join(',')}`);
    for (const proId of scheduleProIds) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `professional_id=eq.${proId}`,
        },
        () => {
          void fetchSchedule({ silent: true });
        }
      );
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agenda_slot_blocks',
          filter: `professional_id=eq.${proId}`,
        },
        () => {
          void fetchSchedule({ silent: true });
        }
      );
    }
    channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          stopPollFallback();
          void fetchSchedule({ silent: true });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Agenda] Realtime indisponível; usando atualização periódica.', err);
          startPollFallback();
        }
      });

    const onAgendaRefresh = () => {
      void fetchSchedule({ silent: true });
    };
    window.addEventListener('agenda:refresh', onAgendaRefresh);

    return () => {
      cancelled = true;
      stopPollFallback();
      window.removeEventListener('agenda:refresh', onAgendaRefresh);
      void supabase.removeChannel(channel);
    };
  }, [professionalId, isSalon, isClinic, agendaProIds, agendaRangeStartStr, agendaRangeEndStr, clinicProfessionalsQuery.isLoading]);

  useEffect(() => {
    if (patientIdFromUrl && patients.some((p) => p.id === patientIdFromUrl)) {
      setSelectedPatientId(patientIdFromUrl);
    }
  }, [patientIdFromUrl, patients]);

  useEffect(() => {
    if (!patientComboboxOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (patientDropdownRef.current && !patientDropdownRef.current.contains(e.target as Node)) {
        setPatientComboboxOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [patientComboboxOpen]);

  const appointmentsBySlot = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments.forEach((a) => {
      const key = `${a.appointment_date}_${timeToKey(a.start_time)}`;
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    });
    map.forEach((list) => {
      list.sort(compareAppointmentsInSlot);
    });
    return map;
  }, [appointments]);

  const getSalonAvailableProfessionalsAtSlot = useCallback(
    (date: Date, time: string) => {
      if (!isSalon || salonBookableProfessionals.length <= 1) return [];
      const key = slotKey(date, time);
      const dateStr = format(date, 'yyyy-MM-dd');
      const existing = appointmentsBySlot.get(key) ?? [];
      const bookedIds = new Set(
        existing
          .map((a) => a.professional_id)
          .filter((id): id is string => Boolean(id))
      );
      return salonBookableProfessionals.filter((p) => {
        if (bookedIds.has(p.userId)) return false;
        return !slotBlocks.some(
          (b) =>
            b.professional_id === p.userId &&
            b.block_date === dateStr &&
            timeToKey(b.start_time) === timeToKey(time)
        );
      });
    },
    [isSalon, salonBookableProfessionals, appointmentsBySlot, slotBlocks]
  );

  const salonProsForPicker = useMemo(() => {
    if (!salonSlotAvailableProIds?.length) return salonBookableProfessionals;
    const allowed = new Set(salonSlotAvailableProIds);
    return salonBookableProfessionals.filter((p) => allowed.has(p.userId));
  }, [salonBookableProfessionals, salonSlotAvailableProIds]);

  function resolveSalonBlockProfessionalId(explicit?: string | null): string {
    if (!isSalon) return '';
    if (explicit) return explicit;
    if (salonSelectedProfessionalId) return salonSelectedProfessionalId;
    if (salonProsForPicker.length === 1) return salonProsForPicker[0]?.userId ?? '';
    if (salonBookableProfessionals.length === 1) return salonBookableProfessionals[0]?.userId ?? '';
    return '';
  }

  function salonProfessionalLabel(userId?: string | null): string {
    if (!userId) return '';
    const pro = salonBookableProfessionals.find((p) => p.userId === userId);
    return pro?.displayLabel || pro?.name || '';
  }

  const openSalonAddAnotherProfessional = useCallback(
    (date: Date, time: string) => {
      const available = getSalonAvailableProfessionalsAtSlot(date, time);
      if (!available.length) {
        toast.info('Não há outro profissional livre neste horário.');
        return;
      }
      setOccupiedSlot(null);
      setDetailEncaixeExpanded(false);
      setSalonSlotAvailableProIds(available.map((p) => p.userId));
      setSalonSelectedProfessionalId(available.length === 1 ? available[0]!.userId : '');
      setSalonSelectedProcedureId('');
      setEmptySlotChoice({ date, time });
      setEmptySlotChoiceOpen(true);
    },
    [getSalonAvailableProfessionalsAtSlot]
  );

  const customBlocksBySlot = useMemo(() => {
    const m = new Map<string, { id: string; label: string; professional_id?: string }>();
    slotBlocks.forEach((b) => {
      const entry = { id: b.id, label: b.label, professional_id: b.professional_id };
      if (isSalon && b.professional_id) {
        m.set(slotBlockLookupKey(b.block_date, b.start_time, b.professional_id), entry);
      } else {
        m.set(slotBlockLookupKey(b.block_date, b.start_time), entry);
      }
    });
    return m;
  }, [slotBlocks, isSalon]);

  const getCustomSlotBlock = useCallback(
    (date: Date | string, time: string, salonProfessionalId?: string | null) => {
      const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
      if (isSalon) {
        const proId =
          salonProfessionalId ||
          (salonBookableProfessionals.length === 1 ? salonBookableProfessionals[0]?.userId : null);
        if (!proId) return undefined;
        return customBlocksBySlot.get(slotBlockLookupKey(dateStr, time, proId));
      }
      return customBlocksBySlot.get(slotBlockLookupKey(dateStr, time));
    },
    [customBlocksBySlot, isSalon, salonBookableProfessionals]
  );

  /** Busca pacientes na tabela patients (sempre direto do banco). */
  function fetchDialogPatients() {
    if (!professionalId) return;
    setDialogPatientsLoading(true);
    supabase
      .from('patients')
      .select('id, full_name, nickname, phone, is_active')
      .eq('professional_id', professionalId)
      .eq('is_active', true)
      .order('full_name')
      .then(({ data, error }) => {
        setDialogPatientsLoading(false);
        if (error) {
          console.error(error);
          toast.error('Erro ao carregar pacientes.');
          return;
        }
        setDialogPatients((data || []) as unknown as Patient[]);
      });
  }

  function startEncaixeBooking(date: Date) {
    if (!professionalId) {
      toast.error('Sessão não carregada. Faça login novamente.');
      return;
    }
    setSlotDate(date);
    setSlotTime(null);
    setBulkSlotTimes(null);
    setIsEncaixe(true);
    setEncaixeFlowActive(true);
    setSelectedPatientId(patientIdFromUrl || '');
    setPreRegistrationName('');
    setPreRegistrationPhone('');
    setNotes('');
    setDialogPatients([]);
    setDialogPatientsLoading(true);
    toast.loading('Carregando pacientes...', { id: 'agenda-load-patients' });
    supabase
      .from('patients')
      .select('id, full_name, nickname, phone, is_active')
      .eq('professional_id', professionalId)
      .eq('is_active', true)
      .order('full_name')
      .then(({ data, error }) => {
        setDialogPatientsLoading(false);
        toast.dismiss('agenda-load-patients');
        if (error) {
          console.error(error);
          toast.error('Erro ao carregar lista de pacientes.');
          return;
        }
        setDialogPatients((data || []) as unknown as Patient[]);
        setDialogOpen(true);
      });
  }

  function proceedOpenBooking(
    date: Date,
    time: string,
    bulkTimes?: string[],
    salonOpts?: { professionalId: string; procedureName: string; procedureId?: string }
  ) {
    if (isClinicClosedOnDay(date, clinicClosedDays)) {
      toast.info('Neste dia a clínica está fechada. Use a agenda apenas para horários pessoais.');
      return;
    }
    const timesToOpen =
      bulkTimes && bulkTimes.length > 0 ? sortTimesBySlotOrder(bulkTimes, timeSlots) : [time];
    for (const t of timesToOpen) {
      if (getCustomSlotBlock(date, t, salonOpts?.professionalId ?? (isSalon ? professionalId : null))) {
        toast.error('Um horário do bloco está indisponível. Remova o bloqueio manual para agendar.');
        return;
      }
    }
    const targetProfessionalId = salonOpts?.professionalId ?? professionalId;
    if (!targetProfessionalId) {
      toast.error('Sessão não carregada. Faça login novamente.');
      return;
    }
    setBookingProfessionalId(
      salonOpts?.professionalId ?? (isClinic && isFrontDeskStaff ? null : professionalId ?? null)
    );
    setBookingProcedureName(salonOpts?.procedureName ?? null);
    setBookingSalonProcedureId(salonOpts?.procedureId ?? null);
    setBookingClinicProcedureId('');
    setBookingAgendaStatus(DEFAULT_CLINIC_APPOINTMENT_STATUS);
    setEncaixeFlowActive(false);
    setIsEncaixe(false);
    setClinicManualAdd(false);
    setSlotDate(date);
    const sortedBulk =
      bulkTimes && bulkTimes.length > 1 ? sortTimesBySlotOrder(bulkTimes, timeSlots) : null;
    setBulkSlotTimes(sortedBulk);
    setSlotTime(time);
    setSelectedPatientId(patientIdFromUrl || '');
    setPreRegistrationName('');
    setPreRegistrationPhone('');
    setNotes('');
    setDialogPatients([]);
    setDialogPatientsLoading(true);
    toast.loading('Carregando pacientes...', { id: 'agenda-load-patients' });
    const loadDialogPatients = async () => {
      try {
        if (isClinic && professionalId) {
          // Master/recepção: todos os pacientes da clínica (RLS de colegas).
          // Profissional clínico: próprios + vinculados por agenda/atendimento.
          if (isClinicMaster || isFrontDeskStaff) {
            const { data, error } = await supabase
              .from('patients')
              .select('id, full_name, nickname, phone, is_active')
              .eq('is_active', true)
              .order('full_name');
            if (error) throw error;
            setDialogPatients((data || []) as unknown as Patient[]);
          } else {
            const rows = await fetchPatients(professionalId);
            setDialogPatients(
              rows
                .filter((p) => p.is_active !== false)
                .map((p) => ({
                  id: p.id,
                  full_name: p.full_name,
                  nickname: p.nickname ?? null,
                  phone: p.phone,
                  is_active: p.is_active,
                })) as unknown as Patient[]
            );
          }
        } else {
          const { data, error } = await supabase
            .from('patients')
            .select('id, full_name, nickname, phone, is_active')
            .eq('professional_id', targetProfessionalId)
            .eq('is_active', true)
            .order('full_name');
          if (error) throw error;
          setDialogPatients((data || []) as unknown as Patient[]);
        }
        setDialogOpen(true);
      } catch (error) {
        console.error(error);
        toast.error('Erro ao carregar lista de pacientes.');
      } finally {
        setDialogPatientsLoading(false);
        toast.dismiss('agenda-load-patients');
      }
    };
    void loadDialogPatients();
  }

  function handleSlotClick(date: Date, time: string, salonColumnProfessionalId?: string) {
    if (suppressNextSlotClickRef.current) {
      suppressNextSlotClickRef.current = false;
      return;
    }

    if (longProcedureSelection) {
      if (!isSameDay(longProcedureSelection.date, date)) {
        toast.info('Selecione horários no mesmo dia do bloco, ou cancele (Esc ou Cancelar).');
        return;
      }
      if (
        longProcedureSelection.salonProfessionalId &&
        salonColumnProfessionalId &&
        longProcedureSelection.salonProfessionalId !== salonColumnProfessionalId
      ) {
        toast.message('Continue na coluna do mesmo profissional.');
        return;
      }
      const salonPro =
        longProcedureSelection.salonProfessionalId ?? salonColumnProfessionalId;
      const keyLp = slotKey(date, time);
      const existingLp = appointmentsBySlot.get(keyLp) ?? [];
      const customLp = getCustomSlotBlock(date, time, salonPro);
      if (customLp) {
        toast.message(
          longProcedureSelection.extendSource
            ? 'Cancele o modo estender para usar este bloqueio.'
            : 'Cancele o modo procedimento longo para usar este bloqueio.'
        );
        return;
      }

      const prev = longProcedureSelection.times;
      const sortedPrev = sortTimesBySlotOrder(prev, timeSlots);
      const locked = new Set(longProcedureSelection.lockedTimes ?? []);

      if (sortedPrev.includes(time)) {
        if (locked.has(time)) {
          toast.info('Este horário faz parte do atendimento. Toque em horários livres para estender.');
          return;
        }
        if (sortedPrev.length === 1) {
          setLongProcedureSelection(null);
          toast.message(
            longProcedureSelection.extendSource
              ? 'Modo estender encerrado.'
              : 'Modo procedimento longo encerrado.'
          );
          return;
        }
        if (sortedPrev[0] === time) {
          setLongProcedureSelection({ ...longProcedureSelection, date, times: sortedPrev.slice(1) });
          return;
        }
        if (sortedPrev[sortedPrev.length - 1] === time) {
          setLongProcedureSelection({
            ...longProcedureSelection,
            date,
            times: sortedPrev.slice(0, -1),
          });
          return;
        }
        toast.info('Para reduzir o bloco, toque de novo no primeiro ou no último horário selecionado.');
        return;
      }

      if (longProcedureSelection.extendSource) {
        if (!isEmptyBookableSlot(date, time, salonPro)) {
          toast.message('Escolha um horário livre do mesmo profissional para estender.');
          return;
        }
      } else {
        if (existingLp.length > 0) {
          toast.message('Cancele o modo procedimento longo para abrir horários ocupados.');
          return;
        }
        if (!isEmptyBookableSlot(date, time, salonPro)) {
          return;
        }
      }

      const merged = sortTimesBySlotOrder([...sortedPrev, time], timeSlots);
      const idxs = contiguousSlotIndices(merged, timeSlots);
      if (!areIndicesContiguous(idxs)) {
        toast.info('Escolha apenas horários seguidos na grade, sem pulos.');
        return;
      }
      setLongProcedureSelection({ ...longProcedureSelection, date, times: merged });
      return;
    }

    const key = slotKey(date, time);
    let existing = appointmentsBySlot.get(key) ?? [];
    if (salonColumnProfessionalId) {
      existing = existing.filter((a) => a.professional_id === salonColumnProfessionalId);
    }
    const custom = getCustomSlotBlock(date, time, salonColumnProfessionalId);
    const hasPatients = existing.length > 0;
    const hasCustom = !!custom;
    const softBlock = getSoftBlockForDay(date);
    const inSoftBlock = !!softBlock && !hasPatients && !hasCustom;

    if (isSlotPast(date, time) && !hasPatients && !hasCustom) return;
    if (inSoftBlock) {
      toast.info(
        softBlock.kind === 'laser'
          ? softBlock.label
          : softBlock.label || 'Férias: agenda bloqueada neste período.'
      );
      return;
    }

    const naturalBlock =
      (!isWorkingDay(date) && !hasPatients && !hasCustom) ||
      (isLunchTime(time) && !hasPatients && !hasCustom);
    if (naturalBlock) return;

    if (isClinicClosedOnDay(date, clinicClosedDays) && !hasPatients && !hasCustom) {
      openDefineStatusFlow(date, time, { initialLabel: 'Pessoal' });
      return;
    }

    if (hasCustom) {
      setManageCustomCtx({
        date,
        time,
        blockId: custom!.id,
        label: custom!.label,
        professionalId: salonColumnProfessionalId ?? custom!.professional_id,
      });
      setManageCustomOpen(true);
      return;
    }
    if (hasPatients) {
      setOccupiedSlot({ date, time, appointments: existing });
      setDetailEncaixeExpanded(false);
      setSelectedPatientId('');
      setPreRegistrationName('');
      setPreRegistrationPhone('');
      setPatientComboboxOpen(false);
      setPatientSearch('');
      return;
    }
    setSalonSlotAvailableProIds(
      salonColumnProfessionalId ? [salonColumnProfessionalId] : null
    );
    setSalonSelectedProfessionalId(salonColumnProfessionalId ?? '');
    setEmptySlotChoice({ date, time });
    setEmptySlotChoiceOpen(true);
  }

  async function saveSlotBlock(
    date: Date,
    time: string,
    label: string,
    options?: { replaceAppointments?: boolean; professionalId?: string }
  ) {
    const trimmed = label.trim();
    const targetBlockProfessionalId = isSalon
      ? resolveSalonBlockProfessionalId(options?.professionalId)
      : professionalId;
    if (!targetBlockProfessionalId || !trimmed) {
      toast.error(
        isSalon && !targetBlockProfessionalId
          ? 'Selecione o profissional para bloquear o horário.'
          : 'Informe um nome para o bloqueio.'
      );
      return;
    }
    const key = slotKey(date, time);
    setSavingSlotBlock(true);
    try {
      if (options?.replaceAppointments) {
        let apps = appointmentsBySlot.get(key) ?? [];
        if (isSalon && targetBlockProfessionalId) {
          apps = apps.filter((a) => a.professional_id === targetBlockProfessionalId);
        }
        for (const a of apps) {
          const { data, error: delErr } = await supabase
            .from('appointments')
            .delete()
            .eq('id', a.id)
            .select('id');
          if (delErr) throw delErr;
          if (!data?.length) {
            throw new Error('Não foi possível desmarcar uma consulta deste horário.');
          }
        }
        await queryClient.invalidateQueries({ queryKey: queryKeys.notifications(targetBlockProfessionalId) });
      }
      const dateStr = format(date, 'yyyy-MM-dd');
      const timeStr = time.length === 5 ? `${time}:00` : time;
      const { error } = await supabase.from('agenda_slot_blocks').upsert(
        {
          professional_id: targetBlockProfessionalId,
          block_date: dateStr,
          start_time: timeStr,
          label: trimmed,
        },
        { onConflict: 'professional_id,block_date,start_time' }
      );
      if (error) throw error;
      toast.success('Horário marcado como indisponível.');
      setDefineStatusOpen(false);
      setDefineStatusCtx(null);
      setDefineStatusLabel('');
      setEmptySlotChoiceOpen(false);
      setEmptySlotChoice(null);
      setManageCustomOpen(false);
      setManageCustomCtx(null);
      setPendingDefineAfterConfirm(null);
      closeOccupiedOnly();
      await fetchAppointments();
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar o bloqueio.');
    } finally {
      setSavingSlotBlock(false);
    }
  }

  async function removeSlotBlock(blockId: string) {
    setSavingSlotBlock(true);
    try {
      const { error } = await supabase.from('agenda_slot_blocks').delete().eq('id', blockId);
      if (error) throw error;
      toast.success('Bloqueio removido. O horário voltou a ficar disponível.');
      setManageCustomOpen(false);
      setManageCustomCtx(null);
      await fetchAppointments();
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível remover o bloqueio.');
    } finally {
      setSavingSlotBlock(false);
    }
  }

  function openDefineStatusFlow(
    date: Date,
    time: string,
    options?: {
      replaceAppointments?: boolean;
      initialLabel?: string;
      /** Ao alterar rótulo de um bloqueio já existente (não exige apagar consultas). */
      skipPatientConfirm?: boolean;
      professionalId?: string;
    }
  ) {
    const key = slotKey(date, time);
    const blockProfessionalId = isSalon
      ? resolveSalonBlockProfessionalId(options?.professionalId)
      : undefined;
    if (isSalon && !blockProfessionalId) {
      toast.error('Selecione o profissional para bloquear o horário.');
      return;
    }
    let apps = appointmentsBySlot.get(key) ?? [];
    if (isSalon && blockProfessionalId) {
      apps = apps.filter((a) => a.professional_id === blockProfessionalId);
    }
    const mustConfirm =
      apps.length > 0 && !options?.replaceAppointments && !options?.skipPatientConfirm;
    if (mustConfirm) {
      setPendingDefineAfterConfirm({ date, time, professionalId: blockProfessionalId });
      setSlotBlockReplaceConfirmOpen(true);
      return;
    }
    setDefineStatusCtx({
      date,
      time,
      replaceAppointments: !!options?.replaceAppointments,
      professionalId: blockProfessionalId,
    });
    setDefineStatusLabel(options?.initialLabel?.trim() ?? '');
    setDefineStatusOpen(true);
  }

  function closeDefineStatusDialog() {
    setDefineStatusOpen(false);
    setDefineStatusCtx(null);
    setDefineStatusLabel('');
  }

  function closeDialog() {
    setDialogOpen(false);
    setSlotDate(null);
    setSlotTime(null);
    setBulkSlotTimes(null);
    setLongProcedureSelection(null);
    setOccupiedSlot(null);
    setDetailEncaixeExpanded(false);
    setPatientComboboxOpen(false);
    setDialogPatients([]);
    setPatientSearch('');
    setClinicQuickRegisterOpen(false);
    setClinicQuickRegisterName('');
    setIsEncaixe(false);
    setEncaixeFlowActive(false);
    setClinicManualAdd(false);
    setDetailEncaixeNotes('');
    setBookingProfessionalId(null);
    setBookingProcedureName(null);
    setBookingSalonProcedureId(null);
    setBookingClinicProcedureId('');
    setBookingAgendaStatus(DEFAULT_CLINIC_APPOINTMENT_STATUS);
    setSalonSlotAvailableProIds(null);
  }

  function openClinicQuickRegister(name: string) {
    setClinicQuickRegisterName(name);
    setClinicQuickRegisterOpen(true);
    setPatientComboboxOpen(false);
  }

  function closeOccupiedOnly() {
    setOccupiedSlot(null);
    setDetailEncaixeExpanded(false);
    setSelectedPatientId('');
    setPreRegistrationName('');
    setPreRegistrationPhone('');
    setDetailEncaixeNotes('');
    setPatientComboboxOpen(false);
    setPatientSearch('');
    setClinicQuickRegisterOpen(false);
    setClinicQuickRegisterName('');
    setBookingClinicProcedureId('');
    setBookingAgendaStatus(DEFAULT_CLINIC_APPOINTMENT_STATUS);
    if (isClinic) {
      setBookingProfessionalId(null);
      setBookingProcedureName(null);
    }
  }

  async function handleSave() {
    let resolvedPatientId = selectedPatientId?.trim() || '';
    let hasPatient = !!resolvedPatientId;
    const hasPreName = !!preRegistrationName?.trim();
    const preRegPhoneDigits = normalizePhoneDigits(preRegistrationPhone);
    const targetProfessionalId =
      ((isSalon || isClinic) && bookingProfessionalId) || professionalId;
    if (!targetProfessionalId || !slotDate || !slotTime) return;
    if (isClinic) {
      if (!bookingProfessionalId) {
        toast.error('Selecione o profissional.');
        return;
      }
      if (!bookingClinicProcedureId) {
        toast.error('Selecione o tipo de atendimento.');
        return;
      }
    }
    const timesToBook =
      bulkSlotTimes && bulkSlotTimes.length > 0
        ? sortTimesBySlotOrder(bulkSlotTimes, timeSlots)
        : [slotTime];
    for (const t of timesToBook) {
      if (getCustomSlotBlock(slotDate, t, isSalon ? targetProfessionalId : null)) {
        toast.error(
          `O horário ${timeToKey(t)} está indisponível (bloqueio manual). Remova o bloqueio para agendar.`
        );
        return;
      }
      if ((isSalon || isClinic) && targetProfessionalId) {
        const key = slotKey(slotDate, t);
        const existingAtSlot = appointmentsBySlot.get(key) ?? [];
        if (existingAtSlot.some((a) => a.professional_id === targetProfessionalId)) {
          if (!(isClinic && (isEncaixe || clinicManualAdd))) {
            toast.error('Este profissional já tem atendimento neste horário.');
            return;
          }
        }
      }
    }
    if (!hasPatient && (isClinic || !hasPreName)) {
      toast.error(
        isClinic
          ? 'Selecione ou cadastre um paciente.'
          : isSalon
            ? 'Selecione um cliente ou informe o nome para pré-cadastro.'
            : 'Selecione um paciente ou informe o nome para pré-cadastro.'
      );
      return;
    }
    const saveAsEncaixe =
      isEncaixe ||
      Boolean(
        isClinic &&
          clinicManualAdd &&
          timesToBook.some((t) =>
            (appointmentsBySlot.get(slotKey(slotDate, t)) ?? []).some(
              (a) => a.professional_id === targetProfessionalId
            )
          )
      );
    setSaving(true);
    try {
      const dateStr = format(slotDate, 'yyyy-MM-dd');
      let notesPayload =
        hasPatient && procedureSlugFromUrl?.trim()
          ? appendProcedureContextToNotes(notes || null, procedureSlugFromUrl.trim())
          : notes?.trim() || null;
      if ((isSalon || isClinic) && bookingProcedureName) {
        const procLine = `Procedimento: ${bookingProcedureName}`;
        notesPayload = notesPayload ? `${procLine}\n${notesPayload}` : procLine;
      }
      if (isSalon && bookingSalonProcedureId) {
        notesPayload = appendSalonProcedureIdToNotes(notesPayload, bookingSalonProcedureId);
      }
      if (isClinic && bookingClinicProcedureId) {
        const clinicProc = clinicAgendaProcedures.find((p) => p.id === bookingClinicProcedureId);
        if (clinicProc?.slug) {
          notesPayload = appendProcedureContextToNotes(notesPayload, clinicProc.slug);
        }
      }

      // Pré-cadastro:
      // - com telefone: vincula ao paciente existente pelo telefone ou cria paciente mínimo.
      // - sem telefone: mantém como cadastro rápido (sem patient_id).
      let linkedExistingPatientName: string | null = null;
      if (!hasPatient && hasPreName) {
        if (preRegPhoneDigits) {
          const existingByPhone = isSalon
            ? await findPatientByPhoneAndName({
                professionalId: targetProfessionalId,
                phone: preRegPhoneDigits,
                fullName: preRegistrationName.trim(),
              })
            : await findPatientByPhoneRemote(preRegPhoneDigits);
          if (existingByPhone?.id) {
            resolvedPatientId = existingByPhone.id;
            linkedExistingPatientName = existingByPhone.full_name;
            hasPatient = true;
          } else {
            const { data: createdPatient, error: createPatientError } = await supabase
              .from('patients')
              .insert({
                professional_id: targetProfessionalId,
                full_name: preRegistrationName.trim(),
                phone: preRegPhoneDigits || null,
                registration_completed_at: null,
              })
              .select('id, full_name')
              .single();
            if (createPatientError) throw createPatientError;
            if (createdPatient?.id) {
              resolvedPatientId = createdPatient.id;
              hasPatient = true;
            }
          }
        }
      }

      const insertedAll: Appointment[] = [];
      const blockId = timesToBook.length > 1 ? crypto.randomUUID() : null;
      for (const t of timesToBook) {
        const timeStr = t.length === 5 ? `${t}:00` : t;
        const { data: inserted, error } = await supabase
          .from('appointments')
          .insert({
            professional_id: targetProfessionalId,
            patient_id: hasPatient ? resolvedPatientId : null,
            full_name: hasPreName ? preRegistrationName.trim() : null,
            pre_registration_phone: hasPreName && preRegPhoneDigits ? preRegPhoneDigits : null,
            appointment_date: dateStr,
            start_time: timeStr,
            notes: notesPayload,
            is_encaixe: saveAsEncaixe,
            appointment_block_id: blockId,
            is_block_start: blockId ? t === timesToBook[0] : false,
            ...(isClinic ? clinicStatusWritePayload(bookingAgendaStatus) : {}),
          } as never)
          .select(
            isClinic
              ? 'id, patient_id, full_name, pre_registration_phone, appointment_date, start_time, notes, is_encaixe, appointment_block_id, is_block_start, professional_id, clinic_status, presence_confirmed_at'
              : 'id, patient_id, full_name, pre_registration_phone, appointment_date, start_time, notes, is_encaixe, appointment_block_id, is_block_start, professional_id'
          )
          .single();
        if (error) throw error;
        if (inserted) {
          const newAppt: Appointment = {
            ...(inserted as Omit<Appointment, 'patients'>),
            professional_id: targetProfessionalId,
            patients: hasPatient
              ? {
                  full_name:
                    (dialogPatients.find((p) => p.id === resolvedPatientId) ??
                      patients.find((p) => p.id === resolvedPatientId))?.full_name ?? preRegistrationName.trim() ?? undefined,
                }
              : null,
          };
          insertedAll.push(newAppt);
        }
      }
      if (insertedAll.length > 0) {
        setAppointments((prev) =>
          [...prev, ...insertedAll].sort((a, b) => {
            const d = a.appointment_date.localeCompare(b.appointment_date);
            return d !== 0 ? d : timeToKey(a.start_time).localeCompare(timeToKey(b.start_time));
          })
        );
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications(targetProfessionalId) });
      if (isClinic && targetProfessionalId) {
        await queryClient.invalidateQueries({ queryKey: patientsListKey(targetProfessionalId) });
      }
      if (isClinic && professionalId && professionalId !== targetProfessionalId) {
        await queryClient.invalidateQueries({ queryKey: patientsListKey(professionalId) });
      }

      if (hasPatient && procedureSlugFromUrl === 'botox') {
        await supabase
          .from('botox_reapplication_reminders')
          .update({ notified_at: new Date().toISOString() })
          .eq('patient_id', resolvedPatientId)
          .eq('professional_id', targetProfessionalId)
          .is('notified_at', null);
      }

      const selectedPatient = hasPatient ? (dialogPatients.find((p) => p.id === resolvedPatientId) ?? patients.find((p) => p.id === resolvedPatientId)) : null;
      const patientName = hasPatient ? (selectedPatient?.full_name ?? 'Paciente') : preRegistrationName.trim();
      const patient = selectedPatient;
      const professionalName =
        (isClinic || isSalon) && bookingProfessionalId
          ? clinicBookableProfessionals.find((p) => p.userId === bookingProfessionalId)?.name ??
            salonBookableProfessionals.find((p) => p.userId === bookingProfessionalId)?.name ??
            profile?.full_name ??
            'o profissional'
          : profile?.full_name ?? 'o profissional';
      const messageResolved = buildWhatsAppAppointmentMessage(
        patientName,
        professionalName,
        slotDate,
        timesToBook,
        {
          consultationLower: isSalon ? uiCopy.consultationLower : 'consulta',
          procedureName: isSalon || isClinic ? bookingProcedureName : null,
          templates: await loadWhatsappManualTemplates(professionalId),
          nomeSalao: isSalon
            ? profile?.app_name?.trim() || profile?.full_name || professionalName
            : null,
        }
      );
      const message = messageResolved.message;
      const whatsappNumber = hasPatient
        ? phoneToWhatsApp(patient?.phone ?? null)
        : phoneToWhatsApp(preRegPhoneDigits || null);

      const dateBookedForEncaixe = slotDate;
      const encaixeAction = {
        label: 'Agendar encaixe',
        onClick: () => startEncaixeBooking(dateBookedForEncaixe),
      };

      const blockLabel = timesToBook.length > 1 ? `${timesToBook.length} consultas agendadas` : 'Consulta agendada';
      if (linkedExistingPatientName) {
        toast.success(`Vinculado ao paciente existente: ${linkedExistingPatientName}.`);
      }
      if (whatsappNumber && messageResolved.enabled) {
        if (professionalId) {
          const sent = await sendWhatsappTextPreferEvolution({
            professionalId,
            bookingProfessionalId: targetProfessionalId,
            patientId: hasPatient ? resolvedPatientId : null,
            phone: whatsappNumber,
            message,
            preferAppOpen: false,
          });
          if (sent.viaEvolution) {
            toast.success(`${blockLabel}. Confirmação enviada pelo WhatsApp conectado.`, {
              action: encaixeAction,
            });
          } else if (sent.viaWaMe) {
            toast.success(
              hasPreName
                ? `${blockLabel}. WhatsApp aberto para enviar a confirmação.`
                : `${blockLabel}. WhatsApp aberto para enviar a confirmação ao cliente.`,
              { action: encaixeAction }
            );
          } else {
            toast.success(`${blockLabel}.`, { action: encaixeAction });
            if (sent.error) toast.message(sent.error);
          }
        } else {
          const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
          window.open(url, '_blank', 'noopener,noreferrer');
          toast.success(
            hasPreName
              ? `${blockLabel}. WhatsApp aberto para enviar a confirmação.`
              : `${blockLabel}. WhatsApp aberto para enviar a confirmação ao cliente.`,
            { action: encaixeAction }
          );
        }
      } else if (whatsappNumber && !messageResolved.enabled) {
        toast.success(`${blockLabel}.`, { action: encaixeAction });
      } else if (hasPreName && !preRegPhoneDigits) {
        toast.success(`${blockLabel} (pré-cadastro). Complete o cadastro do paciente depois.`, {
          action: encaixeAction,
        });
      } else {
        toast.success(
          `${blockLabel}. Cadastre o telefone do paciente para enviar lembrete por WhatsApp.`,
          { duration: 5000, action: encaixeAction }
        );
      }

      closeDialog();
      await fetchAppointments();
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code === '23505')
        toast.error('Um ou mais horários já estavam ocupados. Atualize a agenda e tente de novo.');
      else toast.error('Erro ao agendar.');
    } finally {
      setSaving(false);
    }
  }

  async function fetchAppointments(): Promise<Appointment[]> {
    if (!professionalId) return [];
    const start = agendaRangeStartStr;
    const end = agendaRangeEndStr;
    const scheduleProIds = agendaProIds.length > 0 ? agendaProIds : [professionalId];

    let apptsQuery = supabase
      .from('appointments')
      .select(
        'id, patient_id, full_name, pre_registration_phone, appointment_date, start_time, notes, is_encaixe, appointment_block_id, is_block_start, professional_id, patients(full_name)'
      )
      .gte('appointment_date', start)
      .lte('appointment_date', end)
      .order('appointment_date')
      .order('start_time')
      .order('id');
    apptsQuery =
      scheduleProIds.length === 1
        ? apptsQuery.eq('professional_id', scheduleProIds[0]!)
        : apptsQuery.in('professional_id', scheduleProIds);

    const [apptsRes, blocksRes] = await Promise.all([
      apptsQuery,
      (() => {
        let blocksQuery = supabase
          .from('agenda_slot_blocks')
          .select('id, block_date, start_time, label, professional_id')
          .gte('block_date', start)
          .lte('block_date', end)
          .order('block_date')
          .order('start_time');
        blocksQuery =
          scheduleProIds.length === 1
            ? blocksQuery.eq('professional_id', scheduleProIds[0]!)
            : blocksQuery.in('professional_id', scheduleProIds);
        return blocksQuery;
      })(),
    ]);
    const list = (apptsRes.data as Appointment[]) || [];
    setAppointments(list);
    if (!blocksRes.error) {
      setSlotBlocks((blocksRes.data as AgendaSlotBlock[]) || []);
    }
    return list;
  }

  useEffect(() => {
    if (!professionalId) return;
    const refetch = () => {
      void fetchScheduleRef.current({ silent: true });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    window.addEventListener('focus', refetch);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', refetch);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [professionalId, agendaRangeStartStr]);

  async function handleDeleteAppointment(apt: Appointment) {
    setSaving(true);
    const isBlockDelete = Boolean(apt.appointment_block_id && apt.is_block_start);
    const idsToRemove = isBlockDelete
      ? appointments
          .filter((a) => a.appointment_block_id === apt.appointment_block_id)
          .map((a) => a.id)
      : [apt.id];

    setAppointments((prev) => prev.filter((a) => !idsToRemove.includes(a.id)));

    try {
      if (isBlockDelete) {
        const { data, error } = await supabase
          .from('appointments')
          .delete()
          .eq('appointment_block_id', apt.appointment_block_id!)
          .select('id');
        if (error) throw error;
        if (!data?.length) {
          throw new Error('Não foi possível desmarcar o bloco. Atualize a agenda e tente novamente.');
        }
        toast.success('Bloco completo desmarcado.');
      } else {
        const { data, error } = await supabase
          .from('appointments')
          .delete()
          .eq('id', apt.id)
          .select('id');
        if (error) throw error;
        if (!data?.length) {
          throw new Error(
            'Não foi possível desmarcar este horário. Verifique suas permissões ou atualize a agenda.'
          );
        }
        toast.success('Consulta desmarcada.');
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications(professionalId) });
      const list = await fetchAppointments();
      setOccupiedSlot((prev) => {
        if (!prev) return null;
        const key = `${format(prev.date, 'yyyy-MM-dd')}_${prev.time}`;
        const next = list.filter(
          (a) => `${a.appointment_date}_${timeToKey(a.start_time)}` === key
        );
        if (next.length === 0) return null;
        return { ...prev, appointments: next };
      });
    } catch (error) {
      await fetchAppointments();
      toast.error(error instanceof Error ? error.message : 'Erro ao desmarcar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLembrarCliente(apt: Appointment) {
    const professionalName = profile?.full_name?.trim() ?? 'nós';
    const dateFormatted = format(parseISO(apt.appointment_date), "EEEE, d 'de' MMMM", { locale: ptBR });
    const timeStr = timeToKey(apt.start_time);
    const procedureName = isSalon ? salonProcedureNameFromAppointmentNotes(apt.notes) : null;
    const patientName = apt.patient_id
      ? patients.find((p) => p.id === apt.patient_id)?.full_name ??
        apt.pre_registration_name ??
        null
      : apt.pre_registration_name ?? null;
    const templates = await loadWhatsappManualTemplates(professionalId);
    const resolved = buildWhatsAppAppointmentReminderMessage(
      professionalName,
      dateFormatted,
      timeStr,
      {
        patientName,
        consultationLower: isSalon ? uiCopy.consultationLower : 'consulta',
        procedureName,
        templates,
        nomeSalao: isSalon
          ? profile?.app_name?.trim() || profile?.full_name || professionalName
          : null,
      }
    );
    if (!resolved.enabled) {
      toast.message('Lembrete manual desativado em Mensagens padrão.');
      return;
    }
    const phone = apt.patient_id
      ? patients.find((p) => p.id === apt.patient_id)?.phone ?? null
      : apt.pre_registration_phone ?? null;
    const whatsappNumber = phoneToWhatsApp(phone);
    if (whatsappNumber && professionalId) {
      const sent = await sendWhatsappTextPreferEvolution({
        professionalId,
        bookingProfessionalId: apt.professional_id || professionalId,
        patientId: apt.patient_id || null,
        phone: whatsappNumber,
        message: resolved.message,
        preferAppOpen: false,
      });
      if (sent.viaEvolution) {
        toast.success('Lembrete enviado pelo WhatsApp conectado.');
      } else if (sent.viaWaMe) {
        toast.message('Não foi possível enviar pelo WhatsApp conectado — abrindo o app.', {
          description: sent.error || 'Confira se o backend está no ar e o WhatsApp segue conectado.',
        });
      } else {
        toast.error(sent.error || 'Não foi possível enviar o lembrete.');
      }
    } else if (whatsappNumber) {
      const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(resolved.message)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.success('WhatsApp aberto com o lembrete.');
    } else {
      toast.error('Não há telefone cadastrado para enviar o lembrete.');
    }
  }

  async function handleAddEncaixeToOccupiedSlot() {
    if (!occupiedSlot || !professionalId) return;
    if (isClinic) {
      if (!bookingProfessionalId) {
        toast.error('Selecione o profissional.');
        return;
      }
      if (!bookingClinicProcedureId) {
        toast.error('Selecione o tipo de atendimento.');
        return;
      }
    }
    if (getCustomSlotBlock(occupiedSlot.date, occupiedSlot.time, isSalon ? bookingProfessionalId : null)) {
      toast.error('Este horário está bloqueado. Remova o bloqueio manual para adicionar encaixe.');
      return;
    }
    let resolvedPatientId = selectedPatientId?.trim() || '';
    let hasPatient = !!resolvedPatientId;
    const hasPreName = !!preRegistrationName?.trim();
    const preRegPhoneDigits = normalizePhoneDigits(preRegistrationPhone);
    if (!hasPatient && (isClinic || !hasPreName)) {
      toast.error(
        isClinic
          ? 'Selecione ou cadastre um paciente.'
          : 'Selecione um paciente ou informe o nome para pré-cadastro.'
      );
      return;
    }
    setDetailSavingEncaixe(true);
    try {
      const dateStr = format(occupiedSlot.date, 'yyyy-MM-dd');
      const timeStr =
        occupiedSlot.time.length === 5 ? `${occupiedSlot.time}:00` : occupiedSlot.time;
      const encaixeProfessionalId =
        (isClinic && bookingProfessionalId) || professionalId;
      let notesPayload =
        hasPatient && procedureSlugFromUrl?.trim()
          ? appendProcedureContextToNotes(detailEncaixeNotes?.trim() || null, procedureSlugFromUrl.trim())
          : detailEncaixeNotes?.trim() || null;
      if (isClinic && bookingProcedureName) {
        const procLine = `Procedimento: ${bookingProcedureName}`;
        notesPayload = notesPayload ? `${procLine}\n${notesPayload}` : procLine;
      }
      if (isClinic && bookingClinicProcedureId) {
        const clinicProc = clinicAgendaProcedures.find((p) => p.id === bookingClinicProcedureId);
        if (clinicProc?.slug) {
          notesPayload = appendProcedureContextToNotes(notesPayload, clinicProc.slug);
        }
      }

      let linkedExistingPatientName: string | null = null;
      if (!hasPatient && hasPreName) {
        if (preRegPhoneDigits) {
          const existingByPhone = isSalon
            ? await findPatientByPhoneAndName({
                professionalId,
                phone: preRegPhoneDigits,
                fullName: preRegistrationName.trim(),
              })
            : await findPatientByPhoneRemote(preRegPhoneDigits);
          if (existingByPhone?.id) {
            resolvedPatientId = existingByPhone.id;
            linkedExistingPatientName = existingByPhone.full_name;
            hasPatient = true;
          } else {
            const { data: createdPatient, error: createPatientError } = await supabase
              .from('patients')
              .insert({
                professional_id: professionalId,
                full_name: preRegistrationName.trim(),
                phone: preRegPhoneDigits || null,
                registration_completed_at: null,
              })
              .select('id, full_name')
              .single();
            if (createPatientError) throw createPatientError;
            if (createdPatient?.id) {
              resolvedPatientId = createdPatient.id;
              hasPatient = true;
            }
          }
        }
      }

      const { error } = await supabase.from('appointments').insert({
        professional_id: encaixeProfessionalId,
        patient_id: hasPatient ? resolvedPatientId : null,
        full_name: hasPreName ? preRegistrationName.trim() : null,
        pre_registration_phone: hasPreName && preRegPhoneDigits ? preRegPhoneDigits : null,
        appointment_date: dateStr,
        start_time: timeStr,
        notes: notesPayload,
        is_encaixe: true,
        ...(isClinic ? clinicStatusWritePayload(bookingAgendaStatus) : {}),
      } as never);
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications(encaixeProfessionalId) });
      if (isClinic && encaixeProfessionalId) {
        await queryClient.invalidateQueries({ queryKey: patientsListKey(encaixeProfessionalId) });
      }
      if (isClinic && professionalId && professionalId !== encaixeProfessionalId) {
        await queryClient.invalidateQueries({ queryKey: patientsListKey(professionalId) });
      }

      if (hasPatient && procedureSlugFromUrl === 'botox') {
        await supabase
          .from('botox_reapplication_reminders')
          .update({ notified_at: new Date().toISOString() })
          .eq('patient_id', resolvedPatientId)
          .eq('professional_id', encaixeProfessionalId)
          .is('notified_at', null);
      }

      const selectedPatient = hasPatient
        ? (dialogPatients.find((p) => p.id === resolvedPatientId) ??
          patients.find((p) => p.id === resolvedPatientId))
        : null;
      const patientName = hasPatient
        ? (selectedPatient?.full_name ?? 'Paciente')
        : preRegistrationName.trim();
      const professionalName =
        isClinic && bookingProfessionalId
          ? clinicBookableProfessionals.find((p) => p.userId === bookingProfessionalId)?.name ??
            profile?.full_name ??
            'o profissional'
          : profile?.full_name ?? 'o profissional';
      const messageResolved = buildWhatsAppAppointmentMessage(
        patientName,
        professionalName,
        occupiedSlot.date,
        [occupiedSlot.time],
        {
          consultationLower: isSalon ? uiCopy.consultationLower : 'consulta',
          procedureName: isSalon || isClinic ? bookingProcedureName : null,
          templates: await loadWhatsappManualTemplates(professionalId),
          nomeSalao: isSalon
            ? profile?.app_name?.trim() || profile?.full_name || professionalName
            : null,
        }
      );
      const message = messageResolved.message;
      const whatsappNumber = hasPatient
        ? phoneToWhatsApp(selectedPatient?.phone ?? null)
        : phoneToWhatsApp(preRegPhoneDigits || null);

      const list = await fetchAppointments();
      const occupiedSlotKeyStr = `${dateStr}_${occupiedSlot.time}`;
      const inSlot = list.filter(
        (a) => `${a.appointment_date}_${timeToKey(a.start_time)}` === occupiedSlotKeyStr
      );
      setOccupiedSlot((prev) =>
        prev ? { ...prev, appointments: inSlot.sort((a, b) => a.id.localeCompare(b.id)) } : null
      );

      setSelectedPatientId('');
      setPreRegistrationName('');
      setPreRegistrationPhone('');
      setDetailEncaixeNotes('');
      setDetailEncaixeExpanded(false);

      if (linkedExistingPatientName) {
        toast.success(`Vinculado ao paciente existente: ${linkedExistingPatientName}.`);
      }
      if (whatsappNumber && messageResolved.enabled) {
        if (professionalId) {
          const sent = await sendWhatsappTextPreferEvolution({
            professionalId,
            bookingProfessionalId: encaixeProfessionalId,
            patientId: hasPatient ? resolvedPatientId : null,
            phone: whatsappNumber,
            message,
            preferAppOpen: false,
          });
          if (sent.viaEvolution) {
            toast.success('Encaixe agendado. Confirmação enviada pelo WhatsApp conectado.');
          } else if (sent.viaWaMe) {
            toast.success(
              hasPreName
                ? 'Encaixe agendado. WhatsApp aberto para enviar a confirmação.'
                : 'Encaixe agendado. WhatsApp aberto para enviar a confirmação ao cliente.'
            );
          } else {
            toast.success('Encaixe agendado.');
            if (sent.error) toast.message(sent.error);
          }
        } else {
          const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
          window.open(url, '_blank', 'noopener,noreferrer');
          toast.success(
            hasPreName
              ? 'Encaixe agendado. WhatsApp aberto para enviar a confirmação.'
              : 'Encaixe agendado. WhatsApp aberto para enviar a confirmação ao cliente.'
          );
        }
      } else if (whatsappNumber && !messageResolved.enabled) {
        toast.success('Encaixe agendado.');
      } else if (hasPreName && !preRegPhoneDigits) {
        toast.success('Encaixe agendado (pré-cadastro). Complete o cadastro depois.');
      } else {
        toast.success('Encaixe agendado. Cadastre o telefone para lembrete por WhatsApp.', {
          duration: 5000,
        });
      }
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code === '23505') toast.error('Não foi possível duplicar o horário. Atualize a página.');
      else toast.error('Erro ao agendar encaixe.');
    } finally {
      setDetailSavingEncaixe(false);
    }
  }

  const today = new Date();
  const todayStart = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, [weekStart]); // recalc quando muda a semana (ex.: meia-noite)

  const isSlotPast = (day: Date, time: string) => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    if (dayStart.getTime() < todayStart.getTime()) return true;  // dia anterior a hoje
    if (dayStart.getTime() > todayStart.getTime()) return false; // dia posterior a hoje
    // mesmo dia: passado só se o horário do slot já passou
    const [h, m] = time.split(':').map(Number);
    const now = today.getHours() * 60 + today.getMinutes();
    return h * 60 + m < now;
  };

  const salonScrollTargetTime = useMemo(
    () => (isSalon ? getSalonScrollTargetSlot(timeSlots, new Date()) : null),
    [isSalon, timeSlots, weekStart]
  );

  useEffect(() => {
    if (!isSalon || loading || !salonScrollPendingRef.current) return;

    const now = new Date();
    const targetKey = salonScrollToDateRef.current ?? format(now, 'yyyy-MM-dd');
    const targetDate = parseISO(targetKey);
    if (Number.isNaN(targetDate.getTime()) || !weekDays.some((d) => isSameDay(d, targetDate))) {
      return;
    }

    const isTargetToday = isSameDay(targetDate, now);
    const scrollTarget = isTargetToday ? getSalonScrollTargetSlot(timeSlots, now) : null;

    let cancelled = false;
    const scrollToDay = (attempt: number) => {
      if (cancelled) return;

      const isDesktop = window.matchMedia('(min-width: 1280px)').matches;
      if (isDesktop) {
        if (isTargetToday) {
          const ok = Boolean(
            document.getElementById('agenda-salon-desktop-slot-current')
          );
          if (ok) {
            document.getElementById('agenda-salon-desktop-slot-current')?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
            salonScrollPendingRef.current = false;
            return;
          }
        } else {
          const col = document.getElementById(`agenda-salon-desktop-day-${targetKey}`);
          if (col) {
            col.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            salonScrollPendingRef.current = false;
            return;
          }
        }
      } else if (scrollSalonDayIntoView(targetKey)) {
        salonScrollPendingRef.current = false;
        if (scrollTarget) {
          window.setTimeout(() => {
            if (cancelled) return;
            document.getElementById(`agenda-salon-slot-${targetKey}-${scrollTarget}`)?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
          }, 350);
        }
        return;
      }

      if (attempt < 24) {
        window.setTimeout(() => scrollToDay(attempt + 1), 60);
      }
    };

    // Espera o popover fechar + layout pintar os cards da semana
    const timer = window.setTimeout(() => scrollToDay(0), 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isSalon, loading, weekDays, timeSlots, weekStart, salonScrollToken]);

  const getVacationPeriodForDay = (day: Date): VacationPeriod | null => {
    if (vacationPeriods.length === 0) return null;
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    for (const period of vacationPeriods) {
      const start = parseISO(period.start_date);
      const end = parseISO(period.end_date);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      if (d.getTime() >= start.getTime() && d.getTime() <= end.getTime()) return period;
    }
    return null;
  };
  const getSoftBlockForDay = (
    day: Date
  ): { id: string; label: string; kind: 'vacation' | 'laser' } | null => {
    const vacation = getVacationPeriodForDay(day);
    if (vacation) {
      return {
        id: vacation.id,
        label: vacation.message?.trim() || 'Férias',
        kind: 'vacation',
      };
    }
    const laser = getLaserBlockForDay(day, laserUnavailablePeriods);
    if (laser) {
      return {
        id: laser.id,
        label: laserBlockLabel(laser),
        kind: 'laser',
      };
    }
    return null;
  };
  const isSoftBlockedDay = (day: Date): boolean => !!getSoftBlockForDay(day);
  const isClinicClosedDay = (day: Date): boolean => isClinicClosedOnDay(day, clinicClosedDays);
  const weekClinicClosedDays = clinicClosedDays.filter((day) => {
    const closed = parseISO(day.closed_date);
    if (Number.isNaN(closed.getTime())) return false;
    closed.setHours(0, 0, 0, 0);
    return visibleDays.some((d) => {
      const current = new Date(d);
      current.setHours(0, 0, 0, 0);
      return current.getTime() === closed.getTime();
    });
  });
  const weekVacationPeriods = vacationPeriods.filter((period) => {
    const start = parseISO(period.start_date);
    const end = parseISO(period.end_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return visibleDays.some((d) => {
      const day = new Date(d);
      day.setHours(0, 0, 0, 0);
      return day.getTime() >= start.getTime() && day.getTime() <= end.getTime();
    });
  });
  const weekLaserPeriods = laserUnavailablePeriods.filter((period) => {
    const start = parseISO(period.start_date);
    const end = parseISO(period.end_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return visibleDays.some((d) => {
      const day = new Date(d);
      day.setHours(0, 0, 0, 0);
      return day.getTime() >= start.getTime() && day.getTime() <= end.getTime();
    });
  });

  function isEmptyBookableSlot(day: Date, time: string, salonProfessionalId?: string): boolean {
    const key = slotKey(day, time);
    if (getCustomSlotBlock(day, time, salonProfessionalId)) return false;
    if (isSoftBlockedDay(day)) return false;
    if (isClinicClosedDay(day)) return false;
    let apps = appointmentsBySlot.get(key) ?? [];
    if (salonProfessionalId) {
      apps = apps.filter((a) => a.professional_id === salonProfessionalId);
    }
    if (apps.length > 0) return false;
    if (isSlotPast(day, time)) return false;
    if (!isWorkingDay(day) || isLunchTime(time)) return false;
    return true;
  }

  function clinicManualTimesForDay(day: Date): string[] {
    return timeSlots.filter(
      (time) =>
        !isLunchTime(time) &&
        !isSlotPast(day, time) &&
        !getCustomSlotBlock(day, time, null)
    );
  }

  function clinicManualIsEncaixe(day: Date, time: string, proId: string | null | undefined): boolean {
    if (!proId) return false;
    return (appointmentsBySlot.get(slotKey(day, time)) ?? []).some(
      (a) => a.professional_id === proId
    );
  }

  function applyClinicManualDate(date: Date) {
    const day = startOfDay(date);
    if (isClinicClosedDay(day)) {
      toast.info('Neste dia a clínica está fechada. Escolha outro dia para agendar.');
      return;
    }
    if (!isWorkingDay(day)) {
      toast.info('Este dia não é de atendimento. Escolha outro dia.');
      return;
    }
    const times = clinicManualTimesForDay(day);
    if (times.length === 0) {
      toast.info('Não há horários neste dia. Escolha outra data.');
      return;
    }
    const nextTime =
      (slotTime && times.includes(slotTime)
        ? slotTime
        : times.find((time) => isEmptyBookableSlot(day, time))) ?? times[0]!;
    setSlotDate(day);
    setSlotTime(nextTime);
    setIsEncaixe(clinicManualIsEncaixe(day, nextTime, bookingProfessionalId));
    goToClinicDate(day);
  }

  function openClinicAddAppointment() {
    const day = startOfDay(clinicDay);
    if (isDayBeforeToday(day, todayStart)) {
      toast.info('Não é possível agendar em um dia que já passou. Escolha uma data futura.');
      return;
    }
    if (isClinicClosedDay(day)) {
      toast.info('Neste dia a clínica está fechada. Escolha outro dia para agendar.');
      return;
    }
    if (!isWorkingDay(day)) {
      toast.info('Este dia não é de atendimento. Escolha outro dia na agenda.');
      return;
    }
    if (!professionalId) {
      toast.error('Sessão não carregada. Faça login novamente.');
      return;
    }
    const availableTimes = clinicManualTimesForDay(day);
    if (availableTimes.length === 0) {
      toast.info('Não há horários neste dia. Escolha outra data na agenda.');
      return;
    }
    const preferred =
      availableTimes.find((time) => isEmptyBookableSlot(day, time)) ?? availableTimes[0]!;
    const defaultPro =
      clinicAgendaFilterProId !== 'all'
        ? clinicAgendaFilterProId
        : clinicBookableProfessionals.length === 1
        ? clinicBookableProfessionals[0]!.userId
        : !isFrontDeskStaff
          ? professionalId
          : null;

    setClinicManualAdd(true);
    setBookingProfessionalId(defaultPro);
    setBookingProcedureName(null);
    setBookingSalonProcedureId(null);
    setBookingClinicProcedureId('');
    setBookingAgendaStatus(DEFAULT_CLINIC_APPOINTMENT_STATUS);
    setEncaixeFlowActive(false);
    setIsEncaixe(clinicManualIsEncaixe(day, preferred, defaultPro));
    setSlotDate(day);
    setBulkSlotTimes(null);
    setSlotTime(preferred);
    setSelectedPatientId(patientIdFromUrl || '');
    setPreRegistrationName('');
    setPreRegistrationPhone('');
    setNotes('');
    setDialogPatients([]);
    setDialogPatientsLoading(true);
    toast.loading('Carregando pacientes...', { id: 'agenda-load-patients' });
    supabase
      .from('patients')
      .select('id, full_name, nickname, phone, is_active')
      .eq('professional_id', professionalId)
      .eq('is_active', true)
      .order('full_name')
      .then(({ data, error }) => {
        setDialogPatientsLoading(false);
        toast.dismiss('agenda-load-patients');
        if (error) {
          console.error(error);
          toast.error('Erro ao carregar lista de pacientes.');
          return;
        }
        setDialogPatients((data || []) as unknown as Patient[]);
        setDialogOpen(true);
      });
  }

  function clearLongPressArm() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function clearSlotDragListeners() {
    const drag = slotDragRef.current;
    if (!drag) return;
    window.removeEventListener('pointermove', drag.onMove);
    window.removeEventListener('pointerup', drag.onUp);
    window.removeEventListener('pointercancel', drag.onUp);
  }

  function findAgendaSlotFromPoint(
    clientX: number,
    clientY: number
  ): { dateStr: string; time: string; salonProfessionalId?: string } | null {
    const el = document.elementFromPoint(clientX, clientY);
    const slot = el?.closest?.('[data-agenda-slot="1"]') as HTMLElement | null;
    if (!slot?.dataset.agendaDate || !slot.dataset.agendaTime) return null;
    const pro = slot.dataset.agendaPro?.trim();
    return {
      dateStr: slot.dataset.agendaDate,
      time: slot.dataset.agendaTime,
      salonProfessionalId: pro || undefined,
    };
  }

  function buildDragSelectionTimes(
    date: Date,
    lockedTimes: string[],
    hoverTime: string,
    salonProfessionalId: string | undefined,
    mode: 'extend' | 'create'
  ): string[] {
    const locked = sortTimesBySlotOrder(lockedTimes, timeSlots);
    if (locked.length === 0) return [];
    const hoverIdx = timeSlots.indexOf(hoverTime);
    if (hoverIdx < 0) return locked;

    if (mode === 'create') {
      const startIdx = timeSlots.indexOf(locked[0]!);
      if (startIdx < 0) return locked;
      const from = Math.min(startIdx, hoverIdx);
      const to = Math.max(startIdx, hoverIdx);
      const selected: string[] = [locked[0]!];
      if (hoverIdx >= startIdx) {
        for (let i = startIdx + 1; i <= to; i++) {
          const t = timeSlots[i]!;
          if (!isEmptyBookableSlot(date, t, salonProfessionalId)) break;
          selected.push(t);
        }
      } else {
        for (let i = startIdx - 1; i >= from; i--) {
          const t = timeSlots[i]!;
          if (!isEmptyBookableSlot(date, t, salonProfessionalId)) break;
          selected.unshift(t);
        }
      }
      return sortTimesBySlotOrder(selected, timeSlots);
    }

    const lastLocked = locked[locked.length - 1]!;
    const lastIdx = timeSlots.indexOf(lastLocked);
    if (lastIdx < 0 || hoverIdx <= lastIdx) return locked;
    const extras: string[] = [];
    for (let i = lastIdx + 1; i <= hoverIdx; i++) {
      const t = timeSlots[i]!;
      if (!isEmptyBookableSlot(date, t, salonProfessionalId)) break;
      extras.push(t);
    }
    return [...locked, ...extras];
  }

  function beginSlotDrag(
    params: {
      mode: 'extend' | 'create';
      day: Date;
      lockedTimes: string[];
      extendSource?: Appointment;
      salonProfessionalId?: string;
    },
    e: ReactPointerEvent
  ) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (longProcedureSelection && !slotDragRef.current) return;

    clearSlotDragListeners();

    const onMove = (ev: PointerEvent) => {
      const drag = slotDragRef.current;
      if (!drag || ev.pointerId !== drag.pointerId) return;

      const dx = ev.clientX - drag.originX;
      const dy = ev.clientY - drag.originY;
      const isTouchLike = drag.pointerType === 'touch' || drag.pointerType === 'pen';
      // Toque no mobile treme fácil — limiar maior que mouse.
      const activateThreshold = isTouchLike ? 36 : 10;
      const moved = Math.hypot(dx, dy);
      if (!drag.activated && moved >= activateThreshold) {
        // Movimento = arraste/scroll: cancela long-press (procedimento longo / estender).
        clearLongPressArm();
      }
      if (!drag.activated && moved < activateThreshold) return;

      const hit = findAgendaSlotFromPoint(ev.clientX, ev.clientY);
      if (hit && hit.dateStr === drag.dateStr) {
        if (drag.salonProfessionalId) {
          if (!hit.salonProfessionalId || hit.salonProfessionalId !== drag.salonProfessionalId) {
            if (!drag.activated) return;
            return;
          }
        }
      }

      if (!drag.activated) {
        // No touch, só entra em "procedimento longo" ao passar por outro horário
        // (evita barra vermelha no toque simples / scroll).
        if (drag.mode === 'create' && isTouchLike) {
          if (!hit || hit.dateStr !== drag.dateStr || hit.time === drag.lockedTimes[0]) {
            return;
          }
        }

        const initialTimes =
          hit && hit.dateStr === drag.dateStr
            ? buildDragSelectionTimes(
                drag.date,
                drag.lockedTimes,
                hit.time,
                drag.salonProfessionalId,
                drag.mode
              )
            : drag.lockedTimes;

        if (drag.mode === 'create' && isTouchLike && initialTimes.length < 2) {
          return;
        }

        drag.activated = true;
        clearLongPressArm();
        suppressNextSlotClickRef.current = true;
        setExtendOffer(null);
        setOccupiedSlot(null);
        setLongProcedureSelection({
          date: drag.date,
          times: initialTimes,
          lockedTimes: drag.mode === 'extend' ? drag.lockedTimes : undefined,
          extendSource: drag.extendSource,
          salonProfessionalId: drag.salonProfessionalId,
        });
      }

      if (!hit || hit.dateStr !== drag.dateStr) return;
      // Com colunas por profissional, só aceita o mesmo profissional do arraste.
      if (drag.salonProfessionalId) {
        if (!hit.salonProfessionalId || hit.salonProfessionalId !== drag.salonProfessionalId) {
          return;
        }
      }

      const nextTimes = buildDragSelectionTimes(
        drag.date,
        drag.lockedTimes,
        hit.time,
        drag.salonProfessionalId,
        drag.mode
      );
      setLongProcedureSelection((prev) => {
        if (!prev) {
          return {
            date: drag.date,
            times: nextTimes,
            lockedTimes: drag.mode === 'extend' ? drag.lockedTimes : undefined,
            extendSource: drag.extendSource,
            salonProfessionalId: drag.salonProfessionalId,
          };
        }
        const same =
          prev.times.length === nextTimes.length && prev.times.every((t, i) => t === nextTimes[i]);
        if (same) return prev;
        return { ...prev, times: nextTimes };
      });
    };

    const onUp = (ev: PointerEvent) => {
      const drag = slotDragRef.current;
      if (!drag || ev.pointerId !== drag.pointerId) return;
      window.removeEventListener('pointermove', drag.onMove);
      window.removeEventListener('pointerup', drag.onUp);
      window.removeEventListener('pointercancel', drag.onUp);
      const activated = drag.activated;
      const mode = drag.mode;
      const lockedTimes = drag.lockedTimes;
      const isTouchLike = drag.pointerType === 'touch' || drag.pointerType === 'pen';
      slotDragRef.current = null;

      if (!activated) return;
      suppressNextSlotClickRef.current = true;
      setLongProcedureSelection((prev) => {
        if (!prev) return prev;
        if (mode === 'extend') {
          const locked = new Set(lockedTimes);
          const hasExtra = prev.times.some((t) => !locked.has(t));
          if (!hasExtra) {
            toast.message('Arraste pelos horários livres seguintes para estender.');
            return prev;
          }
          toast.success('Seleção pronta. Confirme a extensão na barra inferior.', { duration: 3500 });
          return prev;
        }
        // Arraste incompleto (1 horário): cancela — toque simples não deve ficar no modo bloco.
        if (prev.times.length < 2) {
          if (!isTouchLike) {
            toast.message('Arraste por mais horários livres para montar o bloco.');
          }
          return null;
        }
        return prev;
      });
    };

    slotDragRef.current = {
      mode: params.mode,
      date: params.day,
      dateStr: format(params.day, 'yyyy-MM-dd'),
      lockedTimes: params.lockedTimes,
      extendSource: params.extendSource,
      salonProfessionalId: params.salonProfessionalId,
      pointerId: e.pointerId,
      pointerType: e.pointerType || 'mouse',
      originX: e.clientX,
      originY: e.clientY,
      activated: false,
      onMove,
      onUp,
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function getAppointmentBlockTimes(apt: Appointment): string[] {
    if (apt.appointment_block_id) {
      return sortTimesBySlotOrder(
        appointments
          .filter(
            (a) =>
              a.appointment_block_id === apt.appointment_block_id &&
              (!apt.professional_id || a.professional_id === apt.professional_id)
          )
          .map((a) => timeToKey(a.start_time)),
        timeSlots
      );
    }
    return [timeToKey(apt.start_time)];
  }

  function startExtendAppointmentMode(
    date: Date,
    apt: Appointment,
    salonProfessionalId?: string
  ) {
    const lockedTimes = getAppointmentBlockTimes(apt);
    if (lockedTimes.length === 0) {
      toast.error('Não foi possível identificar o horário do atendimento.');
      return;
    }
    setOccupiedSlot(null);
    setExtendOffer(null);
    setLongProcedureSelection({
      date,
      times: lockedTimes,
      lockedTimes,
      extendSource: apt,
      salonProfessionalId: salonProfessionalId ?? apt.professional_id ?? undefined,
    });
    toast.success(
      'Estender: arraste ou toque nos horários livres seguintes. Depois use «Confirmar extensão».',
      { duration: 6000 }
    );
  }

  function armLongProcedurePointer(
    day: Date,
    time: string,
    e: ReactPointerEvent,
    salonProfessionalId?: string
  ) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (longProcedureSelection || extendOffer) return;
    if (!isEmptyBookableSlot(day, time, salonProfessionalId)) return;

    const isTouchPointer = e.pointerType === 'touch' || e.pointerType === 'pen';

    beginSlotDrag(
      {
        mode: 'create',
        day,
        lockedTimes: [time],
        salonProfessionalId,
      },
      e
    );

    clearLongPressArm();
    const onEarlyRelease = () => {
      clearLongPressArm();
      window.removeEventListener('pointerup', onEarlyRelease);
      window.removeEventListener('pointercancel', onEarlyRelease);
    };
    window.addEventListener('pointerup', onEarlyRelease);
    window.addEventListener('pointercancel', onEarlyRelease);

    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      window.removeEventListener('pointerup', onEarlyRelease);
      window.removeEventListener('pointercancel', onEarlyRelease);
      if (slotDragRef.current?.activated) return;
      suppressNextSlotClickRef.current = true;
      setLongProcedureSelection({ date: day, times: [time], salonProfessionalId });
      toast.success(
        'Procedimento longo: arraste ou toque em horários livres seguidos. Use «Agendar bloco» ou Esc para sair.',
        { duration: 6000 }
      );
    }, isTouchPointer ? 1200 : 1000);
  }

  function armExtendOccupiedPointer(
    day: Date,
    time: string,
    apps: Appointment[],
    e: ReactPointerEvent,
    salonProfessionalId?: string
  ) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (longProcedureSelection || extendOffer) return;
    if (apps.length === 0) return;

    const apt = apps.find((a) => a.is_block_start) ?? apps[0]!;
    const lockedTimes = getAppointmentBlockTimes(apt);
    const isTouchPointer = e.pointerType === 'touch' || e.pointerType === 'pen';

    beginSlotDrag(
      {
        mode: 'extend',
        day,
        lockedTimes,
        extendSource: apt,
        salonProfessionalId: salonProfessionalId ?? apt.professional_id ?? undefined,
      },
      e
    );

    clearLongPressArm();
    const onEarlyRelease = () => {
      clearLongPressArm();
      window.removeEventListener('pointerup', onEarlyRelease);
      window.removeEventListener('pointercancel', onEarlyRelease);
    };
    window.addEventListener('pointerup', onEarlyRelease);
    window.addEventListener('pointercancel', onEarlyRelease);

    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      window.removeEventListener('pointerup', onEarlyRelease);
      window.removeEventListener('pointercancel', onEarlyRelease);
      if (slotDragRef.current?.activated) return;
      suppressNextSlotClickRef.current = true;
      setExtendOffer({
        date: day,
        time,
        appointments: apps,
        salonProfessionalId,
      });
    }, isTouchPointer ? 1200 : 1000);
  }

  function confirmLongProcedureBooking() {
    const sel = longProcedureSelection;
    if (!sel?.times.length || sel.extendSource) return;
    const sorted = sortTimesBySlotOrder(sel.times, timeSlots);
    for (const t of sorted) {
      if (!isEmptyBookableSlot(sel.date, t, sel.salonProfessionalId)) {
        toast.error('Algum horário do bloco não está mais livre. Ajuste a seleção.');
        return;
      }
    }
    setLongProcedureSelection(null);
    if (sel.salonProfessionalId) {
      setSalonSlotAvailableProIds([sel.salonProfessionalId]);
      setSalonSelectedProfessionalId(sel.salonProfessionalId);
      setBookingProfessionalId(sel.salonProfessionalId);
    }
    proceedOpenBooking(sel.date, sorted[0], sorted);
  }

  async function confirmExtendAppointment() {
    const sel = longProcedureSelection;
    const source = sel?.extendSource;
    if (!sel || !source || !professionalId) return;

    const locked = new Set(sel.lockedTimes ?? []);
    const allTimes = sortTimesBySlotOrder(sel.times, timeSlots);
    const extraTimes = allTimes.filter((t) => !locked.has(t));
    if (extraTimes.length === 0) {
      toast.info('Toque em pelo menos um horário livre para estender.');
      return;
    }
    if (!areIndicesContiguous(contiguousSlotIndices(allTimes, timeSlots))) {
      toast.error('Os horários precisam ser seguidos na grade.');
      return;
    }

    const salonPro = sel.salonProfessionalId ?? source.professional_id ?? undefined;
    for (const t of extraTimes) {
      if (!isEmptyBookableSlot(sel.date, t, salonPro)) {
        toast.error(`O horário ${t} não está mais livre.`);
        return;
      }
    }

    setExtendingAppointment(true);
    try {
      const dateStr = format(sel.date, 'yyyy-MM-dd');
      const targetProfessionalId = source.professional_id || professionalId;
      let blockId = source.appointment_block_id ?? null;

      if (!blockId) {
        blockId = crypto.randomUUID();
        const { error: updateErr } = await supabase
          .from('appointments')
          .update({
            appointment_block_id: blockId,
            is_block_start: true,
          } as never)
          .eq('id', source.id);
        if (updateErr) throw updateErr;
      }

      const insertedAll: Appointment[] = [];
      for (const t of extraTimes) {
        const timeStr = t.length === 5 ? `${t}:00` : t;
        const { data: inserted, error } = await supabase
          .from('appointments')
          .insert({
            professional_id: targetProfessionalId,
            patient_id: source.patient_id,
            full_name: source.full_name,
            pre_registration_phone: source.pre_registration_phone,
            appointment_date: dateStr,
            start_time: timeStr,
            notes: source.notes,
            is_encaixe: source.is_encaixe ?? false,
            appointment_block_id: blockId,
            is_block_start: false,
            ...(isClinic
              ? clinicStatusWritePayload(
                  resolveClinicAppointmentStatus({
                    clinicStatus: source.clinic_status,
                    presenceConfirmedAt: source.presence_confirmed_at,
                  })
                )
              : {}),
          } as never)
          .select(
            isClinic
              ? 'id, patient_id, full_name, pre_registration_phone, appointment_date, start_time, notes, is_encaixe, appointment_block_id, is_block_start, professional_id, clinic_status, presence_confirmed_at'
              : 'id, patient_id, full_name, pre_registration_phone, appointment_date, start_time, notes, is_encaixe, appointment_block_id, is_block_start, professional_id'
          )
          .single();
        if (error) throw error;
        if (inserted) {
          insertedAll.push({
            ...(inserted as Omit<Appointment, 'patients'>),
            professional_id: targetProfessionalId,
            patients: source.patients ?? null,
          });
        }
      }

      setAppointments((prev) => {
        const next = prev.map((a) =>
          a.id === source.id && !source.appointment_block_id
            ? { ...a, appointment_block_id: blockId, is_block_start: true }
            : a
        );
        return [...next, ...insertedAll].sort((a, b) => {
          const d = a.appointment_date.localeCompare(b.appointment_date);
          return d !== 0 ? d : timeToKey(a.start_time).localeCompare(timeToKey(b.start_time));
        });
      });

      setLongProcedureSelection(null);
      toast.success(
        `Atendimento estendido (+${extraTimes.length * SLOT_MINUTES} min): ${extraTimes.join(' · ')}`
      );
      await fetchScheduleRef.current({ silent: true });
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível estender o atendimento.');
      await fetchScheduleRef.current({ silent: true });
    } finally {
      setExtendingAppointment(false);
    }
  }

  useEffect(() => {
    setLongProcedureSelection(null);
    setExtendOffer(null);
    clearLongPressArm();
    clearSlotDragListeners();
    slotDragRef.current = null;
  }, [weekStart]);

  useEffect(() => {
    return () => {
      clearLongPressArm();
      clearSlotDragListeners();
      slotDragRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!longProcedureSelection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLongProcedureSelection(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [longProcedureSelection]);

  /** Horários ainda livres no dia (para o fluxo "Agendar encaixe" após uma consulta). */
  const freeTimesEncaixe = useMemo(() => {
    if (!slotDate || !encaixeFlowActive) return [];
    if (!workingDays.has(slotDate.getDay())) return [];
    return timeSlots.filter((t) => {
      if (isTimeInLunchBreaks(t, lunchBreaks)) return false;
      if (isSlotPast(slotDate, t)) return false;
      if (isSoftBlockedDay(slotDate)) return false;
      if (isClinicClosedDay(slotDate)) return false;
      const key = `${format(slotDate, 'yyyy-MM-dd')}_${t}`;
      if (getCustomSlotBlock(slotDate, t, isSalon ? bookingProfessionalId : null)) return false;
      const apps = appointmentsBySlot.get(key) ?? [];
      if (isSalon && bookingProfessionalId) {
        return !apps.some((a) => a.professional_id === bookingProfessionalId);
      }
      return apps.length === 0;
    });
  }, [
    slotDate,
    encaixeFlowActive,
    timeSlots,
    appointmentsBySlot,
    customBlocksBySlot,
    getCustomSlotBlock,
    isSalon,
    bookingProfessionalId,
    workingDays,
    lunchBreaks,
    todayStart,
    vacationPeriods,
    laserUnavailablePeriods,
    clinicClosedDays,
  ]);

  const clinicManualTimeOptions = useMemo(() => {
    if (!isClinic || !clinicManualAdd || !slotDate) return [];
    return clinicManualTimesForDay(slotDate);
  }, [isClinic, clinicManualAdd, slotDate, timeSlots, lunchBreaks, todayStart, getCustomSlotBlock]);

  useEffect(() => {
    if (!clinicManualAdd || !slotDate || !slotTime) return;
    const next = clinicManualIsEncaixe(slotDate, slotTime, bookingProfessionalId);
    setIsEncaixe((prev) => (prev === next ? prev : next));
  }, [clinicManualAdd, slotDate, slotTime, bookingProfessionalId, appointments]);

  const renderSlotButton = (
    day: Date,
    time: string,
    salonColumnProfessionalId?: string,
    options?: { showTime?: boolean; density?: 'mobile' | 'desktop' }
  ) => {
    const showTime = options?.showTime !== false;
    const slotDensity = options?.density ?? 'mobile';
    const dateStr = format(day, 'yyyy-MM-dd');
    const key = `${dateStr}_${time}`;
    const custom = getCustomSlotBlock(day, time, salonColumnProfessionalId);
    let apps = appointmentsBySlot.get(key) ?? [];
    if (salonColumnProfessionalId) {
      apps = apps.filter((a) => a.professional_id === salonColumnProfessionalId);
    }
    const softBlock = getSoftBlockForDay(day);
    const softCustom = softBlock
      ? { id: `${softBlock.kind}-${dateStr}-${time}`, label: softBlock.label }
      : null;
    const isVacationBlock = !!softCustom && !custom;
    const customBlock = custom ?? softCustom;
    const showCustom = !!customBlock;
    const occupied = !showCustom && apps.length > 0;
    const allEncaixe = occupied && apps.every((a) => a.is_encaixe);
    const occupiedSalonStyle = occupied ? resolveSalonOccupiedStyle(apps) : undefined;
    const customBlockStyle = showCustom ? resolveCustomBlockStyle(isVacationBlock) : undefined;
    const customBlockAccent = showCustom ? resolveCustomBlockAccent(isVacationBlock) : null;
    const salonOccupiedLayout = isSalon && occupied && !salonColumnProfessionalId;
    const buttonKey = salonColumnProfessionalId ? `${key}_${salonColumnProfessionalId}` : key;
    const isPast = isSlotPast(day, time);
    const workingDay = isWorkingDay(day);
    const lunchTime = isLunchTime(time);
    const clinicClosed = isClinicClosedDay(day);
    const hasSlotContent = showCustom || occupied;
    const naturalBlock = (!workingDay && !hasSlotContent) || (lunchTime && !hasSlotContent);
    const isBlocked = naturalBlock;
    const inLongProcedure =
      !!longProcedureSelection &&
      isSameDay(longProcedureSelection.date, day) &&
      longProcedureSelection.times.includes(time) &&
      (!longProcedureSelection.salonProfessionalId ||
        !salonColumnProfessionalId ||
        longProcedureSelection.salonProfessionalId === salonColumnProfessionalId);
    return (
      <button
        key={buttonKey}
        id={
          isSalon && isSameDay(day, new Date())
            ? `agenda-salon-slot-${dateStr}-${time}`
            : undefined
        }
        type="button"
        data-agenda-slot="1"
        data-agenda-date={dateStr}
        data-agenda-time={time}
        data-agenda-pro={salonColumnProfessionalId ?? ''}
        disabled={(isPast && !hasSlotContent) || isBlocked}
        onClick={() => handleSlotClick(day, time, salonColumnProfessionalId)}
        onPointerDown={(e) => {
          if (showCustom || isBlocked) return;
          if (occupied) {
            armExtendOccupiedPointer(day, time, apps, e, salonColumnProfessionalId);
            return;
          }
          if (!isPast) {
            armLongProcedurePointer(day, time, e, salonColumnProfessionalId);
          }
        }}
        title={
          showCustom
            ? customBlock!.label
            : inLongProcedure
              ? longProcedureSelection?.extendSource
                ? 'Incluído na extensão do atendimento'
                : 'Incluído no bloco de procedimento longo'
              : occupied
                ? 'Arraste para baixo para estender · segure para o menu'
                : 'Arraste para selecionar vários horários'
        }
        className={`rounded-xl sm:rounded-lg border text-left px-2 sm:px-2.5 py-1.5 text-sm w-full min-w-0 min-h-[44px] sm:min-h-[40px] lg:min-h-[36px] flex overflow-hidden touch-manipulation select-none transition-all duration-200 ${
          showCustom
            ? isVacationBlock
              ? 'items-center gap-1.5 justify-between bg-rose-50 border-rose-300 hover:bg-rose-100/95 hover:shadow-md text-rose-900 dark:bg-rose-950/40 dark:border-rose-700 dark:text-rose-100 dark:hover:bg-rose-950/55'
              : customBlockStyle
                ? 'items-center gap-1.5 justify-between hover:shadow-md text-foreground'
                : 'items-center gap-1.5 justify-between bg-slate-100/95 border-slate-300 hover:bg-slate-200/90 hover:shadow-md text-foreground dark:bg-slate-900/50 dark:border-slate-600 dark:hover:bg-slate-900/70'
              : occupied
              ? salonOccupiedLayout
                ? 'flex-col items-stretch gap-1'
                : 'items-start gap-1.5'
              : 'items-center justify-between gap-1.5 sm:gap-2'
        } ${
          !showCustom && occupied
            ? occupiedSalonStyle
              ? 'hover:shadow-md text-foreground'
              : isClinic
                ? clinicAppointmentStatusOption(
                    resolveClinicAppointmentStatus({
                      clinicStatus: apps[0]?.clinic_status,
                      presenceConfirmedAt: apps[0]?.presence_confirmed_at,
                    })
                  ).slotClassName
              : allEncaixe
                ? 'bg-violet-50 border-violet-300 hover:bg-violet-100/90 hover:shadow-md text-foreground dark:bg-violet-950/40 dark:border-violet-700 dark:hover:shadow-none'
                : 'bg-amber-50 border-amber-200 hover:bg-amber-100 hover:shadow-md text-foreground'
            : !showCustom && !occupied
              ? isBlocked
                ? 'bg-muted/40 border-border text-muted-foreground cursor-not-allowed opacity-80 disabled:pointer-events-none'
                : isPast
                  ? 'bg-red-50 border-red-200 text-red-900/80 cursor-not-allowed opacity-90 disabled:pointer-events-none'
                  : inLongProcedure
                    ? 'bg-red-50 border-red-500 text-red-950 shadow-sm ring-1 ring-red-300/60 dark:bg-red-950/45 dark:border-red-500 dark:text-red-50 dark:ring-red-800/50'
                    : clinicClosed
                      ? 'bg-slate-100 border-slate-300 hover:bg-slate-200/90 hover:border-slate-400 text-slate-900 dark:bg-slate-900/50 dark:border-slate-600 dark:hover:bg-slate-900/70'
                    : 'bg-card hover:bg-primary/5 border-border hover:border-primary/30 hover:shadow-sm text-foreground'
              : ''
        }`}
        style={
          showCustom && customBlockStyle
            ? customBlockStyle
            : !showCustom && occupied && occupiedSalonStyle
              ? occupiedSalonStyle
              : undefined
        }
      >
        {showCustom ? (
          <>
            {showTime ? (
              <span className="text-sm font-bold tabular-nums shrink-0 leading-none text-foreground">{time}</span>
            ) : null}
            <span className="flex min-w-0 flex-1 items-center justify-end gap-1 text-right">
              <Pin
                className={cn(
                  'h-3 w-3 shrink-0',
                  isVacationBlock ? 'text-rose-600 dark:text-rose-300' : !customBlockAccent ? 'text-slate-500 dark:text-slate-400' : undefined
                )}
                style={customBlockAccent ? { color: customBlockAccent.base } : undefined}
                aria-hidden
              />
              <span
                className={cn(
                  'text-[10px] font-semibold leading-tight line-clamp-2 break-words',
                  isVacationBlock
                    ? 'text-rose-800 dark:text-rose-100'
                    : !customBlockAccent
                      ? 'text-slate-800 dark:text-slate-100'
                      : undefined
                )}
                style={customBlockAccent ? { color: customBlockAccent.dark } : undefined}
              >
                {customBlock!.label}
              </span>
            </span>
          </>
        ) : occupied ? (
          apps.length > 1 || salonOccupiedLayout ? (
            <div className="flex min-w-0 flex-1 flex-col gap-1 w-full">
              {showTime ? (
                <div className="flex w-full items-center justify-between gap-1.5">
                  <span className="text-sm font-bold tabular-nums leading-none text-foreground">{time}</span>
                  {apps.length > 1 ? <OcupadoStatusBadge /> : null}
                </div>
              ) : apps.length > 1 ? (
                <div className="flex justify-end leading-none">
                  <OcupadoStatusBadge />
                </div>
              ) : null}
              <AgendaSlotPatientList apps={apps} density={slotDensity} professionalLabel={salonSlotProfessionalLabel} forClinic={isClinic} />
            </div>
          ) : (
            <>
              {showTime ? (
                <span className="text-sm font-bold tabular-nums shrink-0 leading-none text-foreground">
                  {time}
                </span>
              ) : null}
              <AgendaSlotPatientList apps={apps} density={slotDensity} professionalLabel={salonSlotProfessionalLabel} forClinic={isClinic} />
            </>
          )
        ) : (
          <>
            {showTime ? (
              <span className="text-sm font-bold tabular-nums shrink-0 leading-none text-foreground">
                {time}
              </span>
            ) : null}
            {isBlocked ? (
              <span className="text-muted-foreground/80 shrink-0 text-xs">{!workingDay ? 'Fechado' : getLunchBreakLabelForTime(time, lunchBreaks)}</span>
            ) : isPast ? (
              <span className="text-red-700/70 shrink-0">—</span>
            ) : (
              <span
                className={cn(
                  'flex items-center gap-1 sm:gap-1.5 min-w-0 overflow-hidden text-xs',
                  inLongProcedure
                    ? 'text-red-900 font-medium dark:text-red-100'
                    : 'text-muted-foreground'
                )}
              >
                <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 flex-shrink-0 opacity-80" aria-hidden />
                <span className="min-w-0 sm:inline">{inLongProcedure ? 'No bloco' : clinicClosed ? 'Pessoal' : 'Livre'}</span>
                <span className="sr-only">{clinicClosed ? 'Horário livre para agenda pessoal' : 'Horário livre para agendar'}</span>
              </span>
            )}
          </>
        )}
      </button>
    );
  };

  function renderOccupiedEncaixeSection() {
    if (isSalon || !showOccupiedSlotEncaixe || !occupiedSlot || isClinicClosedDay(occupiedSlot.date)) {
      return null;
    }
    return (
      <>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-3 py-3">
          <Checkbox
            id="consulta-detalhe-encaixe"
            checked={detailEncaixeExpanded}
            disabled={detailSavingEncaixe || saving}
            onCheckedChange={(c) => {
              const next = c === true;
              setDetailEncaixeExpanded(next);
              if (next) fetchDialogPatients();
            }}
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            <Label
              htmlFor="consulta-detalhe-encaixe"
              className="text-sm font-medium cursor-pointer leading-snug"
            >
              Encaixe
            </Label>
            <p className="text-xs text-muted-foreground">
              Consulta extra na grade (fora da rotina usual deste horário).
            </p>
          </div>
        </div>
        {detailEncaixeExpanded ? (
          <div className="space-y-4 border-t border-border pt-4">
            <div className="relative space-y-2" ref={patientDropdownRef}>
              <Label>Paciente</Label>
              <button
                type="button"
                role="combobox"
                aria-expanded={patientComboboxOpen}
                onClick={() => {
                  const next = !patientComboboxOpen;
                  setPatientComboboxOpen(next);
                  if (next) {
                    setPatientSearch('');
                    fetchDialogPatients();
                  }
                }}
                className={cn(
                  'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
                  !selectedPatientId && 'text-muted-foreground'
                )}
              >
                <span>
                  {selectedPatientId
                    ? (() => {
                        const selected =
                          dialogPatients.find((p) => p.id === selectedPatientId) ??
                          patients.find((p) => p.id === selectedPatientId);
                        return selected
                          ? getAgendaPatientLabel(selected, isSalon)
                          : isSalon
                            ? 'Cliente'
                            : 'Paciente';
                      })()
                    : isSalon
                      ? 'Selecione o cliente ou use pré-cadastro'
                      : isClinic
                        ? 'Selecione o paciente'
                        : 'Selecione o paciente ou use pré-cadastro'}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </button>
              {patientComboboxOpen && (
                <div className="absolute z-[100] mt-1 w-full min-w-[200px] rounded-md border border-input bg-popover text-popover-foreground shadow-md">
                  <div className="border-b px-2 py-1.5">
                    <div className="flex items-center gap-2 rounded-sm bg-muted/50 px-2">
                      <Search className="h-4 w-4 shrink-0 opacity-50" />
                      <input
                        type="text"
                        placeholder="Buscar paciente..."
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                        className="flex h-9 w-full bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto p-1">
                    {dialogPatientsLoading ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">Carregando...</div>
                    ) : (() => {
                      const q = patientSearch.trim().toLowerCase();
                      const filtered = filterAgendaPatients(dialogPatients, q, isSalon);
                      return filtered.length === 0 ? (
                        isClinic ? (
                          <ClinicPatientSearchEmpty
                            query={patientSearch}
                            onRegister={openClinicQuickRegister}
                          />
                        ) : (
                          <div className="py-6 text-center text-sm text-muted-foreground">
                            Nenhum paciente encontrado.
                          </div>
                        )
                      ) : (
                        filtered.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="flex w-full cursor-pointer items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                              setSelectedPatientId(p.id);
                              setPreRegistrationName('');
                              setPatientComboboxOpen(false);
                            }}
                          >
                            {getAgendaPatientLabel(p, isSalon)}
                          </button>
                        ))
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
            {isClinic ? (
              <ClinicAgendaBookingFields
                idPrefix="clinic-encaixe"
                procedureId={bookingClinicProcedureId}
                onProcedureIdChange={selectClinicProcedure}
                professionals={clinicBookableProfessionals}
                professionalsLoading={clinicProfessionalsQuery.isLoading}
                professionalId={bookingProfessionalId ?? ''}
                onProfessionalIdChange={setBookingProfessionalId}
                agendaStatus={bookingAgendaStatus}
                onAgendaStatusChange={setBookingAgendaStatus}
              />
            ) : null}
            {!isClinic && (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Não encontrou o paciente?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Preencha nome e telefone para vincular ao paciente. Sem telefone, fica como cadastro rápido.
                  O cadastro completo pode ser feito depois na ficha do
                  paciente.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pre-reg-name" className="text-xs font-normal text-muted-foreground">
                  Nome completo
                </Label>
                <Input
                  id="pre-reg-name"
                  placeholder="Ex.: Maria Silva"
                  value={preRegistrationName}
                  onChange={(e) => {
                    setPreRegistrationName(e.target.value);
                    if (e.target.value.trim()) setSelectedPatientId('');
                  }}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pre-reg-phone" className="text-xs font-normal text-muted-foreground">
                  Telefone (obrigatório para vincular paciente)
                </Label>
                <Input
                  id="pre-reg-phone"
                  placeholder="Para lembrete por WhatsApp"
                  value={formatPhoneDisplay(preRegistrationPhone)}
                  onChange={(e) => setPreRegistrationPhone(normalizePhoneDigits(e.target.value))}
                  className="bg-background"
                />
              </div>
            </div>
            )}
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Ex: retorno, primeira consulta..."
                value={detailEncaixeNotes}
                onChange={(e) => setDetailEncaixeNotes(e.target.value)}
              />
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={
                detailSavingEncaixe ||
                saving ||
                (!selectedPatientId?.trim() && (isClinic || !preRegistrationName?.trim())) ||
                (isClinic && (!bookingProfessionalId || !bookingClinicProcedureId))
              }
              onClick={() => void handleAddEncaixeToOccupiedSlot()}
            >
              {detailSavingEncaixe ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando…
                </>
              ) : (
                'Adicionar encaixe neste horário'
              )}
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  if (loading) {
    return <PageLoading />;
  }

  return (
    <div className="space-y-3 md:space-y-5 animate-fade-in">
      {!isClinic ? (
        <>
      <PageBreadcrumb
        segments={[
          { label: 'Início', path: '/dashboard' },
          { label: 'Agenda' },
        ]}
        className="mb-1 hidden md:block"
      />
      <div className="rounded-lg md:rounded-xl border border-border bg-muted/30 px-3 py-3 md:px-5 md:py-4">
        <div className="flex items-center gap-2 md:gap-5">
          <Button variant="outline" size="icon" className="shrink-0 h-10 w-10 min-h-[44px] min-w-[44px] rounded-xl border-border/80 bg-background hover:bg-muted/50 touch-manipulation" asChild>
            <Link to="/dashboard" title="Voltar ao início">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1 border-l border-border/60 pl-3 md:pl-5">
            <h1 className="text-base md:text-2xl font-bold text-foreground tracking-tight">
              Agenda
            </h1>
          </div>
        </div>
      </div>
        </>
      ) : null}
      {weekClinicClosedDays.length > 0 && (
        <div className="rounded-xl border border-slate-300/70 bg-slate-50/90 px-3 py-2.5 text-slate-900 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Clínica fechada</p>
          <div className="mt-1 space-y-1">
            {weekClinicClosedDays.slice(0, 4).map((day) => (
              <p key={day.id} className="text-sm font-medium">
                {format(parseISO(day.closed_date), "EEEE, d 'de' MMM", { locale: ptBR })}
                {day.note?.trim() ? ` — ${day.note.trim()}` : ` — ${DEFAULT_CLINIC_CLOSED_NOTE}`}
              </p>
            ))}
            {weekClinicClosedDays.length > 4 && (
              <p className="text-xs text-slate-800/80">
                +{weekClinicClosedDays.length - 4} dia(s) adicional(is) nesta semana.
              </p>
            )}
          </div>
        </div>
      )}
      {weekVacationPeriods.length > 0 && (
        <div className="rounded-xl border border-rose-300/70 bg-rose-50/90 px-3 py-2.5 text-rose-900 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Período de férias</p>
          <div className="mt-1 space-y-1">
            {weekVacationPeriods.slice(0, 3).map((period) => (
              <p key={period.id} className="text-sm font-medium">
                {(period.message?.trim() || 'Férias')}: agenda bloqueada de{' '}
                {format(parseISO(period.start_date), "d 'de' MMM", { locale: ptBR })} até{' '}
                {format(parseISO(period.end_date), "d 'de' MMM yyyy", { locale: ptBR })}.
              </p>
            ))}
            {weekVacationPeriods.length > 3 && (
              <p className="text-xs text-rose-800/80">
                +{weekVacationPeriods.length - 3} período(s) adicional(is) nesta semana.
              </p>
            )}
          </div>
        </div>
      )}
      {weekLaserPeriods.length > 0 && (
        <div className="rounded-xl border border-orange-300/70 bg-orange-50/90 px-3 py-2.5 text-orange-950 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Máquina laser indisponível</p>
          <div className="mt-1 space-y-1">
            {weekLaserPeriods.slice(0, 3).map((period) => (
              <p key={period.id} className="text-sm font-medium">
                {laserBlockLabel(period)}: de{' '}
                {format(parseISO(period.start_date), "d 'de' MMM", { locale: ptBR })} até{' '}
                {format(parseISO(period.end_date), "d 'de' MMM yyyy", { locale: ptBR })}.
              </p>
            ))}
            {weekLaserPeriods.length > 3 && (
              <p className="text-xs text-orange-900/80">
                +{weekLaserPeriods.length - 3} período(s) adicional(is) nesta semana.
              </p>
            )}
          </div>
        </div>
      )}
      {isClinic ? (
        <ClinicAgendaBoard
          view={clinicView}
          onViewChange={changeClinicView}
          day={clinicDay}
          visibleDays={visibleDays}
          dateLabel={
            clinicView === 'dia'
              ? format(visibleDays[0] ?? clinicDay, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
              : clinicView === 'mes'
                ? format(agendaRange.start, 'MMMM yyyy', { locale: ptBR })
                : `${format(visibleDays[0] ?? weekStart, "d 'de' MMM", { locale: ptBR })} – ${format(
                    visibleDays[visibleDays.length - 1] ?? addDays(weekStart, 6),
                    "d 'de' MMM yyyy",
                    { locale: ptBR }
                  )}`
          }
          onPrev={() => shiftClinicPeriod(-1)}
          onNext={() => shiftClinicPeriod(1)}
          onToday={goToClinicToday}
          onSelectDate={goToClinicDate}
          onOpenDay={openClinicDayView}
          workingDays={workingDays}
          professionals={clinicBookableProfessionals}
          filterProfessionalId={clinicAgendaFilterProId}
          onFilterProfessionalId={setClinicAgendaFilterProId}
          timeSlots={timeSlots}
          appointments={clinicVisibleAppointments}
          isLunchTime={isLunchTime}
          lunchLabel={(time) => getLunchBreakLabelForTime(time, lunchBreaks)}
          isSlotPast={isSlotPast}
          isWorkingDay={isWorkingDay}
          isClinicClosed={isClinicClosedDay}
          getCustomBlock={(date, time) => {
            const block = getCustomSlotBlock(date, time);
            return block ? { label: block.label } : null;
          }}
          getSoftBlock={getSoftBlockForDay}
          onNewAppointment={openClinicAddAppointment}
          onSlotClick={(date, time) =>
            handleSlotClick(
              date,
              time,
              clinicAgendaFilterProId === 'all' ? undefined : clinicAgendaFilterProId
            )
          }
        />
      ) : (
      <>
      <div className="flex flex-col gap-2 md:gap-3">
        {isClinic ? (
          <div
            className="inline-flex w-full max-w-md mx-auto rounded-full border border-primary/25 bg-primary/85 p-1 shadow-sm"
            role="group"
            aria-label="Período da agenda"
          >
            {([
              { id: 'dia', label: 'Dia' },
              { id: 'semana', label: 'Semana' },
              { id: 'mes', label: 'Mês' },
            ] as const).map((mode) => {
              const active = clinicView === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => changeClinicView(mode.id)}
                  aria-pressed={active}
                  className={[
                    'h-9 flex-1 rounded-full text-sm font-semibold transition-all duration-200',
                    active
                      ? 'bg-background text-foreground shadow-sm ring-1 ring-primary/15'
                      : 'text-primary-foreground/95 hover:bg-primary-foreground/18',
                  ].join(' ')}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        ) : null}
        {/* Navegação da semana */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between p-2 md:p-3">
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => {
                if (isClinic) shiftClinicPeriod(-1);
                else if (isSalon) shiftSalonWeek(-7);
                else setWeekStart((d) => addDays(d, -7));
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex flex-col items-center gap-1 px-2 min-w-0">
              {isClinic ? (
                <>
                  <Popover open={clinicDatePickerOpen} onOpenChange={setClinicDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex max-w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-center hover:bg-accent transition-colors capitalize"
                        aria-label="Escolher data na agenda"
                      >
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">
                          {clinicView === 'dia'
                            ? format(visibleDays[0] ?? clinicDay, "EEEE, d 'de' MMM yyyy", {
                                locale: ptBR,
                              })
                            : clinicView === 'mes'
                              ? format(agendaRange.start, "MMMM yyyy", { locale: ptBR })
                              : `${format(visibleDays[0] ?? weekStart, "d 'de' MMM", { locale: ptBR })} – ${format(
                                  visibleDays[visibleDays.length - 1] ?? addDays(weekStart, 6),
                                  "d 'de' MMM yyyy",
                                  { locale: ptBR }
                                )}`}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 z-[1300]"
                      align="center"
                      sideOffset={8}
                      onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                      <DateCalendar
                        mode="single"
                        selected={clinicView === 'dia' ? clinicDay : agendaRange.start}
                        defaultMonth={clinicView === 'dia' ? clinicDay : agendaRange.start}
                        onSelect={(date) => {
                          if (date) goToClinicDate(date);
                        }}
                        locale={ptBR}
                        weekStartsOn={0}
                        disabled={(date) => workingDays.size > 0 && !workingDays.has(date.getDay())}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 rounded-full border-primary/25 bg-primary/10 px-3 text-xs font-semibold text-primary shadow-none hover:bg-primary/15 hover:text-primary"
                      onClick={goToClinicToday}
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                      Hoje
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 gap-1.5 rounded-full px-3 text-xs font-semibold"
                      onClick={openClinicAddAppointment}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar
                    </Button>
                  </div>
                </>
              ) : isSalon ? (
                <>
                  <Popover
                    open={salonDatePickerOpen}
                    onOpenChange={(open) => {
                      setSalonDatePickerOpen(open);
                      if (open) {
                        const today = new Date();
                        const base =
                          salonFocusDate && /^\d{4}-\d{2}-\d{2}$/.test(salonFocusDate)
                            ? parseISO(salonFocusDate)
                            : salonPickerDate;
                        const pickerInWeek = weekDays.some((d) => isSameDay(d, base));
                        if (!pickerInWeek) {
                          const todayInWeek = weekDays.some((d) => isSameDay(d, today));
                          setSalonPickerDate(todayInWeek ? today : weekStart);
                        } else {
                          setSalonPickerDate(base);
                        }
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="xl:hidden inline-flex max-w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-center hover:bg-accent transition-colors"
                        aria-label="Escolher data na agenda"
                      >
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">
                          {format(weekStart, "d 'de' MMM", { locale: ptBR })} –{' '}
                          {format(addDays(weekStart, 6), "d 'de' MMM yyyy", { locale: ptBR })}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 z-[1300]"
                      align="center"
                      sideOffset={8}
                      onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                      <DateCalendar
                        mode="single"
                        selected={
                          salonFocusDate ? parseISO(salonFocusDate) : salonPickerDate
                        }
                        defaultMonth={
                          salonFocusDate ? parseISO(salonFocusDate) : salonPickerDate
                        }
                        onSelect={(date) => {
                          if (date) goToSalonDate(date);
                        }}
                        locale={ptBR}
                        weekStartsOn={0}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="hidden xl:inline text-sm font-medium text-center">
                    {format(weekStart, "d 'de' MMM", { locale: ptBR })} –{' '}
                    {format(addDays(weekStart, 6), "d 'de' MMM yyyy", { locale: ptBR })}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 rounded-full border-primary/25 bg-primary/10 px-3 text-xs font-semibold text-primary shadow-none hover:bg-primary/15 hover:text-primary"
                    onClick={goToSalonToday}
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    Hoje
                  </Button>
                </>
              ) : (
                <span className="text-sm font-medium text-center">
                  {format(weekStart, "d 'de' MMM", { locale: ptBR })} –{' '}
                  {format(addDays(weekStart, 6), "d 'de' MMM yyyy", { locale: ptBR })}
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => {
                if (isClinic) shiftClinicPeriod(1);
                else if (isSalon) shiftSalonWeek(7);
                else setWeekStart((d) => addDays(d, 7));
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>

      <>
        {isClinic && clinicView === 'mes' ? (
          <Card className="overflow-hidden">
            <CardContent className="p-3 md:p-4">
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${clinicMonthWeekdays.length}, minmax(0, 1fr))` }}
              >
                {clinicMonthWeekdays.map((weekday) => (
                  <p
                    key={weekday}
                    className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][weekday]}
                  </p>
                ))}
                {Array.from({
                  length: Math.max(
                    0,
                    clinicMonthWeekdays.indexOf(visibleDays[0]?.getDay() ?? clinicMonthWeekdays[0]!)
                  ),
                }).map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {visibleDays.map((day) => {
                  const dayKey = format(day, 'yyyy-MM-dd');
                  const isToday = isSameDay(day, new Date());
                  const count = appointments.filter((a) => a.appointment_date === dayKey).length;
                  const clinicClosed = isClinicClosedDay(day);
                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => openClinicDayView(day)}
                      className={cn(
                        'min-h-[72px] rounded-xl border px-2 py-2 text-left transition-colors hover:bg-muted/50',
                        isToday ? 'border-primary bg-primary/10' : 'border-border bg-card',
                        clinicClosed && 'opacity-70'
                      )}
                    >
                      <span className={cn('block text-sm font-semibold', isToday && 'text-primary')}>
                        {format(day, 'd')}
                      </span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {clinicClosed
                          ? 'Fechada'
                          : count === 0
                            ? 'Livre'
                            : `${count} ${count === 1 ? 'consulta' : 'consultas'}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : null}
        {/* Mobile/tablet: um card por dia. Clínica no Dia também usa cards no desktop. */}
        {!(isClinic && clinicView === 'mes') ? (
        <>
        <div className={clinicUsesCardLayout ? 'space-y-3' : 'space-y-3 xl:hidden'}>
          {visibleDays.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const isToday = isSameDay(day, new Date());
            const isFocusedDay = isSalon && salonFocusDate === dayKey;
            const isPastDay = isSalon && isDayBeforeToday(day, todayStart);
            const isDayExpanded = !isPastDay || !!salonPastDaysExpanded[dayKey];
            const workingDay = isWorkingDay(day);
            const clinicClosed = isClinicClosedDay(day);
            const clinicClosedNote =
              getClinicClosedDayForDate(day, clinicClosedDays)?.note?.trim() || DEFAULT_CLINIC_CLOSED_NOTE;

            const dayHeader = (
              <CardTitle className="text-xs md:text-sm flex items-center gap-2 flex-wrap">
                <Calendar className="w-4 h-4" />
                {format(day, "EEEE, d 'de' MMM", { locale: ptBR })}
                {isToday && (
                  <span className="text-xs font-normal text-primary bg-primary/10 px-2 py-0.5 rounded">
                    Hoje
                  </span>
                )}
                {isFocusedDay && !isToday ? (
                  <span className="text-xs font-normal text-primary bg-primary/10 px-2 py-0.5 rounded">
                    Selecionado
                  </span>
                ) : null}
                {clinicClosed && (
                  <span className="text-[10px] font-medium text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded">
                    {clinicClosedNote}
                  </span>
                )}
                {isPastDay ? (
                  <ChevronDown
                    className={cn(
                      'ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                      isDayExpanded && 'rotate-180'
                    )}
                    aria-hidden
                  />
                ) : null}
              </CardTitle>
            );

            const slotsContent = !workingDay ? (
              <div className="text-xs text-muted-foreground py-4 text-center">
                Sem expediente neste dia.
              </div>
            ) : showSalonProfessionalColumns ? (
              <div
                className="grid gap-2 min-w-0"
                style={{
                  gridTemplateColumns: `repeat(${salonBookableProfessionals.length}, minmax(0, 1fr))`,
                }}
              >
                {salonBookableProfessionals.map((pro) => (
                  <div key={pro.userId} className="min-w-0 flex flex-col gap-1.5">
                    <div
                      className="rounded-lg border bg-muted/40 px-2 py-1.5 text-center"
                      style={
                        pro.color
                          ? { borderColor: `${pro.color}55`, backgroundColor: `${pro.color}12` }
                          : undefined
                      }
                    >
                      <p
                        className="text-[11px] font-bold uppercase tracking-wide truncate"
                        style={pro.color ? { color: pro.color } : undefined}
                        title={pro.name}
                      >
                        {pro.displayLabel}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 min-w-0">
                      {timeSlots.map((time) => renderSlotButton(day, time, pro.userId))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className={cn(
                  'grid gap-1.5 min-w-0',
                  isClinic && clinicView === 'dia'
                    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'
                    : 'grid-cols-2 lg:grid-cols-3'
                )}
              >
                {timeSlots.map((time) => renderSlotButton(day, time))}
              </div>
            );

            if (isPastDay) {
              return (
                <Collapsible
                  key={dayKey}
                  open={isDayExpanded}
                  onOpenChange={(open) =>
                    setSalonPastDaysExpanded((prev) => ({ ...prev, [dayKey]: open }))
                  }
                >
                  <Card
                    id={isSalon ? `agenda-salon-day-${dayKey}` : undefined}
                    className={cn(
                      isSalon && 'scroll-mt-20',
                      isFocusedDay && 'ring-2 ring-primary/40'
                    )}
                  >
                    <CollapsibleTrigger asChild>
                      <button type="button" className="w-full text-left">
                        <CardHeader className="py-1.5 px-2.5 md:py-2 md:px-3">
                          {dayHeader}
                        </CardHeader>
                        {!isDayExpanded ? (
                          <p className="px-2.5 pb-2.5 text-xs text-muted-foreground md:px-3">
                            Toque para ver horários passados
                          </p>
                        ) : null}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 px-2.5 md:px-3 pb-2.5 md:pb-3 min-w-0 overflow-hidden">
                        {slotsContent}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            }

            return (
              <Card
                key={dayKey}
                id={isSalon ? `agenda-salon-day-${dayKey}` : undefined}
                className={cn(
                  (isToday || isFocusedDay) && 'ring-2 ring-primary/30',
                  isFocusedDay && 'ring-primary/50',
                  isSalon && 'scroll-mt-20'
                )}
              >
                <CardHeader className="py-1.5 px-2.5 md:py-2 md:px-3">{dayHeader}</CardHeader>
                <CardContent className="pt-0 px-2.5 md:px-3 pb-2.5 md:pb-3 min-w-0 overflow-hidden">
                  {slotsContent}
                </CardContent>
              </Card>
            );
          })}
        </div>
          {/* Desktop: tabela semanal */}
          <Card className={cn('hidden overflow-hidden', clinicUsesCardLayout ? 'xl:hidden' : 'xl:block')}>
            <CardContent className="p-0">
              <div className="overflow-x-auto hide-scrollbar">
                <table className="w-full border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="w-16 sticky left-0 z-10 bg-muted/50 p-2 text-left text-xs font-medium text-muted-foreground border-r">
                        Horário
                      </th>
                      {visibleDays.map((day) => {
                        const dayKey = format(day, 'yyyy-MM-dd');
                        const isTodayCol = isSameDay(day, new Date());
                        const isFocusedCol = isSalon && salonFocusDate === dayKey;
                        return (
                        <th
                          key={day.toISOString()}
                          id={isSalon ? `agenda-salon-desktop-day-${dayKey}` : undefined}
                        className={`p-2 text-center text-xs font-medium ${
                          showSalonProfessionalColumns ? 'min-w-[140px]' : 'min-w-[96px]'
                        } ${
                            isTodayCol || isFocusedCol
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-muted-foreground'
                          }`}
                        >
                          <span className="block capitalize">
                            {format(day, 'EEE', { locale: ptBR })}
                          </span>
                          <span className="text-sm font-normal block mt-0.5">
                            {format(day, 'd/MM', { locale: ptBR })}
                          </span>
                          {showSalonProfessionalColumns ? (
                            <div className="mt-1.5 flex gap-1 border-t border-border/50 pt-1.5">
                              {salonBookableProfessionals.map((pro) => (
                                <span
                                  key={pro.userId}
                                  className="flex-1 truncate text-[9px] font-bold uppercase tracking-wide"
                                  style={pro.color ? { color: pro.color } : undefined}
                                  title={pro.name}
                                >
                                  {pro.displayLabel}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map((time) => (
                      <tr
                        key={time}
                        id={
                          isSalon && time === salonScrollTargetTime
                            ? 'agenda-salon-desktop-slot-current'
                            : undefined
                        }
                        className="border-b last:border-0 hover:bg-muted/20"
                      >
                        <td className="sticky left-0 z-10 bg-background px-2 py-1.5 text-xs font-bold tabular-nums text-foreground border-r align-top">
                          {time}
                        </td>
                      {visibleDays.map((day) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const key = `${dateStr}_${time}`;
                        const custom = getCustomSlotBlock(day, time);
                        const softBlock = getSoftBlockForDay(day);
                        const softCustom = softBlock
                          ? { id: `${softBlock.kind}-desktop-${dateStr}-${time}`, label: softBlock.label }
                          : null;
                        const isVacationBlock = !!softCustom && !custom;
                        const customBlock = custom ?? softCustom;
                        const apps = appointmentsBySlot.get(key) ?? [];
                        const showCustom = !!customBlock;
                        const occupied = !showCustom && apps.length > 0;
                        const allEncaixe = occupied && apps.every((a) => a.is_encaixe);
                        const occupiedSalonStyle = occupied ? resolveSalonOccupiedStyle(apps) : undefined;
                        const customBlockStyle = showCustom ? resolveCustomBlockStyle(isVacationBlock) : undefined;
                        const customBlockAccent = showCustom ? resolveCustomBlockAccent(isVacationBlock) : null;
                        const isPast = isSlotPast(day, time);
                        const workingDay = isWorkingDay(day);
                        const lunchTime = isLunchTime(time);
                        const clinicClosed = isClinicClosedDay(day);
                        const hasSlotContent = showCustom || occupied;
                        const naturalBlock = (!workingDay && !hasSlotContent) || (lunchTime && !hasSlotContent);
                        const isBlocked = naturalBlock;
                        const inLongProcedure =
                          !!longProcedureSelection &&
                          isSameDay(longProcedureSelection.date, day) &&
                          longProcedureSelection.times.includes(time) &&
                          !longProcedureSelection.salonProfessionalId;
                        return (
                          <td key={key} className="p-1 align-top">
                            {showSalonProfessionalColumns ? (
                              <div className="flex gap-1 min-w-0">
                                {salonBookableProfessionals.map((pro) => (
                                  <div key={pro.userId} className="flex-1 min-w-0">
                                    {renderSlotButton(day, time, pro.userId, {
                                      showTime: false,
                                      density: 'desktop',
                                    })}
                                  </div>
                                ))}
                              </div>
                            ) : (
                            <button
                              type="button"
                              data-agenda-slot="1"
                              data-agenda-date={dateStr}
                              data-agenda-time={time}
                              data-agenda-pro=""
                              disabled={(isPast && !hasSlotContent) || isBlocked}
                              onClick={() => handleSlotClick(day, time)}
                              onPointerDown={(e) => {
                                if (showCustom || isBlocked) return;
                                if (occupied) {
                                  armExtendOccupiedPointer(day, time, apps, e);
                                  return;
                                }
                                if (!isPast) {
                                  armLongProcedurePointer(day, time, e);
                                }
                              }}
                              title={
                                showCustom
                                  ? customBlock!.label
                                  : inLongProcedure
                                    ? longProcedureSelection?.extendSource
                                      ? 'Incluído na extensão do atendimento'
                                      : 'Selecionado no procedimento longo'
                                    : occupied
                                      ? 'Arraste para baixo para estender · segure para o menu'
                                      : 'Arraste para selecionar vários horários'
                              }
                              className={`w-full min-h-[40px] lg:min-h-[36px] rounded-lg border text-left px-2 py-1.5 text-sm flex touch-manipulation select-none transition-all duration-200 ${
                                showCustom
                                  ? isVacationBlock
                                    ? 'items-center gap-1.5 justify-between bg-rose-50 border-rose-300 hover:bg-rose-100/95 hover:shadow-md text-rose-900 dark:bg-rose-950/40 dark:border-rose-700 dark:text-rose-100 dark:hover:bg-rose-950/55'
                                    : customBlockStyle
                                      ? 'items-center gap-1.5 justify-between hover:shadow-md text-foreground'
                                      : 'items-center gap-1.5 justify-between bg-slate-100/95 border-slate-300 hover:bg-slate-200/90 hover:shadow-md dark:bg-slate-900/50 dark:border-slate-600'
                                  : occupied
                                    ? 'items-start gap-1.5'
                                    : 'items-center justify-between gap-2'
                              } ${
                                !showCustom && occupied
                                  ? occupiedSalonStyle
                                    ? 'hover:shadow-md text-foreground'
                                    : isClinic
                                      ? clinicAppointmentStatusOption(
                                          resolveClinicAppointmentStatus({
                                            clinicStatus: apps[0]?.clinic_status,
                                            presenceConfirmedAt: apps[0]?.presence_confirmed_at,
                                          })
                                        ).slotClassName
                                    : allEncaixe
                                      ? 'bg-violet-50 border-violet-300 hover:bg-violet-100/90 hover:shadow-md text-foreground dark:bg-violet-950/40 dark:border-violet-700 dark:hover:shadow-none'
                                      : 'bg-amber-50 border-amber-200 hover:bg-amber-100 hover:shadow-md text-foreground'
                                  : !showCustom && !occupied
                                    ? isBlocked
                                      ? 'bg-muted/40 border-border text-muted-foreground cursor-not-allowed opacity-80 disabled:pointer-events-none'
                                      : isPast
                                        ? 'bg-red-50 border-red-200 text-red-900/80 cursor-not-allowed opacity-90 disabled:pointer-events-none'
                                        : inLongProcedure
                                          ? 'bg-red-50 border-red-500 text-red-950 shadow-sm ring-1 ring-red-300/60 dark:bg-red-950/45 dark:border-red-500 dark:text-red-50 dark:ring-red-800/50'
                                          : clinicClosed
                                            ? 'bg-slate-100 border-slate-300 hover:bg-slate-200/90 hover:border-slate-400 text-slate-900 dark:bg-slate-900/50 dark:border-slate-600 dark:hover:bg-slate-900/70'
                                          : 'bg-card hover:bg-primary/5 border-border hover:border-primary/30 hover:shadow-sm text-foreground'
                                    : ''
                              }`}
                              style={
                                showCustom && customBlockStyle
                                  ? customBlockStyle
                                  : !showCustom && occupied && occupiedSalonStyle
                                    ? occupiedSalonStyle
                                    : undefined
                              }
                            >
                              {showCustom ? (
                                <>
                                  <Pin
                                    className={cn(
                                      'h-3.5 w-3.5 shrink-0',
                                      isVacationBlock
                                        ? 'text-rose-600 dark:text-rose-300'
                                        : !customBlockAccent
                                          ? 'text-slate-500 dark:text-slate-400'
                                          : undefined
                                    )}
                                    style={customBlockAccent ? { color: customBlockAccent.base } : undefined}
                                    aria-hidden
                                  />
                                  <span
                                    className={cn(
                                      'min-w-0 flex-1 text-right text-[10px] font-semibold leading-tight line-clamp-3 break-words',
                                      isVacationBlock
                                        ? 'text-rose-800 dark:text-rose-100'
                                        : !customBlockAccent
                                          ? 'text-slate-800 dark:text-slate-100'
                                          : undefined
                                    )}
                                    style={customBlockAccent ? { color: customBlockAccent.dark } : undefined}
                                  >
                                    {customBlock!.label}
                                  </span>
                                </>
                              ) : occupied ? (
                                apps.length > 1 || (isSalon && isSalonMultiProfessionalSlot(apps)) ? (
                                  <div className="flex w-full min-w-0 flex-col gap-1">
                                    <div className="flex justify-end leading-none">
                                      {apps.length > 1 ? <OcupadoStatusBadge /> : null}
                                    </div>
                                    <AgendaSlotPatientList apps={apps} density="desktop" professionalLabel={salonSlotProfessionalLabel} forClinic={isClinic} />
                                  </div>
                                ) : (
                                  <AgendaSlotPatientList apps={apps} density="desktop" professionalLabel={salonSlotProfessionalLabel} forClinic={isClinic} />
                                )
                              ) : isBlocked ? (
                                <span className="text-muted-foreground/80 ml-auto text-xs">
                                  {!workingDay ? 'Fechado' : getLunchBreakLabelForTime(time, lunchBreaks)}
                                </span>
                              ) : isPast ? (
                                <span className="text-red-700/70">—</span>
                              ) : (
                                <span
                                  className={cn(
                                    'flex items-center gap-1.5 ml-auto text-xs',
                                    inLongProcedure
                                      ? 'text-red-900 font-medium dark:text-red-100'
                                      : 'text-muted-foreground'
                                  )}
                                  title={inLongProcedure ? 'No bloco (procedimento longo)' : clinicClosed ? 'Horário livre para agenda pessoal' : 'Horário livre'}
                                >
                                  <UserPlus className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden />
                                  {inLongProcedure ? 'No bloco' : clinicClosed ? 'Pessoal' : 'Livre'}
                                </span>
                              )}
                            </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
        ) : null}
      </>
      </>
      )}
      <MobileBottomSafeSpacer />

      {/* Modal: escolher paciente (novo agendamento) ou passo 1 do encaixe (escolher horário) */}
      <Dialog
        open={dialogOpen && !occupiedSlot}
        onOpenChange={(o) => {
          if (!o && clinicQuickRegisterOpen) return;
          if (!o) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {encaixeFlowActive && !slotTime
                ? 'Encaixe — horário'
                : clinicManualAdd
                  ? 'Novo agendamento'
                : isSalon
                  ? `Agendar ${uiCopy.consultationLower}`
                  : 'Agendar consulta'}
            </DialogTitle>
            <DialogDescription>
              {encaixeFlowActive && !slotTime
                ? 'Escolha um horário livre no mesmo dia para cadastrar uma consulta extra (encaixe).'
                : clinicManualAdd
                  ? 'Abre no dia selecionado na agenda. Ajuste o dia e o horário se precisar.'
                : isSalon
                  ? 'Selecione o cliente e adicione observações opcionais.'
                  : isClinic
                    ? 'Selecione o paciente, o tipo de atendimento, o profissional e o status.'
                    : 'Selecione o paciente e adicione observações opcionais.'}
            </DialogDescription>
          </DialogHeader>

          {slotDate && encaixeFlowActive && !slotTime && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                {format(slotDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
              {freeTimesEncaixe.length === 0 ? (
                <p className="text-sm text-amber-800 dark:text-amber-200/90 rounded-lg border border-amber-200/80 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
                  Não há horários livres neste dia na grade. Avance com as setas na agenda para outra semana ou feche e toque em um dia com vaga.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="encaixe-horario">Horário livre</Label>
                  <Select
                    onValueChange={(v) => {
                      setSlotTime(v);
                    }}
                  >
                    <SelectTrigger id="encaixe-horario" className="w-full">
                      <SelectValue placeholder="Selecione o horário" />
                    </SelectTrigger>
                    <SelectContent>
                      {freeTimesEncaixe.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter className="sm:justify-between gap-2">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          )}

          {slotDate && slotTime && (
            <>
          {clinicManualAdd && isClinic ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="clinic-manual-dia">Dia</Label>
                <Popover modal={false}>
                  <PopoverTrigger asChild>
                    <Button
                      id="clinic-manual-dia"
                      type="button"
                      variant="outline"
                      className="h-10 w-full justify-start font-normal capitalize"
                    >
                      <Calendar className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        {format(slotDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 z-[1600]"
                    align="start"
                    onCloseAutoFocus={(e) => e.preventDefault()}
                  >
                    <DateCalendar
                      mode="single"
                      selected={slotDate}
                      defaultMonth={slotDate}
                      onSelect={(date) => {
                        if (date) applyClinicManualDate(date);
                      }}
                      locale={ptBR}
                      weekStartsOn={0}
                      disabled={(date) => workingDays.size > 0 && !workingDays.has(date.getDay())}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clinic-manual-hora">Horário</Label>
                <Select
                  value={slotTime}
                  onValueChange={(time) => {
                    setSlotTime(time);
                    setIsEncaixe(clinicManualIsEncaixe(slotDate, time, bookingProfessionalId));
                  }}
                >
                  <SelectTrigger id="clinic-manual-hora">
                    <SelectValue placeholder="Selecione o horário" />
                  </SelectTrigger>
                  <SelectContent className="z-[1600]">
                    {clinicManualTimeOptions.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
          <p className="text-sm text-muted-foreground py-1">
              {format(slotDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              {bulkSlotTimes && bulkSlotTimes.length > 1
                ? ` — bloco: ${bulkSlotTimes.map((t) => timeToKey(t)).join(' · ')} (${bulkSlotTimes.length * SLOT_MINUTES} min)`
                : ` às ${slotTime}`}
            </p>
          )}
          {isSalon && (bookingProfessionalId || bookingProcedureName) ? (
            <div className="flex flex-wrap gap-2 mb-2">
              {bookingProfessionalId ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/30 px-2.5 py-1 text-xs">
                  <span
                    className="h-2.5 w-2.5 rounded-full border shrink-0"
                    style={{
                      backgroundColor:
                        salonLabelColorByUserId.get(bookingProfessionalId) ?? '#2563eb',
                    }}
                  />
                  {salonBookableProfessionals.find((p) => p.userId === bookingProfessionalId)
                    ?.name ?? 'Profissional'}
                </span>
              ) : null}
              {bookingProcedureName ? (
                <span className="inline-flex rounded-lg border bg-muted/30 px-2.5 py-1 text-xs font-medium">
                  {bookingProcedureName}
                </span>
              ) : null}
            </div>
          ) : null}
          {encaixeFlowActive && (
            <p className="text-xs text-amber-800 dark:text-amber-200/90 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 rounded-lg px-3 py-2 mb-2">
              Este horário será salvo como <strong>encaixe</strong> (consulta extra na grade).
            </p>
          )}
          <div className="space-y-4 py-2">
            <div className="relative space-y-2" ref={patientDropdownRef}>
              <Label>{isSalon ? uiCopy.patient : 'Paciente'}</Label>
              <button
                type="button"
                role="combobox"
                aria-expanded={patientComboboxOpen}
                onClick={() => {
                  const next = !patientComboboxOpen;
                  setPatientComboboxOpen(next);
                  if (next) {
                    setPatientSearch('');
                    fetchDialogPatients();
                  }
                }}
                className={cn(
                  'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
                  !selectedPatientId && 'text-muted-foreground'
                )}
              >
                <span>
                  {selectedPatientId
                    ? (() => {
                        const selected =
                          dialogPatients.find((p) => p.id === selectedPatientId) ??
                          patients.find((p) => p.id === selectedPatientId);
                        return selected
                          ? getAgendaPatientLabel(selected, isSalon)
                          : isSalon
                            ? 'Cliente'
                            : 'Paciente';
                      })()
                    : isSalon
                      ? 'Selecione o cliente ou use pré-cadastro'
                      : isClinic
                        ? 'Selecione o paciente'
                        : 'Selecione o paciente ou use pré-cadastro'}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </button>
              {patientComboboxOpen && (
                <div className="absolute z-[100] mt-1 w-full min-w-[200px] rounded-md border border-input bg-popover text-popover-foreground shadow-md">
                  <div className="border-b px-2 py-1.5">
                    <div className="flex items-center gap-2 rounded-sm bg-muted/50 px-2">
                      <Search className="h-4 w-4 shrink-0 opacity-50" />
                      <input
                        type="text"
                        placeholder="Buscar paciente..."
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                        className="flex h-9 w-full bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto p-1">
                    {dialogPatientsLoading ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">Carregando...</div>
                    ) : (() => {
                      const q = patientSearch.trim().toLowerCase();
                      const filtered = filterAgendaPatients(dialogPatients, q, isSalon);
                      return filtered.length === 0 ? (
                        isClinic ? (
                          <ClinicPatientSearchEmpty
                            query={patientSearch}
                            onRegister={openClinicQuickRegister}
                          />
                        ) : (
                          <div className="py-6 text-center text-sm text-muted-foreground">Nenhum paciente encontrado.</div>
                        )
                      ) : (
                        filtered.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="flex w-full cursor-pointer items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                              setSelectedPatientId(p.id);
                              setPreRegistrationName('');
                              setPatientComboboxOpen(false);
                            }}
                          >
                            {getAgendaPatientLabel(p, isSalon)}
                          </button>
                        ))
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
            {isClinic ? (
              <ClinicAgendaBookingFields
                procedureId={bookingClinicProcedureId}
                onProcedureIdChange={selectClinicProcedure}
                professionals={clinicBookableProfessionals}
                professionalsLoading={clinicProfessionalsQuery.isLoading}
                professionalId={bookingProfessionalId ?? ''}
                onProfessionalIdChange={(proId) => {
                  setBookingProfessionalId(proId);
                  if (clinicManualAdd && slotDate && slotTime) {
                    setIsEncaixe(clinicManualIsEncaixe(slotDate, slotTime, proId));
                  }
                }}
                agendaStatus={bookingAgendaStatus}
                onAgendaStatusChange={setBookingAgendaStatus}
              />
            ) : null}
            {!isClinic && (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Não encontrou o paciente?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Preencha nome e telefone para vincular ao paciente. Sem telefone, fica como cadastro rápido.
                  O cadastro completo pode ser feito depois na ficha do paciente.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pre-reg-name" className="text-xs font-normal text-muted-foreground">Nome completo</Label>
                <Input
                  id="pre-reg-name"
                  placeholder="Ex.: Maria Silva"
                  value={preRegistrationName}
                  onChange={(e) => {
                    setPreRegistrationName(e.target.value);
                    if (e.target.value.trim()) setSelectedPatientId('');
                  }}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pre-reg-phone" className="text-xs font-normal text-muted-foreground">
                  Telefone (obrigatório para vincular paciente)
                </Label>
                <Input
                  id="pre-reg-phone"
                  placeholder="Para lembrete por WhatsApp"
                  value={formatPhoneDisplay(preRegistrationPhone)}
                  onChange={(e) => setPreRegistrationPhone(normalizePhoneDigits(e.target.value))}
                  className="bg-background"
                />
              </div>
            </div>
            )}
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Ex: retorno, primeira consulta..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                (!selectedPatientId?.trim() && (isClinic || !preRegistrationName?.trim())) ||
                (isClinic && (!bookingProfessionalId || !bookingClinicProcedureId))
              }
            >
              {saving ? 'Salvando...' : 'Agendar'}
            </Button>
          </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ClinicQuickPatientDialog
        open={clinicQuickRegisterOpen && isClinic}
        onOpenChange={setClinicQuickRegisterOpen}
        professionalId={
          isClinicMaster && bookingProfessionalId ? bookingProfessionalId : professionalId
        }
        initialName={clinicQuickRegisterName}
        onCreated={(patient) => {
          setDialogPatients((prev) => {
            if (prev.some((p) => p.id === patient.id)) return prev;
            return [
              { id: patient.id, full_name: patient.full_name, phone: patient.phone, is_active: true },
              ...prev,
            ];
          });
          setSelectedPatientId(patient.id);
          setPreRegistrationName('');
          setPreRegistrationPhone('');
          setPatientSearch('');
        }}
      />

      {/* Modal: horário ocupado — detalhes da clínica ou lista (salão / profissional). */}
      {isClinic && occupiedSlot ? (
        <ClinicAppointmentDetailsDialog
          open
          onOpenChange={(o) => {
            if (!o && clinicQuickRegisterOpen) return;
            if (!o) closeOccupiedOnly();
          }}
          date={occupiedSlot.date}
          time={occupiedSlot.time}
          appointments={occupiedSlot.appointments}
          professionals={clinicBookableProfessionals}
          clinicName={profile?.app_name || profile?.full_name}
          saving={saving}
          isCompleted={isAgendaAppointmentCompleted}
          onDelete={(apt) => void handleDeleteAppointment(apt)}
          onStatusChange={(appointmentId, status) => {
            const payload = clinicStatusWritePayload(status, {
              presence_confirmed_at: appointments.find((a) => a.id === appointmentId)
                ?.presence_confirmed_at,
            });
            setAppointments((prev) =>
              prev.map((apt) =>
                apt.id === appointmentId
                  ? {
                      ...apt,
                      clinic_status: payload.clinic_status,
                      presence_confirmed_at: payload.presence_confirmed_at,
                    }
                  : apt
              )
            );
            setOccupiedSlot((prev) =>
              prev
                ? {
                    ...prev,
                    appointments: prev.appointments.map((apt) =>
                      apt.id === appointmentId
                        ? {
                            ...apt,
                            clinic_status: payload.clinic_status,
                            presence_confirmed_at: payload.presence_confirmed_at,
                          }
                        : apt
                    ),
                  }
                : null
            );
          }}
        >
        </ClinicAppointmentDetailsDialog>
      ) : null}

      <Dialog
        open={!!occupiedSlot && !isClinic}
        onOpenChange={(o) => {
          if (!o && clinicQuickRegisterOpen) return;
          if (!o) closeOccupiedOnly();
        }}
      >
        <DialogContent className="sm:max-w-md max-h-none overflow-visible sm:max-h-[min(90vh,720px)] sm:overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isSalon ? `${uiCopy.consultation} agendado` : 'Consulta agendada'}
            </DialogTitle>
            <DialogDescription>
              {isSalon
                ? `Detalhes do ${uiCopy.consultationLower}, profissional e procedimento. Envie lembrete ao ${uiCopy.patient.toLowerCase()} ou desmarque o horário.`
                : 'A consulta regular (não encaixe) aparece primeiro como paciente principal; as marcadas como encaixe vêm em seguida. Envie lembrete, desmarque ou adicione outro encaixe.'}
            </DialogDescription>
          </DialogHeader>
          {occupiedSlot && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground capitalize">
                {format(occupiedSlot.date, "EEEE, d 'de' MMMM", { locale: ptBR })} às {occupiedSlot.time}
              </p>
              <div className="space-y-2">
                {occupiedSlot.appointments.map((apt, index) => {
                  const multi = occupiedSlot.appointments.length > 1;
                  const salonParallel =
                    isSalon && multi && isSalonMultiProfessionalSlot(occupiedSlot.appointments);
                  return (
                  <div
                    key={apt.id}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      {isSalon ? (
                        <div className="space-y-2">
                          {multi && !salonParallel ? (
                            <span
                              className={cn(
                                'inline-flex shrink-0 rounded border px-1.5 py-px text-[9px] font-semibold uppercase leading-none tracking-wide',
                                index === 0
                                  ? 'border-primary/35 bg-primary/10 text-primary'
                                  : 'border-muted-foreground/25 bg-muted/50 text-muted-foreground font-medium'
                              )}
                            >
                              {index === 0 ? 'Principal' : '+ Extra'}
                            </span>
                          ) : null}
                          <SalonSlotAppointmentBlock
                            app={apt}
                            density="desktop"
                            professionalLabel={salonSlotProfessionalLabel}
                            nameClassName="text-sm font-semibold leading-tight text-foreground"
                            variant="dialog"
                          />
                        </div>
                      ) : multi ? (
                        <div className="flex items-start gap-2">
                          {index === 0 ? (
                            <span
                              className="inline-flex shrink-0 rounded border border-primary/35 bg-primary/10 px-1.5 py-px text-[9px] font-semibold uppercase leading-none tracking-wide text-primary"
                              title="Consulta regular neste horário"
                            >
                              Principal
                            </span>
                          ) : (
                            <span
                              className="inline-flex shrink-0 rounded border border-muted-foreground/25 bg-muted/50 px-1.5 py-px text-[9px] font-medium leading-none text-muted-foreground"
                              title="Encaixe"
                            >
                              + Enc.
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-tight text-foreground [overflow-wrap:anywhere]">
                              {displayAppointmentName(apt)}
                            </p>
                            {displayAppointmentNote(apt) && (
                              <p className="mt-0.5 text-xs leading-tight text-muted-foreground [overflow-wrap:anywhere]">
                                Obs: {displayAppointmentNote(apt)}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-tight text-foreground">
                            {displayAppointmentName(apt)}
                          </p>
                          {displayAppointmentNote(apt) && (
                            <p className="mt-0.5 text-xs leading-tight text-muted-foreground [overflow-wrap:anywhere]">
                              Obs: {displayAppointmentNote(apt)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0 sm:pt-0.5">
                      {(() => {
                        const completed = isAgendaAppointmentCompleted(apt);
                        const occupiedPastDay =
                          isSalon &&
                          occupiedSlot != null &&
                          isDayBeforeToday(occupiedSlot.date, startOfDay(new Date()));
                        const completedSession =
                          isSalon && professionalId
                            ? findAgendaCompletedSession(
                                apt,
                                completedSessionsQuery.data,
                                professionalId
                              )
                            : null;
                        const valorLine = completedSession
                          ? formatSalonSessionNotesForDisplay(completedSession.observacoes).valorLine
                          : null;

                        if (isSalon && occupiedPastDay) {
                          if (completed && valorLine) {
                            return (
                              <>
                                <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-2.5 py-1.5 text-sm">
                                  <span className="font-medium text-foreground tabular-nums">
                                    {valorLine}
                                  </span>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 shrink-0"
                                    title="Editar lançamento"
                                    onClick={() => {
                                      const sessionProcNames = parseAllSalonProceduresFromNotes(
                                        completedSession?.observacoes
                                      );
                                      const aptProcName =
                                        salonProcedureNameFromAppointmentNotes(apt.notes);
                                      const procedureNames =
                                        sessionProcNames.length > 0
                                          ? sessionProcNames
                                          : aptProcName
                                            ? [aptProcName]
                                            : [];
                                      setSalonLancamentoTarget({
                                        appointmentId: apt.id,
                                        sessionId: completedSession?.id ?? null,
                                        patientId: apt.patient_id,
                                        patientName: displayAppointmentName(apt),
                                        professionalId:
                                          apt.professional_id ?? professionalId ?? '',
                                        sessionDate: apt.appointment_date,
                                        sessionTime: apt.start_time,
                                        appointmentNotes:
                                          completedSession?.observacoes ?? apt.notes,
                                        procedureLabel:
                                          procedureNames.join(' · ') || aptProcName,
                                        procedureNames,
                                        isAlreadyCompleted: true,
                                        valorLine,
                                      });
                                      setSalonLancamentoOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                {apt.patient_id ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    className="gap-1.5"
                                    asChild
                                  >
                                    <Link to={`/patients/${apt.patient_id}`}>
                                      <Eye className="h-3.5 w-3.5" />
                                      Ver ficha
                                    </Link>
                                  </Button>
                                ) : null}
                              </>
                            );
                          }

                          return (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="gap-1.5"
                                onClick={() => {
                                  const sessionProcNames = parseAllSalonProceduresFromNotes(
                                    completedSession?.observacoes
                                  );
                                  const aptProcName =
                                    salonProcedureNameFromAppointmentNotes(apt.notes);
                                  const procedureNames =
                                    sessionProcNames.length > 0
                                      ? sessionProcNames
                                      : aptProcName
                                        ? [aptProcName]
                                        : [];
                                  setSalonLancamentoTarget({
                                    appointmentId: apt.id,
                                    sessionId: completedSession?.id ?? null,
                                    patientId: apt.patient_id,
                                    patientName: displayAppointmentName(apt),
                                    professionalId: apt.professional_id ?? professionalId ?? '',
                                    sessionDate: apt.appointment_date,
                                    sessionTime: apt.start_time,
                                    appointmentNotes:
                                      completedSession?.observacoes ?? apt.notes,
                                    procedureLabel:
                                      procedureNames.join(' · ') || aptProcName,
                                    procedureNames,
                                    isAlreadyCompleted: completed,
                                    valorLine,
                                  });
                                  setSalonLancamentoOpen(true);
                                }}
                              >
                                <Wallet className="h-3.5 w-3.5" />
                                Lançamento
                              </Button>
                              {!completed ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => void handleDeleteAppointment(apt)}
                                  disabled={saving}
                                >
                                  {saving ? '…' : 'Desmarcar'}
                                </Button>
                              ) : null}
                            </>
                          );
                        }

                        if (completed && apt.patient_id) {
                          return (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="gap-1.5"
                              asChild
                            >
                              <Link to={`/patients/${apt.patient_id}`}>
                                <Eye className="h-3.5 w-3.5" />
                                Ver ficha
                              </Link>
                            </Button>
                          );
                        }

                        return (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="gap-1.5"
                              onClick={() => handleLembrarCliente(apt)}
                              disabled={
                                !phoneToWhatsApp(
                                  apt.patient_id
                                    ? patients.find((p) => p.id === apt.patient_id)?.phone ?? null
                                    : apt.pre_registration_phone ?? null
                                )
                              }
                            >
                              <Bell className="h-3.5 w-3.5" />
                              Lembrar
                            </Button>
                            {!completed ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => void handleDeleteAppointment(apt)}
                                disabled={saving}
                              >
                                {saving ? '…' : 'Desmarcar'}
                              </Button>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  );
                })}
              </div>

              {isSalon &&
                occupiedSlot &&
                !isSlotPast(occupiedSlot.date, occupiedSlot.time) &&
                (() => {
                  const available = getSalonAvailableProfessionalsAtSlot(
                    occupiedSlot.date,
                    occupiedSlot.time
                  );
                  if (available.length === 0) return null;
                  return (
                    <div className="rounded-lg border border-dashed border-primary/35 bg-primary/5 p-3.5 space-y-2.5">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Ainda há {available.length}{' '}
                        {available.length === 1 ? 'profissional livre' : 'profissionais livres'} neste
                        horário: {available.map((p) => p.name).join(', ')}.
                      </p>
                      <Button
                        type="button"
                        className="w-full gap-2"
                        onClick={() =>
                          openSalonAddAnotherProfessional(occupiedSlot.date, occupiedSlot.time)
                        }
                      >
                        <UserPlus className="h-4 w-4" />
                        Agendar outro profissional
                      </Button>
                    </div>
                  );
                })()}

              {!isClinic ? renderOccupiedEncaixeSection() : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {isSalon ? (
        <SalonAgendaLancamentoDialog
          target={salonLancamentoTarget}
          open={salonLancamentoOpen}
          onOpenChange={(open) => {
            setSalonLancamentoOpen(open);
            if (!open) setSalonLancamentoTarget(null);
          }}
          professionalId={professionalId ?? undefined}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ['agenda-completed-sessions'] });
          }}
        />
      ) : null}

      {/* Horário livre: agendar ou bloquear com status */}
      <Dialog
        open={emptySlotChoiceOpen}
        onOpenChange={(o) => {
          if (!o) {
            setEmptySlotChoiceOpen(false);
            setEmptySlotChoice(null);
            setSalonSlotAvailableProIds(null);
          }
        }}
      >
        <DialogContent className="gap-0 overflow-visible p-0 sm:max-w-md sm:rounded-xl">
          <div className="border-b border-border/60 bg-muted/30 px-5 py-4 pr-12 sm:px-6 sm:pr-14">
            <DialogHeader className="space-y-3 text-left">
              <DialogTitle className="text-xl leading-tight">Horário livre</DialogTitle>
              {emptySlotChoice ? (
                <div className="rounded-xl border border-border bg-background/80 px-3.5 py-3 shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Data e hora
                  </p>
                  <p className="mt-1 text-base font-semibold leading-snug text-foreground capitalize">
                    {format(emptySlotChoice.date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-primary">{emptySlotChoice.time}</p>
                </div>
              ) : null}
              <DialogDescription className="text-left text-sm leading-relaxed text-muted-foreground">
                {emptySlotChoice && isClinicClosedOnDay(emptySlotChoice.date, clinicClosedDays)
                  ? 'Neste dia a clínica está fechada para pacientes. Marque o horário como uso pessoal.'
                  : isSalon
                    ? salonSlotAvailableProIds?.length
                      ? 'Escolha o profissional livre, procedimento e agende o cliente neste mesmo horário. O bloqueio vale só para o profissional escolhido.'
                      : 'Escolha profissional, procedimento e agende o cliente — ou bloqueie só aquele profissional neste horário.'
                    : 'Escolha uma ação para este horário.'}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex flex-col gap-2.5 p-4 sm:p-5">
            {isSalon && emptySlotChoice && !isClinicClosedOnDay(emptySlotChoice.date, clinicClosedDays) ? (
              <div className="space-y-3 rounded-xl border bg-muted/20 p-3.5">
                {salonProsForPicker.length > 1 ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="salon-slot-professional">Profissional *</Label>
                    <Select
                      value={salonSelectedProfessionalId}
                      onValueChange={setSalonSelectedProfessionalId}
                    >
                      <SelectTrigger id="salon-slot-professional">
                        <SelectValue placeholder="Selecione o profissional" />
                      </SelectTrigger>
                      <SelectContent>
                        {salonProsForPicker.map((p) => (
                          <SelectItem key={p.userId} value={p.userId}>
                            {p.name}
                            {p.subtitle ? ` — ${p.subtitle}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="salon-slot-procedure">Procedimento *</Label>
                  <SalonProcedureCombobox
                    key={
                      emptySlotChoice
                        ? `${format(emptySlotChoice.date, 'yyyy-MM-dd')}_${emptySlotChoice.time}`
                        : 'salon-slot-procedure'
                    }
                    id="salon-slot-procedure"
                    procedures={salonProceduresQuery.data ?? []}
                    value={salonSelectedProcedureId}
                    onChange={setSalonSelectedProcedureId}
                    loading={salonProceduresQuery.isLoading}
                    placeholder="Digite para filtrar, ex.: Cor"
                  />
                  {!salonProceduresQuery.isLoading &&
                  (salonProceduresQuery.data ?? []).length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      Cadastre procedimentos em Configurações → Cadastrar procedimentos.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {emptySlotChoice && !isClinicClosedOnDay(emptySlotChoice.date, clinicClosedDays) && (
            <button
              type="button"
              className={cn(
                'group flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors',
                'hover:border-primary/40 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              )}
              onClick={() => {
                if (!emptySlotChoice) return;
                const { date, time } = emptySlotChoice;
                if (isSalon) {
                  if (!salonSelectedProfessionalId) {
                    toast.error('Selecione o profissional.');
                    return;
                  }
                  if (!salonSelectedProcedureId) {
                    toast.error('Selecione o procedimento.');
                    return;
                  }
                  const proc = (salonProceduresQuery.data ?? []).find(
                    (p) => p.id === salonSelectedProcedureId
                  );
                  if (!proc) {
                    toast.error('Procedimento inválido.');
                    return;
                  }
                  setEmptySlotChoiceOpen(false);
                  setEmptySlotChoice(null);
                  setSalonSlotAvailableProIds(null);
                  proceedOpenBooking(date, time, undefined, {
                    professionalId: salonSelectedProfessionalId,
                    procedureName: proc.name,
                    procedureId: proc.id,
                  });
                  return;
                }
                setEmptySlotChoiceOpen(false);
                setEmptySlotChoice(null);
                proceedOpenBooking(
                  date,
                  time,
                  undefined,
                  clinicAgendaFilterProId !== 'all'
                    ? { professionalId: clinicAgendaFilterProId, procedureName: '' }
                    : undefined
                );
              }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <UserPlus className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 pt-0.5">
                <span className="block font-semibold text-foreground">
                  {isSalon ? `Agendar ${uiCopy.patient.toLowerCase()}` : 'Agendar paciente'}
                </span>
                <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                  {isSalon
                    ? 'Escolher cliente ou pré-cadastro para o atendimento'
                    : isClinic
                      ? 'Escolher ou cadastrar o paciente da consulta'
                      : 'Nova consulta: escolher paciente ou pré-cadastro'}
                </span>
              </span>
            </button>
            )}
            <button
              type="button"
              className={cn(
                'group flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors',
                'hover:border-slate-400/80 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-950/50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              )}
              onClick={() => {
                if (!emptySlotChoice) return;
                const { date, time } = emptySlotChoice;
                if (isSalon) {
                  const proId = resolveSalonBlockProfessionalId();
                  if (!proId) {
                    toast.error('Selecione o profissional.');
                    return;
                  }
                  setEmptySlotChoiceOpen(false);
                  setEmptySlotChoice(null);
                  openDefineStatusFlow(date, time, { professionalId: proId });
                  return;
                }
                setEmptySlotChoiceOpen(false);
                setEmptySlotChoice(null);
                openDefineStatusFlow(date, time);
              }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-200/90 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <Pin className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 pt-0.5">
                <span className="block font-semibold text-foreground">Bloquear horário</span>
                <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                  {isSalon
                    ? 'Marcar indisponível só para o profissional escolhido (curso, reunião, pessoal…)'
                    : 'Marcar indisponível com um rótulo (curso, reunião, pessoal…)'}
                </span>
              </span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Definir / editar rótulo do bloqueio manual */}
      <Dialog
        open={defineStatusOpen}
        onOpenChange={(o) => {
          if (!o) closeDefineStatusDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar horário indisponível</DialogTitle>
            <DialogDescription>
              {defineStatusCtx ? (
                <>
                  {format(defineStatusCtx.date, "EEEE, d 'de' MMMM", { locale: ptBR })} às{' '}
                  <span className="font-medium text-foreground">{defineStatusCtx.time}</span>
                  {isSalon && defineStatusCtx.professionalId ? (
                    <span className="block mt-1">
                      Somente{' '}
                      <span className="font-medium text-foreground">
                        {salonProfessionalLabel(defineStatusCtx.professionalId)}
                      </span>
                      . O outro profissional continua livre neste horário.
                    </span>
                  ) : null}
                  {defineStatusCtx.replaceAppointments ? (
                    <span className="block mt-2 text-amber-800 dark:text-amber-200">
                      As consultas deste horário serão desmarcadas ao salvar.
                    </span>
                  ) : null}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {defineStatusCtx && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Sugestões</Label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CUSTOM_STATUS_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      size="sm"
                      variant={defineStatusLabel.trim() === preset ? 'default' : 'outline'}
                      className="h-8 rounded-full text-xs"
                      onClick={() => setDefineStatusLabel(preset)}
                    >
                      {preset}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="slot-block-label">Nome do bloqueio</Label>
                <Input
                  id="slot-block-label"
                  placeholder="Ex.: Curso, Pilates, Reunião"
                  value={defineStatusLabel}
                  onChange={(e) => setDefineStatusLabel(e.target.value)}
                  className="bg-background"
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => closeDefineStatusDialog()}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={savingSlotBlock || !defineStatusLabel.trim() || !defineStatusCtx}
              onClick={() => {
                if (!defineStatusCtx) return;
                void saveSlotBlock(defineStatusCtx.date, defineStatusCtx.time, defineStatusLabel, {
                  replaceAppointments: defineStatusCtx.replaceAppointments,
                  professionalId: defineStatusCtx.professionalId,
                });
              }}
            >
              {savingSlotBlock ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando…
                </>
              ) : (
                'Salvar bloqueio'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gerir bloqueio manual existente */}
      <Dialog
        open={manageCustomOpen}
        onOpenChange={(o) => {
          if (!o) {
            setManageCustomOpen(false);
            setManageCustomCtx(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Horário indisponível</DialogTitle>
            <DialogDescription>
              {manageCustomCtx ? (
                <>
                  {format(manageCustomCtx.date, "EEEE, d 'de' MMMM", { locale: ptBR })} às {manageCustomCtx.time}
                  {isSalon && manageCustomCtx.professionalId ? (
                    <span className="block mt-1">
                      {salonProfessionalLabel(manageCustomCtx.professionalId)}
                    </span>
                  ) : null}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {manageCustomCtx && (
            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/50">
              <Pin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 [overflow-wrap:anywhere]">
                {manageCustomCtx.label}
              </p>
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                if (!manageCustomCtx) return;
                const { date, time, label, professionalId: blockProId } = manageCustomCtx;
                setManageCustomOpen(false);
                setManageCustomCtx(null);
                openDefineStatusFlow(date, time, {
                  initialLabel: label,
                  skipPatientConfirm: true,
                  professionalId: blockProId,
                });
              }}
            >
              Alterar nome
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              disabled={savingSlotBlock || !manageCustomCtx}
              onClick={() => {
                if (!manageCustomCtx) return;
                void removeSlotBlock(manageCustomCtx.blockId);
              }}
            >
              {savingSlotBlock ? 'Removendo…' : 'Remover bloqueio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={slotBlockReplaceConfirmOpen}
        onOpenChange={(open) => {
          setSlotBlockReplaceConfirmOpen(open);
          if (!open) setPendingDefineAfterConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desmarcar consultas neste horário?</AlertDialogTitle>
            <AlertDialogDescription>
              Existem{' '}
              {pendingDefineAfterConfirm
                ? (
                    appointmentsBySlot.get(
                      slotKey(pendingDefineAfterConfirm.date, pendingDefineAfterConfirm.time)
                    ) ?? []
                  ).filter(
                    (a) =>
                      !pendingDefineAfterConfirm.professionalId ||
                      a.professional_id === pendingDefineAfterConfirm.professionalId
                  ).length
                : 0}{' '}
              consulta(s) agendada(s)
              {isSalon && pendingDefineAfterConfirm?.professionalId
                ? ` de ${salonProfessionalLabel(pendingDefineAfterConfirm.professionalId)}`
                : ''}
              . Para marcar o horário como indisponível, elas serão desmarcadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const p = pendingDefineAfterConfirm;
                setSlotBlockReplaceConfirmOpen(false);
                setPendingDefineAfterConfirm(null);
                if (p) {
                  closeOccupiedOnly();
                  openDefineStatusFlow(p.date, p.time, {
                    replaceAppointments: true,
                    professionalId: p.professionalId,
                  });
                }
              }}
            >
              Continuar e definir status
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {patients.length === 0 && !loading && !patientsLoading && (
        <p className="text-center text-sm text-muted-foreground">
          Cadastre pacientes para poder agendar.{' '}
          <Link to="/patients/new" className="text-primary underline">
            Novo paciente
          </Link>
        </p>
      )}

      {longProcedureSelection && (
        <div className="fixed inset-x-0 bottom-0 z-[1200] border-t border-red-200/90 bg-red-50/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-sm dark:border-red-900 dark:bg-red-950/95 md:px-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-sm text-red-950 dark:text-red-50">
              <p className="font-semibold">
                {longProcedureSelection.extendSource ? 'Estender atendimento' : 'Procedimento longo'}
              </p>
              <p className="truncate text-xs tabular-nums opacity-90">
                {format(longProcedureSelection.date, "EEE d/MM", { locale: ptBR })}:{' '}
                {sortTimesBySlotOrder(longProcedureSelection.times, timeSlots).join(' · ')} (
                {longProcedureSelection.times.length * SLOT_MINUTES} min)
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-red-300 bg-background dark:border-red-800"
                onClick={() => setLongProcedureSelection(null)}
                disabled={extendingAppointment}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-red-600 text-white hover:bg-red-700"
                disabled={extendingAppointment}
                onClick={() => {
                  if (longProcedureSelection.extendSource) {
                    void confirmExtendAppointment();
                  } else {
                    confirmLongProcedureBooking();
                  }
                }}
              >
                {extendingAppointment
                  ? 'Salvando...'
                  : longProcedureSelection.extendSource
                    ? 'Confirmar extensão'
                    : 'Agendar bloco'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        open={!!extendOffer}
        onOpenChange={(open) => {
          if (!open) setExtendOffer(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estender horário?</AlertDialogTitle>
            <AlertDialogDescription>
              Segure um atendimento e escolha horários livres seguintes para prolongar o mesmo
              cliente/procedimento na grade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {extendOffer && extendOffer.appointments.length > 1 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Qual atendimento deseja estender?</p>
              <div className="flex flex-col gap-2">
                {extendOffer.appointments.map((apt) => {
                  const label =
                    apt.patients?.full_name ||
                    apt.full_name ||
                    'Atendimento';
                  return (
                    <Button
                      key={apt.id}
                      type="button"
                      variant="outline"
                      className="justify-start"
                      onClick={() =>
                        startExtendAppointmentMode(
                          extendOffer.date,
                          apt,
                          extendOffer.salonProfessionalId
                        )
                      }
                    >
                      {formatPatientNameForUi(label)}
                      {apt.start_time ? ` · ${timeToKey(apt.start_time)}` : ''}
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {extendOffer && extendOffer.appointments.length === 1 ? (
              <AlertDialogAction
                onClick={() =>
                  startExtendAppointmentMode(
                    extendOffer.date,
                    extendOffer.appointments[0]!,
                    extendOffer.salonProfessionalId
                  )
                }
              >
                Estender para outros horários
              </AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
