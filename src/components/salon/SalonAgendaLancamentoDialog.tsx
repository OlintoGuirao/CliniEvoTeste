import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Wallet } from 'lucide-react';
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
import { useAuth } from '@/contexts/AuthContext';
import { dashboardKey, QUERY_KEYS } from '@/api/queryKeys';
import { resolveBranchIdForInsert } from '@/lib/resolveBranchIdForInsert';
import {
  resolveSalonAppointmentPatientId,
  saveSalonAppointmentCompletion,
} from '@/lib/salonAppointmentCompletion';
import {
  loadSalonLancamentoLines,
  type SalonLancamentoLine,
} from '@/lib/salonLancamentoLines';
import { FORMA_PAGAMENTO_LABEL, type FormaPagamento } from '@/types/faturamento';
import { formatPersonName } from '@/lib/utils';
import { toast } from 'sonner';

export type SalonAgendaLancamentoTarget = {
  appointmentId?: string | null;
  sessionId?: string | null;
  patientId: string | null;
  patientName: string;
  professionalId: string;
  sessionDate: string;
  sessionTime?: string | null;
  appointmentNotes?: string | null;
  procedureLabel?: string | null;
  /** Todos os procedimentos do atendimento (quando já conhecidos na UI). */
  procedureNames?: string[] | null;
  isAlreadyCompleted: boolean;
  valorLine?: string | null;
};

type SalonAgendaLancamentoDialogProps = {
  target: SalonAgendaLancamentoTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Profissional logado (para invalidar dashboard / resolver pré-cadastro). */
  professionalId?: string;
  onSaved?: () => void;
};

function parseMoneyInput(value: string): number {
  const s = value.trim();
  if (!s) return 0;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function SalonAgendaLancamentoDialog({
  target,
  open,
  onOpenChange,
  professionalId,
  onSaved,
}: SalonAgendaLancamentoDialogProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [loadingLines, setLoadingLines] = useState(false);
  const [lines, setLines] = useState<SalonLancamentoLine[]>([]);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('pix');
  const [parcelas, setParcelas] = useState(1);

  useEffect(() => {
    if (!open || !target) return;

    let cancelled = false;
    const load = async () => {
      setLoadingLines(true);
      try {
        const result = await loadSalonLancamentoLines({
          sessionId: target.sessionId,
          patientId: target.patientId,
          sessionDate: target.sessionDate,
          fallbackProfessionalId: target.professionalId || professionalId || '',
          appointmentNotes: target.appointmentNotes,
          procedureLabel: target.procedureLabel,
          procedureNamesHint: target.procedureNames,
          organizationId: profile?.organization_id ?? null,
          viewerProfessionalId: profile?.id ?? professionalId ?? null,
          viewerProfessionalName: profile?.full_name ?? null,
        });
        if (cancelled) return;
        setLines(result.lines);
        setFormaPagamento(result.formaPagamento);
        setParcelas(result.parcelas);
      } catch {
        if (cancelled) return;
        setLines([
          {
            key: 'fallback',
            salonProcedureId: null,
            procedureName: target.procedureLabel?.trim() || 'Procedimento',
            professionalId: target.professionalId,
            professionalName: 'Profissional',
            valor: '',
          },
        ]);
        setFormaPagamento('pix');
        setParcelas(1);
      } finally {
        if (!cancelled) setLoadingLines(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, target, professionalId, profile?.organization_id, profile?.id, profile?.full_name]);

  const totalValor = useMemo(
    () => lines.reduce((sum, line) => sum + parseMoneyInput(line.valor), 0),
    [lines]
  );

  const updateLineValor = (key: string, valor: string) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, valor } : line)));
  };

  const handleSave = async () => {
    if (!target) return;
    const fallbackProId = professionalId ?? target.professionalId;
    if (!fallbackProId) return;

    const hasAnyValor = lines.some((line) => parseMoneyInput(line.valor) > 0);
    if (!hasAnyValor) {
      toast.error('Informe o valor de ao menos um procedimento.');
      return;
    }

    const missingIds = lines.filter((l) => parseMoneyInput(l.valor) > 0 && !l.salonProcedureId);
    if (missingIds.length > 0) {
      toast.error('Não foi possível identificar o procedimento no catálogo do salão.');
      return;
    }

    setSaving(true);
    try {
      let patientId = target.patientId;
      if (!patientId && target.appointmentId) {
        patientId = await resolveSalonAppointmentPatientId({
          appointmentId: target.appointmentId,
          fallbackProfessionalId: fallbackProId,
        });
      }
      if (!patientId) {
        throw new Error('Não foi possível vincular um cliente a este agendamento.');
      }

      const branchId = await resolveBranchIdForInsert(profile);
      const procedureLines = lines
        .filter((l) => l.salonProcedureId)
        .map((l) => ({
          salonProcedureId: l.salonProcedureId as string,
          professionalId: l.professionalId || target.professionalId || fallbackProId,
          valorInput: l.valor,
        }));

      const { error } = await saveSalonAppointmentCompletion({
        appointmentId: target.appointmentId ?? null,
        sessionId: target.sessionId ?? null,
        patientId,
        professionalId: target.professionalId || fallbackProId,
        sessionDate: target.sessionDate.slice(0, 10),
        sessionTime: target.sessionTime ?? null,
        appointmentNotes: target.appointmentNotes ?? null,
        procedureLabel:
          lines.map((l) => l.procedureName).filter(Boolean).join(' · ') ||
          target.procedureLabel ||
          null,
        isAlreadyCompleted: target.isAlreadyCompleted,
        markCompleted: true,
        valorInput: totalValor > 0 ? totalValor.toFixed(2).replace('.', ',') : '',
        formaPagamento,
        parcelas: formaPagamento === 'cartao' ? parcelas : null,
        branchId,
        procedureLines,
      });
      if (error) throw error;

      toast.success(
        target.isAlreadyCompleted
          ? 'Valor do lançamento atualizado.'
          : 'Lançamento registrado no faturamento.'
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['agenda-completed-sessions'] }),
        queryClient.invalidateQueries({ queryKey: dashboardKey(fallbackProId) }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.faturamento }),
      ]);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar o lançamento.');
    } finally {
      setSaving(false);
    }
  };

  if (!target) return null;

  const multi = lines.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            {target.isAlreadyCompleted ? 'Editar lançamento' : 'Lançamento'}
          </DialogTitle>
          <DialogDescription>
            {formatPersonName(target.patientName)}
            {target.sessionTime ? ` — ${target.sessionTime.slice(0, 5)}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {loadingLines ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando procedimentos…
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {lines.map((line, index) => (
                  <div
                    key={line.key}
                    className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {line.procedureName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Profissional: {line.professionalName}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor={`salon-lancamento-valor-${index}`}
                        className="text-xs font-medium"
                      >
                        Valor (R$)
                      </Label>
                      <Input
                        id={`salon-lancamento-valor-${index}`}
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={line.valor}
                        onChange={(e) => updateLineValor(line.key, e.target.value)}
                        className="w-28 h-10 rounded-xl"
                        autoFocus={index === 0}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Forma de pagamento</Label>
                  <Select
                    value={formaPagamento}
                    onValueChange={(v) => setFormaPagamento(v as FormaPagamento)}
                  >
                    <SelectTrigger className="w-[140px] h-10 rounded-xl">
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
                    <Label htmlFor="salon-lancamento-parcelas" className="text-xs font-medium">
                      Parcelas
                    </Label>
                    <Input
                      id="salon-lancamento-parcelas"
                      type="number"
                      min={1}
                      max={24}
                      value={parcelas}
                      onChange={(e) => setParcelas(Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 h-10 rounded-xl"
                    />
                  </div>
                ) : null}
              </div>

              {multi ? (
                <p className="text-xs font-medium text-foreground">
                  Total: {formatMoney(totalValor)}
                </p>
              ) : null}

              <p className="text-xs text-muted-foreground">
                {multi
                  ? 'Cada procedimento entra no faturamento do profissional vinculado.'
                  : 'O valor será registrado no faturamento e na ficha do cliente.'}
              </p>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loadingLines}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando…
              </>
            ) : target.isAlreadyCompleted ? (
              'Salvar'
            ) : (
              'Lançar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
