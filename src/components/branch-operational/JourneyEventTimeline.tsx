import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { JOURNEY_STAGE_LABELS } from '@/lib/branchOperationalJourney';
import type { BranchJourneyEvent } from '@/types/branchOperationalJourney';

type Props = {
  events: BranchJourneyEvent[];
};

export function JourneyEventTimeline({ events }: Props) {
  if (!events.length) {
    return <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>;
  }

  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="relative border-l-2 border-border pl-4">
          <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" />
          <p className="text-sm font-medium">
            {event.event_type === 'stage_transition' && event.to_stage
              ? `Etapa: ${JOURNEY_STAGE_LABELS[event.to_stage]}`
              : event.event_type.replaceAll('_', ' ')}
          </p>
          {event.from_stage && event.to_stage ? (
            <p className="text-xs text-muted-foreground">
              {JOURNEY_STAGE_LABELS[event.from_stage]} → {JOURNEY_STAGE_LABELS[event.to_stage]}
            </p>
          ) : null}
          {event.notes ? <p className="text-sm text-muted-foreground">{event.notes}</p> : null}
          <p className="text-[11px] text-muted-foreground">
            {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </li>
      ))}
    </ol>
  );
}
