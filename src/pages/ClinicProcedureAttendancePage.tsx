import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  CheckCircle2,
  History,
  Loader2,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { isClinicOnlyAccount } from '@/lib/accountType';
import { clinicProcedureSessionStatusLabel } from '@/lib/clinicAuthorizedProcedures';
import { PageLoading } from '@/components/layout/PageLoading';
import { PatientDocumentsSection } from '@/components/patient-detail/PatientDocumentsSection';
import { TermSignatureDialog } from '@/components/TermSignatureDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
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
  createClinicProcedureSession,
  findOpenClinicProcedureSession,
  getClinicProcedureSession,
  listClinicProcedureSessionsForPlanItem,
  updateClinicProcedureSession,
  type ClinicProcedureSessionRow,
} from '@/services/api/clinicProcedureSessionsApi';
import {
  getDentalPlan,
  listDentalPlanItems,
  updateDentalPlanItem,
} from '@/services/api/dentalPlansApi';
import { formatClinicLocationLabel } from '@/lib/clinicAuthorizedProcedures';
import { clinicStatusWritePayload } from '@/lib/clinicAppointmentStatus';
import { supabase } from '@/integrations/supabase/client';

export default function ClinicProcedureAttendancePage() {
  const { id: patientId, sessionId } = useParams<{ id: string; sessionId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isClinicAccount = isClinicOnlyAccount(profile?.account_type);

  const planItemIdParam = searchParams.get('planItemId');
  const appointmentId = searchParams.get('appointmentId');
  const returnTo = searchParams.get('returnTo') || '/agenda';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [session, setSession] = useState<ClinicProcedureSessionRow | null>(null);
  const [procedureName, setProcedureName] = useState('');
  const [planName, setPlanName] = useState('');
  const [planId, setPlanId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [finishedCount, setFinishedCount] = useState(0);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [planNotes, setPlanNotes] = useState<string | null>(null);
  const [observations, setObservations] = useState('');
  const [clinicalAnalysis, setClinicalAnalysis] = useState('');
  const [clinicalConclusion, setClinicalConclusion] = useState('');
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [history, setHistory] = useState<ClinicProcedureSessionRow[]>([]);
  const readOnly = session?.status === 'finished' || session?.status === 'cancelled';

  const loadContext = useCallback(async () => {
    if (!patientId || !profile?.id || !isClinicAccount) return;
    setLoading(true);
    try {
      const { data: patient } = await supabase
        .from('patients')
        .select('full_name')
        .eq('id', patientId)
        .single();
      setPatientName((patient as { full_name?: string } | null)?.full_name ?? '');

      let current =
        sessionId && sessionId !== 'new' ? await getClinicProcedureSession(sessionId) : null;

      if (!current && planItemIdParam) {
        const planItemLookup = await findPlanItemContext(planItemIdParam);
        if (!planItemLookup) {
          toast.error('Procedimento autorizado não encontrado.');
          navigate(returnTo);
          return;
        }

        const existingOpen = await findOpenClinicProcedureSession({
          patientId,
          planItemId: planItemLookup.item.id,
        });

        current =
          existingOpen ??
          (await createClinicProcedureSession({
            patientId,
            professionalId: profile.id,
            appointmentId,
            treatmentPlanId: planItemLookup.plan.id,
            planItemId: planItemLookup.item.id,
            status: 'draft',
          }));

        if (existingOpen && appointmentId && !existingOpen.appointment_id) {
          current = await updateClinicProcedureSession(existingOpen.id, {
            appointment_id: appointmentId,
          });
        }

        navigate(
          `/patients/${patientId}/clinic-attendance/${current.id}?${new URLSearchParams({
            ...(appointmentId ? { appointmentId } : {}),
            ...(returnTo ? { returnTo } : {}),
          }).toString()}`,
          { replace: true }
        );
      }

      if (!current) {
        toast.error('Atendimento não encontrado.');
        navigate(returnTo);
        return;
      }

      setSession(current);
      setObservations(current.observations ?? '');
      setClinicalAnalysis(current.clinical_analysis ?? '');
      setClinicalConclusion(current.clinical_conclusion ?? '');
      setPlanId(current.treatment_plan_id);

      if (current.plan_item_id) {
        const ctx = await findPlanItemContext(current.plan_item_id);
        if (ctx) {
          setProcedureName(ctx.item.procedure_name);
          setPlanName(ctx.plan.name);
          setPlanId(ctx.plan.id);
          setQuantity(ctx.item.quantity);
          setPlanNotes(ctx.item.notes);
          setLocationLabel(formatClinicLocationLabel(ctx.locations));
          const itemSessions = await listClinicProcedureSessionsForPlanItem(ctx.item.id);
          setHistory(itemSessions);
          setFinishedCount(itemSessions.filter((s) => s.status === 'finished').length);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível carregar o atendimento.');
    } finally {
      setLoading(false);
    }
  }, [
    patientId,
    profile?.id,
    isClinicAccount,
    sessionId,
    planItemIdParam,
    appointmentId,
    navigate,
    returnTo,
  ]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const remaining = useMemo(
    () => Math.max(0, quantity - finishedCount),
    [quantity, finishedCount]
  );

  async function persist(patchStatus?: ClinicProcedureSessionRow['status']) {
    if (!session || !profile?.id || readOnly) return null;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const nextStatus = patchStatus ?? session.status;
      const updated = await updateClinicProcedureSession(session.id, {
        observations: observations.trim() || null,
        clinical_analysis: clinicalAnalysis.trim() || null,
        clinical_conclusion: clinicalConclusion.trim() || null,
        status: nextStatus,
        started_at:
          nextStatus === 'in_progress' || nextStatus === 'finished'
            ? session.started_at ?? now
            : session.started_at,
        finished_at: nextStatus === 'finished' ? now : null,
        appointment_id: session.appointment_id ?? appointmentId,
      });
      setSession(updated);
      return updated;
    } finally {
      setSaving(false);
    }
  }

  async function syncLinkedAppointmentStatus(next: 'in_progress' | 'finished') {
    const linkedAppointmentId = session?.appointment_id ?? appointmentId;
    if (!linkedAppointmentId) return;

    const { data: apt } = await supabase
      .from('appointments')
      .select('id, clinic_status, presence_confirmed_at, presence_declined_at')
      .eq('id', linkedAppointmentId)
      .maybeSingle();

    const currentStatus = (apt as { clinic_status?: string | null } | null)?.clinic_status;
    // Não sobrescreve cancelamentos / falta / já finalizado (exceto quando avançamos para finished).
    if (
      currentStatus === 'cancelled_by_professional' ||
      currentStatus === 'cancelled_by_patient' ||
      currentStatus === 'no_show'
    ) {
      return;
    }
    if (next === 'in_progress' && currentStatus === 'finished') {
      return;
    }

    const payload = clinicStatusWritePayload(next, {
      presence_confirmed_at:
        (apt as { presence_confirmed_at?: string | null } | null)?.presence_confirmed_at ?? null,
      presence_declined_at:
        (apt as { presence_declined_at?: string | null } | null)?.presence_declined_at ?? null,
    });

    const { error } = await supabase
      .from('appointments')
      .update(payload)
      .eq('id', linkedAppointmentId);
    if (error) throw error;
  }

  async function handleSaveDraft() {
    try {
      await persist('draft');
      toast.success('Rascunho salvo.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar rascunho.');
    }
  }

  async function handleInProgress() {
    try {
      await persist('in_progress');
      await syncLinkedAppointmentStatus('in_progress');
      toast.success('Atendimento marcado como em andamento.');
      navigate(returnTo);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar atendimento.');
    }
  }

  async function handleFinish() {
    if (!session?.plan_item_id) {
      toast.error('Procedimento obrigatório.');
      return;
    }
    if (!observations.trim()) {
      toast.error('Informe as observações do atendimento antes de finalizar.');
      return;
    }
    if (session.signature_status === 'pending') {
      toast.error('Há assinatura pendente. Conclua ou cancele a solicitação antes de finalizar.');
      return;
    }
    setSaving(true);
    try {
      const updated = await persist('finished');
      if (!updated) return;

      const itemSessions = await listClinicProcedureSessionsForPlanItem(session.plan_item_id);
      const doneCount = itemSessions.filter((s) => s.status === 'finished').length;
      if (doneCount >= quantity) {
        await updateDentalPlanItem(session.plan_item_id, { status: 'done' });
      } else if (session.plan_item_id) {
        await updateDentalPlanItem(session.plan_item_id, { status: 'authorized' });
      }

      // Só marca o agendamento como finalizado neste vínculo; outros procedimentos
      // pendentes do paciente não impedem o status do horário atual.
      await syncLinkedAppointmentStatus('finished');

      toast.success('Procedimento finalizado com sucesso.');
      setConfirmFinish(false);
      navigate(returnTo);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao finalizar procedimento.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestSignature() {
    if (!session || readOnly) return;
    try {
      const updated = await updateClinicProcedureSession(session.id, {
        signature_status: 'pending',
        signature_requested_at: new Date().toISOString(),
      });
      setSession(updated);
      const url = `${window.location.origin}/patients/${patientId}`;
      await navigator.clipboard.writeText(url);
      toast.success('Link de assinatura solicitado. URL do paciente copiada.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao solicitar assinatura.');
    }
  }

  async function handleSignatureSigned() {
    if (!session) return;
    try {
      const updated = await updateClinicProcedureSession(session.id, {
        signature_status: 'signed',
        signature_signed_at: new Date().toISOString(),
      });
      setSession(updated);
      toast.success('Assinatura registrada.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao registrar assinatura.');
    }
  }

  if (!isClinicAccount) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center text-sm text-muted-foreground">
        Este fluxo está disponível apenas para contas de clínica.
      </div>
    );
  }

  if (loading) return <PageLoading />;

  return (
    <div className="mx-auto max-w-4xl space-y-5 animate-fade-in pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link to={returnTo}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Atendimento clínico
            </p>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              {procedureName || 'Procedimento'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {patientName}
              {planName ? ` · ${planName}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Badge variant="outline">
            {session ? clinicProcedureSessionStatusLabel(session.status) : '—'}
          </Badge>
          <Button type="button" variant="outline" size="sm" asChild className="gap-1.5">
            <Link to={`/patients/${patientId}`}>
              <History className="h-3.5 w-3.5" />
              Histórico
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Procedimento autorizado</CardTitle>
          <CardDescription>
            Data do atendimento:{' '}
            {session?.started_at
              ? format(parseISO(session.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
              : format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Detail label="Procedimento" value={procedureName || '—'} />
          <Detail label="Plano" value={planName || '—'} />
          <Detail label="Dente / região" value={locationLabel || '—'} />
          <Detail
            label="Sessões"
            value={`${finishedCount} realizadas · ${remaining} restantes · ${quantity} previstas`}
          />
          {planNotes ? <Detail label="Observações do plano" value={planNotes} className="sm:col-span-2" /> : null}
        </CardContent>
      </Card>

      <Tabs defaultValue="observacoes" className="w-full">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="observacoes">Observações</TabsTrigger>
          <TabsTrigger value="analise">Análise</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="assinatura">Assinatura</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="observacoes" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Observações do atendimento</CardTitle>
              <CardDescription>
                Evolução clínica, intercorrências, materiais, orientações e conduta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                disabled={readOnly || saving}
                className="min-h-[140px]"
                placeholder="Descreva o atendimento realizado..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analise" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Análise clínica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="clinical-analysis">Análise / evolução</Label>
                <Textarea
                  id="clinical-analysis"
                  value={clinicalAnalysis}
                  onChange={(e) => setClinicalAnalysis(e.target.value)}
                  disabled={readOnly || saving}
                  className="min-h-[120px]"
                  placeholder="Registre a análise clínica..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinical-conclusion">Conclusão</Label>
                <Textarea
                  id="clinical-conclusion"
                  value={clinicalConclusion}
                  onChange={(e) => setClinicalConclusion(e.target.value)}
                  disabled={readOnly || saving}
                  className="min-h-[80px]"
                  placeholder="Conclusão do atendimento..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos" className="mt-4">
          {patientId && planId ? (
            <PatientDocumentsSection
              patientId={patientId}
              dentalPlanId={planId}
              compact
            />
          ) : (
            <p className="text-sm text-muted-foreground">Plano não vinculado.</p>
          )}
        </TabsContent>

        <TabsContent value="assinatura" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Link / termo de assinatura</CardTitle>
              <CardDescription>
                Status atual:{' '}
                {session?.signature_status === 'signed'
                  ? 'Assinado'
                  : session?.signature_status === 'pending'
                    ? 'Pendente'
                    : 'Não solicitado'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={readOnly || saving}
                onClick={() => void handleRequestSignature()}
              >
                Gerar link de assinatura
              </Button>
              <Button
                type="button"
                disabled={readOnly || saving}
                onClick={() => setSignatureOpen(true)}
              >
                Capturar assinatura
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          {history.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum atendimento anterior deste procedimento.
            </p>
          ) : (
            <ul className="space-y-2">
              {history.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm hover:bg-muted/40"
                    onClick={() =>
                      navigate(
                        `/patients/${patientId}/clinic-attendance/${item.id}?returnTo=${encodeURIComponent(returnTo)}`
                      )
                    }
                  >
                    <p className="font-medium">
                      {clinicProcedureSessionStatusLabel(item.status)}
                      {item.finished_at
                        ? ` · ${format(parseISO(item.finished_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`
                        : ` · ${format(parseISO(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`}
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
        </TabsContent>
      </Tabs>

      {!readOnly ? (
        <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            className="gap-2"
            onClick={() => void handleSaveDraft()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar rascunho
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => void handleInProgress()}
          >
            Em andamento
          </Button>
          <Button
            type="button"
            disabled={saving}
            className="gap-2"
            onClick={() => setConfirmFinish(true)}
          >
            <CheckCircle2 className="h-4 w-4" />
            Finalizar procedimento
          </Button>
        </div>
      ) : null}

      <AlertDialog open={confirmFinish} onOpenChange={setConfirmFinish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja finalizar este procedimento?</AlertDialogTitle>
            <AlertDialogDescription>
              O atendimento será registrado no histórico do paciente e o item do plano poderá ser
              marcado como concluído quando a quantidade prevista for atingida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void handleFinish();
              }}
            >
              {saving ? 'Finalizando…' : 'Finalizar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {patientId ? (
        <TermSignatureDialog
          open={signatureOpen}
          onOpenChange={setSignatureOpen}
          patientId={patientId}
          termSlug="consentimento"
          placeholders={{ nomePaciente: patientName }}
          onSuccess={() => void handleSignatureSigned()}
        />
      ) : null}
    </div>
  );
}

function Detail({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}

async function findPlanItemContext(planItemId: string) {
  // Tabelas odontológicas ainda não estão nos types gerados do Supabase.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: item, error } = await db
    .from('dental_plan_items')
    .select('*')
    .eq('id', planItemId)
    .maybeSingle();
  if (error) throw error;
  if (!item) return null;
  const plan = await getDentalPlan(item.treatment_plan_id);
  if (!plan) return null;
  const { locations } = await listDentalPlanItems(plan.id);
  return {
    item: item as {
      id: string;
      treatment_plan_id: string;
      procedure_name: string;
      quantity: number;
      notes: string | null;
    },
    plan,
    locations: locations.filter((loc) => loc.plan_item_id === planItemId),
  };
}
