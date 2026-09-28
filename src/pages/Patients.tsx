import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUiCopy } from '@/hooks/use-ui-copy';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  Calendar,
  MoreVertical,
  FileText,
  UserCheck,
  UserX,
  Trash2,
  ArrowLeft,
  Send,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { PageLoading } from '@/components/layout/PageLoading';
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
import { useUpdatePatientActive, useDeletePatient } from '@/hooks/usePatientMutations';
import { usePatients } from '@/hooks/usePatients';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatPersonName, parseLocalDate } from '@/lib/utils';
import { formatPatientDisplayName, patientMatchesSearch } from '@/lib/patientDisplay';
import { toast } from 'sonner';
import { VirtualizedPatientList } from '@/components/patients/VirtualizedPatientList';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MobileBottomSafeSpacer } from '@/components/layout/mobile';
import { SalonPreRegistrationDialog } from '@/components/salon/SalonPreRegistrationDialog';
import { useBranchBranding } from '@/hooks/use-branch-branding';
import { useClinicMemberRole } from '@/hooks/use-clinic-member-role';
import { formatPhoneForWhatsApp } from '@/lib/evolutionPdf';
import { buildRegistrationWhatsAppMessage, openWhatsAppWithFallback } from '@/lib/reportShare';
import { loadWhatsappManualTemplates } from '@/lib/loadWhatsappManualTemplates';
import {
  buildPublicRegistrationUrl,
  ensurePatientRegistrationPublicSlug,
} from '@/services/api/patientRegistrationApi';

interface Patient {
  id: string;
  full_name: string;
  nickname?: string | null;
  phone: string | null;
  date_of_birth: string | null;
  sex: string | null;
  profile_photo_url: string | null;
  treatment_start_date: string | null;
  is_active: boolean;
  created_at: string;
  registration_completed_at: string | null;
}

interface PatientTimelineItem {
  name: string;
  date: string;
  count: number;
}

interface PatientStats {
  proceduresCount: number;
  sessionsCount: number;
  lastSessionDate: string | null;
  nextAppointmentDate: string | null;
  nextAppointmentTime: string | null;
  timeline: PatientTimelineItem[];
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
function getSexLabel(sex: string | null): string {
  if (!sex) return '';
  const l = sex.toLowerCase();
  if (l === 'm' || l === 'masculino' || l === 'male') return 'Masculino';
  if (l === 'f' || l === 'feminino' || l === 'female') return 'Feminino';
  if (l === 'other' || l === 'outro') return 'Outro';
  return sex;
}

const PatientCard = React.memo(function PatientCard({
  patient,
  stats,
  actionLoading,
  onNavigate,
  onToggleActive,
  onRemoveClick,
  onSendRegistrationLink,
  sendingRegistrationLink,
  isPreRegistration = false,
}: {
  patient: Patient;
  stats?: PatientStats;
  actionLoading: boolean;
  onNavigate: (patientId: string) => void;
  onToggleActive: (patient: Patient, e: React.MouseEvent) => void;
  onRemoveClick: (patient: Patient, e: React.MouseEvent) => void;
  onSendRegistrationLink: (patient: Patient, e: React.MouseEvent) => void;
  sendingRegistrationLink: boolean;
  isPreRegistration?: boolean;
}) {
  const navigate = useNavigate();
  const copy = useUiCopy();
  const isActive = patient.is_active !== false;
  const handleNavigate = useCallback(() => {
    onNavigate(patient.id);
  }, [onNavigate, patient.id]);
  return (
    <Card
      className="relative h-auto min-h-[390px] overflow-hidden rounded-2xl border border-border/70 bg-card/95 hover:shadow-xl hover:border-primary/30 transition-all cursor-pointer group"
      onClick={handleNavigate}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 ${
          isActive ? 'bg-emerald-400/80 dark:bg-emerald-500/70' : 'bg-red-400/80 dark:bg-red-500/70'
        }`}
      />
      <CardContent className="flex h-auto min-h-[390px] flex-col p-4 md:p-5">
        <div className="flex items-start gap-3 md:gap-4">
          <Avatar className="h-11 w-11 md:h-12 md:w-12 shrink-0">
            <AvatarImage src={patient.profile_photo_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs md:text-sm">
              {getInitials(patient.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 w-full text-left">
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 flex-1 text-left text-sm md:text-[15px] leading-snug font-semibold text-foreground break-words whitespace-normal group-hover:text-primary transition-colors">
                {copy.isSalon
                  ? formatPatientDisplayName(patient.full_name, patient.nickname)
                  : formatPersonName(patient.full_name)}
              </h3>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="-mr-1 -mt-1 h-8 w-8 shrink-0 self-start">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!isPreRegistration ? (
                    <>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onNavigate(patient.id); }}>
                        <FileText className="w-4 h-4 mr-2" />
                        Ver Ficha
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => onToggleActive(patient, e)} disabled={actionLoading}>
                        {isActive ? <><UserX className="w-4 h-4 mr-2" />Desativar cliente</> : <><UserCheck className="w-4 h-4 mr-2" />Ativar cliente</>}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onNavigate(patient.id); }}>
                        <FileText className="w-4 h-4 mr-2" />
                        Ver Ficha
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/patients/${patient.id}/edit?complete=1`);
                        }}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Completar cadastro
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => onSendRegistrationLink(patient, e)}
                        disabled={sendingRegistrationLink || actionLoading}
                      >
                        {sendingRegistrationLink ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Enviar ficha para cadastro
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => onRemoveClick(patient, e)}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isPreRegistration ? 'Remover contato' : 'Remover cliente'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="mt-2 flex items-center justify-start gap-1.5 flex-wrap">
              {isPreRegistration ? (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full border-amber-500/50 text-amber-700 dark:text-amber-400">
                  Pré-cadastro WhatsApp
                </Badge>
              ) : (
                <Badge
                  variant={isActive ? 'default' : 'destructive'}
                  className={`text-[10px] px-2 py-0.5 rounded-full ${isActive ? 'bg-emerald-600 hover:bg-emerald-600' : ''}`}
                >
                  {isActive ? 'Ativo' : 'Inativo'}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="mt-2.5 w-full text-left">
          <p className="w-full text-left text-xs text-muted-foreground leading-relaxed">
            {stats?.nextAppointmentDate
              ? `${copy.nextConsultation}: ${format(parseLocalDate(stats.nextAppointmentDate), 'dd/MM/yyyy', { locale: ptBR })}${stats?.nextAppointmentTime ? ` às ${stats.nextAppointmentTime.slice(0, 5)}` : ''}`
              : stats?.lastSessionDate
              ? `Última sessão: ${format(parseLocalDate(stats.lastSessionDate), 'dd/MM/yyyy', { locale: ptBR })}`
              : 'Sem sessões'}
          </p>
          {patient.phone && (
            <p className="mt-1 flex w-full items-center justify-start gap-1.5 text-left text-xs text-muted-foreground">
              <Phone className="w-3 h-3 shrink-0" />
              <span className="block break-all text-left">{patient.phone}</span>
            </p>
          )}
          {patient.sex && (
            <Badge variant="secondary" className="mt-2 justify-start text-[10px] text-left">
              {getSexLabel(patient.sex)}
            </Badge>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-muted/20 px-3 py-2.5 border border-border/60">
            <p className="text-xs text-muted-foreground">Procedimentos</p>
            <p className="text-lg leading-none font-semibold mt-1">{stats?.proceduresCount ?? 0}</p>
          </div>
          <div className="rounded-xl bg-muted/20 px-3 py-2.5 border border-border/60">
            <p className="text-xs text-muted-foreground">Sessões</p>
            <p className="text-lg leading-none font-semibold mt-1">{stats?.sessionsCount ?? 0}</p>
          </div>
        </div>
        <div className="mt-4.5 min-h-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Linha do tempo</p>
            {!!stats?.timeline?.length && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium text-muted-foreground">
                {stats.timeline.length} {stats.timeline.length === 1 ? 'item' : 'itens'}
              </Badge>
            )}
          </div>
          {stats?.timeline?.length ? (
            <ul className="mt-2.5 space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
              {stats.timeline.map((item, idx) => (
                <li
                  key={`${patient.id}-tl-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/15 px-2.5 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
                    <span className="truncate text-foreground">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                    <Badge variant="secondary" className="text-[10px] font-medium whitespace-nowrap px-1.5 py-0">
                      {item.count} {item.count === 1 ? 'sessão' : 'sess.'}
                    </Badge>
                    <span className="whitespace-nowrap text-[11px]">
                      {format(parseLocalDate(item.date), 'dd/MM', { locale: ptBR })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-2">
              Sem sessões registradas
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

type RegistrationFilter = 'complete' | 'pre' | 'all';

export default function Patients() {
  const navigate = useNavigate();
  const copy = useUiCopy();
  const { appName } = useBranchBranding();
  const { user, profile, loading: authLoading } = useAuth();
  const professionalId = profile?.id ?? user?.id;
  const { isClinicClinicalProfessional } = useClinicMemberRole();
  const [searchQuery, setSearchQuery] = useState('');
  const [registrationFilter, setRegistrationFilter] = useState<RegistrationFilter>('complete');
  const [procedureFilter, setProcedureFilter] = useState<string>('all');
  const [patientToRemove, setPatientToRemove] = useState<Patient | null>(null);
  const { mutateAsync: updateActive, isPending: togglingActive } = useUpdatePatientActive(professionalId ?? undefined);
  const { mutateAsync: deletePatient, isPending: deletingPatient } = useDeletePatient(professionalId ?? undefined);
  const actionLoading = togglingActive || deletingPatient;
  const [patientStats, setPatientStats] = useState<Record<string, PatientStats>>({});
  const [patientProcedureNames, setPatientProcedureNames] = useState<Record<string, string[]>>({});
  const [sendingRegistrationPatientId, setSendingRegistrationPatientId] = useState<string | null>(null);
  const [salonPreRegOpen, setSalonPreRegOpen] = useState(false);

  const { patients, isPageLoading } = usePatients(professionalId ?? undefined);

  const goToPatient = useCallback((patientId: string) => {
    navigate(`/patients/${patientId}`);
  }, [navigate]);

  const displayedPatients = useMemo(() => {
    if (registrationFilter === 'pre') {
      return patients.filter((p) => p.registration_completed_at == null);
    }
    if (registrationFilter === 'all') {
      return patients;
    }
    return patients.filter((p) => p.registration_completed_at != null);
  }, [patients, registrationFilter]);

  const handleToggleActive = useCallback((patient: Patient, e: React.MouseEvent) => {
    e.stopPropagation();
    updateActive({ patientId: patient.id, isActive: !patient.is_active })
      .then(() => toast.success(patient.is_active ? 'Cliente desativado.' : 'Cliente ativado.'))
      .catch(() => toast.error('Erro ao atualizar. Tente novamente.'));
  }, [updateActive]);

  const handleRemoveClick = useCallback((patient: Patient, e: React.MouseEvent) => {
    e.stopPropagation();
    setPatientToRemove(patient);
  }, []);

  useEffect(() => {
    if (displayedPatients.length === 0 || !user?.id) return;
    fetchPatientStats(displayedPatients.map((p) => p.id));
  }, [displayedPatients, user?.id]);

  async function fetchPatientStats(patientIds: string[]) {
    if (!user?.id || patientIds.length === 0) {
      setPatientStats({});
      setPatientProcedureNames({});
      return;
    }
    try {
      const { data: instances } = await supabase
        .from('procedure_instances')
        .select('id, patient_id, procedures(name)')
        .eq('professional_id', user.id)
        .in('patient_id', patientIds);

      const instanceList = (instances ?? []) as {
        id: string;
        patient_id: string;
        procedures: { name: string } | null;
      }[];

      const instanceIds = instanceList.map((i) => i.id);

      const { data: sessions } = instanceIds.length
        ? await supabase
            .from('procedure_sessions')
            .select('session_date, procedure_instance_id')
            .in('procedure_instance_id', instanceIds)
            .order('session_date', { ascending: false })
        : { data: [] as { session_date: string; procedure_instance_id: string }[] };

      const sessionsList = (sessions ?? []) as { session_date: string; procedure_instance_id: string }[];

      const today = format(new Date(), 'yyyy-MM-dd');
      const nowTime = format(new Date(), 'HH:mm:ss');
      const { data: upcomingAppointments } = await supabase
        .from('appointments')
        .select('patient_id, appointment_date, start_time')
        .eq('professional_id', user.id)
        .in('patient_id', patientIds)
        .gte('appointment_date', today)
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true });

      const appointmentsList = (upcomingAppointments ?? []) as {
        patient_id: string;
        appointment_date: string;
        start_time: string | null;
      }[];

      const instanceById = new Map(instanceList.map((i) => [i.id, i]));
      const stats: Record<string, PatientStats> = {};
      const procedureMapByPatient: Record<string, Map<string, { name: string; date: string; count: number }>> = {};
      const procedureSetByPatient: Record<string, Set<string>> = {};

      patientIds.forEach((id) => {
        stats[id] = {
          proceduresCount: 0,
          sessionsCount: 0,
          lastSessionDate: null,
          nextAppointmentDate: null,
          nextAppointmentTime: null,
          timeline: [],
        };
        procedureMapByPatient[id] = new Map();
        procedureSetByPatient[id] = new Set();
      });

      instanceList.forEach((inst) => {
        const entry = stats[inst.patient_id];
        if (entry) entry.proceduresCount += 1;
        const procName = inst.procedures?.name?.trim();
        if (procName) procedureSetByPatient[inst.patient_id]?.add(procName);
      });

      sessionsList.forEach((s) => {
        const inst = instanceById.get(s.procedure_instance_id);
        if (!inst) return;
        const entry = stats[inst.patient_id];
        if (!entry) return;
        entry.sessionsCount += 1;
        if (!entry.lastSessionDate || s.session_date > entry.lastSessionDate) {
          entry.lastSessionDate = s.session_date;
        }
        const procName = inst.procedures?.name ?? 'Procedimento';
        const map = procedureMapByPatient[inst.patient_id];
        if (!map) return;
        const current = map.get(procName);
        if (!current) {
          map.set(procName, { name: procName, date: s.session_date, count: 1 });
        } else {
          current.count += 1;
          if (s.session_date > current.date) current.date = s.session_date;
        }
      });

      appointmentsList.forEach((a) => {
        const entry = stats[a.patient_id];
        if (!entry || !a.appointment_date) return;
        if (a.appointment_date === today && (a.start_time || '00:00:00') < nowTime) return;
        if (!entry.nextAppointmentDate) {
          entry.nextAppointmentDate = a.appointment_date;
          entry.nextAppointmentTime = a.start_time || null;
        }
      });

      Object.entries(procedureMapByPatient).forEach(([patientId, map]) => {
        const timeline = Array.from(map.values())
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 3);
        const entry = stats[patientId];
        if (entry) entry.timeline = timeline;
      });

      setPatientStats(stats);
      const proceduresByPatient: Record<string, string[]> = {};
      Object.entries(procedureSetByPatient).forEach(([patientId, namesSet]) => {
        proceduresByPatient[patientId] = Array.from(namesSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      });
      setPatientProcedureNames(proceduresByPatient);
    } catch (err) {
      console.error('Error fetching patient stats:', err);
      setPatientStats({});
      setPatientProcedureNames({});
    }
  }

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const shouldApplySearch = normalizedSearch.length >= 3;
  const hasActiveFilters =
    normalizedSearch.length > 0 || procedureFilter !== 'all' || registrationFilter !== 'complete';

  const procedureOptions = useMemo(() => {
    const names = new Set<string>();
    displayedPatients.forEach((patient) => {
      (patientProcedureNames[patient.id] ?? []).forEach((name) => names.add(name));
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [displayedPatients, patientProcedureNames]);

  const filteredPatients = useMemo(
    () =>
      displayedPatients.filter((patient) => {
        const matchesProcedure =
          procedureFilter === 'all' || (patientProcedureNames[patient.id] ?? []).includes(procedureFilter);
        const matchesSearch =
          !shouldApplySearch ||
          (copy.isSalon
            ? patientMatchesSearch(patient, normalizedSearch)
            : patient.full_name.toLowerCase().includes(normalizedSearch) ||
              (patient.phone ?? '').toLowerCase().includes(normalizedSearch));
        return matchesProcedure && matchesSearch;
      }),
    [copy.isSalon, displayedPatients, normalizedSearch, patientProcedureNames, procedureFilter, shouldApplySearch]
  );

  const preRegistrationPatients = useMemo(
    () => patients.filter((p) => p.registration_completed_at == null),
    [patients]
  );

  const filteredPreRegistrationPatients = useMemo(() => {
    if (!shouldApplySearch) return [];
    return preRegistrationPatients.filter((patient) =>
      copy.isSalon
        ? patientMatchesSearch(patient, normalizedSearch)
        : patient.full_name.toLowerCase().includes(normalizedSearch) ||
            (patient.phone ?? '').toLowerCase().includes(normalizedSearch)
    );
  }, [copy.isSalon, preRegistrationPatients, normalizedSearch, shouldApplySearch]);

  const showPreRegistrationAside =
    registrationFilter === 'complete' && filteredPreRegistrationPatients.length > 0;

  async function handleConfirmRemove() {
    if (!patientToRemove) return;
    try {
      await deletePatient(patientToRemove.id);
      toast.success(
        patientToRemove.registration_completed_at == null
          ? 'Contato do WhatsApp removido.'
          : 'Cliente removido.'
      );
      setPatientToRemove(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover. Tente novamente.');
    }
  }

  async function handleSendRegistrationLink(patient: Patient, e: React.MouseEvent) {
    e.stopPropagation();
    const wa = formatPhoneForWhatsApp(patient.phone);
    if (!wa) {
      toast.error('Cadastre o telefone do paciente para enviar pelo WhatsApp.');
      return;
    }
    setSendingRegistrationPatientId(patient.id);
    try {
      const templates = await loadWhatsappManualTemplates(professionalId);
      const entry = templates.registration_invite;
      if (!entry.enabled) {
        toast.message('Mensagem desativada em Mensagens padrão.');
        return;
      }
      const slug = await ensurePatientRegistrationPublicSlug(patient.id);
      const url = buildPublicRegistrationUrl(slug);
      const message = buildRegistrationWhatsAppMessage({
        patientName: patient.full_name,
        clinicName: profile?.app_name || profile?.full_name,
        registrationUrl: url,
        template: entry.message,
      });
      openWhatsAppWithFallback({ phone: wa, text: message });
      toast.success('Abrindo o WhatsApp…');
    } catch {
      toast.error('Não foi possível gerar o link de cadastro.');
    } finally {
      setSendingRegistrationPatientId(null);
    }
  }

  if (authLoading || !professionalId || isPageLoading) {
    return <PageLoading />;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageBreadcrumb
        segments={[
          { label: 'Início', path: '/dashboard' },
          { label: copy.patients },
        ]}
        className="mb-1"
      />
      {/* Header */}
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-4 sm:px-5 sm:py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-5">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <Button variant="outline" size="icon" className="shrink-0 h-10 w-10 sm:h-11 sm:w-11 rounded-xl border-border/80 bg-background hover:bg-muted/50" asChild>
              <Link to="/dashboard" title="Início">
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </Link>
            </Button>
            <div className="min-w-0 flex-1 border-l border-border/60 pl-3 sm:pl-4">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground tracking-tight">
                {copy.patients}
              </h1>
              <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">
                {copy.isSalon
                  ? 'Gerencie seus clientes e serviços'
                  : isClinicClinicalProfessional
                    ? 'Pacientes vinculados a você'
                    : 'Gerencie seus pacientes e tratamentos'}
              </p>
            </div>
          </div>
          {copy.isSalon ? (
            <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full lg:w-auto">
              <Button
                type="button"
                variant="outline"
                className="gap-2 w-full sm:w-auto h-11 sm:h-10 text-sm font-medium touch-manipulation"
                onClick={() => setSalonPreRegOpen(true)}
              >
                <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                Pré-cadastro
              </Button>
              <Link to="/patients/new" className="w-full sm:w-auto">
                <Button className="gap-2 w-full lg:w-auto h-11 sm:h-10 text-sm font-medium touch-manipulation">
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                  Novo Cliente
                </Button>
              </Link>
            </div>
          ) : isClinicClinicalProfessional ? null : (
          <Link to="/patients/new" className="shrink-0 w-full lg:w-auto">
            <Button className="gap-2 w-full lg:w-auto h-11 sm:h-10 text-sm font-medium touch-manipulation">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              Novo Paciente
            </Button>
          </Link>
          )}
        </div>
      </div>

      {/* Search + filter */}
      <div className="w-full space-y-2">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,180px)_minmax(0,200px)_auto]">
          <div className="relative w-full sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 sm:h-10 pl-10"
            />
          </div>
          <Select value={registrationFilter} onValueChange={(v) => setRegistrationFilter(v as RegistrationFilter)}>
            <SelectTrigger className="h-11 sm:h-10 rounded-xl">
              <SelectValue placeholder="Tipo de cadastro" />
            </SelectTrigger>
            <SelectContent
              side="bottom"
              align="start"
              sideOffset={6}
              avoidCollisions={false}
              className="z-[1201]"
            >
              <SelectItem value="complete">Cadastro completo</SelectItem>
              <SelectItem value="pre">Pré-cadastros</SelectItem>
              <SelectItem value="all">Todos (completos + pré)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={procedureFilter} onValueChange={setProcedureFilter}>
            <SelectTrigger className="h-11 sm:h-10 rounded-xl">
              <SelectValue placeholder="Filtrar procedimento" />
            </SelectTrigger>
            <SelectContent
              side="bottom"
              align="start"
              sideOffset={6}
              avoidCollisions={false}
              className="z-[1201] max-h-[45vh] sm:max-h-72"
            >
              <SelectItem value="all">Todos os procedimentos</SelectItem>
              {procedureOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-10 rounded-xl sm:col-span-2 lg:col-span-1"
            onClick={() => {
              setSearchQuery('');
              setProcedureFilter('all');
              setRegistrationFilter('complete');
            }}
            disabled={!hasActiveFilters}
          >
            Limpar filtros
          </Button>
        </div>
        {normalizedSearch.length > 0 && !shouldApplySearch && (
          <p className="text-xs text-muted-foreground">
            Digite pelo menos 3 caracteres para aplicar a busca por texto.
          </p>
        )}
        {registrationFilter === 'complete' &&
        preRegistrationPatients.length > 0 &&
        !shouldApplySearch ? (
          <p className="text-xs text-muted-foreground">
            Há {preRegistrationPatients.length} contato(s) de pré-cadastro. Use o filtro{' '}
            <span className="font-medium text-foreground">Pré-cadastros</span> ou{' '}
            <span className="font-medium text-foreground">Todos</span> para exibi-los na lista, ou busque pelo nome ou
            telefone.
          </p>
        ) : null}
        {showPreRegistrationAside ? (
          <Card className="border-dashed border-amber-500/40 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Contatos do WhatsApp (pré-cadastro)</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Estes contatos não aparecem na lista principal, mas o bot ainda pode reconhecê-los pelo
                telefone. Remova aqui se a pessoa não for mais sua paciente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {filteredPreRegistrationPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/80 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {copy.isSalon
                        ? formatPatientDisplayName(patient.full_name, patient.nickname)
                        : formatPersonName(patient.full_name)}
                    </p>
                    <p className="text-xs text-muted-foreground">{patient.phone || 'Sem telefone'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={(e) => void handleSendRegistrationLink(patient, e)}
                      disabled={sendingRegistrationPatientId === patient.id || actionLoading}
                    >
                      {sendingRegistrationPatientId === patient.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Enviar ficha
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => setPatientToRemove(patient)}
                      disabled={actionLoading}
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Remover contato
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Patient List */}
      {filteredPatients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-16 h-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchQuery
                ? showPreRegistrationAside
                  ? `Nenhum ${copy.patient.toLowerCase()} completo encontrado`
                  : registrationFilter === 'pre'
                    ? 'Nenhum pré-cadastro encontrado'
                    : `Nenhum ${copy.patient.toLowerCase()} encontrado`
                : registrationFilter === 'pre'
                  ? 'Nenhum pré-cadastro'
                  : `Nenhum ${copy.patient.toLowerCase()} cadastrado`}
            </h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {searchQuery
                ? showPreRegistrationAside
                  ? `Há um contato de pré-cadastro do WhatsApp acima. Remova-o se não for mais ${copy.patient.toLowerCase()}.`
                  : 'Tente ajustar sua busca ou filtros para encontrar o contato desejado.'
                : registrationFilter === 'pre'
                  ? 'Contatos de pré-cadastro aparecem quando alguém inicia cadastro pelo WhatsApp ou agenda.'
                  : copy.isSalon
                    ? 'Comece cadastrando seu primeiro cliente para acompanhar os atendimentos.'
                    : 'Comece cadastrando seu primeiro paciente para acompanhar seus tratamentos.'}
            </p>
            {!searchQuery && registrationFilter !== 'pre' && !isClinicClinicalProfessional && (
              <Link to="/patients/new">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  {copy.isSalon ? 'Cadastrar Cliente' : 'Cadastrar Paciente'}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : filteredPatients.length >= 80 ? (
        <VirtualizedPatientList count={filteredPatients.length} className="rounded-lg">
          {(index) => {
            const patient = filteredPatients[index]!;
            return (
              <div key={patient.id} className="pb-2 sm:pb-3">
                <PatientCard
                  patient={patient}
                  stats={patientStats[patient.id]}
                  actionLoading={actionLoading}
                  onNavigate={goToPatient}
                  onToggleActive={handleToggleActive}
                  onRemoveClick={handleRemoveClick}
                  onSendRegistrationLink={handleSendRegistrationLink}
                  sendingRegistrationLink={sendingRegistrationPatientId === patient.id}
                  isPreRegistration={patient.registration_completed_at == null}
                />
              </div>
            );
          }}
        </VirtualizedPatientList>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 items-start">
          {filteredPatients.map((patient) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              stats={patientStats[patient.id]}
              actionLoading={actionLoading}
              onNavigate={goToPatient}
              onToggleActive={handleToggleActive}
              onRemoveClick={handleRemoveClick}
              onSendRegistrationLink={handleSendRegistrationLink}
              sendingRegistrationLink={sendingRegistrationPatientId === patient.id}
              isPreRegistration={patient.registration_completed_at == null}
            />
          ))}
        </div>
      )}
      <MobileBottomSafeSpacer />

      {/* Diálogo de confirmação para remover cliente */}
      <AlertDialog open={!!patientToRemove} onOpenChange={(open) => !open && setPatientToRemove(null)}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              {patientToRemove && (
                <>
                  <strong>
                    {copy.isSalon
                      ? formatPatientDisplayName(patientToRemove.full_name, patientToRemove.nickname)
                      : formatPersonName(patientToRemove.full_name)}
                  </strong>{' '}
                  {patientToRemove.registration_completed_at == null ? (
                    <>
                      será removido como contato de pré-cadastro do WhatsApp. O bot deixará de reconhecer este
                      telefone pelo nome.
                    </>
                  ) : (
                    <>
                      será removido permanentemente do sistema. Fichas, sessões e fotos vinculadas também serão
                      excluídas.
                    </>
                  )}{' '}
                  Esta ação não pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.stopPropagation();
                handleConfirmRemove();
              }}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {copy.isSalon && professionalId ? (
        <SalonPreRegistrationDialog
          open={salonPreRegOpen}
          onOpenChange={setSalonPreRegOpen}
          professionalId={professionalId}
          salonName={appName || profile?.app_name || profile?.full_name}
        />
      ) : null}
    </div>
  );
}
