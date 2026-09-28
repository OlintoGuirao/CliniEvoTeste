const { supabase } = require('../config/supabase');
const { findProfessionalById } = require('../repositories/professionalRepository');
const { sendText, resolveInstanceNameForProfessional } = require('./whatsappService');
const { logger } = require('../utils/logger');

async function resolveWhatsappProfessional({
  bookingProfessionalId,
  patientProfessionalId,
  requestProfessionalId,
}) {
  const candidateIds = [
    bookingProfessionalId,
    patientProfessionalId,
    requestProfessionalId,
  ].filter(Boolean);

  const seen = new Set();
  for (const id of candidateIds) {
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    const pro = await findProfessionalById(id);
    if (!pro) continue;
    // Mesmo critério do status/QR: resolve (e persiste) a instância canônica se preciso.
    try {
      const instanceId = await resolveInstanceNameForProfessional(pro);
      if (instanceId) {
        return { ...pro, whatsappInstanceId: instanceId, ultramsgInstanceId: instanceId };
      }
    } catch (e) {
      logger.warn('resolveInstanceNameForProfessional falhou', {
        professionalId: pro.id,
        message: e?.message || e,
      });
    }
    if (pro.whatsappInstanceId) return pro;
  }

  // Fallback: dono da organização do profissional logado / do booking
  for (const id of candidateIds) {
    const key = `org:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { data: membership, error } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', id)
      .limit(1)
      .maybeSingle();
    if (error) {
      logger.warn('organization_members lookup falhou', error.message);
      continue;
    }
    if (!membership?.organization_id) continue;

    const { data: owner, error: ownerErr } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', membership.organization_id)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle();
    if (ownerErr) {
      logger.warn('organization owner lookup falhou', ownerErr.message);
      continue;
    }
    if (!owner?.user_id || seen.has(String(owner.user_id))) continue;
    seen.add(String(owner.user_id));
    const ownerPro = await findProfessionalById(owner.user_id);
    if (!ownerPro) continue;
    try {
      const instanceId = await resolveInstanceNameForProfessional(ownerPro);
      if (instanceId) {
        return {
          ...ownerPro,
          whatsappInstanceId: instanceId,
          ultramsgInstanceId: instanceId,
        };
      }
    } catch (e) {
      logger.warn('resolveInstanceNameForProfessional (owner) falhou', {
        professionalId: ownerPro.id,
        message: e?.message || e,
      });
    }
    if (ownerPro.whatsappInstanceId) return ownerPro;
  }

  throw new Error(
    'WhatsApp não conectado. Vincule em Configurações → Secretária WhatsApp (conta do profissional ou do salão).'
  );
}

async function sendSalonAppointmentConfirm({
  professionalId,
  bookingProfessionalId,
  patientId,
  phone,
  message,
}) {
  const text = String(message || '').trim();
  if (!text) throw new Error('Mensagem vazia.');

  let resolvedPhone = String(phone || '').trim();
  let patientProfessionalId = null;

  if (patientId) {
    const { data: patient, error } = await supabase
      .from('patients')
      .select('id, phone, professional_id')
      .eq('id', patientId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (patient?.phone) resolvedPhone = String(patient.phone).trim();
    patientProfessionalId = patient?.professional_id || null;
  }

  if (!resolvedPhone) {
    throw new Error('Cadastre o telefone do cliente para enviar a confirmação.');
  }

  const whatsappProfessional = await resolveWhatsappProfessional({
    bookingProfessionalId: bookingProfessionalId || null,
    patientProfessionalId,
    requestProfessionalId: professionalId,
  });

  const result = await sendText(whatsappProfessional.whatsappInstanceId, resolvedPhone, text);

  return {
    ok: true,
    messageId: result?.id || null,
    instanceProfessionalId: whatsappProfessional.id,
  };
}

module.exports = {
  sendSalonAppointmentConfirm,
};
