import { useMemo, useState, useCallback } from 'react';
import { Scissors } from 'lucide-react';
import { toast } from 'sonner';
import { CTASection } from './CTASection';
import {
  SessionTimeline,
  SessionTimelineCollapseButton,
  type SessionTimelineItem,
} from './SessionTimeline';
import { PatientTabPanelSection } from './PatientDetailTabPanel';
import { sendSalonSessionPhotosWhatsApp } from '@/lib/salonSessionWhatsApp';
import {
  SalonAgendaLancamentoDialog,
  type SalonAgendaLancamentoTarget,
} from '@/components/salon/SalonAgendaLancamentoDialog';
import { salonProcedureNameFromAppointmentNotes } from '@/lib/salonAppointmentNotes';

type PatientSalonProceduresSectionProps = {
  patientId: string;
  patientName: string;
  patientPhone: string | null | undefined;
  professionalId: string;
  patientProfessionalId?: string | null;
  professionalName: string;
  lastSessionDate: string | null;
  totalSessionsCount: number;
  timelineItems: SessionTimelineItem[];
  formatSessionDate: (iso: string) => string;
  deletingTimelineSessionId: string | null;
  onDeleteTimelineSession: (session: SessionTimelineItem) => void;
  onBillingUpdated?: () => void;
};

export function PatientSalonProceduresSection({
  patientId,
  patientName,
  patientPhone,
  professionalId,
  patientProfessionalId,
  professionalName,
  lastSessionDate,
  totalSessionsCount,
  timelineItems,
  formatSessionDate,
  deletingTimelineSessionId,
  onDeleteTimelineSession,
  onBillingUpdated,
}: PatientSalonProceduresSectionProps) {
  const [showFullTimeline, setShowFullTimeline] = useState(false);
  const [sendingPhotosSessionId, setSendingPhotosSessionId] = useState<string | null>(null);
  const [lancamentoTarget, setLancamentoTarget] = useState<SalonAgendaLancamentoTarget | null>(null);
  const [lancamentoOpen, setLancamentoOpen] = useState(false);

  const handleSendPhotosWhatsApp = useCallback(
    async (session: SessionTimelineItem) => {
      if (sendingPhotosSessionId) return;
      setSendingPhotosSessionId(session.id);
      try {
        const result = await sendSalonSessionPhotosWhatsApp({
          session,
          patientId,
          patientName,
          patientPhone,
          professionalId,
          patientProfessionalId,
          professionalName,
        });

        if (result.mode === 'evolution') {
          toast.success('Fotos enviadas pelo WhatsApp conectado.');
          return;
        }
        if (result.mode === 'disabled') {
          toast.message('Mensagem desativada em Mensagens padrão.');
          return;
        }
        if (result.mode === 'share') {
          toast.success('Selecione o WhatsApp e envie as fotos ao cliente.', {
            description: 'As imagens foram anexadas — escolha a conversa do cliente.',
          });
          return;
        }
        if (result.mode === 'manual') {
          toast.message('WhatsApp aberto com as fotos baixadas', {
            description:
              'Anexe as imagens baixadas na conversa do cliente. Para envio automático, conecte o WhatsApp em Configurações.',
          });
          return;
        }
        toast.error(result.error || 'Não foi possível enviar as fotos.');
      } catch {
        toast.error('Não foi possível enviar as fotos.');
      } finally {
        setSendingPhotosSessionId(null);
      }
    },
    [
      patientId,
      patientName,
      patientPhone,
      professionalId,
      patientProfessionalId,
      professionalName,
      sendingPhotosSessionId,
    ]
  );

  const handleEditValor = useCallback(
    (session: SessionTimelineItem) => {
      const names =
        session.procedureNames.length > 0
          ? session.procedureNames
          : [salonProcedureNameFromAppointmentNotes(session.observacoes)].filter(
              (n): n is string => Boolean(n)
            );
      setLancamentoTarget({
        sessionId: session.id,
        patientId,
        patientName,
        professionalId: session.professionalId || patientProfessionalId || professionalId,
        sessionDate: session.session_date,
        appointmentNotes: session.observacoes,
        procedureLabel: names.join(' · ') || null,
        procedureNames: names,
        isAlreadyCompleted: true,
        valorLine: session.valorLine ?? null,
      });
      setLancamentoOpen(true);
    },
    [patientId, patientName, patientProfessionalId, professionalId]
  );

  const uniqueProcedures = useMemo(() => {
    const set = new Set<string>();
    timelineItems.forEach((s) => s.procedureNames.forEach((n) => set.add(n)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [timelineItems]);

  return (
    <>
      <CTASection
        newSessionUrl={`/consultation/${patientId}`}
        lastSessionDate={lastSessionDate}
        activeProceduresCount={0}
        totalSessionsCount={totalSessionsCount}
        className="rounded-lg border border-border/45 bg-muted/10 shadow-none"
        newSessionButtonLabel="Novo atendimento"
        summaryVariant="salon"
      />

      {uniqueProcedures.length > 0 ? (
        <PatientTabPanelSection title="Procedimentos realizados" contentClassName="p-4">
          <ul className="flex flex-wrap gap-2">
            {uniqueProcedures.map((name) => (
              <li
                key={name}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-sm font-medium text-foreground"
              >
                <Scissors className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden />
                {name}
              </li>
            ))}
          </ul>
        </PatientTabPanelSection>
      ) : null}

      <PatientTabPanelSection
        title="Histórico de atendimentos"
        contentClassName="p-4"
        action={
          <SessionTimelineCollapseButton
            sessionCount={timelineItems.length}
            showFullTimeline={showFullTimeline}
            onToggle={() => setShowFullTimeline((prev) => !prev)}
          />
        }
      >
        <SessionTimeline
          sessions={timelineItems}
          formatDate={formatSessionDate}
          collapseToLatest
          showFullTimeline={showFullTimeline}
          emptyMessage='Nenhum atendimento registrado. Use "Novo atendimento" para registrar o primeiro.'
          onDeleteSession={onDeleteTimelineSession}
          deletingSessionId={deletingTimelineSessionId}
          onSendPhotosWhatsApp={handleSendPhotosWhatsApp}
          sendingPhotosSessionId={sendingPhotosSessionId}
          onEditValor={handleEditValor}
          variant="salon"
        />
      </PatientTabPanelSection>

      <SalonAgendaLancamentoDialog
        target={lancamentoTarget}
        open={lancamentoOpen}
        onOpenChange={(open) => {
          setLancamentoOpen(open);
          if (!open) setLancamentoTarget(null);
        }}
        professionalId={professionalId}
        onSaved={onBillingUpdated}
      />
    </>
  );
}
