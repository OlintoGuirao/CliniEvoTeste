/** Linha do carimbo no formato físico: "CRO-GO 23044". */

import { parseRegistryNumberAndUf } from '@/components/clinic/ClinicMemberRoleFields';
import { professionForCouncil } from '@/lib/clinicTeamRoles';

export function formatProfessionalStampRegistry(
  body: string | null | undefined,
  number: string | null | undefined
): string {
  const council = (body ?? '').trim();
  const registry = (number ?? '').trim();
  if (!council && !registry) return '';

  const { registryNumber, registryUf } = parseRegistryNumberAndUf(registry);
  const uf = registryUf.trim().toUpperCase();
  const num = registryNumber.trim();

  if (council && uf && num) return `${council}-${uf} ${num}`;
  if (council && registry) {
    if (registry.toUpperCase().startsWith(council.toUpperCase())) return registry;
    return `${council} ${registry}`;
  }
  if (!council) return registry;
  return council;
}

/** Título do meio do carimbo (ex.: Cirurgiã Dentista / Implantodontista). */
export function formatProfessionalStampTitle(
  councilId: string | null | undefined,
  specialty: string | null | undefined
): string {
  const s = (specialty ?? '').trim();
  if (s) {
    const normalized = s.toLowerCase();
    if (councilId === 'CRO' && (normalized === 'dentista' || normalized === 'clínico geral')) {
      return 'Cirurgiã Dentista';
    }
    return s;
  }
  if (councilId === 'CRO') return 'Cirurgiã Dentista';
  return professionForCouncil(councilId) ?? '';
}

export type CreateProfessionalStampOptions = {
  signatureDataUrl: string;
  fullName: string;
  registryLine: string;
  titleLine?: string | null;
  width?: number;
  height?: number;
};

/** Gera PNG do carimbo no estilo físico: nome · título · CRO-UF número. */
export function createProfessionalStampDataUrl(
  options: CreateProfessionalStampOptions
): Promise<string> {
  const titleLine = (options.titleLine ?? '').trim();
  const width = options.width ?? 640;
  const height = options.height ?? 300;
  const { signatureDataUrl, fullName, registryLine } = options;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas não disponível'));
      return;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const img = new Image();
    img.onload = () => {
      const sigMaxW = width * 0.7;
      const sigMaxH = height * 0.34;
      const scale = Math.min(sigMaxW / img.width, sigMaxH / img.height, 1);
      const sigW = img.width * scale;
      const sigH = img.height * scale;
      const sigX = (width - sigW) / 2;
      const sigY = height * 0.05;
      ctx.drawImage(img, sigX, sigY, sigW, sigH);

      const lineY = sigY + sigH + 10;
      const lineInset = width * 0.22;
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(lineInset, lineY);
      ctx.lineTo(width - lineInset, lineY);
      ctx.stroke();

      ctx.fillStyle = '#111111';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      let textY = lineY + 14;
      ctx.font = 'italic 700 22px "Times New Roman", Times, serif';
      ctx.fillText(fullName || 'Profissional', width / 2, textY, width * 0.88);
      textY += 28;

      if (titleLine) {
        ctx.font = '400 16px Arial, Helvetica, sans-serif';
        ctx.fillText(titleLine, width / 2, textY, width * 0.88);
        textY += 22;
      }

      if (registryLine) {
        ctx.font = '400 16px Arial, Helvetica, sans-serif';
        ctx.fillText(registryLine, width / 2, textY, width * 0.88);
      }

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Não foi possível carregar a assinatura'));
    img.src = signatureDataUrl;
  });
}
