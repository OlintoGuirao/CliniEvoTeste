import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, format, isAfter, startOfDay, subDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicMaster } from '@/hooks/use-clinic-master';
import { useClinicMemberRole } from '@/hooks/use-clinic-member-role';
import { queryKeys } from '@/api/queryKeys';
import { supabase } from '@/integrations/supabase/client';
import { fetchConversations } from '@/services/api/atendimentoApi';
import { isAtendimentoModuleEnabled } from '@/lib/professionalModules';
import { isClinicOnlyAccount } from '@/lib/accountType';
import { useClinicFrontDeskScope } from '@/hooks/use-clinic-front-desk-scope';

export type NotificationKind = 'agenda' | 'patients' | 'system' | 'whatsapp' | 'orcamento';

export type NotificationItem = {
  id: string;
  title: string;
  description: string;
  dateLabel: string;
  href?: string;
  sortDate: Date;
  kind: NotificationKind;
  /** Abre pop-up de planos odontológicos (recepção). */
  action?: 'open-dental-plans';
  patientId?: string;
  patientName?: string;
  planId?: string;
};

function toTimeLabel(timeStr: string | null | undefined) {
  if (!timeStr) return '';
  return timeStr.length >= 5 ? timeStr.slice(0, 5) : timeStr;
}

function getClearedAtFromStorage(): number {
  if (typeof window === 'undefined') return 0;
  const stored = localStorage.getItem('notifications:clearedAt');
  const parsed = stored ? Number(stored) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function useNotifications() {
  const { profile } = useAuth();
  const { hideOperationalNav, isClinicAccount, isLoading: clinicMasterLoading } = useClinicMaster();
  const { isFrontDeskStaff } = useClinicMemberRole();
  const { scope: frontDeskScope, isLoading: frontDeskLoading } = useClinicFrontDeskScope();
  const skipOperationalNotifications =
    hideOperationalNav || (isClinicAccount && clinicMasterLoading);
  const clinicOnly = isClinicOnlyAccount(profile?.account_type);
  const atendimentoWhatsappId =
    isFrontDeskStaff && frontDeskScope?.whatsappProfessionalId
      ? frontDeskScope.whatsappProfessionalId
      : !isFrontDeskStaff
        ? profile?.id ?? ''
        : '';
  const [clearedAt, setClearedAt] = useState(getClearedAtFromStorage);

  // Sincroniza para o valor salvo no banco (quando existir) e mantém fallback do localStorage.
  useEffect(() => {
    const dbVal = profile?.notifications_cleared_at;
    if (!dbVal) return;
    const t = new Date(dbVal).getTime();
    if (Number.isFinite(t) && t > 0) setClearedAt(t);
  }, [profile?.notifications_cleared_at]);

  const clearNotifications = async () => {
    const now = Date.now();
    localStorage.setItem('notifications:clearedAt', String(now));
    setClearedAt(now);

    // Persistir no Supabase para sincronizar APK/Web.
    if (profile?.id) {
      const nowIso = new Date(now).toISOString();
      const { error } = await supabase
        .from('profiles')
        .update({ notifications_cleared_at: nowIso })
        .eq('id', profile.id);

      // Se a coluna ainda não existir ou RLS bloquear, não quebramos o fluxo: mantém localStorage.
      if (error) {
        console.warn('Falha ao salvar notifications_cleared_at no Supabase:', error.message);
      }
    }
  };

  const { data = [], isLoading } = useQuery({
    queryKey: [
      ...queryKeys.notifications(profile?.id ?? '', profile?.updated_at),
      isFrontDeskStaff ? 'front-desk' : 'default',
      clinicOnly ? 'clinic' : 'non-clinic',
      atendimentoWhatsappId,
      frontDeskLoading ? 'fd-loading' : 'fd-ready',
    ],
    enabled: !!profile?.id && !skipOperationalNotifications && !(isFrontDeskStaff && frontDeskLoading),
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
    queryFn: async (): Promise<NotificationItem[]> => {
      if (!profile?.id) return [];

      const now = new Date();
      const today = format(startOfDay(now), 'yyyy-MM-dd');
      const tomorrow = format(addDays(startOfDay(now), 1), 'yyyy-MM-dd');
      const recentSince = subDays(now, 7).toISOString();

      // Conversas WhatsApp — só clínica (profissional único / salão não usam /atendimento)
      const conversationsRes =
        clinicOnly &&
        isAtendimentoModuleEnabled(profile) &&
        atendimentoWhatsappId
          ? await fetchConversations(atendimentoWhatsappId).catch((err) => {
              console.warn('Falha ao buscar conversas de atendimento nas notificações:', err);
              return [] as Awaited<ReturnType<typeof fetchConversations>>;
            })
          : [];

      const [appointmentsRes, sessionsRes, patientsRes, budgetsRes, dentalAuthRes] =
        await Promise.all([
          supabase
            .from('appointments')
            .select('id, patient_id, appointment_date, start_time, patients(full_name)')
            .eq('professional_id', profile.id)
            .gte('appointment_date', today)
            .lt('appointment_date', tomorrow)
            .order('appointment_date')
            .order('start_time'),
          supabase
            .from('patient_sessions')
            .select('patient_id, session_date')
            .eq('professional_id', profile.id)
            .eq('session_date', today),
          supabase
            .from('patients')
            .select('id, full_name, created_at')
            .eq('professional_id', profile.id)
            .gte('created_at', recentSince)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('budget_quotes')
            .select('id, title, status, responded_at, patient_id, patients(full_name)')
            .eq('professional_id', profile.id)
            .in('status', ['accepted', 'rejected'])
            .not('responded_at', 'is', null)
            .gte('responded_at', recentSince)
            .order('responded_at', { ascending: false })
            .limit(10),
          isClinicAccount && isFrontDeskStaff
            ? (supabase as any)
                .from('dental_treatment_plans')
                .select(
                  'id, name, patient_id, authorization_code, authorized_at, patients(full_name)'
                )
                .eq('status', 'authorized')
                .is('budget_quote_id', null)
                .not('authorized_at', 'is', null)
                .gte('authorized_at', recentSince)
                .order('authorized_at', { ascending: false })
                .limit(20)
            : Promise.resolve({ data: null, error: null }),
        ]);

      const items: NotificationItem[] = [];

      // Consultas já realizadas hoje (paciente + data): não mostrar nas notificações
      const completedTodayKeys = new Set<string>();
      if (!sessionsRes.error && sessionsRes.data) {
        sessionsRes.data.forEach((s) => {
          if (s.patient_id && s.session_date) {
            completedTodayKeys.add(`${s.patient_id}|${s.session_date}`);
          }
        });
      }

      if (!appointmentsRes.error && appointmentsRes.data) {
        appointmentsRes.data.forEach((appt) => {
          const apptPatientId = (appt as { patient_id?: string | null }).patient_id;
          const key =
            apptPatientId && appt.appointment_date
              ? `${apptPatientId}|${appt.appointment_date}`
              : null;
          if (key && completedTodayKeys.has(key)) return;

          const patientName =
            (appt.patients as { full_name?: string } | null)?.full_name ?? 'Paciente';
          const timeLabel = toTimeLabel(appt.start_time);
          items.push({
            id: `appt-${appt.id}`,
            title: 'Consulta hoje',
            description: `${patientName}${timeLabel ? ` • ${timeLabel}` : ''}`,
            dateLabel: 'Hoje',
            sortDate: new Date(`${appt.appointment_date}T${timeLabel || '00:00'}:00`),
            href: '/agenda',
            kind: 'agenda',
          });
        });
      } else if (appointmentsRes.error) {
        console.error('Notifications appointments error:', appointmentsRes.error);
      }

      if (!patientsRes.error && patientsRes.data) {
        patientsRes.data.forEach((patient) => {
          const createdAt = new Date(patient.created_at);
          items.push({
            id: `patient-${patient.id}`,
            title: 'Novo paciente',
            description: patient.full_name,
            dateLabel: format(createdAt, 'dd/MM'),
            sortDate: createdAt,
            href: `/patients/${patient.id}`,
            kind: 'patients',
          });
        });
      }

      for (const conv of conversationsRes) {
        const openedAt = new Date(conv.last_message_at || conv.opened_at);
        items.push({
          id: `whatsapp-conv-${conv.id}`,
          title: 'Paciente aguardando atendimento',
          description: conv.patient_name
            ? `${conv.patient_name} • ${conv.patient_phone}`
            : conv.patient_phone,
          dateLabel: format(openedAt, 'HH:mm'),
          sortDate: openedAt,
          href: '/atendimento',
          kind: 'whatsapp',
        });
      }

      if (!budgetsRes.error && budgetsRes.data) {
        budgetsRes.data.forEach((bq) => {
          if (!bq.responded_at) return;
          const respondedAt = new Date(bq.responded_at);
          const patientName =
            (bq.patients as { full_name?: string } | null)?.full_name ?? 'Paciente';
          const titleLabel = bq.title?.trim() || 'Orçamento';
          const accepted = bq.status === 'accepted';
          items.push({
            id: `budget-${bq.id}-${bq.status}`,
            title: accepted ? 'Orçamento aceito' : 'Orçamento recusado',
            description: `${patientName} • ${titleLabel}`,
            dateLabel: format(respondedAt, 'dd/MM'),
            sortDate: respondedAt,
            href: '/orcamento',
            kind: 'orcamento',
          });
        });
      } else if (budgetsRes.error) {
        console.warn('Notifications budget_quotes error:', budgetsRes.error.message);
      }

      if (!dentalAuthRes.error && dentalAuthRes.data) {
        for (const plan of dentalAuthRes.data as Array<{
          id: string;
          name: string;
          patient_id: string;
          authorization_code: string | null;
          authorized_at: string;
          patients?: { full_name?: string } | null;
        }>) {
          const authorizedAt = new Date(plan.authorized_at);
          const patientName = plan.patients?.full_name?.trim() || 'Paciente';
          const planName = plan.name?.trim() || 'Plano odontológico';
          const code = plan.authorization_code?.trim();
          items.push({
            id: `dental-auth-${plan.id}`,
            title: 'Orçamento odontológico pendente',
            description: `${patientName} • ${planName}${
              code ? ` • ${code}` : ''
            }. Aceite ou envie o orçamento ao paciente.`,
            dateLabel: format(authorizedAt, 'dd/MM'),
            sortDate: authorizedAt,
            href: `/patients/${plan.patient_id}?tab=planos-odontologicos`,
            kind: 'orcamento',
            action: 'open-dental-plans',
            patientId: plan.patient_id,
            patientName,
            planId: plan.id,
          });
        }
      } else if (dentalAuthRes.error) {
        console.warn('Notifications dental plans error:', dentalAuthRes.error.message);
      }

      if (profile.updated_at) {
        const updatedAt = new Date(profile.updated_at);
        const clearedDbAt = profile.notifications_cleared_at
          ? new Date(profile.notifications_cleared_at)
          : null;
        const isUpdateJustFromClearing =
          clearedDbAt != null && Math.abs(updatedAt.getTime() - clearedDbAt.getTime()) <= 5000;

        if (!isUpdateJustFromClearing && isAfter(updatedAt, subDays(now, 7))) {
          items.push({
            id: `profile-${profile.id}`,
            title: 'Perfil atualizado',
            description: 'Seus dados foram atualizados.',
            dateLabel: format(updatedAt, 'dd/MM'),
            sortDate: updatedAt,
            href: '/settings',
            kind: 'system',
          });
        }
      }

      return items.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());
    },
  });

  const visibleItems = useMemo(() => {
    return data.filter((item) => {
      const sortDate =
        item.sortDate instanceof Date ? item.sortDate : new Date(item.sortDate as unknown as string);
      const time = sortDate.getTime();
      return !Number.isNaN(time) && time > clearedAt;
    });
  }, [data, clearedAt]);
  const unreadCount = useMemo(() => visibleItems.length, [visibleItems.length]);

  return { items: visibleItems, unreadCount, isLoading, clearNotifications };
}
