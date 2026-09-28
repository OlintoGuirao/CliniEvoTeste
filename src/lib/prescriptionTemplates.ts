export type PrescriptionTemplateItem = {
  medication: string;
  /** Dose exibida à direita no PDF (ex.: 875mg). */
  dosage?: string;
  usageMode: string;
};

export type PrescriptionTemplateRow = {
  id: string;
  professional_id: string;
  title: string;
  items: unknown;
  created_at: string;
  updated_at: string;
};

export function parsePrescriptionTemplateItems(raw: unknown): PrescriptionTemplateItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      return {
        medication: typeof row.medication === 'string' ? row.medication : '',
        dosage: typeof row.dosage === 'string' ? row.dosage : '',
        usageMode: typeof row.usageMode === 'string' ? row.usageMode : '',
      };
    })
    .filter((row): row is PrescriptionTemplateItem => !!row);
}

export function prescriptionTemplateItemsToBody(items: PrescriptionTemplateItem[]): string {
  return items
    .map((item) => ({
      medication: item.medication.trim(),
      dosage: item.dosage?.trim() || '',
      usageMode: item.usageMode.trim(),
    }))
    .filter((item) => item.medication && item.usageMode)
    .map((item, idx) => {
      const medLine = item.dosage ? `${item.medication} ${item.dosage}` : item.medication;
      return `${idx + 1}. ${medLine}\n${item.usageMode}`;
    })
    .join('\n\n');
}

function encodeBase64Url(value: string): string {
  return btoa(unescape(encodeURIComponent(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function buildPrescriptionShareLink(filePath: string): string {
  const publicBase = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');
  const token = encodeBase64Url(filePath);
  return `${publicBase}/rx?f=${encodeURIComponent(token)}`;
}
