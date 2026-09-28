import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneOff, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchWhatsappIgnoredPhonesOnly,
  updateWhatsappIgnoredPhonesOnly,
} from '@/services/api/dynamicProcedureFieldSettingsApi';
import {
  fetchBranchWhatsappIgnoredPhones,
  updateBranchWhatsappIgnoredPhones,
} from '@/services/api/branchWhatsappSettingsApi';
import {
  canonicalWhatsappIgnoredPhone,
  normalizeIgnoredPhoneList,
} from '@/lib/whatsappIgnoredPhones';
import { formatPhoneDisplay } from '@/lib/phone';

export function WhatsappIgnoredNumbersSection({
  professionalId: professionalIdProp,
  branchId,
}: {
  professionalId?: string;
  /** Clínica: números bloqueados ficam na filial (recepção pode editar). */
  branchId?: string | null;
}) {
  const professionalId = professionalIdProp || '';
  const useBranch = Boolean(branchId);
  const storageKey = useBranch ? `branch:${branchId}` : professionalId ? `pro:${professionalId}` : '';
  const [phones, setPhones] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!storageKey) return;
      setLoading(true);
      try {
        const list = useBranch
          ? await fetchBranchWhatsappIgnoredPhones(branchId!)
          : await fetchWhatsappIgnoredPhonesOnly({ professionalId });
        if (!cancelled) {
          setPhones(normalizeIgnoredPhoneList(list));
        }
      } catch {
        if (!cancelled) setPhones([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [storageKey, branchId, professionalId]);

  const persistPhones = async (nextPhones: string[]) => {
    if (!storageKey) return;
    setSaving(true);
    try {
      const normalized = normalizeIgnoredPhoneList(nextPhones);
      if (useBranch) {
        await updateBranchWhatsappIgnoredPhones(branchId!, normalized);
      } else {
        await updateWhatsappIgnoredPhonesOnly({ professionalId, phones: normalized });
      }
      setPhones(normalized);
      toast.success('Lista de números ignorados atualizada.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    const canonical = canonicalWhatsappIgnoredPhone(draft);
    if (!canonical) {
      toast.error('Informe um telefone válido com DDD (ex: 11 99999-9999).');
      return;
    }
    if (phones.some((p) => p === canonical)) {
      toast.message('Este número já está na lista.');
      return;
    }
    await persistPhones([...phones, canonical]);
    setDraft('');
  };

  const handleRemove = async (phone: string) => {
    await persistPhones(phones.filter((p) => p !== phone));
  };

  if (!storageKey) {
    return <p className="text-xs text-muted-foreground">Carregando configurações...</p>;
  }

  return (
    <div className="rounded-xl border border-border/70 bg-muted/10 px-3 py-3 space-y-3">
      <div className="flex items-start gap-2.5">
        <PhoneOff className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium leading-snug">Adicionar número</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Mensagens desses números não serão respondidas pela secretária. Útil para familiares,
            equipe ou contatos que você atende manualmente.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="whatsapp-ignored-phone" className="text-xs text-muted-foreground">
            Telefone
          </Label>
          <Input
            id="whatsapp-ignored-phone"
            type="tel"
            inputMode="tel"
            placeholder="(11) 99999-9999"
            value={draft}
            disabled={loading || saving}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAdd();
              }
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 gap-1.5"
          disabled={loading || saving || !draft.trim()}
          onClick={() => void handleAdd()}
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando lista...</p>
      ) : phones.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum número bloqueado.</p>
      ) : (
        <ul className="space-y-2">
          {phones.map((phone) => (
            <li
              key={phone}
              className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2"
            >
              <span className="text-sm font-medium tabular-nums">
                {formatPhoneDisplay(phone) || phone}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                disabled={saving}
                aria-label={`Remover ${formatPhoneDisplay(phone)}`}
                onClick={() => void handleRemove(phone)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
