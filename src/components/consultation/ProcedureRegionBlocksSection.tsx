import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  createEmptyRegionItem,
  regionItemHasData,
  type RegionBlockItem,
  type RegionFieldDef,
} from '@/lib/procedureRegionBlocks';

const inputClassName =
  'rounded-xl h-11 sm:h-10 bg-primary/5 border-primary/15 focus-visible:ring-primary/30';

type Props = {
  title?: string;
  regions: readonly { key: string; label: string }[];
  fields: RegionFieldDef[];
  items: RegionBlockItem[];
  onChange: (items: RegionBlockItem[]) => void;
  className?: string;
};

export function ProcedureRegionBlocksSection({
  title = 'Regiões tratadas',
  regions,
  fields,
  items,
  onChange,
  className,
}: Props) {
  const [pendingUncheck, setPendingUncheck] = useState<string | null>(null);
  const selected = new Set(items.map((i) => i.area_key));

  const update = (areaKey: string, patch: Partial<RegionBlockItem>) => {
    onChange(items.map((i) => (i.area_key === areaKey ? { ...i, ...patch } : i)));
  };

  const labelOf = (key: string, nome?: string) => {
    if (key === 'outra' && nome?.trim()) return nome.trim();
    return regions.find((r) => r.key === key)?.label ?? key;
  };

  const handleToggle = (areaKey: string, checked: boolean) => {
    if (checked) {
      if (selected.has(areaKey)) return;
      onChange([...items, createEmptyRegionItem(areaKey, fields)]);
      return;
    }
    const existing = items.find((i) => i.area_key === areaKey);
    if (existing && regionItemHasData(existing, fields)) {
      setPendingUncheck(areaKey);
      return;
    }
    onChange(items.filter((i) => i.area_key !== areaKey));
  };

  return (
    <div className={className ?? 'col-span-full space-y-4'}>
      <div className="space-y-2">
        <Label className="text-sm font-medium">{title}</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-border/60 bg-muted/15 p-3">
          {regions.map((opt) => (
            <label
              key={opt.key}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/40"
            >
              <Checkbox
                checked={selected.has(opt.key)}
                onCheckedChange={(v) => handleToggle(opt.key, v === true)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-4 space-y-3"
        >
          <p className="text-sm font-medium">{labelOf(item.area_key, item.nome_area)}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {item.area_key === 'outra' ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>Descrição da região</Label>
                <Input
                  value={item.nome_area}
                  onChange={(e) => update(item.area_key, { nome_area: e.target.value })}
                  className={inputClassName}
                />
              </div>
            ) : null}
            {fields.map((f) => (
              <div key={`${item.id}-${f.key}`} className="space-y-2">
                <Label>{f.label}</Label>
                <Input
                  type={f.type ?? 'text'}
                  min={f.type === 'number' ? 0 : undefined}
                  value={item[f.key] ?? ''}
                  onChange={(e) => update(item.area_key, { [f.key]: e.target.value })}
                  className={inputClassName}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <AlertDialog
        open={pendingUncheck != null}
        onOpenChange={(open) => {
          if (!open) setPendingUncheck(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover região?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta região já tem dados. Ao desmarcar, os dados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingUncheck) {
                  onChange(items.filter((i) => i.area_key !== pendingUncheck));
                }
                setPendingUncheck(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
