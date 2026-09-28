import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useClinicBranchScope } from '@/contexts/ClinicBranchContext';
import { Building2 } from 'lucide-react';

type BranchFilterSelectProps = {
  className?: string;
  showAllOption?: boolean;
};

export function BranchFilterSelect({ className, showAllOption = true }: BranchFilterSelectProps) {
  const { mode, branches, selectedBranchId, setSelectedBranchId, isLoading } = useClinicBranchScope();

  if (mode !== 'master' || branches.length === 0) return null;

  return (
    <div className={className}>
      <Select
        value={selectedBranchId ?? 'all'}
        onValueChange={(v) => setSelectedBranchId(v === 'all' ? null : v)}
        disabled={isLoading}
      >
        <SelectTrigger className="w-full sm:w-[220px] gap-2">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="Filial" />
        </SelectTrigger>
        <SelectContent>
          {showAllOption && <SelectItem value="all">Todas as filiais</SelectItem>}
          {branches.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-border"
                  style={{ backgroundColor: b.accent_color?.trim() || '#2563eb' }}
                  aria-hidden
                />
                {b.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
