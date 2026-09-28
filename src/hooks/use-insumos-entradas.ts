import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicBranchScope } from '@/contexts/ClinicBranchContext';
import { useSalonAccount } from '@/hooks/use-salon-account';
import { isSalonAccount } from '@/lib/accountType';
import { fetchClinicTeam } from '@/services/api/clinicTeamApi';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export const INSUMOS_ENTRADAS_QUERY_KEY = 'insumos-entradas-nf';

export type InsumoEntradaRow = Database['public']['Tables']['insumo_entradas_nf']['Row'];

export interface InsumosEntradasFiltros {
  dataInicio: string;
  dataFim: string;
}

export interface InsumosEntradasResumo {
  totalGasto: number;
  totalQuantidade: number;
  numLancamentos: number;
}

function buildQuery(
  scope: {
    mode: 'solo' | 'master' | 'member';
    profileId: string;
    branchId: string | null;
    salonTeamIds?: string[];
  },
  filtros: InsumosEntradasFiltros
) {
  let q = supabase
    .from('insumo_entradas_nf')
    .select('*')
    .gte('data_compra', filtros.dataInicio)
    .lte('data_compra', filtros.dataFim)
    .order('data_compra', { ascending: false })
    .order('created_at', { ascending: false });

  if (scope.salonTeamIds && scope.salonTeamIds.length > 0) {
    q =
      scope.salonTeamIds.length === 1
        ? q.eq('professional_id', scope.salonTeamIds[0]!)
        : q.in('professional_id', scope.salonTeamIds);
  } else if (scope.mode === 'master') {
    if (scope.branchId) q = q.eq('branch_id', scope.branchId);
  } else {
    q = q.eq('professional_id', scope.profileId);
    if (scope.branchId) q = q.eq('branch_id', scope.branchId);
  }

  return q;
}

export function useInsumosEntradas(filtros: InsumosEntradasFiltros) {
  const { profile } = useAuth();
  const { mode, profileId, effectiveBranchId } = useClinicBranchScope();
  const { isSalonAdmin } = useSalonAccount();
  const isSalon = isSalonAccount(profile?.account_type);
  const professionalId = profile?.id ?? '';

  const teamQuery = useQuery({
    queryKey: ['clinic-team-insumos', professionalId],
    enabled: Boolean(isSalon && isSalonAdmin && professionalId),
    queryFn: fetchClinicTeam,
    staleTime: 60_000,
  });

  const salonTeamIds = useMemo(() => {
    if (!isSalon || !professionalId) return undefined;
    if (isSalonAdmin && teamQuery.data?.members) {
      const ids = teamQuery.data.members
        .filter((m) => !m.is_blocked)
        .map((m) => m.user_id);
      return ids.length > 0 ? ids : [professionalId];
    }
    return [professionalId];
  }, [isSalon, isSalonAdmin, teamQuery.data, professionalId]);

  const query = useQuery({
    queryKey: [
      INSUMOS_ENTRADAS_QUERY_KEY,
      professionalId,
      mode,
      effectiveBranchId,
      filtros,
      isSalon,
      salonTeamIds,
    ],
    enabled: !!professionalId && !!filtros.dataInicio && !!filtros.dataFim,
    queryFn: async (): Promise<InsumoEntradaRow[]> => {
      const { data, error } = await buildQuery(
        {
          mode,
          profileId: profileId || professionalId,
          branchId: effectiveBranchId,
          salonTeamIds: isSalon ? salonTeamIds : undefined,
        },
        filtros
      );
      if (error) throw error;
      return (data ?? []) as InsumoEntradaRow[];
    },
  });

  const list = query.data ?? [];
  const resumo: InsumosEntradasResumo = {
    totalGasto: list.reduce((acc, r) => acc + Number(r.valor_total), 0),
    totalQuantidade: list.reduce((acc, r) => acc + Number(r.quantidade), 0),
    numLancamentos: list.length,
  };

  return {
    list,
    resumo,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useInsumoEntradaMutations() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: [INSUMOS_ENTRADAS_QUERY_KEY] });
  };

  const insert = useMutation({
    mutationFn: async (payload: Database['public']['Tables']['insumo_entradas_nf']['Insert']) => {
      const { data, error } = await supabase.from('insumo_entradas_nf').insert(payload).select('id').single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Database['public']['Tables']['insumo_entradas_nf']['Update'];
    }) => {
      const { error } = await supabase.from('insumo_entradas_nf').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async ({ id, fotoPath }: { id: string; fotoPath: string | null }) => {
      if (fotoPath) {
        await supabase.storage.from('insumos-nf').remove([fotoPath]);
      }
      const { error } = await supabase.from('insumo_entradas_nf').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { insert, update, remove, professionalId: profile?.id ?? '' };
}
