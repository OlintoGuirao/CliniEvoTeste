import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createEmptyPreenchimentoAplicacaoItem,
  getPreenchimentoFieldLabel,
  PREENCHIMENTO_APLICACAO_FORM_FIELDS,
  type PreenchimentoAplicacaoItem,
  type PreenchimentoRepeatableFieldKey,
} from '@/lib/preenchimentoFacial';

const inputClassName =
  'rounded-xl h-11 sm:h-10 bg-primary/5 border-primary/15 focus-visible:ring-primary/30';

type Props = {
  items: PreenchimentoAplicacaoItem[];
  onChange: (items: PreenchimentoAplicacaoItem[]) => void;
  className?: string;
};

export function PreenchimentoAplicacaoRepeater({ items, onChange, className }: Props) {
  const updateItem = (index: number, key: PreenchimentoRepeatableFieldKey, value: string) => {
    onChange(
      items.map((item, i) => (i === index ? { ...item, [key]: value } : item))
    );
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    onChange([...items, createEmptyPreenchimentoAplicacaoItem()]);
  };

  return (
    <div className={className ?? 'sm:col-span-2 space-y-3'}>
      {items.map((item, index) => (
        <div
          key={item.id}
          className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              Aplicação {index + 1}
            </p>
            {items.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-muted-foreground hover:text-destructive"
                onClick={() => removeItem(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remover
              </Button>
            ) : null}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PREENCHIMENTO_APLICACAO_FORM_FIELDS.map((fieldKey) => {
              const label = getPreenchimentoFieldLabel(fieldKey);
              const value = item[fieldKey as keyof PreenchimentoAplicacaoItem] as string;
              return (
                <div key={`${item.id}-${fieldKey}`} className="space-y-2">
                  <Label>{label}</Label>
                  <Input
                    type={fieldKey === 'volume_total_ml' ? 'number' : 'text'}
                    value={value}
                    onChange={(e) => updateItem(index, fieldKey, e.target.value)}
                    placeholder={label}
                    className={inputClassName}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full rounded-xl gap-2 touch-manipulation"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          addItem();
        }}
      >
        <Plus className="h-4 w-4" />
        Adicionar campo
      </Button>
    </div>
  );
}
