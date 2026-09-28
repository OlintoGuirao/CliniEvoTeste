import { useState } from 'react';
import { Phone, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getChatbotApiBase } from '@/lib/programaBotoxBilling';

const PHONE_TUTORIAL = [
  'Abra o WhatsApp no celular deste número.',
  'Vá em Aparelhos conectados → Conectar um aparelho.',
  'Toque em Vincular com número de telefone (em vez de escanear o QR).',
  'Digite o código que aparece nesta tela (ele expira em cerca de 1 minuto).',
] as const;

function formatPairingCodeDisplay(code: string): string {
  const clean = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (clean.length === 8) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  return clean;
}

type Props = {
  professionalId: string;
  onConnected?: () => void;
};

export function WhatsappPairingByNumberPanel({ professionalId, onConnected }: Props) {
  const [phone, setPhone] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestCode = async () => {
    const base = getChatbotApiBase();
    if (!base) {
      toast.error('API do chatbot não configurada.');
      return;
    }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      toast.error('Informe o WhatsApp com DDD (ex.: 11 99999-9999).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${base}/evolution/pair/${professionalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'Não foi possível gerar o código'
        );
      }
      if (data?.connected) {
        toast.success('WhatsApp já está conectado.');
        onConnected?.();
        return;
      }
      const code = typeof data?.pairingCode === 'string' ? data.pairingCode : '';
      if (!code) {
        toast.message('Código indisponível. Tente novamente em alguns segundos.');
        setPairingCode(null);
        return;
      }
      setPairingCode(code);
      toast.message('Código gerado — digite no celular em até ~1 minuto.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao gerar código');
      setPairingCode(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="whatsapp-pair-phone">Número do WhatsApp</Label>
        <Input
          id="whatsapp-pair-phone"
          type="tel"
          inputMode="tel"
          placeholder="11 99999-9999"
          value={phone}
          disabled={loading}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void requestCode();
            }
          }}
        />
        <p className="text-[11px] text-muted-foreground">
          Use o mesmo número que deseja conectar (com DDD). O DDI 55 é adicionado automaticamente.
        </p>
      </div>

      <Button
        type="button"
        className="w-full gap-1.5"
        disabled={loading}
        onClick={() => void requestCode()}
      >
        {loading ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            Gerando código…
          </>
        ) : (
          <>
            <Phone className="h-4 w-4" />
            {pairingCode ? 'Gerar novo código' : 'Gerar código'}
          </>
        )}
      </Button>

      {pairingCode ? (
        <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-4 text-center space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Código para digitar no celular</p>
          <p className="text-3xl font-bold tracking-[0.2em] tabular-nums text-foreground">
            {formatPairingCodeDisplay(pairingCode)}
          </p>
          <p className="text-[11px] text-muted-foreground">Expira rápido — se falhar, gere de novo.</p>
        </div>
      ) : null}

      <ol className="space-y-2 text-xs leading-relaxed text-muted-foreground">
        {PHONE_TUTORIAL.map((step, index) => (
          <li key={step} className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
              {index + 1}
            </span>
            <span className="pt-0.5 text-foreground/85">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
