import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Phone, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  JOURNEY_CAPTURE_CHANNEL_LABELS,
  JOURNEY_STAGE_LABELS,
  getPipelineColumnForStage,
  isFollowUpOverdue,
  journeyDisplayName,
  journeyDisplayPhone,
} from '@/lib/branchOperationalJourney';
import { cn } from '@/lib/utils';
import type { BranchPatientJourney } from '@/types/branchOperationalJourney';

type Props = {
  journey: BranchPatientJourney;
  followUpDueAt?: string | null;
  className?: string;
};

export function JourneyPipelineCard({ journey, followUpDueAt, className }: Props) {
  const column = getPipelineColumnForStage(journey.current_stage);
  const overdue = followUpDueAt ? isFollowUpOverdue(followUpDueAt, 'pending') : false;
  const phone = journeyDisplayPhone(journey);

  return (
    <Link to={`/operacional/${journey.id}`} className={cn('block', className)}>
      <Card className="border shadow-sm transition-colors hover:border-primary/40">
        <CardContent className="space-y-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{journeyDisplayName(journey)}</p>
              {phone ? (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3 shrink-0" />
                  {phone}
                </p>
              ) : null}
            </div>
            {overdue ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-label="Follow-up atrasado" />
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary" className="text-[10px]">
              {JOURNEY_STAGE_LABELS[journey.current_stage]}
            </Badge>
            {journey.capture_channel ? (
              <Badge variant="outline" className="text-[10px]">
                {JOURNEY_CAPTURE_CHANNEL_LABELS[journey.capture_channel]}
              </Badge>
            ) : null}
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              {column.label}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(journey.updated_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
