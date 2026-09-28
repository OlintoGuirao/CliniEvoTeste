import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { patientsListKey } from '@/api/queryKeys';
import { formatPhoneForWhatsApp } from '@/lib/evolutionPdf';
import { findPatientByPhoneAndName, formatPhoneDisplay, normalizePhoneDigits } from '@/lib/phone';
import { buildRegistrationWhatsAppMessage, openWhatsAppWithFallback } from '@/lib/reportShare';
import { loadWhatsappManualTemplates } from '@/lib/loadWhatsappManualTemplates';
import {
  buildPublicRegistrationUrl,
  ensurePatientRegistrationPublicSlug,
} from '@/services/api/patientRegistrationApi';
import { supabase } from '@/integrations/supabase/client';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionalId: string;
  salonName: string | null | undefined;
};

export function SalonPreRegistrationDialog({
  open,
  onOpenChange,
  professionalId,
  salonName,
}: Props) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setFullName('');
    setPhone('');
  };

  const handleSendWhatsApp = async () => {
    const name = fullName.trim();
    const phoneDigits = normalizePhoneDigits(phone);
    if (name.length < 2) {
      toast.error('Informe o nome do cliente.');
      return;
    }
    if (!phoneDigits || phoneDigits.length < 10) {
      toast.error('Informe um telefone válido.');
      return;
    }

    setLoading(true);
    try {
      const templates = await loadWhatsappManualTemplates(professionalId);
      const entry = templates.registration_invite;
      if (!entry.enabled) {
        toast.message('Mensagem desativada em Mensagens padrão.');
        return;
      }

      const existing = await findPatientByPhoneAndName({
        professionalId,
        phone: phoneDigits,
        fullName: name,
      });

      let patientId = existing?.id;
      if (!patientId) {
        const { data: created, error } = await supabase
          .from('patients')
          .insert({
            professional_id: professionalId,
            full_name: name,
            phone: phoneDigits,
            registration_completed_at: null,
            is_active: true,
          })
          .select('id')
          .single();
        if (error) throw error;
        patientId = created.id;
      }

      const slug = await ensurePatientRegistrationPublicSlug(patientId);
      const url = buildPublicRegistrationUrl(slug);
      const wa = formatPhoneForWhatsApp(phoneDigits);
      if (!wa) {
        toast.error('Telefone inválido para WhatsApp.');
        return;
      }

      const message = buildRegistrationWhatsAppMessage({
        patientName: name,
        clinicName: salonName,
        registrationUrl: url,
        template: entry.message,
      });
      openWhatsAppWithFallback({ phone: wa, text: message });
      toast.success('Pré-cadastro criado. Abrindo o WhatsApp…');
      void queryClient.invalidateQueries({ queryKey: patientsListKey(professionalId) });
      onOpenChange(false);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível enviar o pré-cadastro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pré-cadastro</DialogTitle>
          <DialogDescription>
            Informe nome e telefone do cliente. Enviaremos o link para ele completar o cadastro pelo WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="salon-pre-name">Nome *</Label>
            <Input
              id="salon-pre-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nome do cliente"
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="salon-pre-phone">Telefone / WhatsApp *</Label>
            <Input
              id="salon-pre-phone"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhoneDisplay(e.target.value))}
              placeholder="(00) 00000-0000"
              autoComplete="tel"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSendWhatsApp()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Enviar para WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
