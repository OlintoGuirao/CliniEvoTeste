import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Copy, ExternalLink, Loader2, Send, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchPatients, PATIENTS_QUERY_KEY } from '@/api/patients';
import { ensureBudgetQuotePublicSlug, fetchBudgetQuote, getLinesFromRow } from '@/services/api/budgetQuotesApi';
import { formatBrl, grandTotal } from '@/lib/budgetQuote';
import { buildBudgetQuoteWhatsAppMessage, openWhatsAppWithFallback } from '@/lib/reportShare';
import { formatPhoneForWhatsApp } from '@/lib/evolutionPdf';
import { loadWhatsappManualTemplates } from '@/lib/loadWhatsappManualTemplates';
import { toast } from 'sonner';

const MODULE_KEY = 'orcamento';

function publicBudgetBaseUrl(): string {
  return (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');
}

export default function OrcamentoEnviarPage() {
  const { budgetId } = useParams<{ budgetId: string }>();
  const { profile } = useAuth();
  const professionalId = profile?.id ?? '';
  const disabled = (profile as { disabled_modules?: string[] | null } | null)?.disabled_modules;
  const isBlocked = Array.isArray(disabled) && disabled.includes(MODULE_KEY);
  const [slug, setSlug] = useState<string | null>(null);
  const [slugError, setSlugError] = useState(false);

  const { data: quote, isLoading: quoteLoading } = useQuery({
    queryKey: ['budget-quote', budgetId],
    queryFn: () => fetchBudgetQuote(budgetId!),
    enabled: !!budgetId && !isBlocked,
  });

  const { data: patients = [] } = useQuery({
    queryKey: [PATIENTS_QUERY_KEY, professionalId],
    queryFn: () => fetchPatients(professionalId),
    enabled: !!professionalId && !!quote,
  });

  const patient = useMemo(() => patients.find((p) => p.id === quote?.patient_id), [patients, quote]);

  const lines = quote ? getLinesFromRow(quote) : [];
  const total = grandTotal(lines);
  const publicUrl = slug ? `${publicBudgetBaseUrl()}/ro/${slug}` : '';

  useEffect(() => {
    if (!budgetId || !quote) return;
    let cancelled = false;
    setSlugError(false);
    void (async () => {
      try {
        const s = await ensureBudgetQuotePublicSlug(budgetId);
        if (!cancelled) setSlug(s);
      } catch {
        if (!cancelled) {
          setSlugError(true);
          toast.error('Não foi possível gerar o link público.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [budgetId, quote]);

  const copyLink = useCallback(async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Link copiado.');
    } catch {
      toast.error('Não foi possível copiar.');
    }
  }, [publicUrl]);

  const openWhatsApp = useCallback(async () => {
    const wa = formatPhoneForWhatsApp(patient?.phone);
    if (!wa) {
      toast.error('Cadastre o telefone do paciente na ficha para enviar pelo WhatsApp.');
      return;
    }
    if (!publicUrl) {
      toast.error('Aguarde o link ou tente recarregar.');
      return;
    }
    const templates = await loadWhatsappManualTemplates(professionalId);
    const entry = templates.budget_quote;
    if (!entry.enabled) {
      toast.message('Mensagem desativada em Mensagens padrão.');
      return;
    }
    const message = buildBudgetQuoteWhatsAppMessage({
      patientName: patient?.full_name,
      clinicName: profile?.app_name || profile?.full_name,
      budgetUrl: publicUrl,
      template: entry.message,
    });
    openWhatsAppWithFallback({ phone: wa, text: message });
    toast.success('Abrindo o WhatsApp…');
  }, [patient?.full_name, patient?.phone, professionalId, profile?.app_name, profile?.full_name, publicUrl]);

  if (isBlocked) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!budgetId) {
    return <Navigate to="/orcamento" replace />;
  }

  if (quoteLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        Carregando…
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Orçamento não encontrado.</p>
        <Button variant="link" asChild>
          <Link to="/orcamento">Voltar</Link>
        </Button>
      </div>
    );
  }

  const title = quote.title?.trim() || 'Orçamento';

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in max-w-xl mx-auto w-full">
      <PageBreadcrumb
        segments={[
          { label: 'Início', path: '/dashboard' },
          { label: 'Orçamentos', path: '/orcamento' },
          { label: 'Enviar' },
        ]}
        className="mb-1 hidden md:block"
      />

      <Button variant="ghost" size="sm" className="rounded-xl -ml-2" asChild>
        <Link to={`/orcamento/${budgetId}`}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar ao editor
        </Link>
      </Button>

      <Card className="rounded-2xl border-border/80 shadow-lg overflow-hidden">
        <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-background px-6 py-8 text-center border-b border-border/60">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Sparkles className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Enviar ao paciente</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            {title} · <span className="font-semibold text-foreground">{formatBrl(total)}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-2">{patient?.full_name ?? 'Paciente'}</p>
        </div>
        <CardHeader className="sr-only">
          <CardTitle>Link do orçamento</CardTitle>
          <CardDescription>Copie ou envie pelo WhatsApp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6 pb-8 px-6">
          {!slug && !slugError && (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin" />
              Gerando link seguro…
            </div>
          )}
          {slugError && (
            <p className="text-sm text-destructive text-center">Não foi possível obter o link. Tente novamente mais tarde.</p>
          )}
          {publicUrl && (
            <>
              <div className="rounded-xl border bg-muted/30 p-3 break-all text-xs font-mono text-muted-foreground leading-relaxed">
                {publicUrl}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="default" className="rounded-xl h-11" onClick={() => void copyLink()}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar link
                </Button>
                <Button type="button" variant="secondary" className="rounded-xl h-11" asChild>
                  <a href={publicUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Pré-visualizar
                  </a>
                </Button>
              </div>
              <Button type="button" className="w-full rounded-xl h-12 text-base" onClick={openWhatsApp}>
                <Send className="h-5 w-5 mr-2" />
                Enviar pelo WhatsApp
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
