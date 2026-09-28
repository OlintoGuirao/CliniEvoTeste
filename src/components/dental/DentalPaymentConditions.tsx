import { useEffect, useState } from 'react';
import { DollarSign, Pencil, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatBrl } from '@/lib/budgetQuote';

export const DENTAL_PAYMENT_METHODS = [
  'pix',
  'dinheiro',
  'cartao_credito',
  'cartao_debito',
  'boleto',
  'transferencia',
  'convenio',
  'outro',
] as const;

export type DentalPaymentMethod = (typeof DENTAL_PAYMENT_METHODS)[number];

export const DENTAL_PAYMENT_METHOD_LABELS: Record<DentalPaymentMethod, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  convenio: 'Convênio',
  outro: 'Outro',
};

export const DENTAL_CARD_BRANDS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard', 'Outra'] as const;

export type DentalPaymentCondition = {
  id: string;
  method: DentalPaymentMethod;
  customMethodLabel: string;
  amount: number;
  dueDate: string;
  installments: number;
  cardBrand: string;
  notes: string;
};

export function createEmptyPaymentDraft(
  remainingAmount: number
): Omit<DentalPaymentCondition, 'id'> {
  return {
    method: 'pix',
    customMethodLabel: '',
    amount: remainingAmount > 0 ? remainingAmount : 0,
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    installments: 1,
    cardBrand: 'Visa',
    notes: '',
  };
}

export function paymentConditionDocumentLabel(c: DentalPaymentCondition): string {
  const base =
    c.method === 'outro'
      ? c.customMethodLabel.trim() || 'Outro'
      : DENTAL_PAYMENT_METHOD_LABELS[c.method];
  if (c.method === 'cartao_credito' && c.installments > 1) {
    const brand = c.cardBrand?.trim() ? ` ${c.cardBrand}` : '';
    return `${base}${brand} ${c.installments}x`;
  }
  if (c.method === 'cartao_credito' || c.method === 'cartao_debito') {
    const brand = c.cardBrand?.trim() ? ` · ${c.cardBrand}` : '';
    return `${base}${brand}`;
  }
  return base;
}

export function formatPaymentConditionsSummary(conditions: DentalPaymentCondition[]): string {
  return conditions
    .map((c, idx) => {
      const due = c.dueDate
        ? format(new Date(`${c.dueDate}T12:00:00`), 'dd/MM/yyyy')
        : '—';
      const parcela =
        c.method === 'cartao_credito' && c.installments > 1
          ? ` (${c.installments}x de ${formatBrl(c.amount / c.installments)})`
          : '';
      const note = c.notes.trim() ? ` — ${c.notes.trim()}` : '';
      return `${idx + 1}. ${paymentConditionDocumentLabel(c)} · venc. ${due} · ${formatBrl(c.amount)}${parcela}${note}`;
    })
    .join('\n');
}

function parseMoneyInput(raw: string): number {
  const normalized = raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatMoneyInput(value: number): string {
  if (!(value > 0)) return '';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type DraftState = {
  method: DentalPaymentMethod;
  customMethodLabel: string;
  amount: string;
  dueDate: string;
  installments: string;
  cardBrand: string;
  notes: string;
};

function draftFromCondition(c: Omit<DentalPaymentCondition, 'id'> | DentalPaymentCondition): DraftState {
  return {
    method: c.method,
    customMethodLabel: c.customMethodLabel,
    amount: formatMoneyInput(c.amount),
    dueDate: c.dueDate,
    installments: String(c.installments || 1),
    cardBrand: c.cardBrand || 'Visa',
    notes: c.notes || '',
  };
}

type DentalPaymentConditionEditorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Omit<DentalPaymentCondition, 'id'> | DentalPaymentCondition;
  editingId: string | null;
  planTotal: number;
  currentSum: number;
  onSave: (condition: Omit<DentalPaymentCondition, 'id'>) => void;
};

export function DentalPaymentConditionEditor({
  open,
  onOpenChange,
  initial,
  editingId,
  planTotal,
  currentSum,
  onSave,
}: DentalPaymentConditionEditorProps) {
  const [draft, setDraft] = useState<DraftState>(() => draftFromCondition(initial));

  useEffect(() => {
    if (!open) return;
    setDraft(draftFromCondition(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir/trocar item
  }, [open, editingId]);

  const isCredit = draft.method === 'cartao_credito';
  const isCard = isCredit || draft.method === 'cartao_debito';
  const amount = parseMoneyInput(draft.amount);
  const installments = Math.max(1, Math.min(24, Number.parseInt(draft.installments, 10) || 1));
  const installmentValue = isCredit && installments > 1 ? amount / installments : amount;

  function handleSave() {
    if (!(amount > 0)) return;
    if (draft.method === 'outro' && !draft.customMethodLabel.trim()) return;
    onSave({
      method: draft.method,
      customMethodLabel: draft.customMethodLabel.trim(),
      amount,
      dueDate: draft.dueDate,
      installments: isCredit ? installments : 1,
      cardBrand: isCard ? draft.cardBrand : '',
      notes: draft.notes.trim(),
    });
  }

  const remainingAfterOthers = Math.max(0, planTotal - currentSum);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingId ? 'Editar condição de pagamento' : 'Definir condição de pagamento'}
          </DialogTitle>
          <DialogDescription>
            Adicione entrada, saldo no cartão, pix, boleto e outras formas. Pode combinar várias.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Forma de pagamento</Label>
            <Select
              value={draft.method}
              onValueChange={(v) => {
                const method = v as DentalPaymentMethod;
                setDraft((prev) => {
                  const parsed = parseMoneyInput(prev.amount);
                  const shouldFillRemaining =
                    !editingId &&
                    remainingAfterOthers > 0 &&
                    (!(parsed > 0) || Math.abs(parsed - remainingAfterOthers) < 0.01);
                  return {
                    ...prev,
                    method,
                    installments:
                      method === 'cartao_credito'
                        ? prev.installments === '1'
                          ? '2'
                          : prev.installments || '2'
                        : '1',
                    amount:
                      shouldFillRemaining &&
                      (method === 'cartao_credito' || method === 'cartao_debito')
                        ? formatMoneyInput(remainingAfterOthers)
                        : prev.amount,
                  };
                });
              }}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DENTAL_PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {DENTAL_PAYMENT_METHOD_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {draft.method === 'outro' ? (
            <div className="space-y-1.5">
              <Label htmlFor="dental-pay-custom">Descrição</Label>
              <Input
                id="dental-pay-custom"
                className="rounded-xl"
                value={draft.customMethodLabel}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, customMethodLabel: e.target.value }))
                }
                placeholder="Ex.: Cheque, permuta…"
              />
            </div>
          ) : null}

          {isCard ? (
            <div className="space-y-1.5">
              <Label>Bandeira</Label>
              <Select
                value={draft.cardBrand}
                onValueChange={(v) => setDraft((prev) => ({ ...prev, cardBrand: v }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DENTAL_CARD_BRANDS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="dental-pay-amount">Valor desta condição (R$)</Label>
              {!editingId && remainingAfterOthers > 0 && amount !== remainingAfterOthers ? (
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      amount: formatMoneyInput(remainingAfterOthers),
                    }))
                  }
                >
                  Usar restante ({formatBrl(remainingAfterOthers)})
                </button>
              ) : null}
            </div>
            <Input
              id="dental-pay-amount"
              className="rounded-xl text-right tabular-nums text-base"
              value={draft.amount}
              onChange={(e) => setDraft((prev) => ({ ...prev, amount: e.target.value }))}
              inputMode="decimal"
              placeholder="0,00"
              autoFocus
            />
            {planTotal > 0 ? (
              <p className="text-xs text-muted-foreground">
                Total do plano: {formatBrl(planTotal)}
                {remainingAfterOthers > 0
                  ? ` · restante: ${formatBrl(remainingAfterOthers)}`
                  : ' · já coberto'}
              </p>
            ) : null}
          </div>

          {isCredit ? (
            <div className="space-y-1.5">
              <Label>Parcelas</Label>
              <Select
                value={String(installments)}
                onValueChange={(v) => setDraft((prev) => ({ ...prev, installments: v }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n === 1 ? 'À vista (1x)' : `${n}x`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {amount > 0 ? (
                <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">
                    {installments > 1 ? 'Valor de cada parcela' : 'Pagamento'}
                  </p>
                  <p className="text-base font-semibold tabular-nums text-foreground">
                    {installments > 1
                      ? `${installments}x de ${formatBrl(installmentValue)}`
                      : `À vista: ${formatBrl(amount)}`}
                  </p>
                  {installments > 1 ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatBrl(amount)} ÷ {installments} = {formatBrl(installmentValue)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Informe o valor restante para calcular as parcelas.
                </p>
              )}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="dental-pay-due">
              {isCredit && installments > 1 ? '1º vencimento' : 'Vencimento'}
            </Label>
            <Input
              id="dental-pay-due"
              type="date"
              className="rounded-xl"
              value={draft.dueDate}
              onChange={(e) => setDraft((prev) => ({ ...prev, dueDate: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dental-pay-notes">Observação (opcional)</Label>
            <Input
              id="dental-pay-notes"
              className="rounded-xl"
              value={draft.notes}
              onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Ex.: Entrada · Saldo · Taxa da maquininha…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            disabled={
              !(amount > 0) ||
              (draft.method === 'outro' && !draft.customMethodLabel.trim())
            }
            onClick={handleSave}
          >
            <DollarSign className="mr-1.5 h-4 w-4" />
            {editingId ? 'Salvar alteração' : 'Adicionar condição'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DentalPaymentConditionsListProps = {
  conditions: DentalPaymentCondition[];
  patientName: string | null;
  planTotal: number;
  disabled?: boolean;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
};

export function DentalPaymentConditionsList({
  conditions,
  patientName,
  planTotal,
  disabled,
  onAdd,
  onEdit,
  onRemove,
}: DentalPaymentConditionsListProps) {
  const sum = conditions.reduce((s, c) => s + c.amount, 0);
  const diff = planTotal > 0 ? sum - planTotal : 0;

  return (
    <section className="overflow-hidden rounded-xl border border-border/50 bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-muted/20 px-3 py-2.5 sm:px-4">
        <h3 className="text-sm font-semibold text-foreground">Condições de pagamento</h3>
        <Button
          type="button"
          size="sm"
          className="shrink-0 rounded-lg"
          disabled={disabled}
          onClick={onAdd}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {conditions.length === 0
            ? 'Definir condições de pagamento'
            : 'Adicionar forma de pagamento'}
        </Button>
      </div>
      <div className="space-y-3 px-3 py-3 sm:px-4">
        <p className="text-sm text-muted-foreground">
          Responsável financeiro:{' '}
          <span className="font-medium text-foreground">{patientName ?? 'Paciente'}</span>
        </p>
        <div className="overflow-hidden rounded-lg border border-border/50">
          <div className="grid grid-cols-[2rem_minmax(0,1fr)_6.5rem_7rem_4.5rem] gap-1 border-b border-border/40 bg-muted/30 px-2 py-2 text-[11px] font-medium text-muted-foreground sm:grid-cols-[2.5rem_minmax(0,1fr)_7rem_8rem_5rem] sm:gap-2 sm:px-3 sm:text-xs">
            <span>#</span>
            <span>Documento</span>
            <span className="text-right">Vencimento</span>
            <span className="text-right">Valor (R$)</span>
            <span className="text-right">Ações</span>
          </div>
          {conditions.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhuma condição definida. Use entrada + cartão, pix, boleto etc.
            </p>
          ) : (
            conditions.map((c, idx) => (
              <div
                key={c.id}
                className="grid grid-cols-[2rem_minmax(0,1fr)_6.5rem_7rem_4.5rem] items-center gap-1 border-b border-border/30 px-2 py-2.5 text-xs last:border-b-0 sm:grid-cols-[2.5rem_minmax(0,1fr)_7rem_8rem_5rem] sm:gap-2 sm:px-3 sm:text-sm"
              >
                <span className="text-muted-foreground">{idx + 1}</span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{paymentConditionDocumentLabel(c)}</p>
                  {c.notes.trim() ? (
                    <p className="truncate text-[11px] text-muted-foreground">{c.notes}</p>
                  ) : null}
                  {c.method === 'cartao_credito' && c.installments > 1 ? (
                    <p className="text-[11px] text-muted-foreground">
                      {c.installments}x de {formatBrl(c.amount / c.installments)}
                    </p>
                  ) : null}
                </div>
                <span className="text-right tabular-nums text-muted-foreground">
                  {c.dueDate
                    ? format(new Date(`${c.dueDate}T12:00:00`), 'dd/MM/yyyy')
                    : '—'}
                </span>
                <span className="text-right font-medium tabular-nums">
                  {formatBrl(c.amount)}
                </span>
                <div className="flex items-center justify-end gap-0.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={disabled}
                    title="Editar"
                    onClick={() => onEdit(c.id)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    disabled={disabled}
                    title="Remover"
                    onClick={() => onRemove(c.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
          <div className="space-y-1 border-t border-border/40 bg-muted/15 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">Total a pagar (R$)</span>
              <span className="text-sm font-semibold tabular-nums">{formatBrl(sum)}</span>
            </div>
            {planTotal > 0 ? (
              <p className="text-right text-[11px] text-muted-foreground">
                Plano: {formatBrl(planTotal)}
                {Math.abs(diff) >= 0.01
                  ? diff > 0
                    ? ` · ${formatBrl(diff)} a mais`
                    : ` · falta ${formatBrl(Math.abs(diff))}`
                  : ' · conferido'}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
