import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatPhoneForWhatsApp } from '@/lib/evolutionPdf';
import { buildEmagrecimentoReportWhatsAppMessage, openWhatsAppWithFallback } from '@/lib/reportShare';
import { loadWhatsappManualTemplates } from '@/lib/loadWhatsappManualTemplates';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getProceduresForProfile } from '@/lib/proceduresForProfile';
import { Button } from '@/components/ui/button';
import type { Database } from '@/integrations/supabase/types';
import { useEmagrecimentoRelatorioComputed, type EmagrecimentoFieldRow, type EmagrecimentoSessionRow } from '@/hooks/useEmagrecimentoRelatorioComputed';
import { EmagrecimentoRelatorioLayout } from '@/components/emagrecimento/EmagrecimentoRelatorioLayout';

const EMAGRECIMENTO_SLUG = 'emagrecimento-reducao-medidas';

type ProcedureRow = Database['public']['Tables']['procedures']['Row'];
type ProcedureFieldRow = Database['public']['Tables']['procedure_fields']['Row'];
type InstanceRow = Database['public']['Tables']['procedure_instances']['Row'];
type SessionRow = Database['public']['Tables']['procedure_sessions']['Row'];

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '.'));
  return Number.isFinite(n) ? n : null;
}

function normalizeSessionsByDate(sessions: SessionRow[]): SessionRow[] {
  if (sessions.length <= 1) return sessions;
  const byDate = new Map<string, SessionRow>();
  for (const session of sessions) {
    const key = String(session.session_date ?? '').slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, session);
  }
  return Array.from(byDate.values());
}

export default function EmagrecimentoRelatorioPage() {
  const { slug, instanceId } = useParams<{ slug: string; instanceId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [procedure, setProcedure] = useState<ProcedureRow | null>(null);
  const [instance, setInstance] = useState<InstanceRow | null>(null);
  const [fields, setFields] = useState<ProcedureFieldRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [patientName, setPatientName] = useState('');
  const [patientSex, setPatientSex] = useState<Database['public']['Enums']['patient_sex'] | null>(null);
  const [patientDob, setPatientDob] = useState<string | null>(null);
  const [patientTreatmentStartDate, setPatientTreatmentStartDate] = useState<string | null>(null);
  const [patientPhone, setPatientPhone] = useState<string | null>(null);
  const [pesoInput, setPesoInput] = useState('');
  const [alturaInput, setAlturaInput] = useState('');
  const [publicSlug, setPublicSlug] = useState<string | null>(null);

  const primary = profile?.accent_color?.trim() || '#6A0DAD';

  const loadProcedure = useCallback(async () => {
    if (!slug || !profile?.id) return;
    const procs = await getProceduresForProfile(profile.id);
    const data = procs.find((p) => p.slug === slug);
    setProcedure((data as ProcedureRow) ?? null);
    if (data?.id) {
      const { data: fieldsData } = await supabase
        .from('procedure_fields')
        .select('*')
        .eq('procedure_id', data.id)
        .order('sort_order');
      setFields((fieldsData ?? []) as ProcedureFieldRow[]);
    } else {
      setFields([]);
    }
  }, [slug, profile?.id]);

  const loadInstance = useCallback(async () => {
    if (!instanceId) return;
    const { data: instData } = await supabase.from('procedure_instances').select('*').eq('id', instanceId).single();
    setInstance((instData as InstanceRow) ?? null);
    if (instData?.patient_id) {
      const { data: pat } = await supabase
        .from('patients')
        .select('full_name, sex, date_of_birth, treatment_start_date, phone')
        .eq('id', (instData as { patient_id: string }).patient_id)
        .single();
      const p = pat as {
        full_name: string;
        sex: Database['public']['Enums']['patient_sex'] | null;
        date_of_birth: string | null;
        treatment_start_date: string | null;
        phone: string | null;
      } | null;
      setPatientName(p?.full_name ?? '');
      setPatientSex(p?.sex ?? null);
      setPatientDob(p?.date_of_birth ?? null);
      setPatientTreatmentStartDate(p?.treatment_start_date ?? null);
      setPatientPhone(p?.phone ?? null);
    }
  }, [instanceId]);

  const loadSessions = useCallback(async () => {
    if (!instanceId) return;
    const { data } = await supabase
      .from('procedure_sessions')
      .select('*')
      .eq('procedure_instance_id', instanceId)
      .order('session_date', { ascending: false })
      .order('updated_at', { ascending: false });
    setSessions((data ?? []) as SessionRow[]);
  }, [instanceId]);

  useEffect(() => {
    if (slug !== EMAGRECIMENTO_SLUG) {
      navigate(`/procedures/${slug}/${instanceId}`, { replace: true });
    }
  }, [slug, instanceId, navigate]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      await Promise.all([loadProcedure(), loadInstance()]);
      if (!cancel) setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [loadProcedure, loadInstance]);

  useEffect(() => {
    if (instance) void loadSessions();
  }, [instance, loadSessions]);

  useEffect(() => {
    if (!instanceId || !profile?.id) return;
    void (async () => {
      const { data, error } = await supabase.rpc('ensure_emagrecimento_report_link', {
        p_procedure_instance_id: instanceId,
      });
      if (!error && typeof data === 'string' && data.trim()) setPublicSlug(data.trim());
    })();
  }, [instanceId, profile?.id]);

  const firstSession = sessions.length > 0 ? sessions[sessions.length - 1]! : null;
  const latestSession = sessions.length > 0 ? sessions[0]! : null;
  const instanceData = ((instance as { data?: Record<string, unknown> } | null)?.data ?? {}) as Record<string, unknown>;
  const displayStartDate = patientTreatmentStartDate ?? instance?.data_inicio ?? null;

  const latestData = (latestSession?.data as Record<string, unknown>) ?? {};
  const baselineData = useMemo(
    () => ({ ...instanceData, ...(firstSession?.data as Record<string, unknown> | undefined) }),
    [instanceData, firstSession?.data]
  );

  useEffect(() => {
    const peso = toNum(latestData.peso_atual ?? latestData.peso_inicial ?? baselineData.peso_atual ?? baselineData.peso_inicial);
    const alt = toNum(latestData.altura_cm ?? baselineData.altura_cm);
    setPesoInput(peso != null ? String(peso) : '');
    setAlturaInput(alt != null ? String(alt) : '');
  }, [latestData.peso_atual, latestData.peso_inicial, latestData.altura_cm, baselineData.peso_atual, baselineData.peso_inicial, baselineData.altura_cm]);

  const fieldRows = fields as EmagrecimentoFieldRow[];
  const sessionRows = useMemo(
    () => normalizeSessionsByDate(sessions as SessionRow[]) as EmagrecimentoSessionRow[],
    [sessions]
  );

  const computed = useEmagrecimentoRelatorioComputed({
    fields: fieldRows,
    sessions: sessionRows,
    instanceData,
    displayStartDate,
    patientDob,
  });

  const backHref = instance ? `/patients/${(instance as { patient_id: string }).patient_id}` : `/procedures/${slug}`;

  const publicBase = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');
  const publicReportUrl = publicSlug ? `${publicBase}/re/${publicSlug}` : '';

  const openWhatsAppPublic = useCallback(async () => {
    const wa = formatPhoneForWhatsApp(patientPhone);
    if (!wa) {
      toast.error('Cadastre o telefone do paciente na ficha para compartilhar pelo WhatsApp.');
      return;
    }
    if (!publicReportUrl) {
      toast.error('Não foi possível obter o link público. Tente recarregar a página.');
      return;
    }
    const templates = await loadWhatsappManualTemplates(profile?.id);
    const entry = templates.procedure_report;
    if (!entry.enabled) {
      toast.message('Mensagem desativada em Mensagens padrão.');
      return;
    }
    const message = buildEmagrecimentoReportWhatsAppMessage({
      patientName,
      clinicName: profile?.full_name,
      reportUrl: publicReportUrl,
      template: entry.message,
    });
    openWhatsAppWithFallback({ phone: wa, text: message });
    toast.success('Abrindo o WhatsApp com o link público do relatório.');
  }, [patientPhone, publicReportUrl, profile?.id, profile?.full_name, patientName]);

  if (!slug || !instanceId || slug !== EMAGRECIMENTO_SLUG) {
    return null;
  }

  if (loading && !instance) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!instance || !procedure) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Atendimento não encontrado.</p>
        <Button variant="link" asChild className="mt-2">
          <Link to={`/procedures/${slug}`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <EmagrecimentoRelatorioLayout
      variant="auth"
      primary={primary}
      patientName={patientName}
      patientSex={patientSex}
      patientAge={computed.patientAge}
      lastEvalDate={computed.lastEvalDate}
      latestData={computed.latestData}
      baselineData={computed.baselineData}
      summaryRows={computed.summaryRows}
      fields={fieldRows}
      pesoInput={pesoInput}
      setPesoInput={setPesoInput}
      alturaInput={alturaInput}
      setAlturaInput={setAlturaInput}
      chartData={computed.chartData}
      chartSeriesKeys={computed.chartSeriesKeys}
      chartConfig={computed.chartConfig}
      compositionKeys={computed.compositionKeys}
      troncoKeys={computed.troncoKeys}
      authBackHref={`/procedures/${slug}/${instanceId}`}
      publicReportUrl={publicReportUrl}
      onWhatsAppPublicLink={openWhatsAppPublic}
      backFooterHref={backHref}
    />
  );
}
