import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicMaster } from '@/hooks/use-clinic-master';
import { useClinicBranchScope } from '@/contexts/ClinicBranchContext';
import {
  fetchAccessibleBranches,
  fetchDefaultBranchId,
  type OrganizationBranch,
} from '@/services/api/clinicBranchesApi';

export type BranchBranding = {
  appName: string;
  appDescription: string;
  appLogoUrl: string | null;
  accentColor: string | null;
  /** true quando a identidade vem da filial (não do perfil) */
  fromBranch: boolean;
  branch: OrganizationBranch | null;
  isLoading: boolean;
};

/**
 * Identidade visual efetiva:
 * - profissional único: perfil (inalterado) — RPC não retorna filial
 * - atendente/profissional de filial: nome/cor/logo da unidade
 * - master com filial filtrada: preview da unidade
 */
export function useBranchBranding(): BranchBranding {
  const { profile } = useAuth();
  const { isMaster, isLoading: masterLoading } = useClinicMaster();
  const { effectiveBranchId, branchById, branches } = useClinicBranchScope();

  const memberBranchQuery = useQuery({
    queryKey: ['branch-branding-member', profile?.id],
    // Master não usa; solo: RPC devolve null. Atendente: devolve a filial.
    enabled: Boolean(profile?.id && !isMaster && !masterLoading),
    queryFn: async (): Promise<OrganizationBranch | null> => {
      let branchId: string | null = null;
      try {
        branchId = await fetchDefaultBranchId();
      } catch {
        branchId = null;
      }

      const accessible = await fetchAccessibleBranches().catch(() => [] as OrganizationBranch[]);

      if (!branchId && accessible.length > 0) {
        branchId = accessible[0].id;
      }
      if (!branchId) return null;

      return (
        accessible.find((b) => b.id === branchId) ??
        accessible[0] ??
        null
      );
    },
    staleTime: 30_000,
  });

  return useMemo(() => {
    const profileName = profile?.app_name?.trim() || 'CliniEvo';
    const profileDescription = profile?.app_description?.trim() || 'Gestão de Tratamentos';
    const profileLogo = profile?.app_logo_url?.trim() || null;
    const profileAccent = profile?.accent_color?.trim() || null;

    const empty: BranchBranding = {
      appName: profileName,
      appDescription: profileDescription,
      appLogoUrl: profileLogo,
      accentColor: profileAccent,
      fromBranch: false,
      branch: null,
      isLoading: masterLoading || (!isMaster && memberBranchQuery.isLoading),
    };

    let branch: OrganizationBranch | null = null;

    if (isMaster) {
      branch = effectiveBranchId ? branchById.get(effectiveBranchId) ?? null : null;
    } else {
      branch =
        memberBranchQuery.data ??
        (branches.length === 1 ? branches[0] : null);
    }

    if (!branch) return empty;

    return {
      appName: branch.name?.trim() || profileName,
      appDescription: profileDescription,
      appLogoUrl: branch.logo_url?.trim() || profileLogo,
      accentColor: branch.accent_color?.trim() || profileAccent,
      fromBranch: true,
      branch,
      isLoading: false,
    };
  }, [
    profile?.app_name,
    profile?.app_description,
    profile?.app_logo_url,
    profile?.accent_color,
    isMaster,
    masterLoading,
    effectiveBranchId,
    branchById,
    branches,
    memberBranchQuery.data,
    memberBranchQuery.isLoading,
  ]);
}
