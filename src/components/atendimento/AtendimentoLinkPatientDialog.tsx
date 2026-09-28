import { useMemo, useState } from 'react';
import { Search, UserRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatPhoneDisplay } from '@/lib/phone';
import { phonesMatch, type AtendimentoLinkedPatient } from '@/lib/atendimentoClinic';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: AtendimentoLinkedPatient[];
  phoneHint?: string | null;
  linking?: boolean;
  onSelect: (patient: AtendimentoLinkedPatient) => void;
};

export function AtendimentoLinkPatientDialog({
  open,
  onOpenChange,
  patients,
  phoneHint,
  linking,
  onSelect,
}: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const phoneMatches = phoneHint
      ? patients.filter((p) => phonesMatch(p.phone, phoneHint))
      : [];
    const rest = patients.filter((p) => {
      if (phoneMatches.some((m) => m.id === p.id)) return false;
      if (!q) return true;
      const hay = `${p.full_name} ${p.phone || ''}`.toLowerCase();
      return hay.includes(q);
    });
    const searched = q
      ? [...phoneMatches, ...rest].filter((p) =>
          `${p.full_name} ${p.phone || ''}`.toLowerCase().includes(q)
        )
      : [...phoneMatches, ...rest.slice(0, 40)];
    return searched.slice(0, 50);
  }, [patients, phoneHint, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular cliente</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            className="pl-8"
            autoFocus
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto space-y-1 -mx-1 px-1">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum paciente encontrado.
            </p>
          ) : (
            filtered.map((p) => {
              const phoneHit = phonesMatch(p.phone, phoneHint);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={linking}
                  onClick={() => onSelect(p)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                    'hover:bg-muted/60',
                    phoneHit && 'border-emerald-500/40 bg-emerald-500/5'
                  )}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatPhoneDisplay(p.phone) || p.phone || 'Sem telefone'}
                      {phoneHit ? ' · mesmo telefone' : ''}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
        <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
