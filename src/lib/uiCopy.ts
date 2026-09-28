import { isSalonAccount, normalizeAccountType, type AccountType } from '@/lib/accountType';

/**
 * Glossário da UI — APENAS para conta salão (cabeleireiro).
 * Clínica e profissional único sempre recebem o vocabulário clínico padrão.
 */
export type UiCopy = {
  org: string;
  orgLower: string;
  orgOf: string;
  team: string;
  consultation: string;
  consultationLower: string;
  newConsultation: string;
  consultationsToday: string;
  nextConsultation: string;
  nextConsultations: string;
  patient: string;
  patients: string;
  patientsActive: string;
  masterName: string;
  orgNamePlaceholder: string;
  orgNameLabel: string;
  createdToast: string;
};

/** Vocabulário padrão (clínica + solo) — nunca muda. */
export const DEFAULT_UI_COPY: UiCopy = {
  org: 'Clínica',
  orgLower: 'clínica',
  orgOf: 'da clínica',
  team: 'Equipe da clínica',
  consultation: 'Consulta',
  consultationLower: 'consulta',
  newConsultation: 'Nova consulta',
  consultationsToday: 'Consultas hoje',
  nextConsultation: 'Próxima consulta',
  nextConsultations: 'Próximas consultas',
  patient: 'Paciente',
  patients: 'Pacientes',
  patientsActive: 'Pacientes ativos',
  masterName: 'Nome do Master (obrigatório)',
  orgNamePlaceholder: 'Ex.: Clínica Aura',
  orgNameLabel: 'Nome da clínica (opcional)',
  createdToast: 'Clínica criada com sucesso (Master da conta).',
};

/** Vocabulário exclusivo do Salão. */
export const SALON_UI_COPY: UiCopy = {
  org: 'Salão',
  orgLower: 'salão',
  orgOf: 'do salão',
  team: 'Equipe do salão',
  consultation: 'Atendimento',
  consultationLower: 'atendimento',
  newConsultation: 'Novo atendimento',
  consultationsToday: 'Atendimentos hoje',
  nextConsultation: 'Próximo atendimento',
  nextConsultations: 'Próximos atendimentos',
  patient: 'Cliente',
  patients: 'Clientes',
  patientsActive: 'Clientes ativos',
  masterName: 'Nome do Admin do salão (obrigatório)',
  orgNamePlaceholder: 'Ex.: Salão Aura',
  orgNameLabel: 'Nome do salão (opcional)',
  createdToast: 'Salão criado com sucesso (Admin da conta).',
};

/** Só retorna copy de salão se account_type === 'salon'; demais → padrão clínico. */
export function getUiCopy(accountType: unknown): UiCopy {
  return isSalonAccount(accountType) ? SALON_UI_COPY : DEFAULT_UI_COPY;
}

/** Form admin: labels conforme o tipo selecionado no formulário. */
export function getAdminCreateCopy(accountType: AccountType | unknown): UiCopy {
  const t = normalizeAccountType(accountType);
  if (t === 'salon') return SALON_UI_COPY;
  return DEFAULT_UI_COPY;
}
