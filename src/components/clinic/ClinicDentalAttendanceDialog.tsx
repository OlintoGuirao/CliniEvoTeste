import { Loader2 } from 'lucide-react';
import { PatientDentalPlansSection } from '@/components/patient-detail/PatientDentalPlansSection';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ClinicDentalAttendanceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string | null;
  patientName?: string | null;
  /** Quando informado, abre só este plano (ex.: notificação da recepção). */
  planId?: string | null;
  /** Título do pop-up (padrão: Novo atendimento). */
  title?: string;
  /** Se true e o paciente ainda não tem plano, abre o dialog de criar plano. */
  preferCreatePlan?: boolean;
};

/** Pop-up com a aba Planos odontológicos (novo atendimento / recepção). */
export function ClinicDentalAttendanceDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  planId,
  title = 'Novo atendimento',
  preferCreatePlan = false,
}: ClinicDentalAttendanceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(94dvh,960px)] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl sm:rounded-xl">
        <DialogHeader className="shrink-0 border-b border-border/70 px-4 py-3 pr-12 sm:px-6">
          <DialogTitle className="text-base font-semibold sm:text-lg">
            {title}
            {patientName?.trim() ? (
              <span className="font-normal text-muted-foreground"> · {patientName.trim()}</span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Planos de tratamento odontológico do paciente.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {open && patientId ? (
            <PatientDentalPlansSection
              key={`${patientId}:${planId ?? 'all'}:${preferCreatePlan ? 'create' : 'list'}`}
              patientId={patientId}
              focusPlanId={planId}
              preferCreatePlan={preferCreatePlan}
            />
          ) : (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
