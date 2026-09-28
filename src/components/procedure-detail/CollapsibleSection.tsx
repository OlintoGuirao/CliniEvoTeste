import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  /** Conteúdo opcional sempre visível (ex.: 1–2 campos essenciais) */
  preview?: React.ReactNode;
}

export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  children,
  className,
  preview,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn('rounded-lg border border-border/80 bg-card overflow-hidden transition-shadow duration-150', className)}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 p-4 border-b border-border/60 bg-muted/20">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2 shrink-0 self-start sm:self-center"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {open ? 'Ocultar detalhes' : 'Ver detalhes'}
        </Button>
      </div>
      {preview && !open && <div className="p-4 pt-3">{preview}</div>}
      {open && <div className="p-4 pt-3 border-t border-border/40">{children}</div>}
    </section>
  );
}
