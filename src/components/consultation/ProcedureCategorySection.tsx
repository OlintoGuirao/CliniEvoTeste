import { useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { ProcedureCard, type ProcedureItem } from './ProcedureCard';
import { cn } from '@/lib/utils';

interface ProcedureCategorySectionProps {
  title: string;
  procedures: ProcedureItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  defaultOpen?: boolean;
}

export function ProcedureCategorySection({
  title,
  procedures,
  selectedIds,
  onToggle,
  defaultOpen = true,
}: ProcedureCategorySectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const selectedCount = procedures.filter((p) => selectedIds.has(p.id)).length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border bg-card overflow-hidden">
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center justify-between gap-2 p-3 sm:p-4 text-left',
          'hover:bg-muted/30 transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'
        )}
        aria-expanded={undefined}
      >
        <span className="font-semibold text-sm text-foreground">{title}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {selectedCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary font-medium">
              {selectedCount} selecionado{selectedCount !== 1 ? 's' : ''}
            </span>
          )}
          <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-180')} />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3 sm:px-4 sm:pb-4 pt-0 space-y-2 border-t border-border">
          {procedures.map((proc) => (
            <ProcedureCard
              key={proc.id}
              procedure={proc}
              selected={selectedIds.has(proc.id)}
              onToggle={() => onToggle(proc.id)}
              subtitle={proc.description ?? undefined}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
