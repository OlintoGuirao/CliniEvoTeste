import { supabase } from '@/integrations/supabase/client';
import type { AnamneseData } from '@/components/anamnese/anamneseTypes';

export type PublicPatientAnamnesePayload = {
  patient_id: string;
  data: AnamneseData;
  completed: boolean;
  signed_at: string | null;
  patient: { full_name: string };
  professional: {
    full_name: string | null;
    app_name: string | null;
    accent_color: string | null;
    app_logo_url: string | null;
  } | null;
};

export function publicAnamneseBaseUrl(): string {
  return (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');
}

export function buildPublicAnamneseUrl(slug: string): string {
  return `${publicAnamneseBaseUrl()}/pa/${slug}`;
}

export async function ensurePatientAnamnesePublicSlug(patientId: string): Promise<string> {
  const { data, error } = await supabase.rpc('ensure_patient_anamnese_public_slug', {
    p_patient_id: patientId,
  });
  if (error) throw error;
  if (!data || typeof data !== 'string') {
    throw new Error('Não foi possível gerar o link da anamnese.');
  }
  return data;
}

export async function fetchPublicPatientAnamnese(slug: string): Promise<PublicPatientAnamnesePayload | null> {
  const { data, error } = await supabase.rpc('get_public_patient_anamnese', { p_slug: slug });
  if (error || data == null) return null;
  return data as unknown as PublicPatientAnamnesePayload;
}

export async function submitPublicPatientAnamnese(
  slug: string,
  formData: AnamneseData,
  signatureData: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('submit_public_patient_anamnese', {
    p_slug: slug,
    p_data: formData as Record<string, unknown>,
    p_signature_data: signatureData,
  });
  if (error) throw error;
  return data === true;
}
