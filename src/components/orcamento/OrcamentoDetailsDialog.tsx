import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  BUDGET_PAYMENT_METHOD_LABELS,
  formatBrl,
  formatMonthLabel,
  formatTreatmentTimeLabel,
  grandTotal,
} from '@/lib/budgetQuote';
import {
  fetchBudgetQuotePayments,
  getLinesFromRow,
  markBudgetQuotePaymentPaid,
  unmarkBudgetQuotePaymentPaid,
  type BudgetQuoteRow,
} from '@/services/api/budgetQuotesApi';
import { toast } from 'sonner';

export function OrcamentoDetailsDialog({
  quote,
  patientName,
  open,
  onOpenChange,
}: {
  quote: BudgetQuoteRow | null;
  patientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const quoteId = quote?.id;
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['budget-quote-payments', quoteId],
    queryFn: () => fetchBudgetQuotePayments(quoteId!),
    enabled: open && !!quoteId,
  });

  const total = useMemo(() => (quote ? grandTotal(getLinesFromRow(quote)) : 0), [quote]);
  const pago = useMemo(
    () => payments.filter((p) => p.data_pagamento).reduce((s, p) => s + Number(p.valor), 0),
    [payments]
  );
  const treatmentLabel = formatTreatmentTimeLabel(
    quote?.accepted_treatment_time,
    quote?.accepted_treatment_time_unit
  );

  const togglePaid = useCallback(
    async (paymentId: string, currentlyPaid: boolean) => {
      setTogglingId(paymentId);
      try {
        if (currentlyPaid) await unmarkBudgetQuotePaymentPaid(paymentId);
        else await markBudgetQuotePaymentPaid(paymentId);
        await queryClient.invalidateQueries({ queryKey: ['budget-quote-payments', quoteId] });
        toast.success(currentlyPaid ? 'Pagamento desmarcado.' : 'Pagamento registrado.');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erro ao atualizar pagamento.');
      } finally {
        setTogglingId(null);
      }
    },
    [queryClient, quoteId]
  );

  if (!quote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6">{quote.title?.trim() || 'Detalhes do orçamento'}</DialogTitle>
          <DialogDescription>
            {patientName}
            {quote.patient_payment_day != null ? ` · vence dia ${quote.patient_payment_day}` : ''}
            {quote.patient_payment_method
              ? ` · ${BUDGET_PAYMENT_METHOD_LABELS[quote.patient_payment_method]}`
              : ''}
            {treatmentLabel ? ` · ${treatmentLabel}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Pago / Total</span>
          <span className="font-semibold tabular-nums">
            {formatBrl(pago)} / {formatBrl(total)}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando parcelas…
          </div>
        ) : payments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma parcela gerada.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left font-semibold uppercase tracking-wide text-xs px-3 py-2.5">
                    Mês
                  </th>
                  <th className="text-right font-semibold uppercase tracking-wide text-xs px-3 py-2.5">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const paid = Boolean(p.data_pagamento);
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-3 py-2.5 font-medium">{formatMonthLabel(p.mes_referencia)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          {paid ? (
                            <span className="text-emerald-800 dark:text-emerald-300 font-semibold tabular-nums text-xs sm:text-sm">
                              {formatBrl(Number(p.valor))}
                            </span>
                          ) : null}
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className={cn(
                              'h-8 w-8 shrink-0',
                              paid &&
                                'border-emerald-400/70 bg-emerald-100/90 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/45 dark:text-emerald-200'
                            )}
                            disabled={togglingId === p.id}
                            title={paid ? 'Desmarcar pagamento' : 'Marcar como pago'}
                            aria-label={paid ? 'Desmarcar pagamento' : 'Marcar como pago'}
                            onClick={() => void togglePaid(p.id, paid)}
                          >
                            {togglingId === p.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <DollarSign className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
