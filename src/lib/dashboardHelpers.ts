import { differenceInYears, parseISO } from 'date-fns';

/** Saudação conforme horário local. */
export function dashboardGreeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function patientAgeFromDob(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const dob = parseISO(String(dateOfBirth).slice(0, 10));
  if (Number.isNaN(dob.getTime())) return null;
  return differenceInYears(new Date(), dob);
}

export function patientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Converte slug kebab-case em título legível. */
export function slugToDisplayName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function procedureLabelFromContext(
  procedureSlug: string | null | undefined,
  note: string | null | undefined,
  procedureNameBySlug: Map<string, string>
): string {
  if (procedureSlug) {
    return procedureNameBySlug.get(procedureSlug) ?? slugToDisplayName(procedureSlug);
  }
  const trimmed = note?.trim();
  if (!trimmed) return 'Consulta';
  const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? '';
  if (firstLine.startsWith('procedure_context:')) {
    const slug = firstLine.slice('procedure_context:'.length).trim();
    if (slug) return procedureNameBySlug.get(slug) ?? slugToDisplayName(slug);
  }
  if (firstLine.length > 80) return `${firstLine.slice(0, 77)}…`;
  return firstLine || 'Consulta';
}

export type DashboardAppointmentStatus = 'confirmada' | 'pendente' | 'encaixe' | 'sessao';

export function resolveAppointmentStatus(opts: {
  type: 'appointment' | 'session';
  patientId: string | null;
  isEncaixe?: boolean;
}): DashboardAppointmentStatus {
  if (opts.type === 'session') return 'sessao';
  if (opts.isEncaixe) return 'encaixe';
  if (!opts.patientId) return 'pendente';
  return 'confirmada';
}

/** Chave única para saber se um agendamento já virou sessão (atendimento concluído). */
export function completedAppointmentKey(
  patientId: string,
  date: string,
  professionalId: string
): string {
  return `${patientId}|${date}|${professionalId}`;
}

export function isAppointmentCompleted(
  opts: {
    patientId: string | null | undefined;
    appointmentDate: string;
    professionalId: string | null | undefined;
    fallbackProfessionalId: string;
    notes?: string | null;
  },
  completedKeys: ReadonlySet<string>,
  sessions?: readonly CompletedSessionRow[]
): boolean {
  if (!opts.patientId) return false;
  const proId = opts.professionalId ?? opts.fallbackProfessionalId;
  const aptDate = opts.appointmentDate.slice(0, 10);
  const strictKey = completedAppointmentKey(opts.patientId, aptDate, proId);
  if (completedKeys.has(strictKey)) return true;

  if (!sessions?.length) return false;

  for (const s of sessions) {
    const sessionDate = String(s.session_date).slice(0, 10);
    if (s.patient_id !== opts.patientId || sessionDate !== aptDate) continue;
    if (s.professional_id === proId) return true;
  }
  return false;
}

export type CompletedSessionRow = {
  id?: string;
  patient_id: string;
  session_date: string;
  professional_id: string;
  observacoes?: string | null;
};

/** Nome do cliente: prioriza ficha (patients) quando há patient_id vinculado. */
export function resolveDashboardPatientName(opts: {
  patientId?: string | null;
  patientNameById?: ReadonlyMap<string, string>;
  joinedPatientName?: string | null;
  appointmentFullName?: string | null;
}): string {
  if (opts.patientId) {
    const fromMap = opts.patientNameById?.get(opts.patientId)?.trim();
    if (fromMap) return fromMap;
    const fromJoin = opts.joinedPatientName?.trim();
    if (fromJoin) return fromJoin;
    return 'Paciente sem nome';
  }
  const preReg = opts.appointmentFullName?.trim();
  if (preReg) return preReg;
  return 'Pré-cadastro sem nome';
}

/** Próximo agendamento pendente (exclui concluídos e dias passados). */
export function isDashboardNextPendingAppointment(
  item: { type: string; isCompleted?: boolean; date: string; time?: string },
  todayStr: string,
  nowTime: string,
  options?: { salonTeamScope?: boolean }
): boolean {
  if (item.type !== 'appointment' || item.isCompleted) return false;
  if (item.date > todayStr) return true;
  if (item.date < todayStr) return false;
  // Master salão: pendentes de hoje permanecem até serem concluídos, mesmo após o horário.
  if (options?.salonTeamScope) return true;
  return (item.time || '00:00') >= nowTime;
}

/** Próximo pendente de cada profissional; prioriza o dia de hoje sobre datas futuras. */
export function pickNextPendingByProfessional<
  T extends { professionalId?: string | null; date: string; sortKey: string },
>(items: T[], todayStr: string, fallbackProfessionalId?: string): T[] {
  const byPro = new Map<string, T>();
  for (const item of items) {
    const proId = item.professionalId ?? fallbackProfessionalId ?? 'self';
    const existing = byPro.get(proId);
    if (!existing) {
      byPro.set(proId, item);
      continue;
    }
    const itemToday = item.date === todayStr;
    const existingToday = existing.date === todayStr;
    if (itemToday && !existingToday) {
      byPro.set(proId, item);
      continue;
    }
    if (!itemToday && existingToday) continue;
    if (item.sortKey.localeCompare(existing.sortKey) < 0) {
      byPro.set(proId, item);
    }
  }
  return Array.from(byPro.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}
