import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { buildAppointmentReminder24hPreview } from '@/lib/appointmentReminder24h';
import { normalizePhoneDigits } from '@/lib/phone';
import { formatPersonName } from '@/lib/utils';
import { DEFAULT_WHATSAPP_MANUAL_MESSAGES } from '@/lib/whatsappManualTemplates';

export const CLINIC_PRESENCE_CONFIRMATION_TEMPLATE =
  DEFAULT_WHATSAPP_MANUAL_MESSAGES.presence_request;

export function normalizeWhatsappPhone(raw: string | null | undefined): string | null {
  const digits = normalizePhoneDigits(raw ?? '');
  if (digits.length < 10) return null;
  return digits.startsWith('55') ? digits : `55${digits}`;
}

export function buildPresenceConfirmationMessage(params: {
  patientName: string;
  appointmentDate: string;
  startTime: string;
  endTime?: string | null;
  procedureLabel?: string | null;
  professionalName?: string | null;
  clinicName?: string | null;
  template?: string | null;
}): string {
  const dateLabel = format(parseISO(params.appointmentDate), "dd/MM/yyyy", { locale: ptBR });
  return buildAppointmentReminder24hPreview(
    params.template?.trim() || CLINIC_PRESENCE_CONFIRMATION_TEMPLATE,
    {
      nome: formatPersonName(params.patientName),
      procedimento: params.procedureLabel?.trim() || 'Consulta',
      data: `hoje (${dateLabel})`,
      hora: params.startTime.slice(0, 5),
      horaFim: params.endTime?.slice(0, 5) || undefined,
      profissional: params.professionalName?.trim() || params.clinicName?.trim() || 'a clínica',
    }
  );
}

export function buildAtendimentoPath(params: {
  phone: string | null | undefined;
  patientName?: string | null;
  draft?: string | null;
  conversationId?: string | null;
}): string {
  const search = new URLSearchParams();
  const phone = normalizeWhatsappPhone(params.phone);
  if (params.conversationId) search.set('conversationId', params.conversationId);
  if (phone) search.set('phone', phone);
  if (params.patientName?.trim()) search.set('name', params.patientName.trim());
  if (params.draft?.trim()) search.set('draft', params.draft.trim());
  const qs = search.toString();
  return qs ? `/atendimento?${qs}` : '/atendimento';
}
