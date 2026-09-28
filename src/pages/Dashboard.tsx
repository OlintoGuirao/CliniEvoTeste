import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLoading } from '@/components/layout/PageLoading';
import { MobileBottomSafeSpacer } from '@/components/layout/mobile';
import {
  DashboardMetricCard,
  DashboardQuickActions,
  ClinicFrontDeskQuickActions,
  EmptyNextAppointmentCard,
  NextAppointmentCard,
  SalonTodayAppointmentsDialog,
  SalonUpcomingAppointmentsDialog,
  TodayAppointmentsTable,
} from '@/components/dashboard/DashboardWidgets';
import {
  ClinicFrontDeskUnconfirmedDialog,
  countUnconfirmedToday,
} from '@/components/dashboard/ClinicFrontDeskUnconfirmedDialog';
import { DashboardWhatsAppDisconnectedAlert } from '@/components/dashboard/DashboardWhatsAppDisconnectedAlert';
import { Bell, Calendar, CheckCircle2, MessageCircle, User, Users, UserX } from 'lucide-react';
import { addDays, endOfWeek, format, isAfter, isBefore, parseISO, setYear, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDashboard } from '@/hooks/useDashboard';
import { useClinicMaster } from '@/hooks/use-clinic-master';
import { useSalonAccount } from '@/hooks/use-salon-account';
import { useUiCopy } from '@/hooks/use-ui-copy';
import type { DashboardSalonScope } from '@/api/dashboard';
import { fetchUpcomingAppointments } from '@/api/dashboard';
import { buildAttendanceStartHrefFromAppointment } from '@/lib/salonAppointmentNotes';
import { dashboardKey } from '@/api/queryKeys';
import { supabase } from '@/integrations/supabase/client';
import { fetchProfessionalUiSettings } from '@/services/api/dynamicProcedureFieldSettingsApi';
import { fetchClinicTeam } from '@/services/api/clinicTeamApi';
import { fetchClinicAgendaProfessionals } from '@/lib/clinicAgendaBooking';
import { isClinicOnlyAccount } from '@/lib/accountType';
import { dashboardGreeting, isDashboardNextPendingAppointment, pickNextPendingByProfessional } from '@/lib/dashboardHelpers';
import { getVacationPeriodsForDay } from '@/lib/vacationHelpers';
import { VacationPeriodBanner } from '@/components/VacationPeriodBanner';
import { toast } from 'sonner';
import { cn, formatPersonName } from '@/lib/utils';
import { ClinicMasterDashboard } from '@/components/clinic/master-dashboard/ClinicMasterDashboard';
import { ClinicDentalAttendanceDialog } from '@/components/clinic/ClinicDentalAttendanceDialog';
import { useClinicFrontDeskScope } from '@/hooks/use-clinic-front-desk-scope';
import { useClinicMemberRole } from '@/hooks/use-clinic-member-role';
import {
  buildAtendimentoPath,
  buildPresenceConfirmationMessage,
  normalizeWhatsappPhone,
} from '@/lib/clinicFrontDeskAtendimento';
import { ensureAtendimentoConversation } from '@/services/api/atendimentoApi';
import { useBranchBranding } from '@/hooks/use-branch-branding';
import { isProgramaBotoxModuleEnabled } from '@/lib/professionalModules';
import { loadWhatsappManualTemplates } from '@/lib/loadWhatsappManualTemplates';
import { resolveWhatsappManualMessage } from '@/lib/whatsappManualTemplates';
import type { ConsultationTodayItem } from '@/api/dashboard';

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isMaster: isClinicMaster, isLoading: masterLoading } = useClinicMaster();
  const { isFrontDeskStaff, scope: frontDeskScope, isLoading: frontDeskLoading } =
    useClinicFrontDeskScope();
  const { isClinicClinicalProfessional } = useClinicMemberRole();
  const { appName } = useBranchBranding();
  const { isSalonAdmin } = useSalonAccount();
  const copy = useUiCopy();
  const isClinicAccount = isClinicOnlyAccount(profile?.account_type);
  const professionalId = profile?.id ?? undefined;
  const [upcomingDialogOpen, setUpcomingDialogOpen] = useState(false);
  const [todayDialogOpen, setTodayDialogOpen] = useState(false);
  const [unconfirmedDialogOpen, setUnconfirmedDialogOpen] = useState(false);
  const [whatsappOpeningId, setWhatsappOpeningId] = useState<string | null>(null);
  const [dentalAttendOpen, setDentalAttendOpen] = useState(false);
  const [dentalAttendPatient, setDentalAttendPatient] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [nowTime, setNowTime] = useState(() => format(new Date(), 'HH:mm'));

  const salonTeamQuery = useQuery({
    queryKey: ['clinic-team-dashboard', professionalId],
    enabled: Boolean(copy.isSalon && isSalonAdmin && professionalId),
    queryFn: fetchClinicTeam,
    staleTime: 60_000,
  });

  const salonScope = useMemo((): DashboardSalonScope | undefined => {
    if (!copy.isSalon || !isSalonAdmin || !professionalId) return undefined;
    const members = salonTeamQuery.data?.members ?? [];
    const teamIds = members
      .filter((m) => !m.is_blocked && m.role !== 'attendant')
      .map((m) => m.user_id);
    const professionalIds = teamIds.length > 0 ? teamIds : [professionalId];
    const professionalNameById: Record<string, string> = {};
    if (profile?.id) {
      professionalNameById[profile.id] = profile.full_name?.trim() || 'Você';
    }
    for (const m of members) {
      professionalNameById[m.user_id] = m.full_name?.trim() || m.email;
    }
    return { professionalIds, professionalNameById };
  }, [
    copy.isSalon,
    isSalonAdmin,
    professionalId,
    salonTeamQuery.data,
    profile?.full_name,
    profile?.id,
  ]);

  const clinicProsQuery = useQuery({
    queryKey: ['clinic-agenda-professionals-dashboard', professionalId],
    enabled: Boolean(isClinicAccount && !isClinicMaster && professionalId),
    queryFn: fetchClinicAgendaProfessionals,
    staleTime: 60_000,
  });

  const clinicAgendaScope = useMemo((): DashboardSalonScope | undefined => {
    if (!isClinicAccount || isClinicMaster) return undefined;
    const members = clinicProsQuery.data ?? [];
    const professionalIds = [
      ...new Set([
        ...members.map((m) => m.userId),
        ...(professionalId ? [professionalId] : []),
      ]),
    ];
    if (professionalIds.length === 0) return undefined;
    const professionalNameById: Record<string, string> = {};
    if (profile?.id) {
      professionalNameById[profile.id] = profile.full_name?.trim() || 'Você';
    }
    for (const m of members) {
      professionalNameById[m.userId] = m.name;
    }
    return { professionalIds, professionalNameById };
  }, [
    isClinicAccount,
    isClinicMaster,
    clinicProsQuery.data,
    professionalId,
    profile?.id,
    profile?.full_name,
  ]);

  const showSalonTeamToday = copy.isSalon && isSalonAdmin;
  const clinicFrontDeskScope = isFrontDeskStaff ? frontDeskScope : null;
  const dashboardReady =
    !isClinicMaster &&
    !masterLoading &&
    (!isFrontDeskStaff || !frontDeskLoading) &&
    (!showSalonTeamToday || !salonTeamQuery.isLoading) &&
    (!isClinicAccount || !clinicProsQuery.isLoading);

  const { data, isLoading } = useDashboard(professionalId, {
    enabled: dashboardReady && !!professionalId,
    salonScope: showSalonTeamToday
      ? salonScope
      : clinicAgendaScope ?? clinicFrontDeskScope ?? undefined,
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTime(format(new Date(), 'HH:mm'));
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const stats = data?.stats ?? { totalPatients: 0, upcomingAppointments: 0 };
  const consultationsToday = data?.consultationsToday ?? [];
  const upcomingConsultations = data?.upcomingConsultations ?? [];
  const botoxReminders = data?.botoxReminders ?? [];
  const futureClients = data?.futureClients ?? [];

  const { data: uiSettings } = useQuery({
    queryKey: [...dashboardKey(professionalId ?? ''), 'ui-widgets'],
    queryFn: () => fetchProfessionalUiSettings({ professionalId: professionalId! }),
    enabled: !!professionalId && !isClinicMaster,
  });

  const showBirthdays =
    !isClinicClinicalProfessional &&
    (isFrontDeskStaff || (uiSettings?.show_dashboard_birthdays ?? true));
  const showFutureClients = uiSettings?.show_dashboard_future_clients ?? true;
  const showBotoxReminders =
    isProgramaBotoxModuleEnabled(profile) && (uiSettings?.show_dashboard_botox_reminders ?? true);

  const todayVacationPeriods = useMemo(
    () => getVacationPeriodsForDay(new Date(), uiSettings?.vacation_periods ?? []),
    [uiSettings?.vacation_periods]
  );

  const { data: upcomingList = [], isLoading: upcomingLoading } = useQuery({
    queryKey: [
      ...dashboardKey(professionalId ?? ''),
      'upcoming-list',
      upcomingDialogOpen,
      clinicAgendaScope?.professionalIds.join(',') ?? '',
    ],
    queryFn: () => fetchUpcomingAppointments(professionalId!, clinicAgendaScope),
    enabled: !!professionalId && upcomingDialogOpen && !isClinicMaster && !showSalonTeamToday,
  });

  const birthdayOwnerIds = useMemo(() => {
    if (isFrontDeskStaff) {
      const ids = new Set(clinicFrontDeskScope?.professionalIds ?? []);
      if (professionalId) ids.add(professionalId);
      return [...ids];
    }
    return professionalId ? [professionalId] : [];
  }, [isFrontDeskStaff, clinicFrontDeskScope?.professionalIds, professionalId]);

  const { data: weeklyBirthdays = [], isLoading: birthdaysLoading } = useQuery({
    queryKey: [...dashboardKey(professionalId ?? ''), 'weekly-birthdays', birthdayOwnerIds.join(',')],
    queryFn: async () => {
      if (birthdayOwnerIds.length === 0) return [];
      let query = supabase
        .from('patients')
        .select('id, full_name, phone, date_of_birth, is_active')
        .not('date_of_birth', 'is', null);
      query =
        birthdayOwnerIds.length === 1
          ? query.eq('professional_id', birthdayOwnerIds[0]!)
          : query.in('professional_id', birthdayOwnerIds);
      const { data: rows, error } = await query;
      if (error) throw error;

      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      type BirthdayItem = { id: string; full_name: string; phone: string | null; date_of_birth: string };
      const list = (rows ?? []) as BirthdayItem[];

      const inWeek = list.filter((p) => {
        if (!p.date_of_birth) return false;
        const birthDate = parseISO(p.date_of_birth);
        if (Number.isNaN(birthDate.getTime())) return false;
        let birthdayThisYear = setYear(birthDate, now.getFullYear());
        if (isBefore(birthdayThisYear, weekStart)) {
          birthdayThisYear = setYear(birthDate, now.getFullYear() + 1);
        }
        return !isBefore(birthdayThisYear, weekStart) && !isAfter(birthdayThisYear, weekEnd);
      });

      return inWeek.sort((a, b) => {
        const dateA = setYear(parseISO(a.date_of_birth), now.getFullYear());
        const dateB = setYear(parseISO(b.date_of_birth), now.getFullYear());
        return dateA.getTime() - dateB.getTime();
      });
    },
    enabled:
      birthdayOwnerIds.length > 0 &&
      showBirthdays &&
      !isClinicMaster &&
      (!isFrontDeskStaff || Boolean(clinicFrontDeskScope)),
  });

  async function resolveAppointmentPatientId(item: (typeof upcomingList)[number]): Promise<string | null> {
    if (!professionalId) return null;
    if (item.patient_id) return item.patient_id;
    const fullName = item.full_name?.trim();
    if (!fullName) return null;

    const { data: createdPatient, error: createErr } = await supabase
      .from('patients')
      .insert({
        professional_id: professionalId,
        full_name: fullName,
        phone: item.pre_registration_phone?.trim() || null,
        registration_completed_at: null,
      })
      .select('id')
      .single();
    if (createErr) throw createErr;
    if (!createdPatient?.id) return null;

    const { error: updateErr } = await supabase
      .from('appointments')
      .update({ patient_id: createdPatient.id })
      .eq('id', item.id);
    if (updateErr) throw updateErr;

    return createdPatient.id;
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const sevenDaysOut = format(addDays(new Date(), 7), 'yyyy-MM-dd');

  const nextAppointmentsByPro = useMemo(() => {
    if (!showSalonTeamToday) return [];
    const pending = upcomingConsultations.filter((c) =>
      isDashboardNextPendingAppointment(c, todayStr, nowTime, { salonTeamScope: true })
    );
    return pickNextPendingByProfessional(pending, todayStr, professionalId);
  }, [showSalonTeamToday, upcomingConsultations, todayStr, nowTime, professionalId]);

  const nextAppointment = upcomingConsultations.find((c) =>
    isDashboardNextPendingAppointment(c, todayStr, nowTime, {
      salonTeamScope: showSalonTeamToday || Boolean(clinicAgendaScope),
    })
  );

  const firstPendingToday = consultationsToday.find((c) => !c.isCompleted);
  const firstToday = nextAppointment ?? firstPendingToday ?? null;

  const highlightTime = useMemo(() => {
    if (!nextAppointment || nextAppointment.date !== todayStr) return null;
    return nextAppointment.time;
  }, [nextAppointment, todayStr]);

  const upcomingWeekItems = useMemo(
    () =>
      upcomingConsultations.filter(
        (c) =>
          c.type === 'appointment' && c.date >= todayStr && c.date <= sevenDaysOut
      ),
    [upcomingConsultations, todayStr, sevenDaysOut]
  );

  const upcomingWeekCount = upcomingWeekItems.length;

  const completedAppointmentIds = useMemo(
    () =>
      new Set(
        upcomingConsultations
          .filter((c) => c.type === 'appointment' && c.isCompleted)
          .map((c) => c.id)
      ),
    [upcomingConsultations]
  );

  const pendingUpcomingList = useMemo(
    () => upcomingList.filter((item) => !completedAppointmentIds.has(item.id)),
    [upcomingList, completedAppointmentIds]
  );

  const nextDetailHref = firstToday
    ? firstToday.type === 'appointment'
      ? firstToday.href
      : firstToday.type === 'session'
        ? `/patients/${firstToday.patientId}`
        : firstToday.href
    : '/consultation';

  const firstName = profile?.full_name?.split(/\s+/)[0] || 'Profissional';
  const greeting = dashboardGreeting();
  const unconfirmedTodayCount = countUnconfirmedToday(consultationsToday);
  const whatsappProfessionalId = clinicFrontDeskScope?.whatsappProfessionalId ?? '';

  const openWhatsappForAppointment = async (item: ConsultationTodayItem) => {
    if (!whatsappProfessionalId) {
      toast.error('WhatsApp da clínica não configurado.');
      return;
    }
    const phone = normalizeWhatsappPhone(item.patientPhone);
    if (!phone) {
      toast.error('Cadastre o telefone do paciente para enviar mensagem.');
      return;
    }
    const templates = await loadWhatsappManualTemplates(whatsappProfessionalId);
    const entry = templates.presence_request;
    if (!entry.enabled) {
      toast.message('Mensagem desativada em Mensagens padrão.');
      return;
    }
    const draft = buildPresenceConfirmationMessage({
      patientName: item.patientName,
      appointmentDate: item.date,
      startTime: item.time,
      procedureLabel: item.procedureLabel,
      professionalName: item.professionalName,
      clinicName: appName,
      template: entry.message,
    });
    setWhatsappOpeningId(item.id);
    try {
      const conv = await ensureAtendimentoConversation({
        professionalId: whatsappProfessionalId,
        phone,
        patientName: item.patientName,
      });
      navigate(
        buildAtendimentoPath({
          conversationId: conv.id,
          phone,
          patientName: item.patientName,
          draft,
        })
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível abrir o atendimento.');
    } finally {
      setWhatsappOpeningId(null);
    }
  };

  const openDentalAttendForAppointment = (item: ConsultationTodayItem) => {
    if (!isClinicAccount || !isFrontDeskStaff) return;
    const patientId = item.patientId?.trim();
    if (!patientId) {
      toast.error('Vincule ou cadastre o paciente para iniciar o atendimento.');
      return;
    }
    setDentalAttendPatient({
      id: patientId,
      name: item.patientName,
    });
    setDentalAttendOpen(true);
  };

  const openWhatsappForBirthday = async (person: {
    id: string;
    full_name: string;
    phone: string | null;
  }) => {
    if (!whatsappProfessionalId) {
      toast.error('WhatsApp da clínica não configurado.');
      return;
    }
    const phone = normalizeWhatsappPhone(person.phone);
    if (!phone) {
      toast.error('Cadastre o telefone do paciente para enviar mensagem.');
      return;
    }
    const name = formatPersonName(person.full_name).trim();
    const templates = await loadWhatsappManualTemplates(whatsappProfessionalId);
    const resolved = resolveWhatsappManualMessage(templates, 'birthday_manual', {
      nome: name,
      profissional: profile?.full_name?.trim() || appName || 'Profissional',
    });
    if (!resolved.enabled) {
      toast.message('Mensagem desativada em Mensagens padrão.');
      return;
    }
    const draft = resolved.message;
    setWhatsappOpeningId(person.id);
    try {
      const conv = await ensureAtendimentoConversation({
        professionalId: whatsappProfessionalId,
        phone,
        patientName: name,
      });
      navigate(
        buildAtendimentoPath({
          conversationId: conv.id,
          phone,
          patientName: name,
          draft,
        })
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível abrir o atendimento.');
    } finally {
      setWhatsappOpeningId(null);
    }
  };

  const openBirthdayWaMe = async (person: {
    id: string;
    full_name: string;
    phone: string | null;
  }) => {
    const phone = normalizeWhatsappPhone(person.phone);
    if (!phone) {
      toast.error('Cadastre o telefone do paciente para enviar mensagem.');
      return;
    }
    const name = formatPersonName(person.full_name).trim();
    const templates = await loadWhatsappManualTemplates(professionalId);
    const resolved = resolveWhatsappManualMessage(templates, 'birthday_manual', {
      nome: name,
      profissional: profile?.full_name?.trim() || appName || 'Profissional',
    });
    if (!resolved.enabled) {
      toast.message('Mensagem desativada em Mensagens padrão.');
      return;
    }
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(resolved.message)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  if ((isLoading || (showSalonTeamToday && salonTeamQuery.isLoading) || (isFrontDeskStaff && frontDeskLoading)) && !isClinicMaster) {
    return <PageLoading />;
  }

  if (masterLoading) {
    return <PageLoading />;
  }

  if (isClinicMaster) {
    return <ClinicMasterDashboard />;
  }

  return (
    <div className="space-y-5 sm:space-y-6 md:space-y-8 animate-fade-in pb-2 min-w-0">
      <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground tracking-tight break-words">
            {greeting}, {firstName}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            {isFrontDeskStaff
              ? 'Visão operacional da recepção para hoje.'
              : 'Aqui está o resumo da sua clínica para hoje.'}
          </p>
        </div>
        {isFrontDeskStaff ? <ClinicFrontDeskQuickActions /> : null}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 2xl:grid-cols-12 gap-3 sm:gap-4 min-w-0">
        <div
          className={cn(
            'min-w-0 sm:col-span-3',
            showSalonTeamToday && nextAppointmentsByPro.length > 1
              ? '2xl:col-span-12'
              : '2xl:col-span-6'
          )}
        >
          {showSalonTeamToday && nextAppointmentsByPro.length > 0 ? (
            nextAppointmentsByPro.length === 1 ? (
              <NextAppointmentCard
                appointment={nextAppointmentsByPro[0]!}
                todayStr={todayStr}
                detailHref={nextAppointmentsByPro[0]!.href}
                showProfessional
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 h-full">
                {nextAppointmentsByPro.map((apt) => (
                  <NextAppointmentCard
                    key={apt.id}
                    appointment={apt}
                    todayStr={todayStr}
                    detailHref={apt.href}
                    showProfessional
                    compact
                  />
                ))}
              </div>
            )
          ) : firstToday && firstToday.type === 'appointment' ? (
            <NextAppointmentCard
              appointment={firstToday}
              todayStr={todayStr}
              detailHref={nextDetailHref}
              frontDeskMode={isFrontDeskStaff}
              onWhatsApp={() => void openWhatsappForAppointment(firstToday)}
              whatsappLoading={whatsappOpeningId === firstToday.id}
              onAttend={
                isClinicAccount && isFrontDeskStaff
                  ? () => openDentalAttendForAppointment(firstToday)
                  : undefined
              }
            />
          ) : firstToday ? (
            <Card className="h-full min-h-[168px] border-2 border-primary/35 shadow-md ring-1 ring-primary/15 bg-gradient-to-br from-primary/[0.12] via-card to-card">
              <CardContent className="p-5 md:p-7 flex flex-col justify-center gap-2 min-h-[168px]">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-primary">
                  Próximo na agenda
                </p>
                <p className="font-semibold text-base sm:text-lg break-words">
                  {formatPersonName(firstToday.patientName)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(parseISO(firstToday.date), "d 'de' MMM", { locale: ptBR })} às {firstToday.time}
                </p>
                <Button variant="outline" className="mt-1 w-full lg:w-auto rounded-lg min-h-[44px]" asChild>
                  <Link to={nextDetailHref}>Ver detalhes</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <EmptyNextAppointmentCard />
          )}
        </div>
        <div className="min-w-0 sm:col-span-1 2xl:col-span-2">
          <DashboardMetricCard
            title={copy.consultationsToday}
            value={consultationsToday.length}
            icon={Users}
            link={showSalonTeamToday ? undefined : '/agenda'}
            onClick={showSalonTeamToday ? () => setTodayDialogOpen(true) : undefined}
          />
        </div>
        {!isFrontDeskStaff ? (
          <div className="min-w-0 sm:col-span-1 2xl:col-span-2">
            <DashboardMetricCard
              title={copy.patientsActive}
              value={stats.totalPatients}
              icon={User}
              link="/patients"
            />
          </div>
        ) : (
          <div className="min-w-0 sm:col-span-1 2xl:col-span-2">
            <DashboardMetricCard
              title="Sem confirmação"
              value={unconfirmedTodayCount}
              subtitle="Toque para ver a lista"
              icon={UserX}
              onClick={() => setUnconfirmedDialogOpen(true)}
            />
          </div>
        )}
        <div className="min-w-0 sm:col-span-1 2xl:col-span-2">
          <DashboardMetricCard
            title={copy.nextConsultations}
            value={upcomingWeekCount}
            subtitle="Próximos 7 dias"
            icon={Calendar}
            onClick={() => setUpcomingDialogOpen(true)}
          />
        </div>
      </div>

      {isFrontDeskStaff || isClinicClinicalProfessional ? null : (
        <div className="space-y-3">
          <DashboardQuickActions />
          {professionalId ? (
            <DashboardWhatsAppDisconnectedAlert professionalId={professionalId} />
          ) : null}
        </div>
      )}
      {isFrontDeskStaff && clinicFrontDeskScope?.whatsappProfessionalId ? (
        <DashboardWhatsAppDisconnectedAlert
          professionalId={clinicFrontDeskScope.whatsappProfessionalId}
        />
      ) : null}

      <div className="space-y-3">
        {todayVacationPeriods.length > 0 ? (
          <VacationPeriodBanner periods={todayVacationPeriods} />
        ) : null}
        <TodayAppointmentsTable
          items={consultationsToday}
          highlightTime={highlightTime}
          todayStr={todayStr}
          showProfessional={showSalonTeamToday || isFrontDeskStaff || Boolean(clinicAgendaScope)}
          frontDeskMode={isFrontDeskStaff}
          onWhatsAppAppointment={(item) => void openWhatsappForAppointment(item)}
        />
      </div>

      {isFrontDeskStaff && clinicFrontDeskScope ? (
        <ClinicFrontDeskUnconfirmedDialog
          open={unconfirmedDialogOpen}
          onOpenChange={setUnconfirmedDialogOpen}
          items={consultationsToday}
          whatsappProfessionalId={clinicFrontDeskScope.whatsappProfessionalId}
          clinicName={appName}
        />
      ) : null}

      <SalonTodayAppointmentsDialog
        open={todayDialogOpen}
        onOpenChange={setTodayDialogOpen}
        items={consultationsToday}
        todayStr={todayStr}
        showEdit={showSalonTeamToday}
        professionalId={professionalId}
      />

      {showSalonTeamToday ? (
        <SalonUpcomingAppointmentsDialog
          open={upcomingDialogOpen}
          onOpenChange={setUpcomingDialogOpen}
          items={upcomingWeekItems}
          todayStr={todayStr}
          showEdit={showSalonTeamToday}
          professionalId={professionalId}
        />
      ) : (
      <Dialog open={upcomingDialogOpen} onOpenChange={setUpcomingDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[min(85vh,100dvh)] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {copy.nextConsultations}
            </DialogTitle>
            <DialogDescription>
              {copy.isSalon
                ? `Selecione um atendimento para iniciar com o ${copy.patient.toLowerCase()}.`
                : 'Selecione uma consulta para iniciar o atendimento com o paciente.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {upcomingLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
            ) : pendingUpcomingList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {copy.isSalon ? 'Nenhum atendimento agendado.' : 'Nenhuma consulta agendada.'}
              </p>
            ) : (
              <ul className="space-y-1.5 py-1">
                {pendingUpcomingList.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const patientId = await resolveAppointmentPatientId(item);
                          if (patientId) {
                            if (!item.patient_id) {
                              toast.success('Paciente vinculado automaticamente ao agendamento.');
                            }
                            setUpcomingDialogOpen(false);
                            navigate(
                              buildAttendanceStartHrefFromAppointment({
                                patientId,
                                notes: item.notes,
                                procedureSlug: item.procedureSlug,
                                appointmentId: item.id,
                                isClinicAccount,
                              })
                            );
                          } else {
                            toast.error('Não foi possível iniciar: falta nome do paciente no agendamento.');
                          }
                        } catch (e) {
                          console.error(e);
                          toast.error('Erro ao iniciar consulta deste agendamento.');
                        }
                      }}
                      className="flex gap-3 w-full items-center rounded-xl border border-border bg-card p-3 sm:p-3.5 text-left hover:bg-muted/50 active:bg-muted transition-colors min-h-[52px] touch-manipulation"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground break-words line-clamp-2">
                          {formatPersonName(item.patientName)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(parseISO(item.appointment_date), "d 'de' MMM", { locale: ptBR })} às{' '}
                          {item.start_time}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-primary shrink-0 hidden sm:inline">
                        Iniciar →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
      )}

      {showBirthdays && (
        <Card className="border-border/80 overflow-hidden">
          <CardHeader className="p-4 md:p-5 pb-2">
            <CardTitle className="text-base font-semibold">Aniversariantes da semana</CardTitle>
            <CardDescription className="text-xs">Envie uma mensagem com 1 clique</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-5 pt-0 pb-5">
            {birthdaysLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
            ) : weeklyBirthdays.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum aniversariante nesta semana</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {weeklyBirthdays.map((person) => {
                  const phoneDigits = (person.phone ?? '').replace(/\D/g, '');
                  const waNumber =
                    phoneDigits.length >= 10
                      ? phoneDigits.startsWith('55')
                        ? phoneDigits
                        : `55${phoneDigits}`
                      : '';
                  const birthdayText = format(
                    setYear(parseISO(person.date_of_birth), new Date().getFullYear()),
                    'EEEE, dd/MM',
                    { locale: ptBR }
                  );

                  return (
                    <li
                      key={person.id}
                      className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 sm:p-3.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground text-sm break-words line-clamp-2">
                          {formatPersonName(person.full_name)}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">{birthdayText}</p>
                      </div>
                      {waNumber ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full lg:w-auto shrink-0 gap-1.5 rounded-lg min-h-[40px]"
                          onClick={() =>
                            void (isFrontDeskStaff
                              ? openWhatsappForBirthday(person)
                              : openBirthdayWaMe(person))
                          }
                          disabled={isFrontDeskStaff && whatsappOpeningId === person.id}
                        >
                          <MessageCircle className="h-4 w-4 text-[#25D366]" />
                          {isFrontDeskStaff && whatsappOpeningId === person.id
                            ? 'Abrindo...'
                            : 'Mensagem'}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground shrink-0">Sem WhatsApp</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {showFutureClients && !isFrontDeskStaff && futureClients.length > 0 && (
        <Card className="border-border/80">
          <CardHeader className="p-4 md:p-5 pb-2">
            <CardTitle className="text-base font-semibold">Futuros clientes</CardTitle>
            <CardDescription className="text-xs">
              Avaliação sem cadastro completo. Conclua ou envie mensagem.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-5 pt-0">
            <ul className="space-y-2">
              {futureClients.map((fc) => {
                const phoneDigits = (fc.phone ?? '').replace(/\D/g, '');
                const waNumber =
                  phoneDigits.length >= 10
                    ? phoneDigits.startsWith('55')
                      ? phoneDigits
                      : `55${phoneDigits}`
                    : '';
                const whatsappMessage = `Olá, ${formatPersonName(fc.full_name).trim()}! Você ainda tem interesse em realizar os procedimentos que conversamos? Fico no aguardo do seu retorno.`;
                const waUrl = waNumber
                  ? `https://wa.me/${waNumber}?text=${encodeURIComponent(whatsappMessage)}`
                  : null;
                return (
                  <li
                    key={fc.id}
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-lg border border-border p-3 sm:p-3.5"
                  >
                    <span className="font-medium text-sm min-w-0 flex-1 break-words line-clamp-2">
                      {formatPersonName(fc.full_name)}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" asChild>
                        <Link to={`/patients/${fc.id}/edit?complete=1`} title="Concluir cadastro">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        </Link>
                      </Button>
                      {waUrl ? (
                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" asChild>
                          <a href={waUrl} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="h-4 w-4 text-[#25D366]" />
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {showBotoxReminders && !isFrontDeskStaff && botoxReminders.length > 0 && (
        <Card className="border-border/80">
          <CardHeader className="p-4 md:p-5 pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Reaplicação Botox
            </CardTitle>
            <CardDescription className="text-xs">Lembretes nos próximos 7 dias</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-5 pt-0">
            <ul className="space-y-2">
              {botoxReminders.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/agenda?patientId=${r.patient_id}&procedureSlug=${
                      r.reminder_kind === 'depilacao_definitiva'
                        ? 'depilacao-definitiva-feminina'
                        : 'botox'
                    }`}
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-1 lg:gap-3 rounded-lg border p-3 sm:p-3.5 hover:bg-muted/50 transition-colors min-h-[48px] touch-manipulation"
                  >
                    <span className="font-medium text-sm break-words line-clamp-2 min-w-0">
                      {formatPersonName(r.patients?.full_name ?? 'Paciente')}
                      {r.area_label
                        ? ` · Depilação (${r.area_label})`
                        : r.reminder_kind === 'depilacao_definitiva'
                          ? ' · Depilação'
                          : ''}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      Vence: {format(parseISO(r.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <MobileBottomSafeSpacer />

      {isClinicAccount && isFrontDeskStaff ? (
        <ClinicDentalAttendanceDialog
          open={dentalAttendOpen && Boolean(dentalAttendPatient?.id)}
          onOpenChange={(open) => {
            setDentalAttendOpen(open);
            if (!open) setDentalAttendPatient(null);
          }}
          patientId={dentalAttendPatient?.id ?? null}
          patientName={dentalAttendPatient?.name ?? null}
          title="Atender"
          preferCreatePlan
        />
      ) : null}
    </div>
  );
}
