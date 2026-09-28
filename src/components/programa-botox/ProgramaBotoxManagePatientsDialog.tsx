import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { BotoxGroupRow, ProgramaBotoxRow } from '@/lib/programaBotox';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, Trash2 } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: BotoxGroupRow | null;
  programas: ProgramaBotoxRow[];
  onChanged: () => void | Promise<void>;
  onRequestAddPatient: () => void;
};

function parseMoneyInput(raw: string): number | null {
  const normalized = String(raw).trim().replace(/\s/g, '');
  const n = Number(
    normalized.includes(',')
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized
  );
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function formatMoneyInput(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '150,00';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ProgramaBotoxManagePatientsDialog({
  open,
  onOpenChange,
  group,
  programas,
  onChanged,
  onRequestAddPatient,
}: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ProgramaBotoxRow | null>(null);
  const [removing, setRemoving] = useState(false);

  const ativos = useMemo(() => {
    if (!group) return [];
    return programas
      .filter((p) => p.group_id === group.id && p.status === 'ativo')
      .sort((a, b) =>
        (a.patients?.full_name ?? '').localeCompare(b.patients?.full_name ?? '', 'pt-BR')
      );
  }, [programas, group]);

  const ativosKey = useMemo(
    () => ativos.map((p) => `${p.id}:${p.valor_mensalidade ?? ''}`).join('|'),
    [ativos]
  );

  useEffect(() => {
    if (!open) {
      setRemoveTarget(null);
      setRemoving(false);
      return;
    }
    const next: Record<string, string> = {};
    for (const p of ativos) {
      next[p.id] = formatMoneyInput(p.valor_mensalidade);
    }
    setDrafts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ativosKey]);

  const saveValor = async (programaId: string) => {
    const parsed = parseMoneyInput(drafts[programaId] ?? '');
    if (parsed == null) {
      toast.error('Informe um valor de mensalidade válido.');
      return false;
    }
    setSavingId(programaId);
    try {
      const { error } = await (supabase as unknown as { from: (t: string) => any })
        .from('programas_botox')
        .update({ valor_mensalidade: parsed })
        .eq('id', programaId);
      if (error) throw error;
      return true;
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message ?? 'Erro ao salvar mensalidade.');
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveOne = async (programaId: string) => {
    const ok = await saveValor(programaId);
    if (ok) {
      toast.success('Mensalidade atualizada.');
      await onChanged();
    }
  };

  const handleSaveAll = async () => {
    setSavingAll(true);
    try {
      for (const p of ativos) {
        const ok = await saveValor(p.id);
        if (!ok) return;
      }
      toast.success('Mensalidades atualizadas.');
      await onChanged();
    } finally {
      setSavingAll(false);
    }
  };

  const confirmRemove = async () => {
    const target = removeTarget;
    if (!target) return;
    setRemoving(true);
    try {
      const { error } = await (supabase as unknown as { from: (t: string) => any })
        .from('programas_botox')
        .update({ status: 'finalizado' })
        .eq('id', target.id);
      if (error) throw error;
      toast.success('Paciente removido do programa.');
      setRemoveTarget(null);
      await onChanged();
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message ?? 'Erro ao remover paciente.');
    } finally {
      setRemoving(false);
    }
  };

  const groupTitle =
    group?.name?.trim() ||
    (group ? `${group.period_start} → ${group.period_end}` : 'Grupo');

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setRemoveTarget(null);
            setRemoving(false);
          }
          onOpenChange(next);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar pacientes do programa</DialogTitle>
            <DialogDescription>
              Grupo: <span className="font-medium text-foreground">{groupTitle}</span>. Defina o valor
              da mensalidade, adicione ou remova pacientes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {ativos.length} {ativos.length === 1 ? 'paciente ativo' : 'pacientes ativos'}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={removing}
                onClick={() => {
                  onOpenChange(false);
                  onRequestAddPatient();
                }}
              >
                <Plus className="h-4 w-4" />
                Adicionar paciente
              </Button>
            </div>

            {ativos.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-xl border border-dashed px-3 py-4 text-center">
                Nenhum paciente neste grupo. Use &quot;Adicionar paciente&quot; para incluir.
              </p>
            ) : (
              <ul className="space-y-2">
                {ativos.map((p) => {
                  const name = p.patients?.full_name?.trim() || 'Paciente sem nome';
                  const busy = savingId === p.id || savingAll || removing;
                  return (
                    <li
                      key={p.id}
                      className="rounded-xl border border-border/70 bg-muted/10 px-3 py-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {p.patients?.phone?.trim() || 'Sem telefone'}
                            {p.dia_vencimento ? ` · vence dia ${p.dia_vencimento}` : ''}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Remover do programa"
                          aria-label={`Remover ${name}`}
                          disabled={busy}
                          onClick={() => setRemoveTarget(p)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="space-y-1 flex-1 min-w-[140px]">
                          <Label htmlFor={`mensalidade-${p.id}`} className="text-xs">
                            Valor da mensalidade (R$)
                          </Label>
                          <Input
                            id={`mensalidade-${p.id}`}
                            inputMode="decimal"
                            className="h-10"
                            value={drafts[p.id] ?? ''}
                            onChange={(e) =>
                              setDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))
                            }
                            placeholder="150,00"
                            disabled={busy}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 shrink-0"
                          disabled={busy}
                          onClick={() => void handleSaveOne(p.id)}
                        >
                          {savingId === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Salvar'
                          )}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={removing}>
              Fechar
            </Button>
            {ativos.length > 0 ? (
              <Button
                type="button"
                onClick={() => void handleSaveAll()}
                disabled={savingAll || !!savingId || removing}
              >
                {savingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Salvando…
                  </>
                ) : (
                  'Salvar todas as mensalidades'
                )}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(next) => {
          if (!next && !removing) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover paciente do programa?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">
                {removeTarget?.patients?.full_name ?? 'Paciente'}
              </span>{' '}
              sairá da lista ativa deste grupo. O histórico de pagamentos e sessões é mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={removing || !removeTarget}
              onClick={() => void confirmRemove()}
            >
              {removing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Removendo…
                </>
              ) : (
                'Remover'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
