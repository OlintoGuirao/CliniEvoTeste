import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  buildMonthRange,
  fetchPagamentos,
  fetchProgramasBotox,
  formatMonthLabel,
  monthKeyFromDate,
  monthKeyFromIso,
  totalPagoNoMes,
  type PagamentoRow,
  type ProgramaBotoxRow,
} from '@/lib/programaBotox';
import { runBotoxBillingTestNow } from '@/lib/programaBotoxBilling';
import { ExternalLink, Loader2, Send, Users } from 'lucide-react';
import { toast } from 'sonner';

function formatPhone(phone: string | null | undefined): string {
  if (!phone?.trim()) return 'Sem telefone';
  return phone.trim();
}

function pendingMonthsForPrograma(p: ProgramaBotoxRow, pagamentos: PagamentoRow[], currentMes: string): string[] {
  const startPrograma = monthKeyFromIso(p.data_inicio);
  const startGroup = p.botox_groups?.period_start ? monthKeyFromIso(p.botox_groups.period_start) : null;
  const endGroup = p.botox_groups?.period_end ? monthKeyFromIso(p.botox_groups.period_end) : null;

  // Grupo de outro profissional → não listar (vazamento pós-cópia)
  if (p.botox_groups?.professional_id && p.botox_groups.professional_id !== p.professional_id) {
    return [];
  }

  let startKey = startPrograma || startGroup || currentMes;
  if (startGroup && startKey < startGroup) startKey = startGroup;

  // Até o mês vigente, sem ultrapassar o fim do grupo (grupos encerrados ainda mostram atrasos)
  let endKey = currentMes;
  if (endGroup && endKey > endGroup) endKey = endGroup;
  if (endKey < startKey) return [];

  return buildMonthRange(startKey, endKey).filter((mesKey) => totalPagoNoMes(pagamentos, p.id, mesKey) <= 0);
}

export function WhatsappBotoxBillingPatientsSection() {
  const { profile } = useAuth();
  const professionalId = profile?.id;
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [programas, setProgramas] = useState<ProgramaBotoxRow[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoRow[]>([]);

  const mesAtual = useMemo(() => {
    // Alinha com o backend (America/Sao_Paulo)
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    if (y && m) return `${y}-${m}`;
    return monthKeyFromDate(new Date());
  }, []);

  const load = async () => {
    if (!professionalId) return;
    setLoading(true);
    try {
      const list = await fetchProgramasBotox(professionalId);
      const ativos = list.filter((p) => p.status === 'ativo');
      const pays = await fetchPagamentos(ativos.map((p) => p.id));
      setProgramas(ativos);
      setPagamentos(pays);
    } catch {
      toast.error('Não foi possível carregar os pacientes do Programa de Botox.');
      setProgramas([]);
      setPagamentos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId]);

  const rows = useMemo(() => {
    return [...programas]
      .map((p) => {
        const pending = pendingMonthsForPrograma(p, pagamentos, mesAtual);
        return { programa: p, pending };
      })
      .sort((a, b) =>
        (a.programa.patients?.full_name ?? '').localeCompare(b.programa.patients?.full_name ?? '', 'pt-BR')
      );
  }, [programas, pagamentos, mesAtual]);

  const pendentesRows = useMemo(() => rows.filter((r) => r.pending.length > 0), [rows]);

  const handleSendPending = async () => {
    if (!professionalId) return;
    if (pendentesRows.length === 0) {
      toast.message('Nenhum paciente com mensalidade pendente.');
      return;
    }
    setSending(true);
    try {
      const result = await runBotoxBillingTestNow(professionalId);
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
            <p className="text-sm font-medium leading-snug">Pacientes no Programa de Botox</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ativos vinculados ao programa
              {pendentesRows.length > 0 ? (
                <>
                  {' '}
                  ·{' '}
                  <span className="text-amber-700 dark:text-amber-300 font-medium">
                    {pendentesRows.length} com pendência
                  </span>
                </>
              ) : null}
              . A cobrança usa a chave PIX cadastrada e o valor da mensalidade × meses em atraso.
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
            <Link to="/programa-botox">
              Abrir programa
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando pacientes...
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-2">
          Nenhum paciente ativo no Programa de Botox. Cadastre no menu Programa de Botox.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border/60 overflow-hidden max-h-[360px] overflow-y-auto">
          {rows.map(({ programa: p, pending }) => {
            const name = p.patients?.full_name?.trim() || 'Paciente sem nome';
            const phone = formatPhone(p.patients?.phone);
            const pago = pending.length === 0;
            const dia = p.dia_vencimento != null && p.dia_vencimento > 0 ? p.dia_vencimento : null;
            const valor = Number(p.valor_mensalidade) > 0 ? Number(p.valor_mensalidade) : 150;
            const totalPendente = Number((valor * pending.length).toFixed(2));
            const monthsLabel =
              pending.length === 0
                ? ''
                : pending.length <= 3
                  ? pending.map(formatMonthLabel).join(', ')
                  : `${pending.slice(0, 2).map(formatMonthLabel).join(', ')} +${pending.length - 2}`;

            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-card/60 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 space-y-0.5">
                  <Link
                    to={`/patients/${p.paciente_id}`}
                    className="text-sm font-medium text-foreground hover:underline truncate block"
                  >
                    {name}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate">
                    {phone}
                    {dia != null ? ` · vence dia ${dia}` : ''}
                    {` · mensalidade R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  </p>
                  {!pago ? (
                    <p className="text-xs text-amber-800/90 dark:text-amber-200/90">
                      {pending.length === 1 ? 'Mês pendente' : 'Meses pendentes'}: {monthsLabel}
                      {` · total ${totalPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
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
