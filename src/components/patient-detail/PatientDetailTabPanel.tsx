import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PatientDetailTabPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'bg-card px-3 pb-4 pt-3 md:px-5 md:pb-5 md:pt-4',
        'border-t border-transparent',
        className
      )}
    >
      <div className="space-y-4 md:space-y-5 animate-fade-in">{children}</div>
    </div>
  );
}

type PatientTabPanelSectionProps = {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

/** Bloco interno do painel da aba — visualmente subordinado à guia ativa. */
export function PatientTabPanelSection({
  title,
  action,
  children,
  className,
  contentClassName,
}: PatientTabPanelSectionProps) {
  return (
    <section
      className={cn(
        'rounded-lg border border-border/45 bg-muted/10 overflow-hidden shadow-none',
        className
      )}
    >
      {title ? (
        <div className="flex items-center justify-between gap-1.5 sm:gap-2 px-3 py-2.5 sm:px-4 border-b border-border/35 bg-muted/25">
          <h3 className="min-w-0 truncate text-sm font-medium text-muted-foreground">{title}</h3>
          {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn('p-4', contentClassName)}>{children}</div>
    </section>
  );
}
