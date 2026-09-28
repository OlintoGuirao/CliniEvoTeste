import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Phone, QrCode, RefreshCw, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WhatsappPairingByNumberPanel } from '@/components/whatsapp/WhatsappPairingByNumberPanel';
import { getChatbotApiBase } from '@/lib/programaBotoxBilling';
import { cn } from '@/lib/utils';

type EvolutionPayload = {
  connected?: boolean;
  qr?: string | null;
  instanceId?: string;
  error?: string;
};

type Props = {
  professionalId: string;
  className?: string;
};

type ConnectMode = 'qr' | 'phone';

const TUTORIAL_STEPS = [
  'No celular, abra o WhatsApp (o mesmo número da clínica/consultório).',
  'Toque em Mais opções (⋮) ou Configurações.',
  'Entre em Aparelhos conectados → Conectar um aparelho.',
  'Aponte a câmera para o QR Code desta tela.',
  'Aguarde a confirmação “conectado” — lembretes e secretária voltam a funcionar.',
] as const;

export function DashboardWhatsAppDisconnectedAlert({ professionalId, className }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<ConnectMode>('qr');
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const statusInFlight = useRef(false);
  const pairingActive = useRef(false);

  const apiBase = getChatbotApiBase();

  const applyPayload = useCallback((data: EvolutionPayload, opts?: { keepQr?: boolean }) => {
    const isConnected = Boolean(data?.connected);
    setConnected(isConnected);
    if (isConnected) {
      setQr(null);
      pairingActive.current = false;
      return true;
    }
    if (typeof data?.qr === 'string' && data.qr && !opts?.keepQr) {
      setQr(data.qr);
      pairingActive.current = true;
    }
    return false;
  }, []);

  const refreshStatus = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!professionalId || !apiBase) return false;
      if (statusInFlight.current) return false;
      statusInFlight.current = true;
      if (!opts?.silent) setLoadingStatus(true);
      try {
        let res = await fetch(`${apiBase}/evolution/status/${professionalId}`);
        let data: EvolutionPayload | null = null;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('json')) data = await res.json();

        if (res.status === 404 || !data) {
          res = await fetch(`${apiBase}/evolution/qr/${professionalId}`);
          const ct2 = res.headers.get('content-type') || '';
          if (ct2.includes('json')) data = await res.json();
        }

        if (!data || !res.ok) {
          if (!opts?.silent) {
            toast.error(
              typeof data?.error === 'string' ? data.error : 'Não foi possível verificar o WhatsApp'
            );
          }
          setConnected(false);
          return false;
        }

        const wasConnected = applyPayload(data, { keepQr: opts?.silent });
        if (wasConnected && pairingActive.current) {
          pairingActive.current = false;
          toast.success('WhatsApp conectado com sucesso!');
          setDialogOpen(false);
        } else if (wasConnected) {
          setDialogOpen(false);
        }
        return wasConnected;
      } catch (e) {
        if (!opts?.silent) {
          toast.error(e instanceof Error ? e.message : 'Erro ao verificar WhatsApp');
        }
        setConnected(false);
        return false;
      } finally {
        statusInFlight.current = false;
        if (!opts?.silent) setLoadingStatus(false);
      }
    },
    [professionalId, apiBase, applyPayload]
  );

  const requestQr = useCallback(
    async (opts?: { forceRestart?: boolean }) => {
      if (!professionalId || !apiBase) {
        toast.error('API do chatbot não configurada.');
        return;
      }
      setLoadingQr(true);
      try {
        const qs = opts?.forceRestart ? '?forceRestart=1' : '';
        const res = await fetch(`${apiBase}/evolution/qr/${professionalId}${qs}`);
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('json')) {
          throw new Error('Resposta inválida do servidor. Atualize o backend e tente de novo.');
        }
        const data = (await res.json()) as EvolutionPayload;
        if (!res.ok) throw new Error(data?.error || 'Falha ao gerar QR Code');

        const isConnected = applyPayload(data);
        if (isConnected) {
          toast.success('WhatsApp já está conectado.');
          setDialogOpen(false);
          return;
        }
        if (!data?.qr) {
          toast.message('QR Code indisponível. Tente atualizar em alguns segundos.');
          return;
        }
        pairingActive.current = true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Não foi possível gerar o QR Code');
        setQr(null);
      } finally {
        setLoadingQr(false);
      }
    },
    [professionalId, apiBase, applyPayload]
  );

  useEffect(() => {
    if (!professionalId) return;
    void refreshStatus({ silent: true });
    const timer = window.setInterval(() => {
      if (!dialogOpen) void refreshStatus({ silent: true });
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [professionalId, refreshStatus, dialogOpen]);

  useEffect(() => {
    if (!dialogOpen || connected) return;
    const tick = () => void refreshStatus({ silent: true });
    tick();
    const timer = window.setInterval(tick, 2500);
    return () => window.clearInterval(timer);
  }, [dialogOpen, connected, refreshStatus]);

  const openConnectDialog = async () => {
    setMode('qr');
    setDialogOpen(true);
    await requestQr();
  };

  if (!professionalId || !apiBase) return null;
  if (connected !== false) return null;

  return (
    <>
      <div
        className={cn(
          'flex flex-col gap-3 rounded-xl border border-amber-300/80 bg-amber-50/70 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 dark:border-amber-800/60 dark:bg-amber-950/25',
          className
        )}
        role="alert"
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
              WhatsApp desconectado
            </p>
            <p className="text-xs leading-relaxed text-amber-900/85 dark:text-amber-200/85">
              Lembretes, secretária e confirmações ficam pausados até reconectar o número.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-10 w-full shrink-0 gap-1.5 sm:w-auto"
          disabled={loadingQr}
          onClick={() => void openConnectDialog()}
        >
          {loadingQr ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Abrindo…
            </>
          ) : (
            <>
              <QrCode className="h-4 w-4" />
              Conectar agora
            </>
          )}
        </Button>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            pairingActive.current = false;
            setMode('qr');
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Conectar WhatsApp
            </DialogTitle>
            <DialogDescription>
              Use o QR Code ou, se não funcionar, conecte pelo número com um código no celular.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-1.5 rounded-lg border bg-muted/40 p-1">
            <Button
              type="button"
              size="sm"
              variant={mode === 'qr' ? 'default' : 'ghost'}
              className="h-9 gap-1.5"
              onClick={() => {
                setMode('qr');
                if (!qr) void requestQr();
              }}
            >
              <QrCode className="h-4 w-4" />
              QR Code
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'phone' ? 'default' : 'ghost'}
              className="h-9 gap-1.5"
              onClick={() => setMode('phone')}
            >
              <Phone className="h-4 w-4" />
              Por número
            </Button>
          </div>

          {mode === 'qr' ? (
            <>
              <div className="flex flex-col items-center gap-3 py-1">
                {loadingQr && !qr ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
                    <RefreshCw className="h-8 w-8 animate-spin" />
                    Gerando QR Code…
                  </div>
                ) : qr ? (
                  <>
                    <div className="w-full max-w-[280px]">
                      <img
                        src={qr}
                        alt="QR Code WhatsApp"
                        className="h-auto w-full rounded-lg border bg-white"
                      />
                    </div>
                    <p className="flex items-center gap-1.5 text-center text-xs text-muted-foreground">
                      <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                      Aguardando leitura no celular…
                    </p>
                  </>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    QR Code indisponível. Toque em Atualizar QR ou use Por número.
                  </p>
                )}
              </div>

              <div className="rounded-xl border bg-muted/30 px-3.5 py-3 space-y-2.5">
                <p className="text-sm font-medium">Como conectar no celular</p>
                <ol className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                  {TUTORIAL_STEPS.map((step, index) => (
                    <li key={step} className="flex gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                        {index + 1}
                      </span>
                      <span className="pt-0.5 text-foreground/85">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                  Fechar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  disabled={loadingQr || loadingStatus}
                  onClick={() => void requestQr({ forceRestart: true })}
                >
                  {loadingQr ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Atualizando…
                    </>
                  ) : (
                    'Atualizar QR'
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <WhatsappPairingByNumberPanel
                professionalId={professionalId}
                onConnected={() => {
                  setConnected(true);
                  setDialogOpen(false);
                }}
              />
              <div className="flex justify-end">
                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                  Fechar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
