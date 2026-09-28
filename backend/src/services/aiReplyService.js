const axios = require('axios');
const { logger } = require('../utils/logger');

const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const ENABLE_AI_REPLY = String(process.env.ENABLE_AI_REPLY || 'false').toLowerCase() === 'true';
/** Reformulação de respostas da secretária WhatsApp — desligada por padrão (fluxo 100% script). */
const ENABLE_AI_WHATSAPP_REPLY =
  String(process.env.ENABLE_AI_WHATSAPP_REPLY || 'false').toLowerCase() === 'true';
const AI_REPLY_TONE = process.env.AI_REPLY_TONE || 'humano, objetivo e educado';
const AI_REPLY_STYLE = process.env.AI_REPLY_STYLE || 'mensagens curtas e claras para WhatsApp';
const AI_REPLY_GOAL = process.env.AI_REPLY_GOAL || 'guiar o paciente até concluir o agendamento';
const AI_REPLY_SIGNATURE = process.env.AI_REPLY_SIGNATURE || '';

function cleanupText(text) {
  return String(text || '').replace(/\s+\n/g, '\n').trim();
}

function sanitizeExamSummary(text) {
  let out = cleanupText(text);
  if (!out) return out;

  // Remove seção indesejada de "Sugestões..."
  out = out.replace(
    /\n*\*?\*?Sugestões de Próximos Passos para Avaliação Profissional\*?\*?[\s\S]*$/i,
    ''
  );

  // Remove linhas truncadas com marcador de markdown quebrado, ex: "**Realizar"
  const lines = out.split('\n').filter((line) => {
    const t = line.trim();
    if (!t) return true;
    if (t.startsWith('**') && !t.endsWith('**') && !t.includes(':')) return false;
    return true;
  });

  out = cleanupText(lines.join('\n'));
  out = out.replace(/\*\*/g, '');
  // Evita final abrupto muito feio em caso de corte por limite do provedor
  if (out && !/[.!?:…]$/.test(out.trim())) {
    out = `${out.trim()}...`;
  }
  return out;
}

function normalizeForSkipCheck(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\*/g, '');
}

function isScriptedFlowStep(stateStep) {
  if (stateStep == null || stateStep === 0 || stateStep === '0') return false;
  return true;
}

function shouldSkipEnhancement(baseReply) {
  const text = String(baseReply || '');
  const lower = normalizeForSkipCheck(text);

  const hardMarkers = [
    'horarios disponiveis',
    'horarios para',
    'qual procedimento',
    'responda com o numero',
    'responda com o numero do',
    'agendamento confirmado',
    'consulta cancelada',
    'cadastro confirmado',
    'data de nascimento',
    'seja bem-vinda',
    'seja bem-vindo',
    'falar com',
    'se precisar, digite',
    'data:',
    'horario:',
    'procedimento:',
    'nome completo',
    'nao encontramos seu cadastro',
    'foi um prazer ajudar',
    'confirme seu agendamento',
    'lembrete automatico',
    'escolha uma data',
    'reagendada com sucesso',
    'quando quiser, e so digitar',
    'agendar outra consulta',
    'ver seus agendamentos',
    'finalizar atendimento',
    'conheca nossos servicos',
    'para agendar',
    'digite 0',
    'opcao 5',
    'agendar consulta',
    'o que voce gostaria de fazer',
    'como posso ajudar',
    'explore com calma',
    'encontrou o que procurava',
    'servico invalido',
    'procedimento invalido',
    'nao entendi',
    'voce recebera lembretes',
  ];

  if (hardMarkers.some((m) => lower.includes(m))) return true;
  if (/\b\d+\)/.test(text)) return true;
  if (/\*\d+\*/.test(text)) return true;
  if (/^\s*\d+\s*[—–-]/.test(text)) return true;
  if (/^\s*".*"\s*$/s.test(text)) return true;
  return false;
}

async function maybeEnhanceReply(params) {
  const baseReply = cleanupText(params?.baseReply);
  if (!baseReply) return '';
  if (!ENABLE_AI_WHATSAPP_REPLY || !GROQ_API_KEY) return baseReply;
  if (isScriptedFlowStep(params?.stateStep)) return baseReply;
  if (shouldSkipEnhancement(baseReply)) return baseReply;

  try {
    const systemPrompt =
      'Você é assistente de WhatsApp para clínica estética. ' +
      'Reescreva a resposta mantendo exatamente a intenção e os dados (datas, horários, nomes, listas). ' +
      `Use português do Brasil, tom ${AI_REPLY_TONE}. ` +
      `Estilo: ${AI_REPLY_STYLE}. ` +
      `Objetivo: ${AI_REPLY_GOAL}. ` +
      'Não invente informações e não altere estrutura de passos quando houver instruções.';

    const userPrompt = [
      `Mensagem do paciente: "${String(params?.incomingText || '').trim()}"`,
      `Nome do profissional: "${String(params?.professionalName || 'Profissional').trim()}"`,
      AI_REPLY_SIGNATURE ? `Assinatura obrigatória no final: "${AI_REPLY_SIGNATURE}"` : '',
      'Resposta base (reformule sem mudar o conteúdo):',
      baseReply,
    ].filter(Boolean).join('\n\n');

    const { data } = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
        temperature: 0.4,
        max_tokens: 350,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 12000,
      }
    );

    const aiText = cleanupText(data?.choices?.[0]?.message?.content || '');
    if (!aiText) return baseReply;
    if (/^\s*".*"\s*$/s.test(aiText)) return baseReply;
    return aiText;
  } catch (error) {
    logger.warn('Falha ao melhorar resposta com Groq; usando fallback.', {
      message: error?.message,
      status: error?.response?.status,
    });
    return baseReply;
  }
}

async function analyzeExamText(params) {
  const examTextRaw = cleanupText(params?.examText);
  const MAX_EXAM_TEXT_CHARS = 12000;
  const examText = examTextRaw.length > MAX_EXAM_TEXT_CHARS
    ? `${examTextRaw.slice(0, MAX_EXAM_TEXT_CHARS)}\n\n[...texto truncado automaticamente para análise...]`
    : examTextRaw;
  if (!examText) return { summary: 'Não foi possível analisar: texto do exame vazio.' };
  if (!ENABLE_AI_REPLY || !GROQ_API_KEY) {
    return { summary: 'Análise de IA desativada. Defina ENABLE_AI_REPLY=true e GROQ_API_KEY.' };
  }

  try {
    const systemPrompt =
      'Você é um assistente clínico para apoio ao profissional de estética. ' +
      'Analise o texto de exame e responda em português do Brasil, sem diagnosticar. ' +
      'Estruture em: 1) Resumo do exame, 2) Pontos de atenção. ' +
      'Seja objetivo e evite resposta longa. ' +
      'Não inclua seção de sugestões de próximos passos nem recomendações gerais de estilo de vida. ' +
      'Regra crítica: só marque ponto de atenção quando houver evidência textual explícita de alteração ' +
      '(fora do intervalo de referência, sinalizado como alto/baixo/alterado, ou valor incompatível com a faixa mostrada no próprio exame). ' +
      'Não contradiga os intervalos de referência presentes no texto. ' +
      'Se o valor estiver dentro da faixa informada, trate como normal e não inclua em pontos de atenção. ' +
      'Se não houver faixa/flag suficiente para concluir, escreva: "sem evidência conclusiva no laudo". ' +
      'Não liste todos os parâmetros normais individualmente. ' +
      'Quando muitos itens estiverem normais, resuma em uma frase única (ex.: "demais parâmetros sem alterações relevantes"). ' +
      'Nos pontos de atenção, cite no formato: "Parâmetro: valor | referência | motivo". ' +
      'Limite o bloco de "Pontos de atenção" a no máximo 8 bullets. ' +
      'Se não houver alterações relevantes, escreva exatamente: ' +
      '"Pontos de atenção: sem alterações relevantes identificadas no laudo enviado." ' +
      'Entregue a resposta completa, sem interromper palavras no final. ' +
      'Se houver incerteza, deixe explícito.';

    const userPrompt = [
      `Paciente ID: ${String(params?.patientId || '-')}`,
      `Nome do exame: ${String(params?.examName || 'Exame sem nome')}`,
      'Texto do exame:',
      examText,
    ].join('\n\n');

    const { data } = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
        temperature: 0.05,
        max_tokens: 1400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 18000,
      }
    );

    const summary = sanitizeExamSummary(data?.choices?.[0]?.message?.content || '');
    return { summary: summary || 'Não foi possível gerar análise para este exame.' };
  } catch (error) {
    logger.warn('Falha ao analisar exame com Groq.', {
      message: error?.message,
      status: error?.response?.status,
    });
    return { summary: 'Não foi possível analisar este exame no momento.' };
  }
}

module.exports = {
  maybeEnhanceReply,
  analyzeExamText,
};
