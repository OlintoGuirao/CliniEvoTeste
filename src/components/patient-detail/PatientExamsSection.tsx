import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Upload, Sparkles, FileText, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/utils';
import { getChatbotApiBase } from '@/lib/programaBotoxBilling';
import { PatientTabPanelSection } from './PatientDetailTabPanel';

type PatientExam = {
  id: string;
  exam_name: string;
  exam_date: string | null;
  file_url: string;
  file_path: string;
  mime_type: string | null;
  extracted_text: string | null;
  ai_summary: string | null;
  notes: string | null;
  created_at: string;
};

function renderAiSummary(summary: string) {
  const renderInlineBold = (text: string, keyPrefix: string): ReactNode[] => {
    const parts = String(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return parts.map((part, idx) => {
      const m = part.match(/^\*\*([^*]+)\*\*$/);
      if (m) return <strong key={`${keyPrefix}-b-${idx}`}>{m[1]}</strong>;
      return <span key={`${keyPrefix}-t-${idx}`}>{part}</span>;
    });
  };

  const lines = String(summary || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const content: ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (!listBuffer.length) return;
    content.push(
      <ol key={`list-${content.length}`} className="list-decimal pl-5 space-y-1">
        {listBuffer.map((item, idx) => (
          <li key={idx} className="text-sm leading-relaxed">
            {renderInlineBold(item, `li-${content.length}-${idx}`)}
          </li>
        ))}
      </ol>
    );
    listBuffer = [];
  };

  for (const rawLine of lines) {
    const headingMatch = rawLine.match(/^\*\*(.+)\*\*$/);
    const numberedMatch = rawLine.match(/^\d+\.\s+(.+)$/);
    const boldInline = rawLine.match(/^\*\*(.+?)\*\*:\s*(.+)$/);

    if (headingMatch) {
      flushList();
      content.push(
        <h4 key={`h-${content.length}`} className="text-sm font-semibold text-foreground mt-2 first:mt-0">
          {headingMatch[1]}
        </h4>
      );
      continue;
    }

    if (numberedMatch) {
      listBuffer.push(numberedMatch[1]);
      continue;
    }

    flushList();

    if (boldInline) {
      content.push(
        <p key={`p-${content.length}`} className="text-sm leading-relaxed">
          <strong>{boldInline[1]}:</strong> {renderInlineBold(boldInline[2], `pb-${content.length}`)}
        </p>
      );
      continue;
    }

    content.push(
      <p key={`p-${content.length}`} className="text-sm leading-relaxed">
        {renderInlineBold(rawLine, `p-${content.length}`)}
      </p>
    );
  }

  flushList();
  return <div className="space-y-2 text-foreground">{content}</div>;
}

export function PatientExamsSection({ patientId }: { patientId: string }) {
  const { user, profile } = useAuth();
  const professionalId = profile?.id ?? user?.id ?? null;
  const [exams, setExams] = useState<PatientExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAttachForm, setShowAttachForm] = useState(false);
  const [visibleResults, setVisibleResults] = useState<Record<string, boolean>>({});

  const [examName, setExamName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const API_BASE = getChatbotApiBase();
  const ensureApiBase = () => {
    if (API_BASE) return true;
    toast.error('Configure VITE_CHATBOT_API_URL no Vercel para habilitar OCR e análise por IA.');
    return false;
  };

  const canUpload = useMemo(
    () => Boolean(patientId && professionalId && examName.trim() && selectedFile),
    [patientId, professionalId, examName, selectedFile]
  );

  async function loadData() {
    if (!patientId || !professionalId) return;
    setLoading(true);
    try {
      const { data: eData, error: eErr } = await supabase
        .from('patient_exams')
        .select('*')
        .eq('patient_id', patientId)
        .eq('professional_id', professionalId)
        .order('exam_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (eErr) throw eErr;
      setExams((eData || []) as PatientExam[]);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível carregar os exames.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [patientId, professionalId]);

  async function handleUploadExam() {
    if (!canUpload || !patientId || !professionalId || !selectedFile) return;
    setUploading(true);
    try {
      const safeName = selectedFile.name.replace(/\s+/g, '_').replace(/[^\w.\-]/g, '');
      const path = `${professionalId}/${patientId}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('patient-exams')
        .upload(path, selectedFile, { upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('patient-exams').getPublicUrl(path);
      const fileUrl = data.publicUrl;

      const { error: insertError } = await supabase.from('patient_exams').insert({
        patient_id: patientId,
        professional_id: professionalId,
        exam_name: examName.trim(),
        exam_date: examDate || null,
        file_url: fileUrl,
        file_path: path,
        mime_type: selectedFile.type || null,
        notes: notes.trim() || null,
        extracted_text: null,
      });
      if (insertError) throw insertError;

      setExamName('');
      setExamDate('');
      setNotes('');
      setSelectedFile(null);
      setShowAttachForm(false);
      toast.success('Exame anexado com sucesso.');
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error('Falha ao anexar exame.');
    } finally {
      setUploading(false);
    }
  }

  async function handleAnalyze(exam: PatientExam) {
    if (!ensureApiBase()) return;
    let textForAnalysis = (exam.extracted_text || exam.notes || '').trim();

    setAnalyzingId(exam.id);
    try {
      if (!textForAnalysis) {
        const extractRes = await fetch(`${API_BASE}/ai/extract-exam-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileUrl: exam.file_url,
            mimeType: exam.mime_type,
          }),
        });
        const extractPayload = await extractRes.json();
        if (!extractRes.ok) throw new Error(extractPayload?.error || 'Falha ao extrair texto.');

        textForAnalysis = String(extractPayload?.text || '').trim();
        const warning = String(extractPayload?.warning || '').trim();

        if (textForAnalysis) {
          const { error: updateExtractError } = await supabase
            .from('patient_exams')
            .update({ extracted_text: textForAnalysis })
            .eq('id', exam.id);
          if (updateExtractError) throw updateExtractError;
        } else if (warning) {
          toast.warning(warning);
        }
      }

      if (!textForAnalysis) {
        toast.error('Não foi possível extrair texto automático deste arquivo.');
        return;
      }

      const res = await fetch(`${API_BASE}/ai/analyze-exam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examText: textForAnalysis,
          examName: exam.exam_name,
          patientId,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Falha na análise.');

      const summary = String(payload?.summary || '').trim();
      const { error } = await supabase
        .from('patient_exams')
        .update({ ai_summary: summary || null })
        .eq('id', exam.id);
      if (error) throw error;

      toast.success('Análise gerada com sucesso.');
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível analisar o exame.');
    } finally {
      setAnalyzingId(null);
    }
  }

  async function handleDeleteExam(exam: PatientExam) {
    const confirmed = window.confirm(`Excluir o exame "${exam.exam_name}"? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;
    setDeletingId(exam.id);
    try {
      // Remove metadado no banco
      const { error: dbError } = await supabase
        .from('patient_exams')
        .delete()
        .eq('id', exam.id);
      if (dbError) throw dbError;

      // Remove arquivo físico no storage (melhor esforço)
      if (exam.file_path) {
        const { error: storageError } = await supabase.storage.from('patient-exams').remove([exam.file_path]);
        if (storageError) {
          console.warn('Falha ao remover arquivo do storage:', storageError.message);
          toast.warning('Exame excluído do banco, mas houve falha ao remover o arquivo do storage.');
        }
      }

      toast.success('Exame excluído com sucesso.');
      setVisibleResults((prev) => {
        const next = { ...prev };
        delete next[exam.id];
        return next;
      });
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível excluir o exame.');
    } finally {
      setDeletingId(null);
    }
  }

  const body = (
    <div className="space-y-4">
      {!showAttachForm ? (
        <div className="flex justify-start">
          <Button type="button" onClick={() => setShowAttachForm(true)} className="gap-2">
            <Upload className="w-4 h-4" />
            Anexar Exame
          </Button>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anexar exame</CardTitle>
            <CardDescription>Envie arquivo do exame e, se quiser, adicione texto para análise por IA.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome do exame</Label>
                <Input value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="Ex: Hemograma completo" />
              </div>
              <div className="space-y-1.5">
                <Label>Data do exame</Label>
                <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Arquivo</Label>
              <Input
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Observações (opcional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleUploadExam} disabled={!canUpload || uploading} className="gap-2">
                <Upload className="w-4 h-4" />
                {uploading ? 'Enviando...' : 'Anexar exame'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAttachForm(false);
                  setExamName('');
                  setExamDate('');
                  setNotes('');
                  setSelectedFile(null);
                }}
                disabled={uploading}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exames anexados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando exames...</p>
          ) : exams.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum exame anexado ainda.</p>
          ) : (
            <div className="space-y-3">
              {exams.map((exam) => (
                <div key={exam.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {exam.exam_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {exam.exam_date
                          ? `Data: ${format(parseLocalDate(exam.exam_date), 'dd/MM/yyyy', { locale: ptBR })}`
                          : `Enviado em ${format(new Date(exam.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                      <Button asChild variant="outline" size="sm" className="w-full sm:w-auto justify-center">
                        <a href={exam.file_url} target="_blank" rel="noreferrer">Abrir arquivo</a>
                      </Button>
                      {!exam.ai_summary && (
                        <Button
                          size="sm"
                          className="gap-1.5 w-full sm:w-auto justify-center"
                          onClick={() => void handleAnalyze(exam)}
                          disabled={analyzingId === exam.id || deletingId === exam.id}
                        >
                          <Sparkles className="w-4 h-4" />
                          {analyzingId === exam.id ? 'Analisando...' : 'Analisar com IA'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1.5 w-full sm:w-auto justify-center"
                        onClick={() => void handleDeleteExam(exam)}
                        disabled={deletingId === exam.id || analyzingId === exam.id}
                      >
                        <Trash2 className="w-4 h-4" />
                        {deletingId === exam.id ? 'Excluindo...' : 'Excluir'}
                      </Button>
                    </div>
                  </div>

                  {exam.notes && (
                    <p className="text-xs text-muted-foreground">
                      <strong>Observações:</strong> {exam.notes}
                    </p>
                  )}

                  {exam.ai_summary && (visibleResults[exam.id] ?? false) ? (
                    <div className="rounded-md bg-primary/5 border border-primary/20 p-2">
                      <p className="text-xs font-semibold text-primary mb-1">Análise da IA</p>
                      {renderAiSummary(exam.ai_summary)}
                    </div>
                  ) : !exam.ai_summary ? (
                    <p className="text-xs text-muted-foreground">Sem análise ainda.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Análise da IA oculta. Toque na seta para expandir.
                    </p>
                  )}

                  {exam.ai_summary && (
                    <div className="flex justify-end pt-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full"
                        onClick={() =>
                          setVisibleResults((prev) => ({
                            ...prev,
                              [exam.id]: !(prev[exam.id] ?? false),
                          }))
                        }
                        disabled={deletingId === exam.id || analyzingId === exam.id}
                        title={(visibleResults[exam.id] ?? false) ? 'Esconder resultado' : 'Mostrar resultado'}
                        aria-label={(visibleResults[exam.id] ?? false) ? 'Esconder resultado' : 'Mostrar resultado'}
                      >
                        {(visibleResults[exam.id] ?? false) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <PatientTabPanelSection title="Exames" contentClassName="p-4 sm:p-5 space-y-4">
      {body}
    </PatientTabPanelSection>
  );
}
