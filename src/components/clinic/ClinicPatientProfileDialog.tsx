import { PatientDetailView } from '@/components/patient-detail/PatientDetailView';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ClinicPatientProfileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string | null;
  onPatientUpdated?: () => void;
};

/** Pop-up com a ficha completa do paciente (somente clínica). */
export function ClinicPatientProfileDialog({
  open,
  onOpenChange,
  patientId,
}: ClinicPatientProfileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(96dvh,980px)] w-[calc(100%-0.75rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl sm:rounded-xl z-[1700]">
        <DialogHeader className="sr-only">
          <DialogTitle>Ficha do paciente</DialogTitle>
          <DialogDescription>Ficha completa do paciente.</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {open && patientId ? (
            <PatientDetailView
              key={patientId}
              patientId={patientId}
              variant="dialog"
              initialTab="ficha"
              syncUrlTab={false}
              onRequestClose={() => onOpenChange(false)}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
