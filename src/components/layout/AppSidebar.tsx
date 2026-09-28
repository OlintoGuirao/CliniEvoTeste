import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Wallet,
  Package,
  Settings,
  User,
  LogOut,
  Sparkles,
  PlusCircle,
  Activity,
  Receipt,
  FilePenLine,
  StickyNote,
  BarChart3,
  MessageCircle,
  Banknote,
  Scissors,
  Headset,
  UsersRound,
  Building2,
  Stethoscope,
  GitBranch,
  Share2,
  ClipboardList,
} from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { prefetchRoute } from '@/routes/loaders';
import { fetchProfessionalUiSettings } from '@/services/api/dynamicProcedureFieldSettingsApi';
import { useClinicMaster } from '@/hooks/use-clinic-master';
import { useClinicMemberRole } from '@/hooks/use-clinic-member-role';
import { useSalonAccount } from '@/hooks/use-salon-account';
import { filterNavForClinicMaster } from '@/lib/clinicMasterNav';
import {
  filterNavForClinicReceptionist,
  filterSettingsNavForClinicReceptionist,
} from '@/lib/clinicReceptionistNav';
import {
  filterNavForClinicProfessional,
  filterSettingsNavForClinicProfessional,
} from '@/lib/clinicProfessionalNav';
import { filterNavForSalon } from '@/lib/salonNav';
import { useBranchBranding } from '@/hooks/use-branch-branding';
import { useUiCopy } from '@/hooks/use-ui-copy';

import { queryKeys } from '@/api/queryKeys';
/** @deprecated Use queryKeys.menuProceduresForProfile(profileId) */
export const MENU_PROCEDURES_QUERY_KEY = queryKeys.menuProcedures;
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const fixedNavItems = [
  { title: 'Início', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Nova consulta', url: '/consultation', icon: PlusCircle },
  { title: 'Agenda', url: '/agenda', icon: Calendar },
  { title: 'Pacientes', url: '/patients', icon: Users },
  { title: 'Faturamento', url: '/faturamento', icon: Wallet },
  { title: 'Cobrança', url: '/cobranca', icon: Banknote, moduleKey: 'cobranca' },
  { title: 'Fluxo de caixa', url: '/fluxo-caixa', icon: BarChart3, moduleKey: 'fluxo-caixa', salonAlways: true },
  { title: 'Entradas NF (Insumos)', url: '/insumos-nf', icon: Package, moduleKey: 'insumos-nf' },
  { title: 'Programa de Botox', url: '/programa-botox', icon: Activity, moduleKey: 'programa-botox' },
  { title: 'Depilação a laser', url: '/depilacao-laser', icon: Scissors, moduleKey: 'depilacao-laser' },
  { title: 'Atendimento', url: '/atendimento', icon: Headset, moduleKey: 'atendimento', requiresClinicOnly: true },
  {
    title: 'Operacional',
    url: '/operacional',
    icon: GitBranch,
    requiresClinicMember: true,
  },
  { title: 'Anotações', url: '/anotacoes', icon: StickyNote, moduleKey: 'anotacoes' },
  { title: 'Orçamentos', url: '/orcamento', icon: Receipt, moduleKey: 'orcamento' },
  { title: 'Receitas', url: '/receituario', icon: FilePenLine, moduleKey: 'receituario' },
];

const settingsNavItems = [
  { title: 'Meu perfil', url: '/settings/profile', icon: User },
  {
    title: 'Equipe da clínica',
    url: '/settings/equipe',
    icon: UsersRound,
    /** Master clínica ou Admin do salão */
    requiresOrgTeamAdmin: true,
  },
  {
    title: 'Cadastrar procedimentos',
    url: '/settings/procedimentos-salao',
    icon: Scissors,
    requiresSalonAdmin: true,
  },
  {
    title: 'Filiais',
    url: '/settings/filiais',
    icon: Building2,
    requiresClinicMaster: true,
    hideForSalon: true,
  },
  {
    title: 'Procedimentos e preços',
    url: '/settings/procedimentos',
    icon: Stethoscope,
    requiresClinicMaster: true,
    hideForSalon: true,
  },
  {
    title: 'Origens',
    url: '/settings/origens',
    icon: Share2,
    requiresClinicMaster: true,
    hideForSalon: true,
  },
  {
    title: 'Tipos de ficha',
    url: '/settings/tipos-ficha',
    icon: ClipboardList,
    requiresClinicMaster: true,
    hideForSalon: true,
  },
  {
    title: 'Secretária WhatsApp',
    url: '/settings/whatsapp',
    icon: MessageCircle,
    requiresWhatsappModule: true,
    hideForClinicMaster: true,
    /** Salão sempre vê Secretária no menu próprio */
    salonAlways: true,
  },
  {
    title: 'Configurações do sistema',
    url: '/settings',
    icon: Settings,
    /** Só Master da clínica ou profissional único — funcionários da filial não veem */
    hideForClinicMember: true,
    /** Admin do salão (owner); membros da equipe não veem */
    salonRequiresAdmin: true,
  },
];

/** Rotas de configuração são irmãs — não usar match por prefixo (/settings ≠ /settings/whatsapp). */
const SETTINGS_EXACT_PATHS = new Set(settingsNavItems.map((item) => item.url));

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { profile, signOut } = useAuth();
  const { isMaster: isClinicMaster, isClinicAccount, hideOperationalNav } = useClinicMaster();
  const { isFrontDeskStaff, isClinicClinicalProfessional } = useClinicMemberRole();
  const { isSalonAccount, isSalonAdmin } = useSalonAccount();
  const isClinicMember = isClinicAccount && !isClinicMaster;
  const canManageTeam = isClinicMaster || isSalonAdmin;
  const copy = useUiCopy();
  const { appName, appDescription, appLogoUrl } = useBranchBranding();
  const location = useLocation();
  const collapsed = state === 'collapsed';
  /** Acima do header na faixa do logo (coluna esquerda); o header reserva essa largura. */
  const sidebarZIndex = isMobile ? undefined : 1300;
  const appVersion = String(import.meta.env.VITE_APP_VERSION || '1.0.0.1');

  const isActive = (path: string) => {
    if (location.pathname === path) return true;
    if (SETTINGS_EXACT_PATHS.has(path)) return false;
    return location.pathname.startsWith(path + '/');
  };

  const closeMobileSidebar = useCallback(() => {
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isModuleEnabled = useCallback(
    (moduleKey?: string) => {
      if (!moduleKey) return true;
      const disabled = (profile as any)?.disabled_modules as string[] | undefined;
      if (!Array.isArray(disabled) || disabled.length === 0) return true;
      return !disabled.includes(moduleKey);
    },
    [profile]
  );

  const labeledFixedNavItems = useMemo(
    () =>
      fixedNavItems.map((item) => {
        if (item.url === '/consultation') return { ...item, title: copy.newConsultation };
        if (item.url === '/patients') return { ...item, title: copy.patients };
        return item;
      }),
    [copy.newConsultation, copy.patients]
  );

  const isSalonMenu = isSalonAccount || copy.isSalon;

  const visibleFixedNavItems = useMemo(() => {
    const base = labeledFixedNavItems
      .filter((i: { moduleKey?: string; salonAlways?: boolean; url?: string }) => {
        if (isSalonMenu && 'salonAlways' in i && i.salonAlways) return true;
        return isModuleEnabled(i.moduleKey);
      })
      .filter(
        (i: { requiresClinicMember?: boolean }) =>
          !('requiresClinicMember' in i && i.requiresClinicMember) || isClinicMember
      )
      .filter(
        (i: { requiresClinicOnly?: boolean }) =>
          !('requiresClinicOnly' in i && i.requiresClinicOnly) || isClinicAccount
      );
    if (isSalonMenu) return filterNavForSalon(base, 'url');
    const forClinicMaster = filterNavForClinicMaster(base, hideOperationalNav, 'url');
    const forReceptionist = filterNavForClinicReceptionist(forClinicMaster, isFrontDeskStaff, 'url');
    return filterNavForClinicProfessional(forReceptionist, isClinicClinicalProfessional, 'url');
  }, [
    isModuleEnabled,
    hideOperationalNav,
    labeledFixedNavItems,
    isSalonMenu,
    isClinicMember,
    isClinicAccount,
    isFrontDeskStaff,
    isClinicClinicalProfessional,
  ]);

  const { data: uiSettings } = useQuery({
    queryKey: ['professional-ui-settings', profile?.id],
    queryFn: () => fetchProfessionalUiSettings({ professionalId: profile!.id }),
    enabled: !!profile?.id,
  });

  const visibleSettingsNavItems = useMemo(() => {
    const mapped = settingsNavItems.map((item) => {
      if (item.url === '/settings/equipe') return { ...item, title: copy.team };
      if (item.url === '/settings/whatsapp' && isSalonMenu) {
        return { ...item, title: 'Secretária' };
      }
      if (item.url === '/settings/profile' && isSalonMenu) {
        return { ...item, title: 'Perfil' };
      }
      return item;
    });

    if (isSalonMenu) {
      return filterNavForSalon(
        mapped.filter((item) => {
          if ('hideForSalon' in item && item.hideForSalon) return false;
          if ('requiresClinicMaster' in item && item.requiresClinicMaster) return false;
          if ('requiresSalonAdmin' in item && item.requiresSalonAdmin && !isSalonAdmin) {
            return false;
          }
          if ('requiresOrgTeamAdmin' in item && item.requiresOrgTeamAdmin && !canManageTeam) {
            return false;
          }
          if ('salonRequiresAdmin' in item && item.salonRequiresAdmin && !isSalonAdmin) {
            return false;
          }
          return true;
        }),
        'url'
      );
    }

    const filtered = mapped.filter((item) => {
      if ('requiresSalonAdmin' in item && item.requiresSalonAdmin) return false;
      if ('requiresOrgTeamAdmin' in item && item.requiresOrgTeamAdmin && !canManageTeam) {
        return false;
      }
      if ('requiresClinicMaster' in item && item.requiresClinicMaster && !isClinicMaster) {
        return false;
      }
      if ('hideForClinicMaster' in item && item.hideForClinicMaster && hideOperationalNav) {
        return false;
      }
      if ('hideForClinicMember' in item && item.hideForClinicMember && isClinicMember) {
        return false;
      }
      if ('requiresClinicMember' in item && item.requiresClinicMember && !isClinicMember) {
        return false;
      }
      if ('requiresWhatsappModule' in item && item.requiresWhatsappModule) {
        if (isFrontDeskStaff && isClinicMember) return true;
        return uiSettings?.show_whatsapp_ultramsg === true;
      }
      return true;
    });

    return filterSettingsNavForClinicProfessional(
      filterSettingsNavForClinicReceptionist(filtered, isFrontDeskStaff, 'url'),
      isClinicClinicalProfessional,
      'url'
    );
  }, [
    uiSettings?.show_whatsapp_ultramsg,
    isClinicMaster,
    isClinicMember,
    hideOperationalNav,
    canManageTeam,
    copy.team,
    isSalonMenu,
    isSalonAdmin,
    isFrontDeskStaff,
    isClinicClinicalProfessional,
  ]);

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border z-60"
      style={sidebarZIndex ? { zIndex: sidebarZIndex } : undefined}
    >
      <SidebarHeader className="px-3 py-2 sm:px-4 sm:py-3">
        <Link to="/dashboard" className={cn(
          "flex items-center gap-3 transition-all duration-200",
          collapsed && "justify-center"
        )}>
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white shrink-0 overflow-hidden shadow-md">
            {appLogoUrl ? (
              <img src={appLogoUrl} alt="" className="w-full h-full object-contain p-1.5" />
            ) : (
              <Sparkles className="w-5 h-5 text-primary" />
            )}
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sidebar-foreground truncate">
                {appName}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {appDescription}
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className={cn(collapsed && 'sr-only')}>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleFixedNavItems.map((item: any) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        onClick={closeMobileSidebar}
                        onMouseEnter={() => prefetchRoute(item.url)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-2.5 py-1.5 transition-colors',
                          isActive(item.url)
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                        )}
                      >
                        <item.icon className="w-5 h-5 shrink-0" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel className={cn(collapsed && 'sr-only')}>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleSettingsNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        onClick={closeMobileSidebar}
                        onMouseEnter={() => prefetchRoute(item.url)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-2.5 py-1.5 transition-colors',
                          isActive(item.url)
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                        )}
                      >
                        <item.icon className="w-5 h-5 shrink-0" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 gap-0 border-t border-sidebar-border bg-background/95 backdrop-blur">
        {collapsed ? (
          <div className="flex items-center justify-center">
            <Avatar className="w-9 h-9 shrink-0">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {getInitials(profile?.full_name)}
              </AvatarFallback>
            </Avatar>
          </div>
        ) : (
          <>
            <p className="mb-3 text-center text-[11px] font-medium text-muted-foreground">
              CliniEvo <span className="font-semibold text-foreground/70">v{appVersion}</span>
            </p>
            <Button
              variant="outline"
              className="w-full gap-2 text-destructive hover:bg-destructive/10 rounded-xl"
              onClick={signOut}
            >
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
