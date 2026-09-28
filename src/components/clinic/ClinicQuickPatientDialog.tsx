import { useEffect, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useCreatePatient } from '@/hooks/useCreatePatient';
import { findExistingPatientByPhone, formatPhoneDisplay, normalizePhoneDigits } from '@/lib/phone';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DateInputField } from '@/components/ui/date-input-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type ClinicQuickPatientCreated = {
  id: string;
  full_name: string;
  phone: string | null;
};

type ClinicQuickPatientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionalId: string | undefined;
  initialName?: string;
  onCreated: (patient: ClinicQuickPatientCreated) => void;
};

function formatCpfInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function emptyForm(name = '') {
  return {
    full_name: name,
    phone: '',
    cpf: '',
    date_of_birth: undefined as Date | undefined,
    sex: '',
  };
}

export function ClinicPatientSearchEmpty({
  query,
  onRegister,
}: {
  query: string;
  onRegister: (name: string) => void;
}) {
  const name = query.trim();
  return (
    <div className="px-1 py-3 text-center">
      <p className="text-sm text-muted-foreground px-2">
        {name ? (
          <>
            Paciente <span className="font-medium text-foreground">“{name}”</span> não foi encontrado.
          </>
        ) : (
          'Nenhum paciente encontrado.'
        )}
      </p>
      <button
        type="button"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/15"
        onClick={() => onRegister(name)}
      >
        <UserPlus className="h-4 w-4 shrink-0" />
        {name ? 'Cadastrar este paciente?' : 'Cadastrar paciente'}
      </button>
    </div>
  );
}

export function ClinicQuickPatientDialog({
  open,
  onOpenChange,
  professionalId,
  initialName = '',
  onCreated,
}: ClinicQuickPatientDialogProps) {
  const { mutateAsync: createPatient, isPending } = useCreatePatient(professionalId);
  const [form, setForm] = useState(() => emptyForm(initialName));

  useEffect(() => {
    if (open) setForm(emptyForm(initialName));
  }, [open, initialName]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const fullName = form.full_name.trim();
    if (fullName.length < 2) {
      toast.error('Informe o nome completo do paciente.');
      return;
    }
    if (!professionalId) {
      toast.error('Sessão não carregada. Faça login novamente.');
      return;
    }

    const phoneDigits = normalizePhoneDigits(form.phone);
    if (phoneDigits && phoneDigits.length < 10) {
      toast.error('Informe um telefone válido com DDD.');
      return;
    }

    const cpfDigits = form.cpf.replace(/\D/g, '');
    if (cpfDigits && cpfDigits.length !== 11) {
      toast.error('Informe um CPF válido.');
      return;
    }

    if (phoneDigits) {
      const existing = await findExistingPatientByPhone({
        professionalId,
        phone: phoneDigits,
      });
      if (existing?.id) {
        toast.error(
          `Já existe um paciente com este telefone: ${existing.full_name}. Cada número é exclusivo de um paciente.`
        );
        return;
      }
    }

    try {
      const patient = await createPatient({
        professional_id: professionalId,
        full_name: fullName,
        cpf: form.cpf.trim() || null,
        date_of_birth: form.date_of_birth ? format(form.date_of_birth, 'yyyy-MM-dd') : null,
        sex: form.sex || null,
        phone: phoneDigits || null,
        registration_completed_at: new Date().toISOString(),
      });
      toast.success('Paciente cadastrado.');
      onCreated({
        id: patient.id,
        full_name: patient.full_name,
        phone: patient.phone,
      });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível cadastrar o paciente. Tente novamente.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.stopPropagation()}
        onInteractOutside={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Cadastrar paciente</DialogTitle>
          <DialogDescription>
            Preencha os dados iniciais. O restante pode ser completado depois na ficha.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clinic-quick-full-name">Nome completo *</Label>
            <Input
              id="clinic-quick-full-name"
              value={form.full_name}
              onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
              placeholder="Nome do paciente"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clinic-quick-phone">Telefone</Label>
            <Input
              id="clinic-quick-phone"
              inputMode="tel"
              value={formatPhoneDisplay(form.phone)}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, phone: normalizePhoneDigits(e.target.value) }))
              }
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clinic-quick-dob">Data de nascimento</Label>
            <DateInputField
              inputId="clinic-quick-dob"
              value={form.date_of_birth}
              onChange={(date) => setForm((prev) => ({ ...prev, date_of_birth: date }))}
              maxDate={new Date()}
              fromYear={1920}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clinic-quick-cpf">CPF</Label>
            <Input
              id="clinic-quick-cpf"
              inputMode="numeric"
              value={form.cpf}
              onChange={(e) => setForm((prev) => ({ ...prev, cpf: formatCpfInput(e.target.value) }))}
              placeholder="000.000.000-00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clinic-quick-sex">Sexo</Label>
            <Select
              value={form.sex || undefined}
              onValueChange={(value) => setForm((prev) => ({ ...prev, sex: value }))}
            >
              <SelectTrigger id="clinic-quick-sex">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Feminino</SelectItem>
                <SelectItem value="male">Masculino</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Cadastrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
