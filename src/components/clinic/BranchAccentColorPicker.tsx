import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ACCENT_PRESETS } from '@/lib/theme-colors';
import { cn } from '@/lib/utils';
import { Moon, Palette, Sun } from 'lucide-react';

const BRANCH_COLOR_PRESETS = ACCENT_PRESETS.filter((p) => p.id !== 'default');

function normalizeHex(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`;
  return (BRANCH_COLOR_PRESETS[0]?.hex ?? '#2563eb').toLowerCase();
}

function BranchColorPreview({
  hex,
  name,
  mode,
}: {
  hex: string;
  name: string;
  mode: 'light' | 'dark';
}) {
  const isLight = mode === 'light';
  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-2',
        isLight ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-zinc-800'
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-8 w-8 shrink-0 rounded-lg border object-contain"
          style={{ backgroundColor: hex }}
        />
        <div className="min-w-0">
          <p className={cn('text-sm font-medium truncate', isLight ? 'text-zinc-900' : 'text-zinc-100')}>
            {name || 'Unidade'}
          </p>
          <p className={cn('text-xs truncate', isLight ? 'text-zinc-500' : 'text-zinc-400')}>
            Filtros e relatórios
          </p>
        </div>
      </div>
      <div className="flex gap-1.5">
        <span
          className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium text-white"
          style={{ backgroundColor: hex }}
        >
          Ativa
        </span>
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px]',
            isLight ? 'border-zinc-200 text-zinc-600' : 'border-zinc-700 text-zinc-300'
          )}
        >
          Filial
        </span>
      </div>
    </div>
  );
}

type BranchAccentColorPickerProps = {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  branchName?: string;
  embedded?: boolean;
};

export function BranchAccentColorPicker({
  value,
  onChange,
  disabled,
  branchName = 'Unidade',
  embedded = false,
}: BranchAccentColorPickerProps) {
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');
  const hex = normalizeHex(value || BRANCH_COLOR_PRESETS[0]?.hex || '#2563eb');

  const matchedPreset = useMemo(
    () => ACCENT_PRESETS.find((p) => p.hex.toLowerCase() === hex.toLowerCase()),
    [hex]
  );

  const radioValue = BRANCH_COLOR_PRESETS.find((p) => p.hex.toLowerCase() === hex.toLowerCase())?.id ?? '';
  const isCustom = !matchedPreset || matchedPreset.id === 'default';

  const popoverContent = (
    <>
      <p className="font-medium mb-1">Cor da filial</p>
      <p className="text-xs text-muted-foreground mb-3">
        Usada nos filtros, relatórios e identidade visual desta unidade.
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {ACCENT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(preset.hex)}
            className={cn(
              'h-8 w-8 rounded-full border-2 hover:scale-110 transition-transform shrink-0',
              hex.toLowerCase() === preset.hex.toLowerCase()
                ? 'border-foreground ring-2 ring-offset-2 ring-foreground/30'
                : 'border-border'
            )}
            style={{ backgroundColor: preset.hex }}
            title={preset.name}
            aria-label={preset.name}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-muted-foreground">Personalizada:</span>
        <input
          type="color"
          value={hex}
          disabled={disabled}
          onChange={(e) => onChange(normalizeHex(e.target.value))}
          className="h-9 w-14 cursor-pointer rounded border border-input bg-transparent disabled:opacity-50"
        />
      </div>
      <Separator className="my-3" />
      <p className="text-xs text-muted-foreground mb-2">Ver cor da filial selecionada:</p>
      <div className="flex gap-2 mb-3">
        <Button
          type="button"
          variant={previewMode === 'light' ? 'default' : 'outline'}
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => setPreviewMode('light')}
          disabled={disabled}
        >
          <Sun className="w-4 h-4" />
          Claro
        </Button>
        <Button
          type="button"
          variant={previewMode === 'dark' ? 'default' : 'outline'}
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => setPreviewMode('dark')}
          disabled={disabled}
        >
          <Moon className="w-4 h-4" />
          Escuro
        </Button>
      </div>
      <BranchColorPreview
        hex={hex}
        name={branchName}
        mode={previewMode}
      />
      <Separator className="my-3" />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full"
        onClick={() => setColorPopoverOpen(false)}
      >
        Fechar
      </Button>
    </>
  );

  const pickerBody = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
      <RadioGroup
        value={radioValue}
        onValueChange={(next) => {
          const preset = BRANCH_COLOR_PRESETS.find((p) => p.id === next);
          if (preset) onChange(preset.hex);
        }}
        className="contents"
        disabled={disabled}
      >
        {BRANCH_COLOR_PRESETS.map((preset) => (
          <Label
            key={preset.id}
            htmlFor={`branch-color-${preset.id}`}
            className="flex items-center gap-2 md:gap-3 rounded-lg border p-3 md:p-4 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors"
          >
            <RadioGroupItem
              value={preset.id}
              id={`branch-color-${preset.id}`}
              className="sr-only peer"
            />
            <span
              className="h-5 w-5 shrink-0 rounded-full border border-border shadow-sm"
              style={{ backgroundColor: preset.hex }}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="font-medium">{preset.name}</p>
              <p className="text-sm text-muted-foreground truncate">{preset.hex}</p>
            </div>
          </Label>
        ))}
      </RadioGroup>

      <Popover open={colorPopoverOpen} onOpenChange={setColorPopoverOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              'flex items-center gap-2 md:gap-3 rounded-lg border p-3 md:p-4 cursor-pointer transition-colors text-left w-full',
              isCustom
                ? 'border-primary bg-primary/5'
                : 'border-dashed hover:border-primary hover:bg-primary/5'
            )}
          >
            <div
              className={cn(
                'h-5 w-5 rounded-full shrink-0 border-2 flex items-center justify-center',
                isCustom && !colorPopoverOpen
                  ? 'border-transparent'
                  : 'border-dashed border-muted-foreground/50 bg-muted/30'
              )}
              style={isCustom ? { backgroundColor: hex } : undefined}
            >
              {!isCustom || colorPopoverOpen ? (
                <Palette className="w-3 h-3 text-muted-foreground" />
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="font-medium">Escolher cor</p>
              <p className="text-sm text-muted-foreground truncate">
                {isCustom ? hex : 'Cor exclusiva para esta filial'}
              </p>
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="z-[1400] w-[calc(100vw-2rem)] max-w-80 p-4"
          align="start"
          side="bottom"
          sideOffset={8}
          collisionPadding={16}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {popoverContent}
        </PopoverContent>
      </Popover>
    </div>
  );

  if (embedded) {
    return <div className="space-y-3">{pickerBody}</div>;
  }

  return (
    <Card>
      <CardHeader className="p-3 md:p-6 pb-2 md:pb-3">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Palette className="w-4 h-4 md:w-5 md:h-5" />
          Cor da filial
        </CardTitle>
        <CardDescription className="text-xs">
          Identidade visual nos filtros, sidebar e relatórios consolidados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 md:space-y-4 p-3 md:p-6 pt-0">{pickerBody}</CardContent>
    </Card>
  );
}
