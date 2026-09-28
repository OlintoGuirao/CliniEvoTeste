import { supabase } from '@/integrations/supabase/client';
import { getProceduresForProfile } from '@/lib/proceduresForProfile';
import {
  patientAgeFromDob,
  procedureLabelFromContext,
  resolveAppointmentStatus,
  completedAppointmentKey,
  isAppointmentCompleted,
  resolveDashboardPatientName,
  type DashboardAppointmentStatus,
} from '@/lib/dashboardHelpers';
import { procedureSlugFromAppointmentNotes } from '@/lib/programaBotox';
import {
  buildAttendanceStartHrefFromAppointment,
  salonProcedureNameFromAppointmentNotes,
  formatSalonSessionNotesForDisplay,
} from '@/lib/salonAppointmentNotes';
import { isClinicOnlyAccount } from '@/lib/accountType';

export interface DashboardStats {
  totalPatients: number;
  upcomingAppointments: number;
}

export interface ConsultationTodayItem {
  type: 'appointment' | 'session';
  id: string;
  patientId: string | null;
  patientName: string;
  date: string;
  time: string;
  href: string;
  note?: string | null;
  /** Slug do procedimento quando o agendamento foi marcado como botox / programa botox. */
  procedureSlug?: string | null;
  procedureLabel?: string;
  patientAge?: number | null;
  status?: DashboardAppointmentStatus;
  isEncaixe?: boolean;
  professionalId?: string | null;
  professionalName?: string | null;
  /** Telefone do paciente (cadastro ou pré-agendamento). */
  patientPhone?: string | null;
  /** Presença confirmada via WhatsApp. */
  presenceConfirmed?: boolean;
  presenceDeclined?: boolean;
  /** Agendamento já registrado como sessão (atendimento concluído). */
  isCompleted?: boolean;
  /** Valor pago (salão), quando o atendimento já foi concluído. */
  valorLine?: string | null;
  /** Sessão vinculada quando o atendimento já foi concluído. */
  sessionId?: string | null;
}

export interface BotoxReminder {
  id: string;
  patient_id: string;
  due_date: string;
  area_key?: string | null;
  area_label?: string | null;
  reminder_kind?: string | null;
  patients?: { full_name?: string } | null;
}

export interface FutureClient {
  id: string;
  full_name: string;
  phone: string | null;
}

export interface UpcomingAppointmentItem {
  id: string;
  patient_id: string | null;
  full_name: string | null;
  pre_registration_phone: string | null;
  appointment_date: string;
  start_time: string;
  patientName: string;
  notes?: string | null;
  procedureSlug?: string | null;
}

export interface UpcomingConsultationItem extends ConsultationTodayItem {
  /** "YYYY-MM-DD HH:mm" — facilita ordenação cronológica única. */
  sortKey: string;
}

export interface DashboardSalonScope {
  professionalIds: string[];
  professionalNameById: Record<string, string>;
}

function applySessionProfessionalFilter<
  T extends { eq: (col: string, val: string) => T; in: (col: string, vals: string[]) => T },
>(query: T, professionalId: string, salonScope?: DashboardSalonScope): T {
  if (salonScope?.professionalIds?.length) {
    return salonScope.professionalIds.length === 1
      ? query.eq('professional_id', salonScope.professionalIds[0]!)
      : query.in('professional_id', salonScope.professionalIds);
  }
  return query.eq('professional_id', professionalId);
}

const applyAppointmentProfessionalFilter = applySessionProfessionalFilter;

export interface DashboardData {
  stats: DashboardStats;
  consultationsToday: ConsultationTodayItem[];
  /** Próximas consultas (hoje + futuro) já ordenadas, para resolver a "próxima consulta" mesmo que todas de hoje já tenham passado. */
  upcomingConsultations: UpcomingConsultationItem[];
  botoxReminders: BotoxReminder[];
  futureClients: FutureClient[];
}

export async function fetchUpcomingAppointments(
  professionalId: string,
  salonScope?: DashboardSalonScope
): Promise<UpcomingAppointmentItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await applyAppointmentProfessionalFilter(
    supabase
      .from('appointments')
      .select(
        'id, patient_id, full_name, pre_registration_phone, appointment_date, start_time, notes, patients(full_name)'
      )
      .gte('appointment_date', today)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(50),
    professionalId,
    salonScope
  );
  return (data ?? []).map(
    (a: {
      id: string;
      patient_id?: string | null;
      full_name?: string | null;
      pre_registration_phone?: string | null;
      appointment_date: string;
      start_time?: string | null;
      notes?: string | null;
      patients?: { full_name?: string } | null;
    }) => ({
      id: a.id,
      patient_id: a.patient_id ?? null,
      full_name: a.full_name ?? null,
      pre_registration_phone: a.pre_registration_phone ?? null,
      appointment_date: a.appointment_date,
      start_time: (a.start_time ?? '').slice(0, 5),
      patientName:
        a.patients?.full_name ??
        a.full_name ??
        (a.patient_id ? 'Paciente sem nome' : 'Pré-cadastro sem nome'),
      notes: a.notes ?? null,
      procedureSlug: procedureSlugFromAppointmentNotes(a.notes ?? null),
    })
  );
}

export async function fetchDashboardData(
  professionalId: string,
  options?: { salonScope?: DashboardSalonScope }
): Promise<DashboardData> {
  const salonScope = options?.salonScope;
  const today = new Date().toISOString().slice(0, 10);
  const oneWeekAhead = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();

  const [
    patientsRes,
    appointmentsRes,
    apptsRes,
    sessionsRes,
    remindersRes,
    profileRes,
  ] = await Promise.all([
    supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('professional_id', professionalId)
      .not('registration_completed_at', 'is', null),
    applyAppointmentProfessionalFilter(
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .gte('appointment_date', today),
      professionalId,
      salonScope
    ),
    applyAppointmentProfessionalFilter(
      supabase
        .from('appointments')
        .select(
          'id, patient_id, appointment_date, start_time, full_name, notes, is_encaixe, professional_id, pre_registration_phone, presence_confirmed_at, presence_declined_at, patients(full_name, date_of_birth, phone)'
        )
        .gte('appointment_date', today)
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(50),
      professionalId,
      salonScope
    ),
    applySessionProfessionalFilter(
      supabase
        .from('patient_sessions')
        .select(
          'id, patient_id, session_date, start_time, professional_id, observacoes, patients(full_name)'
        )
        .gte('session_date', today)
        .order('session_date', { ascending: true })
        .order('start_time', { ascending: true }),
      professionalId,
      salonScope
    ),
    supabase
      .from('botox_reapplication_reminders')
      .select('id, patient_id, due_date, area_key, area_label, reminder_kind, patients(full_name)')
      .eq('professional_id', professionalId)
      .is('notified_at', null)
      .gte('due_date', today)
      .lte('due_date', oneWeekAhead)
      .order('due_date', { ascending: true })
      .limit(10),
    supabase.from('profiles').select('account_type').eq('id', professionalId).maybeSingle(),
  ]);

  const isClinicAccount = isClinicOnlyAccount(profileRes.data?.account_type);

  const stats: DashboardStats = {
    totalPatients: patientsRes.count ?? 0,
    upcomingAppointments: appointmentsRes.count ?? 0,
  };

  const procs = await getProceduresForProfile(professionalId);
  const procedureNameBySlug = new Map(procs.map((p) => [p.slug, p.name]));

  const appts = (apptsRes.data ?? []) as Array<{
    id: string;
    patient_id?: string | null;
    appointment_date: string;
    start_time?: string | null;
    full_name?: string | null;
    notes?: string | null;
    is_encaixe?: boolean;
    professional_id?: string | null;
    pre_registration_phone?: string | null;
    presence_confirmed_at?: string | null;
    presence_declined_at?: string | null;
    patients?: { full_name?: string; date_of_birth?: string | null; phone?: string | null } | null;
  }>;
  const sessions = (sessionsRes.data ?? []) as Array<{
    id: string;
    patient_id: string;
    session_date: string;
    start_time?: string | null;
    professional_id?: string;
    observacoes?: string | null;
    patients?: { full_name?: string } | null;
  }>;

  const patientIds = new Set<string>();
  for (const a of appts) {
    if (a.patient_id) patientIds.add(a.patient_id);
  }
  for (const s of sessions) {
    if (s.patient_id) patientIds.add(s.patient_id);
  }
  const patientNameById = new Map<string, string>();
  if (patientIds.size > 0) {
    const { data: patientRows } = await supabase
      .from('patients')
      .select('id, full_name')
      .in('id', Array.from(patientIds));
    for (const row of patientRows ?? []) {
      const name = row.full_name?.trim();
      if (name) patientNameById.set(row.id, name);
    }
  }

  const valorByCompletedKey = new Map<string, string>();
  const sessionIdByCompletedKey = new Map<string, string>();
  for (const s of sessions) {
    const key = completedAppointmentKey(
      s.patient_id,
      String(s.session_date).slice(0, 10),
      s.professional_id ?? professionalId
    );
    sessionIdByCompletedKey.set(key, s.id);
    const { valorLine } = formatSalonSessionNotesForDisplay(s.observacoes);
    if (!valorLine) continue;
    valorByCompletedKey.set(key, valorLine);
  }

  const completedKeys = new Set(
    sessions.map((s) =>
      completedAppointmentKey(
        s.patient_id,
        String(s.session_date).slice(0, 10),
        s.professional_id ?? professionalId
      )
    )
  );
  const completedSessionRows = sessions.map((s) => ({
    patient_id: s.patient_id,
    session_date: s.session_date,
    professional_id: s.professional_id ?? professionalId,
  }));

  const apptsToday = appts.filter((a) => a.appointment_date === today);
  /** Agendamentos ainda na agenda hoje (por cliente + data + profissional). */
  const appointmentKeysToday = new Set(
    apptsToday
      .filter((a) => a.patient_id)
      .map((a) =>
        completedAppointmentKey(
          a.patient_id!,
          a.appointment_date,
          a.professional_id ?? professionalId
        )
      )
  );
  const consultationsToday: ConsultationTodayItem[] = [];
  const upcomingConsultations: UpcomingConsultationItem[] = [];

  appts.forEach((apt) => {
    const patientName = resolveDashboardPatientName({
      patientId: apt.patient_id,
      patientNameById,
      joinedPatientName: apt.patients?.full_name,
      appointmentFullName: apt.full_name,
    });
    const time = apt.start_time?.slice(0, 5) || '--:--';
    const procedureSlug = procedureSlugFromAppointmentNotes(apt.notes ?? null);
    const procedureLabel = procedureSlug
      ? procedureLabelFromContext(procedureSlug, apt.notes ?? null, procedureNameBySlug)
      : salonProcedureNameFromAppointmentNotes(apt.notes ?? null) ??
        procedureLabelFromContext(procedureSlug, apt.notes ?? null, procedureNameBySlug);
    const consultHref = buildAttendanceStartHrefFromAppointment({
      patientId: apt.patient_id ?? null,
      notes: apt.notes ?? null,
      procedureSlug,
      appointmentId: apt.id,
      isClinicAccount,
    });
    const proId = apt.professional_id ?? professionalId;
    const isCompleted = isAppointmentCompleted(
      {
        patientId: apt.patient_id,
        appointmentDate: apt.appointment_date,
        professionalId: apt.professional_id,
        fallbackProfessionalId: professionalId,
        notes: apt.notes,
      },
      completedKeys,
      completedSessionRows
    );
    const completedKey =
      apt.patient_id != null
        ? completedAppointmentKey(apt.patient_id, apt.appointment_date, proId)
        : null;
    const valorLine =
      isCompleted && completedKey ? valorByCompletedKey.get(completedKey) ?? null : null;
    const sessionId =
      isCompleted && completedKey ? sessionIdByCompletedKey.get(completedKey) ?? null : null;
    const item: ConsultationTodayItem = {
      type: 'appointment',
      id: apt.id,
      patientId: apt.patient_id ?? null,
      patientName,
      date: apt.appointment_date,
      time,
      href: isCompleted && apt.patient_id ? `/patients/${apt.patient_id}` : consultHref,
      note: apt.notes?.trim() || null,
      procedureSlug,
      procedureLabel,
      patientAge: patientAgeFromDob(apt.patients?.date_of_birth),
      isEncaixe: !!apt.is_encaixe,
      professionalId: proId,
      professionalName: proId
        ? salonScope?.professionalNameById[proId] ?? null
        : null,
      patientPhone:
        apt.patients?.phone?.trim() ||
        apt.pre_registration_phone?.trim() ||
        null,
      presenceConfirmed: Boolean(apt.presence_confirmed_at),
      presenceDeclined: Boolean(apt.presence_declined_at),
      isCompleted,
      valorLine,
      sessionId,
      status: resolveAppointmentStatus({
        type: 'appointment',
        patientId: apt.patient_id ?? null,
        isEncaixe: !!apt.is_encaixe,
      }),
    };
    if (apt.appointment_date === today) consultationsToday.push(item);
    upcomingConsultations.push({ ...item, sortKey: `${apt.appointment_date} ${time}` });
  });
  sessions.forEach((s) => {
    const sessionDate = String(s.session_date).slice(0, 10);
    if (sessionDate !== today) return;
    const sessionKey = completedAppointmentKey(
      s.patient_id,
      sessionDate,
      s.professional_id ?? professionalId
    );
    if (appointmentKeysToday.has(sessionKey)) return;
    const patientName = resolveDashboardPatientName({
      patientId: s.patient_id,
      patientNameById,
      joinedPatientName: s.patients?.full_name,
    });
    const time = s.start_time?.slice(0, 5) || '--:--';
    const { valorLine } = formatSalonSessionNotesForDisplay(s.observacoes);
    const procedureLabel =
      salonProcedureNameFromAppointmentNotes(s.observacoes) ?? 'Sessão realizada';
    consultationsToday.push({
      type: 'session',
      id: s.id,
      patientId: s.patient_id,
      patientName,
      date: sessionDate,
      time,
      href: `/patients/${s.patient_id}`,
      note: s.observacoes ?? null,
      procedureLabel,
      valorLine: valorLine ?? null,
      sessionId: s.id,
      isCompleted: true,
      professionalId: s.professional_id ?? professionalId,
      professionalName: s.professional_id
        ? salonScope?.professionalNameById[s.professional_id] ?? null
        : null,
      status: 'sessao',
    });
  });
  consultationsToday.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
  upcomingConsultations.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const botoxReminders = (remindersRes.data ?? []) as BotoxReminder[];

  const avaliacaoProc = procs.find((p) => p.slug === 'avaliacao');
  let futureClients: FutureClient[] = [];
  if (avaliacaoProc?.id) {
    const { data: instances } = await supabase
      .from('procedure_instances')
      .select('patient_id')
      .eq('professional_id', professionalId)
      .eq('procedure_id', avaliacaoProc.id);
    const pids = [...new Set((instances ?? []).map((i: { patient_id: string }) => i.patient_id))];
    if (pids.length > 0) {
      const { data: futuros } = await supabase
        .from('patients')
        .select('id, full_name, phone')
        .in('id', pids)
        .is('registration_completed_at', null)
        .order('full_name');
      futureClients = (futuros ?? []) as FutureClient[];
    }
  }

  return {
    stats,
    consultationsToday,
    upcomingConsultations,
    botoxReminders,
    futureClients,
  };
}
