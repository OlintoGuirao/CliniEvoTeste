import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CTASection } from './CTASection';
import { SessionTimeline, SessionTimelineCollapseButton, type SessionTimelineItem } from './SessionTimeline';
import { ActiveProcedureCard } from './ActiveProcedureCard';
import { PatientTabPanelSection } from './PatientDetailTabPanel';
interface ProcedureInstance {
  id: string;
  procedure_id: string;
  data_inicio: string;
  status: string;
  procedures: { name: string; slug: string } | null;
}

type PatientProceduresSectionProps = {
  patientId: string;
  lastSessionDate: string | null;
  activeProceduresCount: number;
  totalSessionsCount: number;
  procedureInstances: ProcedureInstance[];
  timelineItems: SessionTimelineItem[];
  sessionCountByInstanceId: Record<string, number>;
  lastSessionDateByInstanceId: Record<string, string>;
  formatSessionDate: (iso: string) => string;
  formatShortDate: (iso: string) => string;
  deletingTimelineSessionId: string | null;
  onProcedureEnded: () => void;
  onDeleteTimelineSession: (session: SessionTimelineItem) => void;
  onSessionClick: (session: SessionTimelineItem) => void;
};

export function PatientProceduresSection({
  patientId,
  lastSessionDate,
  activeProceduresCount,
  totalSessionsCount,
  procedureInstances,
  timelineItems,
  sessionCountByInstanceId,
  lastSessionDateByInstanceId,
  formatSessionDate,
  formatShortDate,
  deletingTimelineSessionId,
  onProcedureEnded,
  onDeleteTimelineSession,
  onSessionClick,
}: PatientProceduresSectionProps) {
  const ativos = procedureInstances.filter((i) => i.status === 'em_andamento');
  const finalizados = procedureInstances.filter((i) => i.status === 'finalizado');
  const [showFullTimeline, setShowFullTimeline] = useState(false);

  return (
    <>
      <CTASection
        newSessionUrl={`/consultation/${patientId}`}
        lastSessionDate={lastSessionDate}
        activeProceduresCount={activeProceduresCount}
        totalSessionsCount={totalSessionsCount}
        className="rounded-lg border border-border/45 bg-muted/10 shadow-none"
      />

      <PatientTabPanelSection
        title="Timeline de sessões"
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
          emptyMessage='Nenhuma sessão registrada. Use "Nova sessão" para registrar o primeiro atendimento.'
          onDeleteSession={onDeleteTimelineSession}
          deletingSessionId={deletingTimelineSessionId}
          onSessionClick={onSessionClick}
        />
      </PatientTabPanelSection>

      <PatientTabPanelSection title="Procedimentos ativos" contentClassName="p-4">
        {ativos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 rounded-lg border border-dashed border-border/60 bg-background/40 text-center">
            <Stethoscope className="w-10 h-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum procedimento em andamento</p>
            <Button asChild variant="link" className="mt-2">
              <Link to={`/consultation/${patientId}`}>Nova sessão</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {ativos.map((inst) => (
              <li key={inst.id}>
                <ActiveProcedureCard
                  id={inst.id}
                  procedureName={inst.procedures?.name ?? 'Procedimento'}
                  procedureSlug={inst.procedures?.slug ?? null}
                  status={inst.status}
                  dataInicio={inst.data_inicio}
                  lastSessionDate={
                    lastSessionDateByInstanceId[inst.id]
                      ? formatShortDate(lastSessionDateByInstanceId[inst.id])
                      : null
                  }
                  sessionCount={sessionCountByInstanceId[inst.id] ?? 0}
                  formatDate={formatShortDate}
                  consultationUrl={`/consultation/${patientId}`}
                  onStatusChanged={onProcedureEnded}
                />
              </li>
            ))}
          </ul>
        )}
      </PatientTabPanelSection>

      {finalizados.length > 0 ? (
        <PatientTabPanelSection title="Procedimentos finalizados" contentClassName="p-4">
          <ul className="space-y-3">
            {finalizados.map((inst) => (
              <li key={inst.id}>
                <ActiveProcedureCard
                  id={inst.id}
                  procedureName={inst.procedures?.name ?? 'Procedimento'}
                  procedureSlug={inst.procedures?.slug ?? null}
                  status={inst.status}
                  dataInicio={inst.data_inicio}
                  lastSessionDate={
                    lastSessionDateByInstanceId[inst.id]
                      ? formatShortDate(lastSessionDateByInstanceId[inst.id])
                      : null
                  }
                  sessionCount={sessionCountByInstanceId[inst.id] ?? 0}
                  formatDate={formatShortDate}
                  consultationUrl={`/consultation/${patientId}`}
                  hideNewSessionButton
                  onStatusChanged={onProcedureEnded}
                />
              </li>
            ))}
          </ul>
        </PatientTabPanelSection>
      ) : null}
    </>
  );
}
