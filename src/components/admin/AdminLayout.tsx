import { Suspense, useEffect } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { PageLoading } from '@/components/layout/PageLoading';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, Users, Shield, Sliders, Menu, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';

const ADMIN_EMAIL = 'admin@clinievo.com.br';

const adminNavItems = [
  { title: 'Admin Dashboard', url: '/admin/dashboard', icon: LayoutDashboard },
  { title: 'Usuários', url: '/admin/users', icon: Users },
  { title: 'Gestão', url: '/admin/gestao', icon: Sliders },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  useEffect(() => {
    if (user === null) return;
    if (!user.email || user.email !== ADMIN_EMAIL) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  if (user && user.email !== ADMIN_EMAIL) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/30 flex">
      <aside className="w-64 shrink-0 border-r border-border bg-card hidden md:flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <span className="font-semibold text-sm">Painel Admin</span>
        </div>
        <nav className="p-2 flex-1">
          {adminNavItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === '/admin/users'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.title}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-border">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground" onClick={handleSignOut} aria-label="Sair do painel admin">
            <LogOut className="h-5 w-5 shrink-0" />
            Sair
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-background/95 backdrop-blur shrink-0 flex items-center justify-between gap-4 px-4">
          <span className="font-medium text-sm text-muted-foreground hidden sm:inline">CliniEvo Admin</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground hidden sm:flex" onClick={handleSignOut} aria-label="Sair do painel admin">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" aria-label="Menu admin">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="p-4 border-b flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                <span className="font-semibold text-sm">Painel Admin</span>
              </div>
              <nav className="p-2">
                {adminNavItems.map((item) => (
                  <NavLink
                    key={item.url}
                    to={item.url}
                    end={item.url === '/admin/users'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )
                    }
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {item.title}
                  </NavLink>
                ))}
              </nav>
              <div className="p-2 border-t border-border">
                <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground" onClick={() => { setMobileOpen(false); handleSignOut(); }} aria-label="Sair do painel admin">
                  <LogOut className="h-5 w-5 shrink-0" />
                  Sair
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
