import { Suspense } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLoader } from '@/core/loaders/AppLoader';
import { RealtimeProvider } from '@/core/providers/RealtimeProvider';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import { CurrentPatientProvider } from '@/contexts/CurrentPatientContext';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { MobileBottomNav, MobileFAB, MOBILE_BOTTOM_NAV_HEIGHT } from './mobile';
import { ClinicReceptionistRouteGuard } from '@/components/clinic/ClinicReceptionistRouteGuard';

export function AppLayout() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <AppLoader message="Carregando..." />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!profile) {
    return <AppLoader message="Carregando perfil..." />;
  }

  return (
    <RealtimeProvider>
      <CurrentPatientProvider>
        <SidebarProvider
          defaultOpen
          open
          onOpenChange={() => {
            /* Sidebar só aparece no desktop e permanece completa. */
          }}
          style={
            {
              "--app-header-height": "4rem",
              "--mobile-bottom-nav-height": `${MOBILE_BOTTOM_NAV_HEIGHT}px`,
              /* Gap extra no tablet: evita ações finais sob o bottom nav / home indicator */
              "--mobile-bottom-safe-gap": "28px",
            } as CSSProperties
          }
        >
        <AppHeader />
        <div className="min-h-dvh flex w-full bg-background pt-[calc(var(--app-header-height)+env(safe-area-inset-top))]">
          <div className="hidden nav:block shrink-0">
            <AppSidebar />
          </div>
          <main className="flex-1 flex flex-col min-h-dvh min-w-0 w-full">
            <div className="flex-1 w-full max-w-none p-3 md:p-4 lg:p-5 overflow-auto min-h-0 pb-[calc(var(--mobile-bottom-nav-height)+var(--mobile-bottom-safe-gap)+env(safe-area-inset-bottom))] nav:pb-4">
              <Suspense fallback={<PageSkeleton />}>
                <ClinicReceptionistRouteGuard>
                  <Outlet />
                </ClinicReceptionistRouteGuard>
              </Suspense>
            </div>
          </main>
        </div>
        <MobileBottomNav />
        <MobileFAB />
      </SidebarProvider>
      </CurrentPatientProvider>
    </RealtimeProvider>
  );
}
