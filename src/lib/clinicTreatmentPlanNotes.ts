const CLINIC_TREATMENT_ITEMS_PREFIX = 'clinic_treatment_items:';

export type ClinicTreatmentPlanNoteItem = {
  id: string;
  procedureName: string;
  treatmentPlanName?: string;
};

/** Anexa procedimentos selecionados do plano sem duplicar a linha de metadados. */
export function appendClinicTreatmentItemsToNotes(
  existingNotes: string | null | undefined,
  items: ClinicTreatmentPlanNoteItem[]
): string | null {
  const cleaned = stripClinicTreatmentItemsFromNotes(existingNotes);
  if (!items.length) return cleaned;

  const label = items.map((item) => item.procedureName.trim()).filter(Boolean).join('; ');
  if (!label) return cleaned;

  const meta = `${CLINIC_TREATMENT_ITEMS_PREFIX}${label}`;
  return cleaned ? `${cleaned}\n${meta}` : meta;
}

export function stripClinicTreatmentItemsFromNotes(
  notes: string | null | undefined
): string | null {
  if (!notes?.trim()) return null;
  const lines = notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith(CLINIC_TREATMENT_ITEMS_PREFIX));
  return lines.length ? lines.join('\n') : null;
}

export function parseClinicTreatmentItemsFromNotes(
  notes: string | null | undefined
): string[] {
  if (!notes) return [];
  for (const raw of notes.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith(CLINIC_TREATMENT_ITEMS_PREFIX)) continue;
    return line
      .slice(CLINIC_TREATMENT_ITEMS_PREFIX.length)
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}
