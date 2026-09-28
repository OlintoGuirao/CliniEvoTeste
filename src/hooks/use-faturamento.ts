import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicBranchScope } from '@/contexts/ClinicBranchContext';
import { useUiCopy } from '@/hooks/use-ui-copy';
import { useSalonAccount } from '@/hooks/use-salon-account';
import { supabase } from '@/integrations/supabase/client';
import { backfillSalonRecebimentosForProfessional } from '@/lib/salonRecebimentos';
import { fetchClinicTeam } from '@/services/api/clinicTeamApi';
import type {
  RecebimentoComNomes,
  FaturamentoFiltros,
  FaturamentoResumo,
  RecebimentoStatus,
  FormaPagamento,
} from '@/types/faturamento';

const FATURAMENTO_QUERY_KEY = 'faturamento';

export interface PagamentoProgramaBotox {
  id: string;
  valor: number;
  data_pagamento: string;
  paciente_nome: string | null;
}

function mapRowToRecebimentoComNomes(row: {
  id: string;
  cliente_id: string;
  profissional_id: string;
  procedimento_id: string | null;
  salon_procedure_id?: string | null;
  valor_total: number;
  valor_recebido: number;
  forma_pagamento: string;
  status: string;
  data: string;
  created_at: string;
  patients?: { full_name: string | null } | null;
  procedures?: { name: string | null } | null;
  salon_procedures?: { name: string | null } | null;
}): RecebimentoComNomes {
  return {
    id: row.id,
    cliente_id: row.cliente_id,
    profissional_id: row.profissional_id,
    procedimento_id: row.procedimento_id,
    salon_procedure_id: row.salon_procedure_id ?? null,
    valor_total: Number(row.valor_total),
    valor_recebido: Number(row.valor_recebido),
    forma_pagamento: row.forma_pagamento as FormaPagamento,
    status: row.status as RecebimentoStatus,
    data: row.data,
    created_at: row.created_at,
    cliente_nome: row.patients?.full_name ?? null,
    procedimento_nome: row.procedures?.name ?? null,
  };
}

async function attachSalonProcedureNames(
  list: RecebimentoComNomes[]
): Promise<RecebimentoComNomes[]> {
  const salonIds = [
    ...new Set(list.map((r) => r.salon_procedure_id).filter(Boolean) as string[]),
  ];
  if (salonIds.length === 0) return list;

  const { data } = await supabase.from('salon_procedures').select('id, name').in('id', salonIds);
  const nameById = new Map((data ?? []).map((p) => [p.id, p.name]));
  return list.map((r) =>
    r.salon_procedure_id && !r.procedimento_nome
      ? { ...r, procedimento_nome: nameById.get(r.salon_procedure_id) ?? 'Procedimento do salão' }
      : r
  );
}

function buildRecebimentosQuery(
  scope: { mode: 'solo' | 'master' | 'member'; profileId: string; branchId: string | null },
  filtros: FaturamentoFiltros,
  options?: { isSalon?: boolean; isSalonAdmin?: boolean; salonTeamIds?: string[] }
) {
  let q = supabase
    .from('recebimentos')
    .select(
      'id, cliente_id, profissional_id, procedimento_id, salon_procedure_id, valor_total, valor_recebido, forma_pagamento, status, data, created_at, branch_id, patients(full_name), procedures(name)'
    )
    .gte('data', `${filtros.dataInicio}T00:00:00`)
    .lte('data', `${filtros.dataFim}T23:59:59.999`)
    .order('data', { ascending: false });

  if (scope.mode === 'master') {
    if (scope.branchId) {
      q = q.eq('branch_id', scope.branchId);
    }
  } else if (options?.isSalon && options?.isSalonAdmin) {
    if (filtros.profissionalId) {
      q = q.eq('profissional_id', filtros.profissionalId);
    } else if (options.salonTeamIds?.length) {
      q = q.in('profissional_id', options.salonTeamIds);
    }
  } else {
    q = q.eq('profissional_id', scope.profileId);
    if (scope.branchId) {
      q = q.eq('branch_id', scope.branchId);
    }
  }

  if (filtros.procedimentoId) {
    if (options?.isSalon) {
      q = q.eq('salon_procedure_id', filtros.procedimentoId);
    } else {
      q = q.eq('procedimento_id', filtros.procedimentoId);
    }
  }
  if (filtros.formaPagamento) {
    q = q.eq('forma_pagamento', filtros.formaPagamento);
  }
  if (filtros.status && !options?.isSalon) {
    q = q.eq('status', filtros.status);
  }
  return q;
}

async function fetchBotoxPayments(
  scope: { mode: 'solo' | 'master' | 'member'; profileId: string },
  filtros: FaturamentoFiltros
): Promise<PagamentoProgramaBotox[]> {
  const db = supabase as unknown as { from: (t: string) => any };
  let progQuery = db.from('programas_botox').select('id, professional_id, patients(full_name)');

  if (scope.mode !== 'master') {
    progQuery = progQuery.eq('professional_id', scope.profileId);
  }

  const { data: progData, error: progError } = await progQuery;
  if (progError) throw progError;

  const progRows = (progData ?? []) as {
    id: string;
    professional_id?: string;
    patients?: { full_name: string | null } | null;
  }[];
  const programaIds = progRows.map((p) => p.id);
  const programaIdToName = new Map(
    progRows.map((p) => [p.id, p.patients?.full_name ?? null])
  );

  if (!programaIds.length) return [];

  const { data: botoxData, error: botoxError } = await db
    .from('pagamentos')
    .select('id, programa_id, valor, data_pagamento')
    .in('programa_id', programaIds)
    .gte('data_pagamento', `${filtros.dataInicio}T00:00:00`)
    .lte('data_pagamento', `${filtros.dataFim}T23:59:59.999`)
    .order('data_pagamento', { ascending: false });

  if (botoxError) throw botoxError;

  return ((botoxData ?? []) as any[]).map((r: any) => ({
    id: r.id,
    valor: Number(r.valor ?? 0),
    data_pagamento: r.data_pagamento,
    paciente_nome: programaIdToName.get(r.programa_id) ?? null,
  }));
}

export function useFaturamento(filtros: FaturamentoFiltros) {
  const { profile } = useAuth();
  const copy = useUiCopy();
  const { isSalonAdmin } = useSalonAccount();
  const { mode, profileId, effectiveBranchId } = useClinicBranchScope();
  const profissionalId = profile?.id ?? '';

  const teamQuery = useQuery({
    queryKey: ['clinic-team-faturamento', profissionalId],
    enabled: Boolean(copy.isSalon && isSalonAdmin && profissionalId),
    queryFn: fetchClinicTeam,
    staleTime: 60_000,
  });

  const salonTeamIds = useMemo(() => {
    if (!copy.isSalon || !profissionalId) return [] as string[];
    if (isSalonAdmin && teamQuery.data?.members) {
      const ids = teamQuery.data.members
        .filter((m) => !m.is_blocked && m.role !== 'attendant')
        .map((m) => m.user_id);
      return ids.length > 0 ? ids : [profissionalId];
    }
    return [profissionalId];
  }, [copy.isSalon, isSalonAdmin, teamQuery.data, profissionalId]);

  const query = useQuery({
    queryKey: [
      FATURAMENTO_QUERY_KEY,
      profissionalId,
      mode,
      effectiveBranchId,
      filtros,
      copy.isSalon,
      isSalonAdmin,
      salonTeamIds,
    ],
    enabled: !!profissionalId && !!filtros.dataInicio && !!filtros.dataFim,
    queryFn: async (): Promise<{ list: RecebimentoComNomes[]; botoxList: PagamentoProgramaBotox[]; resumo: FaturamentoResumo }> => {
      if (copy.isSalon && profissionalId) {
        const backfillIds =
          copy.isSalon && isSalonAdmin && salonTeamIds.length > 0 ? salonTeamIds : [profissionalId];
        await Promise.all(backfillIds.map((id) => backfillSalonRecebimentosForProfessional(id)));
      }

      const scope = {
        mode,
        profileId: profileId || profissionalId,
        branchId: effectiveBranchId,
      };

      const { data, error } = await buildRecebimentosQuery(scope, filtros, {
        isSalon: copy.isSalon,
        isSalonAdmin,
        salonTeamIds,
      });
      if (error) throw error;

      const rows = (data ?? []) as Parameters<typeof mapRowToRecebimentoComNomes>[0][];
      const listWithNames = await attachSalonProcedureNames(rows.map(mapRowToRecebimentoComNomes));
      const list = listWithNames;

      // Agrupar múltiplos procedimentos de uma mesma consulta:
      // Quando a consulta teve 2+ procedimentos, gravamos 1 recebimento com valor e os demais com valor 0.
      // Aqui, agrupamos por (cliente_id + data + forma_pagamento + status) e exibimos como "Consulta — Proc1 · Proc2".
      const grouped = (() => {
        const byKey = new Map<
          string,
          {
            base: RecebimentoComNomes;
            procedimentos: string[];
            hasAnyZero: boolean;
          }
        >();
        const order: string[] = [];
        for (const r of list) {
          const key = `${r.cliente_id}|${r.data}|${r.forma_pagamento}|${r.status}`;
          const name = r.procedimento_nome ?? '—';
          const existing = byKey.get(key);
          if (!existing) {
            byKey.set(key, {
              base: r,
              procedimentos: [name],
              hasAnyZero: r.valor_total === 0,
            });
            order.push(key);
          } else {
            existing.procedimentos.push(name);
            existing.hasAnyZero = existing.hasAnyZero || r.valor_total === 0;
            // Preferir como "base" o item com valor > 0 (para id/valor exibidos)
            if (existing.base.valor_total === 0 && r.valor_total > 0) {
              existing.base = r;
            }
          }
        }
        const out: RecebimentoComNomes[] = [];
        for (const key of order) {
          const g = byKey.get(key);
          if (!g) continue;
          const procedimentos = Array.from(new Set(g.procedimentos)).filter(Boolean);
          const isMulti = procedimentos.length > 1 && g.hasAnyZero;
          if (!isMulti) {
            out.push(g.base);
            continue;
          }
          out.push({
            ...g.base,
            procedimento_nome: `Consulta — ${procedimentos.join(' · ')}`,
          });
        }
        return out;
      })();

      const botoxList = copy.isSalon ? [] : await fetchBotoxPayments(scope, filtros);

      let faturamentoTotal = 0;
      let totalRecebido = 0;
      let totalAReceber = 0;

      list.forEach((r) => {
        faturamentoTotal += r.valor_total;
        totalRecebido += r.valor_recebido;
        if (r.status === 'pago') {
          totalAReceber += 0;
        } else {
          totalAReceber += r.valor_total - r.valor_recebido;
        }
      });

      botoxList.forEach((p) => {
        faturamentoTotal += p.valor;
        totalRecebido += p.valor;
      });

      const resumo: FaturamentoResumo = {
        faturamentoTotal,
        totalRecebido,
        totalAReceber,
        quantidadeAtendimentos: grouped.length + botoxList.length,
      };

      return { list: grouped, botoxList, resumo };
    },
  });

  return {
    list: query.data?.list ?? [],
    botoxList: query.data?.botoxList ?? [],
    resumo: query.data?.resumo ?? {
      faturamentoTotal: 0,
      totalRecebido: 0,
      totalAReceber: 0,
      quantidadeAtendimentos: 0,
    },
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
