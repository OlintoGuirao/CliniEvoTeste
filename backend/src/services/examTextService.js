const axios = require('axios');
const { PDFParse } = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const { logger } = require('../utils/logger');

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const OCR_LANG = String(process.env.EXAM_OCR_LANG || 'por').trim() || 'por';

async function downloadFileBuffer(fileUrl) {
  const response = await axios.get(fileUrl, {
    responseType: 'arraybuffer',
    timeout: 25000,
  });
  return Buffer.from(response.data);
}

async function extractFromPdf(buffer) {
  if (typeof PDFParse !== 'function') throw new Error('Biblioteca pdf-parse indisponível');
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    return String(parsed?.text || '').trim();
  } finally {
    await parser.destroy();
  }
}

async function extractFromImage(buffer) {
  const worker = await createWorker(OCR_LANG);
  try {
    const { data } = await worker.recognize(buffer);
    return String(data?.text || '').trim();
  } finally {
    await worker.terminate();
  }
}

async function extractTextFromExam({ fileUrl, mimeType }) {
  if (!fileUrl) {
    return { text: '', source: 'none', warning: 'fileUrl ausente.' };
  }

  try {
    const buffer = await downloadFileBuffer(fileUrl);
    const normalizedMime = String(mimeType || '').toLowerCase().trim();

    if (normalizedMime === 'application/pdf' || fileUrl.toLowerCase().endsWith('.pdf')) {
      const text = await extractFromPdf(buffer);
      if (!text) {
        return {
          text: '',
          source: 'pdf',
          warning: 'PDF sem texto selecionável. Pode ser escaneado; use OCR por imagem ou cole o texto manualmente.',
        };
      }
      return { text, source: 'pdf', warning: null };
    }

    if (SUPPORTED_IMAGE_TYPES.has(normalizedMime) || /\.(jpg|jpeg|png|webp)$/i.test(fileUrl)) {
      const text = await extractFromImage(buffer);
      if (!text) {
        return { text: '', source: 'ocr-image', warning: 'Não foi possível extrair texto da imagem.' };
      }
      return { text, source: 'ocr-image', warning: null };
    }

    return { text: '', source: 'unsupported', warning: `Tipo não suportado para OCR automático: ${mimeType || 'desconhecido'}` };
  } catch (error) {
    logger.warn('Falha ao extrair texto de exame.', {
      message: error?.message,
      mimeType,
    });
    return { text: '', source: 'error', warning: 'Falha ao processar arquivo para extração de texto.' };
  }
}

module.exports = {
  extractTextFromExam,
};
