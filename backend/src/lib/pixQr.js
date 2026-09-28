const { createStaticPix, hasError } = require('pix-utils');
const QRCode = require('qrcode');

function sanitizePixReceiverName(name) {
  return String(name || 'RECEBEDOR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 25)
    .toUpperCase();
}

function formatPixAmountBrl(amount) {
  return Number(amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalizeDescriptionForMessage(value) {
  // Mantém conteúdo literal (inclusive HTML se for enviado), apenas limpa espaços.
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function formatDateDdMm(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function buildCobrancaPixMessage({ patientName, professionalName, amount, description }) {
  const valor = formatPixAmountBrl(amount);
  const desc = normalizeDescriptionForMessage(description);

  const lines = [
    `Olá, ${patientName}!`,
    '',
    'Esperamos que esteja bem.',
    '',
    desc ? `Referente à ${desc}, segue a cobrança no valor de ${valor}.` : `Segue a cobrança no valor de ${valor}.`,
    '',
    'O pagamento pode ser realizado por meio do QR Code PIX enviado nesta mensagem. Assim que o pagamento for efetuado, caso deseje, envie o comprovante para facilitar a identificação.',
    '',
    'Em caso de dúvidas, estamos à disposição. Agradecemos pela confiança e preferência!',
  ];

  return lines.join('\n');
}

async function generatePixBrCodeAndQrBase64({ pixKey, receiverName, amount, description }) {
  const merchantName = sanitizePixReceiverName(receiverName);
  const pix = createStaticPix({
    merchantName,
    merchantCity: 'BRASILIA',
    pixKey: String(pixKey || '').trim(),
    infoAdicional: String(description || '').trim() || undefined,
    transactionAmount: amount > 0 ? amount : undefined,
  });

  if (hasError(pix)) {
    throw new Error('Não foi possível gerar o código PIX. Verifique a chave cadastrada.');
  }

  const brCode = pix.toBRCode();
  const dataUrl = await QRCode.toDataURL(brCode, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
  });

  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  return { brCode, base64, dataUrl };
}

module.exports = {
  sanitizePixReceiverName,
  formatPixAmountBrl,
  buildCobrancaPixMessage,
  generatePixBrCodeAndQrBase64,
};
