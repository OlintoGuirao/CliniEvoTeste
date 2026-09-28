import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar as DateCalendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ClinicAgendaView } from '@/lib/clinicAgendaView';
import type { ClinicAgendaProfessional } from '@/lib/clinicAgendaBooking';
import {
  clinicAppointmentStatusOption,
  type ClinicAppointmentStatus,
} from '@/lib/clinicAppointmentStatus';
import {
  CLINIC_AGENDA_SLOT_MINUTES,
  clinicAppointmentPatientName,
  clinicAppointmentProcedureLabel,
  clinicAppointmentResolvedStatus,
  clinicDaySummary,
  clinicNextFreeTimes,
  clinicTimeRangeLabel,
  type ClinicAgendaLayoutAppointment,
} from '@/lib/clinicAgendaLayout';
import { ClinicAppointmentStatusGlyph } from '@/components/clinic/ClinicAppointmentStatusSelect';

const CANCELLED_LOOK: ReadonlySet<ClinicAppointmentStatus> = new Set([
  'cancelled_by_professional',
  'cancelled_by_patient',
  'no_show',
  'rescheduled',
]);

const VIEW_MODES: Array<{ id: ClinicAgendaView; label: string }> = [
  { id: 'dia', label: 'Dia' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
];

type SoftBlock = { label: string; kind: 'vacation' | 'laser' } | null;
type CustomBlock = { label: string } | null;

type ClinicAgendaBoardProps = {
  view: ClinicAgendaView;
  onViewChange: (view: ClinicAgendaView) => void;
  day: Date;
  visibleDays: Date[];
  dateLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelectDate: (date: Date) => void;
  onOpenDay: (date: Date) => void;
  workingDays: Set<number>;
  professionals: ClinicAgendaProfessional[];
  filterProfessionalId: string;
  onFilterProfessionalId: (id: string) => void;
  timeSlots: string[];
  appointments: ClinicAgendaLayoutAppointment[];
  isLunchTime: (time: string) => boolean;
  lunchLabel: (time: string) => string;
  isSlotPast: (day: Date, time: string) => boolean;
  isWorkingDay: (day: Date) => boolean;
  isClinicClosed: (day: Date) => boolean;
  getCustomBlock: (day: Date, time: string) => CustomBlock;
  getSoftBlock: (day: Date) => SoftBlock;
  onNewAppointment: () => void;
  onSlotClick: (day: Date, time: string) => void;
};

function slotKey(day: Date, time: string): string {
  return `${format(day, 'yyyy-MM-dd')}_${time.slice(0, 5)}`;
}

function groupAppointmentsBySlot(appointments: ClinicAgendaLayoutAppointment[]) {
  const map = new Map<string, ClinicAgendaLayoutAppointment[]>();
  for (const appointment of appointments) {
    const time = appointment.start_time.slice(0, 5);
    const key = `${appointment.appointment_date}_${time}`;
    const list = map.get(key) ?? [];
    list.push(appointment);
    map.set(key, list);
  }
  return map;
}

function AppointmentCard({
  appointment,
  professionalName,
  compact,
  onOpen,
}: {
  appointment: ClinicAgendaLayoutAppointment;
  professionalName?: string | null;
  compact?: boolean;
  onOpen: () => void;
}) {
  const procedure = clinicAppointmentProcedureLabel(appointment);
  const status = clinicAppointmentResolvedStatus(appointment);
  const statusOpt = clinicAppointmentStatusOption(status);
  const cancelledLook = CANCELLED_LOOK.has(status);
  const name = clinicAppointmentPatientName(appointment);
  const time = appointment.start_time.slice(0, 5);

  return (
    <div
      className={cn(
        'group/card relative w-full rounded-xl border border-l-4 px-3 py-2 text-left shadow-sm transition-shadow hover:shadow-md',
        statusOpt.slotClassName,
        cancelledLook && 'opacity-80',
        compact && 'px-2 py-1.5 rounded-lg'
      )}
    >
      <button type="button" className="block w-full text-left" onClick={onOpen}>
        <div className="flex items-start gap-2 pr-6">
          <ClinicAppointmentStatusGlyph
            status={status}
            className={cn(compact ? 'h-5 w-5' : 'h-6 w-6')}
          />
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'truncate font-semibold leading-tight',
                compact ? 'text-xs' : 'text-sm',
                cancelledLook && 'line-through'
              )}
            >
              {name}
            </p>
            {procedure ? (
              <p className={cn('truncate leading-tight opacity-80', compact ? 'text-[10px]' : 'text-xs')}>
                {procedure}
              </p>
            ) : null}
            <p className={cn('truncate font-medium opacity-90', compact ? 'text-[10px]' : 'text-[11px]')}>
              {statusOpt.label}
            </p>
            {professionalName ? (
              <p className={cn('truncate opacity-70', compact ? 'text-[10px]' : 'text-[11px]')}>
                Profissional: {professionalName}
              </p>
            ) : null}
            {!compact ? (
              <p className="mt-0.5 text-[11px] tabular-nums opacity-80">
                {clinicTimeRangeLabel(time, CLINIC_AGENDA_SLOT_MINUTES)}
              </p>
            ) : null}
          </div>
        </div>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-current/60 hover:bg-white/70 hover:text-current"
            aria-label="Opções do agendamento"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[1600]">
          <DropdownMenuItem onClick={onOpen}>Ver detalhes</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ClinicAgendaBoard({
  view,
  onViewChange,
  day,
  visibleDays,
  dateLabel,
  onPrev,
  onNext,
  onToday,
  onSelectDate,
  onOpenDay,
  workingDays,
  professionals,
  filterProfessionalId,
  onFilterProfessionalId,
  timeSlots,
  appointments,
  isLunchTime,
  lunchLabel,
  isSlotPast,
  isWorkingDay,
  isClinicClosed,
  getCustomBlock,
  getSoftBlock,
  onNewAppointment,
  onSlotClick,
}: ClinicAgendaBoardProps) {
  const [monthDayPopup, setMonthDayPopup] = useState<Date | null>(null);
  const [pastSlotAlertOpen, setPastSlotAlertOpen] = useState(false);
  const bySlot = groupAppointmentsBySlot(appointments);
  const professionalNameById = new Map(professionals.map((p) => [p.userId, p.name]));
  const resolveProfessionalName = (professionalId: string | undefined | null) =>
    professionalNameById.get(professionalId ?? '') ?? null;
  const monthWeekdays = [...new Set(visibleDays.map((item) => item.getDay()))].sort((a, b) => a - b);
  const focusDay = visibleDays[0] ?? day;
  const closed = isClinicClosed(focusDay);

  const monthDayAppointments = useMemo(() => {
    if (!monthDayPopup) return [];
    const dayKey = format(monthDayPopup, 'yyyy-MM-dd');
    return appointments
      .filter((a) => a.appointment_date === dayKey)
      .slice()
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [appointments, monthDayPopup]);

  const isBookable = (target: Date, time: string) => {
    if (!isWorkingDay(target) || isClinicClosed(target)) return false;
    if (isLunchTime(time) || isSlotPast(target, time)) return false;
    if (getSoftBlock(target)) return false;
    if (getCustomBlock(target, time)) return false;
    return (bySlot.get(slotKey(target, time)) ?? []).length === 0;
  };

  const summary = clinicDaySummary({
    appointments: appointments.filter((a) => a.appointment_date === format(focusDay, 'yyyy-MM-dd')),
    timeSlots,
    isBookable: (time) => isBookable(focusDay, time),
  });
  const nextFree = clinicNextFreeTimes(timeSlots, (time) => isBookable(focusDay, time), 5);

  const handleFreeSlotClick = (target: Date, time: string) => {
    if (isSlotPast(target, time)) {
      setPastSlotAlertOpen(true);
      return;
    }
    onSlotClick(target, time);
  };

  function renderDayRows(target: Date, compact = false) {
    if (!isWorkingDay(target)) {
      return (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">Sem expediente neste dia.</p>
      );
    }
    return (
      <div className="divide-y divide-border/70">
        {timeSlots.map((time) => {
          const apps = bySlot.get(slotKey(target, time)) ?? [];
          const custom = getCustomBlock(target, time);
          const lunch = isLunchTime(time);
          const past = isSlotPast(target, time);
          const daySoft = getSoftBlock(target);
          const occupied = apps.length > 0;
          const blocked = Boolean(custom || (!occupied && (lunch || daySoft || closed)));
          return (
            <div
              key={`${format(target, 'yyyy-MM-dd')}_${time}`}
              className={cn(
                'grid grid-cols-[4.25rem_minmax(0,1fr)] items-stretch min-h-[64px]',
                compact && 'min-h-[52px] grid-cols-[3.25rem_minmax(0,1fr)]',
                !occupied && !blocked && !past && 'hover:bg-sky-50/80',
                !occupied && past && 'bg-muted/20',
                lunch && !occupied && 'bg-muted/30'
              )}
            >
              <div
                className={cn(
                  'flex items-start justify-end border-r border-border/70 px-2 pt-3 text-xs font-semibold tabular-nums text-muted-foreground',
                  compact && 'px-1.5 pt-2 text-[11px]'
                )}
              >
                {time}
              </div>
              <div className="min-w-0 px-2 py-1.5 sm:px-3">
                {occupied ? (
                  <div className="flex flex-col gap-1.5">
                    {apps.map((appointment) => (
                      <AppointmentCard
                        key={appointment.id}
                        appointment={appointment}
                        compact={compact}
                        professionalName={resolveProfessionalName(appointment.professional_id)}
                        onOpen={() => onSlotClick(target, time)}
                      />
                    ))}
                  </div>
                ) : custom ? (
                  <button
                    type="button"
                    className="flex h-full min-h-[48px] w-full items-center rounded-lg px-2 text-left text-xs font-medium text-slate-600"
                    onClick={() => onSlotClick(target, time)}
                  >
                    {custom.label}
                  </button>
                ) : lunch ? (
                  <p className="flex h-full min-h-[48px] items-center px-2 text-xs text-muted-foreground">
                    {lunchLabel(time)}
                  </p>
                ) : daySoft ? (
                  <p className="flex h-full min-h-[48px] items-center px-2 text-xs text-muted-foreground">
                    {daySoft.label}
                  </p>
                ) : closed ? (
                  <p className="flex h-full min-h-[48px] items-center px-2 text-xs text-muted-foreground">
                    Clínica fechada
                  </p>
                ) : (
                  <button
                    type="button"
                    className={cn(
                      'flex h-full min-h-[48px] w-full rounded-lg',
                      past && 'cursor-pointer'
                    )}
                    onClick={() => handleFreeSlotClick(target, time)}
                    aria-label={past ? `Horário ${time} encerrado` : `Agendar às ${time}`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl"
            asChild
          >
            <Link to="/dashboard" title="Voltar ao início">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">Agenda</h1>
            </div>
            <p className="text-sm text-muted-foreground">Gerencie seus atendimentos e compromissos</p>
          </div>
        </div>
        <Button className="h-10 shrink-0 gap-1.5 rounded-xl px-4" onClick={onNewAppointment}>
          <Plus className="h-4 w-4" />
          Novo agendamento
        </Button>
      </div>

      <div className="flex justify-center">
        <div
          className="inline-flex w-full max-w-md rounded-full bg-slate-100 p-1 dark:bg-slate-800"
          role="group"
          aria-label="Período da agenda"
        >
          {VIEW_MODES.map((mode) => {
            const active = view === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => onViewChange(mode.id)}
                aria-pressed={active}
                className={cn(
                  'h-9 flex-1 rounded-full text-sm font-semibold transition-all',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={cn(
          'grid gap-4',
          view === 'dia' ? 'xl:grid-cols-[minmax(0,1fr)_17.5rem]' : 'grid-cols-1'
        )}
      >
        <Card className="overflow-hidden rounded-2xl shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-3 md:px-4">
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={onPrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={onNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-lg px-3 text-xs font-semibold"
                onClick={onToday}
              >
                Hoje
              </Button>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="mx-auto inline-flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold capitalize hover:bg-muted"
                  aria-label="Escolher data na agenda"
                >
                  <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{dateLabel}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[1300]" align="center">
                <DateCalendar
                  mode="single"
                  selected={day}
                  defaultMonth={day}
                  onSelect={(date) => {
                    if (date) onSelectDate(date);
                  }}
                  locale={ptBR}
                  weekStartsOn={0}
                  disabled={(date) => workingDays.size > 0 && !workingDays.has(date.getDay())}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <div className="ml-auto w-[11.5rem]">
              <Select value={filterProfessionalId} onValueChange={onFilterProfessionalId}>
                <SelectTrigger className="h-8 rounded-lg text-xs">
                  <SelectValue placeholder="Exibir: Todos" />
                </SelectTrigger>
                <SelectContent className="z-[1600]">
                  <SelectItem value="all">Exibir: Todos</SelectItem>
                  {professionals.map((pro) => (
                    <SelectItem key={pro.userId} value={pro.userId}>
                      {pro.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <CardContent className="p-0">
            {view === 'mes' ? (
              <div className="p-3 md:p-4">
                <div
                  className="grid gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(monthWeekdays.length, 1)}, minmax(0, 1fr))`,
                  }}
                >
                  {monthWeekdays.map((weekday) => (
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
                      monthWeekdays.indexOf(visibleDays[0]?.getDay() ?? monthWeekdays[0] ?? 0)
                    ),
                  }).map((_, i) => (
                    <div key={`pad-${i}`} />
                  ))}
                  {visibleDays.map((item) => {
                    const dayKey = format(item, 'yyyy-MM-dd');
                    const isToday = isSameDay(item, new Date());
                    const dayApps = appointments.filter((a) => a.appointment_date === dayKey);
                    const count = dayApps.length;
                    const dayClosed = isClinicClosed(item);
                    return (
                      <button
                        key={dayKey}
                        type="button"
                        onClick={() => {
                          if (count > 0) {
                            setMonthDayPopup(item);
                            return;
                          }
                          onOpenDay(item);
                        }}
                        className={cn(
                          'min-h-[72px] rounded-xl border px-2 py-2 text-left transition-colors hover:bg-muted/50',
                          isToday ? 'border-primary bg-primary/10' : 'border-border bg-card',
                          dayClosed && 'opacity-70'
                        )}
                      >
                        <span className={cn('block text-sm font-semibold', isToday && 'text-primary')}>
                          {format(item, 'd')}
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {dayClosed
                            ? 'Fechada'
                            : count === 0
                              ? 'Livre'
                              : `${count} ${count === 1 ? 'consulta' : 'consultas'}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : view === 'semana' ? (
              <div className="overflow-x-auto">
                <div
                  className="grid min-w-[720px]"
                  style={{
                    gridTemplateColumns: `4.25rem repeat(${visibleDays.length}, minmax(0, 1fr))`,
                  }}
                >
                  <div className="sticky left-0 z-10 border-b bg-muted/40 px-2 py-2 text-[11px] font-medium text-muted-foreground">
                    Horário
                  </div>
                  {visibleDays.map((item) => (
                    <button
                      key={item.toISOString()}
                      type="button"
                      onClick={() => onOpenDay(item)}
                      className={cn(
                        'border-b px-2 py-2 text-center hover:bg-muted/40',
                        isSameDay(item, new Date()) && 'bg-primary/10 text-primary'
                      )}
                    >
                      <span className="block text-[11px] font-semibold uppercase">
                        {format(item, 'EEE', { locale: ptBR })}
                      </span>
                      <span className="text-sm font-medium">{format(item, 'd/MM')}</span>
                    </button>
                  ))}
                  {timeSlots.map((time) => (
                    <div key={`row-${time}`} className="contents">
                      <div className="sticky left-0 z-10 border-b border-r bg-background px-2 py-2 text-xs font-semibold tabular-nums text-muted-foreground">
                        {time}
                      </div>
                      {visibleDays.map((item) => {
                        const apps = bySlot.get(slotKey(item, time)) ?? [];
                        const custom = getCustomBlock(item, time);
                        const lunch = isLunchTime(time);
                        const past = isSlotPast(item, time);
                        const free = isBookable(item, time);
                        return (
                          <div
                            key={`${format(item, 'yyyy-MM-dd')}_${time}`}
                            className={cn(
                              'min-h-[56px] border-b border-l border-border/50 p-1',
                              free && 'hover:bg-sky-50/80'
                            )}
                          >
                            {apps.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {apps.map((appointment) => (
                                  <AppointmentCard
                                    key={appointment.id}
                                    appointment={appointment}
                                    compact
                                    professionalName={resolveProfessionalName(appointment.professional_id)}
                                    onOpen={() => onSlotClick(item, time)}
                                  />
                                ))}
                              </div>
                            ) : custom ? (
                              <button
                                type="button"
                                className="h-full w-full rounded-md px-1 text-left text-[10px] text-muted-foreground"
                                onClick={() => onSlotClick(item, time)}
                              >
                                {custom.label}
                              </button>
                            ) : lunch ? (
                              <p className="px-1 text-[10px] text-muted-foreground">{lunchLabel(time)}</p>
                            ) : (
                              <button
                                type="button"
                                disabled={!past && !free}
                                className={cn(
                                  'h-full min-h-[44px] w-full rounded-md',
                                  past && 'cursor-pointer'
                                )}
                                onClick={() => handleFreeSlotClick(item, time)}
                                aria-label={
                                  past
                                    ? `Horário ${time} encerrado`
                                    : `Agendar ${format(item, 'd/MM')} às ${time}`
                                }
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              renderDayRows(focusDay)
            )}
          </CardContent>
        </Card>

        {view === 'dia' ? (
          <div className="space-y-4">
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-3 p-4">
                <h2 className="text-sm font-semibold text-foreground">Resumo do dia</h2>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center justify-center gap-0.5 rounded-xl border border-blue-200/90 bg-blue-50 px-1.5 py-2.5 dark:border-blue-800/60 dark:bg-blue-950/40">
                    <span className="text-lg font-bold tabular-nums leading-none text-blue-700 dark:text-blue-300">
                      {summary.confirmed}
                    </span>
                    <span className="text-center text-[10px] font-medium leading-tight text-blue-700/80 dark:text-blue-300/80">
                      {summary.confirmed === 1 ? 'Confirmado' : 'Confirmados'}
                    </span>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-0.5 rounded-xl border border-orange-200/90 bg-orange-50 px-1.5 py-2.5 dark:border-orange-800/60 dark:bg-orange-950/40">
                    <span className="text-lg font-bold tabular-nums leading-none text-orange-700 dark:text-orange-300">
                      {summary.pending}
                    </span>
                    <span className="text-center text-[10px] font-medium leading-tight text-orange-700/80 dark:text-orange-300/80">
                      {summary.pending === 1 ? 'Pendente' : 'Pendentes'}
                    </span>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-0.5 rounded-xl border border-emerald-200/90 bg-emerald-50 px-1.5 py-2.5 dark:border-emerald-800/60 dark:bg-emerald-950/40">
                    <span className="text-lg font-bold tabular-nums leading-none text-emerald-700 dark:text-emerald-300">
                      {summary.free}
                    </span>
                    <span className="text-center text-[10px] font-medium leading-tight text-emerald-700/80 dark:text-emerald-300/80">
                      {summary.free === 1 ? 'Livre' : 'Livres'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-3 p-4">
                <h2 className="text-sm font-semibold">Próximos horários</h2>
                {nextFree.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Não há horários livres neste dia.</p>
                ) : (
                  <ul className="space-y-2">
                    {nextFree.map((time) => (
                      <li key={time}>
                        <button
                          type="button"
                          onClick={() => onSlotClick(focusDay, time)}
                          className="flex w-full items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm hover:bg-muted/40"
                        >
                          <span className="font-semibold tabular-nums">{time}</span>
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Livre
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>

      <Dialog
        open={monthDayPopup != null}
        onOpenChange={(open) => {
          if (!open) setMonthDayPopup(null);
        }}
      >
        <DialogContent className="flex max-h-[min(88dvh,640px)] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md sm:rounded-xl">
          <DialogHeader className="shrink-0 border-b border-border/70 px-4 py-3 sm:px-5">
            <DialogTitle className="text-base capitalize sm:text-lg">
              {monthDayPopup
                ? format(monthDayPopup, "EEEE, d 'de' MMMM", { locale: ptBR })
                : 'Consultas do dia'}
            </DialogTitle>
            <DialogDescription>
              {monthDayAppointments.length}{' '}
              {monthDayAppointments.length === 1 ? 'consulta' : 'consultas'} neste dia
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3 sm:px-5">
            {monthDayAppointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                professionalName={resolveProfessionalName(appointment.professional_id)}
                onOpen={() => {
                  const day = monthDayPopup;
                  const time = appointment.start_time.slice(0, 5);
                  setMonthDayPopup(null);
                  if (day) onSlotClick(day, time);
                }}
              />
            ))}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border/70 bg-muted/20 px-4 py-3 sm:px-5 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                const day = monthDayPopup;
                setMonthDayPopup(null);
                if (day) onOpenDay(day);
              }}
            >
              Ver dia completo
            </Button>
            <Button type="button" className="rounded-xl" onClick={() => setMonthDayPopup(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pastSlotAlertOpen} onOpenChange={setPastSlotAlertOpen}>
        <AlertDialogContent className="z-[1800]">
          <AlertDialogHeader>
            <AlertDialogTitle>Horário indisponível</AlertDialogTitle>
            <AlertDialogDescription>
              Não é possível agendar em um dia ou horário que já passou. Escolha uma data e um horário
              futuros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="rounded-xl">Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
