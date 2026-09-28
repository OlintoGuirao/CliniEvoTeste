import {
  getDepilacaoReminderTargets,
  isDepilacaoDefinitivaSlug,
  isDepilacaoHiddenFieldKey,
  normalizeDepilacaoSessionData,
  serializeDepilacaoSessionData,
  validateDepilacaoSessionData,
  DEPILACAO_AREAS_STORAGE_KEY,
  getDepilacaoAreasForForm,
} from '@/lib/depilacaoDefinitiva';
import {
  getRegionConfig,
  getRegionItemsForForm,
  isRegionHiddenFieldKey,
  isRegionProcedureSlug,
  REGION_AREAS_STORAGE_KEY,
  serializeRegionSessionData,
  validateRegionSessionData,
} from '@/lib/procedureRegionBlocks';
import { supabase } from '@/integrations/supabase/client';

export function isNewCustomProcedureSlug(slug: string): boolean {
  return isDepilacaoDefinitivaSlug(slug) || isRegionProcedureSlug(slug);
}

export function isNewCustomHiddenFieldKey(slug: string, fieldKey: string): boolean {
  if (isDepilacaoDefinitivaSlug(slug)) return isDepilacaoHiddenFieldKey(fieldKey);
  if (isRegionProcedureSlug(slug)) return isRegionHiddenFieldKey(fieldKey);
  return false;
}

export function normalizeNewCustomSessionData(
  slug: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  if (isDepilacaoDefinitivaSlug(slug)) return normalizeDepilacaoSessionData(data);
  return data;
}

export function serializeNewCustomSessionData(
  slug: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  if (isDepilacaoDefinitivaSlug(slug)) return serializeDepilacaoSessionData(data);
  const cfg = getRegionConfig(slug);
  if (cfg) return serializeRegionSessionData(data, cfg.fields);
  return data;
}

export function validateNewCustomSessionData(slug: string, data: Record<string, unknown>): string | null {
  if (isDepilacaoDefinitivaSlug(slug)) {
    return validateDepilacaoSessionData(data, { requireSignature: true });
  }
  const cfg = getRegionConfig(slug);
  if (cfg) return validateRegionSessionData(data, cfg.fields);
  return null;
}

export function getDepilacaoFormAreas(data: Record<string, unknown> | undefined) {
  return getDepilacaoAreasForForm(data);
}

export function getRegionFormItems(slug: string, data: Record<string, unknown> | undefined) {
  const cfg = getRegionConfig(slug);
  if (!cfg) return [];
  return getRegionItemsForForm(data, cfg.fields);
}

export { DEPILACAO_AREAS_STORAGE_KEY, REGION_AREAS_STORAGE_KEY, getRegionConfig };

/** Cria/atualiza lembretes por área (reusa botox_reapplication_reminders). */
export async function syncDepilacaoDefinitivaReminders(params: {
  slug: string;
  patientId: string;
  professionalId: string;
  procedureInstanceId: string;
  procedureSessionId: string;
  data: Record<string, unknown>;
}): Promise<void> {
  const targets = getDepilacaoReminderTargets(params.slug, params.data);
  await supabase
    .from('botox_reapplication_reminders')
    .delete()
    .eq('procedure_session_id', params.procedureSessionId)
    .eq('reminder_kind', 'depilacao_definitiva');

  if (targets.length === 0) return;

  const rows = targets.map((t) => ({
    patient_id: params.patientId,
    professional_id: params.professionalId,
    procedure_instance_id: params.procedureInstanceId,
    procedure_session_id: params.procedureSessionId,
    due_date: t.due_date,
    area_key: t.area_key,
    area_label: t.area_label,
    reminder_kind: 'depilacao_definitiva',
    notified_at: null,
  }));

  const { error } = await supabase.from('botox_reapplication_reminders').insert(rows);
  if (error) throw error;
}
