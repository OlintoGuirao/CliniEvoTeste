import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Bell, 
  Settings, 
  Moon, 
  Sun, 
  LogOut, 
  User, 
  Sparkles, 
  Plus, 
  LayoutDashboard, 
  Calendar, 
  Users,
  Wallet,
  Package,
  Menu,
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
import { useTheme } from 'next-themes';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getProceduresForProfile } from '@/lib/proceduresForProfile';
import { queryKeys } from '@/api/queryKeys';
import { fetchProfessionalUiSettings } from '@/services/api/dynamicProcedureFieldSettingsApi';
import { getProcedureIcon, type ProcedureForMenu } from './ProceduresSidebar';
import { useNotifications, type NotificationItem } from '@/hooks/use-notifications';
import { useSidebar } from '@/components/ui/sidebar';
import { useClinicMaster } from '@/hooks/use-clinic-master';
import { useSalonAccount } from '@/hooks/use-salon-account';
import { filterNavForClinicMaster } from '@/lib/clinicMasterNav';
import { filterNavForClinicReceptionist } from '@/lib/clinicReceptionistNav';
import { filterNavForClinicProfessional } from '@/lib/clinicProfessionalNav';
import { useClinicMemberRole } from '@/hooks/use-clinic-member-role';
import { filterNavForSalon } from '@/lib/salonNav';
import { useBranchBranding } from '@/hooks/use-branch-branding';
import { useUiCopy } from '@/hooks/use-ui-copy';
import { ClinicDentalAttendanceDialog } from '@/components/clinic/ClinicDentalAttendanceDialog';

export function AppHeader() {
  const { profile, signOut } = useAuth();
  const { isMaster: isClinicMaster, isClinicAccount, hideOperationalNav } = useClinicMaster();
  const { isFrontDeskStaff, isClinicClinicalProfessional } = useClinicMemberRole();
  const { isSalonAccount, isSalonAdmin } = useSalonAccount();
  const isClinicMember = isClinicAccount && !isClinicMaster;
  const canManageTeam = isClinicMaster || isSalonAdmin;
  const copy = useUiCopy();
  const { appName, appDescription, appLogoUrl } = useBranchBranding();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { state: sidebarState } = useSidebar();
  const sidebarRailWidth =
    sidebarState === 'collapsed' ? 'var(--sidebar-width-icon)' : 'var(--sidebar-width)';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  /** Quando estamos na ficha do paciente (/patients/:id sem /edit, /anamnese, etc.), usar este id para abrir consulta direto. */
  const isOnPatientFicha =
    location.pathname.startsWith('/patients/') &&
    !location.pathname.endsWith('/edit') &&
    !location.pathname.endsWith('/anamnese') &&
    !location.pathname.includes('/session/') &&
    params.id &&
    params.id !== 'new';
  const consultationPatientId = isOnPatientFicha ? params.id : null;
  /** Na tela de Emagrecimento / Redução de Medidas (detalhe da instância), o botão Nova consulta abre o diálogo Nova sessão. */
  const isOnEmagrecimentoInstance =
    params.slug === 'emagrecimento-reducao-medidas' && params.instanceId;
  const handleNovaConsultaClick = () => {
    if (isOnEmagrecimentoInstance) {
      navigate(`${location.pathname}?newSession=1`, { replace: true });
      return;
    }
    navigate(consultationPatientId ? `/consultation/${consultationPatientId}` : '/consultation');
  };
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { items: notifications, unreadCount, clearNotifications } = useNotifications();
  const [dentalPlansPopup, setDentalPlansPopup] = useState<{
    patientId: string;
    patientName?: string;
    planId?: string;
  } | null>(null);
  const appVersion = String(import.meta.env.VITE_APP_VERSION || '1.0.0.1');

  const openNotification = (item: NotificationItem) => {
    setNotificationsOpen(false);
    if (item.action === 'open-dental-plans' && item.patientId && isClinicAccount) {
      setDentalPlansPopup({
        patientId: item.patientId,
        patientName: item.patientName,
        planId: item.planId,
      });
      return;
    }
    if (item.href) navigate(item.href);
  };

  const { data: menuProcedures = [] } = useQuery({
    queryKey: queryKeys.menuProceduresForProfile(profile?.id ?? ''),
    queryFn: async (): Promise<ProcedureForMenu[]> => {
      if (!profile?.id) return [];
      const [procs, upRes] = await Promise.all([
        getProceduresForProfile(profile.id),
        supabase
          .from('user_procedures')
          .select('procedure_id, is_active, show_in_menu')
          .eq('user_id', profile.id),
      ]);
      const prefs = (upRes.data ?? []) as { procedure_id: string; is_active: boolean; show_in_menu: boolean }[];
      const prefsMap = new Map(prefs.map((p) => [p.procedure_id, p]));
      return procs.filter((p) => {
        const up = prefsMap.get(p.id);
        if (!up) return true;
        return up.is_active !== false && up.show_in_menu !== false;
      });
    },
    enabled: !!profile?.id,
  });

  const { data: uiSettings } = useQuery({
    queryKey: ['professional-ui-settings', profile?.id],
    queryFn: () => fetchProfessionalUiSettings({ professionalId: profile!.id }),
    enabled: !!profile?.id,
  });

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const navItems = [
    { label: 'Início', path: '/dashboard', icon: LayoutDashboard },
    { label: copy.newConsultation, path: '/consultation', icon: Plus },
    { label: 'Agenda', path: '/agenda', icon: Calendar },
    { label: copy.patients, path: '/patients', icon: Users },
    { label: 'Faturamento', path: '/faturamento', icon: Wallet },
    { label: 'Cobrança', path: '/cobranca', icon: Banknote, moduleKey: 'cobranca' },
    { label: 'Fluxo de caixa', path: '/fluxo-caixa', icon: BarChart3, moduleKey: 'fluxo-caixa', salonAlways: true },
    { label: 'Entradas NF (Insumos)', path: '/insumos-nf', icon: Package, moduleKey: 'insumos-nf' },
    { label: 'Programa de Botox', path: '/programa-botox', icon: Activity, moduleKey: 'programa-botox' },
    { label: 'Depilação a laser', path: '/depilacao-laser', icon: Scissors, moduleKey: 'depilacao-laser' },
    { label: 'Atendimento', path: '/atendimento', icon: Headset, moduleKey: 'atendimento', requiresClinicOnly: true },
    { label: 'Operacional', path: '/operacional', icon: GitBranch, requiresClinicMember: true },
    { label: 'Anotações', path: '/anotacoes', icon: StickyNote, moduleKey: 'anotacoes' },
    { label: 'Orçamentos', path: '/orcamento', icon: Receipt, moduleKey: 'orcamento' },
    { label: 'Receitas', path: '/receituario', icon: FilePenLine, moduleKey: 'receituario' },
  ];

  const isModuleEnabled = (moduleKey?: string) => {
    if (!moduleKey) return true;
    const disabled = (profile as any)?.disabled_modules as string[] | undefined;
    if (!Array.isArray(disabled) || disabled.length === 0) return true;
    return !disabled.includes(moduleKey);
  };

  const visibleNavItems = (() => {
    const base = navItems
      .filter((item) => {
        if (isSalonAccount && 'salonAlways' in item && (item as { salonAlways?: boolean }).salonAlways) {
          return true;
        }
        return isModuleEnabled((item as { moduleKey?: string }).moduleKey);
      })
      .filter((item) => !('requiresClinicMember' in item && item.requiresClinicMember) || isClinicMember)
      .filter((item) => !('requiresClinicOnly' in item && (item as { requiresClinicOnly?: boolean }).requiresClinicOnly) || isClinicAccount);
    if (isSalonAccount) return filterNavForSalon(base, 'path');
    const forClinicMaster = filterNavForClinicMaster(base, hideOperationalNav, 'path');
    const forReceptionist = filterNavForClinicReceptionist(forClinicMaster, isFrontDeskStaff, 'path');
    return filterNavForClinicProfessional(forReceptionist, isClinicClinicalProfessional, 'path');
  })();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');
  
  const isProcedureActive = (slug: string) =>
    location.pathname === `/procedures/${slug}` || location.pathname.startsWith(`/procedures/${slug}/`);

  /** No mobile, não exibir a seção Procedimentos no drawer (acesse via Pacientes > ficha do paciente). */
  const showProceduresInMobileMenu = false;

  return (
    <header className="w-full bg-primary fixed top-0 left-0 right-0 z-[1200] shadow-[0_1px_3px_rgba(0,0,0,0.06)] pt-[env(safe-area-inset-top)] h-[calc(var(--app-header-height)+env(safe-area-inset-top))] flex flex-col overflow-hidden">
      <div
        className="h-[var(--app-header-height)] min-h-[var(--app-header-height)] max-h-[var(--app-header-height)] px-2 sm:px-4 nav:px-0 flex items-center justify-between gap-2 sm:gap-3 max-w-[1920px] mx-auto w-full nav:grid nav:grid-cols-[var(--sidebar-rail-width)_1fr_auto] nav:items-center nav:gap-0 min-w-0"
        style={{ ['--sidebar-rail-width' as string]: sidebarRailWidth }}
      >
        <div className="flex items-center gap-2 md:gap-3 nav:pl-2 nav:pr-2 shrink-0 min-w-0">
          {/* Menu Mobile - antes do logo */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="nav:hidden">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/15 transition-all hover:scale-105 rounded-lg h-9 w-9 sm:h-10 sm:w-10"
              >
                <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(18rem,90vw)] p-0 bg-gradient-to-b from-primary/5 to-background overflow-y-auto z-[2000]">
              <div className="flex flex-col min-h-full">
                {/* Header do Menu */}
                <div className="p-6 border-b border-border bg-primary/5 sticky top-0 z-10 bg-background/95 backdrop-blur">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
                      {appLogoUrl ? (
                        <img src={appLogoUrl} alt="" className="w-full h-full object-contain p-2" />
                      ) : (
                        <Sparkles className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm md:text-base break-words line-clamp-2">{appName}</p>
                      <p className="text-xs text-muted-foreground break-words line-clamp-2">
                        {appDescription}
                      </p>
                    </div>
                  </div>
                </div>

              {/* Navegação Principal */}
              <div className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                  Menu Principal
                </p>
                <nav className="space-y-1">
                  {visibleNavItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                        isActive(item.path)
                          ? "bg-primary text-white shadow-md"
                          : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </nav>
              </div>

              <div className="px-4 pb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                  Sistema
                </p>
                <nav className="space-y-1">
                  <Link
                    to="/settings/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                      isActive('/settings/profile')
                        ? "bg-primary text-white shadow-md"
                        : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <User className="w-5 h-5" />
                    <span>{isSalonAccount ? 'Perfil' : 'Meu perfil'}</span>
                  </Link>

                  {canManageTeam && (
                    <Link
                      to="/settings/equipe"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                        isActive('/settings/equipe')
                          ? "bg-primary text-white shadow-md"
                          : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <UsersRound className="w-5 h-5" />
                      <span>{copy.team}</span>
                    </Link>
                  )}

                  {isSalonAdmin && (
                    <Link
                      to="/settings/procedimentos-salao"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                        isActive('/settings/procedimentos-salao')
                          ? "bg-primary text-white shadow-md"
                          : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Scissors className="w-5 h-5" />
                      <span>Cadastrar procedimentos</span>
                    </Link>
                  )}

                  {isClinicMaster && (
                    <Link
                      to="/settings/filiais"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                        isActive('/settings/filiais')
                          ? "bg-primary text-white shadow-md"
                          : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Building2 className="w-5 h-5" />
                      <span>Filiais</span>
                    </Link>
                  )}

                  {isClinicMaster && (
                    <Link
                      to="/settings/procedimentos"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                        isActive('/settings/procedimentos')
                          ? "bg-primary text-white shadow-md"
                          : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Stethoscope className="w-5 h-5" />
                      <span>Procedimentos e preços</span>
                    </Link>
                  )}

                  {isClinicMaster && (
                    <Link
                      to="/settings/origens"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                        isActive('/settings/origens')
                          ? "bg-primary text-white shadow-md"
                          : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Share2 className="w-5 h-5" />
                      <span>Origens</span>
                    </Link>
                  )}

                  {isClinicMaster && (
                    <Link
                      to="/settings/tipos-ficha"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                        isActive('/settings/tipos-ficha')
                          ? "bg-primary text-white shadow-md"
                          : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <ClipboardList className="w-5 h-5" />
                      <span>Tipos de ficha</span>
                    </Link>
                  )}

                  {(isSalonAccount ||
                    (isFrontDeskStaff && isClinicMember) ||
                    (uiSettings?.show_whatsapp_ultramsg === true &&
                      !hideOperationalNav &&
                      !isClinicClinicalProfessional)) && (
                    <Link
                      to="/settings/whatsapp"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                        isActive('/settings/whatsapp')
                          ? "bg-primary text-white shadow-md"
                          : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span>{isSalonAccount ? 'Secretária' : 'Secretária WhatsApp'}</span>
                    </Link>
                  )}

                  {(isSalonAdmin || (!isClinicMember && !isSalonAccount)) && (
                  <Link
                    to="/settings"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                      isActive('/settings')
                        ? "bg-primary text-white shadow-md"
                        : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <Settings className="w-5 h-5" />
                    <span>Configurações do sistema</span>
                  </Link>
                  )}
                </nav>
              </div>

              {/* Procedimentos (oculto no mobile) */}
              {showProceduresInMobileMenu && menuProcedures.length > 0 && (
                <div className="px-4 pb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                    Procedimentos
                  </p>
                  <nav className="space-y-1">
                    {menuProcedures.map((proc) => {
                      const ProcIcon = getProcedureIcon(proc.slug);
                      const active = isProcedureActive(proc.slug);
                      return (
                        <Link
                          key={proc.id}
                          to={`/procedures/${proc.slug}`}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                            active
                              ? "bg-primary text-white shadow-md"
                              : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
                          )}
                        >
                          <ProcIcon className="w-5 h-5" />
                          <span className="truncate">{proc.name}</span>
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              )}

              {/* Spacer para empurrar o botão de sair para baixo */}
              <div className="flex-1" />

              {/* Botão Sair */}
              <div className="p-4 border-t border-border sticky bottom-0 bg-background/95 backdrop-blur">
                <p className="mb-3 text-center text-[11px] font-medium text-muted-foreground">
                  CliniEvo <span className="font-semibold text-foreground/70">v{appVersion}</span>
                </p>
                <Button
                  variant="outline"
                  className="w-full gap-2 text-destructive hover:bg-destructive/10 rounded-xl"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut();
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

          {/* Espaço reservado para o topo do sidebar (logo fica na sidebar no desktop) */}
        </div>

        {/* Navegação Desktop - Menus Principais (sem Configurações do sistema; fica na sidebar) */}
        <div className="hidden 2xl:flex justify-center min-w-0 flex-1 overflow-hidden">
          <nav className="flex items-center gap-1 rounded-full bg-white/10 border border-white/15 px-2 py-1 shadow-sm backdrop-blur shrink-0 max-w-full overflow-hidden">
            {visibleNavItems.filter((item) => item.path !== '/settings').map((item) => (
              <Link
                key={item.path}
                to={item.path}
                title={item.label}
                aria-label={item.label}
                className={cn(
                  "flex items-center justify-center p-2.5 rounded-full text-sm font-medium transition-all duration-300",
                  isActive(item.path)
                    ? "bg-white/20 text-white shadow-lg"
                    : "text-white/85 hover:text-white hover:bg-white/15"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
              </Link>
            ))}
          </nav>
        </div>

        {/* Ícones de Ação */}
        <div className="flex items-center gap-1.5 sm:gap-2 sm:gap-3 max-[360px]:gap-1 justify-end pr-2 sm:pr-3 md:pr-4 shrink-0">
          {/* Botão Nova consulta - Desktop. Na ficha do paciente abre consulta; em Emagrecimento abre Nova sessão. */}
          {!hideOperationalNav && !isFrontDeskStaff && !isClinicClinicalProfessional && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNovaConsultaClick}
            className="hidden nav:inline-flex text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-300 hover:scale-110 rounded-xl shadow-sm hover:shadow-lg h-10 w-10 sm:h-11 sm:w-11"
            title={copy.newConsultation}
          >
            <Plus className="w-5 h-5" />
          </Button>
          )}

          {/* Notificações */}
          <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-300 hover:scale-110 rounded-xl shadow-sm hover:shadow-lg h-10 w-10 sm:h-11 sm:w-11"
                title="Notificações"
              >
                <Bell className="w-5 h-5 sm:w-5 sm:h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center shadow-md">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 max-w-[90vw] p-2 z-[1100]">
              <div className="flex items-center justify-between px-2 py-1.5 text-sm font-semibold">
                <span>Notificações</span>
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={clearNotifications}
                  >
                    Limpar notificações
                  </Button>
                )}
              </div>
              <div className="h-px bg-muted my-1" />
              {notifications.length === 0 ? (
                <div className="py-6 text-sm text-muted-foreground text-center">
                  Sem notificações no momento.
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {notifications.slice(0, 8).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openNotification(item)}
                      className={
                        item.kind === 'whatsapp'
                          ? 'flex flex-col gap-1 rounded-md px-2 py-2 transition-colors bg-emerald-50/60 hover:bg-emerald-100/60 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 border border-emerald-200/60 dark:border-emerald-800/40 text-left w-full'
                          : 'flex flex-col gap-1 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors text-left w-full'
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={item.kind === 'whatsapp' ? 'font-medium text-sm text-emerald-800 dark:text-emerald-300' : 'font-medium text-sm'}>
                          {item.title}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">{item.dateLabel}</span>
                      </div>
                      <span className={item.kind === 'whatsapp' ? 'text-xs text-emerald-700/80 dark:text-emerald-400/80 line-clamp-2' : 'text-xs text-muted-foreground line-clamp-2'}>
                        {item.description}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Separador */}
          <div className="hidden sm:block w-px h-6 sm:h-8 bg-white/20 mx-1 sm:mx-2" />

          {/* Menu do Usuário */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-11 sm:h-12 lg:h-14 gap-1.5 sm:gap-2 px-2 sm:px-2.5 md:px-3 text-white bg-transparent hover:bg-white/10 transition-all duration-300 rounded-full focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                <Avatar className="w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-white text-primary text-xs font-bold">
                    {getInitials(profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden nav:inline-block font-medium truncate max-w-[100px] md:max-w-[140px] drop-shadow-sm text-sm">
                  {profile?.full_name?.split(' ')[0] || 'Usuário'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span className="font-semibold">{profile?.full_name || 'Usuário'}</span>
                <span className="text-xs text-muted-foreground font-normal">{profile?.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link to="/settings/profile" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Meu Perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer nav:hidden">
                <Link to="/settings/profile" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Configurações de perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={signOut}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ClinicDentalAttendanceDialog
        open={isClinicAccount && Boolean(dentalPlansPopup?.patientId)}
        onOpenChange={(open) => {
          if (!open) setDentalPlansPopup(null);
        }}
        patientId={isClinicAccount ? dentalPlansPopup?.patientId ?? null : null}
        patientName={dentalPlansPopup?.patientName}
        planId={dentalPlansPopup?.planId}
        title="Planos odontológicos"
      />
    </header>
  );
}
