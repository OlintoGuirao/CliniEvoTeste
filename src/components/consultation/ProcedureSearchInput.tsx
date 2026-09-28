import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProcedureSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function ProcedureSearchInput({
  value,
  onChange,
  placeholder = 'Buscar procedimento…',
  className,
}: ProcedureSearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        type="search"
        role="searchbox"
        aria-label="Buscar procedimento"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 h-10 rounded-xl bg-muted/30 border-border focus-visible:ring-2"
      />
    </div>
  );
}
