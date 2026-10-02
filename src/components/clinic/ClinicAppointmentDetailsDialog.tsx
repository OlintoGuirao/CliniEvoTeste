import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClipboardList, Loader2, MessageCircle, Stethoscope, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicFrontDeskScope } from '@/hooks/use-clinic-front-desk-scope';
import {
  type ClinicAgendaProfessional,
  type ClinicAgendaStatus,
} from '@/lib/clinicAgendaBooking';
import {
  clinicAppointmentStatusLabel,
  clinicAppointmentStatusOption,
  clinicStatusWritePayload,
  resolveClinicAppointmentStatus,
} from '@/lib/clinicAppointmentStatus';
import {
  clinicProcedureLabelFromNotes,
  formatAppointmentDateTimeLabel,
  formatClinicAppointmentCode,
  formatPatientBirthLabel,
  formatRelativePt,
  isClinicAvaliacaoAppointment,
  stripClinicAppointmentMetadataFromNotes,
} from '@/lib/clinicAppointmentDetails';
import {
  buildAtendimentoPath,
  buildPresenceConfirmationMessage,
  normalizeWhatsappPhone,
} from '@/lib/clinicFrontDeskAtendimento';
import { formatPhoneDisplay } from '@/lib/phone';
import { cn, formatPersonName } from '@/lib/utils';
import { ensureAtendimentoConversation } from '@/services/api/atendimentoApi';
import { loadWhatsappManualTemplates } from '@/lib/loadWhatsappManualTemplates';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClinicAppointmentStatusSelect } from '@/components/clinic/ClinicAppointmentStatusSelect';
import { ClinicPatientProfileDialog } from '@/components/clinic/ClinicPatientProfileDialog';
import { ClinicDentalAttendanceDialog } from '@/components/clinic/ClinicDentalAttendanceDialog';
import {
  listClinicProcedureSessionsForPatient,
  type ClinicProcedureSessionRow,
} from '@/services/api/clinicProcedureSessionsApi';
import { clinicProcedureSessionStatusLabel } from '@/lib/clinicAuthorizedProcedures';
import { listClinicAuthorizedProceduresForPatient } from '@/services/api/clinicAuthorizedProceduresApi';

export type ClinicOccupiedAppointment = {
  id: string;
  patient_id: string | null;
  full_name: string | null;
  pre_registration_phone: string | null;
  appointment_date: string;
  start_time: string;
  notes: string | null;
  is_encaixe?: boolean;
  professional_id?: string;
  patients?: { full_name: string } | null;
  presence_confirmed_at?: string | null;
  clinic_status?: string | null;
};

type PatientDetails = {
  id: string;
  full_name: string;
  nickname: string | null;
  phone: string | null;
  date_of_birth: string | null;
  profile_photo_url: string | null;
};

type AppointmentExtras = {
  created_at: string | null;
  presence_confirmed_at: string | null;
  clinic_status: string | null;
};

type HistoryItem = {
  id: string;
  appointment_date: string;
  start_time: string;
  notes: string | null;
  professional_id: string;
};

type ClinicAppointmentDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  time: string;
  appointments: ClinicOccupiedAppointment[];
  professionals: ClinicAgendaProfessional[];
  clinicName?: string | null;
  saving?: boolean;
  isCompleted?: (apt: ClinicOccupiedAppointment) => boolean;
  onDelete: (apt: ClinicOccupiedAppointment) => void | Promise<void>;
  onStatusChange?: (appointmentId: string, status: ClinicAgendaStatus) => void;
  children?: ReactNode;
};

function appointmentDisplayName(apt: ClinicOccupiedAppointment): string {
  const raw = apt.patient_id
    ? apt.patients?.full_name ?? 'Paciente'
    : apt.full_name ?? 'Pré-cadastro';
  return formatPersonName(raw) || raw;
}

function professionalName(
  professionals: ClinicAgendaProfessional[],
  professionalId?: string
): string {
  if (!professionalId) return '—';
  return professionals.find((p) => p.userId === professionalId)?.name?.trim() || '—';
}

export function ClinicAppointmentDetailsDialog({
  open,
  onOpenChange,
  date,
  time,
  appointments,
  professionals,
  clinicName,
  saving = false,
  isCompleted,
  onDelete,
  onStatusChange,
  children,
}: ClinicAppointmentDetailsDialogProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isFrontDeskStaff, scope } = useClinicFrontDeskScope();
  const whatsappProfessionalId =
    (isFrontDeskStaff ? scope?.whatsappProfessionalId : profile?.id) || profile?.id || '';

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [patient, setPatient] = useState<PatientDetails | null>(null);
  const [extras, setExtras] = useState<AppointmentExtras | null>(null);
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<
    Array<ClinicProcedureSessionRow & { procedureName?: string }>
  >([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [openingWhatsapp, setOpeningWhatsapp] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState('detalhes');
  const [profilePopup, setProfilePopup] = useState(false);
  const [avaliacaoPopup, setAvaliacaoPopup] = useState(false);

  const selected = useMemo(() => {
    if (appointments.length === 0) return null;
    return appointments.find((a) => a.id === selectedId) ?? appointments[0] ?? null;
  }, [appointments, selectedId]);

  useEffect(() => {
    if (!open) return;
    setSelectedId((prev) => {
      if (prev && appointments.some((apt) => apt.id === prev)) return prev;
      return appointments[0]?.id ?? null;
    });
  }, [open, appointments]);

  useEffect(() => {
    if (!open) return;
    setTab('detalhes');
    setConfirmDelete(false);
    setProfilePopup(false);
    setAvaliacaoPopup(false);
  }, [open]);

  useEffect(() => {
    if (!open || !selected) {
      setPatient(null);
      setExtras(null);
      setLastVisit(null);
      setHistory([]);
      setAttendanceHistory([]);
      return;
    }

    let cancelled = false;
    const aptId = selected.id;
    const patientId = selected.patient_id;
    const appointmentDate = selected.appointment_date;
    const startTime = selected.start_time;
    const professionalIds = professionals.map((p) => p.userId).filter(Boolean);
    const fallbackPresence = selected.presence_confirmed_at ?? null;

    const load = async () => {
      setLoadingDetails(true);
      try {
        const [{ data: aptRow }, patientRes] = await Promise.all([
          supabase
            .from('appointments')
            .select('id, created_at, presence_confirmed_at, clinic_status, notes, professional_id')
            .eq('id', aptId)
            .maybeSingle(),
          patientId
            ? supabase
                .from('patients')
                .select('id, full_name, nickname, phone, date_of_birth, profile_photo_url')
                .eq('id', patientId)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);
        if (cancelled) return;

        setExtras({
          created_at: (aptRow as { created_at?: string } | null)?.created_at ?? null,
          presence_confirmed_at:
            (aptRow as { presence_confirmed_at?: string | null } | null)?.presence_confirmed_at ??
            fallbackPresence,
          clinic_status:
            (aptRow as { clinic_status?: string | null } | null)?.clinic_status ??
            selected.clinic_status ??
            null,
        });
        setPatient((patientRes.data as PatientDetails | null) ?? null);

        if (patientId && professionalIds.length > 0) {
          const currentStamp = `${appointmentDate}T${startTime}`;
          const [{ data: hist }, sessions, authorized] = await Promise.all([
            supabase
              .from('appointments')
              .select('id, appointment_date, start_time, notes, professional_id')
              .eq('patient_id', patientId)
              .in('professional_id', professionalIds)
              .order('appointment_date', { ascending: false })
              .order('start_time', { ascending: false })
              .limit(20),
            listClinicProcedureSessionsForPatient(patientId).catch(() => []),
            listClinicAuthorizedProceduresForPatient(patientId).catch(() => []),
          ]);
          if (cancelled) return;
          const items = ((hist ?? []) as HistoryItem[]).filter((item) => item.id !== aptId);
          setHistory(items);
          const procedureNameByItem = new Map(
            authorized.map((card) => [card.planItemId, card.procedureName] as const)
          );
          setAttendanceHistory(
            sessions.map((session) => ({
              ...session,
              procedureName: session.plan_item_id
                ? procedureNameByItem.get(session.plan_item_id)
                : undefined,
            }))
          );
          const previous = items.find(
            (item) => `${item.appointment_date}T${item.start_time}` < currentStamp
          );
          setLastVisit(
            previous
              ? `${format(parseISO(previous.appointment_date), 'dd/MM/yyyy')} às ${previous.start_time.slice(0, 5)}`
              : null
          );
        } else {
          setHistory([]);
          setAttendanceHistory([]);
          setLastVisit(null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      } finally {
        if (!cancelled) setLoadingDetails(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, selected, professionals]);

  const patientName = selected ? appointmentDisplayName(selected) : 'Paciente';
  const phone =
    patient?.phone ??
    selected?.pre_registration_phone ??
    null;
  const procedureLabel = selected ? clinicProcedureLabelFromNotes(selected.notes) : null;
  const isAvaliacao = selected ? isClinicAvaliacaoAppointment(selected.notes) : false;
  const userNotes = selected ? stripClinicAppointmentMetadataFromNotes(selected.notes) : null;
  const status = resolveClinicAppointmentStatus({
    clinicStatus: extras?.clinic_status ?? selected?.clinic_status,
    presenceConfirmedAt: extras?.presence_confirmed_at ?? selected?.presence_confirmed_at,
  });
  const completed = selected ? Boolean(isCompleted?.(selected)) : false;
  const shortCode = selected ? formatClinicAppointmentCode(selected.id) : '';

  const handleStatusChange = async (next: ClinicAgendaStatus) => {
    if (!selected || next === status) return;
    setSavingStatus(true);
    try {
      const payload = clinicStatusWritePayload(next, {
        presence_confirmed_at: extras?.presence_confirmed_at ?? selected.presence_confirmed_at,
      });
      const { error } = await supabase
        .from('appointments')
        .update(payload as never)
        .eq('id', selected.id);
      if (error) throw error;
      setExtras((prev) => ({
        created_at: prev?.created_at ?? null,
        presence_confirmed_at: payload.presence_confirmed_at,
        clinic_status: payload.clinic_status,
      }));
      onStatusChange?.(selected.id, next);
      toast.success(`Situação atualizada para ${clinicAppointmentStatusLabel(next)}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o status.');
    } finally {
      setSavingStatus(false);
    }
  };

  const openWhatsapp = async () => {
    if (!selected) return;
    const wa = normalizeWhatsappPhone(phone);
    if (!wa) {
      toast.error('Cadastre o telefone do paciente para chamar no WhatsApp.');
      return;
    }
    if (!whatsappProfessionalId) {
      toast.error('Não foi possível abrir o atendimento.');
      return;
    }
    const templates = await loadWhatsappManualTemplates(whatsappProfessionalId);
    const entry = templates.presence_request;
    if (!entry.enabled) {
      toast.message('Mensagem desativada em Mensagens padrão.');
      return;
    }
    const draft = buildPresenceConfirmationMessage({
      patientName,
      appointmentDate: selected.appointment_date,
      startTime: time,
      procedureLabel,
      professionalName: professionalName(professionals, selected.professional_id),
      clinicName,
      template: entry.message,
    });
    setOpeningWhatsapp(true);
    try {
      const conv = await ensureAtendimentoConversation({
        professionalId: whatsappProfessionalId,
        phone: wa,
        patientName,
      });
      onOpenChange(false);
      navigate(
        buildAtendimentoPath({
          conversationId: conv.id,
          phone: wa,
          patientName,
          draft,
        })
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível abrir o atendimento.');
    } finally {
      setOpeningWhatsapp(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(92dvh,920px)] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl sm:rounded-xl">
          <div className="border-b border-border/70 px-4 py-3 pr-12 sm:px-6">
            <DialogTitle className="text-base font-semibold sm:text-lg">
              Detalhes do agendamento{shortCode ? ` #${shortCode}` : ''}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Paciente, horário, profissional e ações deste agendamento.
            </DialogDescription>
          </div>

          {selected ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-4 px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold leading-tight text-foreground [overflow-wrap:anywhere] sm:text-xl">
                      {patientName}
                    </h3>
                    {appointments.length > 1 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {appointments.map((apt, index) => (
                          <button
                            key={apt.id}
                            type="button"
                            onClick={() => setSelectedId(apt.id)}
                            className={cn(
                              'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                              apt.id === selected.id
                                ? 'border-primary/40 bg-primary/10 text-primary'
                                : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                            )}
                          >
                            {appointmentDisplayName(apt)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {selected.patient_id ? (
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => setProfilePopup(true)}
                      >
                        <User className="h-3.5 w-3.5" />
                        Ver ficha
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => {
                          if (isAvaliacao) {
                            setAvaliacaoPopup(true);
                            return;
                          }
                          onOpenChange(false);
                          const qs = new URLSearchParams({
                            appointmentId: selected.id,
                            returnTo: '/agenda',
                          });
                          navigate(`/patients/${selected.patient_id}/session/new?${qs.toString()}`);
                        }}
                      >
                        {isAvaliacao ? (
                          <ClipboardList className="h-3.5 w-3.5" />
                        ) : (
                          <Stethoscope className="h-3.5 w-3.5" />
                        )}
                        {isAvaliacao ? 'Nova avaliação' : 'Novo atendimento'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1.5"
                        disabled={!phone || openingWhatsapp}
                        onClick={() => void openWhatsapp()}
                      >
                        {openingWhatsapp ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <MessageCircle className="h-3.5 w-3.5" />
                        )}
                        WhatsApp
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Pré-cadastro — complete a ficha depois.</p>
                  )}
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-3 py-3 sm:px-4">
                  <Avatar className="h-12 w-12 border border-border bg-background">
                    {patient?.profile_photo_url ? (
                      <AvatarImage src={patient.profile_photo_url} alt={patientName} />
                    ) : null}
                    <AvatarFallback className="bg-background text-muted-foreground">
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <dl className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[11px] font-medium text-muted-foreground">Data de nascimento</dt>
                      <dd>{formatPatientBirthLabel(patient?.date_of_birth) ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-medium text-muted-foreground">Último atendimento</dt>
                      <dd>{lastVisit ?? '—'}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-[11px] font-medium text-muted-foreground">Telefone</dt>
                      <dd className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>{phone ? formatPhoneDisplay(phone) : '—'}</span>
                        {phone ? (
                          <button
                            type="button"
                            onClick={() => void openWhatsapp()}
                            disabled={openingWhatsapp}
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-700 hover:underline disabled:opacity-60 dark:text-emerald-400"
                          >
                            {openingWhatsapp ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <MessageCircle className="h-3 w-3" />
                            )}
                            Chamar pelo WhatsApp
                          </button>
                        ) : null}
                      </dd>
                    </div>
                  </dl>
                </div>

                <Tabs value={tab} onValueChange={setTab} className="w-full">
                  <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
                    <TabsTrigger
                      value="detalhes"
                      className="rounded-none border-b-2 border-transparent px-3 py-2 text-sm shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      Detalhes
                    </TabsTrigger>
                    <TabsTrigger
                      value="historico"
                      className="rounded-none border-b-2 border-transparent px-3 py-2 text-sm shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      Histórico na clínica
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="detalhes" className="mt-4 space-y-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
                        <h4 className="mb-3 text-sm font-semibold">Informações do atendimento</h4>
                        <p className="mb-3 text-sm text-muted-foreground">
                          {formatAppointmentDateTimeLabel(date, time)}
                        </p>
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="clinic-apt-status">Situação do agendamento</Label>
                            <ClinicAppointmentStatusSelect
                              id="clinic-apt-status"
                              value={status}
                              onValueChange={(next) => void handleStatusChange(next)}
                              disabled={savingStatus}
                            />
                          </div>
                          <DetailRow
                            label="Agenda"
                            value={professionalName(professionals, selected.professional_id)}
                          />
                          <DetailRow
                            label="Tipo de atendimento"
                            value={procedureLabel ?? '—'}
                          />
                          <DetailRow
                            label="Profissional de saúde"
                            value={professionalName(professionals, selected.professional_id)}
                          />
                          {userNotes ? <DetailRow label="Observações" value={userNotes} /> : null}
                        </div>
                      </section>

                      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
                        <h4 className="mb-3 text-sm font-semibold">Situação do agendamento</h4>
                        {loadingDetails && !extras ? (
                          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Carregando histórico…
                          </div>
                        ) : (
                          <ol className="relative space-y-4 border-l border-border pl-4">
                            <TimelineItem
                              title={clinicAppointmentStatusLabel(status)}
                              stamp={extras?.presence_confirmed_at ?? extras?.created_at}
                              badgeClassName={clinicAppointmentStatusOption(status).triggerClassName}
                              dotClassName={clinicAppointmentStatusOption(status).iconWrapClassName}
                            />
                            <TimelineItem
                              title="Criação do agendamento"
                              stamp={extras?.created_at}
                              tone="created"
                            />
                          </ol>
                        )}
                      </section>
                    </div>
                    {children}
                  </TabsContent>

                  <TabsContent value="historico" className="mt-4 space-y-5">
                    {!selected.patient_id ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        Histórico disponível após o cadastro completo do paciente.
                      </p>
                    ) : loadingDetails ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando…
                      </div>
                    ) : (
                      <>
                        <section className="space-y-2">
                          <h4 className="text-sm font-semibold">Atendimentos de procedimentos</h4>
                          {attendanceHistory.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                              Nenhum atendimento clínico registrado. Use &quot;Novo atendimento&quot;.
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {attendanceHistory.map((item) => (
                                <li key={item.id}>
                                  <button
                                    type="button"
                                    className="w-full rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-left text-sm hover:bg-muted/40"
                                    onClick={() => {
                                      onOpenChange(false);
                                      navigate(
                                        `/patients/${selected.patient_id}/clinic-attendance/${item.id}?returnTo=${encodeURIComponent('/agenda')}`
                                      );
                                    }}
                                  >
                                    <p className="font-medium">
                                      {item.procedureName || 'Procedimento'} ·{' '}
                                      {clinicProcedureSessionStatusLabel(item.status)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(
                                        parseISO(item.finished_at ?? item.updated_at ?? item.created_at),
                                        "dd/MM/yyyy 'às' HH:mm",
                                        { locale: ptBR }
                                      )}
                                    </p>
                                    {item.observations ? (
                                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                        {item.observations}
                                      </p>
                                    ) : null}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>

                        <section className="space-y-2">
                          <h4 className="text-sm font-semibold">Agendamentos na clínica</h4>
                          {history.length === 0 ? (
                            <p className="py-4 text-center text-sm text-muted-foreground">
                              Nenhum outro agendamento deste paciente na clínica.
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {history.map((item) => (
                                <li
                                  key={item.id}
                                  className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-sm"
                                >
                                  <p className="font-medium">
                                    {format(parseISO(item.appointment_date), "EEEE, d 'de' MMMM", {
                                      locale: ptBR,
                                    })}{' '}
                                    às {item.start_time.slice(0, 5)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {professionalName(professionals, item.professional_id)}
                                    {clinicProcedureLabelFromNotes(item.notes)
                                      ? ` · ${clinicProcedureLabelFromNotes(item.notes)}`
                                      : ''}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-border/70 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            {!isFrontDeskStaff ? (
              <Button
                type="button"
                variant="destructive"
                className="gap-1.5"
                disabled={saving || completed || !selected}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
                Excluir agendamento
              </Button>
            ) : (
              <div />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O horário de {patientName} às {time} será desmarcado. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={cn('bg-destructive text-destructive-foreground hover:bg-destructive/90')}
              onClick={() => {
                if (!selected) return;
                void onDelete(selected);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ClinicPatientProfileDialog
        open={profilePopup && Boolean(selected?.patient_id)}
        onOpenChange={setProfilePopup}
        patientId={selected?.patient_id ?? null}
        onPatientUpdated={() => {
          const id = selected?.patient_id;
          if (!id) return;
          void supabase
            .from('patients')
            .select('id, full_name, nickname, phone, date_of_birth, profile_photo_url')
            .eq('id', id)
            .maybeSingle()
            .then(({ data }) => {
              if (data) setPatient(data as PatientDetails);
            });
        }}
      />

      <ClinicDentalAttendanceDialog
        open={avaliacaoPopup && Boolean(selected?.patient_id)}
        onOpenChange={setAvaliacaoPopup}
        patientId={selected?.patient_id ?? null}
        patientName={patientName}
        title="Nova avaliação"
        preferCreatePlan
      />
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="text-sm leading-snug [overflow-wrap:anywhere]">{value}</p>
    </div>
  );
}

function TimelineItem({
  title,
  stamp,
  tone,
  badgeClassName,
  dotClassName,
}: {
  title: string;
  stamp: string | null | undefined;
  tone?: 'created';
  badgeClassName?: string;
  dotClassName?: string;
}) {
  const when = stamp
    ? format(new Date(stamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : null;
  const relative = formatRelativePt(stamp ?? null);
  return (
    <li className="relative">
      <span
        className={cn(
          'absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background',
          tone === 'created' ? 'bg-muted-foreground/50' : dotClassName ?? 'bg-amber-400'
        )}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold',
            tone === 'created' ? 'bg-muted text-muted-foreground' : badgeClassName
          )}
        >
          {title}
        </span>
        {when ? <span className="text-xs text-muted-foreground">{when}</span> : null}
        {relative ? <span className="text-[11px] text-muted-foreground">{relative}</span> : null}
      </div>
      {tone === 'created' ? (
        <p className="mt-1 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
          Criação do agendamento
        </p>
      ) : null}
    </li>
  );
}
