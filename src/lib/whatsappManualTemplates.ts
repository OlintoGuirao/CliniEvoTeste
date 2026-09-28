/** Templates editáveis das mensagens WhatsApp manuais (aba Mensagens padrão). */

export const WHATSAPP_MANUAL_TEMPLATE_KEYS = [
  'appointment_confirm',
  'manual_reminder',
  'presence_request',
  'birthday_manual',
  'anamnese_invite',
  'registration_invite',
  'budget_quote',
  'cobranca_pix',
  'procedure_report',
  'session_photos',
] as const;

export type WhatsappManualTemplateKey = (typeof WHATSAPP_MANUAL_TEMPLATE_KEYS)[number];

export type WhatsappManualTemplateEntry = {
  enabled: boolean;
  /** Null/vazio = usa DEFAULT_WHATSAPP_MANUAL_MESSAGES[key]. */
  message: string | null;
};

export type WhatsappManualTemplatesMap = Record<
  WhatsappManualTemplateKey,
  WhatsappManualTemplateEntry
>;

export const DEFAULT_WHATSAPP_MANUAL_MESSAGES: Record<WhatsappManualTemplateKey, string> = {
  appointment_confirm:
    'Olá, {{nome}}! {{assunto}} foi {{agendado}} para *{{dia}}*, {{data}} {{quando}}. Qualquer dúvida, estamos à disposição.',
  manual_reminder:
    'Olá, {{nome}}! Estou passando para lembrar {{assunto_prep}} no horário de *{{data}}* às *{{horario}}*. Qualquer dúvida, estamos à disposição.',
  presence_request:
    'Olá, {{nome}}! 😊\n\nVocê tem {{consulta}} hoje {{horario}} com *{{profissional}}*.\n\nPode confirmar sua presença, por favor?\n\nAguardamos você! 💚',
  birthday_manual:
    'Olá, {{nome}}! 🎉\n\nParabéns pelo seu aniversário! Que seu dia seja incrível.\n\nUm abraço,\n{{profissional}}',
  anamnese_invite:
    'Olá {{nome}}, a {{clinica}} solicita o preenchimento da sua ficha de anamnese. Acesse o link, preencha e assine: {{url}}',
  registration_invite:
    'Olá {{nome}}, a {{clinica}} solicita que você complete seu cadastro. Acesse o link, preencha seus dados e assine o termo: {{url}}',
  budget_quote: 'Olá {{nome}}, segue o orçamento da {{clinica}}. Acesse aqui: {{url}}',
  cobranca_pix:
    'Olá, {{nome}}!\n\nEsperamos que esteja bem.\n\n{{referencia}}Segue a cobrança no valor de {{valor}}.\n\nO pagamento pode ser realizado por meio do QR Code PIX enviado nesta mensagem. Assim que o pagamento for efetuado, caso deseje, envie o comprovante para facilitar a identificação.\n\nEm caso de dúvidas, estamos à disposição. Agradecemos pela confiança e preferência!',
  procedure_report:
    'Olá {{nome}}, seu relatório de evolução{{procedimento_part}} da {{clinica}} está pronto! Acesse aqui: {{url}}',
  session_photos:
    'Olá, {{nome}}! {{fotos_intro}} do seu atendimento{{procedimento_part}}{{data_part}} com {{profissional}}. Qualquer dúvida, estamos à disposição.',
};

export const WHATSAPP_MANUAL_TEMPLATE_META: Record<
  WhatsappManualTemplateKey,
  {
    title: string;
    description: string;
    placeholders: string[];
  }
> = {
  appointment_confirm: {
    title: 'Confirmação de agendamento',
    description: 'Enviada ao salvar na Agenda (Evolution ou wa.me).',
    placeholders: [
      'nome',
      'primeiro_nome',
      'assunto',
      'agendado',
      'dia',
      'data',
      'quando',
      'horario',
      'profissional',
      'procedimento',
      'consulta',
    ],
  },
  manual_reminder: {
    title: 'Lembrete “Lembrar cliente”',
    description: 'Botão Lembrar na Agenda (wa.me).',
    placeholders: [
      'nome',
      'primeiro_nome',
      'assunto_prep',
      'data',
      'horario',
      'profissional',
      'procedimento',
      'consulta',
    ],
  },
  presence_request: {
    title: 'Pedido de presença',
    description: 'Dashboard / recepção clínica (rascunho no Atendimento).',
    placeholders: ['nome', 'consulta', 'horario', 'profissional', 'data', 'procedimento'],
  },
  birthday_manual: {
    title: 'Aniversário (manual)',
    description: 'Parabéns pelo botão do Dashboard (não é o envio automático de segunda).',
    placeholders: ['nome', 'primeiro_nome', 'profissional'],
  },
  anamnese_invite: {
    title: 'Anamnese (link)',
    description: 'Envio do link da ficha de anamnese.',
    placeholders: ['nome', 'clinica', 'url'],
  },
  registration_invite: {
    title: 'Cadastro (link)',
    description: 'Pré-cadastro / completar cadastro do paciente.',
    placeholders: ['nome', 'clinica', 'url'],
  },
  budget_quote: {
    title: 'Orçamento',
    description: 'Enviar orçamento pelo WhatsApp.',
    placeholders: ['nome', 'clinica', 'url'],
  },
  cobranca_pix: {
    title: 'Cobrança PIX avulsa',
    description:
      'Página Cobrança (Evolution ou wa.me). Use {{referencia}} (já inclui “Referente à…,” ou fica vazio).',
    placeholders: ['nome', 'valor', 'referencia', 'descricao', 'profissional'],
  },
  procedure_report: {
    title: 'Relatório / PDF',
    description: 'Link do relatório de evolução ou PDF (detalhe do tratamento).',
    placeholders: ['nome', 'clinica', 'url', 'procedimento', 'procedimento_part'],
  },
  session_photos: {
    title: 'Fotos do atendimento',
    description: 'Envio de fotos da sessão (salão).',
    placeholders: [
      'nome',
      'profissional',
      'fotos_intro',
      'procedimento_part',
      'data_part',
      'data',
    ],
  },
};

export function defaultWhatsappManualTemplatesMap(): WhatsappManualTemplatesMap {
  return WHATSAPP_MANUAL_TEMPLATE_KEYS.reduce((acc, key) => {
    acc[key] = { enabled: true, message: null };
    return acc;
  }, {} as WhatsappManualTemplatesMap);
}

export function normalizeWhatsappManualTemplates(
  raw: unknown
): WhatsappManualTemplatesMap {
  const base = defaultWhatsappManualTemplatesMap();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const obj = raw as Record<string, unknown>;
  for (const key of WHATSAPP_MANUAL_TEMPLATE_KEYS) {
    const entry = obj[key];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const e = entry as Record<string, unknown>;
    const message =
      typeof e.message === 'string' ? e.message.trim() || null : base[key].message;
    const enabled = typeof e.enabled === 'boolean' ? e.enabled : true;
    base[key] = { enabled, message };
  }
  return base;
}

import {
  collapseNestedWhatsappMarkers,
  isPlainWhatsappPlaceholderKey,
  normalizeWhatsappMarkers,
  stripWhatsappMarkers,
} from '@/lib/whatsappFormatting';

export function applyWhatsappPlaceholders(
  template: string,
  vars: Record<string, string | null | undefined>
): string {
  const filled = template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, key: string) => {
    const v = vars[key] ?? vars[key.toLowerCase()];
    if (v == null) return '';
    const raw = String(v);
    return isPlainWhatsappPlaceholderKey(key) ? stripWhatsappMarkers(raw) : raw;
  });
  return collapseNestedWhatsappMarkers(normalizeWhatsappMarkers(filled));
}

export function resolveWhatsappManualMessage(
  templates: WhatsappManualTemplatesMap | null | undefined,
  key: WhatsappManualTemplateKey,
  vars: Record<string, string | null | undefined>
): { enabled: boolean; message: string } {
  const entry = templates?.[key] ?? { enabled: true, message: null };
  const raw = entry.message?.trim() || DEFAULT_WHATSAPP_MANUAL_MESSAGES[key];
  return {
    enabled: entry.enabled !== false,
    message: applyWhatsappPlaceholders(raw, vars),
  };
}

export function buildAppointmentConfirmVars(params: {
  patientName: string;
  professionalName: string;
  dayName: string;
  dateStr: string;
  timeLabel: string;
  consultationLower?: string;
  procedureName?: string | null;
  multiSlotList?: string | null;
  nomeSalao?: string | null;
}): Record<string, string> {
  const kind = params.consultationLower?.trim() || 'consulta';
  const isAtendimento = kind === 'atendimento';
  const possessive = isAtendimento ? 'Seu' : 'Sua';
  const agendado = isAtendimento ? 'agendado' : 'agendada';
  const proc = params.procedureName?.trim();
  const assunto = proc
    ? `${possessive} ${kind} de ${proc} com ${params.professionalName}`
    : `${possessive} ${kind} com ${params.professionalName}`;
  const quando =
    params.multiSlotList && params.multiSlotList.trim()
      ? `(procedimento longo: bloco ${params.multiSlotList}, início ${params.timeLabel})`
      : `às ${params.timeLabel}`;
  const nomeSalao =
    (params.nomeSalao || params.professionalName).trim() || params.professionalName;
  const nomeCompleto = String(params.patientName || '').trim() || 'cliente';
  const primeiroNome = nomeCompleto.split(/\s+/)[0] || nomeCompleto;

  return {
    nome: nomeCompleto,
    primeiro_nome: primeiroNome,
    profissional: params.professionalName,
    dia: params.dayName,
    data: params.dateStr,
    quando,
    horario: params.timeLabel,
    hora: params.timeLabel,
    consulta: kind,
    procedimento: proc || '',
    assunto,
    agendado,
    nome_salao: nomeSalao,
    clinica: nomeSalao,
  };
}

export function buildManualReminderVars(params: {
  patientName?: string | null;
  professionalName: string;
  dateFormatted: string;
  timeStr: string;
  consultationLower?: string;
  procedureName?: string | null;
  nomeSalao?: string | null;
}): Record<string, string> {
  const kind = params.consultationLower?.trim() || 'consulta';
  const isAtendimento = kind === 'atendimento';
  const prep = isAtendimento ? 'do seu' : 'da sua';
  const proc = params.procedureName?.trim();
  const assunto_prep = proc
    ? `${prep} ${kind} de ${proc} com ${params.professionalName}`
    : `${prep} ${kind} com ${params.professionalName}`;
  const nomeSalao =
    (params.nomeSalao || params.professionalName).trim() || params.professionalName;
  const nomeCompleto = String(params.patientName || '').trim() || 'cliente';
  const primeiroNome = nomeCompleto.split(/\s+/)[0] || nomeCompleto;
  return {
    nome: nomeCompleto,
    primeiro_nome: primeiroNome,
    profissional: params.professionalName,
    data: params.dateFormatted,
    horario: params.timeStr,
    hora: params.timeStr,
    consulta: kind,
    procedimento: proc || '',
    assunto_prep,
    nome_salao: nomeSalao,
    clinica: nomeSalao,
  };
}
