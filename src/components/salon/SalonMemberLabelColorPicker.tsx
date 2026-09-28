import { Label } from '@/components/ui/label';
import {
  DEFAULT_SALON_LABEL_COLOR,
  SALON_LABEL_COLOR_PRESETS,
  normalizeAgendaLabelColor,
} from '@/lib/salonTeamRoles';
import { cn } from '@/lib/utils';

type Props = {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
  description?: string;
};

export function SalonMemberLabelColorPicker({
  value,
  onChange,
  disabled,
  id,
  label = 'Etiqueta (cor na agenda)',
  description = 'Essa cor identifica o profissional nos horários da agenda.',
}: Props) {
  const hex = normalizeAgendaLabelColor(value) ?? DEFAULT_SALON_LABEL_COLOR;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {description ? (
        <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
      ) : null}
      <div className="flex flex-wrap gap-2" role="listbox" aria-label="Cor da etiqueta">
        {SALON_LABEL_COLOR_PRESETS.map((preset) => {
          const selected = hex === preset.hex;
          return (
            <button
              key={preset.id}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={disabled}
              title={preset.name}
              onClick={() => onChange(preset.hex)}
              className={cn(
                'h-9 w-9 rounded-full border-2 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                selected ? 'border-foreground shadow-md scale-105' : 'border-transparent hover:scale-105'
              )}
              style={{ backgroundColor: preset.hex }}
            >
              <span className="sr-only">{preset.name}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <span
          className="inline-flex h-6 w-6 shrink-0 rounded-md border shadow-sm"
          style={{ backgroundColor: hex }}
          aria-hidden
        />
        <span className="text-xs text-muted-foreground tabular-nums">{hex}</span>
      </div>
    </div>
  );
}
