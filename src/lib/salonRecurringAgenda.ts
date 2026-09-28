import { addDays, format, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { parseLocalDate } from '@/lib/utils';
import { buildSalonAppointmentNotesForBooking, salonRecurringScheduleTag } from '@/lib/salonAppointmentNotes';

/** 0=domingo … 6=sábado (Date.getDay). */
export const SALON_WEEKDAY_OPTIONS = [
  { value: 1, label: 'Segunda-feira', shortLabel: 'Seg' },
  { value: 2, label: 'Terça-feira', shortLabel: 'Ter' },
  { value: 3, label: 'Quarta-feira', shortLabel: 'Qua' },
  { value: 4, label: 'Quinta-feira', shortLabel: 'Qui' },
  { value: 5, label: 'Sexta-feira', shortLabel: 'Sex' },
  { value: 6, label: 'Sábado', shortLabel: 'Sáb' },
  { value: 0, label: 'Domingo', shortLabel: 'Dom' },
] as const;

export type SalonRecurringScheduleRow = {
  id: string;
  organization_id: string;
  patient_id: string;
  professional_id: string;
  salon_procedure_id: string;
  weekday: number;
  start_time: string;
  period_start: string;
  period_end: string;
  created_at: string;
  salon_procedures?: { name: string | null } | null;
  professional?: { full_name: string | null } | null;
};

export function salonWeekdayLabel(weekday: number): string {
  return SALON_WEEKDAY_OPTIONS.find((d) => d.value === weekday)?.label ?? '—';
}

export function normalizeSalonAppointmentTime(value: string): string {
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  return trimmed;
}

export function formatSalonAppointmentTimeDisplay(time: string): string {
  const normalized = normalizeSalonAppointmentTime(time);
  return normalized.slice(0, 5);
}

/** Todas as datas (yyyy-MM-dd) de um weekday dentro do período. */
export function enumerateSalonRecurringDates(
  weekday: number,
  periodStart: string,
  periodEnd: string
): string[] {
  const start = parseLocalDate(periodStart);
  const end = parseLocalDate(periodEnd);
  if (end < start) return [];

  let cursor = start;
  while (getDay(cursor) !== weekday && cursor <= end) {
    cursor = addDays(cursor, 1);
  }

  const dates: string[] = [];
  while (cursor <= end) {
    dates.push(format(cursor, 'yyyy-MM-dd'));
    cursor = addDays(cursor, 7);
  }
  return dates;
}

export async function fetchSalonRecurringSchedulesForPatient(
  patientId: string
): Promise<SalonRecurringScheduleRow[]> {
  const { data, error } = await (supabase as any)
    .from('salon_patient_recurring_schedules')
    .select(
      'id, organization_id, patient_id, professional_id, salon_procedure_id, weekday, start_time, period_start, period_end, created_at, salon_procedures(name)'
    )
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as SalonRecurringScheduleRow[];
}

export async function deleteSalonRecurringSchedule(scheduleId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('salon_patient_recurring_schedules')
    .delete()
    .eq('id', scheduleId);
  if (error) throw new Error(error.message);
}

/** Remove o vínculo e todos os agendamentos gerados por ele na agenda. */
export async function deleteSalonRecurringScheduleWithAppointments(
  scheduleId: string
): Promise<{ deletedAppointments: number }> {
  const tag = salonRecurringScheduleTag(scheduleId);

  const { data: schedule, error: scheduleError } = await (supabase as any)
    .from('salon_patient_recurring_schedules')
    .select('id, patient_id, professional_id')
    .eq('id', scheduleId)
    .maybeSingle();

  if (scheduleError) throw new Error(scheduleError.message);
  if (!schedule) throw new Error('Horário fixo não encontrado.');

  let apptsQuery = supabase.from('appointments').select('id').ilike('notes', `%${tag}%`);
  if (schedule.patient_id) {
    apptsQuery = apptsQuery.eq('patient_id', schedule.patient_id);
  }
  if (schedule.professional_id) {
    apptsQuery = apptsQuery.eq('professional_id', schedule.professional_id);
  }

  const { data: appointments, error: fetchError } = await apptsQuery;
  if (fetchError) throw new Error(fetchError.message);

  const ids = (appointments ?? []).map((row) => row.id);
  if (ids.length > 0) {
    const { data: deleted, error: deleteError } = await supabase
      .from('appointments')
      .delete()
      .in('id', ids)
      .select('id');

    if (deleteError) throw new Error(deleteError.message);
    if ((deleted?.length ?? 0) !== ids.length) {
      throw new Error(
        'Não foi possível remover todos os agendamentos da agenda. Atualize a página e tente novamente.'
      );
    }
  }

  await deleteSalonRecurringSchedule(scheduleId);
  return { deletedAppointments: ids.length };
}

export async function createSalonRecurringScheduleWithAppointments(params: {
  organizationId: string;
  patientId: string;
  professionalId: string;
  salonProcedureId: string;
  procedureName: string;
  weekday: number;
  startTime: string;
  periodStart: string;
  periodEnd: string;
  createdBy: string;
}): Promise<{ scheduleId: string; created: number; skipped: number; dates: string[] }> {
  const timeStr = normalizeSalonAppointmentTime(params.startTime);
  const dates = enumerateSalonRecurringDates(params.weekday, params.periodStart, params.periodEnd);

  if (dates.length === 0) {
    throw new Error('Nenhuma data encontrada no período para o dia da semana escolhido.');
  }

  const { data: schedule, error: scheduleError } = await (supabase as any)
    .from('salon_patient_recurring_schedules')
    .insert({
      organization_id: params.organizationId,
      patient_id: params.patientId,
      professional_id: params.professionalId,
      salon_procedure_id: params.salonProcedureId,
      weekday: params.weekday,
      start_time: timeStr,
      period_start: params.periodStart,
      period_end: params.periodEnd,
      created_by: params.createdBy,
    })
    .select('id')
    .single();

  if (scheduleError || !schedule?.id) {
    throw new Error(scheduleError?.message || 'Não foi possível salvar o horário fixo.');
  }

  const scheduleId = String(schedule.id);
  const notes = buildSalonAppointmentNotesForBooking({
    procedureName: params.procedureName,
    procedureId: params.salonProcedureId,
    scheduleId,
  });

  const { data: occupied, error: occupiedError } = await supabase
    .from('appointments')
    .select('appointment_date')
    .eq('professional_id', params.professionalId)
    .eq('start_time', timeStr)
    .in('appointment_date', dates);

  if (occupiedError) throw new Error(occupiedError.message);

  const occupiedDates = new Set((occupied ?? []).map((row) => row.appointment_date));
  const datesToBook = dates.filter((d) => !occupiedDates.has(d));

  if (datesToBook.length === 0) {
    await deleteSalonRecurringSchedule(scheduleId);
    throw new Error(
      'Todos os horários do período já estão ocupados para este profissional. Escolha outro horário ou período.'
    );
  }

  const rows = datesToBook.map((appointment_date) => ({
    professional_id: params.professionalId,
    patient_id: params.patientId,
    appointment_date,
    start_time: timeStr,
    notes,
    is_encaixe: false,
  }));

  const { error: insertError } = await supabase.from('appointments').insert(rows);
  if (insertError) {
    await deleteSalonRecurringSchedule(scheduleId).catch(() => {});
    throw new Error(insertError.message);
  }

  return {
    scheduleId,
    created: datesToBook.length,
    skipped: dates.length - datesToBook.length,
    dates: datesToBook,
  };
}

export function formatSalonRecurringPeriodLabel(periodStart: string, periodEnd: string): string {
  const start = parseLocalDate(periodStart);
  const end = parseLocalDate(periodEnd);
  return `${format(start, 'dd/MM/yyyy', { locale: ptBR })} — ${format(end, 'dd/MM/yyyy', { locale: ptBR })}`;
}
