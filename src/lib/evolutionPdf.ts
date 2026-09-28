import { jsPDF } from 'jspdf';
import { buildProcedureReportWhatsAppMessage } from '@/lib/reportShare';
import { loadWhatsappManualTemplates } from '@/lib/loadWhatsappManualTemplates';

/** Converte URL de imagem em base64 para inclusão no PDF (evita CORS). */
async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Retorna dimensões da imagem a partir de data URL. */
function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/**
 * Lê a orientação EXIF (1–8) de um JPEG em data URL. Retorna 1 se não for JPEG ou não houver EXIF.
 */
function getExifOrientation(dataUrl: string): number {
  if (!dataUrl.startsWith('data:image/jpeg') && !dataUrl.startsWith('data:image/jpg')) return 1;
  try {
    const base64 = dataUrl.split(',')[1];
    if (!base64) return 1;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const view = new DataView(bytes.buffer);
    if (view.getUint16(0, false) !== 0xffd8) return 1;
    let offset = 2;
    const length = view.byteLength;
    while (offset < length) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      if (marker === 0xffe1) {
        if (offset + 8 > length) return 1;
        if (view.getUint32(offset, false) !== 0x45786966) {
          offset += view.getUint16(offset, false);
          continue;
        }
        const little = view.getUint16((offset += 6), false) === 0x4949;
        offset += 6;
        const tagCount = view.getUint16(offset, little);
        offset += 2;
        for (let i = 0; i < tagCount; i++) {
          const pos = offset + i * 12;
          if (view.getUint16(pos, little) === 0x0112)
            return view.getUint16(pos + 8, little);
        }
        return 1;
      }
      if ((marker & 0xff00) !== 0xff00) break;
      offset += view.getUint16(offset, false);
    }
  } catch {
    /* ignore */
  }
  return 1;
}

/**
 * Redesenha a imagem aplicando a rotação EXIF (fotos de celular costumam vir em 90°).
 * O jsPDF não aplica EXIF; sem isso a foto sai de lado no PDF.
 */
function normalizeImageOrientation(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const orientation = dataUrl.startsWith('data:image/png') ? 1 : getExifOrientation(dataUrl);
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (orientation >= 5 && orientation <= 8) {
          [w, h] = [h, w];
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        // Ver https://www.impulseadventure.com/photo/exif-orientation.html (1–8)
        switch (orientation) {
          case 2:
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0);
            break;
          case 3:
            ctx.translate(w, h);
            ctx.rotate(Math.PI);
            ctx.drawImage(img, 0, 0);
            break;
          case 4:
            ctx.translate(0, h);
            ctx.scale(1, -1);
            ctx.drawImage(img, 0, 0);
            break;
          case 5:
            ctx.transform(0, 1, 1, 0, 0, 0);
            ctx.drawImage(img, 0, 0);
            break;
          case 6: // 90° CW (comum em fotos de celular)
            ctx.transform(0, 1, -1, 0, img.naturalHeight, 0);
            ctx.drawImage(img, 0, 0);
            break;
          case 7:
            ctx.transform(0, -1, -1, 0, img.naturalHeight, img.naturalWidth);
            ctx.drawImage(img, 0, 0);
            break;
          case 8: // 90° CCW
            ctx.transform(0, -1, 1, 0, 0, img.naturalWidth);
            ctx.drawImage(img, 0, 0);
            break;
          default:
            ctx.drawImage(img, 0, 0);
        }
        const out = canvas.toDataURL(
          dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
          0.92
        );
        resolve(out || dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Calcula tamanho para caber na caixa mantendo proporção (fit inside, centralizado). */
function fitInBox(
  imgWidth: number,
  imgHeight: number,
  boxW: number,
  boxH: number
): { drawW: number; drawH: number; offsetX: number; offsetY: number } {
  if (imgWidth <= 0 || imgHeight <= 0) {
    return { drawW: boxW, drawH: boxH, offsetX: 0, offsetY: 0 };
  }
  const scale = Math.min(boxW / imgWidth, boxH / imgHeight, 1);
  const drawW = imgWidth * scale;
  const drawH = imgHeight * scale;
  const offsetX = (boxW - drawW) / 2;
  const offsetY = (boxH - drawH) / 2;
  return { drawW, drawH, offsetX, offsetY };
}

/** Retorna 'PNG' ou 'JPEG' a partir de data URL para addImage. */
function getImageFormat(dataUrl: string): 'JPEG' | 'PNG' {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
}

export interface EvolutionPdfSummaryData {
  pesoTotalKg: number | null;
  reducaoMediaCm: number | null;
  sessoesRealizadas: number;
  tempoTratamentoDias: number;
  regiaoTratada?: string | null;
  /** Botox: produto utilizado (ex.: nome da toxina) */
  produtoUtilizado?: string | null;
}

export interface EvolutionPdfSession {
  id: string;
  session_date: string;
  data: Record<string, unknown> | null;
}

export interface EvolutionPdfPhoto {
  id: string;
  procedure_session_id: string | null;
  photo_type: string;
  file_url: string;
}

export interface EvolutionPdfParams {
  patientName: string;
  procedureName: string;
  instanceStartDate: string | null;
  summaryData: EvolutionPdfSummaryData;
  slug: string | null;
  firstSession: EvolutionPdfSession | null;
  latestSession: EvolutionPdfSession | null;
  sessions: EvolutionPdfSession[];
  photos: EvolutionPdfPhoto[];
  getMetricLabel?: (key: string) => string;
  /** Opcional: nome ou contato da clínica para o rodapé / mensagem WhatsApp */
  clinicContact?: string | null;
  /** Nome da clínica para a mensagem do WhatsApp (ex.: "CliniEvo") */
  clinicName?: string | null;
  /** Número do cliente para link WhatsApp (ex.: 5511999998888). Se fornecido com uploadPdfFunction, gera link com URL do PDF. */
  clientPhoneNumber?: string | null;
  /** Se fornecido, faz upload do PDF (blob) e retorna URL pública. Usado para enviar link no WhatsApp em vez de download. */
  uploadPdfFunction?: (pdfBlob: Blob) => Promise<string>;
  /** Carrega template procedure_report de professional_ui_settings quando disponível. */
  professionalId?: string | null;
}

/** Resultado quando upload e WhatsApp são usados */
export interface EvolutionPdfResultWithUpload {
  doc: jsPDF;
  pdfUrl: string;
  whatsappUrl: string;
}

const MARGIN = 22;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;

const SLUGS_COM_PESO_E_MEDIDAS = ['emagrecimento-reducao-medidas'];

const METRIC_LABELS: Record<string, string> = {
  peso_atual: 'Peso (kg)',
  braco_cm: 'Braço (cm)',
  busto_cm: 'Busto (cm)',
  quadril_cm: 'Quadril (cm)',
  cintura_cm: 'Cintura (cm)',
  abdomen_inferior_cm: 'Abdômen inferior (cm)',
  abdomen_superior_cm: 'Abdômen superior (cm)',
};

/** Paleta estética de luxo: Rose Gold, Champagne, Nude, cinzas quentes, Teal suave, off-white */
const LUXE = {
  roseGold: [175, 120, 115] as [number, number, number],
  roseGoldLight: [215, 190, 185] as [number, number, number],
  champagne: [240, 232, 220] as [number, number, number],
  nude: [230, 218, 206] as [number, number, number],
  warmGray: [115, 105, 100] as [number, number, number],
  warmGrayLight: [180, 172, 168] as [number, number, number],
  tealSoft: [160, 185, 182] as [number, number, number],
  offWhite: [252, 250, 248] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  border: [230, 224, 218] as [number, number, number],
  cardShadow: [240, 236, 232] as [number, number, number],
  textDark: [55, 50, 48] as [number, number, number],
  textMuted: [120, 110, 105] as [number, number, number],
  /** Verde suave para redução (perda) */
  successGreen: [72, 128, 98] as [number, number, number],
  /** Vermelho suave para aumento (ganho) */
  increaseRed: [180, 95, 90] as [number, number, number],
};

function getLabel(key: string, getMetricLabel?: (key: string) => string): string {
  return getMetricLabel?.(key) ?? METRIC_LABELS[key] ?? key;
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = dateStr.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return dateStr;
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

/** Paleta template Botox: minimalista, off-white, grafite, dourado */
const BOTOX_PALETTE = {
  offWhite: [250, 250, 248] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  graphite: [55, 58, 62] as [number, number, number],
  graphiteLight: [90, 94, 98] as [number, number, number],
  muted: [130, 132, 136] as [number, number, number],
  border: [228, 228, 226] as [number, number, number],
  accent: [180, 148, 100] as [number, number, number],
  accentSoft: [220, 208, 188] as [number, number, number],
  cardBg: [252, 252, 250] as [number, number, number],
};

const BOTOX_REGIOES_PDF = [
  'Testa',
  'Glabela',
  'Pés de Galinha',
  'Sobrancelha',
  'Bunny Lines',
  'Masseter',
  'Queixo',
  'Depressor âng. boca',
  'Pescoço',
] as const;

const BOTOX_REGIOES_KEYS = [
  'testa',
  'glabela',
  'pes_de_galinha',
  'sobrancelha',
  'bunny_lines',
  'masseter',
  'queixo',
  'depressor_angulo_boca',
  'pescoco',
] as const;

function getBotoxData(data: Record<string, unknown> | null) {
  const d = data ?? {};
  const str = (v: unknown) => (v != null && String(v).trim() !== '' ? String(v).trim() : '—');
  const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
  return {
    produtoUtilizado: str(d.produto_utilizado),
    marcaToxina: str(d.marca_toxina),
    lote: str(d.lote),
    dataValidade: str(d.data_validade),
    diluicaoUtilizada: str(d.diluicao_utilizada),
    quantidadeUnidade: str(d.quantidade_unidade),
    numeroPontos: str(d.numero_pontos_aplicacao),
    regiaoTratada: arr(d.regiao_tratada),
    pontosAplicacao: (d.pontos_aplicacao as Array<{ x: number; y: number }>) ?? [],
    riscosAplicacao:
      (d.riscos_aplicacao as Array<{ x1: number; y1: number; x2: number; y2: number }>) ?? [],
    dataAplicacao: str(d.data_aplicacao || d.session_date),
  };
}

/** Card estilo “flutuante”: fundo off-white, borda fina, sombra sutil */
function drawLuxeCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  valueInRoseGold: boolean
) {
  doc.setDrawColor(...LUXE.border);
  doc.setLineWidth(0.2);
  doc.setFillColor(...LUXE.offWhite);
  doc.rect(x, y, w, h, 'FD');
  doc.rect(x, y, w, h, 'S');
  const labelY = y + 6;
  const valueY = y + h - 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...LUXE.textMuted);
  doc.text(label, x + 5, labelY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  if (valueInRoseGold) doc.setTextColor(...LUXE.roseGold);
  else doc.setTextColor(...LUXE.textDark);
  doc.text(value, x + 5, valueY);
}

/** Card de perda/ganho: título da métrica + apenas a variação. Rose Gold para redução, cinza quente para aumento (fonte padrão sem caracteres especiais). */
function drawVariationCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  variationStr: string,
  isReduction: boolean
) {
  doc.setDrawColor(...LUXE.border);
  doc.setLineWidth(0.2);
  doc.setFillColor(...LUXE.offWhite);
  doc.rect(x, y, w, h, 'FD');
  doc.rect(x, y, w, h, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...LUXE.textMuted);
  doc.text(label.toUpperCase(), x + 4, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  if (isReduction) doc.setTextColor(...LUXE.roseGold);
  else doc.setTextColor(...LUXE.warmGray);
  doc.text(variationStr, x + 4, y + 14);
}

/** Gera PDF do resumo da evolução (design luxo) e opcionalmente upload + link WhatsApp. */
export async function buildEvolutionPdf(
  params: EvolutionPdfParams
): Promise<jsPDF | EvolutionPdfResultWithUpload> {
  const {
    patientName,
    procedureName,
    instanceStartDate,
    summaryData,
    slug,
    firstSession,
    latestSession,
    sessions,
    photos,
    getMetricLabel,
    clinicContact,
    clinicName,
    clientPhoneNumber,
    uploadPdfFunction,
    professionalId,
  } = params;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // —— Template exclusivo Botox: minimalista, profissional —————————
  if (slug === 'botox') {
    doc.setFillColor(...BOTOX_PALETTE.offWhite);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
    let yBot = MARGIN + 4;
    const lineH = 5;
    const P = BOTOX_PALETTE;
    const data = getBotoxData((latestSession?.data as Record<string, unknown>) ?? null);

    // Cabeçalho: logotipo/nome à esquerda, dados do paciente à direita
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...P.graphite);
    doc.text((clinicName && String(clinicName).trim()) ? String(clinicName).trim() : 'CliniEvo', MARGIN, yBot);
    yBot += lineH + 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(18);
    doc.setTextColor(...P.accent);
    doc.text('Resumo de Evolução', MARGIN, yBot);
    yBot += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...P.muted);
    doc.text(procedureName, MARGIN, yBot);
    const infoX = PAGE_W - MARGIN - 72;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...P.graphite);
    doc.text(patientName, infoX, yBot - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...P.muted);
    doc.text(`Data do procedimento: ${data.dataAplicacao}`, infoX, yBot - 4);
    if (instanceStartDate) doc.text(`Início do tratamento: ${fmtDate(instanceStartDate)}`, infoX, yBot + 2);
    yBot += 14;
    doc.setDrawColor(...P.border);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, yBot, MARGIN + CONTENT_W, yBot);
    yBot += 14;

    // Seção 1: Informações do Produto (2x2)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...P.graphite);
    doc.text('Informações do Produto', MARGIN, yBot);
    yBot += lineH + 6;
    const cardW = (CONTENT_W - 8) / 2;
    const cardH = 16;
    const fields1 = [
      { label: 'Produto Utilizado', value: data.produtoUtilizado },
      { label: 'Marca da Toxina', value: data.marcaToxina },
      { label: 'Lote', value: data.lote },
      { label: 'Data de Validade', value: data.dataValidade },
    ];
    for (let col = 0; col < fields1.length; col++) {
      const f = fields1[col]!;
      const x = MARGIN + (col % 2) * (cardW + 8);
      const cy = yBot + Math.floor(col / 2) * (cardH + 6);
      doc.setFillColor(...P.cardBg);
      doc.setDrawColor(...P.border);
      doc.rect(x, cy, cardW, cardH, 'FD');
      doc.rect(x, cy, cardW, cardH, 'S');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...P.muted);
      doc.text(f.label, x + 4, cy + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...P.graphite);
      const val = f.value.length > 28 ? f.value.slice(0, 25) + '...' : f.value;
      doc.text(val, x + 4, cy + 11);
    }
    yBot += cardH * 2 + 6 + 10;

    // Seção 2: Detalhes Técnicos (3 colunas)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...P.graphite);
    doc.text('Detalhes Técnicos da Aplicação', MARGIN, yBot);
    yBot += lineH + 6;
    const techW = (CONTENT_W - 12) / 3;
    const techFields = [
      { label: 'Diluição Utilizada', value: data.diluicaoUtilizada },
      { label: 'Quantidade e/ou Unidade Total', value: data.quantidadeUnidade },
      { label: 'Número de Pontos de Aplicação', value: data.numeroPontos },
    ];
    for (let i = 0; i < techFields.length; i++) {
      const fx = MARGIN + i * (techW + 6);
      doc.setFillColor(...P.cardBg);
      doc.setDrawColor(...P.border);
      doc.rect(fx, yBot, techW, 14, 'FD');
      doc.rect(fx, yBot, techW, 14, 'S');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...P.muted);
      doc.text(techFields[i]!.label, fx + 4, yBot + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...P.graphite);
      const v = techFields[i]!.value;
      doc.text(v.length > 18 ? v.slice(0, 15) + '...' : v, fx + 4, yBot + 10);
    }
    yBot += 20;

    // Seção 3: Regiões Tratadas (checklist visual)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...P.graphite);
    doc.text('Regiões Tratadas', MARGIN, yBot);
    yBot += lineH + 4;
    const selected = new Set(
      data.regiaoTratada.map((k: string) => String(k).toLowerCase().replace(/\s/g, '_'))
    );
    for (let i = 0; i < BOTOX_REGIOES_KEYS.length; i++) {
      const key = BOTOX_REGIOES_KEYS[i]!;
      const checked = selected.has(key) || selected.has(key.replace(/_/g, ''));
      const cx = MARGIN + (i % 2) * (CONTENT_W / 2 + 4);
      const cy = yBot + Math.floor(i / 2) * 7;
      doc.setFillColor(...(checked ? P.accent : P.white));
      doc.setDrawColor(...P.border);
      doc.circle(cx, cy - 1.5, 1.5, 'FD');
      if (!checked) doc.circle(cx, cy - 1.5, 1.5, 'S');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...P.graphite);
      doc.text(BOTOX_REGIOES_PDF[i]!, cx + 4, cy);
    }
    yBot += 7 * Math.ceil(BOTOX_REGIOES_KEYS.length / 2) + 14;

    // Seção 4: Mapa de Aplicação + Antes e Depois
    if (yBot + 85 > PAGE_H) {
      doc.addPage();
      doc.setFillColor(...P.offWhite);
      doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
      yBot = MARGIN;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...P.graphite);
    doc.text('Mapa de Aplicação e Transformação', MARGIN, yBot);
    yBot += lineH + 4;
    const faceMapUrl = typeof window !== 'undefined' ? `${window.location.origin}/face-map.png` : '';
    if (faceMapUrl) {
      const faceBase64 = await imageUrlToBase64(faceMapUrl);
      if (faceBase64) {
        const faceW = 50;
        const faceH = (faceW * 624) / 520;
        const faceX = MARGIN + (CONTENT_W - faceW) / 2;
        doc.addImage(faceBase64, 'PNG', faceX, yBot, faceW, faceH);
        const points = data.pontosAplicacao;
        const riscos = data.riscosAplicacao;
        if (Array.isArray(riscos) && riscos.length > 0) {
          doc.setDrawColor(...P.accent);
          doc.setLineWidth(0.35);
          for (const ln of riscos) {
            const ax = faceX + (ln.x1 / 100) * faceW;
            const ay = yBot + (ln.y1 / 100) * faceH;
            const bx = faceX + (ln.x2 / 100) * faceW;
            const by = yBot + (ln.y2 / 100) * faceH;
            doc.line(ax, ay, bx, by);
          }
        }
        if (Array.isArray(points) && points.length > 0) {
          doc.setDrawColor(...P.accent);
          doc.setFillColor(...P.accent);
          for (const pt of points) {
            const px = faceX + (pt.x / 100) * faceW;
            const py = yBot + (pt.y / 100) * faceH;
            doc.circle(px, py, 1.2, 'FD');
          }
        }
        yBot += faceH + 14;
      }
    }
    // Garantir que a seção Antes e Depois caiba na página; se não, nova página
    const antesDepoisHeight = 65;
    if (yBot + antesDepoisHeight > PAGE_H - 35) {
      doc.addPage();
      doc.setFillColor(...P.offWhite);
      doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
      yBot = MARGIN;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...P.graphite);
    doc.text('Transformação — Antes e Depois', MARGIN, yBot);
    yBot += 6;
    const boxSize = 45;
    const beforeX = MARGIN + (CONTENT_W - boxSize * 2 - 10) / 2;
    const afterX = beforeX + boxSize + 10;
    const imgY = yBot + 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...P.muted);
    doc.text('Antes', beforeX + boxSize / 2 - 6, imgY - 1);
    doc.text('Depois', afterX + boxSize / 2 - 6, imgY - 1);

    // Sempre desenhar as duas caixas com fundo visível (evita seção vazia)
    const drawBoxFrame = (x: number) => {
      doc.setFillColor(...P.accentSoft);
      doc.rect(x, imgY, boxSize, boxSize, 'F');
      doc.setDrawColor(...P.border);
      doc.setLineWidth(0.25);
      doc.rect(x, imgY, boxSize, boxSize, 'S');
    };
    drawBoxFrame(beforeX);
    drawBoxFrame(afterX);

    const drawPlaceholder = (x: number, label: string) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...P.muted);
      const tw = doc.getTextWidth(label);
      doc.text(label, x + (boxSize - tw) / 2, imgY + boxSize / 2 - 1);
    };

    // URLs: primeiro da lista de fotos, depois fallback nos dados da sessão
    let botoxAntesUrl: string | null = null;
    let botoxDepoisUrl: string | null = null;
    if (latestSession) {
      const sessionIds = new Set(sessions.map((s) => s.id));
      const photosFromSessions = photos.filter(
        (p) => p.procedure_session_id != null && sessionIds.has(p.procedure_session_id)
      );
      const latestPhotos = photosFromSessions.filter((p) => p.procedure_session_id === latestSession.id);
      botoxAntesUrl = latestPhotos.find((p) => p.photo_type === 'antes')?.file_url ?? null;
      botoxDepoisUrl = latestPhotos.find((p) => p.photo_type === 'depois')?.file_url ?? null;
      const latestData = (latestSession.data as Record<string, unknown>) ?? {};
      if (!botoxAntesUrl && typeof latestData.botox_foto_antes === 'string' && latestData.botox_foto_antes.trim())
        botoxAntesUrl = String(latestData.botox_foto_antes).trim();
      if (!botoxDepoisUrl && typeof latestData.botox_foto_depois === 'string' && latestData.botox_foto_depois.trim())
        botoxDepoisUrl = String(latestData.botox_foto_depois).trim();
    }

    if (botoxAntesUrl) {
      let base64 = await imageUrlToBase64(botoxAntesUrl);
      if (base64) {
        base64 = (await normalizeImageOrientation(base64)) ?? base64;
        try {
          const dims = await getImageDimensions(base64);
          const { drawW, drawH, offsetX, offsetY } = fitInBox(dims.width, dims.height, boxSize, boxSize);
          doc.addImage(base64, getImageFormat(base64), beforeX + offsetX, imgY + offsetY, drawW, drawH);
        } catch {
          drawPlaceholder(beforeX, 'Sem foto');
        }
      } else {
        drawPlaceholder(beforeX, 'Sem foto');
      }
    } else {
      drawPlaceholder(beforeX, 'Sem foto');
    }
    if (botoxDepoisUrl) {
      let base64 = await imageUrlToBase64(botoxDepoisUrl);
      if (base64) {
        base64 = (await normalizeImageOrientation(base64)) ?? base64;
        try {
          const dims = await getImageDimensions(base64);
          const { drawW, drawH, offsetX, offsetY } = fitInBox(dims.width, dims.height, boxSize, boxSize);
          doc.addImage(base64, getImageFormat(base64), afterX + offsetX, imgY + offsetY, drawW, drawH);
        } catch {
          drawPlaceholder(afterX, 'Sem foto');
        }
      } else {
        drawPlaceholder(afterX, 'Sem foto');
      }
    } else {
      drawPlaceholder(afterX, 'Sem foto');
    }
    yBot += boxSize + 18;

    // Rodapé: assinatura + cuidados pós-procedimento
    const footerY = PAGE_H - 28;
    doc.setDrawColor(...P.border);
    doc.line(MARGIN, footerY - 12, MARGIN + 60, footerY - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...P.muted);
    doc.text('Assinatura do profissional', MARGIN, footerY - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...P.graphiteLight);
    doc.text(
      'Cuidados pós-procedimento: Evitar manipulação da região nas primeiras 24h; não deitar por 4h; evitar exercícios intensos no dia. Em caso de dúvidas, entre em contato com a clínica.',
      MARGIN,
      footerY + 2,
      { maxWidth: CONTENT_W }
    );
    if (clinicContact && String(clinicContact).trim() !== '') {
      doc.setFontSize(8);
      doc.setTextColor(...P.muted);
      doc.text(String(clinicContact).trim(), MARGIN, PAGE_H - 12);
    }

    if (uploadPdfFunction && clientPhoneNumber) {
      const blob = doc.output('blob');
      try {
        const pdfUrl = await uploadPdfFunction(blob);
        const clinic = (clinicName && String(clinicName).trim()) || 'Clínica';
        let template: string | null | undefined;
        if (professionalId) {
          const templates = await loadWhatsappManualTemplates(professionalId);
          template = templates.procedure_report.message;
        }
        const message = buildProcedureReportWhatsAppMessage({
          patientName,
          clinicName: clinic,
          procedureName,
          reportUrl: pdfUrl,
          template,
        });
        const whatsappUrl = `https://wa.me/${clientPhoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
        return { doc, pdfUrl, whatsappUrl };
      } catch {
        return doc;
      }
    }
    return doc;
  }

  doc.setFillColor(...LUXE.offWhite);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  let y = MARGIN + 4;
  const lineHeight = 5.5;
  const sectionGap = 18;

  // —— 1. Cabeçalho (serif para título, sans para resto) —————————————
  doc.setFont('times', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...LUXE.roseGold);
  doc.text('Resumo da Evolução', MARGIN, y);
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...LUXE.textMuted);
  doc.text(procedureName, MARGIN, y);
  y += lineHeight + 4;

  doc.setDrawColor(...LUXE.border);
  doc.setLineWidth(0.15);
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...LUXE.textDark);
  doc.text(patientName, MARGIN, y);
  y += lineHeight;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...LUXE.textMuted);
  doc.text(`Data do relatório: ${fmtDate(new Date().toISOString().slice(0, 10))}`, MARGIN, y);
  y += lineHeight;
  if (instanceStartDate) {
    doc.text(`Início do tratamento: ${fmtDate(instanceStartDate)}`, MARGIN, y);
    y += lineHeight;
  }
  y += sectionGap;

  // —— 2. Resumo do tratamento (cards de perdas/ganhos por métrica) —————
  const mostraPesoEMedidas = slug != null && SLUGS_COM_PESO_E_MEDIDAS.includes(slug);
  const cardW = (CONTENT_W - 10) / 3;
  const cardH = 18;
  const cardGap = 5;

  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...LUXE.warmGray);
  doc.text('Resumo do tratamento', MARGIN, y);
  y += lineHeight + 6;

  const hasVariationData =
    mostraPesoEMedidas &&
    firstSession?.data &&
    latestSession?.data &&
    firstSession.id !== latestSession.id;

  if (hasVariationData) {
    const firstData = firstSession!.data as Record<string, unknown>;
    const latestData = latestSession!.data as Record<string, unknown>;
    const toNum = (v: unknown): number | null => {
      if (v == null || v === '') return null;
      const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '.'));
      return Number.isFinite(n) ? n : null;
    };
    const metrics: { key: string; label: string; unit: string }[] = [
      { key: 'peso_atual', label: 'Peso (kg)', unit: 'kg' },
      { key: 'braco_cm', label: 'Braço (cm)', unit: 'cm' },
      { key: 'busto_cm', label: 'Busto (cm)', unit: 'cm' },
      { key: 'quadril_cm', label: 'Quadril (cm)', unit: 'cm' },
      { key: 'cintura_cm', label: 'Cintura (cm)', unit: 'cm' },
      { key: 'abdomen_inferior_cm', label: 'Abdômen inferior (cm)', unit: 'cm' },
      { key: 'abdomen_superior_cm', label: 'Abdômen superior (cm)', unit: 'cm' },
    ];
    let cx = MARGIN;
    let cy = y;
    let col = 0;
    for (const m of metrics) {
      const f = toNum(firstData[m.key]);
      const l = toNum(latestData[m.key]);
      if (f == null && l == null) continue;
      const diff = f != null && l != null ? l - f : null;
      if (diff === null) continue;
      const isReduction = diff < 0;
      const variationStr =
        diff < 0
          ? `${diff} ${m.unit}`
          : diff > 0
            ? `+${diff} ${m.unit}`
            : `0 ${m.unit}`;
      const labelShort = getLabel(m.key, getMetricLabel);
      drawVariationCard(doc, cx, cy, cardW, cardH, labelShort, variationStr, isReduction);
      col++;
      if (col >= 3) {
        col = 0;
        cx = MARGIN;
        cy += cardH + cardGap;
      } else {
        cx += cardW + cardGap;
      }
    }
    if (col > 0) cy += cardH + cardGap;
    y = cy + 4;

    const smallCardW = (CONTENT_W - 6) / 2;
    const bottomCardH = 20;
    drawLuxeCard(doc, MARGIN, y, smallCardW, bottomCardH, 'Sessões realizadas', String(summaryData.sessoesRealizadas), false);
    const tempoStr =
      summaryData.tempoTratamentoDias >= 365
        ? `${Math.floor(summaryData.tempoTratamentoDias / 365)} ano(s)`
        : summaryData.tempoTratamentoDias >= 30
          ? `${Math.floor(summaryData.tempoTratamentoDias / 30)} mes(es)`
          : `${summaryData.tempoTratamentoDias} dia(s)`;
    drawLuxeCard(
      doc,
      MARGIN + smallCardW + 6,
      y,
      smallCardW,
      bottomCardH,
      'Tempo de tratamento',
      summaryData.tempoTratamentoDias > 0 ? tempoStr : '—',
      false
    );
    y += bottomCardH + sectionGap;
  } else {
    const twoColW = (CONTENT_W - 6) / 2;
    if (mostraPesoEMedidas && summaryData.pesoTotalKg != null) {
      const safe = Math.abs(summaryData.pesoTotalKg) < 1e-9 ? 0 : summaryData.pesoTotalKg;
      const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      const pesoStr = safe <= 0 ? `-${fmt.format(Math.abs(safe))} kg` : `+${fmt.format(safe)} kg`;
      drawLuxeCard(doc, MARGIN, y, twoColW, 22, 'Variação de peso', pesoStr, true);
      if (summaryData.reducaoMediaCm != null) {
        const reducaoStr =
          summaryData.reducaoMediaCm > 0
            ? `−${summaryData.reducaoMediaCm.toFixed(1)} cm`
            : summaryData.reducaoMediaCm < 0
              ? `+${Math.abs(summaryData.reducaoMediaCm).toFixed(1)} cm`
              : '0 cm';
        drawLuxeCard(doc, MARGIN + twoColW + 6, y, twoColW, 22, 'Redução média de medidas', reducaoStr, true);
      }
      y += 22 + 6;
    }
    drawLuxeCard(doc, MARGIN, y, twoColW, 22, 'Sessões realizadas', String(summaryData.sessoesRealizadas), false);
    const tempoStr =
      summaryData.tempoTratamentoDias >= 365
        ? `${Math.floor(summaryData.tempoTratamentoDias / 365)} ano(s)`
        : summaryData.tempoTratamentoDias >= 30
          ? `${Math.floor(summaryData.tempoTratamentoDias / 30)} mes(es)`
          : `${summaryData.tempoTratamentoDias} dia(s)`;
    drawLuxeCard(
      doc,
      MARGIN + twoColW + 6,
      y,
      twoColW,
      22,
      'Tempo de tratamento',
      summaryData.tempoTratamentoDias > 0 ? tempoStr : '—',
      false
    );
    y += 22 + sectionGap;
  }

  const isBotox = slug === 'botox';
  if (summaryData.regiaoTratada != null && String(summaryData.regiaoTratada).trim() !== '') {
    doc.setFillColor(...LUXE.champagne);
    doc.setDrawColor(...LUXE.border);
    doc.rect(MARGIN, y, CONTENT_W, 10, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...LUXE.textMuted);
    doc.text(isBotox ? 'Regiões aplicadas' : 'Região tratada', MARGIN + 5, y + 6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...LUXE.textDark);
    const regiaoText = String(summaryData.regiaoTratada).trim();
    doc.text(regiaoText, MARGIN + 52, y + 6.5);
    y += 14;
  }
  if (isBotox && summaryData.produtoUtilizado != null && String(summaryData.produtoUtilizado).trim() !== '') {
    doc.setFillColor(...LUXE.champagne);
    doc.setDrawColor(...LUXE.border);
    doc.rect(MARGIN, y, CONTENT_W, 10, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...LUXE.textMuted);
    doc.text('Produto aplicado', MARGIN + 5, y + 6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...LUXE.textDark);
    doc.text(String(summaryData.produtoUtilizado).trim(), MARGIN + 52, y + 6.5);
    y += 14;
  }
  if (isBotox && y + 65 < PAGE_H) {
    const faceMapUrl = typeof window !== 'undefined' ? `${window.location.origin}/face-map.png` : '';
    if (faceMapUrl) {
      const faceBase64 = await imageUrlToBase64(faceMapUrl);
      if (faceBase64) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...LUXE.textMuted);
        doc.text('Mapa de aplicação', MARGIN, y);
        y += 6;
        const faceW = 50;
        const faceH = (faceW * 624) / 520;
        doc.addImage(faceBase64, 'PNG', MARGIN, y, faceW, faceH);
        const sessData = latestSession?.data as Record<string, unknown> | undefined;
        const points = sessData?.pontos_aplicacao as Array<{ x: number; y: number }> | undefined;
        const riscos = sessData?.riscos_aplicacao as Array<{ x1: number; y1: number; x2: number; y2: number }> | undefined;
        if (Array.isArray(riscos) && riscos.length > 0) {
          doc.setDrawColor(180, 95, 90);
          doc.setLineWidth(0.35);
          for (const ln of riscos) {
            const ax = MARGIN + (ln.x1 / 100) * faceW;
            const ay = y + (ln.y1 / 100) * faceH;
            const bx = MARGIN + (ln.x2 / 100) * faceW;
            const by = y + (ln.y2 / 100) * faceH;
            doc.line(ax, ay, bx, by);
          }
        }
        if (Array.isArray(points) && points.length > 0) {
          doc.setDrawColor(180, 95, 90);
          doc.setLineWidth(0.4);
          doc.setFillColor(180, 95, 90);
          for (const pt of points) {
            const px = MARGIN + (pt.x / 100) * faceW;
            const py = y + (pt.y / 100) * faceH;
            doc.circle(px, py, 1.2, 'FD');
          }
        }
        y += faceH + 8;
      }
    }
  }

  // —— 3. Evolução detalhada (tabela linhas finas, alternância suave) ———
  if (
    mostraPesoEMedidas &&
    firstSession?.data &&
    latestSession?.data &&
    firstSession.id !== latestSession.id
  ) {
    if (y > PAGE_H - 80) {
      doc.addPage();
      doc.setFillColor(...LUXE.offWhite);
      doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
      y = MARGIN;
    }
    const firstData = firstSession.data as Record<string, unknown>;
    const latestData = latestSession.data as Record<string, unknown>;
    const toNum = (v: unknown): number | null => {
      if (v == null || v === '') return null;
      const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '.'));
      return Number.isFinite(n) ? n : null;
    };

    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...LUXE.warmGray);
    doc.text('Evolução detalhada (Primeira x Última sessão)', MARGIN, y);
    y += lineHeight + 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...LUXE.textMuted);
    doc.text(`Primeira sessão: ${fmtDate(firstSession.session_date)}`, MARGIN, y);
    y += lineHeight;
    doc.text(`Última sessão: ${fmtDate(latestSession.session_date)}`, MARGIN, y);
    y += 10;

    const colW = [72, 28, 28, 42];
    doc.setFillColor(...LUXE.champagne);
    doc.setDrawColor(...LUXE.border);
    doc.setLineWidth(0.15);
    doc.rect(MARGIN, y, CONTENT_W, 9, 'FD');
    doc.rect(MARGIN, y, CONTENT_W, 9, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...LUXE.warmGray);
    doc.text('Medida', MARGIN + 3, y + 6);
    doc.text('Inicial', MARGIN + colW[0], y + 6);
    doc.text('Atual', MARGIN + colW[0] + colW[1], y + 6);
    doc.text('Variação', MARGIN + colW[0] + colW[1] + colW[2], y + 6);
    y += 9;

    const metricKeys = [
      'peso_atual',
      'braco_cm',
      'busto_cm',
      'quadril_cm',
      'cintura_cm',
      'abdomen_inferior_cm',
      'abdomen_superior_cm',
    ];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    for (let i = 0; i < metricKeys.length; i++) {
      const key = metricKeys[i]!;
      const f = toNum(firstData[key]);
      const l = toNum(latestData[key]);
      if (f == null && l == null) continue;
      const diff = f != null && l != null ? f - l : null;
      const isReduction = diff != null && diff > 0;
      const bg = i % 2 === 0 ? LUXE.white : LUXE.offWhite;
      doc.setFillColor(...bg);
      doc.rect(MARGIN, y, CONTENT_W, 7, 'F');
      doc.setDrawColor(...LUXE.border);
      doc.setLineWidth(0.1);
      doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
      doc.setTextColor(...LUXE.textDark);
      doc.text(getLabel(key, getMetricLabel), MARGIN + 3, y + 4.5);
      doc.text(f != null ? String(f) : '—', MARGIN + colW[0], y + 4.5);
      doc.text(l != null ? String(l) : '—', MARGIN + colW[0] + colW[1], y + 4.5);
      if (diff != null) {
        const diffStr = diff > 0 ? `−${diff.toFixed(1)}` : `+${Math.abs(diff).toFixed(1)}`;
        const label = diff > 0 ? 'redução' : 'aumento';
        if (isReduction) doc.setTextColor(...LUXE.roseGold);
        else doc.setTextColor(...LUXE.warmGrayLight);
        doc.text(`${diffStr} (${label})`, MARGIN + colW[0] + colW[1] + colW[2], y + 4.5);
        doc.setTextColor(...LUXE.textDark);
      } else {
        doc.text('—', MARGIN + colW[0] + colW[1] + colW[2], y + 4.5);
      }
      y += 7;
    }
    doc.setDrawColor(...LUXE.border);
    doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
    y += sectionGap;
  }

  // —— 4. Fotos Antes e Depois (vitrine: moldura fina, proporção preservada, placeholder elegante) ———
  const initialData = (firstSession?.data as Record<string, unknown>) ?? {};
  const sessionIds = new Set(sessions.map((s) => s.id));
  const photosFromSessions = photos.filter(
    (p) => p.procedure_session_id != null && sessionIds.has(p.procedure_session_id)
  );
  const positions = ['frente', 'lado', 'costas'] as const;
  const photoPairs: { position: string; label: string; beforeUrl: string | null; afterUrl: string | null }[] = [];

  for (const pos of positions) {
    const label = pos.charAt(0).toUpperCase() + pos.slice(1);
    const beforeUrl =
      (initialData[`foto_inicial_${pos}`] as string | undefined) ??
      photosFromSessions.find(
        (p) => p.procedure_session_id === firstSession?.id && p.photo_type === `depois_${pos}`
      )?.file_url ??
      null;
    const afterPhoto = photosFromSessions
      .filter((p) => p.procedure_session_id !== firstSession?.id && p.photo_type === `depois_${pos}`)
      .sort((a, b) => {
        const aS = sessions.find((s) => s.id === a.procedure_session_id);
        const bS = sessions.find((s) => s.id === b.procedure_session_id);
        return new Date(bS?.session_date ?? 0).getTime() - new Date(aS?.session_date ?? 0).getTime();
      })[0];
    const afterUrl = afterPhoto?.file_url ?? null;
    if (beforeUrl || afterUrl) {
      photoPairs.push({
        position: pos,
        label,
        beforeUrl: beforeUrl || null,
        afterUrl: afterUrl || null,
      });
    }
  }

  const otherPhotos = photosFromSessions.filter(
    (p) =>
      !positions.some((pos) => p.photo_type === `depois_${pos}`) &&
      (!isBotox || (p.photo_type !== 'antes' && p.photo_type !== 'depois'))
  );

  let botoxAntesUrl: string | null = null;
  let botoxDepoisUrl: string | null = null;
  if (isBotox && latestSession) {
    const latestPhotos = photosFromSessions.filter((p) => p.procedure_session_id === latestSession!.id);
    botoxAntesUrl = latestPhotos.find((p) => p.photo_type === 'antes')?.file_url ?? null;
    botoxDepoisUrl = latestPhotos.find((p) => p.photo_type === 'depois')?.file_url ?? null;
    if ((!botoxAntesUrl || !botoxDepoisUrl) && firstSession && firstSession.id !== latestSession.id) {
      const firstPhotos = photosFromSessions.filter((p) => p.procedure_session_id === firstSession.id);
      if (!botoxAntesUrl) botoxAntesUrl = firstPhotos.find((p) => p.photo_type === 'antes')?.file_url ?? null;
      if (!botoxDepoisUrl) botoxDepoisUrl = firstPhotos.find((p) => p.photo_type === 'depois')?.file_url ?? null;
    }
  }

  const imgW = (CONTENT_W - 10) / 2;
  const imgH = (imgW * 4) / 3;
  const boxBotox = 50;
  const placeholderText = 'Foto em breve';

  const hasBotoxPhotos = isBotox && (botoxAntesUrl || botoxDepoisUrl);
  const hasGenericPhotos = photoPairs.length > 0 || (!isBotox && otherPhotos.length > 0);
  if (photoPairs.length > 0 || otherPhotos.length > 0 || hasBotoxPhotos) {
    if (y > PAGE_H - 75) {
      doc.addPage();
      doc.setFillColor(...LUXE.offWhite);
      doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
      y = MARGIN;
    }
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...LUXE.roseGold);
    doc.text('Transformação — Antes e Depois', MARGIN, y);
    y += lineHeight + 8;

    if (isBotox && (botoxAntesUrl || botoxDepoisUrl)) {
      if (y + boxBotox + 25 > PAGE_H) {
        doc.addPage();
        doc.setFillColor(...LUXE.offWhite);
        doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
        y = MARGIN;
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...LUXE.textMuted);
      const beforeX = MARGIN;
      const afterX = MARGIN + boxBotox + 10;
      const imgY = y;
      doc.text('Antes', beforeX, imgY - 2);
      doc.text('Depois', afterX, imgY - 2);
      doc.setDrawColor(...LUXE.border);
      doc.setLineWidth(0.2);
      doc.rect(beforeX, imgY, boxBotox, boxBotox, 'S');
      doc.rect(afterX, imgY, boxBotox, boxBotox, 'S');
      const drawBotoxPlaceholder = (x: number) => {
        doc.setFillColor(...LUXE.champagne);
        doc.rect(x, imgY, boxBotox, boxBotox, 'F');
        doc.rect(x, imgY, boxBotox, boxBotox, 'S');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...LUXE.warmGrayLight);
        doc.text(placeholderText, x + boxBotox / 2 - doc.getTextWidth(placeholderText) / 2, imgY + boxBotox / 2 - 1);
      };
      if (botoxAntesUrl) {
        let base64 = await imageUrlToBase64(botoxAntesUrl);
        if (base64) {
          base64 = (await normalizeImageOrientation(base64)) ?? base64;
          try {
            const dims = await getImageDimensions(base64);
            const { drawW, drawH, offsetX, offsetY } = fitInBox(dims.width, dims.height, boxBotox, boxBotox);
            doc.addImage(base64, getImageFormat(base64), beforeX + offsetX, imgY + offsetY, drawW, drawH);
          } catch {
            drawBotoxPlaceholder(beforeX);
          }
        } else {
          drawBotoxPlaceholder(beforeX);
        }
      } else {
        drawBotoxPlaceholder(beforeX);
      }
      if (botoxDepoisUrl) {
        let base64 = await imageUrlToBase64(botoxDepoisUrl);
        if (base64) {
          base64 = (await normalizeImageOrientation(base64)) ?? base64;
          try {
            const dims = await getImageDimensions(base64);
            const { drawW, drawH, offsetX, offsetY } = fitInBox(dims.width, dims.height, boxBotox, boxBotox);
            doc.addImage(base64, getImageFormat(base64), afterX + offsetX, imgY + offsetY, drawW, drawH);
          } catch {
            drawBotoxPlaceholder(afterX);
          }
        } else {
          drawBotoxPlaceholder(afterX);
        }
      } else {
        drawBotoxPlaceholder(afterX);
      }
      y += boxBotox + lineHeight + 8;
    }

    for (const pair of isBotox ? [] : photoPairs) {
      if (y + imgH + 28 > PAGE_H) {
        doc.addPage();
        doc.setFillColor(...LUXE.offWhite);
        doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
        y = MARGIN;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...LUXE.warmGray);
      doc.text(pair.label, MARGIN, y);
      y += lineHeight + 3;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...LUXE.textMuted);
      const beforeX = MARGIN;
      const afterX = MARGIN + imgW + 10;
      const imgY = y;
      doc.text('Antes', beforeX, imgY - 2);
      doc.text('Depois', afterX, imgY - 2);

      const drawFrame = (x: number, w: number, h: number) => {
        doc.setDrawColor(...LUXE.border);
        doc.setLineWidth(0.2);
        doc.rect(x, imgY, w, h, 'S');
      };

      const drawPlaceholder = (x: number) => {
        doc.setFillColor(...LUXE.champagne);
        doc.setDrawColor(...LUXE.border);
        doc.setLineWidth(0.2);
        doc.rect(x, imgY, imgW, imgH, 'FD');
        doc.rect(x, imgY, imgW, imgH, 'S');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...LUXE.warmGrayLight);
        const txt = placeholderText;
        doc.text(txt, x + imgW / 2 - doc.getTextWidth(txt) / 2, imgY + imgH / 2 - 1);
      };

      if (pair.beforeUrl) {
        let base64 = await imageUrlToBase64(pair.beforeUrl);
        if (base64) {
          base64 = (await normalizeImageOrientation(base64)) ?? base64;
          try {
            const dims = await getImageDimensions(base64);
            const { drawW, drawH, offsetX, offsetY } = fitInBox(dims.width, dims.height, imgW, imgH);
            doc.addImage(base64, getImageFormat(base64), beforeX + offsetX, imgY + offsetY, drawW, drawH);
          } catch {
            drawPlaceholder(beforeX);
          }
        } else {
          drawPlaceholder(beforeX);
        }
      } else {
        drawPlaceholder(beforeX);
      }
      drawFrame(beforeX, imgW, imgH);

      if (pair.afterUrl) {
        let base64 = await imageUrlToBase64(pair.afterUrl);
        if (base64) {
          base64 = (await normalizeImageOrientation(base64)) ?? base64;
          try {
            const dims = await getImageDimensions(base64);
            const { drawW, drawH, offsetX, offsetY } = fitInBox(dims.width, dims.height, imgW, imgH);
            doc.addImage(base64, getImageFormat(base64), afterX + offsetX, imgY + offsetY, drawW, drawH);
          } catch {
            drawPlaceholder(afterX);
          }
        } else {
          drawPlaceholder(afterX);
        }
      } else {
        drawPlaceholder(afterX);
      }
      drawFrame(afterX, imgW, imgH);

      y += imgH + lineHeight + 8;
    }

    if (otherPhotos.length > 0 && y + imgH + 15 < PAGE_H) {
      doc.setFont('times', 'bold');
      doc.setFontSize(12);
      doc.text('Outras fotos de evolução', MARGIN, y);
      y += lineHeight + 4;
      doc.setFont('helvetica', 'normal');
      const shown = otherPhotos.slice(0, 6);
      for (const p of shown) {
        if (y + imgH + 10 > PAGE_H) {
          doc.addPage();
          doc.setFillColor(...LUXE.offWhite);
          doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
          y = MARGIN;
        }
        let base64 = await imageUrlToBase64(p.file_url);
        const sess = sessions.find((s) => s.id === p.procedure_session_id);
        const cellW = Math.min(imgW * 2, CONTENT_W);
        doc.setFontSize(9);
        doc.setTextColor(...LUXE.textMuted);
        doc.text(`${p.photo_type} — ${fmtDate(sess?.session_date)}`, MARGIN, y);
        y += lineHeight;
        if (base64) {
          base64 = (await normalizeImageOrientation(base64)) ?? base64;
          try {
            const dims = await getImageDimensions(base64);
            const { drawW, drawH, offsetX, offsetY } = fitInBox(dims.width, dims.height, cellW, imgH);
            doc.addImage(base64, getImageFormat(base64), MARGIN + offsetX, y + offsetY, drawW, drawH);
            y += imgH + 4;
          } catch {
            y += 4;
          }
        } else {
          y += 4;
        }
        y += 4;
      }
    }
  }

  // —— 5. Rodapé ————————————————————————————————————————————————————
  if (clinicContact && String(clinicContact).trim() !== '') {
    const footerY = PAGE_H - 14;
    doc.setDrawColor(...LUXE.border);
    doc.setLineWidth(0.15);
    doc.line(MARGIN, footerY - 5, MARGIN + CONTENT_W, footerY - 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...LUXE.textMuted);
    doc.text(String(clinicContact).trim(), MARGIN, footerY + 2);
  }

  // —— Upload + WhatsApp (opcional) ——————————————————————————————————
  if (uploadPdfFunction && clientPhoneNumber) {
    const blob = doc.output('blob');
    try {
      const pdfUrl = await uploadPdfFunction(blob);
      const clinic = (clinicName && String(clinicName).trim()) || 'Clínica';
      let template: string | null | undefined;
      if (professionalId) {
        const templates = await loadWhatsappManualTemplates(professionalId);
        template = templates.procedure_report.message;
      }
      const message = buildProcedureReportWhatsAppMessage({
        patientName,
        clinicName: clinic,
        procedureName,
        reportUrl: pdfUrl,
        template,
      });
      const whatsappUrl = `https://wa.me/${clientPhoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
      return { doc, pdfUrl, whatsappUrl };
    } catch {
      return doc;
    }
  }

  return doc;
}

/** Número para link WhatsApp (apenas dígitos, com 55 para Brasil). */
export function formatPhoneForWhatsApp(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const withCountry =
    digits.length === 11 && digits.startsWith('0')
      ? '55' + digits.slice(1)
      : digits.length === 10
        ? '55' + digits
        : digits.startsWith('55')
          ? digits
          : '55' + digits;
  return withCountry;
}
