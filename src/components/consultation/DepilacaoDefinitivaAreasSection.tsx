import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { SignaturePad } from '@/components/SignaturePad';
import {
  createEmptyDepilacaoAreaItem,
  depilacaoAreaHasData,
  getDepilacaoAreaLabel,
  getDepilacaoAreaOptions,
  type DepilacaoAreaItem,
} from '@/lib/depilacaoDefinitiva';

const inputClassName =
  'rounded-xl h-11 sm:h-10 bg-primary/5 border-primary/15 focus-visible:ring-primary/30';

type Props = {
  slug: string;
  items: DepilacaoAreaItem[];
  onChange: (items: DepilacaoAreaItem[]) => void;
  sessionDate?: string;
  className?: string;
};

export function DepilacaoDefinitivaAreasSection({
  slug,
  items,
  onChange,
  sessionDate = '',
  className,
}: Props) {
  const options = getDepilacaoAreaOptions(slug);
  const [pendingUncheck, setPendingUncheck] = useState<string | null>(null);
  const selected = new Set(items.map((i) => i.area_key));

  const update = (areaKey: string, patch: Partial<DepilacaoAreaItem>) => {
    onChange(items.map((i) => (i.area_key === areaKey ? { ...i, ...patch } : i)));
  };

  const handleToggle = (areaKey: string, checked: boolean) => {
    if (checked) {
      if (selected.has(areaKey)) return;
      onChange([...items, createEmptyDepilacaoAreaItem(areaKey, sessionDate)]);
      return;
    }
    const existing = items.find((i) => i.area_key === areaKey);
    if (existing && depilacaoAreaHasData(existing)) {
      setPendingUncheck(areaKey);
      return;
    }
    onChange(items.filter((i) => i.area_key !== areaKey));
  };

  return (
    <div className={className ?? 'col-span-full space-y-4'}>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Áreas tratadas</Label>
        <p className="text-xs text-muted-foreground">
          Cada área tem sessão, parâmetros, próxima data e assinatura próprios.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-border/60 bg-muted/15 p-3">
          {options.map((opt) => (
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
          <p className="text-sm font-medium">
            {getDepilacaoAreaLabel(slug, item.area_key, item.nome_area)}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {item.area_key === 'outra' ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>Nome da área</Label>
                <Input
                  value={item.nome_area}
                  onChange={(e) => update(item.area_key, { nome_area: e.target.value })}
                  className={inputClassName}
                  placeholder="Descreva a área"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Número da sessão nesta área</Label>
              <Input
                type="number"
                min={1}
                value={item.numero_sessao}
                onChange={(e) => update(item.area_key, { numero_sessao: e.target.value })}
                className={inputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label>Data da sessão</Label>
              <Input
                type="date"
                value={item.data_sessao}
                onChange={(e) => update(item.area_key, { data_sessao: e.target.value })}
                className={inputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label>Equipamento utilizado</Label>
              <Input
                value={item.equipamento}
                onChange={(e) => update(item.area_key, { equipamento: e.target.value })}
                className={inputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label>Ponteira ou aplicador</Label>
              <Input
                value={item.ponteira}
                onChange={(e) => update(item.area_key, { ponteira: e.target.value })}
                className={inputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label>Frequência do equipamento</Label>
              <Input
                value={item.frequencia_equipamento}
                onChange={(e) =>
                  update(item.area_key, { frequencia_equipamento: e.target.value })
                }
                className={inputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label>Potência ou energia</Label>
              <Input
                value={item.potencia_energia}
                onChange={(e) => update(item.area_key, { potencia_energia: e.target.value })}
                className={inputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label>Quantidade de disparos</Label>
              <Input
                type="number"
                min={0}
                value={item.quantidade_disparos}
                onChange={(e) =>
                  update(item.area_key, { quantidade_disparos: e.target.value })
                }
                className={inputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label>Tempo de aplicação</Label>
              <Input
                value={item.tempo_aplicacao}
                onChange={(e) => update(item.area_key, { tempo_aplicacao: e.target.value })}
                className={inputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label>Reação da pele</Label>
              <Input
                value={item.reacao_pele}
                onChange={(e) => update(item.area_key, { reacao_pele: e.target.value })}
                className={inputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label>Data prevista da próxima sessão</Label>
              <Input
                type="date"
                value={item.data_proxima_sessao}
                onChange={(e) =>
                  update(item.area_key, { data_proxima_sessao: e.target.value })
                }
                className={inputClassName}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Intercorrências</Label>
              <Textarea
                value={item.intercorrencias}
                onChange={(e) => update(item.area_key, { intercorrencias: e.target.value })}
                className="min-h-[64px] rounded-xl bg-primary/5 border-primary/15"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Observações da área</Label>
              <Textarea
                value={item.observacoes}
                onChange={(e) => update(item.area_key, { observacoes: e.target.value })}
                className="min-h-[64px] rounded-xl bg-primary/5 border-primary/15"
              />
            </div>
            <div className="sm:col-span-2 space-y-2 rounded-lg border border-border/50 p-3">
              <Label className="text-sm font-medium">
                Assinatura da sessão — {getDepilacaoAreaLabel(slug, item.area_key, item.nome_area)}
              </Label>
              <p className="text-xs text-muted-foreground">
                Status: {item.assinatura_status}
                {item.assinatura_em
                  ? ` · ${new Date(item.assinatura_em).toLocaleString('pt-BR')}`
                  : ''}
              </p>
              {item.assinatura_status === 'assinada' && item.assinatura_data ? (
                <div className="space-y-2">
                  <img
                    src={item.assinatura_data}
                    alt="Assinatura"
                    className="max-h-20 border rounded bg-muted/30"
                  />
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline"
                    onClick={() =>
                      update(item.area_key, {
                        assinatura_data: '',
                        assinatura_status: 'pendente',
                        assinatura_em: '',
                      })
                    }
                  >
                    Reassinar
                  </button>
                </div>
              ) : (
                <SignaturePad
                  label="Assinatura do paciente / responsável"
                  height={140}
                  onSave={(dataUrl) =>
                    update(item.area_key, {
                      assinatura_data: dataUrl,
                      assinatura_status: 'assinada',
                      assinatura_em: new Date().toISOString(),
                    })
                  }
                />
              )}
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
