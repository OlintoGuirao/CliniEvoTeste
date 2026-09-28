const { logger } = require('../utils/logger');
const { supabase } = require('../config/supabase');
const { findProfessionalById } = require('../repositories/professionalRepository');
const { sendMedia } = require('./whatsappService');
const axios = require('axios');

function buildSalonSessionPhotosCaption({
  patientName,
  professionalName,
  sessionDateLabel,
  procedureNames,
  photoIndex,
  photoTotal,
}) {
  const patient = String(patientName || 'Cliente').trim() || 'Cliente';
  const professional = String(professionalName || 'nós').trim() || 'nós';
  const datePart = sessionDateLabel ? ` em *${sessionDateLabel}*` : '';
  const procedurePart =
    Array.isArray(procedureNames) && procedureNames.length > 0
      ? ` (${procedureNames.join(' · ')})`
      : '';

  if (photoTotal <= 1) {
    return (
      `Olá, ${patient}! Segue a foto do seu atendimento${procedurePart}${datePart} com ${professional}. ` +
      'Qualquer dúvida, estamos à disposição.'
    );
  }

  if (photoIndex === 0) {
    return (
      `Olá, ${patient}! Seguem as fotos do seu atendimento${procedurePart}${datePart} com ${professional}. ` +
      `(${photoIndex + 1}/${photoTotal})`
    );
  }

  return `Foto ${photoIndex + 1}/${photoTotal}`;
}

function guessMimeFromUrl(url) {
  const lower = String(url || '').toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.gif')) return 'image/gif';
  return 'image/jpeg';
}

async function fetchImageAsBase64(url) {
  const trimmed = String(url || '').trim();
  if (!trimmed) throw new Error('URL da foto inválida.');
  const res = await axios.get(trimmed, {
    responseType: 'arraybuffer',
    timeout: 45000,
    maxContentLength: 15 * 1024 * 1024,
  });
  const mime =
    String(res.headers['content-type'] || '')
      .split(';')[0]
      .trim() || guessMimeFromUrl(trimmed);
  const base64 = Buffer.from(res.data).toString('base64');
  return { base64, mime };
}

async function isOrgOwnerForTeamProfessional(actorId, teamProfessionalId) {
  if (!actorId || !teamProfessionalId || String(actorId) === String(teamProfessionalId)) {
    return false;
  }
  const { data, error } = await supabase.rpc('is_org_team_professional', {
    p_professional_id: teamProfessionalId,
    p_actor_id: actorId,
  });
  if (error) {
    logger.warn('is_org_team_professional indisponível', error.message);
    return false;
  }
  return data === true;
}

async function assertCanAccessSalonSessionPhotos({
  patient,
  session,
  actorProfessionalId,
}) {
  const patientProId = patient?.professional_id;
  const sessionProId = session?.professional_id;
  const actorId = actorProfessionalId;

  if (patientProId && String(patientProId) === String(actorId)) return;
  if (sessionProId && String(sessionProId) === String(actorId)) return;

  if (patientProId && (await isOrgOwnerForTeamProfessional(actorId, patientProId))) {
    return;
  }
  if (sessionProId && (await isOrgOwnerForTeamProfessional(actorId, sessionProId))) {
    return;
  }

  throw new Error('Sem permissão para enviar fotos deste paciente.');
}

async function resolveWhatsappProfessional({ sessionProfessionalId, patientProfessionalId, requestProfessionalId }) {
  const candidateIds = [
    sessionProfessionalId,
    patientProfessionalId,
    requestProfessionalId,
  ].filter(Boolean);

  const seen = new Set();
  for (const id of candidateIds) {
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    const pro = await findProfessionalById(id);
    if (pro?.whatsappInstanceId) return pro;
  }

  throw new Error(
    'WhatsApp não conectado. Vincule em Configurações → Secretária WhatsApp (conta do profissional ou do salão).'
  );
}

async function fetchSessionPhotosForPatient({ patientId, sessionId, actorProfessionalId }) {
  const { data: session, error: sessionError } = await supabase
    .from('patient_sessions')
    .select('id, patient_id, session_date, observacoes, professional_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionError) throw new Error(sessionError.message);
  if (!session) throw new Error('Sessão não encontrada.');
  if (String(session.patient_id) !== String(patientId)) {
    throw new Error('Sessão não pertence a este paciente.');
  }

  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('id, full_name, phone, professional_id')
    .eq('id', patientId)
    .maybeSingle();

  if (patientError) throw new Error(patientError.message);
  if (!patient) throw new Error('Paciente não encontrado.');

  await assertCanAccessSalonSessionPhotos({
    patient,
    session,
    actorProfessionalId,
  });

  if (!patient.phone) {
    throw new Error('Cadastre o telefone do paciente para enviar as fotos.');
  }

  const { data: photos, error: photosError } = await supabase
    .from('patient_session_photos')
    .select('id, file_url, sort_order')
    .eq('patient_session_id', sessionId)
    .order('sort_order', { ascending: true });

  if (photosError) throw new Error(photosError.message);

  const photoUrls = (photos || [])
    .map((p) => String(p.file_url || '').trim())
    .filter(Boolean);

  if (photoUrls.length === 0) {
    throw new Error('Esta sessão não possui fotos para enviar.');
  }

  return {
    patient,
    session,
    photoUrls,
  };
}

async function sendSalonSessionPhotos({
  professionalId,
  patientId,
  sessionId,
  sessionDateLabel,
  procedureNames,
  sessionProfessionalId,
}) {
  const { patient, session, photoUrls } = await fetchSessionPhotosForPatient({
    patientId,
    sessionId,
    actorProfessionalId: professionalId,
  });

  const whatsappProfessional = await resolveWhatsappProfessional({
    sessionProfessionalId: sessionProfessionalId || session.professional_id,
    patientProfessionalId: patient.professional_id,
    requestProfessionalId: professionalId,
  });

  const sessionPro =
    (session.professional_id && (await findProfessionalById(session.professional_id))) ||
    whatsappProfessional;
  const captionProfessionalName = sessionPro.displayName || whatsappProfessional.displayName;

  const messageIds = [];
  for (let i = 0; i < photoUrls.length; i += 1) {
    const caption = buildSalonSessionPhotosCaption({
      patientName: patient.full_name,
      professionalName: captionProfessionalName,
      sessionDateLabel,
      procedureNames,
      photoIndex: i,
      photoTotal: photoUrls.length,
    });

    const { base64, mime } = await fetchImageAsBase64(photoUrls[i]);

    const result = await sendMedia(whatsappProfessional.whatsappInstanceId, patient.phone, {
      mediatype: 'image',
      media: base64,
      mimetype: mime,
      caption,
      fileName: `atendimento-${i + 1}.jpg`,
    });
    messageIds.push(result.id);
  }

  logger.info('Fotos de sessão salão enviadas', {
    professionalId,
    whatsappProfessionalId: whatsappProfessional.id,
    patientId,
    sessionId,
    photoCount: photoUrls.length,
    messageIds,
  });

  return {
    ok: true,
    sent: true,
    photoCount: photoUrls.length,
    patientName: patient.full_name || 'Cliente',
  };
}

module.exports = {
  buildSalonSessionPhotosCaption,
  sendSalonSessionPhotos,
};
