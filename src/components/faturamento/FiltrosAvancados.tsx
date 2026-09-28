import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FaturamentoFiltros, FormaPagamento, RecebimentoStatus } from '@/types/faturamento';
import { FORMA_PAGAMENTO_LABEL, STATUS_LABEL } from '@/types/faturamento';
import { cn } from '@/lib/utils';

interface ProcedureOption {
  id: string;
  name: string;
}

interface ProfessionalOption {
  id: string;
  name: string;
}

interface FiltrosAvancadosProps {
  filtros: FaturamentoFiltros;
  onChange: (f: FaturamentoFiltros) => void;
  procedures: ProcedureOption[];
  professionals?: ProfessionalOption[];
  isSalon?: boolean;
  className?: string;
}

export function FiltrosAvancados({
  filtros,
  onChange,
  procedures,
  professionals = [],
  isSalon = false,
  className,
}: FiltrosAvancadosProps) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Procedimento</Label>
        <Select
          value={filtros.procedimentoId ?? 'todos'}
          onValueChange={(v) =>
            onChange({ ...filtros, procedimentoId: v === 'todos' ? null : v })
          }
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {procedures.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Forma de pagamento</Label>
        <Select
          value={filtros.formaPagamento ?? 'todos'}
          onValueChange={(v) =>
            onChange({
              ...filtros,
              formaPagamento: v === 'todos' ? null : (v as FormaPagamento),
            })
          }
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {(Object.keys(FORMA_PAGAMENTO_LABEL) as FormaPagamento[]).map((fp) => (
              <SelectItem key={fp} value={fp}>
                {FORMA_PAGAMENTO_LABEL[fp]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isSalon ? (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Profissional</Label>
          <Select
            value={filtros.profissionalId ?? 'todos'}
            onValueChange={(v) =>
              onChange({
                ...filtros,
                profissionalId: v === 'todos' ? null : v,
              })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {professionals.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={filtros.status ?? 'todos'}
            onValueChange={(v) =>
              onChange({
                ...filtros,
                status: v === 'todos' ? null : (v as RecebimentoStatus),
              })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {(Object.keys(STATUS_LABEL) as RecebimentoStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
