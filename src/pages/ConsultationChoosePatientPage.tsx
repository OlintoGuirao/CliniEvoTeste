import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUiCopy } from '@/hooks/use-ui-copy';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { PageLoading } from '@/components/layout/PageLoading';
import { MobileBottomSafeSpacer } from '@/components/layout/mobile';
import { Search, UserPlus, Loader2, Users, CalendarClock, ArrowLeft } from 'lucide-react';
import { formatPatientDisplayName, patientMatchesSearch } from '@/lib/patientDisplay';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Patient {
  id: string;
  full_name: string;
  nickname?: string | null;
  phone: string | null;
}

interface PreRegAppointment {
  id: string;
  full_name: string | null;
  pre_registration_phone: string | null;
  appointment_date: string;
  start_time: string;
}

export type ConsultationChoosePatientPageProps = {
  procedureSlug?: string;
  returnTo?: string;
  backPath?: string;
  title?: string;
  description?: string;
  breadcrumbLabel?: string;
};

export default function ConsultationChoosePatientPage(props: ConsultationChoosePatientPageProps = {}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const copy = useUiCopy();
  const professionalId = profile?.id ?? user?.id;

  const procedureSlug =
    (props.procedureSlug ?? searchParams.get('procedure') ?? '').trim().toLowerCase() || null;
  const salonProcedureId = (searchParams.get('salonProcedure') ?? '').trim() || null;
  const salonProcedureName = (searchParams.get('salonProcedureName') ?? '').trim() || null;
  const linkedAppointmentId = (searchParams.get('appointmentId') ?? '').trim() || null;
  const returnTo = (props.returnTo ?? searchParams.get('returnTo') ?? '').trim() || null;
  const backPath = (props.backPath ?? returnTo ?? '/dashboard').trim() || '/dashboard';
  const pageTitle = props.title?.trim() || copy.newConsultation;
  const pageDescription =
    props.description?.trim() ||
    (copy.isSalon
      ? 'Busque o cliente e inicie o atendimento'
      : 'Busque o paciente e inicie o atendimento');
  const breadcrumbLabel = props.breadcrumbLabel?.trim() || pageTitle;

  const buildSessionPath = (patientId: string) => {
    const qs = new URLSearchParams();
    if (procedureSlug) qs.set('procedure', procedureSlug);
    if (salonProcedureId) qs.set('salonProcedure', salonProcedureId);
    if (salonProcedureName) qs.set('salonProcedureName', salonProcedureName);
    if (linkedAppointmentId) qs.set('appointmentId', linkedAppointmentId);
    if (returnTo) qs.set('returnTo', returnTo);
    const q = qs.toString();
    return `/consultation/${patientId}${q ? `?${q}` : ''}`;
  };
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [showPreCadastroCard, setShowPreCadastroCard] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [creating, setCreating] = useState(false);
  const [preRegAppointments, setPreRegAppointments] = useState<PreRegAppointment[]>([]);
  const [loadingPreReg, setLoadingPreReg] = useState(false);
  const [startingAppointmentId, setStartingAppointmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!professionalId) return;
    setLoading(true);
    supabase
      .from('patients')
      .select('id, full_name, nickname, phone')
      .eq('professional_id', professionalId)
      .eq('is_active', true)
      .order('full_name')
      .then(({ data, error }) => {
        if (error) toast.error('Erro ao carregar pacientes.');
        else setPatients((data ?? []) as Patient[]);
      })
      .finally(() => setLoading(false));
  }, [professionalId]);

  useEffect(() => {
    if (!professionalId) return;
    setLoadingPreReg(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    supabase
      .from('appointments')
      .select('id, full_name, pre_registration_phone, appointment_date, start_time')
      .eq('professional_id', professionalId)
      .is('patient_id', null)
      .not('full_name', 'is', null)
      .gte('appointment_date', today)
      .order('appointment_date')
      .order('start_time')
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setPreRegAppointments([]);
        } else {
          setPreRegAppointments((data ?? []) as PreRegAppointment[]);
        }
      })
      .finally(() => setLoadingPreReg(false));
  }, [professionalId]);

  const searchNorm = search.trim().toLowerCase();
  const searchDigits = search.trim().replace(/\D/g, '');
  const filtered = searchNorm
    ? patients.filter((p) =>
        copy.isSalon
          ? patientMatchesSearch(p, searchNorm)
          : p.full_name.toLowerCase().includes(searchNorm) ||
            (p.phone && searchDigits.length >= 2 && p.phone.replace(/\D/g, '').includes(searchDigits))
      )
    : patients;

  const handleSelectPatient = (patientId: string) => {
    navigate(buildSessionPath(patientId));
  };

  const handleCreatePreRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPatientName.trim();
    if (!name || !professionalId) {
      toast.error('Informe o nome completo.');
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('patients')
        .insert({
          professional_id: professionalId,
          full_name: name,
        })
        .select('id')
        .single();
      if (error) throw error;
      const id = (data as { id: string }).id;
      toast.success(
        procedureSlug
          ? 'Paciente criado. Preencha a sessão do procedimento.'
          : 'Paciente criado. Preencha a consulta.'
      );
      setShowNewPatient(false);
      setNewPatientName('');
      navigate(buildSessionPath(id));
    } catch {
      toast.error('Erro ao criar paciente.');
    } finally {
      setCreating(false);
    }
  };

  const handleStartFromPreReg = async (appt: PreRegAppointment) => {
    const name = appt.full_name?.trim();
    if (!name || !professionalId) return;
    setStartingAppointmentId(appt.id);
    try {
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .insert({
          professional_id: professionalId,
          full_name: name,
          phone: appt.pre_registration_phone?.trim() || null,
        })
        .select('id')
        .single();
      if (patientError) throw patientError;
      const patientId = (patientData as { id: string }).id;
      await supabase
        .from('appointments')
        .update({ patient_id: patientId })
        .eq('id', appt.id);
      setPreRegAppointments((prev) => prev.filter((a) => a.id !== appt.id));
      toast.success(
        procedureSlug
          ? 'Paciente criado. Iniciando o procedimento.'
          : 'Paciente criado. Iniciando consulta.'
      );
      navigate(buildSessionPath(patientId));
    } catch {
      toast.error('Erro ao criar paciente a partir do agendamento.');
    } finally {
      setStartingAppointmentId(null);
    }
  };

  function formatAppointmentDate(dateStr: string, timeStr: string): string {
    const t = timeStr.length >= 5 ? timeStr.slice(0, 5) : timeStr;
    try {
      const d = parseISO(dateStr);
      if (isToday(d)) return `Hoje às ${t}`;
      if (isTomorrow(d)) return `Amanhã às ${t}`;
      return `${format(d, "EEEE, d 'de' MMM.", { locale: ptBR })} às ${t}`;
    } catch {
      return `${dateStr} às ${t}`;
    }
  }

  const showEmptyState = search.trim() ? filtered.length === 0 : false;

  if (loading) {
    return <PageLoading />;
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto">
      <PageBreadcrumb
        segments={[
          { label: 'Início', path: '/dashboard' },
          ...(returnTo || backPath !== '/dashboard'
            ? [{ label: breadcrumbLabel, path: returnTo || backPath }]
            : []),
          { label: pageTitle },
        ]}
        className="mb-1 hidden md:block"
      />
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="shrink-0 h-11 w-11 md:h-10 md:w-10 rounded-xl min-h-[44px] min-w-[44px] touch-manipulation" asChild>
          <Link to={backPath} title="Voltar">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg md:text-xl font-bold text-foreground tracking-tight">{pageTitle}</h1>
          <p className="text-muted-foreground text-sm hidden md:block">{pageDescription}</p>
        </div>
      </div>

      {/* Busca como foco visual principal — mobile: maior, autoFocus, teclado abre */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12 h-14 md:h-12 rounded-xl text-base border-2 border-border focus-visible:ring-2 focus-visible:ring-primary/20 min-h-[44px] touch-manipulation"
            autoFocus
          />
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden min-h-[200px]">
          {!search.trim() ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground px-4">
              <Search className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-medium">Digite o nome ou telefone do paciente</p>
              <p className="text-xs mt-1">A lista será filtrada em tempo real</p>
            </div>
          ) : showEmptyState ? (
            <div className="p-6 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/70" />
              <p className="text-sm font-medium text-foreground">Nenhum paciente encontrado</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Cadastre rapidamente apenas com o nome e inicie a consulta.</p>
              {!showNewPatient ? (
                <Button
                  type="button"
                  className="gap-2"
                  onClick={() => setShowNewPatient(true)}
                >
                  <UserPlus className="w-4 h-4" />
                  Cadastrar paciente rápido (apenas nome)
                </Button>
              ) : (
                <form onSubmit={handleCreatePreRegistration} className="max-w-sm mx-auto space-y-3 text-left">
                  <Label htmlFor="new-name">Nome completo</Label>
                  <Input
                    id="new-name"
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                    placeholder="Nome do paciente"
                    required
                    className="rounded-xl"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={creating} className="gap-2 flex-1">
                      {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Criar e ir para consulta
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setShowNewPatient(false); setNewPatientName(''); }}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border max-h-[50vh] md:max-h-[320px] overflow-auto">
              {filtered.map((p) => (
                <li key={p.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-start font-normal h-auto min-h-[44px] py-4 md:py-4 px-4 flex flex-col items-start gap-0.5 rounded-none hover:bg-muted/50 active:bg-muted/70 touch-manipulation"
                    onClick={() => handleSelectPatient(p.id)}
                  >
                    <span className="font-medium text-foreground text-base">
                      {copy.isSalon
                        ? formatPatientDisplayName(p.full_name, p.nickname)
                        : p.full_name}
                    </span>
                    {p.phone && <span className="text-xs text-muted-foreground">{p.phone}</span>}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Mobile: botão fixo acima da bottom nav — Cadastrar paciente rápido (mostra o card de pré-cadastro) */}
      <div
        className="md:hidden fixed left-0 right-0 z-[1105] p-3 bg-background/95 backdrop-blur border-t border-border"
        style={{ bottom: 'max(64px, calc(64px + env(safe-area-inset-bottom)))' }}
      >
        <Button
          type="button"
          variant="outline"
          className="w-full h-14 gap-2 rounded-xl font-medium min-h-[44px] touch-manipulation"
          onClick={() => { setShowPreCadastroCard(true); setShowNewPatient(true); }}
        >
          <UserPlus className="w-5 h-5" />
          Cadastrar paciente rápido
        </Button>
      </div>

      {preRegAppointments.length > 0 && (
        <Card>
          <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
            <CardTitle className="text-sm md:text-base flex items-center gap-2">
              <CalendarClock className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              Consultas agendadas (pré-cadastro)
            </CardTitle>
            <CardDescription className="text-xs">
              Só com o nome. Clique em &quot;Iniciar consulta&quot; para criar o cadastro.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <ul className="space-y-2">
              {preRegAppointments.map((appt) => (
                <li
                  key={appt.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border bg-muted/20 p-2.5 md:p-3 sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground text-sm md:text-base break-words line-clamp-2">{appt.full_name ?? 'Sem nome'}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatAppointmentDate(appt.appointment_date, appt.start_time)}
                    </p>
                    {appt.pre_registration_phone && (
                      <p className="text-xs text-muted-foreground break-all">{appt.pre_registration_phone}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0 gap-2"
                    onClick={() => handleStartFromPreReg(appt)}
                    disabled={startingAppointmentId === appt.id}
                  >
                    {startingAppointmentId === appt.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    Iniciar consulta
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {!showPreCadastroCard && (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 rounded-xl h-14 font-medium min-h-[44px] touch-manipulation hidden md:flex"
          onClick={() => { setShowPreCadastroCard(true); setShowNewPatient(true); }}
        >
          <UserPlus className="w-5 h-5" />
          Cadastrar paciente rápido
        </Button>
      )}

      {showPreCadastroCard && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Novo paciente (pré-cadastro)
          </CardTitle>
          <CardDescription>
            Ainda não tem cadastro? Crie com o nome e preencha o restante depois.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showNewPatient ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => setShowNewPatient(true)}
              >
                <UserPlus className="w-4 h-4" />
                Cadastrar apenas com nome
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={() => setShowPreCadastroCard(false)}
              >
                Fechar
              </Button>
            </div>
          ) : (
            <form onSubmit={handleCreatePreRegistration} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-patient-name">Nome completo (obrigatório)</Label>
                <Input
                  id="new-patient-name"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  placeholder="Nome do paciente"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={creating} className="gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Criar e ir para consulta
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowNewPatient(false);
                    setNewPatientName('');
                    setShowPreCadastroCard(false);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
      )}
      <MobileBottomSafeSpacer />
    </div>
  );
}
