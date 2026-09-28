import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { getProceduresForProfile } from '@/lib/proceduresForProfile';
import { fetchSalonProcedures } from '@/services/api/salonProceduresApi';
import { fetchClinicTeam } from '@/services/api/clinicTeamApi';
import { useSalonAccount } from '@/hooks/use-salon-account';
import { salonStaffRoleLabel } from '@/lib/salonTeamRoles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Wallet } from 'lucide-react';
import { FiltroPeriodo, type FiltroPeriodoValue } from '@/components/faturamento/FiltroPeriodo';
import { ResumoCards } from '@/components/faturamento/ResumoCards';
import { FiltrosAvancados } from '@/components/faturamento/FiltrosAvancados';
import { ListaRecebimentos } from '@/components/faturamento/ListaRecebimentos';
import { ListaPagamentosProgramaBotox } from '@/components/faturamento/ListaPagamentosProgramaBotox';
import { MobileBottomSafeSpacer } from '@/components/layout/mobile';
import { useFaturamento } from '@/hooks/use-faturamento';
import { useUiCopy } from '@/hooks/use-ui-copy';
import type { FaturamentoFiltros } from '@/types/faturamento';
import { proceduresForFaturamentoKey } from '@/api/queryKeys';
import { BranchFilterSelect } from '@/components/clinic/BranchFilterSelect';
import { useClinicBranchScope } from '@/contexts/ClinicBranchContext';
import { cn } from '@/lib/utils';

function getDefaultPeriod(): FiltroPeriodoValue {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { preset: 'mes', dataInicio: start, dataFim: end };
}

export default function Faturamento() {
  const { profile } = useAuth();
  const copy = useUiCopy();
  const { isSalonAdmin } = useSalonAccount();
  const { isMaster, mode } = useClinicBranchScope();
  const [periodo, setPeriodo] = useState<FiltroPeriodoValue>(getDefaultPeriod);
  const [avancados, setAvancados] = useState<Pick<
    FaturamentoFiltros,
    'procedimentoId' | 'formaPagamento' | 'status' | 'profissionalId'
  >>({
    procedimentoId: null,
    formaPagamento: null,
    status: null,
    profissionalId: null,
  });

  const filtros: FaturamentoFiltros = useMemo(
    () => ({
      dataInicio: periodo.dataInicio,
      dataFim: periodo.dataFim,
      ...avancados,
    }),
    [periodo, avancados]
  );

  const { list, botoxList, resumo, isLoading } = useFaturamento(filtros);

  const { data: procedures = [] } = useQuery({
    queryKey: [...proceduresForFaturamentoKey(profile?.id ?? ''), copy.isSalon],
    enabled: !!profile?.id,
    queryFn: async () => {
      if (copy.isSalon) {
        const data = await fetchSalonProcedures();
        return data
          .filter((p) => p.is_active)
          .map((p) => ({ id: p.id, name: p.name }));
      }
      const data = await getProceduresForProfile(profile!.id);
      return data.map((p) => ({ id: p.id, name: p.name }));
    },
  });

  const teamQuery = useQuery({
    queryKey: ['clinic-team-faturamento-page', profile?.id],
    enabled: Boolean(copy.isSalon && isSalonAdmin && profile?.id),
    queryFn: fetchClinicTeam,
    staleTime: 60_000,
  });

  const salonProfessionals = useMemo(() => {
    if (!copy.isSalon || !profile?.id) return [];
    if (isSalonAdmin && teamQuery.data?.members) {
      return teamQuery.data.members
        .filter((m) => !m.is_blocked && m.role !== 'attendant')
        .map((m) => ({
          id: m.user_id,
          name: m.full_name?.trim() || m.email,
          subtitle: salonStaffRoleLabel(m.staff_title),
        }));
    }
    return [
      {
        id: profile.id,
        name: profile.full_name?.trim() || 'Você',
        subtitle: null as string | null,
      },
    ];
  }, [copy.isSalon, isSalonAdmin, teamQuery.data, profile?.id, profile?.full_name]);

  return (
    <div className={cn('space-y-4 md:space-y-6 animate-fade-in')}>
      <PageBreadcrumb
        segments={[
          { label: 'Início', path: '/dashboard' },
          { label: 'Faturamento' },
        ]}
        className="mb-1 hidden md:block"
      />
      <div className="flex flex-col gap-1">
        <h1 className="text-base md:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <Wallet className="w-5 h-5 md:w-7 md:h-7 text-primary" />
          Faturamento
        </h1>
        <p className="text-muted-foreground text-xs md:text-sm">
          Valores faturados no período.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-1.5 md:pb-2 p-3 md:p-6">
          <CardTitle className="text-sm md:text-base">Filtro de período</CardTitle>
          <CardDescription className="text-xs">Todas as consultas respeitam o período.</CardDescription>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0 space-y-3">
          <FiltroPeriodo value={periodo} onChange={setPeriodo} />
          {mode === 'master' && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">
                {isMaster ? 'Visão consolidada da clínica' : 'Filial'}
              </p>
              <BranchFilterSelect />
            </div>
          )}
        </CardContent>
      </Card>

      <ResumoCards resumo={resumo} />

      <Card>
        <CardHeader className="pb-1.5 md:pb-2 p-3 md:p-6">
          <CardTitle className="text-sm md:text-base">Filtros avançados</CardTitle>
          <CardDescription>
            {copy.isSalon
              ? 'Procedimento, forma de pagamento e profissional (opcionais).'
              : 'Procedimento, forma de pagamento e status (opcionais).'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          <FiltrosAvancados
            filtros={filtros}
            onChange={(f) =>
              setAvancados({
                procedimentoId: f.procedimentoId ?? null,
                formaPagamento: f.formaPagamento ?? null,
                status: f.status ?? null,
                profissionalId: f.profissionalId ?? null,
              })
            }
            procedures={procedures}
            professionals={salonProfessionals.map((p) => ({ id: p.id, name: p.name }))}
            isSalon={copy.isSalon}
          />
        </CardContent>
      </Card>

      <ListaRecebimentos list={list} isLoading={isLoading} />
      {!copy.isSalon ? <ListaPagamentosProgramaBotox list={botoxList} isLoading={isLoading} /> : null}
      <MobileBottomSafeSpacer />
    </div>
  );
}
