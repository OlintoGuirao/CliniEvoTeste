import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProcedureItem {
  id: string;
  name: string;
  slug: string;
  category?: string;
  description?: string | null;
}

interface ProcedureCardProps {
  procedure: ProcedureItem;
  selected: boolean;
  onToggle: () => void;
  /** Subtítulo opcional: descrição curta ou categoria */
  subtitle?: string | null;
}

export function ProcedureCard({
  procedure,
  selected,
  onToggle,
  subtitle,
}: ProcedureCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'w-full text-left rounded-lg md:rounded-xl border-2 p-3 md:p-4 min-h-[48px] md:min-h-[56px] flex items-center gap-2 md:gap-3 transition-all duration-150 ease-out',
        'touch-manipulation select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        selected
          ? 'bg-primary/5 border-primary shadow-sm scale-[0.99] active:scale-[0.98]'
          : 'bg-card border-border hover:bg-muted/40 hover:border-muted-foreground/20 active:bg-muted/50'
      )}
      aria-pressed={selected}
      aria-label={`${procedure.name}${selected ? ', selecionado' : ''}`}
    >
      <span className="flex-1 min-w-0">
        <span className="font-medium text-foreground text-sm md:text-base block break-words line-clamp-2">{procedure.name}</span>
        {subtitle && (
          <span className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{subtitle}</span>
        )}
      </span>
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150',
          selected
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-muted-foreground/30 bg-muted/30'
        )}
        aria-hidden
      >
        {selected ? <Check className="h-4 w-4" strokeWidth={2.5} /> : null}
      </span>
    </button>
  );
}
