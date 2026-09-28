import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { loadBrazilianCities, searchBrazilianCities } from '@/lib/brazilianCities';

type BrazilianCityFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function BrazilianCityField({
  id,
  value,
  onChange,
  placeholder = 'Cidade',
  className,
}: BrazilianCityFieldProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  useEffect(() => {
    void loadBrazilianCities().then(setCities);
  }, []);

  const suggestions = useMemo(() => searchBrazilianCities(cities, value), [cities, value]);

  const selectCity = (city: string) => {
    onChange(city);
    setOpen(false);
  };

  return (
    <div className={cn('relative', className)}>
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlighted(0);
        }}
        onFocus={() => {
          if (value.trim().length >= 2) setOpen(true);
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
            selectCity(suggestions[highlighted]);
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
      />

      {open && suggestions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {suggestions.map((city, index) => (
            <li
              key={city}
              role="option"
              aria-selected={index === highlighted}
              className={cn(
                'cursor-pointer rounded-sm px-2 py-1.5 text-sm',
                index === highlighted && 'bg-accent text-accent-foreground'
              )}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlighted(index)}
              onClick={() => selectCity(city)}
            >
              {city}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
