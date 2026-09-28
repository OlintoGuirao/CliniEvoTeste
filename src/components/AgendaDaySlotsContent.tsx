import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getLunchBreaksFromProfile, getLunchBreakLabelForTime, isTimeInLunchBreaks } from '@/lib/lunchBreaks';
import { isClinicClosedOnDay } from '@/lib/clinicClosedDays';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Loader2, UserPlus } from 'lucide-react';

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

export type ProfileForAgenda = {
  work_start_time?: string | null;
  work_end_time?: string | null;
  work_days?: number[] | null;
  lunch_start_time?: string | null;
  lunch_end_time?: string | null;
  lunch_breaks?: Array<{ start: string; end: string }> | null;
};

interface AgendaDaySlotsContentProps {
  targetDate: Date;
  profile: ProfileForAgenda;
  agendaDayAppointments: Array<{ appointment_date: string; start_time: string }>;
  confirmSlotTime: string | null;
  onSelectSlot: (time: string) => void;
  onConfirm: () => void;
  onCancelConfirm: () => void;
  saving: boolean;
  clinicClosedDates?: string[];
}

export function AgendaDaySlotsContent({
  targetDate,
  profile,
  agendaDayAppointments,
  confirmSlotTime,
  onSelectSlot,
  onConfirm,
  onCancelConfirm,
  saving,
  clinicClosedDates = [],
}: AgendaDaySlotsContentProps) {
  const timeSlots = useMemo(
    () => getTimeSlots(profile.work_start_time ?? '08:00', profile.work_end_time ?? '18:00'),
    [profile.work_start_time, profile.work_end_time]
  );
  const workingDays = useMemo(() => new Set(profile.work_days ?? [1, 2, 3, 4, 5]), [profile.work_days]);
  const isWorkingDay = (d: Date) => workingDays.has(d.getDay());
  const lunchBreaks = useMemo(() => getLunchBreaksFromProfile(profile), [profile]);
  const isLunchTime = (time: string) => isTimeInLunchBreaks(time, lunchBreaks);
  const appointmentsBySlot = useMemo(() => {
    const map = new Map<string, boolean>();
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    agendaDayAppointments.forEach((a) => {
      const timeKey = a.start_time.length >= 5 ? a.start_time.slice(0, 5) : a.start_time;
      if (a.appointment_date === dateStr) map.set(`${dateStr}_${timeKey}`, true);
    });
    return map;
  }, [targetDate, agendaDayAppointments]);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const isSlotPast = (day: Date, time: string) => {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    if (dayStart < todayStart) return true;
    if (dayStart > todayStart) return false;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m < today.getHours() * 60 + today.getMinutes();
  };
  const dateStr = format(targetDate, 'yyyy-MM-dd');
  const slotIsOccupied = (time: string) => {
    const timeKey = time.length >= 5 ? time.slice(0, 5) : time;
    return appointmentsBySlot.get(`${dateStr}_${timeKey}`) ?? false;
  };

  if (confirmSlotTime) {
    return (
      <div className="space-y-4 py-2">
        <p className="text-sm text-muted-foreground">
          Confirmar agendamento em {format(targetDate, "d 'de' MMM", { locale: ptBR })} às {confirmSlotTime.slice(0, 5)}?
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancelConfirm} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  const working = isWorkingDay(targetDate);
  const clinicClosed = isClinicClosedOnDay(
    targetDate,
    clinicClosedDates.map((closed_date) => ({ id: closed_date, closed_date, note: null }))
  );

  if (clinicClosed) {
    return (
      <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-800">
        Neste dia a clínica está fechada para novos agendamentos de pacientes.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[50vh] overflow-y-auto py-1">
      {timeSlots.map((time) => {
        const occupied = slotIsOccupied(time);
        const past = isSlotPast(targetDate, time);
        const blocked = !working || (!occupied && isLunchTime(time));
        const available = working && !occupied && !past && !isLunchTime(time);
        return (
          <button
            key={time}
            type="button"
            disabled={!available}
            onClick={() => available && onSelectSlot(time)}
            className={`w-full rounded-lg border px-3 py-2.5 text-sm text-left flex items-center justify-between gap-2 transition-colors ${
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
              <span className="text-amber-700 text-xs">Ocupado</span>
            ) : blocked ? (
              <span className="text-muted-foreground text-xs">{!working ? 'Fechado' : getLunchBreakLabelForTime(time, lunchBreaks)}</span>
            ) : past ? (
              <span className="text-muted-foreground text-xs">—</span>
            ) : (
              <span className="text-muted-foreground text-xs flex items-center gap-1">
                <UserPlus className="w-3.5 h-3.5" />
                Disponível
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
