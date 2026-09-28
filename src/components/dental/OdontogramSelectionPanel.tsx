import { type ReactNode, useState } from 'react';
import { Eraser, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { DENTAL_FACE_LABELS, type DentalToothFace } from '@/lib/dentalFdi';
import {
  CLINIC_PRICE_TIER_LABELS,
  CLINIC_PRICE_TIERS,
  type ClinicPriceTier,
} from '@/lib/clinicPriceTiers';
import { OdontogramQuickActions } from '@/components/dental/OdontogramQuickActions';
import { ToothFacePicker } from '@/components/dental/ToothFacePicker';

function MenuSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-1.5', className)}>
      <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </section>
  );
}

export type DentalBulkSelectionMode = 'upper' | 'lower' | 'all' | null;

export type SheetProcedureOption = {
  id: string;
  name: string;
  specialty: string | null;
};

export type SheetLinkedPlanItem = {
  id: string;
  name: string;
  detail?: string;
};

export type OdontogramSelectionPanelProps = {
  selectedTeeth: string[];
  faceFocusTooth: string | null;
  onFaceFocusToothChange: (tooth: string) => void;
  faceSelections: Array<{ toothNumber: string; faces: DentalToothFace[] }>;
  onToggleFace: (tooth: string, face: DentalToothFace) => void;
  teethInput: string;
  onTeethInputChange: (value: string) => void;
  onTeethInputCommit: () => void;
  onTeethInputFocusChange?: (focused: boolean) => void;
  /** Seleção em massa (todos/arcadas) — esconde lista FDI e faces. */
  bulkMode?: DentalBulkSelectionMode;
  disabled?: boolean;
  busy?: boolean;
  canDuplicateProcedure?: boolean;
  variant?: 'card' | 'menu';
  /** Catálogo para seleção inline no sheet (sem modal). */
  procedureOptions?: SheetProcedureOption[];
  procedureSearch?: string;
  onProcedureSearchChange?: (value: string) => void;
  /** Clique no procedimento já adiciona ao plano. */
  onPickProcedure?: (p: SheetProcedureOption) => void;
  /** Tabela de preço usada ao adicionar pelo clique. */
  priceTier?: ClinicPriceTier;
  onPriceTierChange?: (tier: ClinicPriceTier) => void;
  /** Preço formatado do procedimento na tabela atual (ex.: "300"). */
  getProcedurePriceLabel?: (procedureId: string) => string | null;
  /** Procedimentos já no plano para os dentes selecionados. */
  linkedPlanItems?: SheetLinkedPlanItem[];
  onDeleteLinkedItem?: (itemId: string) => void;
  onSelectUpperArch: () => void;
  onSelectLowerArch: () => void;
  onSelectAll: () => void;
  onChangeCondition: () => void;
  onMarkAbsent: () => void;
  onDuplicateProcedure: () => void;
  onClearSelection: () => void;
  className?: string;
};

export function OdontogramSelectionPanel({
  selectedTeeth,
  faceFocusTooth,
  onFaceFocusToothChange,
  faceSelections,
  onToggleFace,
  teethInput,
  onTeethInputChange,
  onTeethInputCommit,
  onTeethInputFocusChange,
  bulkMode = null,
  disabled,
  busy,
  canDuplicateProcedure,
  variant = 'card',
  procedureOptions = [],
  procedureSearch = '',
  onProcedureSearchChange,
  onPickProcedure,
  priceTier,
  onPriceTierChange,
  getProcedurePriceLabel,
  linkedPlanItems = [],
  onDeleteLinkedItem,
  onSelectUpperArch,
  onSelectLowerArch,
  onSelectAll,
  onChangeCondition,
  onMarkAbsent,
  onDuplicateProcedure,
  onClearSelection,
  className,
}: OdontogramSelectionPanelProps) {
  const isMenu = variant === 'menu';
  const hideToothDetails = bulkMode === 'all';
  const [showFaces, setShowFaces] = useState(false);

  const activeTooth =
    (faceFocusTooth && selectedTeeth.includes(faceFocusTooth)
      ? faceFocusTooth
      : selectedTeeth[selectedTeeth.length - 1]) ?? null;

  const activeFaces =
    activeTooth != null
      ? (faceSelections.find((s) => s.toothNumber === activeTooth)?.faces ?? [])
      : [];

  const activeFaceLabel =
    activeFaces.length === 0
      ? null
      : activeFaces.map((f) => DENTAL_FACE_LABELS[f]).join(', ');

  const bulkLabel =
    bulkMode === 'all'
      ? `Todos os dentes (${selectedTeeth.length})`
      : bulkMode === 'upper'
        ? `Arcada superior (${selectedTeeth.length})`
        : bulkMode === 'lower'
          ? `Arcada inferior (${selectedTeeth.length})`
          : null;

  return (
    <aside
      className={cn(
        'space-y-3',
        !isMenu && 'rounded-xl border p-3 shadow-sm',
        !isMenu &&
          (selectedTeeth.length > 0
            ? 'border-[color:var(--odontograma-selected-border)] bg-[color:var(--odontograma-selected-soft)]'
            : 'border-border/60 bg-muted/20'),
        className
      )}
      aria-live="polite"
    >
      <MenuSection title="Seleção rápida">
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            variant={bulkMode === 'upper' ? 'default' : 'outline'}
            disabled={disabled}
            title="Selecionar arcada superior"
            onClick={onSelectUpperArch}
            className="h-7 rounded-md px-2 text-[11px] font-medium"
          >
            Superior
          </Button>
          <Button
            type="button"
            variant={bulkMode === 'lower' ? 'default' : 'outline'}
            disabled={disabled}
            title="Selecionar arcada inferior"
            onClick={onSelectLowerArch}
            className="h-7 rounded-md px-2 text-[11px] font-medium"
          >
            Inferior
          </Button>
          <Button
            type="button"
            variant={bulkMode === 'all' ? 'default' : 'outline'}
            disabled={disabled}
            title="Selecionar todos"
            onClick={onSelectAll}
            className="h-7 rounded-md px-2 text-[11px] font-medium"
          >
            Todos
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled || selectedTeeth.length === 0}
            title="Limpar seleção"
            onClick={onClearSelection}
            className="h-7 rounded-md px-2 text-[11px] text-muted-foreground"
          >
            <Eraser className="mr-1 h-3 w-3" />
            Limpar
          </Button>
        </div>
      </MenuSection>

      {selectedTeeth.length > 0 ? (
        <>
          {priceTier && onPriceTierChange ? (
            <MenuSection title="Tabela de preço">
              <Select
                value={priceTier}
                onValueChange={(v) => onPriceTierChange(v as ClinicPriceTier)}
                disabled={disabled || busy}
              >
                <SelectTrigger className="h-8 rounded-lg text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLINIC_PRICE_TIERS.map((tier) => (
                    <SelectItem key={tier} value={tier}>
                      {CLINIC_PRICE_TIER_LABELS[tier]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </MenuSection>
          ) : null}

          <MenuSection title="Procedimento">
            <Input
              className="h-8 rounded-lg text-xs"
              value={procedureSearch}
              disabled={disabled || busy}
              placeholder="Digite e clique para adicionar…"
              autoComplete="off"
              onChange={(e) => onProcedureSearchChange?.(e.target.value)}
            />
            {procedureSearch.trim() ? (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60">
                {procedureOptions.length === 0 ? (
                  <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                    Nenhum procedimento encontrado
                  </p>
                ) : (
                  procedureOptions.map((p) => {
                    const priceLabel = getProcedurePriceLabel?.(p.id) ?? null;
                    return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={disabled || busy}
                      onClick={() => onPickProcedure?.(p)}
                      className="flex w-full items-start gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-muted/70"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                      {priceLabel ? (
                        <span className="shrink-0 tabular-nums text-[10px] font-medium text-foreground/80">
                          {priceLabel}
                        </span>
                      ) : null}
                      {p.specialty ? (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {p.specialty}
                        </span>
                      ) : null}
                    </button>
                    );
                  })
                )}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Digite o nome e clique no resultado — já entra no plano. Pode adicionar vários.
              </p>
            )}

            {linkedPlanItems.length > 0 ? (
              <div className="space-y-1 rounded-lg border border-border/60 bg-muted/20 p-1.5">
                <p className="px-1 text-[10px] font-medium text-muted-foreground">
                  No plano (desta seleção)
                </p>
                {linkedPlanItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5 text-[11px]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.name}</p>
                      {item.detail ? (
                        <p className="truncate text-muted-foreground">{item.detail}</p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={disabled || busy}
                      title="Remover do plano"
                      onClick={() => onDeleteLinkedItem?.(item.id)}
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </MenuSection>

          <Separator className="my-1" />

          {hideToothDetails ? (
            <>
              <div className="rounded-lg border border-[color:var(--odontograma-selected-border)] bg-[color:var(--odontograma-selected-soft)] px-3 py-2.5">
                <p className="text-sm font-semibold text-[color:var(--odontograma-selected)]">
                  {bulkLabel}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Seleção em massa — números e faces ocultos.
                </p>
              </div>

              <MenuSection title="Ações">
                <OdontogramQuickActions
                  hideSectionTitles
                  disabled={disabled}
                  canDuplicate={canDuplicateProcedure}
                  onChangeCondition={onChangeCondition}
                  onMarkAbsent={onMarkAbsent}
                  onDuplicateProcedure={onDuplicateProcedure}
                />
              </MenuSection>
            </>
          ) : (
            <>
              <MenuSection title="Dentes (FDI)">
                <div className="flex gap-1.5">
                  <Input
                    id="odontograma-teeth-input"
                    className="h-8 rounded-lg font-mono text-xs"
                    value={teethInput}
                    disabled={disabled}
                    placeholder="11, 12, 16…"
                    onFocus={() => onTeethInputFocusChange?.(true)}
                    onChange={(e) => onTeethInputChange(e.target.value)}
                    onBlur={() => {
                      onTeethInputFocusChange?.(false);
                      onTeethInputCommit();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        onTeethInputCommit();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 shrink-0 rounded-lg px-2.5 text-[11px]"
                    disabled={disabled}
                    onClick={onTeethInputCommit}
                  >
                    OK
                  </Button>
                </div>
                {selectedTeeth.length > 1 ? (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {selectedTeeth.map((tooth) => {
                      const count =
                        faceSelections.find((s) => s.toothNumber === tooth)?.faces.length ?? 0;
                      return (
                        <button
                          key={tooth}
                          type="button"
                          disabled={disabled}
                          onClick={() => onFaceFocusToothChange(tooth)}
                          className={cn(
                            'rounded-md border px-1.5 py-0.5 text-[11px] font-medium tabular-nums transition-colors',
                            tooth === activeTooth
                              ? 'border-[color:var(--odontograma-selected)] bg-[color:var(--odontograma-selected)] text-white'
                              : 'border-border bg-background hover:bg-muted'
                          )}
                        >
                          {tooth}
                          {count > 0 ? `·${count}` : ''}
                        </button>
                      );
                    })}
                  </div>
                ) : selectedTeeth.length === 1 && activeFaceLabel ? (
                  <p className="text-[11px] text-muted-foreground">
                    Face:{' '}
                    <span className="font-medium text-[color:var(--odontograma-selected)]">
                      {activeFaceLabel}
                    </span>
                  </p>
                ) : null}
              </MenuSection>

              <MenuSection title="Ações">
                <OdontogramQuickActions
                  hideSectionTitles
                  disabled={disabled}
                  canDuplicate={canDuplicateProcedure}
                  showFaces={showFaces}
                  facesDisabled={!activeTooth}
                  onToggleFaces={() => setShowFaces((v) => !v)}
                  onChangeCondition={onChangeCondition}
                  onMarkAbsent={onMarkAbsent}
                  onDuplicateProcedure={onDuplicateProcedure}
                />
              </MenuSection>

              {showFaces && activeTooth ? (
                <MenuSection title={`Faces · dente ${activeTooth}`}>
                  <ToothFacePicker
                    tooth={activeTooth}
                    selectedFaces={activeFaces}
                    disabled={disabled}
                    size="sm"
                    onToggleFace={(face) => onToggleFace(activeTooth, face)}
                  />
                </MenuSection>
              ) : null}
            </>
          )}
        </>
      ) : (
        <>
          <p className="rounded-lg border border-dashed px-3 py-3 text-center text-[11px] text-muted-foreground">
            Clique em um dente no odontograma para escolher faces e ações.
          </p>

          <Separator className="my-1" />

          <MenuSection title="Dentes (FDI)">
            <div className="flex gap-1.5">
              <Input
                id="odontograma-teeth-input"
                className="h-8 rounded-lg font-mono text-xs"
                value={teethInput}
                disabled={disabled}
                placeholder="11, 12, 16…"
                onFocus={() => onTeethInputFocusChange?.(true)}
                onChange={(e) => onTeethInputChange(e.target.value)}
                onBlur={() => {
                  onTeethInputFocusChange?.(false);
                  onTeethInputCommit();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onTeethInputCommit();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="h-8 shrink-0 rounded-lg px-2.5 text-[11px]"
                disabled={disabled}
                onClick={onTeethInputCommit}
              >
                OK
              </Button>
            </div>
          </MenuSection>
        </>
      )}
    </aside>
  );
}
