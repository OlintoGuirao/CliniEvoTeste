import { PenLine, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PatientTabPanelSection } from './PatientDetailTabPanel';

type PatientTermTabSectionProps = {
  title: string;
  description: string;
  signed: boolean;
  onSign: () => void;
};

export function PatientTermTabSection({ title, description, signed, onSign }: PatientTermTabSectionProps) {
  return (
    <PatientTabPanelSection title={title} contentClassName="p-4 sm:p-5 space-y-4">
      <p className="text-xs text-muted-foreground -mt-1 flex items-center gap-1.5">
        <PenLine className="w-3.5 h-3.5 shrink-0" />
        {description}
      </p>
      {signed ? (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Termo assinado</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              O consentimento deste termo já está registrado para este paciente.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Este termo ainda não foi assinado. Abra o formulário para coletar a assinatura do paciente.
          </p>
          <Button type="button" className="min-h-[44px] touch-manipulation" onClick={onSign}>
            Assinar termo
          </Button>
        </div>
      )}
    </PatientTabPanelSection>
  );
}
