import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getChatbotApiBase, phoneToWhatsAppDigits } from '@/lib/programaBotoxBilling';
import { openWhatsAppWithFallback } from '@/lib/reportShare';
import {
  DEFAULT_WHATSAPP_MANUAL_MESSAGES,
  applyWhatsappPlaceholders,
} from '@/lib/whatsappManualTemplates';
import { loadWhatsappManualTemplates } from '@/lib/loadWhatsappManualTemplates';
import type { SessionTimelineItem } from '@/components/patient-detail/SessionTimeline';

export function formatSalonSessionDateForWhatsApp(isoDate: string): string {
  try {
    return format(parseISO(isoDate), "EEEE, d 'de' MMMM", { locale: ptBR });
  } catch {
    return isoDate;
  }
}

export function buildSalonSessionPhotosWhatsAppIntro(params: {
  patientName: string;
  professionalName: string;
  sessionDateLabel: string;
  procedureNames: string[];
  photoCount: number;
  template?: string | null;
}): string {
  const patient = params.patientName.trim() || 'Cliente';
  const professional = params.professionalName.trim() || 'nós';
  const data_part = params.sessionDateLabel ? ` em *${params.sessionDateLabel}*` : '';
  const procedimento_part =
    params.procedureNames.length > 0 ? ` (${params.procedureNames.join(' · ')})` : '';
  const fotos_intro = params.photoCount <= 1 ? 'Segue a foto' : 'Seguem as fotos';

  return applyWhatsappPlaceholders(
    params.template?.trim() || DEFAULT_WHATSAPP_MANUAL_MESSAGES.session_photos,
    {
      nome: patient,
      profissional: professional,
      fotos_intro,
      procedimento_part,
      data_part,
      data: params.sessionDateLabel || '',
    }
  );
}

/** @deprecated Preferir buildSalonSessionPhotosWhatsAppIntro + envio de mídia. */
export function buildSalonSessionPhotosWhatsAppMessage(params: {
  patientName: string;
  professionalName: string;
  sessionDateLabel: string;
  procedureNames: string[];
  photoUrls: string[];
}): string {
  return buildSalonSessionPhotosWhatsAppIntro({
    patientName: params.patientName,
    professionalName: params.professionalName,
    sessionDateLabel: params.sessionDateLabel,
    procedureNames: params.procedureNames,
    photoCount: params.photoUrls.length,
  });
}

async function photoUrlToFile(url: string, index: number): Promise<File | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
    return new File([blob], `atendimento-${index + 1}.${ext}`, {
      type: blob.type || 'image/jpeg',
    });
  } catch {
    return null;
  }
}

async function loadPhotoFiles(photoUrls: string[]): Promise<File[]> {
  const files: File[] = [];
  for (let i = 0; i < photoUrls.length; i += 1) {
    const file = await photoUrlToFile(photoUrls[i]!, i);
    if (file) files.push(file);
  }
  return files;
}

function canShareData(data: ShareData): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return false;
  }
  if (typeof navigator.canShare !== 'function') {
    return true;
  }
  try {
    return navigator.canShare(data);
  } catch {
    return false;
  }
}

/** Compartilha fotos como arquivos (WhatsApp, etc.) — funciona com WhatsApp desconectado no sistema. */
async function shareSalonSessionPhotosViaWebShare(params: {
  introText: string;
  photoUrls: string[];
}): Promise<boolean> {
  const files = await loadPhotoFiles(params.photoUrls);
  if (files.length === 0) return false;

  const withText: ShareData = { text: params.introText, files };
  if (canShareData(withText)) {
    await navigator.share(withText);
    return true;
  }

  const filesOnly: ShareData = { files };
  if (canShareData(filesOnly)) {
    await navigator.share(filesOnly);
    return true;
  }

  if (files.length === 1) {
    const single: ShareData = { text: params.introText, files: [files[0]!] };
    if (canShareData(single)) {
      await navigator.share(single);
      return true;
    }
  }

  return false;
}

async function downloadPhotoFilesToDevice(files: File[]): Promise<void> {
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i]!;
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    if (i < files.length - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    }
  }
}

export async function sendSalonSessionPhotosViaEvolution(params: {
  professionalId: string;
  patientId: string;
  sessionId: string;
  sessionProfessionalId?: string | null;
  sessionDateLabel: string;
  procedureNames: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const base = getChatbotApiBase();
  if (!base) {
    return { ok: false, error: 'Configure VITE_CHATBOT_API_URL para enviar pelo WhatsApp conectado.' };
  }

  const res = await fetch(`${base}/salon/session-photos/enviar/${params.professionalId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId: params.patientId,
      sessionId: params.sessionId,
      sessionProfessionalId: params.sessionProfessionalId ?? null,
      sessionDateLabel: params.sessionDateLabel,
      procedureNames: params.procedureNames,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data?.error === 'string' ? data.error : 'Falha ao enviar fotos pelo WhatsApp conectado.',
    };
  }

  return { ok: true };
}

export async function sendSalonSessionPhotosWhatsApp(params: {
  session: SessionTimelineItem;
  patientId: string;
  patientName: string;
  patientPhone: string | null | undefined;
  professionalId: string;
  professionalName: string;
  patientProfessionalId?: string | null;
}): Promise<{ mode: 'evolution' | 'share' | 'manual' | 'disabled' | 'error'; error?: string }> {
  const photoUrls = params.session.photoUrls ?? [];
  if (photoUrls.length === 0) {
    return { mode: 'error', error: 'Esta sessão não possui fotos.' };
  }

  const wa = phoneToWhatsAppDigits(params.patientPhone);
  if (!wa) {
    return { mode: 'error', error: 'Cadastre o telefone do paciente para enviar as fotos.' };
  }

  const templates = await loadWhatsappManualTemplates(params.professionalId);
  const entry = templates.session_photos;
  if (!entry.enabled) {
    return { mode: 'disabled' };
  }

  const sessionDateLabel = formatSalonSessionDateForWhatsApp(params.session.session_date);
  const procedureNames = params.session.procedureNames ?? [];
  const sessionProfessionalId =
    params.session.professionalId ?? params.patientProfessionalId ?? params.professionalId;

  const introText = buildSalonSessionPhotosWhatsAppIntro({
    patientName: params.patientName,
    professionalName: params.professionalName,
    sessionDateLabel,
    procedureNames,
    photoCount: photoUrls.length,
    template: entry.message,
  });

  const evolution = await sendSalonSessionPhotosViaEvolution({
    professionalId: params.professionalId,
    patientId: params.patientId,
    sessionId: params.session.id,
    sessionProfessionalId,
    sessionDateLabel,
    procedureNames,
  });

  if (evolution.ok) {
    return { mode: 'evolution' };
  }

  try {
    const shared = await shareSalonSessionPhotosViaWebShare({ introText, photoUrls });
    if (shared) {
      return { mode: 'share' };
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { mode: 'error', error: 'Envio cancelado.' };
    }
  }

  const files = await loadPhotoFiles(photoUrls);
  if (files.length === 0) {
    return { mode: 'error', error: 'Não foi possível carregar as fotos para envio.' };
  }

  await downloadPhotoFilesToDevice(files);
  openWhatsAppWithFallback({ phone: wa, text: introText });
  return { mode: 'manual' };
}
