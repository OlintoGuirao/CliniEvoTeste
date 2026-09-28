import { supabase } from '@/integrations/supabase/client';
import {
  formatProfessionalStampRegistry,
  formatProfessionalStampTitle,
} from '@/lib/professionalStamp';

export type PrescriptionAuthorPdfFields = {
  authorId: string;
  professionalName: string;
  professionalTitle: string | null;
  professionalRegistry: string | null;
  signatureDataUrl: string | null;
  stampDataUrl: string | null;
};

type AuthorProfileRow = {
  id: string;
  full_name: string | null;
  professional_registry_body: string | null;
  professional_registry_number: string | null;
  professional_specialty: string | null;
  default_signature_data: string | null;
  professional_stamp_data: string | null;
};

/**
 * Resolve o especialista da receita (dono do modelo / autor).
 * Usado para nome, título, conselho e assinatura no PDF.
 */
export async function resolvePrescriptionAuthorPdfFields(params: {
  authorId: string;
  fallback?: {
    professionalName?: string;
    professionalTitle?: string | null;
    professionalRegistry?: string | null;
    signatureDataUrl?: string | null;
    stampDataUrl?: string | null;
  };
}): Promise<PrescriptionAuthorPdfFields> {
  const { authorId, fallback } = params;

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, professional_registry_body, professional_registry_number, professional_specialty, default_signature_data, professional_stamp_data'
    )
    .eq('id', authorId)
    .maybeSingle();

  if (error) {
    console.error(error);
  }

  const row = data as AuthorProfileRow | null;
  if (!row) {
    return {
      authorId,
      professionalName: fallback?.professionalName?.trim() || 'Profissional',
      professionalTitle: fallback?.professionalTitle ?? null,
      professionalRegistry: fallback?.professionalRegistry ?? null,
      signatureDataUrl: fallback?.signatureDataUrl ?? null,
      stampDataUrl: fallback?.stampDataUrl ?? null,
    };
  }

  return {
    authorId: row.id,
    professionalName: row.full_name?.trim() || fallback?.professionalName?.trim() || 'Profissional',
    professionalTitle:
      formatProfessionalStampTitle(row.professional_registry_body, row.professional_specialty) ||
      fallback?.professionalTitle ||
      null,
    professionalRegistry:
      formatProfessionalStampRegistry(
        row.professional_registry_body,
        row.professional_registry_number
      ) ||
      fallback?.professionalRegistry ||
      null,
    signatureDataUrl: row.default_signature_data ?? fallback?.signatureDataUrl ?? null,
    stampDataUrl: row.professional_stamp_data ?? fallback?.stampDataUrl ?? null,
  };
}
