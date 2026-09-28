import { Navigate } from 'react-router-dom';
import { PageLoading } from '@/components/layout/PageLoading';
import { useBranchOperationalAccess } from '@/hooks/use-branch-operational';

export function BranchOperationalGuard({ children }: { children: React.ReactNode }) {
  const { isBranchMember, isLoading } = useBranchOperationalAccess();

  if (isLoading) return <PageLoading />;
  if (!isBranchMember) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
