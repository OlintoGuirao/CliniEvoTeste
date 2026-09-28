import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { ProgramaBotoxTabela } from '@/components/programa-botox/ProgramaBotoxTabela';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function ProgramaBotox() {
  const { profile } = useAuth();
  const disabled = (profile as any)?.disabled_modules as string[] | undefined;
  const isBlocked = Array.isArray(disabled) && disabled.includes('programa-botox');
  if (isBlocked) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-w-0 space-y-4 md:space-y-6 animate-fade-in">
      <PageBreadcrumb
        segments={[
          { label: 'Início', path: '/dashboard' },
          { label: 'Programa de Botox' },
        ]}
        className="mb-1 hidden md:block"
      />
      <ProgramaBotoxTabela />
    </div>
  );
}

