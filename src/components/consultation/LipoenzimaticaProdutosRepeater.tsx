import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  createEmptyLipoenzimaticaProdutoItem,
  type LipoenzimaticaProdutoItem,
} from '@/lib/lipoenzimatica';

const inputClassName =
  'rounded-xl h-11 sm:h-10 bg-primary/5 border-primary/15 focus-visible:ring-primary/30';

type Props = {
  items: LipoenzimaticaProdutoItem[];
  onChange: (items: LipoenzimaticaProdutoItem[]) => void;
  className?: string;
};

const PRODUCT_FIELDS: Array<{
  key: keyof Omit<LipoenzimaticaProdutoItem, 'id'>;
  label: string;
  type?: 'text' | 'number' | 'date';
  fullWidth?: boolean;
}> = [
  { key: 'nome', label: 'Nome do produto' },
  { key: 'principio_ativo', label: 'Princípio ativo' },
  { key: 'fabricante', label: 'Fabricante' },
  { key: 'lote', label: 'Lote' },
  { key: 'validade', label: 'Data de validade', type: 'date' },
  { key: 'quantidade_total', label: 'Quantidade total utilizada', type: 'number' },
  { key: 'unidade', label: 'Unidade de medida' },
  { key: 'diluicao', label: 'Diluição' },
  { key: 'via_tecnica', label: 'Via/técnica de aplicação' },
  { key: 'responsavel_preparacao', label: 'Responsável pela preparação' },
  { key: 'observacoes', label: 'Observações sobre o produto', fullWidth: true },
];

export function LipoenzimaticaProdutosRepeater({ items, onChange, className }: Props) {
  const updateItem = (
    index: number,
    key: keyof Omit<LipoenzimaticaProdutoItem, 'id'>,
    value: string
  ) => {
    onChange(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    onChange([...items, createEmptyLipoenzimaticaProdutoItem()]);
  };

  return (
    <div className={className ?? 'col-span-full space-y-3'}>
      <div className="space-y-1">
        <Label className="text-sm font-medium">Produto e substâncias utilizadas</Label>
        <p className="text-xs text-muted-foreground">
          Se usar produtos diferentes por área, adicione mais de um item.
        </p>
      </div>

      {items.map((item, index) => (
        <div
          key={item.id}
          className="rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Produto {index + 1}</p>
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
            {PRODUCT_FIELDS.map((field) => {
              const value = item[field.key];
              if (field.key === 'observacoes') {
                return (
                  <div key={`${item.id}-${field.key}`} className="space-y-2 sm:col-span-2">
                    <Label>{field.label}</Label>
                    <Textarea
                      value={value}
                      onChange={(e) => updateItem(index, field.key, e.target.value)}
                      placeholder={field.label}
                      className="min-h-[72px] rounded-xl bg-primary/5 border-primary/15"
                    />
                  </div>
                );
              }
              return (
                <div
                  key={`${item.id}-${field.key}`}
                  className={`space-y-2${field.fullWidth ? ' sm:col-span-2' : ''}`}
                >
                  <Label>{field.label}</Label>
                  <Input
                    type={field.type ?? 'text'}
                    value={value}
                    onChange={(e) => updateItem(index, field.key, e.target.value)}
                    placeholder={field.label}
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
        Adicionar produto
      </Button>
    </div>
  );
}
