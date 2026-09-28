import { useEffect, useMemo, useState } from 'react';
import { format, addDays, startOfWeek, startOfMonth, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, Loader2, UserPlus } from 'lucide-react';
import { getLunchBreaksFromProfile, getLunchBreakLabelForTime, isTimeInLunchBreaks } from '@/lib/lunchBreaks';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DialogFooter } from '@/components/ui/dialog';
import type { ProfileForAgenda } from '@/components/AgendaDaySlotsContent';

const SLOT_MINUTES = 30;

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

function computeWeekStart(anchor: Date, scope: 'week' | 'month'): Date {
  if (scope === 'month') {
    return startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 });
  }
  return startOfWeek(anchor, { weekStartsOn: 0 });
}

function timeToKey(t: string): string {
  return t.length === 5 ? t : t.slice(0, 5);
}

export interface AgendaWeekSlotsContentProps {
  anchorDate: Date;
  scope: 'week' | 'month';
  profile: ProfileForAgenda;
  professionalId: string;
  saving: boolean;
  onConfirmBooking: (date: Date, time: string) => void | Promise<void>;
  onCancelConfirm: () => void;
  clinicClosedDates?: string[];
}

/**
 * Grade semanal dentro de um dialog (mesmo padrão visual da Agenda — cards por dia),
 * para modos Semana/Mês nas telas de consulta.
 */
export function AgendaWeekSlotsContent({
  anchorDate,
  scope,
  profile,
  professionalId,
  saving,
  onConfirmBooking,
  onCancelConfirm,
  clinicClosedDates = [],
}: AgendaWeekSlotsContentProps) {
  const [weekStart, setWeekStart] = useState(() => computeWeekStart(anchorDate, scope));
  const [appointments, setAppointments] = useState<Array<{ appointment_date: string; start_time: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [pickDate, setPickDate] = useState<Date | null>(null);
  const [confirmTime, setConfirmTime] = useState<string | null>(null);

  useEffect(() => {
    setWeekStart(computeWeekStart(anchorDate, scope));
    setPickDate(null);
    setConfirmTime(null);
  }, [anchorDate, scope]);

  const timeSlots = useMemo(
    () => getTimeSlots(profile.work_start_time ?? '08:00', profile.work_end_time ?? '18:00'),
    [profile.work_start_time, profile.work_end_time]
  );

  const workingDays = useMemo(() => new Set(profile.work_days ?? [1, 2, 3, 4, 5]), [profile.work_days]);
  const isWorkingDay = (day: Date) => workingDays.has(day.getDay());
  const lunchBreaks = useMemo(() => getLunchBreaksFromProfile(profile), [profile]);
  const isLunchTime = (time: string) => isTimeInLunchBreaks(time, lunchBreaks);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const visibleWeekDays = useMemo(() => {
    const open = weekDays.filter((day) => isWorkingDay(day));
    return open.length > 0 ? open : weekDays;
  }, [weekDays, workingDays]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const start = format(weekStart, 'yyyy-MM-dd');
    const end = format(addDays(weekStart, 6), 'yyyy-MM-dd');
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('appointment_date, start_time')
          .eq('professional_id', professionalId)
          .gte('appointment_date', start)
          .lte('appointment_date', end);
        if (cancelled) return;
        if (error) {
          console.error(error);
          setAppointments([]);
        } else {
          setAppointments((data as Array<{ appointment_date: string; start_time: string }>) ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [professionalId, weekStart]);

  const appointmentsBySlot = useMemo(() => {
    const map = new Map<string, boolean>();
    appointments.forEach((a) => {
      const key = `${a.appointment_date}_${timeToKey(a.start_time)}`;
      map.set(key, true);
    });
    return map;
  }, [appointments]);

  const today = new Date();
  const todayStart = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, [weekStart]);

  const weekDaysFromToday = useMemo(() => {
    const closedSet = new Set(clinicClosedDates);
    return visibleWeekDays.filter((day) => {
      const d = new Date(day);
      d.setHours(0, 0, 0, 0);
      if (d.getTime() < todayStart.getTime()) return false;
      const dateKey = format(day, 'yyyy-MM-dd');
      if (closedSet.has(dateKey)) return false;
      return true;
    });
  }, [visibleWeekDays, todayStart, clinicClosedDates]);

  const isSlotPast = (day: Date, time: string) => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    if (dayStart.getTime() < todayStart.getTime()) return true;
    if (dayStart.getTime() > todayStart.getTime()) return false;
    const [h, m] = time.split(':').map(Number);
    const now = today.getHours() * 60 + today.getMinutes();
    return h * 60 + m < now;
  };

  const slotOccupied = (day: Date, time: string) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const key = `${dateStr}_${time}`;
    return appointmentsBySlot.get(key) ?? false;
  };

  const handlePickSlot = (day: Date, time: string) => {
    setPickDate(day);
    setConfirmTime(time);
  };

  if (pickDate && confirmTime) {
    return (
      <div className="space-y-4 py-2">
        <p className="text-sm text-muted-foreground">
          Confirmar agendamento em {format(pickDate, "d 'de' MMM", { locale: ptBR })} às {confirmTime.slice(0, 5)}?
        </p>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setPickDate(null);
              setConfirmTime(null);
              onCancelConfirm();
            }}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void onConfirmBooking(pickDate, confirmTime)}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[min(70vh,520px)] overflow-y-auto pr-1 -mr-1">
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-2 py-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 h-9 w-9"
          onClick={() => setWeekStart((d) => addDays(d, -7))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs sm:text-sm font-medium text-center px-1 leading-tight">
          {visibleWeekDays[0] && visibleWeekDays[visibleWeekDays.length - 1]
            ? `${format(visibleWeekDays[0], 'd MMM', { locale: ptBR })} – ${format(
                visibleWeekDays[visibleWeekDays.length - 1]!,
                'd MMM yyyy',
                { locale: ptBR }
              )}`
            : `${format(weekStart, 'd MMM', { locale: ptBR })} – ${format(addDays(weekStart, 6), 'd MMM yyyy', { locale: ptBR })}`}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 h-9 w-9"
          onClick={() => setWeekStart((d) => addDays(d, 7))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {weekDaysFromToday.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>Os dias desta semana já se passaram.</p>
            <p className="text-xs mt-1">Use as setas para ir à próxima semana.</p>
          </CardContent>
        </Card>
      ) : (
        weekDaysFromToday.map((day) => {
          const isToday = isSameDay(day, new Date());
          const workingDay = isWorkingDay(day);
          return (
            <Card key={day.toISOString()} className={isToday ? 'ring-2 ring-primary/30' : ''}>
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  {format(day, "EEE, d 'de' MMM", { locale: ptBR })}
                  {isToday && (
                    <span className="text-[10px] font-normal text-primary bg-primary/10 px-1.5 py-0.5 rounded">Hoje</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                {!workingDay ? (
                  <div className="text-xs text-muted-foreground py-3 text-center">Sem expediente neste dia.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {timeSlots.map((time) => {
                      const occupied = slotOccupied(day, time);
                      const past = isSlotPast(day, time);
                      const lunch = isLunchTime(time);
                      const blocked = (!occupied && !workingDay) || (!occupied && lunch);
                      const available = workingDay && !occupied && !past && !lunch;
                      return (
                        <button
                          key={`${day.toISOString()}_${time}`}
                          type="button"
                          disabled={!available}
                          onClick={() => available && handlePickSlot(day, time)}
                          className={`rounded-lg border px-2 py-2 text-xs text-left flex items-center justify-between gap-1 transition-colors ${
                            occupied
                              ? 'bg-amber-50 border-amber-200 text-foreground cursor-default'
                              : blocked
                                ? 'bg-muted/40 border-border text-muted-foreground cursor-not-allowed'
                                : past
                                  ? 'bg-muted/30 border-border text-muted-foreground cursor-not-allowed'
                                  : 'bg-card hover:bg-primary/5 border-border hover:border-primary/30'
                          }`}
                        >
                          <span className="font-medium tabular-nums">{time}</span>
                          {occupied ? (
                            <span className="text-amber-700 text-[10px]">Ocupado</span>
                          ) : blocked ? (
                            <span className="text-muted-foreground text-[10px]">{!workingDay ? 'Fechado' : getLunchBreakLabelForTime(time, lunchBreaks)}</span>
                          ) : past ? (
                            <span className="text-muted-foreground text-[10px]">—</span>
                          ) : (
                            <span className="text-muted-foreground text-[10px] flex items-center gap-0.5">
                              <UserPlus className="w-3 h-3 shrink-0" />
                              Livre
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
