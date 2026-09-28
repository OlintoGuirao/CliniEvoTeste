import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { PhotoUploadField } from '@/components/PhotoUploadField';
import {
  createEmptyLipoenzimaticaAreaItem,
  getLipoenzimaticaAreaLabel,
  LIPOENZIMATICA_AREA_OPTIONS,
  LIPOENZIMATICA_LADO_OPTIONS,
  lipoenzimaticaAreaHasData,
  type LipoenzimaticaAreaItem,
  type LipoenzimaticaAreaKey,
  type LipoenzimaticaLado,
} from '@/lib/lipoenzimatica';

const inputClassName =
  'rounded-xl h-11 sm:h-10 bg-primary/5 border-primary/15 focus-visible:ring-primary/30';

type Props = {
  items: LipoenzimaticaAreaItem[];
  onChange: (items: LipoenzimaticaAreaItem[]) => void;
  userId: string;
  instanceIdOrTemp?: string;
  onCameraOpen?: () => void;
  onCameraClose?: () => void;
  previewVisible?: boolean;
  className?: string;
};

export function LipoenzimaticaAreasSection({
  items,
  onChange,
  userId,
  instanceIdOrTemp,
  onCameraOpen,
  onCameraClose,
  previewVisible = true,
  className,
}: Props) {
  const [pendingUncheck, setPendingUncheck] = useState<LipoenzimaticaAreaKey | null>(null);

  const selectedKeys = new Set(items.map((i) => i.area_key));

  const updateItem = (
    areaKey: LipoenzimaticaAreaKey,
    patch: Partial<LipoenzimaticaAreaItem>
  ) => {
    onChange(items.map((item) => (item.area_key === areaKey ? { ...item, ...patch } : item)));
  };

  const addArea = (areaKey: LipoenzimaticaAreaKey) => {
    if (selectedKeys.has(areaKey)) return;
    onChange([...items, createEmptyLipoenzimaticaAreaItem(areaKey)]);
  };

  const removeArea = (areaKey: LipoenzimaticaAreaKey) => {
    onChange(items.filter((item) => item.area_key !== areaKey));
  };

  const handleToggle = (areaKey: LipoenzimaticaAreaKey, checked: boolean) => {
    if (checked) {
      addArea(areaKey);
      return;
    }
    const existing = items.find((i) => i.area_key === areaKey);
    if (existing && lipoenzimaticaAreaHasData(existing)) {
      setPendingUncheck(areaKey);
      return;
    }
    removeArea(areaKey);
  };

  const confirmUncheck = () => {
    if (pendingUncheck) removeArea(pendingUncheck);
    setPendingUncheck(null);
  };

  return (
    <div className={className ?? 'col-span-full space-y-4'}>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Áreas tratadas</Label>
        <p className="text-xs text-muted-foreground">
          Marque as áreas. Cada seleção abre os campos correspondentes.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-border/60 bg-muted/15 p-3">
          {LIPOENZIMATICA_AREA_OPTIONS.map((opt) => {
            const checked = selectedKeys.has(opt.key);
            return (
              <label
                key={opt.key}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/40"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => handleToggle(opt.key, v === true)}
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-4 space-y-3"
        >
          <p className="text-sm font-medium text-foreground">
            {item.area_key === 'outra' && item.nome_area.trim()
              ? item.nome_area.trim()
              : getLipoenzimaticaAreaLabel(item.area_key)}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {item.area_key === 'outra' ? (
              <>
                <div className="space-y-2">
                  <Label>Nome da área</Label>
                  <Input
                    value={item.nome_area}
                    onChange={(e) => updateItem(item.area_key, { nome_area: e.target.value })}
                    placeholder="Nome da área"
                    className={inputClassName}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Descrição anatômica</Label>
                  <Input
                    value={item.descricao_anatomica}
                    onChange={(e) =>
                      updateItem(item.area_key, { descricao_anatomica: e.target.value })
                    }
                    placeholder="Descrição anatômica"
                    className={inputClassName}
                  />
                </div>
              </>
            ) : null}

            <div className="space-y-2">
              <Label>Lado</Label>
              <Select
                value={item.lado || undefined}
                onValueChange={(v) =>
                  updateItem(item.area_key, { lado: v as LipoenzimaticaLado })
                }
              >
                <SelectTrigger className={inputClassName}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {LIPOENZIMATICA_LADO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantidade de pontos/aplicações</Label>
              <Input
                type="number"
                value={item.quantidade_pontos}
                onChange={(e) =>
                  updateItem(item.area_key, { quantidade_pontos: e.target.value })
                }
                placeholder="Ex.: 12"
                className={inputClassName}
              />
            </div>

            <div className="space-y-2">
              <Label>Volume aplicado</Label>
              <Input
                type="number"
                value={item.volume_aplicado}
                onChange={(e) =>
                  updateItem(item.area_key, { volume_aplicado: e.target.value })
                }
                placeholder="Ex.: 5"
                className={inputClassName}
              />
            </div>

            <div className="space-y-2">
              <Label>Produto utilizado</Label>
              <Input
                value={item.produto_utilizado}
                onChange={(e) =>
                  updateItem(item.area_key, { produto_utilizado: e.target.value })
                }
                placeholder="Produto"
                className={inputClassName}
              />
            </div>

            <div className="space-y-2">
              <Label>Concentração/diluição</Label>
              <Input
                value={item.concentracao}
                onChange={(e) => updateItem(item.area_key, { concentracao: e.target.value })}
                placeholder="Concentração/diluição"
                className={inputClassName}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Observações da área</Label>
              <Textarea
                value={item.observacoes}
                onChange={(e) => updateItem(item.area_key, { observacoes: e.target.value })}
                placeholder="Observações"
                className="min-h-[72px] rounded-xl bg-primary/5 border-primary/15"
              />
            </div>

            <div className="sm:col-span-2">
              <PhotoUploadField
                label="Foto da área"
                value={item.foto_url || null}
                onChange={(url) => updateItem(item.area_key, { foto_url: url ?? '' })}
                userId={userId}
                instanceIdOrTemp={instanceIdOrTemp}
                onCameraOpen={onCameraOpen}
                onCameraClose={onCameraClose}
                previewVisible={previewVisible}
              />
            </div>
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
            <AlertDialogTitle>Remover área?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta área já tem dados preenchidos. Ao desmarcar, os dados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUncheck}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
