import { supabase } from '@/integrations/supabase/client';

export type PatientClinicalDocType = 'contrato' | 'recibo' | 'outro';

export type PatientClinicalDocumentRow = {
  id: string;
  patient_id: string;
  professional_id: string;
  dental_plan_id: string | null;
  doc_type: PatientClinicalDocType;
  title: string;
  file_url: string;
  file_path: string;
  mime_type: string | null;
  notes: string | null;
  created_at: string;
};

export const PATIENT_CLINICAL_DOC_TYPE_LABELS: Record<PatientClinicalDocType, string> = {
  contrato: 'Contrato',
  recibo: 'Recibo',
  outro: 'Outro',
};

const BUCKET = 'patient-clinical-documents';

export async function listPatientClinicalDocuments(params: {
  patientId: string;
  dentalPlanId?: string | null;
}): Promise<PatientClinicalDocumentRow[]> {
  let query = supabase
    .from('patient_clinical_documents' as never)
    .select('*')
    .eq('patient_id', params.patientId)
    .order('created_at', { ascending: false });

  if (params.dentalPlanId) {
    query = query.eq('dental_plan_id', params.dentalPlanId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as PatientClinicalDocumentRow[];
}

export async function uploadPatientClinicalDocument(params: {
  patientId: string;
  professionalId: string;
  dentalPlanId?: string | null;
  docType: PatientClinicalDocType;
  title: string;
  file: File;
  notes?: string | null;
}): Promise<PatientClinicalDocumentRow> {
  const title = params.title.trim();
  if (!title) throw new Error('Informe o título do documento.');

  const ext = params.file.name.split('.').pop()?.toLowerCase() || 'bin';
  const filePath = `${params.professionalId}/${params.patientId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, params.file, {
    cacheControl: '3600',
    upsert: false,
    contentType: params.file.type || undefined,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  const fileUrl = publicData.publicUrl;

  const { data, error } = await supabase
    .from('patient_clinical_documents' as never)
    .insert({
      patient_id: params.patientId,
      professional_id: params.professionalId,
      dental_plan_id: params.dentalPlanId ?? null,
      doc_type: params.docType,
      title,
      file_url: fileUrl,
      file_path: filePath,
      mime_type: params.file.type || null,
      notes: params.notes?.trim() || null,
    } as never)
    .select('*')
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([filePath]);
    throw new Error(error.message);
  }

  return data as PatientClinicalDocumentRow;
}

export async function deletePatientClinicalDocument(doc: {
  id: string;
  file_path: string;
}): Promise<void> {
  const { error } = await supabase
    .from('patient_clinical_documents' as never)
    .delete()
    .eq('id', doc.id);
  if (error) throw new Error(error.message);

  if (doc.file_path) {
    await supabase.storage.from(BUCKET).remove([doc.file_path]);
  }
}
