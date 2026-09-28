export const CLINIC_APPOINTMENT_STATUSES = [
  'to_confirm',
  'confirmed_by_patient',
  'confirmed',
  'waiting',
  'payment',
  'rescheduled',
  'in_progress',
  'finished',
  'cancelled_by_professional',
  'cancelled_by_patient',
  'no_show',
] as const;

export type ClinicAppointmentStatus = (typeof CLINIC_APPOINTMENT_STATUSES)[number];

/** Alias usado na agenda da clínica. */
export type ClinicAgendaStatus = ClinicAppointmentStatus;

export const DEFAULT_CLINIC_APPOINTMENT_STATUS: ClinicAppointmentStatus = 'to_confirm';

const STATUS_SET = new Set<string>(CLINIC_APPOINTMENT_STATUSES);

export type ClinicAppointmentStatusOption = {
  value: ClinicAppointmentStatus;
  label: string;
  /** Fundo/borda do seletor e do horário na grade. */
  triggerClassName: string;
  slotClassName: string;
  iconWrapClassName: string;
  iconClassName: string;
};

/** Paleta simplificada da agenda: cinza / azul / cancelado. */
const STYLE_GRAY = {
  triggerClassName:
    'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100',
  slotClassName: 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:shadow-md text-foreground',
  iconWrapClassName: 'bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
  iconClassName: 'text-slate-600 dark:text-slate-200',
} as const;

const STYLE_BLUE = {
  triggerClassName:
    'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100',
  slotClassName: 'bg-blue-50 border-blue-200 hover:bg-blue-100 hover:shadow-md text-foreground',
  iconWrapClassName: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100',
  iconClassName: 'text-blue-700 dark:text-blue-100',
} as const;

const STYLE_CANCELLED = {
  triggerClassName:
    'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100',
  slotClassName: 'bg-rose-50 border-rose-200 hover:bg-rose-100 hover:shadow-md text-foreground',
  iconWrapClassName: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-100',
  iconClassName: 'text-rose-700 dark:text-rose-100',
} as const;

export const CLINIC_APPOINTMENT_STATUS_OPTIONS: ClinicAppointmentStatusOption[] = [
  {
    value: 'to_confirm',
    label: 'A confirmar',
    ...STYLE_GRAY,
  },
  {
    value: 'confirmed_by_patient',
    label: 'Confirmado pelo paciente',
    ...STYLE_BLUE,
  },
  {
    value: 'confirmed',
    label: 'Confirmado',
    ...STYLE_BLUE,
  },
  {
    value: 'waiting',
    label: 'Em espera',
    triggerClassName:
      'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
    slotClassName: 'bg-amber-50 border-amber-200 hover:bg-amber-100 hover:shadow-md text-foreground',
    iconWrapClassName: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
    iconClassName: 'text-amber-800 dark:text-amber-100',
  },
  {
    value: 'payment',
    label: 'Pagamento',
    triggerClassName:
      'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100',
    slotClassName: 'bg-violet-50 border-violet-200 hover:bg-violet-100 hover:shadow-md text-foreground',
    iconWrapClassName: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-100',
    iconClassName: 'text-violet-700 dark:text-violet-100',
  },
  {
    value: 'rescheduled',
    label: 'Remarcado',
    ...STYLE_CANCELLED,
  },
  {
    value: 'in_progress',
    label: 'Em andamento',
    triggerClassName:
      'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100',
    slotClassName: 'bg-cyan-50 border-cyan-200 hover:bg-cyan-100 hover:shadow-md text-foreground',
    iconWrapClassName: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100',
    iconClassName: 'text-cyan-800 dark:text-cyan-100',
  },
  {
    value: 'finished',
    label: 'Finalizado',
    triggerClassName:
      'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
    slotClassName: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 hover:shadow-md text-foreground',
    iconWrapClassName: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-100',
    iconClassName: 'text-emerald-700 dark:text-emerald-100',
  },
  {
    value: 'cancelled_by_professional',
    label: 'Cancelado pelo profissional',
    ...STYLE_CANCELLED,
  },
  {
    value: 'cancelled_by_patient',
    label: 'Cancelado pelo paciente',
    ...STYLE_CANCELLED,
  },
  {
    value: 'no_show',
    label: 'Faltou',
    ...STYLE_CANCELLED,
  },
];

const OPTION_BY_VALUE = new Map(
  CLINIC_APPOINTMENT_STATUS_OPTIONS.map((opt) => [opt.value, opt] as const)
);

const DECLINED_STATUSES = new Set<ClinicAppointmentStatus>([
  'cancelled_by_professional',
  'cancelled_by_patient',
  'no_show',
  'rescheduled',
]);

export function isClinicAppointmentStatus(value: string | null | undefined): value is ClinicAppointmentStatus {
  return Boolean(value && STATUS_SET.has(value));
}

export function clinicAppointmentStatusOption(
  status: ClinicAppointmentStatus
): ClinicAppointmentStatusOption {
  return OPTION_BY_VALUE.get(status) ?? CLINIC_APPOINTMENT_STATUS_OPTIONS[0]!;
}

export function clinicAppointmentStatusLabel(status: ClinicAppointmentStatus): string {
  return clinicAppointmentStatusOption(status).label;
}

export function resolveClinicAppointmentStatus(params: {
  clinicStatus?: string | null;
  presenceConfirmedAt?: string | null;
  presenceDeclinedAt?: string | null;
}): ClinicAppointmentStatus {
  if (isClinicAppointmentStatus(params.clinicStatus)) return params.clinicStatus;
  if (params.presenceDeclinedAt) return 'cancelled_by_patient';
  if (params.presenceConfirmedAt) return 'confirmed';
  return DEFAULT_CLINIC_APPOINTMENT_STATUS;
}

export function clinicStatusWritePayload(
  status: ClinicAppointmentStatus,
  current?: { presence_confirmed_at?: string | null; presence_declined_at?: string | null }
): {
  clinic_status: ClinicAppointmentStatus;
  presence_confirmed_at: string | null;
  presence_declined_at: string | null;
} {
  const now = new Date().toISOString();
  if (status === 'to_confirm') {
    return { clinic_status: status, presence_confirmed_at: null, presence_declined_at: null };
  }
  if (DECLINED_STATUSES.has(status)) {
    return {
      clinic_status: status,
      presence_confirmed_at: null,
      presence_declined_at: current?.presence_declined_at ?? now,
    };
  }
  return {
    clinic_status: status,
    presence_confirmed_at: current?.presence_confirmed_at ?? now,
    presence_declined_at: null,
  };
}

/** @deprecated Use resolveClinicAppointmentStatus. Mantido para compatibilidade. */
export function clinicStatusFromPresence(
  presenceConfirmedAt: string | null | undefined
): ClinicAppointmentStatus {
  return resolveClinicAppointmentStatus({ presenceConfirmedAt });
}
