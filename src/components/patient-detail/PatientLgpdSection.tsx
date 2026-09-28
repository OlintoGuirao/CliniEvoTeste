import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SignaturePad } from '@/components/SignaturePad';
import { PatientTabPanelSection } from './PatientDetailTabPanel';

interface LgpdConsent {
  id: string;
  consent_given: boolean;
  consent_date: string | null;
  signature_data: string | null;
}

type PatientLgpdSectionProps = {
  consent: LgpdConsent | null;
  consentText: string;
  lgpdSignatureData: string | null;
  savingLgpd: boolean;
  onSignatureSave: (dataUrl: string) => void;
  onRegister: () => void;
};

export function PatientLgpdSection({
  consent,
  consentText,
  lgpdSignatureData,
  savingLgpd,
  onSignatureSave,
  onRegister,
}: PatientLgpdSectionProps) {
  return (
    <PatientTabPanelSection
      title="Termo de Consentimento (LGPD)"
      contentClassName="p-4 sm:p-5 space-y-4"
    >
      <p className="text-xs text-muted-foreground -mt-1 flex items-center gap-1.5">
        <Shield className="w-3.5 h-3.5 shrink-0" />
        Consentimento para uso e armazenamento de imagens
      </p>
      <div className="bg-muted/40 p-4 rounded-lg text-sm text-muted-foreground whitespace-pre-line max-h-64 overflow-y-auto border border-border/40">
        {consentText}
      </div>
      {consent?.consent_given ? (
        <div className="space-y-2">
          {consent.signature_data ? (
            <div className="rounded-lg border border-border/50 bg-background/60 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Assinatura do paciente</p>
              <img
                src={consent.signature_data}
                alt="Assinatura consentimento LGPD"
                className="max-h-24 w-auto border rounded bg-background"
              />
            </div>
          ) : null}
          <p className="text-sm font-medium text-muted-foreground">
            Consentimento registrado em{' '}
            {consent.consent_date
              ? format(parseISO(consent.consent_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
              : '—'}
          </p>
        </div>
      ) : (
        <>
          <SignaturePad label="Assinatura do paciente" height={140} onSave={onSignatureSave} />
          <Button
            type="button"
            size="sm"
            className="w-full sm:w-auto gap-2 min-h-[44px] touch-manipulation"
            onClick={onRegister}
            disabled={!lgpdSignatureData || savingLgpd}
          >
            {savingLgpd ? 'Registrando...' : 'Registrar consentimento'}
          </Button>
        </>
      )}
    </PatientTabPanelSection>
  );
}
