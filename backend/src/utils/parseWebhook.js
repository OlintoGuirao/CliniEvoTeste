function pickListRowId(body) {
  const dataMessage = body?.data?.message;
  const candidates = [
    dataMessage?.listResponseMessage?.singleSelectReply?.selectedRowId,
    dataMessage?.listResponseMessage?.selectedRowId,
    body?.data?.listResponseMessage?.singleSelectReply?.selectedRowId,
    body?.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
  ];
  return candidates.find((x) => typeof x === 'string' && x.trim().length > 0) || '';
}

function pickInteraction(body) {
  const rowId = pickListRowId(body);
  if (rowId) return rowId;
  return pickText(body);
}

function pickText(body) {
  const dataMessage = body?.data?.message;
  const candidates = [
    body?.data?.body,
    body?.data?.text,
    body?.body,
    body?.message?.text?.body,
    body?.message?.text,
    body?.data?.message?.text?.body,
    body?.data?.message?.text,
    body?.text?.body,
    body?.text,
    body?.message?.conversation,
    body?.data?.message?.conversation,
    body?.data?.message?.extendedTextMessage?.text,
    body?.message?.extendedTextMessage?.text,
    dataMessage?.ephemeralMessage?.message?.conversation,
    dataMessage?.ephemeralMessage?.message?.extendedTextMessage?.text,
    dataMessage?.viewOnceMessage?.message?.conversation,
    dataMessage?.viewOnceMessage?.message?.extendedTextMessage?.text,
    dataMessage?.imageMessage?.caption,
    dataMessage?.videoMessage?.caption,
    dataMessage?.buttonsResponseMessage?.selectedDisplayText,
    dataMessage?.listResponseMessage?.title,
  ];
  return candidates.find((x) => typeof x === 'string' && x.trim().length > 0) || '';
}

function pickPhone(body) {
  const candidates = [
    body?.data?.from,
    body?.data?.author,
    body?.data?.chatId,
    body?.from,
    body?.phone,
    body?.number,
    body?.message?.from,
    body?.message?.key?.remoteJid,
    body?.data?.key?.remoteJid,
    body?.data?.message?.from,
    body?.data?.from,
    body?.instance?.sender,
  ];
  let phone = candidates.find((x) => typeof x === 'string' && x.trim().length > 0) || '';
  // Alguns webhooks vêm como "5511999999999@c.us"
  phone = phone.replace(/@.*$/, '');
  return phone;
}

function pickInstanceName(body) {
  const candidates = [
    body?.instanceId,
    body?.instance_id,
    body?.instance,
    body?.instanceName,
    body?.instance?.name,
    body?.data?.instanceId,
    body?.data?.instance_id,
    body?.data?.instance,
    body?.data?.instanceName,
    typeof body?.instance === 'string' ? body.instance : null,
  ];
  return candidates.find((x) => typeof x === 'string' && x.trim().length > 0) || '';
}

function pickAudioMessage(body) {
  const dataMessage = body?.data?.message;
  const candidates = [
    dataMessage?.audioMessage,
    dataMessage?.pttMessage,
    dataMessage?.ephemeralMessage?.message?.audioMessage,
    dataMessage?.viewOnceMessage?.message?.audioMessage,
    body?.message?.audioMessage,
    body?.message?.pttMessage,
  ];
  return candidates.find((x) => x && typeof x === 'object') || null;
}

function isIncomingPatientMessage(body) {
  const eventType = String(body?.event_type || body?.eventType || body?.event || '').toLowerCase();
  const fromMeFlags = [
    body?.fromMe,
    body?.data?.fromMe,
    body?.data?.isFromMe,
    body?.data?.key?.fromMe,
    body?.message?.key?.fromMe,
  ];
  const fromMe = fromMeFlags.some((v) => v === true || String(v).toLowerCase() === 'true');
  const from = String(pickPhone(body) || '').toLowerCase();
  const to = String(body?.to || body?.data?.to || '').toLowerCase().replace(/@.*$/, '');

  if (fromMe) return false;
  if (eventType.includes('connection') || eventType.includes('qrcode')) return false;
  if (from && to && from === to) return false;
  if (eventType && !eventType.includes('message') && !eventType.includes('upsert')) return false;
  return true;
}

function isIncomingAudioMessage(body) {
  if (!isIncomingPatientMessage(body)) return false;
  if (pickAudioMessage(body)) return true;

  const messageType = String(
    body?.data?.messageType || body?.messageType || body?.data?.message?.messageType || ''
  ).toLowerCase();
  return messageType.includes('audio') || messageType === 'ptt';
}

function isIncomingTextMessage(body) {
  const eventType = String(body?.event_type || body?.eventType || body?.event || '').toLowerCase();
  const text = pickText(body);
  const listRowId = pickListRowId(body);

  if (!isIncomingPatientMessage(body)) return false;

  // messages.update = confirmação de leitura/entrega — só processa se trouxer texto novo
  const isStatusUpdate =
    eventType.includes('update') &&
    !eventType.includes('upsert') &&
    !eventType.includes('send_message');
  if (isStatusUpdate) {
    const status = String(body?.status || body?.data?.status || '').toLowerCase();
    if (status && status !== 'received' && status !== 'incoming') return false;
    if (!text && !listRowId) return false;
  }

  if (!text && !listRowId) return false;
  return true;
}

module.exports = {
  pickText,
  pickPhone,
  pickInstanceName,
  pickListRowId,
  pickInteraction,
  pickAudioMessage,
  isIncomingAudioMessage,
  isIncomingTextMessage,
};
