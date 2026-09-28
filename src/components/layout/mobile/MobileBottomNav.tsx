import { NavLink, useLocation } from 'react-router-dom';
import {
  Calendar,
  Users,
  Stethoscope,
  Wallet,
  LayoutDashboard,
  BarChart3,
  Building2,
  Headset,
  GitBranch,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClinicMaster } from '@/hooks/use-clinic-master';
import { useClinicMemberRole } from '@/hooks/use-clinic-member-role';
import { useSalonAccount } from '@/hooks/use-salon-account';
import { useUiCopy } from '@/hooks/use-ui-copy';

const SOLO_ITEMS = [
  { to: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { to: '/agenda', label: 'Agenda', icon: Calendar },
  { to: '/patients', label: 'Pacientes', icon: Users },
  { to: '/consultation', label: 'Consulta', icon: Stethoscope },
] as const;

const MASTER_ITEMS = [
  { to: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { to: '/faturamento', label: 'Faturamento', icon: Wallet },
  { to: '/fluxo-caixa', label: 'Caixa', icon: BarChart3 },
  { to: '/settings/filiais', label: 'Filiais', icon: Building2 },
] as const;

const SALON_ITEMS = [
  { to: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { to: '/consultation', label: 'Atendimento', icon: Stethoscope },
  { to: '/agenda', label: 'Agenda', icon: Calendar },
  { to: '/patients', label: 'Clientes', icon: Users },
] as const;

/** Atalhos mobile da recepção/atendimento da clínica (menu completo fica na sidebar / drawer). */
const RECEPTIONIST_ITEMS = [
  { to: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { to: '/agenda', label: 'Agenda', icon: Calendar },
  { to: '/patients', label: 'Pacientes', icon: Users },
  { to: '/atendimento', label: 'Atendimento', icon: Headset },
  { to: '/operacional', label: 'Operacional', icon: GitBranch },
] as const;

/** Atalhos mobile do profissional clínico da clínica. */
const CLINIC_PROFESSIONAL_ITEMS = [
  { to: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { to: '/agenda', label: 'Agenda', icon: Calendar },
  { to: '/patients', label: 'Pacientes', icon: Users },
] as const;

export const MOBILE_BOTTOM_NAV_HEIGHT = 64;

export function MobileBottomNav() {
  const location = useLocation();
  const { isMaster: isClinicMaster } = useClinicMaster();
  const { isFrontDeskStaff, isClinicClinicalProfessional } = useClinicMemberRole();
  const { isSalonAccount } = useSalonAccount();
  const copy = useUiCopy();

  if (
    location.pathname.startsWith('/programa-botox') ||
    location.pathname.startsWith('/anotacoes') ||
    location.pathname.startsWith('/insumos-nf') ||
    location.pathname.startsWith('/orcamento') ||
    location.pathname.startsWith('/receituario') ||
    location.pathname.startsWith('/atendimento')
  )
    return null;

  const soloItems = SOLO_ITEMS.map((item) => {
    if (item.to === '/patients') return { ...item, label: copy.patients };
    if (item.to === '/consultation') return { ...item, label: copy.consultation };
    return item;
  });

  const items = isSalonAccount
    ? SALON_ITEMS
    : isClinicMaster
      ? MASTER_ITEMS
      : isFrontDeskStaff
        ? RECEPTIONIST_ITEMS
        : isClinicClinicalProfessional
          ? CLINIC_PROFESSIONAL_ITEMS
          : soloItems;

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    if (path === '/consultation') return location.pathname.startsWith('/consultation');
    if (path === '/settings/filiais') {
      return location.pathname === '/settings/filiais' || location.pathname.startsWith('/settings/filiais/');
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <nav
      className="nav:hidden fixed bottom-0 left-0 right-0 z-[1100] bg-background/95 backdrop-blur border-t border-border flex items-stretch safe-area-pb"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        minHeight: MOBILE_BOTTOM_NAV_HEIGHT,
      }}
      aria-label="Navegação principal"
    >
      {items.map(({ to, label, icon: Icon }) => {
        const active = isActive(to);
        return (
          <NavLink
            key={to}
            to={to}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] py-2 text-xs font-medium transition-colors',
              active
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground active:bg-muted/50'
            )}
          >
            <Icon className={cn('w-6 h-6 shrink-0', active && 'text-primary')} strokeWidth={active ? 2.5 : 2} />
            <span className="truncate max-w-full px-0.5">{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
