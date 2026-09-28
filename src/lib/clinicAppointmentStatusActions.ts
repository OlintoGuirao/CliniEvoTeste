import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ClinicAppointmentStatus } from '@/lib/clinicAppointmentStatus';
import { formatPersonName } from '@/lib/utils';

/** Texto curto exibido abaixo do seletor — o que aquele status significa. */
export const CLINIC_STATUS_ACTION_HINT: Record<ClinicAppointmentStatus, string> = {
  to_confirm:
    'Paciente ainda não confirmou. Ação: enviar confirmação por WhatsApp.',
  confirmed_by_patient:
    'Confirmação feita pelo paciente no bot/WhatsApp.',
  confirmed:
    'Confirmação manual da recepção/CRC (ligação ou mensagem).',
  waiting:
    'Paciente já está na clínica. Ação: avisar a profissional (notificação no sistema).',
  payment:
    'Visita para negociar ou finalizar a compra.',
  rescheduled:
    'Paciente remarcou. Ação: escolher nova data e horário.',
  in_progress:
    'Profissional iniciou o atendimento/avaliação. Ação: abrir a consulta.',
  finished:
    'Atendimento finalizado (avaliação, orçamento ou tratamento).',
  cancelled_by_professional:
    'Desmarcado pela clínica/profissional. Ação: avisar o paciente.',
  cancelled_by_patient:
    'Paciente recusou a confirmação ou desmarcou.',
  no_show:
    'Paciente confirmou e não compareceu.',
};

export type ClinicStatusSideEffect =
  | 'none'
  | 'request_confirmation_whatsapp'
  | 'notify_professional_waiting'
  | 'open_consultation'
  | 'open_patient_finish'
  | 'reschedule_slot'
  | 'cancel_whatsapp';

export function clinicStatusSideEffect(status: ClinicAppointmentStatus): ClinicStatusSideEffect {
  switch (status) {
    case 'to_confirm':
      return 'request_confirmation_whatsapp';
    case 'waiting':
      return 'notify_professional_waiting';
    case 'in_progress':
      return 'open_consultation';
    case 'finished':
      return 'open_patient_finish';
    case 'rescheduled':
      return 'reschedule_slot';
    case 'cancelled_by_professional':
      return 'cancel_whatsapp';
    default:
      return 'none';
  }
}

export function buildClinicWaitingAlertMessage(params: {
  patientName: string;
  startTime: string;
  procedureLabel?: string | null;
}): string {
  const name = formatPersonName(params.patientName) || 'Paciente';
  const time = params.startTime.slice(0, 5);
  const proc = params.procedureLabel?.trim();
  return proc
    ? `${name} já está esperando (${time} · ${proc}).`
    : `${name} já está esperando (${time}).`;
}

export function buildClinicCancellationWhatsappMessage(params: {
  patientName: string;
  appointmentDate: string;
  startTime: string;
  clinicName?: string | null;
  byProfessional: boolean;
}): string {
  const name = formatPersonName(params.patientName) || 'olá';
  const dateLabel = format(parseISO(params.appointmentDate), "dd/MM/yyyy", { locale: ptBR });
  const time = params.startTime.slice(0, 5);
  const clinic = params.clinicName?.trim() || 'a clínica';
  if (params.byProfessional) {
    return (
      `Olá, ${name}! 😊\n\n` +
      `Precisamos remarcar ou cancelar seu horário de *${dateLabel}* às *${time}* em ${clinic}.\n\n` +
      `Podemos combinar um novo horário?`
    );
  }
  return (
    `Olá, ${name}! Recebemos o cancelamento do horário de *${dateLabel}* às *${time}*.\n\n` +
    `Quando quiser, é só nos chamar para remarcar. 💚`
  );
}

export function buildClinicManualConfirmationWhatsappMessage(params: {
  patientName: string;
  appointmentDate: string;
  startTime: string;
  clinicName?: string | null;
}): string {
  const name = formatPersonName(params.patientName) || 'olá';
  const dateLabel = format(parseISO(params.appointmentDate), "dd/MM/yyyy", { locale: ptBR });
  const time = params.startTime.slice(0, 5);
  const clinic = params.clinicName?.trim() || 'a clínica';
  return (
    `Olá, ${name}! ✅\n\n` +
    `Confirmamos seu horário em ${clinic}: *${dateLabel}* às *${time}*.\n\n` +
    `Aguardamos você!`
  );
}
