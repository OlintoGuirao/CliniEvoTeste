import { supabase } from '@/integrations/supabase/client';
import { LGPD_CONSENT_TEXT } from '@/lib/lgpdConsent';

export type PublicPatientRegistrationPayload = {
  patient_id: string;
  completed: boolean;
  patient: {
    full_name: string;
    cpf: string | null;
    date_of_birth: string | null;
    sex: string | null;
    profession: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    referred_by: string | null;
    treatment_start_date: string | null;
    consultation_objective: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    general_notes: string | null;
  };
  professional: {
    full_name: string | null;
    app_name: string | null;
    accent_color: string | null;
    app_logo_url: string | null;
  } | null;
};

export type PublicPatientRegistrationFormData = {
  full_name: string;
  cpf: string;
  date_of_birth: string | null;
  sex: string;
  profession: string;
  address: string;
  city: string;
  phone: string;
  referred_by: string;
  treatment_start_date: string | null;
  consultation_objective: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  general_notes: string;
};

export function publicRegistrationBaseUrl(): string {
  return (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');
}

export function buildPublicRegistrationUrl(slug: string): string {
  return `${publicRegistrationBaseUrl()}/pc/${slug}`;
}

export async function ensurePatientRegistrationPublicSlug(patientId: string): Promise<string> {
  const { data, error } = await supabase.rpc('ensure_patient_registration_public_slug', {
    p_patient_id: patientId,
  });
  if (error) throw error;
  if (!data || typeof data !== 'string') {
    throw new Error('Não foi possível gerar o link de cadastro.');
  }
  return data;
}

export async function fetchPublicPatientRegistration(
  slug: string
): Promise<PublicPatientRegistrationPayload | null> {
  const { data, error } = await supabase.rpc('get_public_patient_registration', { p_slug: slug });
  if (error || data == null) return null;
  return data as unknown as PublicPatientRegistrationPayload;
}

export async function submitPublicPatientRegistration(
  slug: string,
  formData: PublicPatientRegistrationFormData,
  signatureData: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('submit_public_patient_registration', {
    p_slug: slug,
    p_data: formData as Record<string, unknown>,
    p_signature_data: signatureData,
    p_consent_text: LGPD_CONSENT_TEXT,
  });
  if (error) {
    if (error.message?.includes('phone_already_used')) {
      throw new Error('PHONE_ALREADY_USED');
    }
    throw error;
  }
  return data === true;
}
