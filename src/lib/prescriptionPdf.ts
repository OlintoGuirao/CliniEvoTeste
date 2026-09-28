import { jsPDF } from 'jspdf';

export type PrescriptionPdfItem = {
  medication: string;
  dosage?: string | null;
  usageMode: string;
};

export type PrescriptionPdfLayout = 'classic' | 'clinic';

type BuildPrescriptionPdfParams = {
  /** classic = solo/salão (inalterado). clinic = layout clínico novo. */
  layout?: PrescriptionPdfLayout;
  patientName: string;
  patientCpf?: string | null;
  patientDateOfBirth?: string | null;
  clinicName?: string | null;
  clinicAddress?: string | null;
  clinicCnpj?: string | null;
  logoUrl?: string | null;
  professionalName: string;
  professionalTitle?: string | null;
  professionalRegistry: string | null;
  issuedAt: string;
  prescriptionText?: string;
  items?: PrescriptionPdfItem[];
  signatureDataUrl: string | null;
  stampDataUrl?: string | null;
  usageLabel?: string | null;
};

async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function dataUrlToImageSize(dataUrl: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function removeLightBackground(dataUrl: string): Promise<string> {
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = imageData.data;

        for (let i = 0; i < px.length; i += 4) {
          const r = px[i];
          const g = px[i + 1];
          const b = px[i + 2];

          // Remove tons muito claros (fundo branco/cinza claro da logo)
          if (r > 242 && g > 242 && b > 242) {
            px[i + 3] = 0;
            continue;
          }

          // Suaviza bordas claras para evitar halo
          if (r > 225 && g > 225 && b > 225) {
            px[i + 3] = Math.min(px[i + 3], 90);
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function buildWatermarkDataUrl(imageUrl: string): Promise<string | null> {
  const base = await imageUrlToDataUrl(imageUrl);
  if (!base) return null;
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Reduz resolução para evitar PDF gigante no storage
        const maxDimension = 520;
        const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
        const drawW = Math.max(1, Math.round(img.naturalWidth * scale));
        const drawH = Math.max(1, Math.round(img.naturalHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = drawW;
        canvas.height = drawH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, drawW, drawH);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = imageData.data;

        for (let i = 0; i < px.length; i += 4) {
          const alpha = px[i + 3] / 255;
          if (alpha <= 0.01) continue;

          const r = px[i];
          const g = px[i + 1];
          const b = px[i + 2];

          // Mantém marca d'água discreta, mas visível
          px[i] = Math.round(r * 0.68 + 247 * 0.32);
          px[i + 1] = Math.round(g * 0.68 + 245 * 0.32);
          px[i + 2] = Math.round(b * 0.68 + 242 * 0.32);
          px[i + 3] = Math.max(54, Math.round(255 * alpha * 0.52));
        }

        ctx.putImageData(imageData, 0, 0);
        // PNG mantém transparência e evita fundo preto em áreas originalmente transparentes
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(base);
      }
    };
    img.onerror = () => resolve(base);
    img.src = base;
  });
}

function imageFormatFromDataUrl(dataUrl: string): 'PNG' | 'JPEG' {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
}

async function optimizeImageDataUrl(
  dataUrl: string,
  options: { maxDimension: number; quality?: number; forceJpeg?: boolean }
): Promise<string> {
  if (typeof window === 'undefined') return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, options.maxDimension / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (options.forceJpeg) {
          // Evita fundo preto ao exportar JPEG (sem canal alpha)
          ctx.fillStyle = 'rgb(247,245,242)';
          ctx.fillRect(0, 0, w, h);
        }

        ctx.drawImage(img, 0, 0, w, h);

        if (options.forceJpeg) {
          resolve(canvas.toDataURL('image/jpeg', options.quality ?? 0.5));
          return;
        }

        if (dataUrl.startsWith('data:image/png')) {
          resolve(canvas.toDataURL('image/png'));
          return;
        }

        resolve(canvas.toDataURL('image/jpeg', options.quality ?? 0.7));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function normalizeDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const d = isoDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return isoDate;
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

async function buildClassicPrescriptionPdf(params: BuildPrescriptionPdfParams): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN_X = 18;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;

  // Background clean
  doc.setFillColor(247, 245, 242);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  // Marca d'água de fundo do receituário
  const watermarkUrl = typeof window !== 'undefined' ? `${window.location.origin}/LogoReceiturario.png` : null;
  if (watermarkUrl) {
    const watermarkDataUrl = await buildWatermarkDataUrl(watermarkUrl);
    if (watermarkDataUrl) {
      const wmSize = await dataUrlToImageSize(watermarkDataUrl);
      if (wmSize) {
        const maxW = CONTENT_W * 0.92;
        const maxH = PAGE_H * 0.78;
        const scale = Math.min(maxW / wmSize.width, maxH / wmSize.height);
        const drawW = wmSize.width * scale;
        const drawH = wmSize.height * scale;
        const x = PAGE_W / 2 - drawW / 2;
        const y = PAGE_H / 2 - drawH / 2 + 8;
        doc.addImage(watermarkDataUrl, imageFormatFromDataUrl(watermarkDataUrl), x, y, drawW, drawH);
      }
    }
  }

  // Header centralizado com logo do sistema
  const clinicLabel = params.clinicName?.trim() || 'CliniEvo';
  const logoCandidate = typeof window !== 'undefined' ? `${window.location.origin}/LogoCentralReceituario.png` : null;
  let headerBottomY = 30;

  if (logoCandidate) {
    const rawLogoDataUrl = await imageUrlToDataUrl(logoCandidate);
    const cleanedLogo = rawLogoDataUrl ? await removeLightBackground(rawLogoDataUrl) : null;
    const logoDataUrl = cleanedLogo
      ? await optimizeImageDataUrl(cleanedLogo, { maxDimension: 640 })
      : null;
    if (logoDataUrl) {
      const logoSize = await dataUrlToImageSize(logoDataUrl);
      if (logoSize) {
        const maxW = 42;
        const maxH = 18;
        const scale = Math.min(maxW / logoSize.width, maxH / logoSize.height);
        const drawW = logoSize.width * scale;
        const drawH = logoSize.height * scale;
        const logoX = PAGE_W / 2 - drawW / 2;
        const logoY = 12;
        doc.addImage(
          logoDataUrl,
          logoDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG',
          logoX,
          logoY,
          drawW,
          drawH
        );
        headerBottomY = logoY + drawH;
      }
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(59, 66, 148);
  doc.text(clinicLabel, PAGE_W / 2, headerBottomY + 7, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 105, 160);
  doc.text('Receituário', PAGE_W / 2, headerBottomY + 13, { align: 'center' });

  doc.setDrawColor(205, 208, 236);
  doc.setLineWidth(0.35);
  doc.line(MARGIN_X, headerBottomY + 18, MARGIN_X + CONTENT_W, headerBottomY + 18);

  // Info block
  let y = headerBottomY + 32;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(52, 57, 114);
  doc.text(`Paciente: ${params.patientName}`, MARGIN_X, y);
  y += 7;
  doc.text(`Especialista: ${params.professionalName}`, MARGIN_X, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.text(`Data: ${normalizeDate(params.issuedAt)}`, MARGIN_X, y);
  y += 10;

  doc.setDrawColor(220, 222, 236);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_X, y, MARGIN_X + CONTENT_W, y);
  y += 8;

  // Prescription body
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(52, 57, 114);
  doc.text('Prescrição', MARGIN_X, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(56, 60, 98);
  const lines = doc.splitTextToSize(params.prescriptionText || 'Sem conteúdo.', CONTENT_W);
  doc.text(lines, MARGIN_X, y);

  const textHeight = Math.max(0, lines.length - 1) * 5.4;
  y += 6 + textHeight;

  // Signature section com alinhamento de prontuário
  const signatureLineY = Math.max(248, Math.min(268, y + 24));
  const signatureLineStartX = MARGIN_X;
  const signatureLineEndX = MARGIN_X + 82;

  doc.setDrawColor(145, 150, 208);
  doc.setLineWidth(0.4);
  doc.line(signatureLineStartX, signatureLineY, signatureLineEndX, signatureLineY);

  if (params.signatureDataUrl) {
    const optimizedSignature = await optimizeImageDataUrl(params.signatureDataUrl, {
      maxDimension: 900,
    });
    const dims = await dataUrlToImageSize(optimizedSignature);
    if (dims) {
      const maxW = 56;
      const maxH = 20;
      const scale = Math.min(maxW / dims.width, maxH / dims.height);
      const drawW = dims.width * scale;
      const drawH = dims.height * scale;
      const signX = signatureLineStartX + 1;
      const signY = signatureLineY - drawH + 1.2;
      doc.addImage(
        optimizedSignature,
        imageFormatFromDataUrl(optimizedSignature),
        signX,
        signY,
        drawW,
        drawH
      );
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 95, 150);
  if (params.professionalRegistry?.trim()) {
    doc.text(params.professionalRegistry.trim(), signatureLineStartX, signatureLineY + 3.6);
  }
  doc.text('Assinatura', signatureLineStartX, signatureLineY + 8);

  return doc;
}

export function formatPrescriptionCpf(value: string | null | undefined): string {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.length !== 11) return value?.trim() || '—';
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function formatPrescriptionCnpj(value: string | null | undefined): string {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.length !== 14) return value?.trim() || '';
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/** Separa dose no final do nome (ex.: "Clavulin 875mg" → nome + dose). */
export function splitMedicationDosage(raw: string): { medication: string; dosage: string } {
  const text = raw.trim();
  const match = text.match(
    /^(.+?)\s+(\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|ug|g|ml|ui|cp|caps?|%|G|MG|ML))\s*$/i
  );
  if (!match) return { medication: text, dosage: '' };
  return { medication: match[1].trim(), dosage: match[2].replace(/\s+/g, '') };
}

export function normalizePrescriptionPdfItems(
  items?: PrescriptionPdfItem[] | null,
  prescriptionText?: string | null
): PrescriptionPdfItem[] {
  if (Array.isArray(items) && items.length > 0) {
    return items
      .map((item) => {
        const medicationRaw = item.medication?.trim() || '';
        const dosageRaw = item.dosage?.trim() || '';
        const usageMode = item.usageMode?.trim() || '';
        if (!medicationRaw || !usageMode) return null;
        if (dosageRaw) {
          return { medication: medicationRaw, dosage: dosageRaw, usageMode };
        }
        const split = splitMedicationDosage(medicationRaw);
        return {
          medication: split.medication,
          dosage: split.dosage || null,
          usageMode,
        };
      })
      .filter((row): row is PrescriptionPdfItem => !!row);
  }

  const text = prescriptionText?.trim() || '';
  if (!text) return [];

  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const parsed: PrescriptionPdfItem[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    const medicationLine = lines[0].replace(/^\d+\.\s*/, '');
    const usage = lines.slice(1).join(' ').trim();
    if (!medicationLine || !usage) continue;
    const split = splitMedicationDosage(medicationLine);
    parsed.push({
      medication: split.medication,
      dosage: split.dosage || null,
      usageMode: usage,
    });
  }

  return parsed;
}

function drawRule(doc: jsPDF, x: number, y: number, width: number) {
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.25);
  doc.line(x, y, x + width, y);
}

function drawDottedLeader(
  doc: jsPDF,
  startX: number,
  endX: number,
  y: number
) {
  if (endX - startX < 4) return;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  let x = startX;
  while (x < endX) {
    doc.text('.', x, y);
    x += 1.7;
  }
}

function drawMedicationRow(
  doc: jsPDF,
  item: PrescriptionPdfItem,
  x: number,
  y: number,
  width: number
): number {
  const dosage = item.dosage?.trim() || '';
  const name = item.medication.trim();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);

  const nameWidth = doc.getTextWidth(name);
  const dosageWidth = dosage ? doc.getTextWidth(dosage) : 0;

  doc.text(name, x, y);
  if (dosage) {
    doc.text(dosage, x + width, y, { align: 'right' });
    drawDottedLeader(doc, x + nameWidth + 2, x + width - dosageWidth - 2, y);
  }

  let nextY = y + 5.5;
  const usageLines = doc.splitTextToSize(item.usageMode.trim(), width);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(35, 35, 35);
  doc.text(usageLines, x, nextY);
  nextY += Math.max(1, usageLines.length) * 5 + 4;
  return nextY;
}

async function buildClinicPrescriptionPdf(params: BuildPrescriptionPdfParams): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN_X = 18;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  const clinicLabel = params.clinicName?.trim() || 'Clínica';
  const clinicAddress = params.clinicAddress?.trim() || '';
  const clinicCnpj = formatPrescriptionCnpj(params.clinicCnpj);

  let y = 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 15, 15);
  doc.text(clinicLabel, MARGIN_X, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (clinicAddress) {
    const addressLines = doc.splitTextToSize(clinicAddress, CONTENT_W);
    doc.text(addressLines, MARGIN_X, y);
    y += addressLines.length * 4.6 + 1;
  }
  if (clinicCnpj) {
    doc.text(`CNPJ: ${clinicCnpj}`, MARGIN_X, y);
    y += 5;
  }

  y += 2;
  drawRule(doc, MARGIN_X, y, CONTENT_W);
  y += 8;

  const leftX = MARGIN_X;
  const rightX = MARGIN_X + CONTENT_W;
  const patientCpf = formatPrescriptionCpf(params.patientCpf);
  const patientDob = normalizeDate(params.patientDateOfBirth);
  const registry = params.professionalRegistry?.trim() || '—';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(20, 20, 20);

  doc.text(`Paciente: ${params.patientName || 'Paciente'}`, leftX, y);
  doc.text(`Profissional: ${params.professionalName || 'Profissional'}`, rightX, y, {
    align: 'right',
  });
  y += 5.5;

  doc.text(`CPF: ${patientCpf}`, leftX, y);
  doc.text(`Registro: ${registry}`, rightX, y, { align: 'right' });
  y += 5.5;

  doc.text(`Data de Nascimento: ${patientDob}`, leftX, y);
  y += 6;

  drawRule(doc, MARGIN_X, y, CONTENT_W);
  y += 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 15, 15);
  doc.text('Prescrição', PAGE_W / 2, y, { align: 'center' });
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(params.usageLabel?.trim() || 'Uso interno:', MARGIN_X, y);
  y += 8;

  const items = normalizePrescriptionPdfItems(params.items, params.prescriptionText);
  if (items.length === 0) {
    doc.setFontSize(10.5);
    doc.setTextColor(80, 80, 80);
    doc.text('Sem conteúdo.', MARGIN_X, y);
    y += 8;
  } else {
    for (const item of items) {
      if (y > PAGE_H - 55) {
        doc.addPage();
        y = 20;
      }
      y = drawMedicationRow(doc, item, MARGIN_X, y, CONTENT_W);
    }
  }

  // Rodapé centralizado: carimbo / assinatura do especialista
  const stampBottomY = Math.max(250, Math.min(272, y + 28));
  const stampCenterX = PAGE_W / 2;

  if (params.stampDataUrl?.trim()) {
    const optimizedStamp = await optimizeImageDataUrl(params.stampDataUrl, {
      maxDimension: 900,
    });
    const dims = await dataUrlToImageSize(optimizedStamp);
    if (dims) {
      const maxW = 72;
      const maxH = 36;
      const scale = Math.min(maxW / dims.width, maxH / dims.height);
      const drawW = dims.width * scale;
      const drawH = dims.height * scale;
      const stampX = stampCenterX - drawW / 2;
      const stampY = stampBottomY - drawH;
      doc.addImage(
        optimizedStamp,
        imageFormatFromDataUrl(optimizedStamp),
        stampX,
        stampY,
        drawW,
        drawH
      );
      return doc;
    }
  }

  let textY = stampBottomY;

  if (params.signatureDataUrl) {
    const optimizedSignature = await optimizeImageDataUrl(params.signatureDataUrl, {
      maxDimension: 900,
    });
    const dims = await dataUrlToImageSize(optimizedSignature);
    if (dims) {
      const maxW = 48;
      const maxH = 16;
      const scale = Math.min(maxW / dims.width, maxH / dims.height);
      const drawW = dims.width * scale;
      const drawH = dims.height * scale;
      const signX = stampCenterX - drawW / 2;
      const signY = textY - drawH - 10;
      doc.addImage(
        optimizedSignature,
        imageFormatFromDataUrl(optimizedSignature),
        signX,
        signY,
        drawW,
        drawH
      );
      textY = signY + drawH + 3;
    } else {
      textY -= 10;
    }
  } else {
    textY -= 10;
  }

  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.35);
  const lineW = 58;
  doc.line(stampCenterX - lineW / 2, textY, stampCenterX + lineW / 2, textY);
  textY += 5;

  doc.setTextColor(20, 20, 20);
  doc.setFont('times', 'italic');
  doc.setFontSize(12);
  doc.text(params.professionalName || 'Profissional', stampCenterX, textY, { align: 'center' });
  textY += 5;

  const title = params.professionalTitle?.trim();
  if (title) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(title, stampCenterX, textY, { align: 'center' });
    textY += 4.5;
  }

  if (params.professionalRegistry?.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(params.professionalRegistry.trim(), stampCenterX, textY, { align: 'center' });
  }

  return doc;
}

export async function buildPrescriptionPdf(params: BuildPrescriptionPdfParams): Promise<jsPDF> {
  if (params.layout === 'clinic') {
    return buildClinicPrescriptionPdf(params);
  }
  return buildClassicPrescriptionPdf(params);
}
