import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PatientProceduresSummaryChips } from './PatientProceduresSummaryChips';

interface CTASectionProps {
  newSessionUrl: string;
  lastSessionDate: string | null;
  activeProceduresCount: number;
  totalSessionsCount: number;
  className?: string;
  newSessionButtonLabel?: string;
  summaryVariant?: 'clinical' | 'salon';
}

export function CTASection({
  newSessionUrl,
  lastSessionDate,
  activeProceduresCount,
  totalSessionsCount,
  className,
  newSessionButtonLabel = 'Novo procedimento',
  summaryVariant = 'clinical',
}: CTASectionProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden',
        className
      )}
    >
      <div className="px-4 py-3 sm:px-4 sm:py-2 border-b border-border/40 bg-muted/30">
        <h3 className="text-sm font-medium text-muted-foreground">Informações Gerais</h3>
      </div>
      <div className="p-4 flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <PatientProceduresSummaryChips
          lastSessionDate={lastSessionDate}
          activeProceduresCount={activeProceduresCount}
          totalSessionsCount={totalSessionsCount}
          variant={summaryVariant}
        />
        <Button
          className="gap-2 rounded-xl font-medium min-h-[44px] touch-manipulation w-full lg:w-auto shrink-0 lg:ml-auto lg:self-center"
          asChild
        >
          <Link to={newSessionUrl}>
            <Plus className="h-5 w-5 shrink-0" />
            {newSessionButtonLabel}
          </Link>
        </Button>
      </div>
    </section>
  );
}
