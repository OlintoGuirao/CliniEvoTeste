import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, FileQuestion, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  PatientRegistrationFormFields,
  toRegistrationApiPayload,
  type PatientRegistrationFormState,
} from '@/components/patient/PatientRegistrationFormFields';
import { resolvePublicPrimary } from '@/lib/publicBrand';
import { parseLocalDate } from '@/lib/utils';
import {
  fetchPublicPatientRegistration,
  submitPublicPatientRegistration,
  type PublicPatientRegistrationPayload,
} from '@/services/api/patientRegistrationApi';

const patientSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
});

function payloadToFormState(
  patient: PublicPatientRegistrationPayload['patient']
): PatientRegistrationFormState {
  return {
    full_name: patient.full_name ?? '',
    cpf: patient.cpf ?? '',
    date_of_birth: patient.date_of_birth ? parseLocalDate(patient.date_of_birth) : undefined,
    sex: patient.sex ?? '',
    profession: patient.profession ?? '',
    address: patient.address ?? '',
    city: patient.city ?? '',
    phone: patient.phone ?? '',
    referred_by: patient.referred_by ?? '',
    treatment_start_date: patient.treatment_start_date
      ? parseLocalDate(patient.treatment_start_date)
      : new Date(),
    consultation_objective: patient.consultation_objective ?? '',
    emergency_contact_name: patient.emergency_contact_name ?? '',
    emergency_contact_phone: patient.emergency_contact_phone ?? '',
    general_notes: patient.general_notes ?? '',
  };
}

export default function PublicPatientRegistrationPage() {
  const { slug: slugParam } = useParams<{ slug: string }>();
  const slug = slugParam?.trim() ?? '';
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<PublicPatientRegistrationPayload | null>(null);
  const [error, setError] = useState(false);
  const [formData, setFormData] = useState<PatientRegistrationFormState>({
    full_name: '',
    cpf: '',
    date_of_birth: undefined,
    sex: '',
    profession: '',
    address: '',
    city: '',
    phone: '',
    referred_by: '',
    treatment_start_date: new Date(),
    consultation_objective: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    general_notes: '',
  });
  const [lgpdSignatureData, setLgpdSignatureData] = useState<string | null>(null);
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
      const row = await fetchPublicPatientRegistration(slug);
      if (cancelled) return;
      if (!row) {
        setPayload(null);
        setError(true);
        setLoading(false);
        return;
      }
      setPayload(row);
      if (!row.completed) {
        setFormData(payloadToFormState(row.patient));
      }
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slug) return;

    try {
      patientSchema.parse({ full_name: formData.full_name });
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0]?.message ?? 'Preencha o nome completo.');
        return;
      }
    }

    if (!lgpdSignatureData?.trim()) {
      toast.error('Assine o termo de consentimento LGPD para continuar.');
      return;
    }

    setSaving(true);
    try {
      const ok = await submitPublicPatientRegistration(
        slug,
        toRegistrationApiPayload(formData),
        lgpdSignatureData.trim()
      );
      if (!ok) {
        toast.error('Não foi possível enviar. O link pode ter expirado ou o cadastro já foi concluído.');
        return;
      }
      setSubmitted(true);
      toast.success('Cadastro enviado com sucesso! Obrigado.');
    } catch (err) {
      if (err instanceof Error && err.message === 'PHONE_ALREADY_USED') {
        toast.error('Já existe um paciente com este telefone. Use outro número ou fale com a clínica.');
        return;
      }
      toast.error('Erro ao enviar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F9F9F9] p-4">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">Carregando ficha de cadastro…</p>
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
        <h1 className="text-lg font-semibold text-foreground">Cadastro concluído</h1>
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
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cadastro do paciente</p>
          <h1 className="text-xl font-bold text-foreground mt-1">{payload.patient.full_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{clinicName}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Preencha seus dados abaixo e assine o termo LGPD para concluir o cadastro.
          </p>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <PatientRegistrationFormFields
            formData={formData}
            onChange={setFormData}
            lgpdSignatureData={lgpdSignatureData}
            onLgpdSignatureChange={setLgpdSignatureData}
            idPrefix="public"
          />

          <Button type="submit" disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Enviando…' : 'Enviar cadastro'}
          </Button>
        </form>
      </div>
    </div>
  );
}
