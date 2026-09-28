import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BUDGET_PAYMENT_METHOD_LABELS,
  formatBrl,
  formatMonthLabel,
  formatTreatmentTimeLabel,
} from '@/lib/budgetQuote';
import { runBudgetQuoteBillingNow } from '@/lib/budgetQuoteBilling';
import {
  fetchBudgetQuotePayments,
  fetchBudgetQuotesForProfessional,
  type BudgetQuotePaymentRow,
  type BudgetQuoteRow,
} from '@/services/api/budgetQuotesApi';
import { ExternalLink, Loader2, Send, Users } from 'lucide-react';
import { toast } from 'sonner';

function formatPhone(phone: string | null | undefined): string {
  if (!phone?.trim()) return 'Sem telefone';
  return phone.trim();
}

function currentMesBrazil(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  if (y && m) return `${y}-${m}`;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function pendingPaymentsForQuote(
  payments: BudgetQuotePaymentRow[],
  currentMes: string
): BudgetQuotePaymentRow[] {
  return payments.filter((p) => !p.data_pagamento && p.mes_referencia <= currentMes);
}

export function WhatsappBudgetQuoteBillingSection() {
  const { profile } = useAuth();
  const professionalId = profile?.id;
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [quotes, setQuotes] = useState<BudgetQuoteRow[]>([]);
  const [paymentsByQuote, setPaymentsByQuote] = useState<Record<string, BudgetQuotePaymentRow[]>>({});

  const mesAtual = useMemo(() => currentMesBrazil(), []);

  const load = async () => {
    if (!professionalId) return;
    setLoading(true);
    try {
      const list = await fetchBudgetQuotesForProfessional(professionalId);
      const accepted = list.filter((q) => q.status === 'accepted');
      const paysEntries = await Promise.all(
        accepted.map(async (q) => {
          const pays = await fetchBudgetQuotePayments(q.id);
          return [q.id, pays] as const;
        })
      );
      const map: Record<string, BudgetQuotePaymentRow[]> = {};
      for (const [id, pays] of paysEntries) map[id] = pays;
      setQuotes(accepted);
      setPaymentsByQuote(map);
    } catch {
      toast.error('Não foi possível carregar os orçamentos aceitos.');
      setQuotes([]);
      setPaymentsByQuote({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId]);

  const rows = useMemo(() => {
    return [...quotes]
      .map((q) => {
        const pending = pendingPaymentsForQuote(paymentsByQuote[q.id] || [], mesAtual);
        const totalPendente = pending.reduce((s, p) => s + Number(p.valor || 0), 0);
        return { quote: q, pending, totalPendente };
      })
      .sort((a, b) =>
        (a.quote.title || '').localeCompare(b.quote.title || '', 'pt-BR')
      );
  }, [quotes, paymentsByQuote, mesAtual]);

  const pendentesRows = useMemo(() => rows.filter((r) => r.pending.length > 0), [rows]);

  const handleSendPending = async () => {
    if (!professionalId) return;
    if (pendentesRows.length === 0) {
      toast.message('Nenhum orçamento com parcela pendente.');
      return;
    }
    setSending(true);
    try {
      const result = await runBudgetQuoteBillingNow(professionalId);
      if (!result.ok) {
        toast.error(result.error || 'Falha ao enviar cobranças.');
        return;
      }
      const sent = result.summary?.sent ?? 0;
      const errors = result.summary?.errors ?? 0;
      if (sent > 0) {
        toast.success(result.message || `${sent} cobrança(s) PIX enviada(s).`);
      } else {
        toast.message(result.message || 'Nenhuma cobrança enviada.');
      }
      if (errors > 0) {
        const first = result.summary?.errorPatients?.[0];
        toast.error(
          first
            ? `${errors} erro(s). Ex.: ${first.patientName}: ${first.error}`
            : `${errors} erro(s) no envio.`
        );
      }
      await load();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium leading-snug">Orçamentos aceitos</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Pacientes que aceitaram o orçamento
              {pendentesRows.length > 0 ? (
                <>
                  {' '}
                  ·{' '}
                  <span className="text-amber-700 dark:text-amber-300 font-medium">
                    {pendentesRows.length} com pendência
                  </span>
                </>
              ) : null}
              . A cobrança usa a chave PIX e a soma das parcelas em atraso.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={sending || loading || pendentesRows.length === 0}
            onClick={() => void handleSendPending()}
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {sending ? 'Enviando...' : 'Enviar cobrança aos pendentes'}
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
            <Link to="/orcamento">
              Abrir orçamentos
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando orçamentos...
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-2">
          Nenhum orçamento aceito ainda. Quando o paciente aceitar, ele aparece aqui.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border/60 overflow-hidden max-h-[360px] overflow-y-auto">
          {rows.map(({ quote: q, pending, totalPendente }) => {
            const name = q.patients?.full_name?.trim() || 'Paciente';
            const phone = formatPhone(q.patients?.phone);
            const pago = pending.length === 0;
            const dia = q.patient_payment_day;
            const method = q.patient_payment_method
              ? BUDGET_PAYMENT_METHOD_LABELS[q.patient_payment_method]
              : null;
            const treatmentLabel = formatTreatmentTimeLabel(
              q.accepted_treatment_time,
              q.accepted_treatment_time_unit
            );
            const monthsLabel =
              pending.length === 0
                ? ''
                : pending.length <= 3
                  ? pending.map((p) => formatMonthLabel(p.mes_referencia)).join(', ')
                  : `${pending
                      .slice(0, 2)
                      .map((p) => formatMonthLabel(p.mes_referencia))
                      .join(', ')} +${pending.length - 2}`;

            return (
              <li
                key={q.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-card/60 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 space-y-0.5">
                  <Link
                    to={`/patients/${q.patient_id}`}
                    className="text-sm font-medium text-foreground hover:underline truncate block"
                  >
                    {name}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate">
                    {q.title?.trim() ? `${q.title.trim()} · ` : ''}
                    {phone}
                    {dia != null ? ` · vence dia ${dia}` : ''}
                    {method ? ` · ${method}` : ''}
                    {treatmentLabel ? ` · ${treatmentLabel}` : ''}
                  </p>
                  {!pago ? (
                    <p className="text-xs text-amber-800/90 dark:text-amber-200/90">
                      {pending.length === 1 ? 'Mês pendente' : 'Meses pendentes'}: {monthsLabel}
                      {` · total ${formatBrl(totalPendente)}`}
                    </p>
                  ) : null}
                </div>
                <Badge
                  variant="secondary"
                  className={
                    pago
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 border-transparent'
                      : 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100 border-transparent'
                  }
                >
                  {pago ? 'Em dia' : `${pending.length} pendente(s)`}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
