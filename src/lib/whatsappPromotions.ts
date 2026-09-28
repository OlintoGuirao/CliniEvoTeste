import { getChatbotApiBase } from '@/lib/programaBotoxBilling';
import { supabase } from '@/integrations/supabase/client';

export type WhatsappPromotionContentType = 'text' | 'text_image' | 'image' | 'video';

export type WhatsappPromotionSummary = {
  promotionId?: string | null;
  total: number;
  sent: number;
  failed: number;
  skipped?: number;
  limitReached?: boolean;
  sentPatients?: Array<{ patientName: string; messageId?: string | null }>;
  failedPatients?: Array<{ patientName: string; error: string }>;
};

export type WhatsappPromotionRow = {
  id: string;
  title: string | null;
  content_type: WhatsappPromotionContentType;
  message_text: string | null;
  details_text?: string | null;
  media_url: string | null;
  max_participants: number | null;
  claimed_count: number;
  menu_enabled: boolean;
  procedure_id?: string | null;
  status?: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
};

function promotionHasSlots(row: {
  max_participants: number | null;
  claimed_count: number;
}): boolean {
  const max = row.max_participants;
  if (max == null || max <= 0) return true;
  return Number(row.claimed_count || 0) < max;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

export function contentTypeLabel(type: WhatsappPromotionContentType): string {
  switch (type) {
    case 'text':
      return 'Somente texto';
    case 'text_image':
      return 'Texto + imagem';
    case 'image':
      return 'Somente imagem';
    case 'video':
      return 'Vídeo';
    default:
      return type;
  }
}

export async function uploadPromotionMedia(params: {
  professionalId: string;
  file: File;
  kind: 'image' | 'video';
}): Promise<{ publicUrl: string; storagePath: string; mimeType: string }> {
  const { professionalId, file, kind } = params;
  const allowed = kind === 'image' ? IMAGE_TYPES : VIDEO_TYPES;
  if (!allowed.includes(file.type)) {
    throw new Error(
      kind === 'image'
        ? 'Use JPEG, PNG, GIF ou WebP.'
        : 'Use MP4, MOV ou WebM.'
    );
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || (kind === 'image' ? 'jpg' : 'mp4');
  const storagePath = `${professionalId}/promo-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from('whatsapp-promotions').upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('whatsapp-promotions').getPublicUrl(storagePath);
  return {
    publicUrl: data.publicUrl,
    storagePath,
    mimeType: file.type,
  };
}

export async function broadcastWhatsappPromotion(params: {
  professionalId: string;
  contentType: WhatsappPromotionContentType;
  title?: string;
  messageText?: string;
  detailsText?: string;
  mediaUrl?: string;
  mediaStoragePath?: string;
  mediaMimeType?: string;
  maxParticipants?: number | null;
  menuEnabled?: boolean;
  procedureId?: string | null;
}): Promise<{ ok: boolean; message?: string; summary?: WhatsappPromotionSummary; error?: string }> {
  const base = getChatbotApiBase();
  if (!base) {
    return { ok: false, error: 'Configure VITE_CHATBOT_API_URL para enviar promoções.' };
  }

  const res = await fetch(`${base}/whatsapp-promotions/broadcast/${params.professionalId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentType: params.contentType,
      title: params.title?.trim() || '',
      messageText: params.messageText?.trim() || '',
      detailsText: params.detailsText?.trim() || '',
      mediaUrl: params.mediaUrl || '',
      mediaStoragePath: params.mediaStoragePath || '',
      mediaMimeType: params.mediaMimeType || '',
      maxParticipants: params.maxParticipants ?? null,
      menuEnabled: params.menuEnabled !== false,
      procedureId: params.procedureId || null,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: typeof data?.error === 'string' ? data.error : 'Falha ao enviar promoção' };
  }

  return {
    ok: true,
    message: typeof data?.message === 'string' ? data.message : undefined,
    summary: data?.summary as WhatsappPromotionSummary | undefined,
  };
}

export async function fetchWhatsappPromotionHistory(professionalId: string): Promise<WhatsappPromotionRow[]> {
  const selectWithProcedure =
    'id, title, content_type, message_text, details_text, media_url, max_participants, claimed_count, menu_enabled, procedure_id, status, total_recipients, sent_count, failed_count, created_at';
  const selectLegacy =
    'id, title, content_type, message_text, details_text, media_url, max_participants, claimed_count, menu_enabled, status, total_recipients, sent_count, failed_count, created_at';

  let { data, error } = await (supabase as any)
    .from('whatsapp_promotions')
    .select(selectWithProcedure)
    .eq('professional_id', professionalId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error && /procedure_id|column/i.test(error.message || '')) {
    ({ data, error } = await (supabase as any)
      .from('whatsapp_promotions')
      .select(selectLegacy)
      .eq('professional_id', professionalId)
      .order('created_at', { ascending: false })
      .limit(50));
  }

  if (error) throw new Error(error.message);
  return (data || []) as WhatsappPromotionRow[];
}

export async function updateWhatsappPromotion(
  professionalId: string,
  promotionId: string,
  patch: {
    title?: string;
    messageText?: string;
    detailsText?: string;
    contentType?: WhatsappPromotionContentType;
    mediaUrl?: string | null;
    mediaStoragePath?: string | null;
    mediaMimeType?: string | null;
    maxParticipants?: number | null;
    menuEnabled?: boolean;
    procedureId?: string | null;
    status?: string;
  }
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.messageText !== undefined) row.message_text = patch.messageText;
  if (patch.detailsText !== undefined) row.details_text = patch.detailsText;
  if (patch.contentType !== undefined) row.content_type = patch.contentType;
  if (patch.mediaUrl !== undefined) row.media_url = patch.mediaUrl;
  if (patch.mediaStoragePath !== undefined) row.media_storage_path = patch.mediaStoragePath;
  if (patch.mediaMimeType !== undefined) row.media_mime_type = patch.mediaMimeType;
  if (patch.maxParticipants !== undefined) row.max_participants = patch.maxParticipants;
  if (patch.menuEnabled !== undefined) row.menu_enabled = patch.menuEnabled;
  if (patch.procedureId !== undefined) row.procedure_id = patch.procedureId;
  if (patch.status !== undefined) row.status = patch.status;

  const { error } = await (supabase as any)
    .from('whatsapp_promotions')
    .update(row)
    .eq('id', promotionId)
    .eq('professional_id', professionalId);

  if (error) throw new Error(error.message);
}

export async function setWhatsappPromotionMenuEnabled(
  professionalId: string,
  promotionId: string,
  menuEnabled: boolean
): Promise<void> {
  const patch: { menuEnabled: boolean; status?: string } = { menuEnabled };
  if (menuEnabled) {
    patch.status = 'active';
  }
  await updateWhatsappPromotion(professionalId, promotionId, patch);
}

export async function deleteWhatsappPromotion(
  professionalId: string,
  promotionId: string
): Promise<void> {
  const { error } = await (supabase as any)
    .from('whatsapp_promotions')
    .delete()
    .eq('id', promotionId)
    .eq('professional_id', professionalId);

  if (error) throw new Error(error.message);
}

/** Promoções que aparecem no menu do bot ("Ver promoções"). */
export async function fetchActiveWhatsappPromotions(
  professionalId: string
): Promise<WhatsappPromotionRow[]> {
  const { data, error } = await (supabase as any)
    .from('whatsapp_promotions')
    .select(
      'id, title, content_type, message_text, details_text, media_url, max_participants, claimed_count, menu_enabled, procedure_id, status, total_recipients, sent_count, failed_count, created_at'
    )
    .eq('professional_id', professionalId)
    .eq('menu_enabled', true)
    .in('status', ['active', 'completed', 'sending'])
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);
  return ((data || []) as WhatsappPromotionRow[]).filter((row) => promotionHasSlots(row));
}
