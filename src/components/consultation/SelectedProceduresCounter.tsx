import { cn } from '@/lib/utils';

interface SelectedProceduresCounterProps {
  count: number;
  className?: string;
}

export function SelectedProceduresCounter({ count, className }: SelectedProceduresCounterProps) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary',
        className
      )}
      aria-live="polite"
    >
      {count} selecionado{count !== 1 ? 's' : ''}
    </span>
  );
}
