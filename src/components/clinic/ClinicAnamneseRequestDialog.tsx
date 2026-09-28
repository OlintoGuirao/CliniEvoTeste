import { useMemo, useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  buildPublicAnamneseUrl,
  ensurePatientAnamnesePublicSlug,
} from '@/services/api/patientAnamneseApi';

export const CLINIC_ANAMNESE_MODELS = [
  { id: 'default', name: 'Anamnese padrão' },
] as const;

type ClinicAnamneseRequestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName?: string;
  onSaved: (payload: { url: string; modelNames: string[] }) => void;
};

export function ClinicAnamneseRequestDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  onSaved,
}: ClinicAnamneseRequestDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([CLINIC_ANAMNESE_MODELS[0].id]);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modelQuery, setModelQuery] = useState('');

  const selectedModels = useMemo(
    () => CLINIC_ANAMNESE_MODELS.filter((m) => selectedIds.includes(m.id)),
    [selectedIds]
  );

  const filteredModels = useMemo(() => {
    const q = modelQuery.trim().toLowerCase();
    if (!q) return CLINIC_ANAMNESE_MODELS;
    return CLINIC_ANAMNESE_MODELS.filter((m) => m.name.toLowerCase().includes(q));
  }, [modelQuery]);

  const selectedLabel =
    selectedModels.length === 0
      ? 'Selecione um ou mais modelos'
      : selectedModels.map((m) => m.name).join(', ');

  function resetForm() {
    setSelectedIds([CLINIC_ANAMNESE_MODELS[0].id]);
    setSendEmail(false);
    setModelQuery('');
    setModelPickerOpen(false);
  }

  function resetAndClose() {
    resetForm();
    onOpenChange(false);
  }

  function toggleModel(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        return next;
      }
      return [...prev, id];
    });
  }

  async function handleSave() {
    if (selectedIds.length === 0) {
      toast.error('Selecione ao menos um modelo de anamnese.');
      return;
    }
    setSaving(true);
    try {
      const slug = await ensurePatientAnamnesePublicSlug(patientId);
      const url = buildPublicAnamneseUrl(slug);
      const modelNames = selectedModels.map((m) => m.name);
      if (sendEmail) {
        toast.success(
          patientName
            ? `Solicitação criada para ${patientName}. Envio por e-mail em breve.`
            : 'Solicitação criada. Envio por e-mail em breve.'
        );
      } else {
        toast.success('Solicitação criada.');
      }
      resetForm();
      onOpenChange(false);
      onSaved({ url, modelNames });
    } catch {
      toast.error('Não foi possível criar a solicitação de questionário.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetAndClose();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg sm:rounded-xl z-[1900]">
        <DialogHeader className="space-y-1 border-b border-border/70 px-5 py-4 pr-12 text-left">
          <DialogTitle className="text-base font-semibold sm:text-lg">
            Criar solicitação de questionário
          </DialogTitle>
          <DialogDescription className="sr-only">
            Escolha um ou mais modelos de anamnese e opcionalmente envie e-mail ao paciente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 py-5">
          <div className="space-y-2">
            <Label htmlFor="clinic-anamnese-model" className="text-sm font-medium text-foreground">
              Modelo de anamnese <span className="text-destructive">*</span>
            </Label>
            <div className="flex overflow-hidden rounded-xl border border-input bg-background shadow-sm">
              <button
                id="clinic-anamnese-model"
                type="button"
                className={cn(
                  'min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm',
                  selectedModels.length > 0 ? 'text-foreground' : 'text-muted-foreground'
                )}
                onClick={() => setModelPickerOpen(true)}
              >
                {selectedLabel}
              </button>
              <Popover open={modelPickerOpen} onOpenChange={setModelPickerOpen} modal={false}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-auto w-11 shrink-0 items-center justify-center border-l border-input bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    aria-label="Buscar modelo de anamnese"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="z-[2000] min-w-[18rem] p-2"
                  align="end"
                  sideOffset={6}
                >
                  <input
                    type="search"
                    value={modelQuery}
                    onChange={(e) => setModelQuery(e.target.value)}
                    placeholder="Buscar modelo…"
                    className="mb-2 flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    autoFocus
                  />
                  <div className="max-h-48 space-y-0.5 overflow-y-auto">
                    {filteredModels.length === 0 ? (
                      <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                        Nenhum modelo encontrado.
                      </p>
                    ) : (
                      filteredModels.map((model) => {
                        const checked = selectedIds.includes(model.id);
                        return (
                          <label
                            key={model.id}
                            className={cn(
                              'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-accent',
                              checked && 'bg-accent/70'
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleModel(model.id)}
                            />
                            <span className="min-w-0 flex-1">{model.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clinic-anamnese-email" className="text-sm font-medium text-foreground">
              Enviar e-mail para o paciente?
            </Label>
            <Switch
              id="clinic-anamnese-email"
              checked={sendEmail}
              onCheckedChange={setSendEmail}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border/70 bg-muted/15 px-5 py-3 sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            className="gap-1.5 rounded-xl"
            onClick={resetAndClose}
            disabled={saving}
          >
            <X className="h-4 w-4" />
            Cancelar
          </Button>
          <Button
            type="button"
            className="gap-1.5 rounded-xl bg-emerald-400 text-emerald-950 hover:bg-emerald-500"
            onClick={() => void handleSave()}
            disabled={saving || selectedIds.length === 0}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
