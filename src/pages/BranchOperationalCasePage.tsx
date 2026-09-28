import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  FileText,
  Loader2,
  MessageCircle,
  Receipt,
  Stethoscope,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { BranchOperationalGuard } from '@/components/branch-operational/BranchOperationalGuard';
import { JourneyEventTimeline } from '@/components/branch-operational/JourneyEventTimeline';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  useBranchJourneyEvents,
  useBranchJourneyFollowUps,
  useBranchOperationalCase,
  useBranchOperationalMutations,
} from '@/hooks/use-branch-operational';
import {
  ALLOWED_STAGE_TRANSITIONS,
  JOURNEY_CAPTURE_CHANNEL_LABELS,
  JOURNEY_STAGE_LABELS,
  NO_CLOSE_REASONS,
  canTransitionStage,
  journeyDisplayName,
  journeyDisplayPhone,
} from '@/lib/branchOperationalJourney';
import { openWhatsAppWithFallback } from '@/lib/reportShare';
import type { JourneyStage } from '@/types/branchOperationalJourney';

function FollowUpDialog({
  open,
  onOpenChange,
  journeyId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  journeyId: string;
}) {
  const { createFollowUp } = useBranchOperationalMutations();
  const [dueAt, setDueAt] = useState('');
  const [reason, setReason] = useState('');

  const submit = async () => {
    if (!dueAt || !reason.trim()) {
      toast.error('Informe data e motivo do follow-up.');
      return;
    }
    try {
      await createFollowUp.mutateAsync({
        journeyId,
        dueAt: new Date(dueAt).toISOString(),
        reason: reason.trim(),
      });
      toast.success('Follow-up criado.');
      onOpenChange(false);
      setDueAt('');
      setReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar follow-up.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo follow-up</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="fu-due">Data prevista</Label>
            <Input id="fu-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fu-reason">Motivo</Label>
            <Textarea id="fu-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => void submit()} disabled={createFollowUp.isPending}>
            {createFollowUp.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BranchOperationalCaseContent() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const caseQuery = useBranchOperationalCase(caseId);
  const eventsQuery = useBranchJourneyEvents(caseId);
  const followUpsQuery = useBranchJourneyFollowUps(caseId);
  const { transition, patchJourney, completeFollowUp } = useBranchOperationalMutations();
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [noCloseReason, setNoCloseReason] = useState('');
  const [transitionNotes, setTransitionNotes] = useState('');

  const journey = caseQuery.data;
  const nextStages = useMemo(() => {
    if (!journey) return [] as JourneyStage[];
    return ALLOWED_STAGE_TRANSITIONS[journey.current_stage] ?? [];
  }, [journey]);

  const runTransition = async (toStage: JourneyStage, extra?: Record<string, unknown>) => {
    if (!journey || !canTransitionStage(journey.current_stage, toStage)) {
      toast.error('Transição não permitida para esta etapa.');
      return;
    }
    try {
      await transition.mutateAsync({
        journeyId: journey.id,
        toStage,
        notes: transitionNotes || undefined,
        payload: extra,
      });
      setTransitionNotes('');
      toast.success(`Etapa atualizada: ${JOURNEY_STAGE_LABELS[toStage]}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar etapa.');
    }
  };

  const handleNoClose = async () => {
    if (!journey) return;
    await patchJourney.mutateAsync({
      journeyId: journey.id,
      patch: { no_close_reason: noCloseReason || 'Outros' },
    });
    await runTransition('nao_fechado');
    setFollowUpOpen(true);
  };

  const handleWhatsAppContact = () => {
    const phone = journey ? journeyDisplayPhone(journey) : null;
    if (!phone) {
      toast.error('Telefone não informado.');
      return;
    }
    openWhatsAppWithFallback({ phone, text: 'Olá! Entrando em contato sobre seu atendimento.' });
  };

  if (caseQuery.isLoading) return <PageSkeleton />;
  if (caseQuery.isError || !journey) {
    return <p className="p-6 text-sm text-destructive">Jornada não encontrada ou sem permissão.</p>;
  }

  const patientId = journey.patient_id;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageBreadcrumb
        segments={[
          { label: 'Operacional', path: '/operacional' },
          { label: journeyDisplayName(journey) },
        ]}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{journeyDisplayName(journey)}</h1>
          <p className="text-sm text-muted-foreground">
            {journeyDisplayPhone(journey) || 'Sem telefone'} · Atualizado{' '}
            {format(new Date(journey.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge>{JOURNEY_STAGE_LABELS[journey.current_stage]}</Badge>
            {journey.capture_channel ? (
              <Badge variant="outline">{JOURNEY_CAPTURE_CHANNEL_LABELS[journey.capture_channel]}</Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleWhatsAppContact}>
            <MessageCircle className="mr-2 h-4 w-4" />
            WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFollowUpOpen(true)}>
            Follow-up
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Ações da etapa atual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Observação da ação (opcional)"
              value={transitionNotes}
              onChange={(e) => setTransitionNotes(e.target.value)}
              rows={2}
            />

            <div className="flex flex-wrap gap-2">
              {!patientId ? (
                <Button size="sm" onClick={() => navigate(`/patients/new?journeyId=${journey.id}`)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Completar cadastro
                </Button>
              ) : (
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/patients/${patientId}`}>
                    <FileText className="mr-2 h-4 w-4" />
                    Prontuário
                  </Link>
                </Button>
              )}

              {['cadastro_inicial', 'agendamento_pendente', 'nao_agendou', 'nao_compareceu'].includes(
                journey.current_stage
              ) ? (
                <Button size="sm" variant="outline" asChild>
                  <Link to={patientId ? `/agenda?patientId=${patientId}` : '/agenda'}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Agendar
                  </Link>
                </Button>
              ) : null}

              {journey.current_stage === 'agendado' ? (
                <Button size="sm" variant="secondary" onClick={() => void runTransition('aguardando_confirmacao')}>
                  Aguardando confirmação
                </Button>
              ) : null}

              {['agendado', 'aguardando_confirmacao'].includes(journey.current_stage) ? (
                <>
                  <Button size="sm" onClick={() => void runTransition('compareceu')}>
                    Compareceu
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void runTransition('nao_compareceu')}>
                    Não compareceu
                  </Button>
                </>
              ) : null}

              {journey.current_stage === 'compareceu' ? (
                <Button size="sm" onClick={() => void runTransition('documentacao_pendente')}>
                  Documentação
                </Button>
              ) : null}

              {['documentacao_pendente', 'compareceu'].includes(journey.current_stage) && patientId ? (
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/patients/${patientId}/exams`}>
                    Anexar documentos
                  </Link>
                </Button>
              ) : null}

              {['documentacao_pendente', 'avaliacao_medica'].includes(journey.current_stage) ? (
                <Button size="sm" onClick={() => void runTransition('avaliacao_medica')}>
                  <Stethoscope className="mr-2 h-4 w-4" />
                  Avaliação médica
                </Button>
              ) : null}

              {patientId &&
              ['avaliacao_medica', 'orcamento_negociacao', 'orcamento_enviado', 'nao_fechado'].includes(
                journey.current_stage
              ) ? (
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/orcamento/novo?patientId=${patientId}&journeyId=${journey.id}`}>
                    <Receipt className="mr-2 h-4 w-4" />
                    Orçamento
                  </Link>
                </Button>
              ) : null}

              {journey.budget_quote_id ? (
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/orcamento/enviar/${journey.budget_quote_id}`}>
                    Enviar orçamento WhatsApp
                  </Link>
                </Button>
              ) : null}

              {['orcamento_enviado', 'orcamento_negociacao'].includes(journey.current_stage) ? (
                <>
                  <Button size="sm" onClick={() => void runTransition('fechado')}>
                    Fechou
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void handleNoClose()}>
                    Não fechou
                  </Button>
                </>
              ) : null}

              {journey.current_stage === 'fechado' ? (
                <Button size="sm" onClick={() => void runTransition('contrato_pendente')}>
                  Contrato / assinatura
                </Button>
              ) : null}

              {['fechado', 'contrato_pendente'].includes(journey.current_stage) ? (
                <Button size="sm" onClick={() => void runTransition('pos_venda')}>
                  Pós-venda
                </Button>
              ) : null}

              {journey.current_stage === 'pos_venda' ? (
                <Button size="sm" onClick={() => void runTransition('tratamento_iniciado')}>
                  Tratamento iniciado
                </Button>
              ) : null}

              {['tratamento_iniciado', 'pos_venda'].includes(journey.current_stage) ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await patchJourney.mutateAsync({
                        journeyId: journey.id,
                        patch: { satisfaction: 'positive' },
                      });
                      await runTransition('encerrado_positivo');
                    }}
                  >
                    Satisfeito — encerrar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      await patchJourney.mutateAsync({
                        journeyId: journey.id,
                        patch: { satisfaction: 'negative' },
                      });
                      await runTransition('retencao_recuperacao');
                      setFollowUpOpen(true);
                    }}
                  >
                    Insatisfeito — recuperação
                  </Button>
                </>
              ) : null}

              {nextStages
                .filter(
                  (s) =>
                    ![
                      'compareceu',
                      'nao_compareceu',
                      'fechado',
                      'nao_fechado',
                      'encerrado_positivo',
                      'retencao_recuperacao',
                    ].includes(s)
                )
                .slice(0, 2)
                .map((stage) => (
                  <Button key={stage} size="sm" variant="ghost" onClick={() => void runTransition(stage)}>
                    → {JOURNEY_STAGE_LABELS[stage]}
                  </Button>
                ))}
            </div>

            {journey.current_stage === 'nao_fechado' ? (
              <div className="space-y-2 rounded-lg border p-3">
                <Label>Motivo da não conversão</Label>
                <Select value={noCloseReason} onValueChange={setNoCloseReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {NO_CLOSE_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Follow-ups</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(followUpsQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum follow-up pendente.</p>
              ) : (
                followUpsQuery.data?.map((fu) => (
                  <div key={fu.id} className="rounded-md border p-2 text-sm">
                    <p className="font-medium">{fu.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(fu.due_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                    {fu.status === 'pending' ? (
                      <Button
                        size="sm"
                        variant="link"
                        className="h-auto p-0"
                        onClick={() => void completeFollowUp.mutateAsync(fu.id)}
                      >
                        Concluir
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico</CardTitle>
            </CardHeader>
            <CardContent>
              <JourneyEventTimeline events={eventsQuery.data ?? []} />
            </CardContent>
          </Card>
        </div>
      </div>

      <FollowUpDialog open={followUpOpen} onOpenChange={setFollowUpOpen} journeyId={journey.id} />
    </div>
  );
}

export default function BranchOperationalCasePage() {
  return (
    <BranchOperationalGuard>
      <BranchOperationalCaseContent />
    </BranchOperationalGuard>
  );
}
