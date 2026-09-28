import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getProceduresForProfile } from '@/lib/proceduresForProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/layout/PageLoading';
import { MobileBottomSafeSpacer } from '@/components/layout/mobile';
import { Plus, Loader2, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type ProcedureRow = Database['public']['Tables']['procedures']['Row'];
type InstanceRow = Database['public']['Tables']['procedure_instances']['Row'];

interface InstanceWithPatient extends InstanceRow {
  patients: { full_name: string } | null;
}

export default function ProcedureListPage() {
  const { slug } = useParams<{ slug: string }>();
  const { profile } = useAuth();
  const [procedure, setProcedure] = useState<ProcedureRow | null>(null);
  const [instances, setInstances] = useState<InstanceWithPatient[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProcedure = useCallback(async () => {
    if (!slug || !profile?.id) return;
    const procs = await getProceduresForProfile(profile.id);
    const data = procs.find((p) => p.slug === slug);
    if (!data) {
      setProcedure(null);
      return;
    }
    setProcedure(data as ProcedureRow);
  }, [slug, profile?.id]);

  const loadInstances = useCallback(async () => {
    if (!procedure?.id) return;
    const { data, error } = await supabase
      .from('procedure_instances')
      .select('id, procedure_id, patient_id, professional_id, data_inicio, status, observacoes_gerais, created_at, patients(full_name)')
      .eq('procedure_id', procedure.id)
      .order('data_inicio', { ascending: false });
    if (error) {
      setInstances([]);
      return;
    }
    const withPatient = (data ?? []).map((row) => ({
      ...row,
      patients: Array.isArray((row as { patients: unknown }).patients)
        ? (row as { patients: { full_name: string }[] }).patients[0]
        : (row as { patients: { full_name: string } | null }).patients,
    })) as InstanceWithPatient[];
    setInstances(withPatient);
  }, [procedure?.id]);

  useEffect(() => {
    loadProcedure();
  }, [loadProcedure]);

  useEffect(() => {
    if (procedure) loadInstances();
    else setInstances([]);
  }, [procedure, loadInstances]);

  useEffect(() => {
    if (!procedure && !loading) setLoading(false);
    if (procedure) setLoading(false);
  }, [procedure, loading]);

  const handleSelectPatient = async (patientId: string) => {
    if (!profile?.id || !procedure?.id) return;
    setSelectPatientOpen(false);
    setCreating(true);
    const { data, error } = await supabase
      .from('procedure_instances')
      .insert({
        procedure_id: procedure.id,
        patient_id: patientId,
        professional_id: profile.id,
        data_inicio: new Date().toISOString().slice(0, 10),
        status: 'em_andamento',
      })
      .select('id')
      .single();
    setCreating(false);
    if (error) {
      toast.error('Não foi possível iniciar o procedimento.');
      return;
    }
    toast.success('Procedimento iniciado.');
    navigate(`/procedures/${slug}/${(data as { id: string }).id}`);
  };

  if (!slug) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Procedimento não informado.</p>
      </div>
    );
  }

  if (loading || (!procedure && !instances.length)) {
    return <PageLoading />;
  }

  if (!procedure) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Procedimento não encontrado.</p>
        <Button variant="link" asChild className="mt-2">
          <Link to="/settings">Ir para Configurações → Procedimentos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] md:text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
            {procedure.category}
          </p>
          <h1 className="text-base md:text-2xl font-bold text-foreground tracking-tight break-words line-clamp-2">
            {procedure.name}
          </h1>
          {procedure.description && (
            <p className="text-muted-foreground mt-1 text-sm">{procedure.description}</p>
          )}
        </div>
        <Button asChild className="gap-2 shrink-0 w-full sm:w-auto">
          <Link to={`/procedures/${slug}/start`}>
            <Plus className="w-4 h-4" />
            Iniciar procedimento
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="text-sm md:text-base">Atendimentos</CardTitle>
          <CardDescription className="text-xs">Em andamento ou finalizados para este tipo.</CardDescription>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          {instances.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">
              Nenhum atendimento ainda. Clique em &quot;Iniciar procedimento&quot; para adicionar um paciente.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {instances.map((inst) => (
                <li key={inst.id}>
                  <Link
                    to={`/procedures/${slug}/${inst.id}`}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 py-3 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm md:text-base break-words line-clamp-2">
                        {(inst.patients as { full_name: string } | null)?.full_name ?? 'Paciente'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Início: {format(parseLocalDate(inst.data_inicio), 'dd/MM/yyyy', { locale: ptBR })} ·{' '}
                        {inst.status === 'em_andamento' ? 'Em andamento' : inst.status}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <MobileBottomSafeSpacer />
    </div>
  );
}
