const { supabase } = require('../config/supabase');
const { normalizePhone } = require('../store/conversationStateStore');

function promotionHasSlots(row) {
  if (!row) return false;
  const max = row.max_participants;
  if (max == null || max <= 0) return true;
  return Number(row.claimed_count || 0) < max;
}

function derivePromotionStatus(row, menuEnabled) {
  if (!promotionHasSlots(row)) return 'exhausted';
  if (menuEnabled) return 'active';
  return 'completed';
}

async function insertPromotion(row) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('whatsapp_promotions')
    .insert(row)
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function updatePromotionStats(promotionId, stats) {
  if (!supabase || !promotionId) return;

  const patch = {
    status: stats.status || 'completed',
    total_recipients: stats.totalRecipients ?? 0,
    sent_count: stats.sentCount ?? 0,
    failed_count: stats.failedCount ?? 0,
    claimed_count: stats.claimedCount ?? undefined,
    completed_at: new Date().toISOString(),
  };
  Object.keys(patch).forEach((key) => {
    if (patch[key] === undefined) delete patch[key];
  });

  const { error } = await supabase.from('whatsapp_promotions').update(patch).eq('id', promotionId);

  if (error) throw new Error(error.message);
}

async function getPromotionById(promotionId, professionalId) {
  if (!supabase || !promotionId || !professionalId) return null;

  const { data, error } = await supabase
    .from('whatsapp_promotions')
    .select('*')
    .eq('id', promotionId)
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function listActiveMenuPromotions(professionalId) {
  if (!supabase || !professionalId) return [];

  let { data, error } = await supabase
    .from('whatsapp_promotions')
    .select(
      'id, title, message_text, details_text, content_type, media_url, media_mime_type, max_participants, claimed_count, sold_out_message, procedure_id, created_at'
    )
    .eq('professional_id', professionalId)
    .eq('menu_enabled', true)
    .in('status', ['active', 'completed'])
    .order('created_at', { ascending: false })
    .limit(20);

  if (error && /procedure_id|column/i.test(error.message || '')) {
    ({ data, error } = await supabase
      .from('whatsapp_promotions')
      .select(
        'id, title, message_text, details_text, content_type, media_url, media_mime_type, max_participants, claimed_count, sold_out_message, created_at'
      )
      .eq('professional_id', professionalId)
      .eq('menu_enabled', true)
      .in('status', ['active', 'completed'])
      .order('created_at', { ascending: false })
      .limit(20));
  }

  if (error) throw new Error(error.message);

  return (data || []).filter((row) => promotionHasSlots(row));
}

async function hasPromotionRecipient(promotionId, phone) {
  if (!supabase || !promotionId || !phone) return false;

  const normalized = normalizePhone(phone);
  const { data, error } = await supabase
    .from('whatsapp_promotion_recipients')
    .select('id')
    .eq('promotion_id', promotionId)
    .eq('phone', normalized)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

async function recordPromotionRecipient({ promotionId, professionalId, patientId, phone, source }) {
  if (!supabase) return;

  const normalized = normalizePhone(phone);
  const { error } = await supabase.from('whatsapp_promotion_recipients').insert({
    promotion_id: promotionId,
    professional_id: professionalId,
    patient_id: patientId || null,
    phone: normalized,
    source,
  });

  if (error) {
    if (error.code === '23505') return;
    throw new Error(error.message);
  }
}

async function hasPromotionBooking(promotionId, phone) {
  if (!supabase || !promotionId || !phone) return false;

  const normalized = normalizePhone(phone);
  const { data, error } = await supabase
    .from('whatsapp_promotion_bookings')
    .select('id')
    .eq('promotion_id', promotionId)
    .eq('phone', normalized)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

async function recordPromotionBooking({ promotionId, professionalId, appointmentId, patientId, phone }) {
  if (!supabase) return;

  const normalized = normalizePhone(phone);
  const { error } = await supabase.from('whatsapp_promotion_bookings').insert({
    promotion_id: promotionId,
    professional_id: professionalId,
    appointment_id: appointmentId || null,
    patient_id: patientId || null,
    phone: normalized,
  });

  if (error) {
    if (error.code === '23505') return;
    throw new Error(error.message);
  }
}

async function incrementPromotionClaimedCount(promotionId, professionalId, menuEnabled) {
  if (!supabase || !promotionId) return null;

  const current = await getPromotionById(promotionId, professionalId);
  if (!current) return null;

  const nextClaimed = Number(current.claimed_count || 0) + 1;
  const status = derivePromotionStatus(
    { ...current, claimed_count: nextClaimed },
    menuEnabled ?? current.menu_enabled
  );

  const { data, error } = await supabase
    .from('whatsapp_promotions')
    .update({
      claimed_count: nextClaimed,
      status,
    })
    .eq('id', promotionId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function tryReservePromotionBooking({
  promotionId,
  professionalId,
  phone,
  appointmentId,
  patientId,
}) {
  const promotion = await getPromotionById(promotionId, professionalId);
  if (!promotion) return { ok: false, reason: 'not_found' };
  if (!promotionHasSlots(promotion)) return { ok: false, reason: 'sold_out' };
  if (await hasPromotionBooking(promotionId, phone)) {
    return { ok: false, reason: 'already_booked' };
  }

  await recordPromotionBooking({
    promotionId,
    professionalId,
    appointmentId,
    patientId,
    phone,
  });

  const updated = await incrementPromotionClaimedCount(
    promotionId,
    professionalId,
    promotion.menu_enabled
  );

  return { ok: true, promotion: updated || promotion };
}

module.exports = {
  insertPromotion,
  updatePromotionStats,
  getPromotionById,
  listActiveMenuPromotions,
  hasPromotionRecipient,
  recordPromotionRecipient,
  hasPromotionBooking,
  recordPromotionBooking,
  incrementPromotionClaimedCount,
  tryReservePromotionBooking,
  promotionHasSlots,
  derivePromotionStatus,
};
