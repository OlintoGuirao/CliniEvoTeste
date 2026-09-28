import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Redireciona usuários bloqueados para /conta-bloqueada (exceto se já estiverem lá ou em /auth).
 */
export function BlockedUserGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const path = location.pathname;

  if (loading || !user) return <>{children}</>;
  if (path === '/conta-bloqueada' || path === '/auth' || path.startsWith('/auth/') || path.startsWith('/ver-resumo/') || path === '/r' || path.startsWith('/r/')) {
    return <>{children}</>;
  }
  if (profile?.is_blocked) {
    return <Navigate to="/conta-bloqueada" replace />;
  }
  return <>{children}</>;
}
