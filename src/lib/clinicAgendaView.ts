import { addDays, addMonths, eachDayOfInterval, endOfMonth, startOfDay, startOfMonth, startOfWeek } from 'date-fns';

export type ClinicAgendaView = 'dia' | 'semana' | 'mes';

export const CLINIC_AGENDA_VIEW_STORAGE_KEY = 'clinic-agenda-view';

export function readClinicAgendaView(): ClinicAgendaView {
  try {
    const value = localStorage.getItem(CLINIC_AGENDA_VIEW_STORAGE_KEY);
    if (value === 'dia' || value === 'semana' || value === 'mes') return value;
  } catch {
    /* ignore */
  }
  return 'dia';
}

export function persistClinicAgendaView(view: ClinicAgendaView): void {
  try {
    localStorage.setItem(CLINIC_AGENDA_VIEW_STORAGE_KEY, view);
  } catch {
    /* ignore */
  }
}

/** Primeiro dia com expediente a partir de `from` (inclusive), na direção informada. */
export function stepToWorkingDay(
  from: Date,
  workingDays: Set<number>,
  direction: 1 | -1 = 1
): Date {
  const start = startOfDay(from);
  if (workingDays.size === 0) return start;
  let current = start;
  for (let i = 0; i < 14; i += 1) {
    if (workingDays.has(current.getDay())) return current;
    current = addDays(current, direction);
  }
  return start;
}

export function nextWorkingDay(from: Date, workingDays: Set<number>, direction: 1 | -1): Date {
  return stepToWorkingDay(addDays(startOfDay(from), direction), workingDays, direction);
}

export function clinicAgendaVisibleDays(params: {
  view: ClinicAgendaView;
  day: Date;
  weekStart: Date;
  workingDays: Set<number>;
}): Date[] {
  const { view, day, weekStart, workingDays } = params;
  if (view === 'dia') {
    return [stepToWorkingDay(day, workingDays, 1)];
  }
  if (view === 'mes') {
    const days = eachDayOfInterval({
      start: startOfMonth(weekStart),
      end: endOfMonth(weekStart),
    });
    const open = workingDays.size === 0 ? days : days.filter((item) => workingDays.has(item.getDay()));
    return open.length > 0 ? open : days;
  }
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const open = workingDays.size === 0 ? week : week.filter((item) => workingDays.has(item.getDay()));
  return open.length > 0 ? open : week;
}

export function clinicAgendaFetchRange(params: {
  view: ClinicAgendaView;
  day: Date;
  weekStart: Date;
  workingDays?: Set<number>;
}): { start: Date; end: Date } {
  if (params.view === 'dia') {
    const day = params.workingDays
      ? stepToWorkingDay(params.day, params.workingDays, 1)
      : startOfDay(params.day);
    return { start: day, end: day };
  }
  if (params.view === 'mes') {
    return { start: startOfMonth(params.weekStart), end: endOfMonth(params.weekStart) };
  }
  return { start: params.weekStart, end: addDays(params.weekStart, 6) };
}

export function shiftClinicAgendaAnchor(params: {
  view: ClinicAgendaView;
  day: Date;
  weekStart: Date;
  workingDays: Set<number>;
  direction: 1 | -1;
}): { day: Date; weekStart: Date } {
  if (params.view === 'dia') {
    const day = nextWorkingDay(params.day, params.workingDays, params.direction);
    return { day, weekStart: startOfWeek(day, { weekStartsOn: 0 }) };
  }
  if (params.view === 'mes') {
    const weekStart = addMonths(startOfMonth(params.weekStart), params.direction);
    return { day: stepToWorkingDay(weekStart, params.workingDays, 1), weekStart };
  }
  const weekStart = addDays(params.weekStart, params.direction * 7);
  return { day: stepToWorkingDay(weekStart, params.workingDays, 1), weekStart };
}
