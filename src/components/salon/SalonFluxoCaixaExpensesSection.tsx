import { useCallback, useState } from 'react';
import { addMonths, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DollarSign, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  useSalonCashExpenseMutations,
  type SalonCashExpenseKind,
  type SalonCashExpenseRow,
} from '@/hooks/use-salon-cash-expenses';
import {
  formatFluxoCurrency,
  getExpenseInstallmentPaymentStatus,
  resolveExpenseFocusInstallment,
} from '@/lib/fluxoCaixa';
import { cn } from '@/lib/utils';

function parseMoneyInput(s: string): number {
  const t = s.trim().replace(/\s/g, '');
  if (!t) return NaN;
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function formatYmdBr(ymd: string): string {
  return ymd.slice(0, 10).split('-').reverse().join('/');
}

function currentMonthValue(): string {
  return format(new Date(), 'yyyy-MM');
}

function monthValueFromDate(ymd: string): string {
  const raw = ymd.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(raw) ? raw : currentMonthValue();
}

function formatMonthReference(ymdOrMonth: string): string {
  const monthKey = ymdOrMonth.slice(0, 7);
  try {
    return format(parseISO(`${monthKey}-01`), "MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return monthKey;
  }
}

function endInstallmentLabel(startYmd: string, months: number): string | null {
  try {
    const start = parseISO(startYmd.slice(0, 10));
    if (Number.isNaN(start.getTime()) || months <= 1) return null;
    return format(addMonths(start, months - 1), 'dd/MM/yyyy');
  } catch {
    return null;
  }
}

type Props = {
  kind: SalonCashExpenseKind;
  title: string;
  description: string;
  rows: SalonCashExpenseRow[];
  total: number;
  dataInicio: string;
  dataFim: string;
  isLoading?: boolean;
};

export function SalonFluxoCaixaExpensesSection({
  kind,
  title,
  description,
  rows,
  total,
  dataInicio,
  dataFim,
  isLoading,
}: Props) {
  const isVariable = kind === 'variable';
  const { insert, update, remove, toggleInstallmentPaid } = useSalonCashExpenseMutations();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SalonCashExpenseRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SalonCashExpenseRow | null>(null);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [referenceMonth, setReferenceMonth] = useState(currentMonthValue);
  const [monthsStr, setMonthsStr] = useState('1');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setExpenseTitle('');
    setAmountStr('');
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setReferenceMonth(currentMonthValue());
    setMonthsStr('1');
    setNotes('');
    setEditing(null);
  }, []);

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (row: SalonCashExpenseRow) => {
    setEditing(row);
    setExpenseTitle(row.title);
    setAmountStr(String(row.amount).replace('.', ','));
    setExpenseDate(row.expense_date.slice(0, 10));
    setReferenceMonth(monthValueFromDate(row.expense_date));
    setMonthsStr(String(row.installment_months || 1));
    setNotes(row.notes ?? '');
    setDialogOpen(true);
  };

  const monthsPreview = (() => {
    const n = Math.floor(Number(monthsStr));
    if (!Number.isFinite(n) || n < 1) return null;
    return endInstallmentLabel(expenseDate, n);
  })();

  const handleTogglePaid = async (row: SalonCashExpenseRow) => {
    const installmentDate = resolveExpenseFocusInstallment(row, dataInicio, dataFim);
    if (!installmentDate) {
      toast.message('Nenhuma parcela neste período.');
      return;
    }
    setTogglingId(row.id);
    try {
      const nextStatus = getExpenseInstallmentPaymentStatus(row, installmentDate);
      await toggleInstallmentPaid.mutateAsync({
        id: row.id,
        installmentDate,
        paidDates: row.paid_installment_dates,
      });
      toast.success(
        nextStatus === 'paid'
          ? 'Parcela marcada como em aberto.'
          : 'Parcela marcada como paga.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível atualizar o pagamento.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleSave = async () => {
    const amount = parseMoneyInput(amountStr);
    if (!expenseTitle.trim()) {
      toast.error('Informe a descrição da despesa.');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error('Informe um valor válido.');
      return;
    }

    let nextDate = expenseDate;
    let months = 1;

    if (isVariable) {
      if (!/^\d{4}-\d{2}$/.test(referenceMonth)) {
        toast.error('Informe o mês de referência.');
        return;
      }
      nextDate = `${referenceMonth}-01`;
      months = 1;
    } else {
      months = Math.floor(Number(monthsStr));
      if (!expenseDate) {
        toast.error('Informe a data de início.');
        return;
      }
      if (!Number.isFinite(months) || months < 1 || months > 120) {
        toast.error('Informe a quantidade de meses (1 a 120).');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        expense_kind: kind,
        title: expenseTitle.trim(),
        amount,
        expense_date: nextDate,
        installment_months: months,
        notes: notes.trim() || null,
      };
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload });
        toast.success('Despesa atualizada.');
      } else {
        await insert.mutateAsync(payload);
        toast.success('Despesa adicionada.');
      }
      setDialogOpen(false);
      resetForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success('Despesa excluída.');
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível excluir.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          <p className="text-sm font-medium tabular-nums mt-1">
            Total no período: {formatFluxoCurrency(total)}
          </p>
        </div>
        <Button type="button" size="sm" className="gap-1.5" onClick={openNew}>
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Nenhuma despesa neste período.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const months = row.installment_months || 1;
            const endLabel = endInstallmentLabel(row.expense_date, months);
            const focusDate = resolveExpenseFocusInstallment(row, dataInicio, dataFim);
            const payStatus = getExpenseInstallmentPaymentStatus(row, focusDate);
            const payTitle =
              payStatus === 'paid'
                ? 'Pago — clique para desmarcar'
                : payStatus === 'overdue'
                  ? 'Atrasado — clique para marcar como pago'
                  : 'Em aberto — clique para marcar como pago';

            return (
              <li
                key={row.id}
                className="flex items-start justify-between gap-2 rounded-xl border bg-background px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{row.title}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {isVariable
                      ? formatMonthReference(row.expense_date)
                      : `${formatYmdBr(row.expense_date)}${
                          months > 1
                            ? ` · ${months}x${endLabel ? ` até ${endLabel}` : ''}`
                            : ''
                        }`}
                  </p>
                  {row.notes ? (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{row.notes}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-sm font-semibold tabular-nums mr-1 whitespace-nowrap">
                    {formatFluxoCurrency(row.amount)}
                    {months > 1 ? (
                      <span className="font-normal text-muted-foreground">/mês</span>
                    ) : null}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className={cn(
                      'h-6 w-6',
                      payStatus === 'paid' &&
                        'border-emerald-500/70 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 hover:text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
                      payStatus === 'overdue' &&
                        'border-red-500/70 bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800 dark:bg-red-950/50 dark:text-red-300'
                    )}
                    title={payTitle}
                    aria-label={
                      payStatus === 'paid' ? 'Pago' : payStatus === 'overdue' ? 'Atrasado' : 'Em aberto'
                    }
                    disabled={togglingId === row.id || !focusDate}
                    onClick={() => void handleTogglePaid(row)}
                  >
                    <DollarSign className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Editar"
                    onClick={() => openEdit(row)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    aria-label="Excluir"
                    onClick={() => setDeleteTarget(row)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? 'Editar despesa'
                : isVariable
                  ? 'Nova despesa variável'
                  : 'Nova despesa fixa'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor={`salon-exp-title-${kind}`}>Descrição</Label>
              <Input
                id={`salon-exp-title-${kind}`}
                value={expenseTitle}
                onChange={(e) => setExpenseTitle(e.target.value)}
                placeholder={
                  isVariable
                    ? 'Ex.: Conta de luz, marketing, manutenção...'
                    : 'Ex.: Aluguel, tablet, energia...'
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`salon-exp-amount-${kind}`}>
                {isVariable ? 'Valor (R$)' : 'Valor mensal (R$)'}
              </Label>
              <Input
                id={`salon-exp-amount-${kind}`}
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0,00"
              />
            </div>
            {isVariable ? (
              <div className="space-y-1.5">
                <Label htmlFor={`salon-exp-month-${kind}`}>Mês de referência</Label>
                <Input
                  id={`salon-exp-month-${kind}`}
                  type="month"
                  value={referenceMonth}
                  onChange={(e) => setReferenceMonth(e.target.value)}
                />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A despesa entra no fluxo de caixa desse mês.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`salon-exp-date-${kind}`}>Início</Label>
                    <Input
                      id={`salon-exp-date-${kind}`}
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`salon-exp-months-${kind}`}>Meses</Label>
                    <Input
                      id={`salon-exp-months-${kind}`}
                      type="number"
                      min={1}
                      max={120}
                      inputMode="numeric"
                      value={monthsStr}
                      onChange={(e) => setMonthsStr(e.target.value)}
                      placeholder="12"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ex.: tablet em 12x — valor da parcela e{' '}
                  <strong className="font-medium text-foreground">12</strong> meses.
                  {monthsPreview
                    ? ` Conta do início até ${monthsPreview}.`
                    : ' Com 1 mês, conta só na data informada.'}
                </p>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor={`salon-exp-notes-${kind}`}>Observações (opcional)</Label>
              <Textarea
                id={`salon-exp-notes-${kind}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Remover “${deleteTarget.title}” (${formatFluxoCurrency(deleteTarget.amount)}${
                    (deleteTarget.installment_months || 1) > 1
                      ? ` × ${deleteTarget.installment_months} meses`
                      : ''
                  }).`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
