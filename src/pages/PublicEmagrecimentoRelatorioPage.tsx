import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileQuestion, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useEmagrecimentoRelatorioComputed, type EmagrecimentoFieldRow, type EmagrecimentoSessionRow } from '@/hooks/useEmagrecimentoRelatorioComputed';
import { EmagrecimentoRelatorioLayout } from '@/components/emagrecimento/EmagrecimentoRelatorioLayout';
import { resolvePublicPrimary } from '@/lib/publicBrand';

type RpcPayload = {
  patient: {
    full_name: string;
    sex: Database['public']['Enums']['patient_sex'] | null;
    date_of_birth: string | null;
    treatment_start_date: string | null;
  };
  instance: { id: string; data_inicio: string };
  procedure: { name: string };
  professional: {
    full_name: string | null;
    email: string;
    accent_color: string | null;
    theme_palette: string | null;
    professional_registry_body: string | null;
    professional_registry_number: string | null;
  };
  fields: EmagrecimentoFieldRow[];
  sessions: EmagrecimentoSessionRow[];
};

function normalizeSessionsByDate(sessions: EmagrecimentoSessionRow[]): EmagrecimentoSessionRow[] {
  if (sessions.length <= 1) return sessions;
  const byDate = new Map<string, EmagrecimentoSessionRow>();
  for (const session of sessions) {
    const key = String(session.session_date ?? '').slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, session);
  }
  return Array.from(byDate.values());
}

function parsePayload(raw: unknown): RpcPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const patient = o.patient;
  const instance = o.instance;
  const procedure = o.procedure;
  const professional = o.professional;
  const fields = o.fields;
  const sessions = o.sessions;
  if (!patient || typeof patient !== 'object') return null;
  if (!instance || typeof instance !== 'object') return null;
  if (!procedure || typeof procedure !== 'object') return null;
  if (!professional || typeof professional !== 'object') return null;
  if (!Array.isArray(fields) || !Array.isArray(sessions)) return null;
  return {
    patient: patient as RpcPayload['patient'],
    instance: instance as RpcPayload['instance'],
    procedure: procedure as RpcPayload['procedure'],
    professional: professional as RpcPayload['professional'],
    fields: fields as EmagrecimentoFieldRow[],
    sessions: sessions as EmagrecimentoSessionRow[],
  };
}

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Relatório de emagrecimento acessível sem login (slug secreto em /re/:slug).
 */
export default function PublicEmagrecimentoRelatorioPage() {
  const { slug: slugParam } = useParams<{ slug: string }>();
  const slug = slugParam?.trim() ?? '';
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<RpcPayload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) {
      setError(true);
      setLoading(false);
      return;
    }
    let cancel = false;
    (async () => {
      setLoading(true);
      setError(false);
      const { data, error: rpcError } = await supabase.rpc('get_public_emagrecimento_report', { p_slug: slug });
      if (cancel) return;
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
      cancel = true;
    };
  }, [slug]);

  const instanceData = useMemo(() => ({} as Record<string, unknown>), []);
  const normalizedSessions = useMemo(() => normalizeSessionsByDate(payload?.sessions ?? []), [payload?.sessions]);
  const displayStartDate = payload?.patient.treatment_start_date ?? payload?.instance.data_inicio ?? null;

  const firstSession = normalizedSessions.length > 0 ? normalizedSessions[normalizedSessions.length - 1]! : null;
  const latestSession = normalizedSessions.length > 0 ? normalizedSessions[0]! : null;
  const latestData = (latestSession?.data as Record<string, unknown>) ?? {};
  const baselineData = useMemo(() => {
    if (!payload) return {};
    return { ...instanceData, ...(firstSession?.data as Record<string, unknown> | undefined) };
  }, [payload, instanceData, firstSession?.data]);

  const [pesoInput, setPesoInput] = useState('');
  const [alturaInput, setAlturaInput] = useState('');

  useEffect(() => {
    if (!payload) return;
    const peso = toNum(latestData.peso_atual ?? latestData.peso_inicial ?? baselineData.peso_atual ?? baselineData.peso_inicial);
    const alt = toNum(latestData.altura_cm ?? baselineData.altura_cm);
    setPesoInput(peso != null ? String(peso) : '');
    setAlturaInput(alt != null ? String(alt) : '');
  }, [payload, latestData, baselineData]);

  const computed = useEmagrecimentoRelatorioComputed({
    fields: payload?.fields ?? [],
    sessions: normalizedSessions,
    instanceData,
    displayStartDate,
    patientDob: payload?.patient.date_of_birth ?? null,
  });

  const primary = resolvePublicPrimary({
    themePalette: payload?.professional.theme_palette ?? null,
    accentColor: payload?.professional.accent_color ?? null,
    fallback: '#6A0DAD',
  });

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
    <EmagrecimentoRelatorioLayout
      variant="public"
      primary={primary}
      patientName={payload.patient.full_name}
      patientSex={payload.patient.sex}
      patientAge={computed.patientAge}
      lastEvalDate={computed.lastEvalDate}
      latestData={computed.latestData}
      baselineData={computed.baselineData}
      summaryRows={computed.summaryRows}
      fields={payload.fields}
      pesoInput={pesoInput}
      setPesoInput={setPesoInput}
      alturaInput={alturaInput}
      setAlturaInput={setAlturaInput}
      chartData={computed.chartData}
      chartSeriesKeys={computed.chartSeriesKeys}
      chartConfig={computed.chartConfig}
      compositionKeys={computed.compositionKeys}
      troncoKeys={computed.troncoKeys}
      publicNotice={
        <p className="mx-auto w-full min-w-0 max-w-lg text-pretty text-sm text-muted-foreground">
          Este é o seu relatório de acompanhamento. Guarde o link com segurança.
        </p>
      }
    />
  );
}
