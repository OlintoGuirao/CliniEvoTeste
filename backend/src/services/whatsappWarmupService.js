const { supabase } = require('../config/supabase');
const { logger } = require('../utils/logger');

/** Limites diários progressivos (dias desde o início do warm-up). */
const WARMUP_TIERS = [
  { maxDay: 2, limit: 20 },
  { maxDay: 6, limit: 50 },
  { maxDay: 13, limit: 100 },
  { maxDay: 20, limit: 250 },
  { maxDay: 29, limit: 500 },
  { maxDay: Infinity, limit: 1000 },
];

function todayYmdSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function daysSinceStart(startedAtIso) {
  if (!startedAtIso) return 0;
  const start = new Date(startedAtIso);
  if (Number.isNaN(start.getTime())) return 0;
  const startDay = new Date(start.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  startDay.setHours(0, 0, 0, 0);
  const nowDay = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  nowDay.setHours(0, 0, 0, 0);
  const diff = Math.floor((nowDay.getTime() - startDay.getTime()) / 86400000);
  return Math.max(0, diff);
}

function dailyLimitForDay(dayIndex) {
  for (const tier of WARMUP_TIERS) {
    if (dayIndex <= tier.maxDay) return tier.limit;
  }
  return WARMUP_TIERS[WARMUP_TIERS.length - 1].limit;
}

async function getWarmupSettings(professionalId) {
  if (!supabase || !professionalId) {
    return { enabled: true, startedAt: null };
  }
  const { data, error } = await supabase
    .from('professional_ui_settings')
    .select('whatsapp_send_warmup_enabled, whatsapp_send_warmup_started_at')
    .eq('professional_id', professionalId)
    .maybeSingle();
  if (error) {
    logger.warn('Falha ao ler trava de maturidade WhatsApp', {
      professionalId,
      message: error.message,
    });
    return { enabled: true, startedAt: null };
  }
  return {
    enabled: data?.whatsapp_send_warmup_enabled !== false,
    startedAt: data?.whatsapp_send_warmup_started_at || null,
  };
}

async function ensureWarmupStarted(professionalId, startedAt) {
  if (startedAt || !supabase || !professionalId) return startedAt;
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('professional_ui_settings')
    .update({ whatsapp_send_warmup_started_at: nowIso })
    .eq('professional_id', professionalId)
    .is('whatsapp_send_warmup_started_at', null);
  if (error) {
    logger.warn('Falha ao gravar início do warm-up WhatsApp', {
      professionalId,
      message: error.message,
    });
    return nowIso;
  }
  return nowIso;
}

/**
 * Reserva 1 envio no limite diário do profissional.
 * Se a trava estiver desligada, libera sem contar.
 * @throws {Error} quando o limite do dia foi atingido
 */
async function reserveOutboundSend(professionalId) {
  if (!professionalId) return { allowed: true, skipped: true };

  const settings = await getWarmupSettings(professionalId);
  if (!settings.enabled) {
    return { allowed: true, skipped: true, enabled: false };
  }

  const startedAt = await ensureWarmupStarted(professionalId, settings.startedAt);
  const dayIndex = daysSinceStart(startedAt);
  const limit = dailyLimitForDay(dayIndex);
  const sendDate = todayYmdSaoPaulo();

  if (!supabase) {
    return { allowed: true, skipped: true, enabled: true, limit, dayIndex };
  }

  const { data: existing, error: readError } = await supabase
    .from('whatsapp_daily_send_counts')
    .select('send_count')
    .eq('professional_id', professionalId)
    .eq('send_date', sendDate)
    .maybeSingle();

  if (readError) {
    logger.warn('Falha ao ler contagem diária WhatsApp; permitindo envio', {
      professionalId,
      message: readError.message,
    });
    return { allowed: true, skipped: true, enabled: true, limit, dayIndex };
  }

  const current = Number(existing?.send_count || 0);
  if (current >= limit) {
    const err = new Error(
      `Trava de maturidade: limite diário de ${limit} disparos de promoção atingido (dia ${dayIndex + 1} do warm-up).`
    );
    err.code = 'WHATSAPP_WARMUP_LIMIT';
    err.limit = limit;
    err.used = current;
    err.dayIndex = dayIndex;
    throw err;
  }

  const next = current + 1;
  const { error: upsertError } = await supabase.from('whatsapp_daily_send_counts').upsert(
    {
      professional_id: professionalId,
      send_date: sendDate,
      send_count: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'professional_id,send_date' }
  );

  if (upsertError) {
    logger.warn('Falha ao incrementar contagem diária WhatsApp; permitindo envio', {
      professionalId,
      message: upsertError.message,
    });
    return { allowed: true, skipped: true, enabled: true, limit, dayIndex, used: current };
  }

  return { allowed: true, enabled: true, limit, dayIndex, used: next };
}

module.exports = {
  reserveOutboundSend,
  dailyLimitForDay,
  daysSinceStart,
  WARMUP_TIERS,
};
