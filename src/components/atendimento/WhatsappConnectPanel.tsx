import { RefreshCw, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type WhatsappConnectPanelProps = {
  connected: boolean;
  qr: string | null;
  loadingQr: boolean;
  checking: boolean;
  error?: string | null;
  onConnect: () => void;
  onRefresh: () => void;
  className?: string;
  compact?: boolean;
};

export function WhatsappConnectPanel({
  connected,
  qr,
  loadingQr,
  checking,
  error,
  onConnect,
  onRefresh,
  className,
  compact,
}: WhatsappConnectPanelProps) {
  if (connected) return null;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-emerald-300/70 bg-emerald-50/40 dark:border-emerald-800/60 dark:bg-emerald-950/20 p-6 text-center',
        className
      )}
    >
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">WhatsApp não conectado</p>
        <p className="text-sm text-muted-foreground max-w-md">
          {compact
            ? 'Conecte o WhatsApp da clínica para ver conversas e enviar mensagens.'
            : 'Escaneie o QR Code para conectar o número da clínica. Sem conexão, as conversas e promoções ficam ocultas.'}
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive max-w-md">{error}</p>
      ) : null}

      {qr ? (
        <div className="w-full max-w-[280px]">
          <img src={qr} alt="QR Code WhatsApp" className="w-full rounded-xl border bg-white p-2" />
          <p className="mt-2 text-xs text-muted-foreground">
            WhatsApp → Aparelhos conectados → Conectar aparelho
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={checking}
          onClick={() => void onRefresh()}
        >
          <RefreshCw className={cn('h-4 w-4', checking && 'animate-spin')} />
          Atualizar
        </Button>
        {!qr ? (
          <Button type="button" size="sm" className="gap-1.5" disabled={loadingQr} onClick={() => void onConnect()}>
            <QrCode className="h-4 w-4" />
            {loadingQr ? 'Gerando QR...' : 'Conectar WhatsApp'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
