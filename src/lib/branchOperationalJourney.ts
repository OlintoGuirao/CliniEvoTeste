import type { JourneyCaptureChannel, JourneyStage } from '@/types/branchOperationalJourney';

export const JOURNEY_CAPTURE_CHANNEL_LABELS: Record<JourneyCaptureChannel, string> = {
  trafego_pago: 'Tráfego pago',
  midia_organica: 'Mídia orgânica/digital',
  instagram: 'Instagram',
  facebook: 'Facebook',
  indicacao: 'Indicação',
  espontaneo: 'Espontâneo',
  parceria: 'Parceria',
  google: 'Google',
  acoes_externas: 'Ações externas',
};

export const JOURNEY_STAGE_LABELS: Record<JourneyStage, string> = {
  captacao: 'Novo contato',
  cadastro_inicial: 'Cadastro inicial',
  agendamento_pendente: 'Agendamento pendente',
  agendado: 'Agendado',
  aguardando_confirmacao: 'Aguardando confirmação',
  nao_agendou: 'Não agendou',
  compareceu: 'Compareceu',
  nao_compareceu: 'Não compareceu',
  documentacao_pendente: 'Documentação pendente',
  avaliacao_medica: 'Avaliação médica',
  orcamento_negociacao: 'Orçamento em negociação',
  orcamento_enviado: 'Orçamento enviado',
  fechado: 'Fechado',
  nao_fechado: 'Não fechado',
  contrato_pendente: 'Contrato pendente',
  pos_venda: 'Pós-venda',
  tratamento_iniciado: 'Tratamento iniciado',
  retencao_recuperacao: 'Retenção/recuperação',
  encerrado_positivo: 'Encerrado positivamente',
};

/** Agrupamento visual do pipeline operacional da filial. */
export type PipelineColumn = {
  id: string;
  label: string;
  stages: JourneyStage[];
  tone: 'capture' | 'registration' | 'process' | 'post_sale' | 'recovery' | 'closed';
};

export const PIPELINE_COLUMNS: PipelineColumn[] = [
  {
    id: 'novo_contato',
    label: 'Novo contato',
    stages: ['captacao'],
    tone: 'capture',
  },
  {
    id: 'cadastro',
    label: 'Cadastro',
    stages: ['cadastro_inicial', 'agendamento_pendente'],
    tone: 'registration',
  },
  {
    id: 'agenda',
    label: 'Agenda',
    stages: ['agendado', 'aguardando_confirmacao', 'nao_agendou', 'nao_compareceu'],
    tone: 'process',
  },
  {
    id: 'atendimento',
    label: 'Atendimento',
    stages: ['compareceu', 'documentacao_pendente', 'avaliacao_medica'],
    tone: 'process',
  },
  {
    id: 'comercial',
    label: 'Comercial',
    stages: ['orcamento_negociacao', 'orcamento_enviado', 'nao_fechado', 'fechado', 'contrato_pendente'],
    tone: 'process',
  },
  {
    id: 'pos_venda',
    label: 'Pós-venda',
    stages: ['pos_venda', 'tratamento_iniciado'],
    tone: 'post_sale',
  },
  {
    id: 'recuperacao',
    label: 'Recuperação',
    stages: ['retencao_recuperacao'],
    tone: 'recovery',
  },
  {
    id: 'encerrado',
    label: 'Encerrado',
    stages: ['encerrado_positivo'],
    tone: 'closed',
  },
];

export const COLUMN_TONE_CLASS: Record<PipelineColumn['tone'], string> = {
  capture: 'border-sky-500/40 bg-sky-500/5',
  registration: 'border-violet-500/40 bg-violet-500/5',
  process: 'border-amber-500/40 bg-amber-500/5',
  post_sale: 'border-emerald-500/40 bg-emerald-500/5',
  recovery: 'border-rose-500/40 bg-rose-500/5',
  closed: 'border-muted-foreground/30 bg-muted/30',
};

/** Transições permitidas sem permissão especial (operacional da filial). */
export const ALLOWED_STAGE_TRANSITIONS: Partial<Record<JourneyStage, JourneyStage[]>> = {
  captacao: ['cadastro_inicial', 'agendamento_pendente', 'nao_agendou'],
  cadastro_inicial: ['agendamento_pendente', 'agendado', 'nao_agendou'],
  agendamento_pendente: ['agendado', 'nao_agendou'],
  agendado: ['aguardando_confirmacao', 'compareceu', 'nao_compareceu', 'nao_agendou'],
  aguardando_confirmacao: ['agendado', 'compareceu', 'nao_compareceu'],
  nao_agendou: ['agendamento_pendente', 'agendado', 'cadastro_inicial'],
  compareceu: ['documentacao_pendente', 'avaliacao_medica'],
  nao_compareceu: ['agendado', 'aguardando_confirmacao', 'nao_agendou'],
  documentacao_pendente: ['avaliacao_medica'],
  avaliacao_medica: ['orcamento_negociacao', 'documentacao_pendente'],
  orcamento_negociacao: ['orcamento_enviado', 'nao_fechado', 'fechado'],
  orcamento_enviado: ['fechado', 'nao_fechado', 'orcamento_negociacao'],
  nao_fechado: ['orcamento_negociacao', 'orcamento_enviado'],
  fechado: ['contrato_pendente', 'pos_venda'],
  contrato_pendente: ['pos_venda', 'tratamento_iniciado'],
  pos_venda: ['tratamento_iniciado', 'retencao_recuperacao', 'encerrado_positivo'],
  tratamento_iniciado: ['encerrado_positivo', 'retencao_recuperacao'],
  retencao_recuperacao: ['pos_venda', 'tratamento_iniciado', 'encerrado_positivo'],
  encerrado_positivo: [],
};

export function canTransitionStage(from: JourneyStage, to: JourneyStage): boolean {
  if (from === to) return true;
  const allowed = ALLOWED_STAGE_TRANSITIONS[from];
  return Boolean(allowed?.includes(to));
}

export function getPipelineColumnForStage(stage: JourneyStage): PipelineColumn {
  return (
    PIPELINE_COLUMNS.find((col) => col.stages.includes(stage)) ??
    PIPELINE_COLUMNS[0]
  );
}

export function journeyDisplayName(journey: {
  lead_name?: string | null;
  patients?: { full_name?: string } | null;
}): string {
  return journey.patients?.full_name?.trim() || journey.lead_name?.trim() || 'Contato sem nome';
}

export function journeyDisplayPhone(journey: {
  lead_phone?: string | null;
  patients?: { phone?: string | null } | null;
}): string | null {
  return journey.patients?.phone || journey.lead_phone || null;
}

export const NO_CLOSE_REASONS = [
  'Preço',
  'Prazo',
  'Indecisão',
  'Concorrência',
  'Falta de retorno',
  'Condição de pagamento',
  'Outros',
] as const;

export function isFollowUpOverdue(dueAt: string, status: string): boolean {
  if (status !== 'pending') return false;
  return new Date(dueAt).getTime() < Date.now();
}

export function requiresCaptureChannel(patientId?: string | null): boolean {
  return !patientId;
}
