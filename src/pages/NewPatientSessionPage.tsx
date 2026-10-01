import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
import { ArrowLeft, Calendar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isClinicOnlyAccount } from '@/lib/accountType';

interface Procedure {
  id: string;
  name: string;
  slug: string;
}

function normalizeProcedureName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const SOLD_PLAN_STATUSES = ['authorized', 'negotiating'] as const;

export default function NewPatientSessionPage() {
  const { id: patientId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isClinicAccount = isClinicOnlyAccount(profile?.account_type);
  const [patientName, setPatientName] = useState('');
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [observacoes, setObservacoes] = useState('');
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [selectedProcedureIds, setSelectedProcedureIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filteredFromPlans, setFilteredFromPlans] = useState(false);

  useEffect(() => {
    if (!patientId || !profile?.id) return;
    (async () => {
      const { data: p } = await supabase.from('patients').select('full_name').eq('id', patientId).single();
      setPatientName((p as { full_name: string } | null)?.full_name ?? '');

      const procs = (await getProceduresForProfile(profile.id)) as Procedure[];

      if (!isClinicAccount) {
        setFilteredFromPlans(false);
        setProcedures(procs);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data: plans } = await db
        .from('dental_treatment_plans')
        .select('id')
        .eq('patient_id', patientId)
        .in('status', [...SOLD_PLAN_STATUSES]);

      const planIds = ((plans ?? []) as Array<{ id: string }>).map((row) => String(row.id));
      const { data: items } = planIds.length
        ? await db
            .from('dental_plan_items')
            .select('procedure_id, procedure_name')
            .in('treatment_plan_id', planIds)
            .neq('status', 'rejected')
        : { data: [] };

      const planItems = (items ?? []) as Array<{
        procedure_id?: string | null;
        procedure_name?: string | null;
      }>;

      if (planItems.length === 0) {
        setFilteredFromPlans(false);
        setProcedures(procs);
        return;
      }

      const byId = new Set(
        planItems
          .map((row) => (row.procedure_id ? String(row.procedure_id) : ''))
          .filter(Boolean)
      );
      const byName = new Set(
        planItems
          .map((row) => normalizeProcedureName(String(row.procedure_name ?? '')))
          .filter(Boolean)
      );

      const filtered = procs.filter((proc) => {
        if (byId.has(proc.id)) return true;
        return byName.has(normalizeProcedureName(proc.name));
      });

      setFilteredFromPlans(true);
      setProcedures(filtered.length > 0 ? filtered : procs);
      if (filtered.length === 0) {
        setFilteredFromPlans(false);
      }
    })().finally(() => setLoading(false));
  }, [patientId, profile?.id, isClinicAccount]);

  const toggleProcedure = (procedureId: string) => {
    setSelectedProcedureIds((prev) => {
      const next = new Set(prev);
      if (next.has(procedureId)) next.delete(procedureId);
      else next.add(procedureId);
      return next;
    });
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

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link to={`/patients/${patientId}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Nova sessão</p>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            {patientName || 'Paciente'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Marque os procedimentos realizados nesta sessão.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
        <Card>
          <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
            <CardTitle className="flex items-center gap-2 text-sm md:text-base font-semibold">
              <Calendar className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              Data e observações
            </CardTitle>
            <CardDescription className="text-xs">Data da sessão e anotações gerais.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 md:space-y-4 p-3 md:p-6 pt-0">
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
          <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
            <CardTitle className="text-sm md:text-base font-semibold">Procedimentos realizados</CardTitle>
            <CardDescription className="text-xs">
              {filteredFromPlans
                ? 'Exibindo apenas procedimentos dos planos aceitos/vendidos do paciente.'
                : 'Marque os procedimentos feitos nesta sessão.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            {procedures.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum procedimento ativo. Configure em Configurações.</p>
            ) : (
              <ul className="space-y-3">
                {procedures.map((proc) => (
                  <li
                    key={proc.id}
                    className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
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

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button type="button" variant="outline" asChild className="w-full sm:w-auto">
            <Link to={`/patients/${patientId}`}>Cancelar</Link>
          </Button>
          <Button type="submit" disabled={saving || selectedProcedureIds.size === 0} className="gap-2 w-full sm:w-auto">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Salvando...' : 'Registrar sessão'}
          </Button>
        </div>
      </form>
    </div>
  );
}
