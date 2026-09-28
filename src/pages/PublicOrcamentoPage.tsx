import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, FileQuestion, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import {
  BUDGET_PAYMENT_METHOD_LABELS,
  formatBrl,
  formatTreatmentTimeLabel,
  grandTotal,
  lineTotal,
  parsePublicPayload,
  type BudgetPaymentMethod,
  type BudgetQuoteLine,
  type BudgetTreatmentTimeUnit,
} from '@/lib/budgetQuote';
import { publicAcceptBudgetQuote, publicRejectBudgetQuote } from '@/services/api/budgetQuotesApi';
import { resolvePublicPrimary } from '@/lib/publicBrand';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function parsePayload(raw: Json): ReturnType<typeof parsePublicPayload> {
  return parsePublicPayload(raw);
}

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return `rgba(106, 13, 173, ${alpha})`;
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function contrastOnColor(hex: string): string {
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '#FFFFFF';
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? '#111827' : '#FFFFFF';
}

const UNIT_OPTIONS: Array<{ value: BudgetTreatmentTimeUnit; label: string }> = [
  { value: 'meses', label: 'Meses' },
  { value: 'sessoes', label: 'Sessões' },
];

const METHOD_OPTIONS = (Object.keys(BUDGET_PAYMENT_METHOD_LABELS) as BudgetPaymentMethod[]).map((v) => ({
  value: v,
  label: BUDGET_PAYMENT_METHOD_LABELS[v],
}));

export default function PublicOrcamentoPage() {
  const { slug: slugParam } = useParams<{ slug: string }>();
  const slug = slugParam?.trim() ?? '';
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<ReturnType<typeof parsePublicPayload>>(null);
  const [error, setError] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [paymentDay, setPaymentDay] = useState('5');
  const [paymentMethod, setPaymentMethod] = useState<BudgetPaymentMethod | ''>('');
  const [treatmentTime, setTreatmentTime] = useState('');
  const [treatmentUnit, setTreatmentUnit] = useState<BudgetTreatmentTimeUnit | ''>('');

  useEffect(() => {
    if (!slug) {
      setError(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(false);
      const { data, error: rpcError } = await supabase.rpc('get_public_budget_quote', { p_slug: slug });
      if (cancelled) return;
      if (rpcError || data == null) {
        setPayload(null);
        setError(true);
        setLoading(false);
        return;
      }
      const parsed = parsePayload(data as Json);
      if (!parsed) {
        setPayload(null);
        setError(true);
      } else {
        setPayload(parsed);
        if (parsed.treatment_time != null) setTreatmentTime(String(parsed.treatment_time));
        if (parsed.treatment_time_unit) setTreatmentUnit(parsed.treatment_time_unit);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const primary = resolvePublicPrimary({
    themePalette: payload?.professional?.theme_palette ?? null,
    accentColor: payload?.professional?.accent_color ?? null,
    fallback: '#6A0DAD',
  });
  const onPrimary = contrastOnColor(primary);
  const softPrimary = withAlpha(primary, 0.08);
  const softPrimaryStrong = withAlpha(primary, 0.14);
  const borderPrimary = withAlpha(primary, 0.28);
  const clinicName = payload?.professional?.app_name?.trim() || payload?.professional?.full_name?.trim() || 'Clínica';
  const professionalName = payload?.professional?.full_name?.trim() || clinicName;
  const lines: BudgetQuoteLine[] = payload?.lines ?? [];
  const total = useMemo(() => grandTotal(lines), [lines]);
  const updatedLabel = useMemo(() => {
    if (!payload?.updated_at) return null;
    try {
      return new Date(payload.updated_at).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
    } catch {
      return null;
    }
  }, [payload?.updated_at]);

  const isOpen = payload?.status === 'open';

  const reload = async () => {
    const { data } = await supabase.rpc('get_public_budget_quote', { p_slug: slug });
    if (data) setPayload(parsePayload(data as Json));
  };

  const handleReject = async () => {
    setSubmitting(true);
    setActionError(null);
    try {
      await publicRejectBudgetQuote(slug);
      setRejectOpen(false);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Não foi possível recusar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async () => {
    const day = Number(paymentDay);
    const time = Number(treatmentTime);
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      setActionError('Informe o melhor dia de pagamento (1 a 28).');
      return;
    }
    if (!paymentMethod) {
      setActionError('Selecione a forma de pagamento.');
      return;
    }
    if (!Number.isInteger(time) || time < 1) {
      setActionError('Informe o tempo de tratamento (número inteiro).');
      return;
    }
    if (treatmentUnit !== 'meses' && treatmentUnit !== 'sessoes') {
      setActionError('Selecione meses ou sessões.');
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      await publicAcceptBudgetQuote({
        slug,
        paymentDay: day,
        paymentMethod,
        treatmentTime: time,
        treatmentTimeUnit: treatmentUnit,
      });
      setAcceptOpen(false);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Não foi possível aceitar.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F9F9F9] p-4">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">Carregando orçamento…</p>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F9F9F9] p-4">
        <FileQuestion className="h-14 w-14 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-semibold text-foreground">Link inválido ou indisponível</h1>
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Este orçamento não existe ou não está mais disponível. Peça um novo link ao seu profissional.
        </p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-12 pt-6 px-3 sm:px-4"
      style={{
        backgroundImage: `linear-gradient(to bottom, ${withAlpha(primary, 0.12)} 0%, ${withAlpha(primary, 0.03)} 45%, #F9F9F9 100%)`,
      }}
    >
      <div className="mx-auto max-w-2xl w-full space-y-6">
        <header className="flex flex-col items-center text-center gap-3">
          {payload.professional?.app_logo_url ? (
            <div className="h-16 w-16 rounded-2xl bg-white shadow-md flex items-center justify-center overflow-hidden p-2">
              <img src={payload.professional.app_logo_url} alt="" className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <div
              className="h-14 w-14 rounded-2xl shadow-md flex items-center justify-center text-xl font-bold"
              style={{ backgroundColor: primary, color: onPrimary }}
            >
              {clinicName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Orçamento</p>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{clinicName}</h1>
            {payload.patient?.full_name && (
              <p className="text-sm text-muted-foreground mt-1">Para {payload.patient.full_name}</p>
            )}
          </div>
        </header>

        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden" style={{ borderColor: borderPrimary }}>
          {payload.title && (
            <div className="px-4 py-3 border-b" style={{ backgroundColor: softPrimary }}>
              <p className="font-semibold text-foreground">{payload.title}</p>
            </div>
          )}
          {(() => {
            const treatmentLabel = formatTreatmentTimeLabel(payload.treatment_time, payload.treatment_time_unit);
            if (!treatmentLabel) return null;
            return (
              <div
                className="px-4 py-2.5 border-b text-sm flex flex-wrap items-baseline justify-between gap-2"
                style={{ borderColor: borderPrimary, backgroundColor: softPrimaryStrong }}
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tempo de tratamento
                </span>
                <span className="font-medium text-foreground tabular-nums">{treatmentLabel}</span>
              </div>
            );
          })()}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[320px]">
              <thead>
                <tr className="border-b" style={{ borderColor: borderPrimary }}>
                  <th className="text-left text-xs font-bold uppercase tracking-wide px-3 py-3 w-12 text-muted-foreground">
                    Qtd.
                  </th>
                  <th className="text-left text-xs font-bold uppercase tracking-wide px-2 py-3 text-muted-foreground">
                    Discriminação
                  </th>
                  <th
                    className="text-center text-xs font-bold uppercase tracking-wide px-0 py-0 w-[40%]"
                    colSpan={2}
                    style={{ backgroundColor: primary, color: '#fff' }}
                  >
                    Preço
                  </th>
                </tr>
                <tr
                  className="border-b text-[10px] uppercase tracking-wide text-muted-foreground"
                  style={{ borderColor: borderPrimary, backgroundColor: softPrimaryStrong }}
                >
                  <th colSpan={2} className="p-0" />
                  <th className="text-right font-semibold px-2 py-2 w-[18%]">Unit.</th>
                  <th className="text-right font-semibold px-3 py-2 w-[18%]">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="border-b last:border-0" style={{ borderColor: withAlpha(primary, 0.15) }}>
                    <td className="px-3 py-3 tabular-nums text-right align-top text-foreground">{line.quantity}</td>
                    <td className="px-2 py-3 align-top text-foreground">{line.procedure_name || '—'}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-muted-foreground align-top">
                      {formatBrl(line.unit_price)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums align-top" style={{ color: primary }}>
                      {formatBrl(lineTotal(line))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className="flex items-center justify-between gap-4 px-4 py-4"
            style={{ backgroundColor: primary, color: onPrimary }}
          >
            <span className="text-sm font-bold uppercase tracking-wide">Total geral</span>
            <span className="text-xl font-bold tabular-nums">{formatBrl(total)}</span>
          </div>
        </div>

        {payload.notes?.trim() && (
          <div
            className="rounded-2xl border bg-white/90 p-4 text-sm text-muted-foreground shadow-sm"
            style={{ borderColor: borderPrimary, backgroundColor: withAlpha(primary, 0.04) }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground mb-2">Observações</p>
            <p className="whitespace-pre-wrap text-pretty">{payload.notes.trim()}</p>
          </div>
        )}

        {isOpen ? (
          <div
            className="rounded-xl border p-4 sm:p-5 shadow-sm"
            style={{ borderColor: borderPrimary, backgroundColor: softPrimary }}
          >
            <p className="text-center text-sm font-medium mb-4" style={{ color: primary }}>
              Esse é o seu orçamento que você solicitou para o {professionalName}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                className="flex-1 h-10"
                style={{ backgroundColor: primary, color: onPrimary }}
                onClick={() => {
                  setActionError(null);
                  setAcceptOpen(true);
                }}
              >
                <Check className="h-4 w-4 mr-1.5" />
                Aceitar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-10"
                style={{ borderColor: withAlpha(primary, 0.35), color: primary }}
                onClick={() => {
                  setActionError(null);
                  setRejectOpen(true);
                }}
              >
                <X className="h-4 w-4 mr-1.5" />
                Recusar
              </Button>
            </div>
          </div>
        ) : payload.status === 'accepted' ? (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-900">
            Orçamento aceito. O profissional foi notificado e acompanhará as parcelas.
          </div>
        ) : (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950">
            Orçamento recusado. O profissional foi notificado.
          </div>
        )}

        {updatedLabel && (
          <p className="text-center text-xs text-muted-foreground">Atualizado em {updatedLabel}</p>
        )}
      </div>

      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Concluir aceite</DialogTitle>
            <DialogDescription>
              Confirme o melhor dia de pagamento, a forma e o tempo de tratamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="bq-pay-day">Melhor dia de pagamento</Label>
              <Input
                id="bq-pay-day"
                type="number"
                min={1}
                max={28}
                step={1}
                className="rounded-xl"
                value={paymentDay}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '' || /^\d{1,2}$/.test(raw)) setPaymentDay(raw);
                }}
              />
              <p className="text-xs text-muted-foreground">Dia de 1 a 28 de cada mês.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bq-pay-method">Forma de pagamento</Label>
              <Select
                value={paymentMethod || undefined}
                onValueChange={(v) => setPaymentMethod(v as BudgetPaymentMethod)}
              >
                <SelectTrigger id="bq-pay-method" className="rounded-xl h-11">
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {METHOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bq-acc-time">Tempo de tratamento</Label>
                <Input
                  id="bq-acc-time"
                  type="number"
                  min={1}
                  step={1}
                  className="rounded-xl"
                  value={treatmentTime}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '' || /^\d+$/.test(raw)) setTreatmentTime(raw);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bq-acc-unit">Unidade</Label>
                <Select
                  value={treatmentUnit || undefined}
                  onValueChange={(v) => setTreatmentUnit(v as BudgetTreatmentTimeUnit)}
                >
                  <SelectTrigger id="bq-acc-unit" className="rounded-xl h-11">
                    <SelectValue placeholder="Meses ou sessões" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {actionError && <p className="text-sm text-destructive">{actionError}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="rounded-xl" disabled={submitting} onClick={() => setAcceptOpen(false)}>
              Voltar
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              style={{ backgroundColor: primary, color: onPrimary }}
              disabled={submitting}
              onClick={() => void handleAccept()}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar aceite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Recusar este orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O profissional será notificado. Você não poderá aceitar este mesmo link depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionError && <p className="text-sm text-destructive px-1">{actionError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={submitting}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground"
              disabled={submitting}
              onClick={(e) => {
                e.preventDefault();
                void handleReject();
              }}
            >
              {submitting ? 'Recusando…' : 'Recusar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
