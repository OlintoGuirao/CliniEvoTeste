import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileQuestion, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import {
  type ProcedurePublicReportPayload,
  type ProcedurePublicReportField,
  type ProcedurePublicReportPhoto,
  type ProcedurePublicReportSession,
  formatSessionDate,
} from '@/lib/procedurePublicReport';
import { useProcedurePublicReportComputed } from '@/hooks/useProcedurePublicReportComputed';
import { GenericProcedureReportLayout } from '@/components/procedure-report/GenericProcedureReportLayout';
import { resolvePublicPrimary } from '@/lib/publicBrand';

function parsePayload(raw: Json): ProcedurePublicReportPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!o.patient || typeof o.patient !== 'object') return null;
  if (!o.instance || typeof o.instance !== 'object') return null;
  if (!o.procedure || typeof o.procedure !== 'object') return null;
  if (!Array.isArray(o.fields) || !Array.isArray(o.sessions) || !Array.isArray(o.photos)) return null;
  return {
    patient: o.patient as ProcedurePublicReportPayload['patient'],
    instance: o.instance as ProcedurePublicReportPayload['instance'],
    procedure: o.procedure as ProcedurePublicReportPayload['procedure'],
    professional: (o.professional as ProcedurePublicReportPayload['professional']) ?? null,
    fields: o.fields as ProcedurePublicReportField[],
    sessions: o.sessions as ProcedurePublicReportSession[],
    photos: o.photos as ProcedurePublicReportPhoto[],
  };
}

export default function PublicProcedureReportPage() {
  const { slug: slugParam } = useParams<{ slug: string }>();
  const slug = slugParam?.trim() ?? '';
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<ProcedurePublicReportPayload | null>(null);
  const [error, setError] = useState(false);

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
      const { data, error: rpcError } = await supabase.rpc('get_public_procedure_report', { p_slug: slug });
      if (cancelled) return;
      if (rpcError || data == null) {
        setPayload(null);
        setError(true);
        setLoading(false);
        return;
      }
      const parsed = parsePayload(data);
      if (!parsed) {
        setPayload(null);
        setError(true);
      } else {
        setPayload(parsed);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const computed = useProcedurePublicReportComputed({
    fields: payload?.fields ?? [],
    sessions: payload?.sessions ?? [],
    photos: payload?.photos ?? [],
    patientDob: payload?.patient.date_of_birth ?? null,
    patientSex: payload?.patient.sex ?? null,
  });

  const primary = resolvePublicPrimary({
    themePalette: payload?.professional?.theme_palette ?? null,
    accentColor: payload?.professional?.accent_color ?? null,
    fallback: '#6A0DAD',
  });

  const treatmentStartDate = useMemo(
    () => formatSessionDate(payload?.patient.treatment_start_date ?? payload?.instance.data_inicio ?? null),
    [payload?.patient.treatment_start_date, payload?.instance.data_inicio]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F9F9F9] p-4">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">Carregando relatório...</p>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F9F9F9] p-4">
        <FileQuestion className="h-14 w-14 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-semibold text-foreground">Link inválido ou indisponível</h1>
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Este link do relatório não existe ou não está mais disponível. Peça um novo link ao seu profissional.
        </p>
      </div>
    );
  }

  return (
    <GenericProcedureReportLayout
      primary={primary}
      procedureName={payload.procedure.name}
      patientName={payload.patient.full_name}
      patientSexLabel={computed.patientSexLabel}
      patientAge={computed.patientAge}
      treatmentStartDate={treatmentStartDate}
      lastEvalDate={computed.lastEvalDate}
      sessions={computed.sessionsComputed}
      notice={
        <p className="mx-auto mt-3 w-full min-w-0 max-w-lg text-pretty text-sm text-muted-foreground">
          Este é o seu relatório de acompanhamento. Guarde o link com segurança.
        </p>
      }
    />
  );
}
