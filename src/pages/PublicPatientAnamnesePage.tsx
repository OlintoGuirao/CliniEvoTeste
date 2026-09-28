import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, FileQuestion, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AnamneseQuestionnaire } from '@/components/anamnese/AnamneseQuestionnaire';
import type { AnamneseData } from '@/components/anamnese/anamneseTypes';
import {
  fetchPublicPatientAnamnese,
  submitPublicPatientAnamnese,
  type PublicPatientAnamnesePayload,
} from '@/services/api/patientAnamneseApi';
import { resolvePublicPrimary } from '@/lib/publicBrand';

export default function PublicPatientAnamnesePage() {
  const { slug: slugParam } = useParams<{ slug: string }>();
  const slug = slugParam?.trim() ?? '';
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<PublicPatientAnamnesePayload | null>(null);
  const [error, setError] = useState(false);
  const [formData, setFormData] = useState<AnamneseData>({});
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!slug) {
      setError(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(false);
      const row = await fetchPublicPatientAnamnese(slug);
      if (cancelled) return;
      if (!row) {
        setPayload(null);
        setError(true);
        setLoading(false);
        return;
      }
      setPayload(row);
      setFormData((row.data as AnamneseData) ?? {});
      setSubmitted(row.completed);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const primary = resolvePublicPrimary({
    themePalette: null,
    accentColor: payload?.professional?.accent_color ?? null,
    fallback: '#6A0DAD',
  });
  const clinicName =
    payload?.professional?.app_name?.trim() || payload?.professional?.full_name?.trim() || 'Clínica';

  function update(key: keyof AnamneseData, value: string | undefined) {
    setFormData((prev) => ({ ...prev, [key]: value || undefined }));
  }

  async function handleSubmit(signatureData: string) {
    if (!slug) return;
    setSaving(true);
    try {
      const ok = await submitPublicPatientAnamnese(slug, formData, signatureData);
      if (!ok) {
        toast.error('Não foi possível enviar. O link pode ter expirado ou a anamnese já foi concluída.');
        return;
      }
      setSubmitted(true);
      setPendingSignature(signatureData);
      toast.success('Anamnese enviada com sucesso! Obrigado.');
    } catch {
      toast.error('Erro ao enviar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F9F9F9] p-4">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">Carregando anamnese…</p>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F9F9F9] p-4">
        <FileQuestion className="h-14 w-14 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-semibold text-foreground">Link inválido ou indisponível</h1>
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Esta ficha não existe ou não está mais disponível. Peça um novo link ao seu profissional.
        </p>
      </div>
    );
  }

  if (submitted || payload.completed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F9F9F9] p-4">
        <CheckCircle2 className="h-14 w-14 text-emerald-600" aria-hidden />
        <h1 className="text-lg font-semibold text-foreground">Anamnese concluída</h1>
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Obrigado, {payload.patient.full_name?.split(/\s+/)[0] || 'paciente'}! Sua ficha já foi recebida pela{' '}
          {clinicName}.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] px-3 py-6 sm:px-4">
      <div className="mx-auto max-w-2xl w-full space-y-5">
        <header className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: `${primary}33` }}>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Anamnese</p>
          <h1 className="text-xl font-bold text-foreground mt-1">{payload.patient.full_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{clinicName}</p>
        </header>

        <div className="rounded-xl border bg-white p-4 sm:p-5 shadow-sm space-y-4">
          <AnamneseQuestionnaire
            data={formData}
            savedData={formData}
            isEditing
            onUpdate={update}
            signatureData={pendingSignature}
            signedAt={null}
            onSaveSignature={(dataUrl) => {
              setPendingSignature(dataUrl);
              void handleSubmit(dataUrl);
            }}
            showSignatureSection
          />
          <p className="text-xs text-muted-foreground">
            Preencha todas as informações, assine no campo acima e toque em salvar na assinatura para enviar.
          </p>
          {saving ? (
            <Button disabled className="w-full gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando…
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
