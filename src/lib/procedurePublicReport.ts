import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

export type ProcedurePublicReportField = Pick<
  Database['public']['Tables']['procedure_fields']['Row'],
  'id' | 'field_key' | 'label' | 'field_type' | 'options' | 'sort_order'
>;

export type ProcedurePublicReportSession = Pick<
  Database['public']['Tables']['procedure_sessions']['Row'],
  'id' | 'procedure_instance_id' | 'session_date' | 'data' | 'observacoes'
>;

export type ProcedurePublicReportPhoto = Pick<
  Database['public']['Tables']['procedure_photos']['Row'],
  'id' | 'procedure_instance_id' | 'procedure_session_id' | 'photo_type' | 'file_url' | 'created_at'
>;

export type ProcedurePublicReportPayload = {
  patient: {
    full_name: string;
    sex: Database['public']['Enums']['patient_sex'] | null;
    date_of_birth: string | null;
    treatment_start_date: string | null;
  };
  instance: { id: string; data_inicio: string | null };
  procedure: { id: string; slug: string; name: string };
  professional: { full_name: string | null; accent_color: string | null; theme_palette: string | null } | null;
  fields: ProcedurePublicReportField[];
  sessions: ProcedurePublicReportSession[];
  photos: ProcedurePublicReportPhoto[];
};

export type FieldDisplayRow = {
  key: string;
  label: string;
  value: string;
};

export type BeforeAfterPair = {
  key: string;
  label: string;
  beforeUrl: string;
  afterUrl: string;
};

export type SessionMedia = {
  beforeAfterPairs: BeforeAfterPair[];
  standaloneBefore: ProcedurePublicReportPhoto[];
  standaloneAfter: ProcedurePublicReportPhoto[];
  otherImages: ProcedurePublicReportPhoto[];
};

function normalizeKeySuffix(photoType: string): string {
  return photoType
    .replace(/^gallery[_-](before|after|antes|depois)[_-]?/, '')
    .replace(/^(antes|before|depois|after)[_-]?/, '');
}

function inferTypeFromUrl(fileUrl: string): string {
  const url = fileUrl.toLowerCase();
  if (url.includes('gallery-before-') || url.includes('gallery_before_')) return 'gallery_before';
  if (url.includes('gallery-after-') || url.includes('gallery_after_')) return 'gallery_after';
  if (url.includes('/before-') || url.includes('/before_')) return 'before';
  if (url.includes('/after-') || url.includes('/after_')) return 'after';
  if (url.includes('/antes-') || url.includes('/antes_')) return 'antes';
  if (url.includes('/depois-') || url.includes('/depois_')) return 'depois';
  return '';
}

function isBeforeType(photoType: string): boolean {
  return (
    /^(?:antes|before)(?:[_-]|$)/.test(photoType) ||
    /^gallery[_-](?:antes|before)(?:[_-]|$)/.test(photoType)
  );
}

function isAfterType(photoType: string): boolean {
  return (
    /^(?:depois|after)(?:[_-]|$)/.test(photoType) ||
    /^gallery[_-](?:depois|after)(?:[_-]|$)/.test(photoType)
  );
}

export function getFieldLabel(fields: ProcedurePublicReportField[], key: string): string {
  return fields.find((f) => f.field_key === key)?.label ?? key.replace(/_/g, ' ');
}

export function formatSessionDate(date: string | null | undefined): string {
  if (!date) return '—';
  return format(parseLocalDate(String(date).slice(0, 10)), 'dd/MM/yyyy', { locale: ptBR });
}

export function formatFieldValue(field: ProcedurePublicReportField | undefined, value: unknown): string {
  if (value == null || value === '') return '—';
  const type = field?.field_type ?? '';
  if (type === 'boolean') return value === true ? 'Sim' : value === false ? 'Não' : '—';
  if (Array.isArray(value)) return value.length ? value.map((v) => String(v)).join(', ') : '—';
  if (typeof value === 'number') {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (typeof value === 'string') {
    if (type === 'date' && /^\d{4}-\d{2}-\d{2}/.test(value)) return formatSessionDate(value);
    return value.trim() || '—';
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function buildSessionDisplayRows(args: {
  fields: ProcedurePublicReportField[];
  session: ProcedurePublicReportSession;
}): FieldDisplayRow[] {
  const { fields, session } = args;
  const data = (session.data as Record<string, unknown> | null) ?? {};
  return fields
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((field) => ({
      key: field.field_key,
      label: field.label,
      value: formatFieldValue(field, data[field.field_key]),
    }))
    .filter((row) => row.value !== '—');
}

export function buildSessionMedia(args: {
  photos: ProcedurePublicReportPhoto[];
  sessionId: string;
  fields: ProcedurePublicReportField[];
  sessionData?: Record<string, unknown> | null;
}): SessionMedia {
  const { photos, sessionId, fields, sessionData } = args;
  const perSession = photos
    .filter((p) => p.procedure_session_id === sessionId)
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const photoByUrl = new Map<string, ProcedurePublicReportPhoto>();
  perSession.forEach((photo) => {
    const url = (photo.file_url ?? '').trim();
    if (url) photoByUrl.set(url, photo);
  });

  const galleryRaw = (sessionData?.galeria_antes_depois as Record<string, unknown> | undefined) ?? undefined;
  const sessionPairsRaw = Array.isArray(galleryRaw?.pairs) ? galleryRaw.pairs : [];
  const sessionBeforeUrls = new Set(
    Array.isArray(galleryRaw?.before_images)
      ? galleryRaw.before_images
          .map((value) => String(value ?? '').trim())
          .filter((value) => value.length > 0)
      : []
  );
  const sessionAfterUrls = new Set(
    Array.isArray(galleryRaw?.after_images)
      ? galleryRaw.after_images
          .map((value) => String(value ?? '').trim())
          .filter((value) => value.length > 0)
      : []
  );

  const beforeMap = new Map<string, ProcedurePublicReportPhoto>();
  const afterMap = new Map<string, ProcedurePublicReportPhoto>();
  const other: ProcedurePublicReportPhoto[] = [];
  const beforeAfterPairs: BeforeAfterPair[] = [];
  const standaloneBefore: ProcedurePublicReportPhoto[] = [];
  const standaloneAfter: ProcedurePublicReportPhoto[] = [];
  const usedUrls = new Set<string>();
  let syntheticBeforeIdx = 0;
  let syntheticAfterIdx = 0;

  sessionPairsRaw.forEach((rawPair, index) => {
    const pair = (rawPair as Record<string, unknown> | null) ?? {};
    const beforeUrl = String(pair.before_url ?? '').trim();
    const afterUrl = String(pair.after_url ?? '').trim();
    if (!beforeUrl || !afterUrl) return;
    const caption = String(pair.caption ?? '').trim();
    beforeAfterPairs.push({
      key: `gallery_pair_${index + 1}`,
      label: caption || `Comparação ${index + 1}`,
      beforeUrl,
      afterUrl,
    });
    usedUrls.add(beforeUrl);
    usedUrls.add(afterUrl);
  });

  for (const photo of perSession) {
    const photoUrl = (photo.file_url ?? '').trim();
    if (photoUrl && sessionBeforeUrls.has(photoUrl)) {
      standaloneBefore.push(photo);
      continue;
    }
    if (photoUrl && sessionAfterUrls.has(photoUrl)) {
      standaloneAfter.push(photo);
      continue;
    }
    const rawType = (photo.photo_type ?? '').trim().toLowerCase();
    const inferredType = inferTypeFromUrl(photoUrl);
    const t = isBeforeType(rawType) || isAfterType(rawType) ? rawType : inferredType;
    if (!t) {
      other.push(photo);
      continue;
    }
    if (isBeforeType(t)) {
      const normalized = normalizeKeySuffix(t);
      const k = normalized || `before_${++syntheticBeforeIdx}`;
      if (!beforeMap.has(k)) beforeMap.set(k, photo);
      continue;
    }
    if (isAfterType(t)) {
      const normalized = normalizeKeySuffix(t);
      const k = normalized || `after_${++syntheticAfterIdx}`;
      if (!afterMap.has(k)) afterMap.set(k, photo);
      continue;
    }
    other.push(photo);
  }

  const allKeys = Array.from(new Set([...beforeMap.keys(), ...afterMap.keys()]));

  for (const key of allKeys) {
    const before = beforeMap.get(key);
    const after = afterMap.get(key);
    if (before && after) {
      if (usedUrls.has(before.file_url) || usedUrls.has(after.file_url)) continue;
      beforeAfterPairs.push({
        key,
        label: key === 'main' ? 'Comparação' : getFieldLabel(fields, key),
        beforeUrl: before.file_url,
        afterUrl: after.file_url,
      });
      usedUrls.add(before.file_url);
      usedUrls.add(after.file_url);
      continue;
    }
    if (before && !usedUrls.has(before.file_url)) {
      standaloneBefore.push(before);
      usedUrls.add(before.file_url);
    }
    if (after && !usedUrls.has(after.file_url)) {
      standaloneAfter.push(after);
      usedUrls.add(after.file_url);
    }
  }

  sessionBeforeUrls.forEach((url) => {
    if (usedUrls.has(url)) return;
    const photo = photoByUrl.get(url);
    if (!photo) return;
    standaloneBefore.push(photo);
    usedUrls.add(url);
  });
  sessionAfterUrls.forEach((url) => {
    if (usedUrls.has(url)) return;
    const photo = photoByUrl.get(url);
    if (!photo) return;
    standaloneAfter.push(photo);
    usedUrls.add(url);
  });

  if (beforeAfterPairs.length === 0 && standaloneBefore.length > 0 && standaloneAfter.length > 0) {
    const pairCount = Math.min(standaloneBefore.length, standaloneAfter.length);
    for (let i = 0; i < pairCount; i += 1) {
      const before = standaloneBefore[i];
      const after = standaloneAfter[i];
      if (!before || !after) continue;
      beforeAfterPairs.push({
        key: `fallback_${i + 1}`,
        label: `Comparação ${i + 1}`,
        beforeUrl: before.file_url,
        afterUrl: after.file_url,
      });
      usedUrls.add(before.file_url);
      usedUrls.add(after.file_url);
    }
  }

  return {
    beforeAfterPairs,
    standaloneBefore: standaloneBefore.filter((photo) => !usedUrls.has(photo.file_url)),
    standaloneAfter: standaloneAfter.filter((photo) => !usedUrls.has(photo.file_url)),
    otherImages: other.filter((photo) => !usedUrls.has(photo.file_url)),
  };
}
