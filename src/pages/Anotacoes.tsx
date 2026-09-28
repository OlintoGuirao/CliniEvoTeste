import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { AnotacoesPanel } from '@/components/anotacoes/AnotacoesPanel';
import { useAuth } from '@/contexts/AuthContext';
import { isAnotacoesModuleEnabled } from '@/lib/professionalModules';
import { Navigate } from 'react-router-dom';

export default function Anotacoes() {
  const { profile } = useAuth();
  if (!isAnotacoesModuleEnabled(profile)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-w-0 space-y-4 md:space-y-6 animate-fade-in">
      <PageBreadcrumb
        segments={[
          { label: 'Início', path: '/dashboard' },
          { label: 'Anotações' },
        ]}
        className="mb-1 hidden md:block"
      />
      <AnotacoesPanel />
    </div>
  );
}
