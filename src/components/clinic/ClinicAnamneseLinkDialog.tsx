import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Loader2, MessageCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatPhoneForWhatsApp } from '@/lib/evolutionPdf';
import { buildAnamneseWhatsAppMessage, openWhatsAppWithFallback } from '@/lib/reportShare';
import { loadWhatsappManualTemplates } from '@/lib/loadWhatsappManualTemplates';
import { useAuth } from '@/contexts/AuthContext';
import {
  buildPublicAnamneseUrl,
  ensurePatientAnamnesePublicSlug,
} from '@/services/api/patientAnamneseApi';
import { supabase } from '@/integrations/supabase/client';

function qrCodeImageUrl(data: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(data)}`;
}

export type ClinicAnamneseLinkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
  patientPhone?: string | null;
  clinicName?: string;
  /** Modelos escolhidos na solicitação (opcional). */
  modelNames?: string[];
};

export function ClinicAnamneseLinkDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  patientPhone,
  clinicName = 'Clínica',
  modelNames,
}: ClinicAnamneseLinkDialogProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState('');
  const [status, setStatus] = useState<'pending' | 'completed'>('pending');
  const [copied, setCopied] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);

  useEffect(() => {
    if (!open || !patientId) return;
    let cancelled = false;
    setLoading(true);
    setCopied(false);

    void (async () => {
      try {
        const [{ data: row }, slug] = await Promise.all([
          supabase
            .from('patient_anamnese')
            .select('signed_at, signature_data')
            .eq('patient_id', patientId)
            .maybeSingle(),
          ensurePatientAnamnesePublicSlug(patientId),
        ]);
        if (cancelled) return;
        const completed = Boolean(
          (row as { signed_at?: string | null } | null)?.signed_at ||
            (row as { signature_data?: string | null } | null)?.signature_data
        );
        setStatus(completed ? 'completed' : 'pending');
        setLink(buildPublicAnamneseUrl(slug));
      } catch {
        if (!cancelled) {
          toast.error('Não foi possível carregar o link da anamnese.');
          onOpenChange(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, patientId, onOpenChange]);

  const modelsLabel = useMemo(() => {
    if (!modelNames?.length) return 'Anamnese padrão';
    return modelNames.join(', ');
  }, [modelNames]);

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Link copiado.');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  }

  async function handleWhatsApp() {
    const wa = formatPhoneForWhatsApp(patientPhone);
    if (!wa) {
      toast.error('Cadastre o telefone do paciente na ficha para enviar pelo WhatsApp.');
      return;
    }
    if (!link) return;
    setSendingWa(true);
    try {
      const templates = await loadWhatsappManualTemplates(profile?.id);
      const entry = templates.anamnese_invite;
      if (!entry.enabled) {
        toast.message('Mensagem desativada em Mensagens padrão.');
        return;
      }
      const message = buildAnamneseWhatsAppMessage({
        patientName,
        clinicName,
        anamneseUrl: link,
        template: entry.message,
      });
      openWhatsAppWithFallback({ phone: wa, text: message });
      toast.success('Abrindo o WhatsApp…');
    } finally {
      setSendingWa(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md sm:rounded-xl z-[1950]">
        <DialogHeader className="space-y-1 border-b border-border/70 px-5 py-4 pr-12 text-left">
          <DialogTitle className="text-base font-semibold sm:text-lg">Link de questionário</DialogTitle>
          <DialogDescription className="sr-only">
            Link, QR Code e envio por WhatsApp da anamnese do paciente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 py-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando link…
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                    status === 'completed'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-amber-200 bg-amber-50 text-amber-900'
                  )}
                >
                  {status === 'completed' ? 'Preenchida' : 'Pendente'}
                </span>
                <span className="text-xs text-muted-foreground truncate">{modelsLabel}</span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Link</Label>
                <div className="flex items-stretch gap-2">
                  <p className="min-w-0 flex-1 truncate rounded-xl border border-input bg-muted/20 px-3 py-2.5 text-sm">
                    {link}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-11 w-11 shrink-0 rounded-xl bg-sky-100 text-sky-800 hover:bg-sky-200"
                    onClick={() => void handleCopy()}
                    aria-label="Copiar link"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">QR Code</Label>
                <div className="flex justify-center rounded-xl border border-border/60 bg-white p-4">
                  {link ? (
                    <img
                      src={qrCodeImageUrl(link)}
                      alt="QR Code do questionário"
                      className="h-[180px] w-[180px]"
                      width={180}
                      height={180}
                    />
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Notificar</Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-11 w-11 rounded-xl bg-sky-100 text-sky-800 hover:bg-sky-200"
                  onClick={handleWhatsApp}
                  disabled={sendingWa || !link}
                  aria-label="Enviar pelo WhatsApp"
                >
                  {sendingWa ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageCircle className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="border-t border-border/70 bg-muted/15 px-5 py-3 sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            className="gap-1.5 rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
