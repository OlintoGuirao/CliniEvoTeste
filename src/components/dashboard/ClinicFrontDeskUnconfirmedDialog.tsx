import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageCircle, UserX } from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultationTodayItem } from '@/api/dashboard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatPersonName } from '@/lib/utils';
import {
  buildAtendimentoPath,
  buildPresenceConfirmationMessage,
  normalizeWhatsappPhone,
} from '@/lib/clinicFrontDeskAtendimento';
import { ensureAtendimentoConversation } from '@/services/api/atendimentoApi';
import { loadWhatsappManualTemplates } from '@/lib/loadWhatsappManualTemplates';

type ClinicFrontDeskUnconfirmedDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ConsultationTodayItem[];
  whatsappProfessionalId: string;
  clinicName?: string | null;
};

export function ClinicFrontDeskUnconfirmedDialog({
  open,
  onOpenChange,
  items,
  whatsappProfessionalId,
  clinicName,
}: ClinicFrontDeskUnconfirmedDialogProps) {
  const navigate = useNavigate();
  const [sendingId, setSendingId] = useState<string | null>(null);

  const unconfirmed = useMemo(
    () =>
      items.filter(
        (item) =>
          item.type === 'appointment' &&
          !item.isCompleted &&
          !item.presenceConfirmed &&
          !item.presenceDeclined
      ),
    [items]
  );

  const openWhatsapp = async (item: ConsultationTodayItem) => {
    const phone = normalizeWhatsappPhone(item.patientPhone);
    if (!phone) {
      toast.error('Cadastre o telefone do paciente para enviar confirmação.');
      return;
    }

    const templates = await loadWhatsappManualTemplates(whatsappProfessionalId);
    const entry = templates.presence_request;
    if (!entry.enabled) {
      toast.message('Mensagem desativada em Mensagens padrão.');
      return;
    }

    const draft = buildPresenceConfirmationMessage({
      patientName: item.patientName,
      appointmentDate: item.date,
      startTime: item.time,
      procedureLabel: item.procedureLabel,
      professionalName: item.professionalName,
      clinicName,
      template: entry.message,
    });

    setSendingId(item.id);
    try {
      const conv = await ensureAtendimentoConversation({
        professionalId: whatsappProfessionalId,
        phone,
        patientName: item.patientName,
      });
      onOpenChange(false);
      navigate(
        buildAtendimentoPath({
          conversationId: conv.id,
          phone,
          patientName: item.patientName,
          draft,
        })
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível abrir o atendimento.');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[min(85vh,100dvh)] flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-primary" />
            Aguardando confirmação
          </DialogTitle>
          <DialogDescription>
            Pacientes de hoje que ainda não confirmaram presença pelo WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {unconfirmed.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Todos os agendamentos de hoje já foram confirmados ou recusados.
            </p>
          ) : (
            <ul className="space-y-2 py-1">
              {unconfirmed.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm break-words">
                      {formatPersonName(item.patientName)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(parseISO(item.date), "d 'de' MMM", { locale: ptBR })} às {item.time}
                      {item.professionalName ? ` · ${item.professionalName}` : ''}
                    </p>
                    {item.procedureLabel ? (
                      <p className="text-xs text-muted-foreground line-clamp-1">{item.procedureLabel}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5 border-emerald-300/70 text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300"
                    disabled={sendingId === item.id}
                    onClick={() => void openWhatsapp(item)}
                  >
                    <MessageCircle className="h-4 w-4 text-[#25D366]" />
                    {sendingId === item.id ? 'Abrindo...' : 'Confirmar via WhatsApp'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function countUnconfirmedToday(items: ConsultationTodayItem[]): number {
  return items.filter(
    (item) =>
      item.type === 'appointment' &&
      !item.isCompleted &&
      !item.presenceConfirmed &&
      !item.presenceDeclined
  ).length;
}
