import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExternalLink, FileText, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { isClinicOnlyAccount } from '@/lib/accountType';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PatientTabPanelSection } from '@/components/patient-detail/PatientDetailTabPanel';
import {
  deletePatientClinicalDocument,
  listPatientClinicalDocuments,
  PATIENT_CLINICAL_DOC_TYPE_LABELS,
  uploadPatientClinicalDocument,
  type PatientClinicalDocType,
  type PatientClinicalDocumentRow,
} from '@/services/api/patientClinicalDocumentsApi';
import { cn } from '@/lib/utils';

type PatientDocumentsSectionProps = {
  patientId: string;
  /** Quando informado, lista/anexa só docs deste plano (ex.: venda). */
  dentalPlanId?: string | null;
  /** Layout compacto para embutir no dialog de venda. */
  compact?: boolean;
  className?: string;
};

export function PatientDocumentsSection({
  patientId,
  dentalPlanId = null,
  compact = false,
  className,
}: PatientDocumentsSectionProps) {
  const { user, profile } = useAuth();
  const isClinicAccount = isClinicOnlyAccount(profile?.account_type);
  const professionalId = profile?.id ?? user?.id ?? null;
  const [docs, setDocs] = useState<PatientClinicalDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [docType, setDocType] = useState<PatientClinicalDocType>('contrato');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);

  async function loadDocs() {
    if (!patientId || !isClinicAccount) return;
    setLoading(true);
    try {
      const rows = await listPatientClinicalDocuments({
        patientId,
        dentalPlanId,
      });
      setDocs(rows);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível carregar os documentos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isClinicAccount) {
      setDocs([]);
      setLoading(false);
      return;
    }
    void loadDocs();
  }, [patientId, dentalPlanId, isClinicAccount]);

  useEffect(() => {
    setTitle((prev) => {
      const trimmed = prev.trim();
      if (!trimmed || trimmed === 'Contrato' || trimmed === 'Recibo' || trimmed === 'Outro') {
        return PATIENT_CLINICAL_DOC_TYPE_LABELS[docType];
      }
      return prev;
    });
  }, [docType]);

  if (!isClinicAccount) {
    return null;
  }

  async function handleUpload() {
    if (!professionalId || !file) {
      toast.error('Selecione um arquivo.');
      return;
    }
    const finalTitle =
      title.trim() || PATIENT_CLINICAL_DOC_TYPE_LABELS[docType];
    setUploading(true);
    try {
      await uploadPatientClinicalDocument({
        patientId,
        professionalId,
        dentalPlanId,
        docType,
        title: finalTitle,
        file,
      });
      toast.success('Documento anexado.');
      setShowForm(false);
      setFile(null);
      setTitle('');
      setDocType('contrato');
      await loadDocs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao anexar documento.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: PatientClinicalDocumentRow) {
    setDeletingId(doc.id);
    try {
      await deletePatientClinicalDocument(doc);
      toast.success('Documento removido.');
      await loadDocs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao remover documento.');
    } finally {
      setDeletingId(null);
    }
  }

  const addButton = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="shrink-0 rounded-lg"
      disabled={uploading}
      onClick={() => setShowForm((v) => !v)}
    >
      <Plus className="mr-1.5 h-4 w-4" />
      Adicionar documento
    </Button>
  );

  const form = showForm ? (
    <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select
            value={docType}
            onValueChange={(v) => setDocType(v as PatientClinicalDocType)}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contrato">Contrato</SelectItem>
              <SelectItem value="recibo">Recibo</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Título</Label>
          <Input
            className="rounded-xl"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={PATIENT_CLINICAL_DOC_TYPE_LABELS[docType]}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Arquivo (PDF ou imagem)</Label>
        <Input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="rounded-xl"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={uploading}
          onClick={() => {
            setShowForm(false);
            setFile(null);
          }}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          className="rounded-xl"
          disabled={uploading || !file}
          onClick={() => void handleUpload()}
        >
          {uploading ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-1.5 h-4 w-4" />
          )}
          Anexar
        </Button>
      </div>
    </div>
  ) : null;

  const list = loading ? (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Carregando documentos…
    </div>
  ) : docs.length === 0 ? (
    <p className="py-6 text-center text-sm text-muted-foreground">
      {dentalPlanId
        ? 'Nenhum documento anexado a esta venda.'
        : 'Nenhum contrato ou recibo anexado ainda. Anexe na venda do plano ou por aqui.'}
    </p>
  ) : (
    <ul className="divide-y divide-border/40">
      {docs.map((doc) => (
        <li
          key={doc.id}
          className="flex flex-wrap items-center gap-2 px-1 py-3 sm:px-2"
        >
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{doc.title}</p>
              <p className="text-xs text-muted-foreground">
                {PATIENT_CLINICAL_DOC_TYPE_LABELS[doc.doc_type]}
                {' · '}
                {format(new Date(doc.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button type="button" size="sm" variant="outline" className="rounded-lg" asChild>
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Abrir
              </a>
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              disabled={deletingId === doc.id}
              title="Excluir"
              onClick={() => void handleDelete(doc)}
            >
              {deletingId === doc.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );

  if (compact) {
    return (
      <section
        className={cn(
          'overflow-hidden rounded-xl border border-border/50 bg-background',
          className
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-muted/20 px-3 py-2.5 sm:px-4">
          <h3 className="text-sm font-semibold text-foreground">Documentos</h3>
          {addButton}
        </div>
        <div className="space-y-3 px-3 py-3 sm:px-4">
          {form}
          {list}
        </div>
      </section>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <PatientTabPanelSection
        title="Documentos"
        action={addButton}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Contratos e recibos da venda do plano odontológico ficam reunidos aqui.
          </p>
          {form}
          {list}
        </div>
      </PatientTabPanelSection>
    </div>
  );
}
