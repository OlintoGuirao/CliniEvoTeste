import { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock, ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useSalonAccount } from '@/hooks/use-salon-account';
import { fetchSalonProcedures } from '@/services/api/salonProceduresApi';
import { fetchClinicTeam } from '@/services/api/clinicTeamApi';
import { salonStaffRoleLabel } from '@/lib/salonTeamRoles';
import {
  SALON_WEEKDAY_OPTIONS,
  createSalonRecurringScheduleWithAppointments,
  deleteSalonRecurringScheduleWithAppointments,
  fetchSalonRecurringSchedulesForPatient,
  formatSalonAppointmentTimeDisplay,
  formatSalonRecurringPeriodLabel,
  salonWeekdayLabel,
} from '@/lib/salonRecurringAgenda';
import { PatientTabPanelSection } from './PatientDetailTabPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type PatientSalonRecurringAgendaSectionProps = {
  patientId: string;
  patientName: string;
};

type BookableProfessional = {
  userId: string;
  name: string;
  subtitle: string | null;
};

function defaultPeriodEnd(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
}

export function PatientSalonRecurringAgendaSection({
  patientId,
  patientName,
}: PatientSalonRecurringAgendaSectionProps) {
  const { profile } = useAuth();
  const { isSalonAdmin, organizationId } = useSalonAccount();
  const queryClient = useQueryClient();
  const professionalId = profile?.id ?? '';

  const [weekday, setWeekday] = useState<string>('1');
  const [startTime, setStartTime] = useState('09:00');
  const [periodStart, setPeriodStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(defaultPeriodEnd);
  const [salonProcedureId, setSalonProcedureId] = useState('');
  const [bookingProfessionalId, setBookingProfessionalId] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const proceduresQuery = useQuery({
    queryKey: ['salon-procedures-recurring', professionalId],
    enabled: Boolean(professionalId),
    queryFn: async () => {
      const data = await fetchSalonProcedures();
      return data.filter((p) => p.is_active);
    },
    staleTime: 60_000,
  });

  const teamQuery = useQuery({
    queryKey: ['clinic-team-recurring', professionalId],
    enabled: Boolean(isSalonAdmin && professionalId),
    queryFn: fetchClinicTeam,
    staleTime: 60_000,
  });

  const professionalNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (profile?.id) {
      map.set(profile.id, profile.full_name?.trim() || 'Você');
    }
    if (isSalonAdmin && teamQuery.data?.members) {
      for (const member of teamQuery.data.members) {
        const name = member.full_name?.trim() || member.email;
        if (name) map.set(member.user_id, name);
      }
    }
    return map;
  }, [profile?.id, profile?.full_name, isSalonAdmin, teamQuery.data]);

  const resolveProfessionalName = useCallback(
    (professionalIdForSchedule: string) =>
      professionalNameById.get(professionalIdForSchedule)?.trim() || '—',
    [professionalNameById]
  );

  const schedulesQuery = useQuery({
    queryKey: ['salon-recurring-schedules', patientId],
    enabled: Boolean(patientId),
    queryFn: () => fetchSalonRecurringSchedulesForPatient(patientId),
    staleTime: 30_000,
  });

  const bookableProfessionals = useMemo((): BookableProfessional[] => {
    if (!professionalId) return [];
    if (isSalonAdmin && teamQuery.data?.members) {
      return teamQuery.data.members
        .filter((m) => !m.is_blocked && m.role !== 'attendant')
        .map((m) => ({
          userId: m.user_id,
          name: m.full_name?.trim() || m.email,
          subtitle: salonStaffRoleLabel(m.staff_title),
        }));
    }
    return [
      {
        userId: professionalId,
        name: profile?.full_name?.trim() || 'Você',
        subtitle: null,
      },
    ];
  }, [isSalonAdmin, teamQuery.data, professionalId, profile?.full_name]);

  const resolvedProfessionalId = bookingProfessionalId || bookableProfessionals[0]?.userId || '';

  const handleCreate = async () => {
    if (!organizationId || !professionalId) {
      toast.error('Organização não identificada.');
      return;
    }
    if (!salonProcedureId) {
      toast.error('Selecione o procedimento.');
      return;
    }
    if (!resolvedProfessionalId) {
      toast.error('Selecione o profissional.');
      return;
    }
    if (!startTime) {
      toast.error('Informe o horário.');
      return;
    }
    if (periodEnd < periodStart) {
      toast.error('A data final deve ser igual ou posterior à inicial.');
      return;
    }

    const procedure = (proceduresQuery.data ?? []).find((p) => p.id === salonProcedureId);
    if (!procedure) {
      toast.error('Procedimento inválido.');
      return;
    }

    setSaving(true);
    try {
      const result = await createSalonRecurringScheduleWithAppointments({
        organizationId,
        patientId,
        professionalId: resolvedProfessionalId,
        salonProcedureId: procedure.id,
        procedureName: procedure.name,
        weekday: Number(weekday),
        startTime,
        periodStart,
        periodEnd,
        createdBy: professionalId,
      });

      await queryClient.invalidateQueries({ queryKey: ['salon-recurring-schedules', patientId] });

      const skippedMsg =
        result.skipped > 0
          ? ` ${result.skipped} horário(s) ignorado(s) por conflito na agenda.`
          : '';

      toast.success(
        `${result.created} agendamento(s) criado(s) para ${patientName}.${skippedMsg}`
      );

      setSalonProcedureId('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar os agendamentos.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      const result = await deleteSalonRecurringScheduleWithAppointments(deleteTargetId);
      await queryClient.invalidateQueries({ queryKey: ['salon-recurring-schedules', patientId] });
      toast.success(
        result.deletedAppointments > 0
          ? `Horário fixo removido e ${result.deletedAppointments} agendamento(s) apagado(s) da agenda.`
          : 'Horário fixo removido.'
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover.');
    } finally {
      setDeleting(false);
      setDeleteTargetId(null);
    }
  };

  const schedules = schedulesQuery.data ?? [];

  return (
    <>
      <PatientTabPanelSection
        title="Novo horário fixo"
        contentClassName="p-4 space-y-4"
      >
        <p className="text-sm text-muted-foreground">
          Defina procedimento, dia da semana, horário, período e profissional. O sistema cria
          automaticamente todos os agendamentos na agenda — ideal para clientes que vêm toda semana.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="recurring-procedure">Procedimento *</Label>
            <Select value={salonProcedureId} onValueChange={setSalonProcedureId}>
              <SelectTrigger id="recurring-procedure">
                <SelectValue
                  placeholder={
                    proceduresQuery.isLoading ? 'Carregando...' : 'Selecione o procedimento'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(proceduresQuery.data ?? []).map((proc) => (
                  <SelectItem key={proc.id} value={proc.id}>
                    {proc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recurring-weekday">Dia da semana *</Label>
            <Select value={weekday} onValueChange={setWeekday}>
              <SelectTrigger id="recurring-weekday">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SALON_WEEKDAY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recurring-time">Horário *</Label>
            <Input
              id="recurring-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recurring-period-start">Início do período *</Label>
            <Input
              id="recurring-period-start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recurring-period-end">Fim do período *</Label>
            <Input
              id="recurring-period-end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>

          {bookableProfessionals.length > 1 ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="recurring-professional">Profissional *</Label>
              <Select
                value={resolvedProfessionalId}
                onValueChange={setBookingProfessionalId}
              >
                <SelectTrigger id="recurring-professional">
                  <SelectValue placeholder="Selecione o profissional" />
                </SelectTrigger>
                <SelectContent>
                  {bookableProfessionals.map((p) => (
                    <SelectItem key={p.userId} value={p.userId}>
                      {p.name}
                      {p.subtitle ? ` — ${p.subtitle}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Button type="button" onClick={handleCreate} disabled={saving || proceduresQuery.isLoading}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando agendamentos...
              </>
            ) : (
              'Gerar agendamentos na agenda'
            )}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/agenda">
              <ExternalLink className="h-4 w-4" />
              Ver agenda
            </Link>
          </Button>
        </div>
      </PatientTabPanelSection>

      <PatientTabPanelSection
        title="Horários fixos vinculados"
        contentClassName="p-4"
        action={
          schedules.length > 0 ? (
            <span className="text-xs text-muted-foreground">{schedules.length} vínculo(s)</span>
          ) : null
        }
      >
        {schedulesQuery.isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Carregando...
          </div>
        ) : schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-border bg-muted/20">
            <CalendarClock className="w-10 h-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum horário fixo cadastrado para {patientName}.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {schedules.map((schedule) => (
              <li
                key={schedule.id}
                className="rounded-lg border border-border/60 bg-card p-4 flex flex-col sm:flex-row sm:items-start gap-3"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-medium text-foreground">
                    {schedule.salon_procedures?.name ?? 'Procedimento'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {salonWeekdayLabel(schedule.weekday)} às{' '}
                    {formatSalonAppointmentTimeDisplay(schedule.start_time)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatSalonRecurringPeriodLabel(schedule.period_start, schedule.period_end)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Profissional: {resolveProfessionalName(schedule.professional_id)}
                    {' · '}
                    Cadastrado em {format(new Date(schedule.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1 self-end sm:self-start">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link to="/agenda">Agenda</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Remover vínculo"
                    onClick={() => setDeleteTargetId(schedule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PatientTabPanelSection>

      <AlertDialog open={Boolean(deleteTargetId)} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover horário fixo?</AlertDialogTitle>
            <AlertDialogDescription>
              O vínculo será removido desta ficha e todos os agendamentos gerados por ele serão
              apagados da agenda. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
