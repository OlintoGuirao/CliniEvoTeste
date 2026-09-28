import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/utils';
import { buildPrescriptionPdf } from '@/lib/prescriptionPdf';
import {
  formatProfessionalStampRegistry,
  formatProfessionalStampTitle,
} from '@/lib/professionalStamp';
import { resolvePrescriptionAuthorPdfFields } from '@/lib/prescriptionAuthor';
import { formatPhoneForWhatsApp } from '@/lib/evolutionPdf';
import { openWhatsAppWithFallback, sharePdfFile } from '@/lib/reportShare';
import {
  buildPrescriptionShareLink,
  parsePrescriptionTemplateItems,
  prescriptionTemplateItemsToBody,
  type PrescriptionTemplateRow,
} from '@/lib/prescriptionTemplates';
import { PatientTabPanelSection } from './PatientDetailTabPanel';
import { useBranchBranding } from '@/hooks/use-branch-branding';
import { useClinicMaster } from '@/hooks/use-clinic-master';

type PrescriptionRow = {
  id: string;
  patient_id: string;
  professional_id: string;
  issued_at: string;
  prescription_text: string;
  pdf_url: string;
  pdf_path: string;
  prescription_title_snapshot?: string | null;
  professional_name_snapshot: string | null;
  patient_name_snapshot: string | null;
  professional_registry_snapshot: string | null;
  created_at: string;
  sent_at: string | null;
};

type PrescriptionItem = {
  medication: string;
  dosage?: string;
  usageMode: string;
};

function emptyPrescriptionItem(): PrescriptionItem {
  return { medication: '', dosage: '', usageMode: '' };
}

function clinicHeaderFromBranding(branding: ReturnType<typeof useBranchBranding>) {
  const branch = branding.branch;
  const clinicCnpj =
    branch?.pix_key_type === 'cnpj' && branch.pix_key?.trim() ? branch.pix_key.trim() : null;
  return {
    clinicName: branding.appName,
    clinicAddress: branch?.address?.trim() || null,
    clinicCnpj,
    logoUrl: branding.appLogoUrl,
  };
}

export function PatientPrescriptionsSection({
  patientId,
  patientName: initialPatientName,
  patientPhone: initialPatientPhone,
}: {
  patientId: string;
  patientName: string;
  patientPhone: string | null;
}) {
  const { user, profile } = useAuth();
  const { isClinicAccount } = useClinicMaster();
  const branding = useBranchBranding();
  const clinicHeader = isClinicAccount ? clinicHeaderFromBranding(branding) : null;
  const classicClinicName = profile?.app_name ?? 'CliniEvo';
  const classicLogoUrl = profile?.app_logo_url ?? null;
  const professionalId = profile?.id ?? user?.id ?? null;
  const professionalName = profile?.full_name?.trim() || profile?.app_name?.trim() || 'Profissional';
  const professionalRegistry = useMemo(
    () =>
      formatProfessionalStampRegistry(
        profile?.professional_registry_body,
        profile?.professional_registry_number
      ) || null,
    [profile?.professional_registry_body, profile?.professional_registry_number]
  );
  const professionalTitle = useMemo(
    () =>
      formatProfessionalStampTitle(
        profile?.professional_registry_body,
        profile?.professional_specialty
      ) || null,
    [profile?.professional_registry_body, profile?.professional_specialty]
  );

  const [patientName, setPatientName] = useState(initialPatientName || 'Paciente');
  const [patientPhone, setPatientPhone] = useState<string | null>(initialPatientPhone);
  const [patientCpf, setPatientCpf] = useState<string | null>(null);
  const [patientDateOfBirth, setPatientDateOfBirth] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);
  const [showNewPrescriptionForm, setShowNewPrescriptionForm] = useState(false);
  const [templatesPickerOpen, setTemplatesPickerOpen] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templates, setTemplates] = useState<PrescriptionTemplateRow[]>([]);
  const [sendingTemplateId, setSendingTemplateId] = useState<string | null>(null);
  const [templateIssuedAt, setTemplateIssuedAt] = useState(() => new Date().toISOString().slice(0, 10));

  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([emptyPrescriptionItem()]);
  const [issuedAt, setIssuedAt] = useState(() => new Date().toISOString().slice(0, 10));

  const hasIncompleteItems = useMemo(
    () =>
      prescriptionItems.some((item) => {
        const hasMedication = item.medication.trim().length > 0;
        const hasUsageMode = item.usageMode.trim().length > 0;
        return hasMedication !== hasUsageMode;
      }),
    [prescriptionItems]
  );

  const hasAtLeastOneItem = useMemo(
    () =>
      prescriptionItems.some(
        (item) => item.medication.trim().length > 0 && item.usageMode.trim().length > 0
      ),
    [prescriptionItems]
  );

  function resetNewPrescriptionForm() {
    setPrescriptionItems([emptyPrescriptionItem()]);
    setIssuedAt(new Date().toISOString().slice(0, 10));
    setShowNewPrescriptionForm(false);
  }

  function updatePrescriptionItem(index: number, field: keyof PrescriptionItem, value: string) {
    setPrescriptionItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function addPrescriptionItem() {
    setPrescriptionItems((prev) => [...prev, emptyPrescriptionItem()]);
  }

  function removePrescriptionItem(index: number) {
    setPrescriptionItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }

  useEffect(() => {
    setPatientName(initialPatientName || 'Paciente');
    setPatientPhone(initialPatientPhone);
  }, [initialPatientName, initialPatientPhone]);

  async function loadData() {
    if (!patientId || !professionalId) return;
    setLoading(true);
    try {
      let prescriptionsQuery = (supabase as unknown as { from: (table: string) => any })
        .from('patient_prescriptions')
        .select('*')
        .eq('patient_id', patientId)
        .not('sent_at', 'is', null)
        .order('sent_at', { ascending: false });

      // Clínica: recepção e colegas veem todas as receitas do paciente.
      // Solo/salão: cada profissional vê só as suas.
      if (!isClinicAccount) {
        prescriptionsQuery = prescriptionsQuery.eq('professional_id', professionalId);
      }

      const [{ data: patient, error: patientErr }, { data: rows, error: rowsErr }] = await Promise.all([
        supabase
          .from('patients')
          .select('full_name, phone, cpf, date_of_birth')
          .eq('id', patientId)
          .single(),
        prescriptionsQuery,
      ]);

      if (patientErr) throw patientErr;
      if (rowsErr) throw rowsErr;

      setPatientName(patient?.full_name || 'Paciente');
      setPatientPhone((patient?.phone as string | null) ?? null);
      setPatientCpf((patient?.cpf as string | null) ?? null);
      setPatientDateOfBirth((patient?.date_of_birth as string | null) ?? null);
      setPrescriptions((rows ?? []) as PrescriptionRow[]);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível carregar os receituários.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [patientId, professionalId, isClinicAccount]);

  async function loadTemplates() {
    if (!professionalId) return;
    setTemplatesLoading(true);
    try {
      let templatesQuery = (supabase as unknown as { from: (table: string) => any })
        .from('prescription_templates')
        .select('*')
        .order('updated_at', { ascending: false });

      if (!isClinicAccount) {
        templatesQuery = templatesQuery.eq('professional_id', professionalId);
      }

      const { data, error } = await templatesQuery;
      if (error) throw error;
      setTemplates((data ?? []) as PrescriptionTemplateRow[]);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível carregar as receitas salvas.');
    } finally {
      setTemplatesLoading(false);
    }
  }

  useEffect(() => {
    if (templatesPickerOpen) {
      setTemplateIssuedAt(new Date().toISOString().slice(0, 10));
      void loadTemplates();
    }
  }, [templatesPickerOpen, professionalId]);

  async function sendTemplateToCurrentPatient(template: PrescriptionTemplateRow) {
    if (!patientId || !professionalId) return;

    const items = parsePrescriptionTemplateItems(template.items);
    const body = prescriptionTemplateItemsToBody(items);
    if (!body) {
      toast.error('Este modelo não possui itens válidos.');
      return;
    }

    setSendingTemplateId(template.id);
    try {
      const author = isClinicAccount
        ? await resolvePrescriptionAuthorPdfFields({
            authorId: template.professional_id,
            fallback: {
              professionalName,
              professionalTitle,
              professionalRegistry,
              signatureDataUrl: profile?.default_signature_data ?? null,
              stampDataUrl: profile?.professional_stamp_data ?? null,
            },
          })
        : {
            authorId: professionalId,
            professionalName,
            professionalTitle,
            professionalRegistry,
            signatureDataUrl: profile?.default_signature_data ?? null,
            stampDataUrl: null as string | null,
          };

      const doc = await buildPrescriptionPdf(
        isClinicAccount
          ? {
              layout: 'clinic',
              patientName,
              patientCpf,
              patientDateOfBirth,
              clinicName: clinicHeader?.clinicName,
              clinicAddress: clinicHeader?.clinicAddress,
              clinicCnpj: clinicHeader?.clinicCnpj,
              logoUrl: clinicHeader?.logoUrl,
              professionalName: author.professionalName,
              professionalTitle: author.professionalTitle,
              professionalRegistry: author.professionalRegistry,
              issuedAt: templateIssuedAt,
              prescriptionText: body,
              items,
              signatureDataUrl: author.signatureDataUrl,
              stampDataUrl: author.stampDataUrl,
            }
          : {
              layout: 'classic',
              patientName,
              clinicName: classicClinicName,
              logoUrl: classicLogoUrl,
              professionalName: author.professionalName,
              professionalRegistry: author.professionalRegistry,
              issuedAt: templateIssuedAt,
              prescriptionText: body,
              signatureDataUrl: author.signatureDataUrl,
            }
      );

      const pdfBlob = doc.output('blob');
      // Storage exige pasta = auth.uid(); conteúdo/autor da receita continua sendo o especialista.
      const filePath = `${professionalId}/${patientId}/prescriptions/${Date.now()}_receituario.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from('patient-exams')
        .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('patient-exams').getPublicUrl(filePath);
      const pdfUrl = urlData.publicUrl;

      const { data: inserted, error: insertErr } = await (supabase as unknown as { from: (table: string) => any })
        .from('patient_prescriptions')
        .insert({
          patient_id: patientId,
          professional_id: author.authorId,
          issued_at: templateIssuedAt,
          prescription_text: body,
          pdf_url: pdfUrl,
          pdf_path: filePath,
          professional_name_snapshot: author.professionalName,
          patient_name_snapshot: patientName,
          professional_registry_snapshot: author.professionalRegistry,
          prescription_title_snapshot: template.title?.trim() || null,
        })
        .select('id, pdf_url, pdf_path')
        .single();
      if (insertErr) throw insertErr;

      const sent = await sendPrescriptionToPatient(inserted as { id: string; pdf_url: string; pdf_path: string });
      if (!sent) {
        await (supabase as unknown as { from: (table: string) => any })
          .from('patient_prescriptions')
          .delete()
          .eq('id', inserted.id);
        await supabase.storage.from('patient-exams').remove([filePath]);
        toast.error('Não foi possível enviar. Verifique o telefone do paciente.');
        return;
      }

      toast.success(`Receita "${template.title}" enviada com sucesso.`);
      setTemplatesPickerOpen(false);
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível enviar a receita pronta.');
    } finally {
      setSendingTemplateId(null);
    }
  }

  async function markPrescriptionSent(id: string) {
    const { error } = await (supabase as unknown as { from: (table: string) => any })
      .from('patient_prescriptions')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', id)
      .is('sent_at', null);
    if (error) throw error;
  }

  async function sendPrescriptionToPatient(row: {
    id: string;
    pdf_url: string;
    pdf_path: string;
  }): Promise<boolean> {
    let fileShared = false;

    try {
      const response = await fetch(row.pdf_url);
      if (response.ok) {
        const blob = await response.blob();
        fileShared = await sharePdfFile({
          blob,
          filename: `receituario_${(patientName || 'paciente').replace(/\s+/g, '_')}.pdf`,
          title: 'Receituário',
          text: `Receituário da ${profile?.app_name?.trim() || 'CliniEvo'}`,
        });
      }
    } catch {
      fileShared = false;
    }

    if (fileShared) {
      await markPrescriptionSent(row.id);
      return true;
    }

    const phone = formatPhoneForWhatsApp(patientPhone);
    if (!phone) return false;

    const clinicName =
      (isClinicAccount ? clinicHeader?.clinicName : classicClinicName)?.trim() || 'CliniEvo';
    const shareLink = row.pdf_path ? buildPrescriptionShareLink(row.pdf_path) : row.pdf_url;
    const message = `Olá ${patientName}, segue seu receituário da ${clinicName}: ${shareLink}`;
    openWhatsAppWithFallback({ phone, text: message });
    await markPrescriptionSent(row.id);
    return true;
  }

  async function handleCreatePrescription() {
    if (!patientId || !professionalId) return;
    if (hasIncompleteItems) {
      toast.error('Preencha medicamento e modo de tomar em todos os campos.');
      return;
    }

    const items = prescriptionItems
      .map((item) => {
        const medication = item.medication.trim();
        const usageMode = item.usageMode.trim();
        if (!medication || !usageMode) return null;
        if (isClinicAccount) {
          return {
            medication,
            dosage: item.dosage?.trim() || '',
            usageMode,
          };
        }
        return { medication, usageMode };
      })
      .filter((item): item is NonNullable<typeof item> => !!item);

    const body = prescriptionTemplateItemsToBody(items);

    if (!body) {
      toast.error('Adicione pelo menos um medicamento com modo de tomar.');
      return;
    }

    setSaving(true);
    try {
      const doc = await buildPrescriptionPdf(
        isClinicAccount
          ? {
              layout: 'clinic',
              patientName,
              patientCpf,
              patientDateOfBirth,
              clinicName: clinicHeader?.clinicName,
              clinicAddress: clinicHeader?.clinicAddress,
              clinicCnpj: clinicHeader?.clinicCnpj,
              logoUrl: clinicHeader?.logoUrl,
              professionalName,
              professionalTitle,
              professionalRegistry,
              issuedAt,
              prescriptionText: body,
              items,
              signatureDataUrl: profile?.default_signature_data ?? null,
              stampDataUrl: profile?.professional_stamp_data ?? null,
            }
          : {
              layout: 'classic',
              patientName,
              clinicName: classicClinicName,
              logoUrl: classicLogoUrl,
              professionalName,
              professionalRegistry,
              issuedAt,
              prescriptionText: body,
              signatureDataUrl: profile?.default_signature_data ?? null,
            }
      );

      const pdfBlob = doc.output('blob');
      const filePath = `${professionalId}/${patientId}/prescriptions/${Date.now()}_receituario.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from('patient-exams')
        .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('patient-exams').getPublicUrl(filePath);
      const pdfUrl = urlData.publicUrl;

      const { data: inserted, error: insertErr } = await (supabase as unknown as { from: (table: string) => any })
        .from('patient_prescriptions')
        .insert({
          patient_id: patientId,
          professional_id: professionalId,
          issued_at: issuedAt,
          prescription_text: body,
          pdf_url: pdfUrl,
          pdf_path: filePath,
          professional_name_snapshot: professionalName,
          patient_name_snapshot: patientName,
          professional_registry_snapshot: professionalRegistry,
        })
        .select('id, pdf_url, pdf_path')
        .single();
      if (insertErr) throw insertErr;

      const sent = await sendPrescriptionToPatient(inserted as { id: string; pdf_url: string; pdf_path: string });
      if (!sent) {
        await (supabase as unknown as { from: (table: string) => any })
          .from('patient_prescriptions')
          .delete()
          .eq('id', inserted.id);
        await supabase.storage.from('patient-exams').remove([filePath]);
        toast.error('Não foi possível enviar. Verifique o telefone do paciente.');
        return;
      }

      toast.success('Receituário enviado com sucesso.');
      resetNewPrescriptionForm();
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao criar receituário.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSendWhatsApp(row: PrescriptionRow) {
    try {
      const sent = await sendPrescriptionToPatient(row);
      if (!sent) {
        toast.error('Telefone do paciente inválido para WhatsApp.');
        return;
      }
      toast.success(row.sent_at ? 'PDF pronto para compartilhar.' : 'Receituário enviado com sucesso.');
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível enviar o receituário.');
    }
  }

  async function handleDelete(row: PrescriptionRow) {
    const confirmed = window.confirm('Deseja excluir este receituário?');
    if (!confirmed) return;
    setDeletingId(row.id);
    try {
      const { error: dbErr } = await (supabase as unknown as { from: (table: string) => any })
        .from('patient_prescriptions')
        .delete()
        .eq('id', row.id);
      if (dbErr) throw dbErr;

      if (row.pdf_path) {
        const { error: storageErr } = await supabase.storage.from('patient-exams').remove([row.pdf_path]);
        if (storageErr) {
          console.warn(storageErr);
          toast.warning('Receituário removido do banco, mas falhou no storage.');
        }
      }

      toast.success('Receituário excluído.');
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível excluir o receituário.');
    } finally {
      setDeletingId(null);
    }
  }

  const body = (
    <div className="space-y-4">
      {!showNewPrescriptionForm ? (
        <div className="flex flex-wrap gap-2 justify-start">
          <Button type="button" onClick={() => setShowNewPrescriptionForm(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Adicionar receita para este paciente
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => setTemplatesPickerOpen(true)}
          >
            <Send className="w-4 h-4" />
            Enviar receita pronta
          </Button>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Novo receituário</CardTitle>
            <CardDescription>
              O PDF será gerado com assinatura padrão, nome do especialista e COREN/COREM cadastrado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Especialista</Label>
                <Input value={professionalName} readOnly className="bg-muted" />
              </div>
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Prescrição / medicamentos</Label>
              {prescriptionItems.map((item, index) => (
                <div key={index} className="rounded-xl border border-border p-3 space-y-3 bg-muted/20">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">Item {index + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-destructive hover:text-destructive"
                      onClick={() => removePrescriptionItem(index)}
                      disabled={prescriptionItems.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {isClinicAccount ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
                        <div className="space-y-1.5">
                          <Label>Medicamento</Label>
                          <Input
                            placeholder="Ex.: Clavulin"
                            value={item.medication}
                            onChange={(e) => updatePrescriptionItem(index, 'medication', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Dose</Label>
                          <Input
                            placeholder="Ex.: 875mg"
                            value={item.dosage ?? ''}
                            onChange={(e) => updatePrescriptionItem(index, 'dosage', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Modo de tomar</Label>
                        <Input
                          placeholder="Ex.: Tomar 1cp de 12 em 12hrs por 7 dias."
                          value={item.usageMode}
                          onChange={(e) => updatePrescriptionItem(index, 'usageMode', e.target.value)}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Medicamento</Label>
                        <Input
                          placeholder="Ex.: Dipirona 500mg"
                          value={item.medication}
                          onChange={(e) => updatePrescriptionItem(index, 'medication', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Modo de tomar</Label>
                        <Input
                          placeholder="Ex.: 1 comprimido a cada 8 horas por 5 dias."
                          value={item.usageMode}
                          onChange={(e) => updatePrescriptionItem(index, 'usageMode', e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <Button type="button" variant="outline" className="gap-2" onClick={addPrescriptionItem}>
                <Plus className="w-4 h-4" />
                Adicionar medicamento
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleCreatePrescription()} disabled={saving || !hasAtLeastOneItem}>
                {saving ? 'Enviando...' : 'Gerar e enviar'}
              </Button>
              <Button type="button" variant="outline" onClick={resetNewPrescriptionForm} disabled={saving}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receituários enviados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando receituários...</p>
          ) : prescriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum receituário enviado ainda.</p>
          ) : (
            <div className="space-y-3">
              {prescriptions.map((row) => (
                <div key={row.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">
                        {row.prescription_title_snapshot?.trim() ||
                          `Receituário de ${format(parseLocalDate(row.issued_at), 'dd/MM/yyyy', { locale: ptBR })}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Enviado em{' '}
                        {format(new Date(row.sent_at || row.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        {isClinicAccount && row.professional_name_snapshot
                          ? ` · ${row.professional_name_snapshot}`
                          : ''}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                      <Button asChild variant="outline" size="sm" className="w-full sm:w-auto justify-center">
                        <a href={row.pdf_url} target="_blank" rel="noreferrer">
                          Abrir PDF
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5 w-full sm:w-auto justify-center"
                        onClick={() => void handleSendWhatsApp(row)}
                      >
                        <Send className="w-4 h-4" />
                        Enviar WhatsApp
                      </Button>
                      {row.professional_id === professionalId ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1.5 w-full sm:w-auto justify-center"
                          onClick={() => void handleDelete(row)}
                          disabled={deletingId === row.id}
                        >
                          <Trash2 className="w-4 h-4" />
                          {deletingId === row.id ? 'Excluindo...' : 'Excluir'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                    {row.prescription_text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={templatesPickerOpen} onOpenChange={setTemplatesPickerOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar receita pronta</DialogTitle>
            <DialogDescription>
              Escolha um modelo salvo para enviar a {patientName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label>Data do receituário</Label>
            <Input
              type="date"
              value={templateIssuedAt}
              onChange={(e) => setTemplateIssuedAt(e.target.value)}
            />
          </div>

          {templatesLoading ? (
            <p className="text-sm text-muted-foreground">Carregando receitas salvas...</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma receita salva ainda. Crie modelos em Receitas no menu principal.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((template) => (
                <Card key={template.id} className="rounded-2xl shadow-sm border-border/80">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base line-clamp-2">{template.title}</CardTitle>
                    <CardDescription className="text-xs">
                      Atualizado em {format(new Date(template.updated_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => void sendTemplateToCurrentPatient(template)}
                      disabled={sendingTemplateId === template.id}
                    >
                      <Send className="w-4 h-4" />
                      {sendingTemplateId === template.id ? 'Enviando...' : 'Enviar'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <PatientTabPanelSection title="Receituário" contentClassName="p-4 sm:p-5 space-y-4">
      {body}
    </PatientTabPanelSection>
  );
}
