import { useId, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { normalizeSearchText } from '@/lib/brazilianCities';
import { filterSalonProceduresByQuery } from '@/lib/salonProcedureSearch';

type SalonProcedureOption = {
  id: string;
  name: string;
};

type SalonProcedureComboboxProps = {
  id?: string;
  procedures: readonly SalonProcedureOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
};

function resolveProcedureId(
  procedures: readonly SalonProcedureOption[],
  query: string
): string {
  const q = normalizeSearchText(query.trim());
  if (!q) return '';
  const exact = procedures.find((p) => normalizeSearchText(p.name) === q);
  if (exact) return exact.id;
  const prefix = procedures.filter((p) => normalizeSearchText(p.name).startsWith(q));
  return prefix.length === 1 ? prefix[0]!.id : '';
}

export function SalonProcedureCombobox({
  id,
  procedures,
  value,
  onChange,
  disabled,
  loading,
  placeholder = 'Digite para filtrar, ex.: Cor',
}: SalonProcedureComboboxProps) {
  const listId = useId();
  const selected = procedures.find((p) => p.id === value);
  const [query, setQuery] = useState(selected?.name ?? '');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const suggestions = useMemo(
    () => filterSalonProceduresByQuery(procedures, query),
    [procedures, query]
  );

  const selectProcedure = (proc: SalonProcedureOption) => {
    onChange(proc.id);
    setQuery(proc.name);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Input
        id={id}
        value={query}
        disabled={disabled || loading}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          setHighlighted(0);
          onChange(resolveProcedureId(procedures, next));
        }}
        onFocus={() => {
          if (disabled || loading) return;
          setOpen(true);
          setHighlighted(0);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlighted((current) => Math.min(current + 1, suggestions.length - 1));
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlighted((current) => Math.max(current - 1, 0));
          }
          if (e.key === 'Enter' && suggestions[highlighted]) {
            e.preventDefault();
            selectProcedure(suggestions[highlighted]);
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={loading ? 'Carregando...' : placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
      />

      {open && !loading && suggestions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-[1400] mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {suggestions.map((proc, index) => (
            <li
              key={proc.id}
              role="option"
              aria-selected={value === proc.id || index === highlighted}
              className={cn(
                'cursor-pointer rounded-sm px-2 py-1.5 text-sm',
                index === highlighted && 'bg-accent text-accent-foreground'
              )}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlighted(index)}
              onClick={() => selectProcedure(proc)}
            >
              {proc.name}
            </li>
          ))}
        </ul>
      ) : null}

      {open && !loading && query.trim() && suggestions.length === 0 ? (
        <p className="absolute z-[1400] mt-1 w-full rounded-md border border-border bg-popover px-2 py-1.5 text-sm text-muted-foreground shadow-md">
          Nenhum procedimento encontrado para &quot;{query.trim()}&quot;.
        </p>
      ) : null}
    </div>
  );
}
