import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Wallet } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ConsultationTodayItem } from '@/api/dashboard';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardKey } from '@/api/queryKeys';
import { resolveBranchIdForInsert } from '@/lib/resolveBranchIdForInsert';
import {
  initialSalonCompletionBilling,
  resolveSalonAppointmentPatientId,
  saveSalonAppointmentCompletion,
} from '@/lib/salonAppointmentCompletion';
import { FORMA_PAGAMENTO_LABEL, type FormaPagamento } from '@/types/faturamento';
import { formatPersonName } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type SalonAppointmentEditDialogProps = {
  item: ConsultationTodayItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionalId?: string;
};

export function SalonAppointmentEditDialog({
  item,
  open,
  onOpenChange,
  professionalId,
}: SalonAppointmentEditDialogProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'pending' | 'completed'>('pending');
  const [valor, setValor] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('pix');
  const [parcelas, setParcelas] = useState(1);

  useEffect(() => {
    if (!open || !item) return;

    const loadBilling = async () => {
      let observacoes: string | null = null;
      if (item.sessionId) {
        const { data } = await supabase
          .from('patient_sessions')
          .select('observacoes')
          .eq('id', item.sessionId)
          .maybeSingle();
        observacoes = data?.observacoes ?? null;
      }
      const billing = initialSalonCompletionBilling({
        valorLine: item.valorLine,
        sessionObservacoes: observacoes,
      });
      setValor(billing.valor);
      setFormaPagamento(billing.formaPagamento);
      setParcelas(billing.parcelas);
      setStatus(item.isCompleted ? 'completed' : 'pending');
    };

    void loadBilling();
  }, [open, item]);

  const handleSave = async () => {
    if (!item || !professionalId) return;

    const proId = item.professionalId ?? professionalId;
    setSaving(true);
    try {
      let patientId = item.patientId;
      if (!patientId && item.type === 'appointment') {
        patientId = await resolveSalonAppointmentPatientId({
          appointmentId: item.id,
          fallbackProfessionalId: proId,
        });
      }
      if (!patientId) {
        throw new Error('Não foi possível vincular um cliente a este agendamento.');
      }

      const branchId = await resolveBranchIdForInsert(profile);
      const { error } = await saveSalonAppointmentCompletion({
        appointmentId: item.type === 'appointment' ? item.id : null,
        sessionId: item.sessionId ?? null,
        patientId,
        professionalId: proId,
        sessionDate: item.date,
        sessionTime: item.time,
        appointmentNotes: item.note ?? null,
        procedureLabel: item.procedureLabel ?? null,
        isAlreadyCompleted: !!item.isCompleted,
        markCompleted: status === 'completed',
        valorInput: valor,
        formaPagamento,
        parcelas: formaPagamento === 'cartao' ? parcelas : null,
        branchId,
      });
      if (error) throw error;

      toast.success(
        item.isCompleted ? 'Atendimento atualizado.' : 'Atendimento concluído e registrado no financeiro.'
      );
      await queryClient.invalidateQueries({ queryKey: dashboardKey(professionalId) });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Editar atendimento
          </DialogTitle>
          <DialogDescription>
            {formatPersonName(item.patientName)} — {item.time}
            {item.procedureLabel ? ` · ${item.procedureLabel}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as 'pending' | 'completed')}
              disabled={item.isCompleted}
            >
              <SelectTrigger className="h-9 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
              </SelectContent>
            </Select>
            {item.isCompleted ? (
              <p className="text-xs text-muted-foreground">
                Atendimento já concluído — altere o valor abaixo para atualizar o financeiro.
              </p>
            ) : null}
          </div>

          {status === 'completed' ? (
            <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Wallet className="h-4 w-4 text-primary" />
                Valor do atendimento
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Valor (R$)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="w-28 h-9 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Forma de pagamento</Label>
                  <Select
                    value={formaPagamento}
                    onValueChange={(v) => setFormaPagamento(v as FormaPagamento)}
                  >
                    <SelectTrigger className="w-[130px] h-9 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(FORMA_PAGAMENTO_LABEL) as FormaPagamento[]).map((fp) => (
                        <SelectItem key={fp} value={fp}>
                          {FORMA_PAGAMENTO_LABEL[fp]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formaPagamento === 'cartao' ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Parcelas</Label>
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      value={parcelas}
                      onChange={(e) => setParcelas(Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 h-9 rounded-xl"
                    />
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                O valor informado será registrado automaticamente no faturamento.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving || status !== 'completed'}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
