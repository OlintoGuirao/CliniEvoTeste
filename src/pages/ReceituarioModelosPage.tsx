import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { PatientRow } from '@/api/patients';
import { useQuery } from '@tanstack/react-query';
import { buildPrescriptionPdf } from '@/lib/prescriptionPdf';
import {
  formatProfessionalStampRegistry,
  formatProfessionalStampTitle,
} from '@/lib/professionalStamp';
import { resolvePrescriptionAuthorPdfFields } from '@/lib/prescriptionAuthor';
import { formatPhoneForWhatsApp } from '@/lib/evolutionPdf';
import { openWhatsAppWithFallback, sharePdfFile } from '@/lib/reportShare';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, MoreVertical, Pencil, Plus, Printer, Save, Send, Trash2, Eye } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  parsePrescriptionTemplateItems,
  prescriptionTemplateItemsToBody,
  buildPrescriptionShareLink,
  type PrescriptionTemplateItem,
  type PrescriptionTemplateRow,
} from '@/lib/prescriptionTemplates';
import { useBranchBranding } from '@/hooks/use-branch-branding';
import { useClinicMaster } from '@/hooks/use-clinic-master';

const MODULE_KEY = 'receituario';

function emptyItem(): PrescriptionTemplateItem {
  return { medication: '', dosage: '', usageMode: '' };
}

function parseItems(raw: unknown): PrescriptionTemplateItem[] {
  return parsePrescriptionTemplateItems(raw);
}

function toBody(items: PrescriptionTemplateItem[]): string {
  return prescriptionTemplateItemsToBody(items);
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

type PrescriptionPatientOption = PatientRow & { cpf?: string | null };

export default function ReceituarioModelosPage() {
  const { profile, user } = useAuth();
  const { isClinicAccount } = useClinicMaster();
  const branding = useBranchBranding();
  const clinicHeader = isClinicAccount ? clinicHeaderFromBranding(branding) : null;
  const classicClinicName = profile?.app_name ?? 'CliniEvo';
  const classicLogoUrl = profile?.app_logo_url ?? null;
  const professionalId = profile?.id ?? user?.id ?? '';
  const professionalName = profile?.full_name?.trim() || profile?.app_name?.trim() || 'Profissional';
  const disabled = (profile as { disabled_modules?: string[] | null } | null)?.disabled_modules;
  const isBlocked = Array.isArray(disabled) && disabled.includes(MODULE_KEY);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<PrescriptionTemplateRow[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateItems, setTemplateItems] = useState<PrescriptionTemplateItem[]>([emptyItem()]);

  const [sendOpen, setSendOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PrescriptionTemplateRow | null>(null);
  const [sendPatientId, setSendPatientId] = useState('');
  const [issuedAt, setIssuedAt] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: patients = [] } = useQuery({
    queryKey: ['patients-for-prescription-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, full_name, phone, cpf, date_of_birth, sex, profile_photo_url, treatment_start_date, is_active, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PrescriptionPatientOption[];
    },
    enabled: !!(profile?.id ?? user?.id),
  });

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

  const hasIncompleteItems = useMemo(
    () =>
      templateItems.some((item) => {
        const hasMedication = item.medication.trim().length > 0;
        const hasUsageMode = item.usageMode.trim().length > 0;
        return hasMedication !== hasUsageMode;
      }),
    [templateItems]
  );

  const hasAtLeastOneItem = useMemo(
    () => templateItems.some((item) => item.medication.trim() && item.usageMode.trim()),
    [templateItems]
  );

  async function loadTemplates() {
    if (!professionalId) return;
    setLoading(true);
    try {
      let query = (supabase as unknown as { from: (table: string) => any })
        .from('prescription_templates')
        .select('*')
        .order('updated_at', { ascending: false });

      // Clínica: recepção vê modelos dos profissionais da org.
      if (!isClinicAccount) {
        query = query.eq('professional_id', professionalId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTemplates((data ?? []) as PrescriptionTemplateRow[]);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível carregar os modelos de receituário.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTemplates();
  }, [professionalId, isClinicAccount]);

  function updateItem(index: number, field: keyof PrescriptionTemplateItem, value: string) {
    setTemplateItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function addItem() {
    setTemplateItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(index: number) {
    setTemplateItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }

  function startNewTemplate() {
    setEditingId(null);
    setTemplateTitle('');
    setTemplateItems([emptyItem()]);
    setEditorOpen(true);
  }

  function startEditTemplate(row: PrescriptionTemplateRow) {
    setEditingId(row.id);
    setTemplateTitle(row.title ?? '');
    const parsed = parseItems(row.items);
    setTemplateItems(parsed.length > 0 ? parsed : [emptyItem()]);
    setEditorOpen(true);
  }

  async function saveTemplate() {
    if (!professionalId) return;
    if (!templateTitle.trim()) {
      toast.error('Informe o nome do modelo.');
      return;
    }
    if (hasIncompleteItems) {
      toast.error('Preencha medicamento e modo de tomar em todos os itens.');
      return;
    }
    const cleanItems = templateItems
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
    if (cleanItems.length === 0) {
      toast.error('Adicione ao menos um medicamento completo.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await (supabase as unknown as { from: (table: string) => any })
          .from('prescription_templates')
          .update({
            title: templateTitle.trim(),
            items: cleanItems,
          })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Modelo atualizado.');
      } else {
        const { error } = await (supabase as unknown as { from: (table: string) => any })
          .from('prescription_templates')
          .insert({
            professional_id: professionalId,
            title: templateTitle.trim(),
            items: cleanItems,
          });
        if (error) throw error;
        toast.success('Modelo criado.');
      }
      await loadTemplates();
      startNewTemplate();
      setEditorOpen(false);
      setEditingId(null);
      setTemplateTitle('');
      setTemplateItems([emptyItem()]);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar modelo.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(row: PrescriptionTemplateRow) {
    const confirmed = window.confirm(`Excluir o modelo "${row.title}"?`);
    if (!confirmed) return;
    try {
      const { error } = await (supabase as unknown as { from: (table: string) => any })
        .from('prescription_templates')
        .delete()
        .eq('id', row.id);
      if (error) throw error;
      toast.success('Modelo excluído.');
      if (editingId === row.id) startNewTemplate();
      await loadTemplates();
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível excluir o modelo.');
    }
  }

  function openSendDialog(row: PrescriptionTemplateRow) {
    setSelectedTemplate(row);
    setSendPatientId('');
    setIssuedAt(new Date().toISOString().slice(0, 10));
    setSendOpen(true);
  }

  async function buildTemplatePreviewPdf(row: PrescriptionTemplateRow) {
    const items = parseItems(row.items);
    const body = toBody(items);
    if (!body) {
      throw new Error('Este modelo não possui itens válidos.');
    }

    if (!isClinicAccount) {
      return buildPrescriptionPdf({
        layout: 'classic',
        patientName: 'Paciente',
        clinicName: classicClinicName,
        logoUrl: classicLogoUrl,
        professionalName,
        professionalRegistry,
        issuedAt: new Date().toISOString().slice(0, 10),
        prescriptionText: body,
        signatureDataUrl: profile?.default_signature_data ?? null,
      });
    }

    const author = await resolvePrescriptionAuthorPdfFields({
      authorId: row.professional_id,
      fallback: {
        professionalName,
        professionalTitle,
        professionalRegistry,
        signatureDataUrl: profile?.default_signature_data ?? null,
        stampDataUrl: profile?.professional_stamp_data ?? null,
      },
    });
    return buildPrescriptionPdf({
      layout: 'clinic',
      patientName: 'Paciente',
      patientCpf: null,
      patientDateOfBirth: null,
      clinicName: clinicHeader?.clinicName,
      clinicAddress: clinicHeader?.clinicAddress,
      clinicCnpj: clinicHeader?.clinicCnpj,
      logoUrl: clinicHeader?.logoUrl,
      professionalName: author.professionalName,
      professionalTitle: author.professionalTitle,
      professionalRegistry: author.professionalRegistry,
      issuedAt: new Date().toISOString().slice(0, 10),
      prescriptionText: body,
      items,
      signatureDataUrl: author.signatureDataUrl,
      stampDataUrl: author.stampDataUrl,
    });
  }

  async function viewTemplate(row: PrescriptionTemplateRow) {
    try {
      const doc = await buildTemplatePreviewPdf(row);
      const url = doc.output('bloburl');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível visualizar a receita.');
    }
  }

  async function printTemplate(row: PrescriptionTemplateRow) {
    try {
      const doc = await buildTemplatePreviewPdf(row);
      doc.autoPrint();
      const url = doc.output('bloburl');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível imprimir a receita.');
    }
  }

  async function sendTemplateToPatient() {
    if (!professionalId || !selectedTemplate) return;
    if (!sendPatientId) {
      toast.error('Selecione o paciente.');
      return;
    }

    const patient = patients.find((p) => p.id === sendPatientId);
    if (!patient) {
      toast.error('Paciente inválido.');
      return;
    }

    const items = parseItems(selectedTemplate.items);
    const body = toBody(items);
    if (!body) {
      toast.error('Este modelo não possui itens válidos.');
      return;
    }

    setSending(true);
    try {
      const author = isClinicAccount
        ? await resolvePrescriptionAuthorPdfFields({
            authorId: selectedTemplate.professional_id,
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
              patientName: patient.full_name || 'Paciente',
              patientCpf: patient.cpf ?? null,
              patientDateOfBirth: patient.date_of_birth ?? null,
              clinicName: clinicHeader?.clinicName,
              clinicAddress: clinicHeader?.clinicAddress,
              clinicCnpj: clinicHeader?.clinicCnpj,
              logoUrl: clinicHeader?.logoUrl,
              professionalName: author.professionalName,
              professionalTitle: author.professionalTitle,
              professionalRegistry: author.professionalRegistry,
              issuedAt,
              prescriptionText: body,
              items,
              signatureDataUrl: author.signatureDataUrl,
              stampDataUrl: author.stampDataUrl,
            }
          : {
              layout: 'classic',
              patientName: patient.full_name || 'Paciente',
              clinicName: classicClinicName,
              logoUrl: classicLogoUrl,
              professionalName: author.professionalName,
              professionalRegistry: author.professionalRegistry,
              issuedAt,
              prescriptionText: body,
              signatureDataUrl: author.signatureDataUrl,
            }
      );

      const pdfBlob = doc.output('blob');
      // Storage exige pasta = auth.uid(); em clínica o autor da receita continua sendo o especialista.
      const filePath = `${professionalId}/${sendPatientId}/prescriptions/${Date.now()}_receituario.pdf`;

      const { error: uploadErr } = await supabase.storage
        .from('patient-exams')
        .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('patient-exams').getPublicUrl(filePath);
      const pdfUrl = urlData.publicUrl;

      const { error: insertErr } = await (supabase as unknown as { from: (table: string) => any })
        .from('patient_prescriptions')
        .insert({
          patient_id: sendPatientId,
          professional_id: author.authorId,
          issued_at: issuedAt,
          prescription_text: body,
          pdf_url: pdfUrl,
          pdf_path: filePath,
          professional_name_snapshot: author.professionalName,
          patient_name_snapshot: patient.full_name,
          professional_registry_snapshot: author.professionalRegistry,
          prescription_title_snapshot: selectedTemplate.title?.trim() || null,
          sent_at: new Date().toISOString(),
        });
      if (insertErr) throw insertErr;

      const clinicName =
        (isClinicAccount ? clinicHeader?.clinicName : classicClinicName)?.trim() || 'CliniEvo';
      const fileShared = await sharePdfFile({
        blob: pdfBlob,
        filename: `receituario_${(patient.full_name || 'paciente').replace(/\s+/g, '_')}.pdf`,
        title: 'Receituário',
        text: `Receituário da ${clinicName}`,
      });

      const phone = formatPhoneForWhatsApp(patient.phone);
      if (!fileShared && phone) {
        const shareLink = buildPrescriptionShareLink(filePath);
        const message = `Olá ${patient.full_name || 'Paciente'}, segue seu receituário da ${clinicName}: ${shareLink}`;
        openWhatsAppWithFallback({ phone, text: message });
      }

      toast.success(
        fileShared
          ? 'PDF pronto para compartilhar e salvo na ficha do paciente.'
          : 'Receituário enviado e salvo na ficha do paciente.'
      );
      setSendOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível enviar o receituário.');
    } finally {
      setSending(false);
    }
  }

  if (isBlocked) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Receitas</h1>
            <p className="text-sm text-muted-foreground">Crie receitas prontas e envie para pacientes cadastrados.</p>
          </div>
        </div>
        <Button type="button" className="rounded-xl" onClick={startNewTemplate}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Receita
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receitas salvas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando modelos...</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum modelo salvo ainda.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((row) => (
                <Card key={row.id} className="rounded-2xl shadow-sm border-border/80">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base line-clamp-2">{row.title}</CardTitle>
                    <CardDescription className="text-xs">
                      Atualizado em {new Date(row.updated_at).toLocaleDateString('pt-BR')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 rounded-xl"
                          aria-label="Ações da receita"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {row.professional_id === professionalId ? (
                          <DropdownMenuItem onClick={() => startEditTemplate(row)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem onClick={() => openSendDialog(row)}>
                          <Send className="h-4 w-4 mr-2" />
                          Enviar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void viewTemplate(row)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Visualizar receita
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void printTemplate(row)}>
                          <Printer className="h-4 w-4 mr-2" />
                          Imprimir
                        </DropdownMenuItem>
                        {row.professional_id === professionalId ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => void deleteTemplate(row)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar modelo' : 'Novo modelo'}</DialogTitle>
            <DialogDescription>
              {isClinicAccount
                ? 'Monte a receita com medicamento, dose e modo de tomar.'
                : 'Monte a receita padrão com medicamento e modo de tomar.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome do modelo</Label>
              <Input
                placeholder="Ex.: Pós-procedimento padrão"
                value={templateTitle}
                onChange={(e) => setTemplateTitle(e.target.value)}
              />
            </div>

            {templateItems.map((item, index) => (
              <div key={index} className="rounded-xl border border-border p-3 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">Item {index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-destructive hover:text-destructive"
                    onClick={() => removeItem(index)}
                    disabled={templateItems.length === 1}
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
                          onChange={(e) => updateItem(index, 'medication', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Dose</Label>
                        <Input
                          placeholder="Ex.: 875mg"
                          value={item.dosage ?? ''}
                          onChange={(e) => updateItem(index, 'dosage', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Modo de tomar</Label>
                      <Input
                        placeholder="Ex.: Tomar 1cp de 12 em 12hrs por 7 dias."
                        value={item.usageMode}
                        onChange={(e) => updateItem(index, 'usageMode', e.target.value)}
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
                        onChange={(e) => updateItem(index, 'medication', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Modo de tomar</Label>
                      <Input
                        placeholder="Ex.: 1 comprimido a cada 8 horas por 5 dias."
                        value={item.usageMode}
                        onChange={(e) => updateItem(index, 'usageMode', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <Button type="button" variant="outline" className="gap-2" onClick={addItem}>
              <Plus className="w-4 h-4" />
              Adicionar medicamento
            </Button>
            <Button type="button" onClick={() => void saveTemplate()} disabled={saving || !hasAtLeastOneItem}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Salvando...' : editingId ? 'Atualizar modelo' : 'Salvar modelo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar receituário</DialogTitle>
            <DialogDescription>
              Escolha o paciente cadastrado para enviar o modelo "{selectedTemplate?.title ?? ''}".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Paciente</Label>
              <Select value={sendPatientId || undefined} onValueChange={setSendPatientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o paciente" />
                </SelectTrigger>
                <SelectContent className="z-[1400]">
                  {patients.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      Nenhum paciente cadastrado.
                    </SelectItem>
                  ) : (
                    patients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name || 'Paciente sem nome'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void sendTemplateToPatient()} disabled={sending || !sendPatientId}>
              {sending ? 'Enviando...' : 'Enviar ao paciente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
