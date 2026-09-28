import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicBranchContext } from '@/contexts/ClinicBranchContext';
import { isClinicOnlyAccount } from '@/lib/accountType';
import {
  DEFAULT_CLINIC_PRICE_TIER,
  formatPriceInput,
  priceForTier,
  type ClinicPriceTier,
  type OrganizationProcedurePrices,
} from '@/lib/clinicPriceTiers';
import { fetchOrganizationProcedurePrices } from '@/services/api/clinicProceduresApi';

/**
 * Preços da clínica com override por filial.
 * Solo: enabled=false, mapa vazio.
 * Resolução: override da filial efetiva → padrão da organização.
 */
export function useOrganizationProcedurePrices() {
  const { profile } = useAuth();
  const { effectiveBranchId, memberBranchId, isMaster } = useClinicBranchContext();
  const isClinicAccount = isClinicOnlyAccount(profile?.account_type);

  /** Filial para preço: membro usa a sua; master usa filtro (ou padrão se "todas"). */
  const priceBranchId = isMaster ? effectiveBranchId : memberBranchId ?? effectiveBranchId;

  const query = useQuery({
    queryKey: ['organization-procedure-prices', profile?.organization_id, profile?.id],
    enabled: Boolean(isClinicAccount && profile?.id),
    queryFn: fetchOrganizationProcedurePrices,
    staleTime: 60_000,
  });

  const byProcedureId = useMemo(() => {
    const map = new Map<string, OrganizationProcedurePrices>();
    const defaults = query.data?.defaults ?? [];
    const overrides = query.data?.branchOverrides ?? [];

    for (const row of defaults) {
      map.set(row.procedure_id, row);
    }

    if (priceBranchId) {
      for (const row of overrides) {
        if (row.branch_id !== priceBranchId) continue;
        map.set(row.procedure_id, {
          procedure_id: row.procedure_id,
          price_oficial: row.price_oficial,
          price_parcerias: row.price_parcerias,
          price_funcionarios: row.price_funcionarios,
          price_particular: row.price_particular,
          price_convenio: row.price_convenio,
        });
      }
    }

    return map;
  }, [query.data, priceBranchId]);

  const getPrice = (procedureId: string, tier: ClinicPriceTier = DEFAULT_CLINIC_PRICE_TIER) =>
    priceForTier(byProcedureId.get(procedureId), tier);

  const getPriceInput = (procedureId: string, tier: ClinicPriceTier = DEFAULT_CLINIC_PRICE_TIER) =>
    formatPriceInput(getPrice(procedureId, tier));

  return {
    isClinicAccount,
    isLoading: isClinicAccount && query.isLoading,
    priceBranchId,
    byProcedureId,
    getPrice,
    getPriceInput,
    refetch: query.refetch,
  };
}
