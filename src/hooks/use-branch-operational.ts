import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useClinicBranchScope } from '@/contexts/ClinicBranchContext';
import { useClinicMaster } from '@/hooks/use-clinic-master';
import {
  completeFollowUp,
  createBranchJourney,
  createJourneyFollowUp,
  fetchBranchFollowUps,
  fetchBranchJourneyById,
  fetchBranchJourneys,
  fetchJourneyEvents,
  fetchJourneyFollowUps,
  transitionBranchJourney,
  updateBranchJourneyFields,
} from '@/services/api/branchOperationalApi';
import type {
  BranchOperationalFilters,
  CreateBranchJourneyInput,
  CreateFollowUpInput,
  TransitionJourneyInput,
} from '@/types/branchOperationalJourney';

export const BRANCH_OPERATIONAL_QUERY_KEY = 'branch-operational';

export function useBranchOperationalAccess() {
  const { isClinicAccount, isMaster, isLoading: masterLoading } = useClinicMaster();
  const scope = useClinicBranchScope();
  const isBranchMember = isClinicAccount && !isMaster && Boolean(scope.effectiveBranchId);
  return {
    isBranchMember,
    isLoading: masterLoading || scope.isLoading,
    branchId: scope.effectiveBranchId,
    profileId: scope.profileId,
  };
}

export function useBranchOperationalPipeline(filters: BranchOperationalFilters = {}) {
  const { branchId, isBranchMember } = useBranchOperationalAccess();
  return useQuery({
    queryKey: [BRANCH_OPERATIONAL_QUERY_KEY, 'pipeline', branchId, filters],
    enabled: isBranchMember && Boolean(branchId),
    queryFn: () => fetchBranchJourneys(branchId!, filters),
    staleTime: 30_000,
  });
}

export function useBranchOperationalCase(journeyId: string | undefined) {
  const { isBranchMember } = useBranchOperationalAccess();
  return useQuery({
    queryKey: [BRANCH_OPERATIONAL_QUERY_KEY, 'case', journeyId],
    enabled: isBranchMember && Boolean(journeyId),
    queryFn: () => fetchBranchJourneyById(journeyId!),
  });
}

export function useBranchJourneyEvents(journeyId: string | undefined) {
  const { isBranchMember } = useBranchOperationalAccess();
  return useQuery({
    queryKey: [BRANCH_OPERATIONAL_QUERY_KEY, 'events', journeyId],
    enabled: isBranchMember && Boolean(journeyId),
    queryFn: () => fetchJourneyEvents(journeyId!),
  });
}

export function useBranchJourneyFollowUps(journeyId: string | undefined) {
  const { isBranchMember } = useBranchOperationalAccess();
  return useQuery({
    queryKey: [BRANCH_OPERATIONAL_QUERY_KEY, 'follow-ups', journeyId],
    enabled: isBranchMember && Boolean(journeyId),
    queryFn: () => fetchJourneyFollowUps(journeyId!),
  });
}

export function useBranchPendingFollowUps() {
  const { branchId, isBranchMember } = useBranchOperationalAccess();
  return useQuery({
    queryKey: [BRANCH_OPERATIONAL_QUERY_KEY, 'branch-follow-ups', branchId],
    enabled: isBranchMember && Boolean(branchId),
    queryFn: () => fetchBranchFollowUps(branchId!),
    staleTime: 60_000,
  });
}

export function useBranchOperationalMutations() {
  const queryClient = useQueryClient();
  const { branchId } = useBranchOperationalAccess();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: [BRANCH_OPERATIONAL_QUERY_KEY] });
  };

  const createJourney = useMutation({
    mutationFn: (input: CreateBranchJourneyInput) => createBranchJourney(branchId, input),
    onSuccess: invalidate,
  });

  const transition = useMutation({
    mutationFn: (input: TransitionJourneyInput) => transitionBranchJourney(input),
    onSuccess: invalidate,
  });

  const patchJourney = useMutation({
    mutationFn: ({
      journeyId,
      patch,
    }: {
      journeyId: string;
      patch: Parameters<typeof updateBranchJourneyFields>[1];
    }) => updateBranchJourneyFields(journeyId, patch),
    onSuccess: invalidate,
  });

  const createFollowUp = useMutation({
    mutationFn: (input: CreateFollowUpInput) => createJourneyFollowUp(input),
    onSuccess: invalidate,
  });

  const completeFollowUpMutation = useMutation({
    mutationFn: (followUpId: string) => completeFollowUp(followUpId),
    onSuccess: invalidate,
  });

  return {
    createJourney,
    transition,
    patchJourney,
    createFollowUp,
    completeFollowUp: completeFollowUpMutation,
  };
}
