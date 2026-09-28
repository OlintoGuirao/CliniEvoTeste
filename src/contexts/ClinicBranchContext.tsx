import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicMaster } from '@/hooks/use-clinic-master';
import { isClinicOnlyAccount } from '@/lib/accountType';
import {
  fetchAccessibleBranches,
  fetchClinicBranchesAdmin,
  fetchMemberBranchId,
  type OrganizationBranch,
} from '@/services/api/clinicBranchesApi';

type ClinicBranchContextValue = {
  isClinicAccount: boolean;
  isMaster: boolean;
  branches: OrganizationBranch[];
  isLoading: boolean;
  /** Master: null = todas as filiais */
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
  /** Filial fixa do profissional/atendente */
  memberBranchId: string | null;
  effectiveBranchId: string | null;
  branchById: Map<string, OrganizationBranch>;
};

const ClinicBranchContext = createContext<ClinicBranchContextValue | undefined>(undefined);

const STORAGE_PREFIX = 'clinic-branch-filter:';

export function ClinicBranchProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const { isMaster, isClinicAccount, isLoading: masterLoading } = useClinicMaster();
  const storageKey = profile?.id ? `${STORAGE_PREFIX}${profile.id}` : null;

  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(null);

  useEffect(() => {
    if (!storageKey || !isMaster) return;
    try {
      const raw = localStorage.getItem(storageKey);
      setSelectedBranchIdState(raw === 'all' || !raw ? null : raw);
    } catch {
      setSelectedBranchIdState(null);
    }
  }, [storageKey, isMaster]);

  const setSelectedBranchId = useCallback(
    (id: string | null) => {
      setSelectedBranchIdState(id);
      if (!storageKey || !isMaster) return;
      try {
        localStorage.setItem(storageKey, id ?? 'all');
      } catch {
        /* ignore */
      }
    },
    [storageKey, isMaster]
  );

  const branchesQuery = useQuery({
    queryKey: ['clinic-branches', profile?.id, isMaster],
    enabled: Boolean(profile?.id && isClinicAccount && !masterLoading),
    queryFn: async () => (isMaster ? fetchClinicBranchesAdmin() : fetchAccessibleBranches()),
    staleTime: 60_000,
  });

  const memberBranchQuery = useQuery({
    queryKey: ['clinic-member-branch', profile?.id],
    enabled: Boolean(profile?.id && isClinicAccount && !isMaster && !masterLoading),
    queryFn: () => fetchMemberBranchId(profile!.id),
    staleTime: 60_000,
  });

  const branches = branchesQuery.data ?? [];
  const memberBranchId = memberBranchQuery.data ?? null;
  const effectiveBranchId = isMaster ? selectedBranchId : memberBranchId;

  const branchById = useMemo(
    () => new Map(branches.map((b) => [b.id, b])),
    [branches]
  );

  const value = useMemo<ClinicBranchContextValue>(
    () => ({
      isClinicAccount,
      isMaster,
      branches,
      isLoading: masterLoading || branchesQuery.isLoading || memberBranchQuery.isLoading,
      selectedBranchId,
      setSelectedBranchId,
      memberBranchId,
      effectiveBranchId,
      branchById,
    }),
    [
      isClinicAccount,
      isMaster,
      branches,
      masterLoading,
      branchesQuery.isLoading,
      memberBranchQuery.isLoading,
      selectedBranchId,
      setSelectedBranchId,
      memberBranchId,
      effectiveBranchId,
      branchById,
    ]
  );

  if (!isClinicAccount) {
    return <>{children}</>;
  }

  return <ClinicBranchContext.Provider value={value}>{children}</ClinicBranchContext.Provider>;
}

export function useClinicBranchContext() {
  const ctx = useContext(ClinicBranchContext);
  const { profile } = useAuth();
  const isClinicAccount = isClinicOnlyAccount(profile?.account_type);

  if (!isClinicAccount) {
    return {
      isClinicAccount: false,
      isMaster: false,
      branches: [] as OrganizationBranch[],
      isLoading: false,
      selectedBranchId: null,
      setSelectedBranchId: () => {},
      memberBranchId: null,
      effectiveBranchId: null,
      branchById: new Map<string, OrganizationBranch>(),
    };
  }

  if (!ctx) {
    throw new Error('useClinicBranchContext must be used within ClinicBranchProvider');
  }
  return ctx;
}

/** Escopo financeiro/WhatsApp: solo inalterado; clínica usa filial. */
export function useClinicBranchScope() {
  const { profile } = useAuth();
  const { isMaster, isClinicAccount, isLoading: masterLoading } = useClinicMaster();
  const branchCtx = useClinicBranchContext();

  const mode: 'solo' | 'master' | 'member' = !isClinicAccount
    ? 'solo'
    : isMaster
      ? 'master'
      : 'member';

  return {
    mode,
    profileId: profile?.id ?? '',
    isClinicAccount,
    isMaster,
    effectiveBranchId: branchCtx.effectiveBranchId,
    branches: branchCtx.branches,
    branchById: branchCtx.branchById,
    selectedBranchId: branchCtx.selectedBranchId,
    setSelectedBranchId: branchCtx.setSelectedBranchId,
    isLoading: masterLoading || branchCtx.isLoading,
  };
}
