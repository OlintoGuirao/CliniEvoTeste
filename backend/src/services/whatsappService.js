const https = require('https');
const axios = require('axios');
const { logger } = require('../utils/logger');
const { setWhatsappInstanceByProfessionalId } = require('../repositories/professionalRepository');

const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/+$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_TLS_INSECURE = String(process.env.EVOLUTION_TLS_INSECURE || '').toLowerCase() === 'true';

if (!EVOLUTION_API_URL) logger.warn('EVOLUTION_API_URL não definida no .env');
if (!EVOLUTION_API_KEY) logger.warn('EVOLUTION_API_KEY não definida no .env');
if (EVOLUTION_TLS_INSECURE) {
  logger.warn('EVOLUTION_TLS_INSECURE=true — certificado SSL da Evolution API não será validado');
}

function evolutionRequestConfig(extra = {}) {
  if (!EVOLUTION_TLS_INSECURE) return extra;
  return {
    ...extra,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  };
}

function requireEvolutionConfig() {
  if (!EVOLUTION_API_URL) throw new Error('EVOLUTION_API_URL não configurada');
  if (!EVOLUTION_API_KEY) throw new Error('EVOLUTION_API_KEY não configurada');
  return { baseUrl: EVOLUTION_API_URL, apiKey: EVOLUTION_API_KEY };
}

function evolutionHeaders(apiKey) {
  return {
    apikey: apiKey,
    'Content-Type': 'application/json',
  };
}

function normalizePhoneForEvolution(number) {
  const raw = String(number || '').trim();
  if (!raw) return '';
  // Grupo ou JID completo (Evolution aceita remoteJid)
  if (raw.includes('@')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/** Variantes BR (com/sem o 9 após o DDD) — Evolution valida se o número existe. */
function brazilPhoneSendCandidates(number) {
  const primary = normalizePhoneForEvolution(number);
  if (!primary) return [];
  if (primary.includes('@')) return [primary];

  const out = [];
  const add = (n) => {
    const v = String(n || '').replace(/\D/g, '');
    if (v && !out.includes(v)) out.push(v);
  };
  add(primary);

  if (primary.startsWith('55') && primary.length === 13) {
    const ddd = primary.slice(2, 4);
    const local = primary.slice(4);
    if (local.startsWith('9') && local.length === 9) {
      add(`55${ddd}${local.slice(1)}`);
    }
  }

  if (primary.startsWith('55') && primary.length === 12) {
    const ddd = primary.slice(2, 4);
    const local = primary.slice(4);
    if (local.length === 8 && !local.startsWith('9')) {
      add(`55${ddd}9${local}`);
    }
  }

  return out;
}

function formatEvolutionSendError(error) {
  const data = error?.response?.data;
  const status = error?.response?.status;
  const nested = data?.response?.message;
  const list = Array.isArray(nested) ? nested : nested ? [nested] : [];

  for (const item of list) {
    if (item && typeof item === 'object' && item.exists === false) {
      const num = item.number || item.jid || '';
      return new Error(
        `Este telefone não tem WhatsApp (ou está com DDD/número inválido)${num ? `: ${num}` : ''}.`
      );
    }
    if (typeof item === 'string' && item.trim()) {
      return new Error(item.trim());
    }
  }

  if (typeof data?.message === 'string' && data.message.trim()) {
    return new Error(data.message.trim());
  }
  if (typeof data?.error === 'string' && data.error.trim() && data.error !== 'Bad Request') {
    return new Error(data.error.trim());
  }

  return new Error(
    error?.message
      ? `Falha na Evolution (${status || 'erro'}): ${error.message}`
      : 'Falha ao enviar pelo WhatsApp conectado.'
  );
}

function normalizeQrString(raw) {
  if (!raw) return null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:image')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 64) {
    return `data:image/png;base64,${trimmed}`;
  }
  return null;
}

function pickQrFromEvolutionPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  // pairingCode NÃO é QR (é texto curto tipo ABCD-EFGH)
  const candidates = [
    payload.base64,
    payload.qrcode?.base64,
    typeof payload.qrcode === 'string' ? payload.qrcode : null,
    payload.code,
    payload?.qrcode?.code,
  ];
  for (const item of candidates) {
    const qr = normalizeQrString(typeof item === 'string' ? item : null);
    if (qr) return qr;
  }
  return null;
}

function pickPairingCodeFromEvolutionPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const candidates = [
    payload.pairingCode,
    payload.qrcode?.pairingCode,
    payload.data?.pairingCode,
    payload.instance?.pairingCode,
  ];
  for (const item of candidates) {
    if (item == null || item === '') continue;
    // Aceita "ABCD-EFGH", "ABCDEFGH" ou 8 dígitos
    const code = String(item)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '');
    const compact = code.replace(/-/g, '');
    if (compact.length >= 6 && compact.length <= 12) return code;
  }
  return null;
}

function extractConnectionState(payload) {
  if (!payload || typeof payload !== 'object') return '';

  const direct = [
    payload.state,
    payload.connectionStatus,
    payload.status,
    payload.instance?.state,
    payload.instance?.connectionStatus,
    payload.instance?.status,
    payload.data?.state,
    payload.data?.instance?.state,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());

  if (direct.length) return direct[0];

  const queue = [payload];
  const seen = new Set();
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    for (const key of ['state', 'connectionStatus', 'status']) {
      if (node[key]) return String(node[key]).toLowerCase();
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') queue.push(value);
    }
  }

  return '';
}

function inferConnectedFromEvolutionPayload(payload) {
  const state = extractConnectionState(payload);
  return ['open', 'connected', 'online', 'authenticated', 'ready'].includes(state);
}

function defaultInstanceNameForProfessional(professionalId) {
  const compact = String(professionalId || '').replace(/-/g, '').slice(0, 24);
  return `pro-${compact || 'clinievo'}`;
}

function resolveWebhookUrl() {
  const base = String(
    process.env.CHATBOT_WEBHOOK_PUBLIC_URL ||
      process.env.WEBHOOK_PUBLIC_URL ||
      `http://127.0.0.1:${process.env.PORT || 4000}`
  ).replace(/\/+$/, '');
  return `${base}/webhook/whatsapp`;
}

async function setInstanceWebhook(instanceName) {
  if (!instanceName) return { ok: false, reason: 'instanceName vazio' };

  const { baseUrl, apiKey } = requireEvolutionConfig();
  const webhookUrl = resolveWebhookUrl();
  const url = `${baseUrl}/webhook/set/${encodeURIComponent(instanceName)}`;
  const payloads = [
    {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      webhook_base64: false,
      events: ['MESSAGES_UPSERT'],
    },
    {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        events: ['MESSAGES_UPSERT'],
      },
    },
  ];

  let lastError = null;
  for (const body of payloads) {
    try {
      const { data } = await axios.post(
        url,
        body,
        evolutionRequestConfig({ headers: evolutionHeaders(apiKey), timeout: 15000 })
      );
      logger.info('Webhook Evolution configurado', { instanceName, webhookUrl });
      return { ok: true, webhookUrl, raw: data };
    } catch (error) {
      lastError = error;
    }
  }

  logger.warn('Não foi possível configurar webhook Evolution', {
    instanceName,
    webhookUrl,
    status: lastError?.response?.status,
    message: lastError?.response?.data?.message || lastError?.message,
  });
  return { ok: false, webhookUrl, raw: lastError?.response?.data ?? null };
}

/**
 * Mantém assinatura compatível: sendText(instanceName, number, text)
 */
async function sendText(instanceName, number, text) {
  const { baseUrl, apiKey } = requireEvolutionConfig();
  const resolvedInstance = instanceName;
  if (!resolvedInstance) throw new Error('Nome da instância Evolution não informado');

  const candidates = brazilPhoneSendCandidates(number);
  if (!candidates.length) throw new Error('Telefone inválido para envio');

  const url = `${baseUrl}/message/sendText/${encodeURIComponent(resolvedInstance)}`;
  let lastError = null;

  for (let i = 0; i < candidates.length; i += 1) {
    const phone = candidates[i];
    try {
      const { data } = await axios.post(
        url,
        { number: phone, text: String(text || '') },
        evolutionRequestConfig({ headers: evolutionHeaders(apiKey), timeout: 20000 })
      );

      logger.info('Evolution sendText retorno', {
        instanceName: resolvedInstance,
        to: phone,
        key: data?.key?.id ?? data?.messageId ?? null,
      });

      return {
        id: data?.key?.id ?? data?.messageId ?? null,
        sent: true,
        message: data?.message ?? 'sent',
        raw: data,
      };
    } catch (error) {
      lastError = error;
      const msgList = error?.response?.data?.response?.message;
      const existsFalse = Array.isArray(msgList)
        ? msgList.some((m) => m && typeof m === 'object' && m.exists === false)
        : false;
      logger.warn('Evolution sendText falhou', {
        instanceName: resolvedInstance,
        to: phone,
        status: error?.response?.status,
        body: error?.response?.data,
        willRetry: existsFalse && i < candidates.length - 1,
      });
      if (existsFalse && i < candidates.length - 1) continue;
      throw formatEvolutionSendError(error);
    }
  }

  throw formatEvolutionSendError(lastError);
}

const USE_INTERACTIVE_LISTS =
  String(process.env.WHATSAPP_INTERACTIVE_LISTS ?? 'true').toLowerCase() !== 'false';

async function sendList(instanceName, number, listPayload) {
  const { baseUrl, apiKey } = requireEvolutionConfig();
  const resolvedInstance = instanceName;
  if (!resolvedInstance) throw new Error('Nome da instância Evolution não informado');

  const phone = normalizePhoneForEvolution(number);
  if (!phone) throw new Error('Telefone inválido para envio');

  const url = `${baseUrl}/message/sendList/${encodeURIComponent(resolvedInstance)}`;
  const { data } = await axios.post(
    url,
    {
      number: phone,
      title: String(listPayload.title || 'Opções'),
      description: String(listPayload.description || ''),
      buttonText: String(listPayload.buttonText || 'Ver opções'),
      footerText: String(listPayload.footerText || ''),
      sections: listPayload.sections,
    },
    evolutionRequestConfig({ headers: evolutionHeaders(apiKey), timeout: 20000 })
  );

  logger.info('Evolution sendList retorno', {
    instanceName: resolvedInstance,
    to: phone,
    key: data?.key?.id ?? data?.messageId ?? null,
  });

  return {
    id: data?.key?.id ?? data?.messageId ?? null,
    sent: true,
    message: data?.message ?? 'sent',
    raw: data,
  };
}

async function sendMedia(instanceName, number, params) {
  const { baseUrl, apiKey } = requireEvolutionConfig();
  const resolvedInstance = instanceName;
  if (!resolvedInstance) throw new Error('Nome da instância Evolution não informado');

  const phone = normalizePhoneForEvolution(number);
  if (!phone) throw new Error('Telefone inválido para envio');

  const mediatype = String(params?.mediatype || '').trim();
  const media = String(params?.media || '').trim();
  if (!mediatype || !media) {
    throw new Error('mediatype e media são obrigatórios para envio de mídia');
  }

  const url = `${baseUrl}/message/sendMedia/${encodeURIComponent(resolvedInstance)}`;
  const body = {
    number: phone,
    mediatype,
    media,
  };
  if (params?.mimetype) body.mimetype = params.mimetype;
  if (params?.caption) body.caption = String(params.caption);
  if (params?.fileName) body.fileName = String(params.fileName);

  const { data } = await axios.post(
    url,
    body,
    evolutionRequestConfig({ headers: evolutionHeaders(apiKey), timeout: 60000 })
  );

  logger.info('Evolution sendMedia retorno', {
    instanceName: resolvedInstance,
    to: phone,
    mediatype,
    key: data?.key?.id ?? data?.messageId ?? null,
  });

  return {
    id: data?.key?.id ?? data?.messageId ?? null,
    sent: true,
    message: data?.message ?? 'sent',
    raw: data,
  };
}

async function sendBotReply({ instanceName, number, reply, interactive }) {
  const useList =
    USE_INTERACTIVE_LISTS &&
    interactive?.type === 'list' &&
    Array.isArray(interactive?.payload?.sections) &&
    interactive.payload.sections.length > 0;

  if (useList) {
    try {
      const result = await sendList(instanceName, number, interactive.payload);
      if (interactive.listOnly) {
        return { ...result, mode: 'list' };
      }
      if (reply) {
        await sendText(instanceName, number, reply);
      }
      return { ...result, mode: reply ? 'list+text' : 'list' };
    } catch (error) {
      logger.warn('sendList falhou; fallback sendText', {
        instanceName,
        status: error?.response?.status,
        message: error?.response?.data?.message || error?.message,
      });
    }
  }

  if (reply) {
    const result = await sendText(instanceName, number, reply);
    return { ...result, mode: 'text' };
  }

  return { sent: false, mode: 'none' };
}

async function fetchInstanceConnectionState(instanceName) {
  const { baseUrl, apiKey } = requireEvolutionConfig();
  const url = `${baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`;
  const { data } = await axios.get(
    url,
    evolutionRequestConfig({ headers: evolutionHeaders(apiKey), timeout: 15000 })
  );
  return data;
}

async function createInstance(instanceName, opts = {}) {
  const { baseUrl, apiKey } = requireEvolutionConfig();
  const url = `${baseUrl}/instance/create`;
  const phone = normalizePhoneForEvolution(opts.number);
  const payload = {
    instanceName,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true,
  };
  if (phone) payload.number = phone;

  try {
    const { data } = await axios.post(
      url,
      payload,
      evolutionRequestConfig({ headers: evolutionHeaders(apiKey), timeout: 20000 })
    );
    return { ok: true, raw: data };
  } catch (error) {
    const status = error?.response?.status;
    const message = String(error?.response?.data?.message || error?.message || '');
    if (status === 403 || status === 409 || /already|exists|exist/i.test(message)) {
      logger.info('Instância Evolution já existe', { instanceName });
      return { ok: true, alreadyExists: true, raw: error?.response?.data ?? null };
    }
    throw error;
  }
}

async function connectInstance(instanceName, opts = {}) {
  const { baseUrl, apiKey } = requireEvolutionConfig();
  const phone = normalizePhoneForEvolution(opts.number);
  let url = `${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`;
  if (phone) {
    url += `?number=${encodeURIComponent(phone)}`;
  }
  const { data } = await axios.get(
    url,
    evolutionRequestConfig({ headers: evolutionHeaders(apiKey), timeout: 20000 })
  );
  return data;
}

/**
 * Gera código de pareamento por número (alternativa ao QR).
 * No celular: Aparelhos conectados → Conectar um aparelho → Vincular com número de telefone.
 *
 * A Evolution/Baileys só preenche pairingCode quando o número está no socket.
 * Sessões já em "connecting" costumam devolver pairingCode=null — por isso fazemos
 * logout + retries (e, se preciso, recria a instância com o number).
 */
async function getInstancePairingCode(instanceName, phoneNumber) {
  if (!instanceName) throw new Error('Nome da instância Evolution não informado');
  const phone = normalizePhoneForEvolution(phoneNumber);
  if (!phone || phone.length < 12) {
    throw new Error('Informe o WhatsApp com DDD (ex.: 11999999999)');
  }

  requireEvolutionConfig();
  await ensureInstance(instanceName);

  try {
    await setInstanceWebhook(instanceName);
  } catch (error) {
    logger.warn('Falha ao registrar webhook da instância (pairing)', {
      instanceName,
      message: error?.message,
    });
  }

  const status = await readConnectionStatus(instanceName);
  if (status.connected) {
    return {
      instanceId: instanceName,
      connected: true,
      pairingCode: null,
      phone,
      state: status.state,
      raw: status.raw,
    };
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Limpa sessão presa em connecting (QR antigo sem phoneNumber no socket)
  await disconnectInstance(instanceName);
  await sleep(1200);

  let raw = null;
  let pairingCode = null;
  let connected = false;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      raw = await connectInstance(instanceName, { number: phone });
    } catch (error) {
      logger.warn('Connect com número falhou (pairing)', {
        instanceName,
        phone,
        attempt,
        message: error?.message,
      });
      await sleep(1200);
      continue;
    }

    connected = inferConnectedFromEvolutionPayload(raw);
    pairingCode = pickPairingCodeFromEvolutionPayload(raw);
    if (connected || pairingCode) break;

    logger.info('Aguardando pairingCode da Evolution', { instanceName, phone, attempt });
    await sleep(1500);
  }

  // Último recurso: recria a instância já com o número (Baileys seta phoneNumber no create)
  if (!connected && !pairingCode) {
    logger.warn('Recriando instância Evolution para pairing por número', { instanceName, phone });
    await deleteInstance(instanceName);
    await sleep(800);
    await createInstance(instanceName, { number: phone });
    try {
      await setInstanceWebhook(instanceName);
    } catch {
      /* opcional */
    }
    await sleep(800);

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        raw = await connectInstance(instanceName, { number: phone });
      } catch (error) {
        logger.warn('Connect após recriar instância falhou', {
          instanceName,
          attempt,
          message: error?.message,
        });
        await sleep(1200);
        continue;
      }
      connected = inferConnectedFromEvolutionPayload(raw);
      pairingCode = pickPairingCodeFromEvolutionPayload(raw);
      if (connected || pairingCode) break;
      await sleep(1500);
    }
  }

  if (!connected && !pairingCode) {
    logger.warn('Evolution não retornou pairingCode', {
      instanceName,
      phone,
      keys: raw && typeof raw === 'object' ? Object.keys(raw).slice(0, 12) : [],
      pairingCodeRaw: raw?.pairingCode ?? raw?.qrcode?.pairingCode ?? null,
    });
  }

  return {
    instanceId: instanceName,
    connected,
    pairingCode: connected ? null : pairingCode,
    phone,
    state: extractConnectionState(raw) || status.state,
    raw,
  };
}

async function probeInstanceExists(instanceName) {
  if (!instanceName) return false;
  try {
    requireEvolutionConfig();
    await fetchInstanceConnectionState(instanceName);
    return true;
  } catch (error) {
    const status = error?.response?.status;
    if (status === 404) return false;
    logger.warn('Falha ao verificar se instância Evolution existe', {
      instanceName,
      status,
      message: error?.message,
    });
    // Falha transitória: assume que existe para não reescrever ultramsg_instance_id
    return true;
  }
}

async function ensureInstance(instanceName) {
  if (await probeInstanceExists(instanceName)) {
    return instanceName;
  }
  logger.info('Criando instância Evolution', { instanceName });
  await createInstance(instanceName);
  return instanceName;
}

async function readConnectionStatus(instanceName) {
  if (!instanceName) throw new Error('Nome da instância Evolution não informado');

  try {
    const raw = await fetchInstanceConnectionState(instanceName);
    const state = extractConnectionState(raw);
    const connected = inferConnectedFromEvolutionPayload(raw);
    return {
      instanceId: instanceName,
      connected,
      state,
      qr: null,
      raw,
      exists: true,
    };
  } catch (error) {
    const status = error?.response?.status;
    if (status === 404) {
      return {
        instanceId: instanceName,
        connected: false,
        state: 'close',
        qr: null,
        raw: null,
        exists: false,
      };
    }
    logger.warn('Falha ao consultar connectionState Evolution', {
      instanceName,
      status,
      message: error?.message,
    });
    // Erro de rede/TLS: NÃO tratar como "instância inexistente" (evita sobrescrever ID e logout indireto)
    return {
      instanceId: instanceName,
      connected: false,
      state: 'unknown',
      qr: null,
      raw: null,
      exists: true,
      unknown: true,
    };
  }
}

async function getConnectionStatus(instanceName) {
  requireEvolutionConfig();
  return readConnectionStatus(instanceName);
}

async function resolveInstanceNameForProfessional(professional) {
  if (!professional?.id) throw new Error('Profissional inválido');

  const canonical = defaultInstanceNameForProfessional(professional.id);
  const saved = String(professional.whatsappInstanceId || '').trim();

  if (saved && saved === canonical) {
    return canonical;
  }

  // Preferir sempre a instância já salva no perfil (evita troca silenciosa em falha de probe)
  if (saved) {
    const exists = await probeInstanceExists(saved);
    if (exists) return saved;
    // 404 real: tenta canônico, mas só grava se existir
    if (await probeInstanceExists(canonical)) {
      await setWhatsappInstanceByProfessionalId(professional.id, canonical);
      return canonical;
    }
    return saved;
  }

  if (await probeInstanceExists(canonical)) {
    await setWhatsappInstanceByProfessionalId(professional.id, canonical);
    return canonical;
  }

  await setWhatsappInstanceByProfessionalId(professional.id, canonical);
  return canonical;
}

async function disconnectInstance(instanceName) {
  if (!instanceName) throw new Error('Nome da instância Evolution não informado');
  const { baseUrl, apiKey } = requireEvolutionConfig();
  const url = `${baseUrl}/instance/logout/${encodeURIComponent(instanceName)}`;

  try {
    const { data } = await axios.delete(
      url,
      evolutionRequestConfig({ headers: evolutionHeaders(apiKey), timeout: 15000 })
    );
    return { ok: true, instanceId: instanceName, raw: data };
  } catch (error) {
    logger.warn('Falha ao desconectar instância Evolution', {
      instanceName,
      status: error?.response?.status,
      message: error?.message,
    });
    return { ok: false, instanceId: instanceName, raw: error?.response?.data ?? null };
  }
}

async function deleteInstance(instanceName) {
  if (!instanceName) return { ok: false };
  const { baseUrl, apiKey } = requireEvolutionConfig();
  const url = `${baseUrl}/instance/delete/${encodeURIComponent(instanceName)}`;
  try {
    const { data } = await axios.delete(
      url,
      evolutionRequestConfig({ headers: evolutionHeaders(apiKey), timeout: 15000 })
    );
    return { ok: true, raw: data };
  } catch (error) {
    logger.warn('Falha ao excluir instância Evolution', {
      instanceName,
      status: error?.response?.status,
      message: error?.message,
    });
    return { ok: false, raw: error?.response?.data ?? null };
  }
}

/**
 * Força uma sessão limpa quando o QR some ou o pareamento fica preso
 * ("Não foi possível conectar" no app do WhatsApp).
 */
async function restartInstanceSession(instanceName) {
  logger.info('Reiniciando sessão Evolution para novo QR', { instanceName });
  await disconnectInstance(instanceName);
  await new Promise((r) => setTimeout(r, 800));
  try {
    return await connectInstance(instanceName);
  } catch (error) {
    logger.warn('Connect após logout falhou; recriando instância', {
      instanceName,
      message: error?.message,
    });
    await deleteInstance(instanceName);
    await new Promise((r) => setTimeout(r, 500));
    await createInstance(instanceName);
    try {
      await setInstanceWebhook(instanceName);
    } catch {
      /* webhook opcional no pareamento */
    }
    return await connectInstance(instanceName);
  }
}

async function getInstanceQr(instanceName, opts = {}) {
  const forceRestart = Boolean(opts.forceRestart);
  if (!instanceName) throw new Error('Nome da instância Evolution não informado');
  requireEvolutionConfig();

  await ensureInstance(instanceName);

  try {
    await setInstanceWebhook(instanceName);
  } catch (error) {
    logger.warn('Falha ao registrar webhook da instância', {
      instanceName,
      message: error?.message,
    });
  }

  const status = await readConnectionStatus(instanceName);
  if (status.connected) {
    return {
      instanceId: instanceName,
      qr: null,
      raw: status.raw,
      connected: true,
      state: status.state,
    };
  }

  // Poll/auto-refresh NÃO pode dar logout — isso derruba WhatsApp do profissional único.
  // Restart agressivo só com forceRestart=true (botão explícito "Atualizar QR").
  let connectRaw;
  try {
    connectRaw = await connectInstance(instanceName);
  } catch (error) {
    logger.warn('Connect Evolution falhou', {
      instanceName,
      forceRestart,
      message: error?.message,
    });
    if (forceRestart) {
      connectRaw = await restartInstanceSession(instanceName);
    } else {
      return {
        instanceId: instanceName,
        qr: null,
        raw: status.raw,
        connected: false,
        state: status.state || 'unknown',
      };
    }
  }

  let connected = inferConnectedFromEvolutionPayload(connectRaw) || status.connected;
  let state = extractConnectionState(connectRaw) || status.state;
  let qr = pickQrFromEvolutionPayload(connectRaw);

  if (!connected && !qr && forceRestart) {
    connectRaw = await restartInstanceSession(instanceName);
    connected = inferConnectedFromEvolutionPayload(connectRaw);
    state = extractConnectionState(connectRaw) || state;
    qr = pickQrFromEvolutionPayload(connectRaw);
  }

  if (connected) {
    return {
      instanceId: instanceName,
      qr: null,
      raw: connectRaw ?? status.raw,
      connected: true,
      state,
    };
  }

  return {
    instanceId: instanceName,
    qr,
    raw: connectRaw ?? status.raw,
    connected: false,
    state,
  };
}

async function findChats(instanceName) {
  if (!instanceName) throw new Error('Nome da instância Evolution não informado');
  const { baseUrl, apiKey } = requireEvolutionConfig();
  const url = `${baseUrl}/chat/findChats/${encodeURIComponent(instanceName)}`;

  const tryPost = async (body) => {
    const { data } = await axios.post(
      url,
      body,
      evolutionRequestConfig({ headers: evolutionHeaders(apiKey), timeout: 45000 })
    );
    return data;
  };

  let data;
  try {
    data = await tryPost({ where: {}, take: 500, skip: 0 });
  } catch (error) {
    try {
      data = await tryPost({});
    } catch (err2) {
      // Algumas versões usam GET
      try {
        const { data: getData } = await axios.get(
          url,
          evolutionRequestConfig({ headers: evolutionHeaders(apiKey), timeout: 45000 })
        );
        data = getData;
      } catch (err3) {
        logger.warn('Falha ao listar chats Evolution', {
          instanceName,
          message: err3?.response?.data?.message || err3?.message || err2?.message || error?.message,
        });
        throw err3;
      }
    }
  }

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.chats)) return data.chats;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.records)) return data.records;
  return [];
}

async function findContacts(instanceName) {
  if (!instanceName) throw new Error('Nome da instância Evolution não informado');
  const { baseUrl, apiKey } = requireEvolutionConfig();
  const url = `${baseUrl}/chat/findContacts/${encodeURIComponent(instanceName)}`;

  const tryPost = async (body) => {
    const { data } = await axios.post(
      url,
      body,
      evolutionRequestConfig({ headers: evolutionHeaders(apiKey), timeout: 45000 })
    );
    return data;
  };

  let data;
  try {
    data = await tryPost({ where: {}, take: 500, skip: 0 });
  } catch (error) {
    try {
      data = await tryPost({});
    } catch (err2) {
      logger.warn('Falha ao listar contatos Evolution', {
        instanceName,
        message: err2?.response?.data?.message || err2?.message || error?.message,
      });
      return [];
    }
  }

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.contacts)) return data.contacts;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

module.exports = {
  sendText,
  sendMedia,
  sendList,
  sendBotReply,
  createInstance,
  connectInstance,
  ensureInstance,
  getInstanceQr,
  getInstancePairingCode,
  getConnectionStatus,
  resolveInstanceNameForProfessional,
  probeInstanceExists,
  extractConnectionState,
  disconnectInstance,
  defaultInstanceNameForProfessional,
  inferConnectedFromEvolutionPayload,
  setInstanceWebhook,
  resolveWebhookUrl,
  findChats,
  findContacts,
  normalizePhoneForEvolution,
};
