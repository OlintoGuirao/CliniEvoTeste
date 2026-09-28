import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { TermSignatureDialog } from '@/components/TermSignatureDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate, cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useUiCopy } from '@/hooks/use-ui-copy';
import { formatPatientDisplayName } from '@/lib/patientDisplay';
import { toast } from 'sonner';
import { deletePatientSessionFromTimeline } from '@/lib/procedureSessionDelete';
import type { SessionTimelineItem } from '@/components/patient-detail/SessionTimeline';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { PageLoading } from '@/components/layout/PageLoading';
import { PatientDetailHeader } from '@/components/patient-detail/PatientDetailHeader';
import { PatientPersonalInfoSection } from '@/components/patient-detail/PatientPersonalInfoSection';
import { PatientAnamneseSection } from '@/components/patient-detail/PatientAnamneseSection';
import { PatientLgpdSection } from '@/components/patient-detail/PatientLgpdSection';
import { PatientTermTabSection } from '@/components/patient-detail/PatientTermTabSection';
import { PatientProceduresSection } from '@/components/patient-detail/PatientProceduresSection';
import { PatientSalonProceduresSection } from '@/components/patient-detail/PatientSalonProceduresSection';
import { PatientSalonRecurringAgendaSection } from '@/components/patient-detail/PatientSalonRecurringAgendaSection';
import { PatientExamsSection } from '@/components/patient-detail/PatientExamsSection';
import { PatientPrescriptionsSection } from '@/components/patient-detail/PatientPrescriptionsSection';
import { PatientDentalPlansSection } from '@/components/patient-detail/PatientDentalPlansSection';
import { PatientDocumentsSection } from '@/components/patient-detail/PatientDocumentsSection';
import { PatientDetailTabPanel } from '@/components/patient-detail/PatientDetailTabPanel';
import type { PatientDetailPageTab } from '@/components/patient-detail/PatientDetailNavTabs';
import { isProfessionalModuleEnabled, MODULE_KEY_RECEITUARIO } from '@/lib/professionalModules';
import { isClinicOnlyAccount } from '@/lib/accountType';
import {
  collectPatientProcedureSlugs,
  patientHasTermBotoxTab,
  patientHasTermPreenchedoresTab,
} from '@/lib/patientProcedureTerms';
import { parseAllSalonProceduresFromNotes } from '@/components/salon/SalonProfessionalRibbonLabel';
import { formatSalonSessionNotesForDisplay } from '@/lib/salonAppointmentNotes';
import { Button } from '@/components/ui/button';
import { ClipboardList, Loader2 } from 'lucide-react';

const LGPD_CONSENT_TEXT = `
Eu, abaixo identificado(a), autorizo expressamente a coleta, armazenamento e uso de minhas imagens e dados pessoais para fins de acompanhamento clínico de tratamentos estéticos.

Estou ciente de que:
• As imagens serão utilizadas exclusivamente para documentação e acompanhamento da evolução dos tratamentos;
• Meus dados serão mantidos em sigilo e não serão compartilhados com terceiros sem meu consentimento;
• Posso solicitar a exclusão dos meus dados a qualquer momento;
• Este consentimento está em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
`.trim();

interface Patient {
  id: string;
  full_name: string;
  nickname: string | null;
  cpf: string | null;
  phone: string | null;
  date_of_birth: string | null;
  sex: string | null;
  profile_photo_url: string | null;
  treatment_start_date: string | null;
  general_notes: string | null;
  created_at: string;
  registration_completed_at: string | null;
  profession: string | null;
  address: string | null;
  address_number: string | null;
  neighborhood: string | null;
  zip_code: string | null;
  city: string | null;
  referred_by: string | null;
  origin_id: string | null;
  referred_by_patient_id: string | null;
  consultation_objective: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  professional_id?: string | null;
}

interface LgpdConsent {
  id: string;
  consent_given: boolean;
  consent_date: string | null;
  signature_data: string | null;
}

interface ProcedureInstance {
  id: string;
  procedure_id: string;
  data_inicio: string;
  status: string;
  procedures: { name: string; slug: string } | null;
}

interface ProcedureSessionRow {
  id: string;
  procedure_instance_id?: string;
  procedure_instances?: { id: string; procedures: { name: string; slug: string } | null } | null;
}

interface PatientSession {
  id: string;
  session_date: string;
  observacoes: string | null;
  procedure_sessions?: ProcedureSessionRow[];
  patient_session_photos?: Array<{ file_url: string; sort_order: number }>;
}

const BASE_PATIENT_DETAIL_TABS: PatientDetailPageTab[] = [
  'procedimentos',
  'ficha',
  'anamnese',
  'exames',
  'lgpd',
];

const SALON_PATIENT_DETAIL_TABS: PatientDetailPageTab[] = ['procedimentos', 'ficha', 'agenda-fixa'];

export type PatientDetailViewProps = {
  patientId: string;
  variant?: 'page' | 'dialog';
  initialTab?: PatientDetailPageTab;
  syncUrlTab?: boolean;
  onRequestClose?: () => void;
  className?: string;
};

export function PatientDetailView({
  patientId,
  variant = 'page',
  initialTab = 'procedimentos',
  syncUrlTab = variant === 'page',
  onRequestClose,
  className,
}: PatientDetailViewProps) {
  const copy = useUiCopy();
  const id = patientId;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [consent, setConsent] = useState<LgpdConsent | null>(null);
  const [anamneseComplete, setAnamneseComplete] = useState(false);
  const [signedTermSlugs, setSignedTermSlugs] = useState<string[]>([]);
  const [procedureInstances, setProcedureInstances] = useState<ProcedureInstance[]>([]);
  const [patientSessions, setPatientSessions] = useState<PatientSession[]>([]);
  /** Sessões de procedimento por instância (contagem e última data vêm daqui, não de patient_sessions) */
  const [procedureSessionsRaw, setProcedureSessionsRaw] = useState<Array<{ procedure_instance_id: string; session_date: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [termSignatureOpen, setTermSignatureOpen] = useState(false);
  const [termSlugToSign, setTermSlugToSign] = useState<string>('lgpd');
  const [lgpdSignatureData, setLgpdSignatureData] = useState<string | null>(null);
  const [anamneseSignatureData, setAnamneseSignatureData] = useState<string | null>(null);
  const [savingLgpd, setSavingLgpd] = useState(false);
  const [activeTab, setActiveTab] = useState<PatientDetailPageTab>(initialTab);
  const [isFichaEditing, setIsFichaEditing] = useState(false);
  const [isAnamneseEditing, setIsAnamneseEditing] = useState(false);
  const [deletingTimelineSessionId, setDeletingTimelineSessionId] = useState<string | null>(null);
  const tabsLocked = isFichaEditing || isAnamneseEditing;
  const isDialog = variant === 'dialog';
  const showReceituario = isProfessionalModuleEnabled(profile, MODULE_KEY_RECEITUARIO);
  const showDentalPlans = isClinicOnlyAccount(profile?.account_type);
  const patientProcedureSlugs = useMemo(
    () => collectPatientProcedureSlugs(procedureInstances),
    [procedureInstances]
  );
  const showTermBotoxTab = patientHasTermBotoxTab(patientProcedureSlugs);
  const showTermPreenchedoresTab = patientHasTermPreenchedoresTab(patientProcedureSlugs);
  const patientDetailTabs = useMemo<PatientDetailPageTab[]>(() => {
    if (copy.isSalon) return SALON_PATIENT_DETAIL_TABS;
    const tabs: PatientDetailPageTab[] = [...BASE_PATIENT_DETAIL_TABS];
    if (showReceituario) {
      const examesIndex = tabs.indexOf('exames');
      tabs.splice(examesIndex + 1, 0, 'receituario');
    }
    if (showDentalPlans) {
      const insertAfter = tabs.includes('receituario') ? 'receituario' : 'exames';
      const idx = tabs.indexOf(insertAfter);
      tabs.splice(idx + 1, 0, 'planos-odontologicos', 'documentos');
    }
    if (showTermBotoxTab) tabs.push('termo-botox');
    if (showTermPreenchedoresTab) tabs.push('termo-preenchedores');
    return tabs;
  }, [copy.isSalon, showReceituario, showDentalPlans, showTermBotoxTab, showTermPreenchedoresTab]);

  useEffect(() => {
    if (id && user?.id) {
      fetchPatientData();
    }
  }, [id, user?.id]);

  useEffect(() => {
    if (!syncUrlTab) return;
    const tabParam = searchParams.get('tab');
    if (
      tabParam &&
      patientDetailTabs.includes(tabParam as PatientDetailPageTab) &&
      !tabsLocked
    ) {
      setActiveTab(tabParam as PatientDetailPageTab);
    }
  }, [searchParams, tabsLocked, patientDetailTabs, syncUrlTab]);

  useEffect(() => {
    if (!patientDetailTabs.includes(activeTab)) {
      setActiveTab(initialTab === 'ficha' ? 'ficha' : 'procedimentos');
      if (!syncUrlTab) return;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('tab');
          return next;
        },
        { replace: true }
      );
    }
  }, [activeTab, patientDetailTabs, setSearchParams, syncUrlTab, initialTab]);

  async function handleRegisterLgpdConsent(signatureDataUrl: string) {
    if (!patient?.id || !signatureDataUrl?.trim()) {
      toast.error('Assine no campo abaixo para registrar o consentimento.');
      return;
    }
    setSavingLgpd(true);
    try {
      if (consent?.id) {
        const { error } = await supabase
          .from('lgpd_consents')
          .update({
            consent_given: true,
            consent_date: new Date().toISOString(),
            consent_text: LGPD_CONSENT_TEXT,
            signature_data: signatureDataUrl.trim(),
          })
          .eq('id', consent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('lgpd_consents').insert({
          patient_id: patient.id,
          consent_given: true,
          consent_date: new Date().toISOString(),
          consent_text: LGPD_CONSENT_TEXT,
          signature_data: signatureDataUrl.trim(),
        });
        if (error) throw error;
      }
      toast.success('Consentimento LGPD registrado.');
      setLgpdSignatureData(null);
      setActiveTab('lgpd');
      fetchPatientData();
    } catch {
      toast.error('Erro ao registrar consentimento.');
    } finally {
      setSavingLgpd(false);
    }
  }

  async function fetchPatientData() {
    try {
      const [patientRes, consentRes, anamneseRes, termSigsRes, instancesRes, sessionsRes] = await Promise.all([
        supabase.from('patients').select('*').eq('id', id).single(),
        supabase.from('lgpd_consents').select('*').eq('patient_id', id).maybeSingle(),
        supabase.from('patient_anamnese').select('id, signed_at, signature_data').eq('patient_id', id).maybeSingle(),
        supabase.from('term_signatures').select('terms(slug)').eq('patient_id', id),
        supabase
          .from('procedure_instances')
          .select('id, procedure_id, data_inicio, status, procedures(name, slug)')
          .eq('patient_id', id)
          .order('data_inicio', { ascending: false }),
        supabase
          .from('patient_sessions')
          .select(`
            id,
            session_date,
            observacoes,
            professional_id,
            patient_session_photos ( file_url, sort_order ),
            procedure_sessions (
              id,
              procedure_instance_id,
              procedure_instances ( id, procedures ( name, slug ) )
            )
          `)
          .eq('patient_id', id)
          .order('session_date', { ascending: false }),
      ]);

      if (patientRes.error) throw patientRes.error;
      const patientData = patientRes.data as (Patient | null);
      setPatient(patientData);
      setConsent(consentRes.data);
      const anamneseRow = anamneseRes.data as { signed_at: string | null; signature_data: string | null } | null;
      setAnamneseComplete(!!(anamneseRow && (anamneseRow.signed_at || anamneseRow.signature_data)));
      setAnamneseSignatureData(anamneseRow?.signature_data ?? null);
      const termSigs = (termSigsRes.data ?? []) as Array<{ terms: { slug: string } | null }>;
      setSignedTermSlugs(termSigs.map((r) => r.terms?.slug).filter(Boolean) as string[]);
      const instances = (instancesRes.data ?? []) as ProcedureInstance[];
      setProcedureInstances(instances);
      setPatientSessions((sessionsRes.data ?? []) as PatientSession[]);

      const instanceIds = instances.map((i) => i.id);
      if (instanceIds.length > 0) {
        const { data: procSessions } = await supabase
          .from('procedure_sessions')
          .select('procedure_instance_id, session_date')
          .in('procedure_instance_id', instanceIds);
        setProcedureSessionsRaw((procSessions ?? []) as Array<{ procedure_instance_id: string; session_date: string }>);
      } else {
        setProcedureSessionsRaw([]);
      }
    } catch (error) {
      console.error('Error fetching patient:', error);
      if (isDialog) {
        toast.error('Não foi possível carregar a ficha do paciente.');
        onRequestClose?.();
      } else {
        navigate('/patients');
      }
    } finally {
      setLoading(false);
    }
  }

  function notifyTabChangeBlocked() {
    toast.message('Salve ou cancele as alterações antes de trocar de aba.');
  }

  function handleTabChange(tab: PatientDetailPageTab) {
    if (tabsLocked) {
      notifyTabChangeBlocked();
      return;
    }
    setActiveTab(tab);
    if (!syncUrlTab) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === 'procedimentos') {
          next.delete('tab');
        } else {
          next.set('tab', tab);
        }
        return next;
      },
      { replace: true }
    );
  }

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getSexLabel = (sex: string | null) => {
    switch (sex) {
      case 'male':
        return 'Masculino';
      case 'female':
        return 'Feminino';
      case 'other':
        return 'Outro';
      default:
        return 'Não informado';
    }
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birth = parseLocalDate(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const { sessionCountByInstanceId, lastSessionDateByInstanceId, timelineItems, statusLabel, lastSessionFormatted, activeProceduresCount } = useMemo(() => {
    const countMap: Record<string, number> = {};
    const lastDateMap: Record<string, string> = {};
    procedureSessionsRaw.forEach((s) => {
      const instanceId = s.procedure_instance_id;
      if (instanceId) {
        countMap[instanceId] = (countMap[instanceId] ?? 0) + 1;
        const d = s.session_date;
        if (!lastDateMap[instanceId] || d > lastDateMap[instanceId]) lastDateMap[instanceId] = d;
      }
    });
    const items = patientSessions.map((ps) => {
      const salonNames = parseAllSalonProceduresFromNotes(ps.observacoes);
      const clinicalNames = (ps.procedure_sessions ?? [])
        .map((s) => s.procedure_instances?.procedures?.name)
        .filter(Boolean) as string[];
      const photoUrls = (ps.patient_session_photos ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => p.file_url)
        .filter(Boolean);
      const salonNotes = copy.isSalon ? formatSalonSessionNotesForDisplay(ps.observacoes) : null;
      return {
        id: ps.id,
        session_date: ps.session_date,
        observacoes: ps.observacoes,
        professionalId: (ps as { professional_id?: string }).professional_id ?? null,
        procedureNames: copy.isSalon ? salonNames : clinicalNames.length > 0 ? clinicalNames : salonNames,
        photoUrls,
        displayObservacoes: salonNotes?.userNotes ?? undefined,
        valorLine: salonNotes?.valorLine ?? undefined,
        procedureSlug: (ps.procedure_sessions ?? [])[0]?.procedure_instances?.procedures?.slug ?? null,
        procedureSessionId: (ps.procedure_sessions ?? [])[0]?.id ?? null,
        procedureInstanceId: (ps.procedure_sessions ?? [])[0]?.procedure_instance_id ?? null,
        procedureSessionIds: (ps.procedure_sessions ?? []).map((s) => s.id).filter(Boolean),
      };
    });
    const activeCount = copy.isSalon ? 0 : procedureInstances.filter((i) => i.status === 'em_andamento').length;
    const allFinalizado = !copy.isSalon && procedureInstances.length > 0 && procedureInstances.every((i) => i.status === 'finalizado');
    const label: 'Ativo' | 'Em tratamento' | 'Finalizado' = copy.isSalon
      ? 'Ativo'
      : activeCount > 0
        ? 'Em tratamento'
        : allFinalizado
          ? 'Finalizado'
          : 'Ativo';
    const lastSession = patientSessions[0];
    return {
      sessionCountByInstanceId: countMap,
      lastSessionDateByInstanceId: lastDateMap,
      timelineItems: items,
      statusLabel: label,
      lastSessionFormatted: lastSession ? format(parseLocalDate(lastSession.session_date), 'dd/MM/yyyy', { locale: ptBR }) : null,
      activeProceduresCount: activeCount,
    };
  }, [patientSessions, procedureInstances, procedureSessionsRaw, copy.isSalon]);

  if (loading) {
    if (isDialog) {
      return (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando ficha…
        </div>
      );
    }
    return <PageLoading />;
  }

  if (!patient) {
    return null;
  }

  const formatSessionDate = (iso: string) => format(parseLocalDate(iso), "d 'de' MMMM yyyy", { locale: ptBR });
  const formatShortDate = (iso: string) => format(parseLocalDate(iso), 'dd/MM/yyyy', { locale: ptBR });

  const handleDeleteTimelineSession = async (session: SessionTimelineItem) => {
    setDeletingTimelineSessionId(session.id);
    try {
      const { error } = await deletePatientSessionFromTimeline(
        session.id,
        session.procedureSessionIds ?? (session.procedureSessionId ? [session.procedureSessionId] : [])
      );
      if (error) {
        toast.error('Não foi possível apagar a sessão.');
        return;
      }
      toast.success('Sessão apagada.');
      await fetchPatientData();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao apagar a sessão.');
    } finally {
      setDeletingTimelineSessionId(null);
    }
  };

  return (
    <div
      className={cn(
        isDialog
          ? 'flex min-h-0 flex-1 flex-col'
          : 'space-y-4 md:space-y-8 animate-fade-in pb-28 md:pb-8',
        className
      )}
    >
      {!isDialog ? (
        <PageBreadcrumb
          segments={[
            { label: 'Início', path: '/dashboard' },
            { label: copy.patients, path: '/patients' },
            { label: patient.full_name },
          ]}
          className="mb-1 hidden md:block"
        />
      ) : null}
      <div
        className={cn(
          'overflow-hidden bg-card',
          isDialog
            ? 'flex min-h-0 flex-1 flex-col rounded-none border-0 shadow-none'
            : 'rounded-lg md:rounded-xl border border-border/60 shadow-sm'
        )}
      >
        {patient.registration_completed_at == null && (
          <div className="flex flex-col gap-3 border-b border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:px-6 dark:border-red-900/50 dark:bg-red-950/40">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300">
                <ClipboardList className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-red-800 dark:text-red-200">Pré-cadastro</p>
                <p className="mt-0.5 text-sm leading-snug text-red-700/90 dark:text-red-300/90">
                  Cadastro incompleto — o atendimento pode continuar normalmente.
                </p>
              </div>
            </div>
            <Button
              asChild
              size="sm"
              className="w-full shrink-0 bg-red-600 text-white hover:bg-red-700 sm:w-auto dark:bg-red-600 dark:hover:bg-red-500"
            >
              <Link to={`/patients/${patient.id}/edit?complete=1`}>Completar cadastro</Link>
            </Button>
          </div>
        )}
        <PatientDetailHeader
          patientId={id!}
          fullName={formatPatientDisplayName(patient.full_name, copy.isSalon ? patient.nickname : null)}
          profilePhotoUrl={patient.profile_photo_url}
          age={patient.date_of_birth ? calculateAge(patient.date_of_birth) : null}
          sexLabel={getSexLabel(patient.sex)}
          statusLabel={statusLabel}
          consentGiven={!!consent?.consent_given}
          anamneseComplete={anamneseComplete}
          hasTermBotox={signedTermSlugs.includes('consentimento-botox')}
          hasTermPreenchedores={signedTermSlugs.includes('consentimento-preenchedores')}
          showReceituario={showReceituario}
          showDentalPlans={showDentalPlans}
          showTermBotoxTab={showTermBotoxTab}
          showTermPreenchedoresTab={showTermPreenchedoresTab}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          tabsLocked={tabsLocked}
          onTabChangeBlocked={notifyTabChangeBlocked}
          isSalon={copy.isSalon}
          onBack={isDialog ? onRequestClose : undefined}
        />

        <PatientDetailTabPanel className={isDialog ? 'min-h-0 flex-1 overflow-y-auto' : undefined}>
          {activeTab === 'ficha' && (
            <PatientPersonalInfoSection
              patientId={patient.id}
              patient={patient}
              getSexLabel={getSexLabel}
              onPatientUpdated={fetchPatientData}
              onEditingChange={setIsFichaEditing}
            />
          )}

          {activeTab === 'anamnese' && (
            <PatientAnamneseSection
              patientId={patient.id}
              patientName={patient.full_name}
              patientPhone={patient.phone}
              clinicName={profile?.app_name?.trim() || profile?.full_name?.trim() || 'Clínica'}
              anamneseComplete={anamneseComplete}
              onAnamneseUpdated={fetchPatientData}
              onEditingChange={setIsAnamneseEditing}
            />
          )}

          {activeTab === 'exames' && <PatientExamsSection patientId={patient.id} />}

          {activeTab === 'receituario' && showReceituario && (
            <PatientPrescriptionsSection
              patientId={patient.id}
              patientName={patient.full_name}
              patientPhone={patient.phone}
            />
          )}

          {activeTab === 'planos-odontologicos' && showDentalPlans && (
            <PatientDentalPlansSection patientId={patient.id} />
          )}

          {activeTab === 'documentos' && showDentalPlans && (
            <PatientDocumentsSection patientId={patient.id} />
          )}

          {activeTab === 'lgpd' && (
            <PatientLgpdSection
              consent={consent}
              consentText={LGPD_CONSENT_TEXT}
              lgpdSignatureData={lgpdSignatureData}
              savingLgpd={savingLgpd}
              onSignatureSave={setLgpdSignatureData}
              onRegister={() => lgpdSignatureData && handleRegisterLgpdConsent(lgpdSignatureData)}
            />
          )}

          {activeTab === 'termo-botox' && showTermBotoxTab && (
            <PatientTermTabSection
              title="Termo Toxina Botulínica"
              description="Consentimento para aplicação de toxina botulínica"
              signed={signedTermSlugs.includes('consentimento-botox')}
              onSign={() => {
                setTermSlugToSign('consentimento-botox');
                setTermSignatureOpen(true);
              }}
            />
          )}

          {activeTab === 'termo-preenchedores' && showTermPreenchedoresTab && (
            <PatientTermTabSection
              title="Termo Preenchedores"
              description="Consentimento para procedimentos com preenchedores"
              signed={signedTermSlugs.includes('consentimento-preenchedores')}
              onSign={() => {
                setTermSlugToSign('consentimento-preenchedores');
                setTermSignatureOpen(true);
              }}
            />
          )}

          {activeTab === 'procedimentos' && copy.isSalon && (
            <PatientSalonProceduresSection
              patientId={id!}
              patientName={patient.full_name}
              patientPhone={patient.phone}
              professionalId={profile?.id ?? ''}
              patientProfessionalId={patient.professional_id}
              professionalName={profile?.full_name ?? 'Salão'}
              lastSessionDate={lastSessionFormatted}
              totalSessionsCount={patientSessions.length}
              timelineItems={timelineItems}
              formatSessionDate={formatSessionDate}
              deletingTimelineSessionId={deletingTimelineSessionId}
              onDeleteTimelineSession={handleDeleteTimelineSession}
              onBillingUpdated={fetchPatientData}
            />
          )}

          {activeTab === 'procedimentos' && !copy.isSalon && (
            <PatientProceduresSection
              patientId={id!}
              lastSessionDate={lastSessionFormatted}
              activeProceduresCount={activeProceduresCount}
              totalSessionsCount={patientSessions.length}
              procedureInstances={procedureInstances}
              timelineItems={timelineItems}
              sessionCountByInstanceId={sessionCountByInstanceId}
              lastSessionDateByInstanceId={lastSessionDateByInstanceId}
              formatSessionDate={formatSessionDate}
              formatShortDate={formatShortDate}
              deletingTimelineSessionId={deletingTimelineSessionId}
              onProcedureEnded={fetchPatientData}
              onDeleteTimelineSession={handleDeleteTimelineSession}
              onSessionClick={(session) => {
                if (!session.procedureSlug || !session.procedureSessionId || !session.procedureInstanceId) return;
                const qs = new URLSearchParams({
                  procedure: session.procedureSlug,
                  editSessionId: session.procedureSessionId,
                  editInstanceId: session.procedureInstanceId,
                  returnTo: `/patients/${id}`,
                });
                navigate(`/consultation/${id}?${qs.toString()}`);
              }}
            />
          )}

          {activeTab === 'agenda-fixa' && copy.isSalon && (
            <PatientSalonRecurringAgendaSection
              patientId={id!}
              patientName={patient.full_name}
            />
          )}
        </PatientDetailTabPanel>
      </div>

      <TermSignatureDialog
        open={termSignatureOpen}
        onOpenChange={setTermSignatureOpen}
        patientId={patient.id}
        termSlug={termSlugToSign}
        fallbackSignatureData={consent?.signature_data ?? anamneseSignatureData ?? null}
        placeholders={{
          nomePaciente: patient.full_name,
          cpf: patient.cpf ?? undefined,
          profissional: profile?.full_name ?? undefined,
          coren: [profile?.professional_registry_body, profile?.professional_registry_number].filter(Boolean).join(' ') || undefined,
          data: format(new Date(), "d 'de' MMMM yyyy", { locale: ptBR }),
          idade: patient.date_of_birth ? String(calculateAge(patient.date_of_birth)) : undefined,
          telefone: patient.phone ?? undefined,
          cidade: patient.city ?? undefined,
          endereco: patient.address ?? undefined,
        }}
        onSuccess={() => {
          fetchPatientData();
          if (termSlugToSign === 'consentimento-botox') setActiveTab('termo-botox');
          if (termSlugToSign === 'consentimento-preenchedores') setActiveTab('termo-preenchedores');
        }}
      />
    </div>
  );
}
