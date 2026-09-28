import { Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RouterProvider } from "react-router-dom";
import { ThemeProvider, useTheme } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { QueryProvider } from "@/core/providers/QueryProvider";
import { AppLoader } from "@/core/loaders/AppLoader";
import { router } from "@/routes";
import { applyThemeFromProfile } from "@/lib/theme-colors";
import { ClinicBranchProvider } from "@/contexts/ClinicBranchContext";
import { useBranchBranding } from "@/hooks/use-branch-branding";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const THEME_PALETTE_KEY = 'clienievo_theme_palette';
const ACCENT_COLOR_KEY = 'clienievo_accent_color';

function ThemeSync() {
  const { profile } = useAuth();
  const { setTheme, resolvedTheme } = useTheme();
  const { accentColor, fromBranch } = useBranchBranding();

  useEffect(() => {
    if (profile?.theme) {
      setTheme(profile.theme);
      localStorage.setItem('theme', profile.theme);
    } else {
      setTheme('system');
    }
  }, [profile?.theme, setTheme]);

  useEffect(() => {
    const isDark = resolvedTheme === 'dark';
    const effectiveAccent = fromBranch ? accentColor : (profile?.accent_color ?? null);
    applyThemeFromProfile(profile?.theme_palette ?? null, effectiveAccent, isDark);
    if (profile?.theme_palette != null) localStorage.setItem(THEME_PALETTE_KEY, profile.theme_palette);
    else localStorage.removeItem(THEME_PALETTE_KEY);
    if (effectiveAccent != null) localStorage.setItem(ACCENT_COLOR_KEY, effectiveAccent);
    else localStorage.removeItem(ACCENT_COLOR_KEY);
  }, [profile?.theme_palette, profile?.accent_color, accentColor, fromBranch, resolvedTheme]);

  return null;
}

function UpdateAvailableDialog() {
  const [open, setOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateNow, setUpdateNow] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const onUpdateAvailable = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ updateNow?: () => Promise<void> }>;
      setUpdateNow(() => customEvt.detail?.updateNow ?? null);
      setOpen(true);
    };
    window.addEventListener("app-update-available", onUpdateAvailable);
    return () => window.removeEventListener("app-update-available", onUpdateAvailable);
  }, []);

  const handleUpdate = async () => {
    if (!updateNow) {
      window.location.reload();
      return;
    }
    setIsUpdating(true);
    try {
      await updateNow();
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isUpdating && setOpen(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova versão disponível</DialogTitle>
          <DialogDescription>
            Encontramos uma atualização do sistema. Clique em atualizar para carregar a versão mais recente.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-between gap-2">
          <Button type="button" variant="outline" disabled={isUpdating} onClick={() => setOpen(false)}>
            Depois
          </Button>
          <Button type="button" onClick={() => void handleUpdate()} disabled={isUpdating}>
            {isUpdating ? "Atualizando..." : "Atualizar agora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const App = () => (
  <QueryProvider>
    <TooltipProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <Toaster />
        <Sonner />
        <UpdateAvailableDialog />
        <AuthProvider>
          <ClinicBranchProvider>
            <ThemeSync />
            <Suspense fallback={<AppLoader message="Carregando..." />}>
              <RouterProvider router={router} />
            </Suspense>
          </ClinicBranchProvider>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryProvider>
);

export default App;
