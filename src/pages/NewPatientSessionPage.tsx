import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getProceduresForProfile } from '@/lib/proceduresForProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { PageLoading } from '@/components/layout/PageLoading';
import { ClinicAuthorizedProcedureCards } from '@/components/clinic/ClinicAuthorizedProcedureCards';
import { ArrowLeft, Calendar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isClinicOnlyAccount } from '@/lib/accountType';
import {
  listClinicAuthorizedProceduresForPatient,
  type ClinicAuthorizedProcedureCard,
} from '@/services/api/clinicAuthorizedProceduresApi';
import { findOpenClinicProcedureSession } from '@/services/api/clinicProcedureSessionsApi';

interface Procedure {
  id: string;
  name: string;
  slug: string;
}

export default function NewPatientSessionPage() {
  const { id: patientId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isClinicAccount = isClinicOnlyAccount(profile?.account_type);
  const appointmentId = searchParams.get('appointmentId');
  const returnTo = searchParams.get('returnTo') || (appointmentId ? '/agenda' : `/patients/${patientId}`);

  const [patientName, setPatientName] = useState('');
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [observacoes, setObservacoes] = useState('');
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [selectedProcedureIds, setSelectedProcedureIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clinicCards, setClinicCards] = useState<ClinicAuthorizedProcedureCard[]>([]);
  const [professionalNames, setProfessionalNames] = useState<Record<string, string>>({});
  const [selectingPlanItemId, setSelectingPlanItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId || !profile?.id) return;
    (async () => {
      const { data: p } = await supabase.from('patients').select('full_name').eq('id', patientId).single();
      setPatientName((p as { full_name: string } | null)?.full_name ?? '');

      if (isClinicAccount) {
        try {
          const cards = await listClinicAuthorizedProceduresForPatient(patientId);
          setClinicCards(cards);
          const ids = [...new Set(cards.map((c) => c.responsibleProfessionalId).filter(Boolean))];
          if (ids.length) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', ids);
            const map: Record<string, string> = {};
            for (const row of (profiles ?? []) as Array<{ id: string; full_name: string | null }>) {
              map[row.id] = row.full_name?.trim() || 'Profissional';
            }
            setProfessionalNames(map);
          }
        } catch (e) {
          console.error(e);
          toast.error('Não foi possível carregar os procedimentos autorizados.');
        } finally {
          setLoading(false);
        }
        return;
      }

      const procs = (await getProceduresForProfile(profile.id)) as Procedure[];
      setProcedures(procs);
      setLoading(false);
    })();
  }, [patientId, profile?.id, isClinicAccount]);

  const toggleProcedure = (procedureId: string) => {
    setSelectedProcedureIds((prev) => {
      const next = new Set(prev);
      if (next.has(procedureId)) next.delete(procedureId);
      else next.add(procedureId);
      return next;
    });
  };

  const openClinicAttendance = async (card: ClinicAuthorizedProcedureCard) => {
    if (!patientId) return;
    if (card.uiStatus === 'finished' || card.uiStatus === 'cancelled') {
      toast.error('Este procedimento não está disponível para novo atendimento.');
      return;
    }
    setSelectingPlanItemId(card.planItemId);
    try {
      const open = card.openSessionId
        ? { id: card.openSessionId }
        : await findOpenClinicProcedureSession({
            patientId,
            planItemId: card.planItemId,
          });

      const qs = new URLSearchParams();
      if (appointmentId) qs.set('appointmentId', appointmentId);
      if (returnTo) qs.set('returnTo', returnTo);

      if (open?.id) {
        navigate(`/patients/${patientId}/clinic-attendance/${open.id}?${qs.toString()}`);
        return;
      }

      qs.set('planItemId', card.planItemId);
      navigate(`/patients/${patientId}/clinic-attendance/new?${qs.toString()}`);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível abrir o atendimento.');
    } finally {
      setSelectingPlanItemId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !profile?.id) return;
    if (selectedProcedureIds.size === 0) {
      toast.error('Marque ao menos um procedimento realizado.');
      return;
    }
    setSaving(true);
    try {
      const { data: patientSession, error: psError } = await supabase
        .from('patient_sessions')
        .insert({
          patient_id: patientId,
          professional_id: profile.id,
          session_date: sessionDate,
          observacoes: observacoes.trim() || null,
        })
        .select('id')
        .single();

      if (psError) throw psError;
      const psId = (patientSession as { id: string }).id;

      for (const procedureId of selectedProcedureIds) {
        const { data: existing } = await supabase
          .from('procedure_instances')
          .select('id')
          .eq('patient_id', patientId)
          .eq('procedure_id', procedureId)
          .maybeSingle();

        let instanceId: string;
        if (existing?.id) {
          instanceId = (existing as { id: string }).id;
        } else {
          const { data: newInst, error: instErr } = await supabase
            .from('procedure_instances')
            .insert({
              procedure_id: procedureId,
              patient_id: patientId,
              professional_id: profile.id,
              data_inicio: sessionDate,
              status: 'em_andamento',
            })
            .select('id')
            .single();
          if (instErr) throw instErr;
          instanceId = (newInst as { id: string }).id;
        }

        await supabase.from('procedure_sessions').insert({
          procedure_instance_id: instanceId,
          patient_session_id: psId,
          session_date: sessionDate,
          data: {},
        });
      }

      toast.success('Sessão registrada com sucesso.');
      navigate(`/patients/${patientId}`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar sessão.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoading />;
  }

  if (isClinicAccount) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 animate-fade-in">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link to={returnTo}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Novo atendimento
            </p>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {patientName || 'Paciente'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecione um procedimento autorizado/vendido no plano de tratamento.
            </p>
          </div>
        </div>

        <ClinicAuthorizedProcedureCards
          cards={clinicCards}
          professionalNameById={professionalNames}
          onSelect={(card) => void openClinicAttendance(card)}
          selectingPlanItemId={selectingPlanItemId}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link to={`/patients/${patientId}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Nova sessão</p>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {patientName || 'Paciente'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Marque os procedimentos realizados nesta sessão.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
        <Card>
          <CardHeader className="p-3 pb-2 md:p-6 md:pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold md:text-base">
              <Calendar className="h-4 w-4 text-primary md:h-5 md:w-5" />
              Data e observações
            </CardTitle>
            <CardDescription className="text-xs">Data da sessão e anotações gerais.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-3 pt-0 md:space-y-4 md:p-6">
            <div className="space-y-2">
              <Label>Data da sessão</Label>
              <Input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                placeholder="Anotações sobre esta sessão..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-2 md:p-6 md:pb-3">
            <CardTitle className="text-sm font-semibold md:text-base">Procedimentos realizados</CardTitle>
            <CardDescription className="text-xs">
              Marque os procedimentos feitos nesta sessão.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6">
            {procedures.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum procedimento ativo. Configure em Configurações.
              </p>
            ) : (
              <ul className="space-y-3">
                {procedures.map((proc) => (
                  <li
                    key={proc.id}
                    className="flex items-center space-x-3 rounded-lg border p-3 transition-colors hover:bg-muted/30"
                  >
                    <Checkbox
                      id={proc.id}
                      checked={selectedProcedureIds.has(proc.id)}
                      onCheckedChange={() => toggleProcedure(proc.id)}
                    />
                    <label htmlFor={proc.id} className="flex-1 cursor-pointer text-sm font-medium">
                      {proc.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" asChild className="w-full sm:w-auto">
            <Link to={`/patients/${patientId}`}>Cancelar</Link>
          </Button>
          <Button
            type="submit"
            disabled={saving || selectedProcedureIds.size === 0}
            className="w-full gap-2 sm:w-auto"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? 'Salvando...' : 'Registrar sessão'}
          </Button>
        </div>
      </form>
    </div>
  );
}
