const { logger } = require('../utils/logger');
const { supabase } = require('../config/supabase');
const { findProfessionalById } = require('../repositories/professionalRepository');
const { sendMedia } = require('./whatsappService');
const {
  buildCobrancaPixMessage,
  generatePixBrCodeAndQrBase64,
} = require('../lib/pixQr');

async function fetchProfessionalPixSettings(professionalId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('pix_key, pix_key_type, pix_receiver_name, full_name, app_name')
    .eq('id', professionalId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.pix_key) throw new Error('Cadastre sua chave PIX em Cobrança antes de enviar.');

  const personalName = data.full_name || 'Profissional';
  const displayName = String(data.app_name || '').trim() || personalName;
  const receiverName = String(data.pix_receiver_name || '').trim() || displayName;

  return {
    pixKey: String(data.pix_key).trim(),
    receiverName,
    displayName,
  };
}

async function fetchPatientForCharge(patientId, professionalId) {
  const { data, error } = await supabase
    .from('patients')
    .select('id, full_name, phone, professional_id')
    .eq('id', patientId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Paciente não encontrado.');
  if (String(data.professional_id) !== String(professionalId)) {
    throw new Error('Paciente não pertence a este profissional.');
  }
  if (!data.phone) throw new Error('Cadastre o telefone do paciente para enviar a cobrança.');

  return data;
}

async function sendCobrancaPix({ professionalId, patientId, amount, description, message }) {
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error('Informe um valor válido para a cobrança.');
  }

  const professional = await findProfessionalById(professionalId);
  if (!professional) throw new Error('Profissional não encontrado.');
  if (!professional.whatsappInstanceId) {
    throw new Error('WhatsApp não conectado. Vincule em Configurações → Secretária WhatsApp.');
  }

  const pixSettings = await fetchProfessionalPixSettings(professionalId);
  const patient = await fetchPatientForCharge(patientId, professionalId);

  const { brCode, base64 } = await generatePixBrCodeAndQrBase64({
    pixKey: pixSettings.pixKey,
    receiverName: pixSettings.receiverName,
    amount: parsedAmount,
    description,
  });

  const caption =
    typeof message === 'string' && message.trim()
      ? message.trim()
      : buildCobrancaPixMessage({
          patientName: patient.full_name || 'Paciente',
          professionalName: professional.displayName,
          amount: parsedAmount,
          description,
        });

  const mediaResult = await sendMedia(professional.whatsappInstanceId, patient.phone, {
    mediatype: 'image',
    media: base64,
    mimetype: 'image/png',
    // Em WhatsApp, a legenda do media aparece abaixo do QR Code.
    caption,
    fileName: 'pix-cobranca.png',
  });

  logger.info('Cobrança PIX enviada', {
    professionalId,
    patientId,
    amount: parsedAmount,
    mediaMessageId: mediaResult.id,
  });

  return {
    ok: true,
    sent: true,
    patientName: patient.full_name || 'Paciente',
    amount: parsedAmount,
    brCode,
    mediaMessageId: mediaResult.id,
  };
}

async function previewPixQr({ pixKey, receiverName, amount, description }) {
  if (!String(pixKey || '').trim()) {
    throw new Error('Informe a chave PIX.');
  }

  const parsedAmount = amount != null && amount !== '' ? Number(amount) : null;
  const safeAmount = parsedAmount != null && Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : null;

  const result = await generatePixBrCodeAndQrBase64({
    pixKey: String(pixKey).trim(),
    receiverName: receiverName || 'RECEBEDOR',
    amount: safeAmount,
    description,
  });

  return {
    brCode: result.brCode,
    dataUrl: result.dataUrl,
  };
}

module.exports = {
  sendCobrancaPix,
  previewPixQr,
};
