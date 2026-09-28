import {
  DEFAULT_WHATSAPP_MANUAL_MESSAGES,
  applyWhatsappPlaceholders,
} from '@/lib/whatsappManualTemplates';

type OpenWhatsAppParams = {
  phone: string;
  text: string;
  fallbackDelayMs?: number;
};

/**
 * Tenta abrir o app do WhatsApp e faz fallback para wa.me se permanecer na aba.
 */
export function openWhatsAppWithFallback(params: OpenWhatsAppParams): void {
  const { phone, text, fallbackDelayMs = 900 } = params;
  const encodedText = encodeURIComponent(text);
  const appUrl = `whatsapp://send?phone=${phone}&text=${encodedText}`;
  const webUrl = `https://wa.me/${phone}?text=${encodedText}`;
  const startedAt = Date.now();
  window.location.assign(appUrl);
  window.setTimeout(() => {
    if (document.visibilityState === 'visible' && Date.now() - startedAt >= fallbackDelayMs) {
      window.location.assign(webUrl);
    }
  }, fallbackDelayMs);
}

export function buildProcedureReportWhatsAppMessage(args: {
  patientName: string | null | undefined;
  clinicName: string | null | undefined;
  procedureName: string | null | undefined;
  reportUrl: string;
  template?: string | null;
}): string {
  const patient = args.patientName?.trim() || 'Paciente';
  const clinic = args.clinicName?.trim() || 'Clínica';
  const procedure = args.procedureName?.trim() || '';
  const procedimento_part = procedure ? ` do procedimento ${procedure}` : '';
  return applyWhatsappPlaceholders(
    args.template?.trim() || DEFAULT_WHATSAPP_MANUAL_MESSAGES.procedure_report,
    {
      nome: patient,
      clinica: clinic,
      procedimento: procedure || 'tratamento',
      procedimento_part,
      url: args.reportUrl,
    }
  );
}

export function buildEmagrecimentoReportWhatsAppMessage(args: {
  patientName: string | null | undefined;
  clinicName: string | null | undefined;
  reportUrl: string;
  template?: string | null;
}): string {
  const patient = args.patientName?.trim() || 'Paciente';
  const clinic = args.clinicName?.trim() || 'Clínica';
  const raw = args.template?.trim();
  if (raw) {
    return applyWhatsappPlaceholders(raw, {
      nome: patient,
      clinica: clinic,
      procedimento: 'avaliação corporal',
      procedimento_part: ' de avaliação corporal',
      url: args.reportUrl,
    });
  }
  return `Olá ${patient}, seu relatório de avaliação corporal da ${clinic} está pronto! Acesse aqui: ${args.reportUrl}`;
}

export function buildBudgetQuoteWhatsAppMessage(args: {
  patientName: string | null | undefined;
  clinicName: string | null | undefined;
  budgetUrl: string;
  template?: string | null;
}): string {
  const patient = args.patientName?.trim() || 'Paciente';
  const clinic = args.clinicName?.trim() || 'Clínica';
  return applyWhatsappPlaceholders(
    args.template?.trim() || DEFAULT_WHATSAPP_MANUAL_MESSAGES.budget_quote,
    { nome: patient, clinica: clinic, url: args.budgetUrl }
  );
}

export function buildAnamneseWhatsAppMessage(args: {
  patientName: string | null | undefined;
  clinicName: string | null | undefined;
  anamneseUrl: string;
  template?: string | null;
}): string {
  const patient = args.patientName?.trim() || 'Paciente';
  const clinic = args.clinicName?.trim() || 'Clínica';
  return applyWhatsappPlaceholders(
    args.template?.trim() || DEFAULT_WHATSAPP_MANUAL_MESSAGES.anamnese_invite,
    { nome: patient, clinica: clinic, url: args.anamneseUrl }
  );
}

export function buildRegistrationWhatsAppMessage(args: {
  patientName: string | null | undefined;
  clinicName: string | null | undefined;
  registrationUrl: string;
  template?: string | null;
}): string {
  const patient = args.patientName?.trim() || 'Paciente';
  const clinic = args.clinicName?.trim() || 'Clínica';
  return applyWhatsappPlaceholders(
    args.template?.trim() || DEFAULT_WHATSAPP_MANUAL_MESSAGES.registration_invite,
    { nome: patient, clinica: clinic, url: args.registrationUrl }
  );
}

export async function sharePdfFile(params: {
  blob: Blob;
  filename: string;
  text?: string;
  title?: string;
}): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  if (typeof navigator.share !== 'function') return false;

  try {
    const file = new File([params.blob], params.filename, { type: 'application/pdf' });
    const payload: ShareData = {
      files: [file],
      title: params.title,
      text: params.text,
    };

    if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) {
      return false;
    }

    await navigator.share(payload);
    return true;
  } catch {
    return false;
  }
}
