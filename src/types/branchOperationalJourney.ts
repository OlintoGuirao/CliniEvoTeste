export type JourneyCaptureChannel =
  | 'trafego_pago'
  | 'midia_organica'
  | 'instagram'
  | 'facebook'
  | 'indicacao'
  | 'espontaneo'
  | 'parceria'
  | 'google'
  | 'acoes_externas';

export type JourneyStage =
  | 'captacao'
  | 'cadastro_inicial'
  | 'agendamento_pendente'
  | 'agendado'
  | 'aguardando_confirmacao'
  | 'nao_agendou'
  | 'compareceu'
  | 'nao_compareceu'
  | 'documentacao_pendente'
  | 'avaliacao_medica'
  | 'orcamento_negociacao'
  | 'orcamento_enviado'
  | 'fechado'
  | 'nao_fechado'
  | 'contrato_pendente'
  | 'pos_venda'
  | 'tratamento_iniciado'
  | 'retencao_recuperacao'
  | 'encerrado_positivo';

export type JourneyFollowUpStatus = 'pending' | 'completed' | 'cancelled' | 'overdue';
export type JourneyFollowUpPriority = 'low' | 'normal' | 'high' | 'urgent';

export type BranchPatientJourney = {
  id: string;
  organization_id: string;
  branch_id: string;
  patient_id: string | null;
  professional_id: string;
  assigned_user_id: string | null;
  current_stage: JourneyStage;
  capture_channel: JourneyCaptureChannel | null;
  capture_detail: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  lead_email: string | null;
  first_contact_at: string | null;
  appointment_id: string | null;
  budget_quote_id: string | null;
  procedure_instance_id: string | null;
  no_show_reason: string | null;
  no_schedule_reason: string | null;
  no_close_reason: string | null;
  satisfaction: 'positive' | 'neutral' | 'negative' | null;
  satisfaction_notes: string | null;
  priority: JourneyFollowUpPriority;
  notes: string | null;
  next_follow_up_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  patients?: { full_name: string; phone: string | null } | null;
};

export type BranchJourneyEvent = {
  id: string;
  journey_id: string;
  branch_id: string;
  user_id: string;
  event_type: string;
  from_stage: JourneyStage | null;
  to_stage: JourneyStage | null;
  payload: Record<string, unknown>;
  notes: string | null;
  created_at: string;
};

export type BranchJourneyFollowUp = {
  id: string;
  journey_id: string;
  branch_id: string;
  assigned_user_id: string;
  due_at: string;
  priority: JourneyFollowUpPriority;
  reason: string;
  status: JourneyFollowUpStatus;
  notes: string | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
};

export type BranchOperationalFilters = {
  dataInicio?: string;
  dataFim?: string;
  assignedUserId?: string;
  captureChannel?: JourneyCaptureChannel;
  stage?: JourneyStage;
  priority?: JourneyFollowUpPriority;
  followUpStatus?: 'overdue' | 'upcoming' | 'all';
};

export type CreateBranchJourneyInput = {
  patientId?: string | null;
  captureChannel?: JourneyCaptureChannel;
  captureDetail?: string;
  leadName?: string;
  leadPhone?: string;
  leadEmail?: string;
  firstContactAt?: string;
  notes?: string;
  assignedUserId?: string;
};

export type TransitionJourneyInput = {
  journeyId: string;
  toStage: JourneyStage;
  notes?: string;
  payload?: Record<string, unknown>;
};

export type CreateFollowUpInput = {
  journeyId: string;
  dueAt: string;
  reason: string;
  priority?: JourneyFollowUpPriority;
  assignedUserId?: string;
  notes?: string;
};
