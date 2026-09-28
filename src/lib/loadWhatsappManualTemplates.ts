import { fetchProfessionalUiSettings } from '@/services/api/dynamicProcedureFieldSettingsApi';
import {
  defaultWhatsappManualTemplatesMap,
  type WhatsappManualTemplatesMap,
} from '@/lib/whatsappManualTemplates';

export async function loadWhatsappManualTemplates(
  professionalId: string | null | undefined
): Promise<WhatsappManualTemplatesMap> {
  if (!professionalId) return defaultWhatsappManualTemplatesMap();
  try {
    const ui = await fetchProfessionalUiSettings({ professionalId });
    return ui.whatsapp_message_templates;
  } catch {
    return defaultWhatsappManualTemplatesMap();
  }
}
