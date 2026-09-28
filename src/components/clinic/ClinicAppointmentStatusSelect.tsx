import { useState } from 'react';
import {
  CalendarClock,
  Check,
  CheckCheck,
  ChevronDown,
  CircleDot,
  Clock,
  DollarSign,
  Home,
  Stethoscope,
  UserCheck,
  UserRound,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import {
  CLINIC_APPOINTMENT_STATUS_OPTIONS,
  clinicAppointmentStatusOption,
  type ClinicAppointmentStatus,
} from '@/lib/clinicAppointmentStatus';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const STATUS_ICON: Record<ClinicAppointmentStatus, LucideIcon> = {
  to_confirm: Clock,
  confirmed_by_patient: UserCheck,
  confirmed: Check,
  waiting: UserRound,
  payment: DollarSign,
  rescheduled: CalendarClock,
  in_progress: Stethoscope,
  finished: CheckCheck,
  cancelled_by_professional: Home,
  cancelled_by_patient: UserX,
  no_show: CircleDot,
};

export function ClinicAppointmentStatusGlyph({
  status,
  className,
}: {
  status: ClinicAppointmentStatus;
  className?: string;
}) {
  const opt = clinicAppointmentStatusOption(status);
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
        opt.iconWrapClassName,
        className
      )}
      aria-hidden
    >
      <Icon className={cn('h-3.5 w-3.5', opt.iconClassName)} strokeWidth={2.25} />
    </span>
  );
}

export function ClinicAppointmentStatusSelect({
  id,
  value,
  onValueChange,
  disabled,
}: {
  id?: string;
  value: ClinicAppointmentStatus;
  onValueChange: (status: ClinicAppointmentStatus) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = clinicAppointmentStatusOption(value);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            'flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left text-sm font-medium shadow-none outline-none',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            current.triggerClassName
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2.5">
            <ClinicAppointmentStatusGlyph status={value} />
            <span className="truncate">{current.label}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="z-[1600] w-[var(--radix-popover-trigger-width)] min-w-[18rem] max-h-[min(70vh,28rem)] overflow-y-auto p-1"
      >
        <ul role="listbox" aria-labelledby={id} className="flex flex-col">
          {CLINIC_APPOINTMENT_STATUS_OPTIONS.map((opt) => {
            const selected = opt.value === value;
            return (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-foreground',
                    'hover:bg-sky-50 dark:hover:bg-sky-950/40',
                    selected && 'bg-muted/60'
                  )}
                  onClick={() => {
                    onValueChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <ClinicAppointmentStatusGlyph status={opt.value} />
                  <span>{opt.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
