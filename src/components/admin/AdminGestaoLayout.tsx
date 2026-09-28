import { Outlet } from 'react-router-dom';
import { Sliders, FileText, Users, Wrench } from 'lucide-react';
import { BrowserNavTabs } from '@/components/admin/BrowserNavTabs';

const gestaoTabs = [
  {
    to: 'procedures-permissions',
    label: 'Permissões de Procedimentos',
    shortLabel: 'Procedimentos',
    icon: Sliders,
  },
  {
    to: 'screen-permissions',
    label: 'Permissões de tela',
    shortLabel: 'Telas',
    icon: FileText,
  },
  {
    to: 'procedure-editor',
    label: 'Criar / modificar procedimento',
    shortLabel: 'Procedimento',
    icon: Wrench,
  },
  {
    to: 'patient-import',
    label: 'Importar pacientes',
    shortLabel: 'Importar',
    icon: Users,
  },
] as const;

export function AdminGestaoLayout() {
  return (
    <div className="space-y-0">
      <div className="space-y-6 mb-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Permissões, criação de procedimentos e importação de pacientes.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <BrowserNavTabs tabs={gestaoTabs} aria-label="Seções de gestão" />
        <div className="border-t border-border bg-muted/20 p-4 sm:p-5">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
