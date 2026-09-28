import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  fetchReminder24hStatus,
  sendMissingReminder24h,
  type Reminder24hStatus,
} from '@/lib/appointmentRemindersApi';

type Props = {
  professionalId: string;
  enabled?: boolean;
  patientWord?: string;
};

export function Reminder24hStatusPanel({
  professionalId,
  enabled = true,
  patientWord = 'paciente',
}: Props) {
  const [status, setStatus] = useState<Reminder24hStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!professionalId || !enabled) return;
    setLoading(true);
    try {
      const result = await fetchReminder24hStatus(professionalId);
      if (!result.ok || !result.status) {
        toast.error(result.error || 'Não foi possível carregar o status dos lembretes.');
        return;
      }
      setStatus(result.status);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar lembretes.');
    } finally {
      setLoading(false);
    }
  }, [professionalId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSendMissing = async () => {
    if (!professionalId || !status?.pending) return;
    setSending(true);
    try {
      const pendingIds = status.items
        .filter((item) => item.status === 'pending')
        .flatMap((item) => item.appointmentIds);

      const result = await sendMissingReminder24h(professionalId, {
        date: status.date,
        appointmentIds: pendingIds,
      });

      if (!result.ok) {
        toast.error(result.error || 'Não foi possível enviar os lembretes faltantes.');
        return;
      }

      if (result.summary && result.summary.sent > 0) {
        const names = (result.summary.sentPatients ?? []).map((p) => p.patientName).join(', ');
        toast.success(result.message || `${result.summary.sent} lembrete(s) enviado(s).`, {
          description: names || undefined,
        });
      } else if (result.summary && result.summary.errors > 0) {
        const first = result.summary.errorPatients?.[0]?.error;
        toast.error(first || result.message || 'Falha ao enviar.');
      } else {
        toast.message(result.message || 'Nenhum lembrete pendente enviado.');
      }

      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar lembretes.');
    } finally {
      setSending(false);
    }
  };

  if (!enabled) return null;

  const pendingItems = status?.items.filter((i) => i.status === 'pending') ?? [];
  const noPhoneItems = status?.items.filter((i) => i.status === 'no_phone') ?? [];
  const allOk = status && status.total > 0 && status.pending === 0 && status.skippedNoPhone === 0;
  const hasGap = Boolean(status && status.pending > 0);

  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-3 space-y-3',
        hasGap
          ? 'border-amber-300/70 bg-amber-50/40 dark:border-amber-800/50 dark:bg-amber-950/20'
          : 'border-border/70 bg-background/70'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium leading-snug">Status dos lembretes 24h</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Consultas de amanhã ({status?.dateLabel || '…'}): quantas mensagens já saíram e quais
            faltam — útil quando o WhatsApp caiu no meio do envio.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => void load()}
          disabled={loading || sending}
          aria-label="Atualizar status dos lembretes"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {loading && !status ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : status ? (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              {status.sent}/{status.total}
            </p>
            <p className="text-sm text-muted-foreground">lembretes enviados</p>
            {allOk ? (
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Tudo certo
              </span>
            ) : null}
            {status.total === 0 ? (
              <span className="text-xs text-muted-foreground">
                Sem consultas amanhã
              </span>
            ) : null}
          </div>

          {hasGap ? (
            <div className="space-y-2">
              <p className="text-xs text-amber-900/90 dark:text-amber-100/90">
                {status.pending} de {status.total} ainda sem mensagem
                {status.skippedNoPhone > 0
                  ? ` · ${status.skippedNoPhone} sem telefone`
                  : ''}
                .
              </p>
              <ul className="max-h-36 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {pendingItems.map((item) => (
                  <li key={item.appointmentIds.join('-')} className="flex justify-between gap-2">
                    <span className="truncate font-medium text-foreground/90">
                      {item.patientName}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {item.startTime}
                      {item.endTime ? `–${item.endTime}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                disabled={sending || loading}
                onClick={() => void handleSendMissing()}
              >
                {sending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Enviar faltantes ({status.pending})
                  </>
                )}
              </Button>
            </div>
          ) : null}

          {!hasGap && noPhoneItems.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {noPhoneItems.length} {patientWord}
              {noPhoneItems.length === 1 ? '' : 's'} sem telefone — cadastre para enviar.
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Não foi possível carregar o status.</p>
      )}
    </div>
  );
}
