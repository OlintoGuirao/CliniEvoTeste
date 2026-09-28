import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Receipt, Loader2, Pencil, Send, Trash2, ListChecks } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchPatients, PATIENTS_QUERY_KEY } from '@/api/patients';
import {
  fetchBudgetQuotesForProfessional,
  deleteBudgetQuote,
  getLinesFromRow,
  type BudgetQuoteRow,
} from '@/services/api/budgetQuotesApi';
import { formatBrl, grandTotal } from '@/lib/budgetQuote';
import { OrcamentoDetailsDialog } from '@/components/orcamento/OrcamentoDetailsDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useCallback, useMemo, useState } from 'react';
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

const MODULE_KEY = 'orcamento';

export default function OrcamentoListPage() {
  const { profile } = useAuth();
  const professionalId = profile?.id ?? '';
  const disabled = (profile as { disabled_modules?: string[] | null } | null)?.disabled_modules;
  const isBlocked = Array.isArray(disabled) && disabled.includes(MODULE_KEY);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailsQuote, setDetailsQuote] = useState<BudgetQuoteRow | null>(null);

  const { data: patients = [] } = useQuery({
    queryKey: [PATIENTS_QUERY_KEY, professionalId],
    queryFn: () => fetchPatients(professionalId),
    enabled: !!professionalId,
  });

  const { data: quotes = [], isLoading, refetch } = useQuery({
    queryKey: ['budget-quotes', professionalId],
    queryFn: () => fetchBudgetQuotesForProfessional(professionalId),
    enabled: !!professionalId,
  });

  const patientNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of patients) m.set(p.id, p.full_name);
    return m;
  }, [patients]);

  const onConfirmDelete = useCallback(async () => {
    if (!deleteId) return;
    try {
      await deleteBudgetQuote(deleteId);
      toast.success('Orçamento excluído.');
      void refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir.');
    } finally {
      setDeleteId(null);
    }
  }, [deleteId, refetch]);

  if (isBlocked) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <PageBreadcrumb
        segments={[
          { label: 'Início', path: '/dashboard' },
          { label: 'Orçamentos' },
        ]}
        className="mb-1 hidden md:block"
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Receipt className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Orçamentos</h1>
            <p className="text-sm text-muted-foreground">Monte linhas com procedimentos e envie o link ao paciente.</p>
          </div>
        </div>
        <Button asChild className="rounded-xl shrink-0 w-full lg:w-auto">
          <Link to="/orcamento/novo">
            <Plus className="h-4 w-4 mr-2" />
            Novo orçamento
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span>Carregando…</span>
        </div>
      ) : quotes.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardHeader>
            <CardTitle className="text-lg">Nenhum orçamento ainda</CardTitle>
            <CardDescription>Crie o primeiro para aparecer aqui.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="rounded-xl">
              <Link to="/orcamento/novo">Criar orçamento</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quotes.map((q) => {
            const lines = getLinesFromRow(q);
            const total = grandTotal(lines);
            const pName = patientNameById.get(q.patient_id) ?? 'Paciente';
            const title = q.title?.trim() || 'Sem título';
            const date = new Date(q.updated_at).toLocaleString('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short',
            });
            const isAccepted = q.status === 'accepted';
            const isRejected = q.status === 'rejected';
            const responded = isAccepted || isRejected;

            return (
              <Card
                key={q.id}
                className={cn(
                  'rounded-2xl shadow-sm overflow-hidden border-border/80',
                  isAccepted &&
                    'border-emerald-400/70 bg-emerald-50/40 dark:border-emerald-700 dark:bg-emerald-950/25',
                  isRejected &&
                    'border-amber-400/60 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/20'
                )}
              >
                <CardHeader className="pb-2 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold line-clamp-2">{title}</CardTitle>
                    {isAccepted && (
                      <Badge className="shrink-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 border-transparent">
                        Aceito
                      </Badge>
                    )}
                    {isRejected && (
                      <Badge className="shrink-0 bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100 border-transparent">
                        Recusado
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">
                    {pName} · {date}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-lg font-bold text-primary tabular-nums">{formatBrl(total)}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" className="rounded-lg" asChild>
                      <Link to={`/orcamento/${q.id}`}>
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Editar
                      </Link>
                    </Button>
                    {!responded && (
                      <Button variant="default" size="sm" className="rounded-lg" asChild>
                        <Link to={`/orcamento/enviar/${q.id}`}>
                          <Send className="h-3.5 w-3.5 mr-1.5" />
                          Enviar
                        </Link>
                      </Button>
                    )}
                    {isAccepted && (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => setDetailsQuote(q)}
                      >
                        <ListChecks className="h-3.5 w-3.5 mr-1.5" />
                        Detalhes do orçamento
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg text-destructive hover:text-destructive"
                      type="button"
                      onClick={() => setDeleteId(q.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <OrcamentoDetailsDialog
        quote={detailsQuote}
        patientName={detailsQuote ? patientNameById.get(detailsQuote.patient_id) ?? 'Paciente' : ''}
        open={Boolean(detailsQuote)}
        onOpenChange={(o) => !o && setDetailsQuote(null)}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O link público deixará de funcionar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground" onClick={() => void onConfirmDelete()}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
