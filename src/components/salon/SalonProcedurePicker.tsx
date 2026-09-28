import { ProcedureCard } from '@/components/consultation/ProcedureCard';
import { ProcedureSearchInput } from '@/components/consultation/ProcedureSearchInput';
import type { SalonProcedure } from '@/services/api/salonProceduresApi';

type Props = {
  procedures: SalonProcedure[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
};

export function SalonProcedurePicker({
  procedures,
  selectedIds,
  onToggle,
  searchQuery,
  onSearchChange,
}: Props) {
  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? procedures.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description?.toLowerCase().includes(q) ?? false)
      )
    : procedures;

  if (procedures.length === 0) {
    return (
      <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
        Nenhum procedimento cadastrado. Cadastre em Configurações → Cadastrar procedimentos.
      </p>
    );
  }

  return (
    <>
      <ProcedureSearchInput
        value={searchQuery}
        onChange={onSearchChange}
        placeholder="🔍 Buscar procedimento do salão…"
      />
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum procedimento encontrado para &quot;{searchQuery.trim()}&quot;.
          </p>
        ) : (
          filtered.map((proc) => (
            <ProcedureCard
              key={proc.id}
              procedure={{
                id: proc.id,
                name: proc.name,
                slug: proc.id,
                description: proc.description,
              }}
              selected={selectedIds.has(proc.id)}
              onToggle={() => onToggle(proc.id)}
              subtitle={proc.description?.trim() || null}
            />
          ))
        )}
      </div>
    </>
  );
}
