import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getProfile } from '@/api/profiles';
import { profileKey } from '@/api/queryKeys';
import { useProfile } from '@/hooks/useProfile';
import type { ThemePreference } from '@/types/auth';

// Re-export para compatibilidade com imports existentes
export type { Profile, ThemePreference } from '@/types/auth';

/** Estado de auth discriminado: evita loading=false + user + profile=null. */
export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; session: Session; user: User };

const AuthStateContext = createContext<AuthState | undefined>(undefined);

/** Ações estáveis (não causam re-render quando o estado muda). */
export interface AuthActions {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (fullName: string) => Promise<{ error: Error | null }>;
  updateAvatar: (avatarUrl: string | null) => Promise<{ error: Error | null }>;
  updateTheme: (theme: ThemePreference) => Promise<{ error: Error | null }>;
  updateAccentColor: (accentColor: string | null) => Promise<{ error: Error | null }>;
  updateThemePalette: (themePalette: string | null) => Promise<{ error: Error | null }>;
  updateAppBranding: (data: {
    app_name?: string | null;
    app_description?: string | null;
    app_logo_url?: string | null;
    professional_registry_body?: string | null;
    professional_registry_number?: string | null;
  }) => Promise<{ error: Error | null }>;
  updateProfessionalClinicProfile: (data: {
    date_of_birth?: string | null;
    phone?: string | null;
    professional_registry_body?: string | null;
    professional_registry_number?: string | null;
    professional_specialty?: string | null;
  }) => Promise<{ error: Error | null }>;
  updateDefaultSignature: (dataUrl: string | null) => Promise<{ error: Error | null }>;
  updateProfessionalStamp: (dataUrl: string | null) => Promise<{ error: Error | null }>;
  updateWorkingHours: (data: {
    work_start_time?: string | null;
    work_end_time?: string | null;
    work_days?: number[] | null;
    lunch_start_time?: string | null;
    lunch_end_time?: string | null;
    lunch_breaks?: Array<{ start: string; end: string }> | null;
  }) => Promise<{ error: Error | null }>;
}

const AuthActionsContext = createContext<AuthActions | undefined>(undefined);

/** Evita voltar a "loading" se o AuthProvider remontar na mesma sessão de página. */
let resolvedAuthSnapshot: AuthState | null = null;

function commitAuthState(
  setState: React.Dispatch<React.SetStateAction<AuthState>>,
  next: AuthState
) {
  if (next.status !== 'loading') {
    resolvedAuthSnapshot = next;
  }
  setState(next);
}

function isBrokenSessionError(message: string): boolean {
  return /refresh token|invalid.*token|token not found|session/i.test(message);
}

function clearSupabaseAuthStorage() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-') && key.includes('auth-token')) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }
}

/** Um único commit de estado: sessão + perfil no cache antes de authenticated. */
async function hydrateSessionAndProfile(
  session: Session | null,
  queryClient: ReturnType<ReturnType<typeof useQueryClient>>,
  setState: (s: AuthState) => void
) {
  if (!session?.user) {
    setState({ status: 'unauthenticated' });
    return;
  }
  try {
    const profile = await getProfile(session.user.id);
    if (!profile) {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        /* ignore */
      }
      setState({ status: 'unauthenticated' });
      return;
    }
    queryClient.setQueryData(profileKey(session.user.id), profile);
    setState({ status: 'authenticated', session, user: session.user });
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err);
    if (isBrokenSessionError(msg)) {
      clearSupabaseAuthStorage();
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        /* ignore */
      }
    }
    setState({ status: 'unauthenticated' });
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [authState, setAuthState] = useState<AuthState>(
    () => resolvedAuthSnapshot ?? { status: 'loading' }
  );
  const stateRef = useRef(authState);
  stateRef.current = authState;

  const setAuthStateSafe = useCallback((next: AuthState) => {
    commitAuthState(setAuthState, next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let initialized = false;
    let clearingSession = false;

    const setAuthStateSafeLocal = (next: AuthState) => {
      if (!cancelled) commitAuthState(setAuthState, next);
    };

    const clearBrokenSession = async () => {
      if (clearingSession) return;
      clearingSession = true;
      clearSupabaseAuthStorage();
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // ignore
      }
      resolvedAuthSnapshot = { status: 'unauthenticated' };
      setAuthStateSafeLocal({ status: 'unauthenticated' });
      clearingSession = false;
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled || clearingSession) return;

      // Evita corrida com getSession na carga inicial (causa loop /auth ↔ /dashboard).
      if (!initialized) return;

      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
        if (event === 'INITIAL_SESSION' && !session) {
          void clearBrokenSession();
          return;
        }
        setAuthStateSafeLocal({ status: 'unauthenticated' });
        return;
      }

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        void hydrateSessionAndProfile(session, queryClient, setAuthStateSafeLocal);
      }
    });

    void (async () => {
      if (resolvedAuthSnapshot && resolvedAuthSnapshot.status !== 'loading') {
        setAuthStateSafeLocal(resolvedAuthSnapshot);
        initialized = true;
        return;
      }
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (cancelled) return;
        const msg = String(error?.message || '');
        if (error && isBrokenSessionError(msg)) {
          await clearBrokenSession();
          return;
        }
        if (!session) {
          setAuthStateSafeLocal({ status: 'unauthenticated' });
          return;
        }
        const { error: userError } = await supabase.auth.getUser();
        if (userError && isBrokenSessionError(String(userError.message))) {
          await clearBrokenSession();
          return;
        }
        await hydrateSessionAndProfile(session, queryClient, setAuthStateSafeLocal);
      } catch (err) {
        if (!cancelled) {
          const msg = String(err instanceof Error ? err.message : err);
          if (isBrokenSessionError(msg)) await clearBrokenSession();
          else setAuthStateSafeLocal({ status: 'unauthenticated' });
        }
      } finally {
        initialized = true;
      }
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const actions = useMemo<AuthActions>(() => ({
    signIn: async (email: string, password: string) => {
      const logAttempt = async (body: { success?: boolean; checkOnly?: boolean }) => {
        if (!import.meta.env.PROD) return { ok: true as const, status: 200, errorMessage: null as string | null };
        try {
          const res = await fetch('/api/auth/log-attempt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (res.status === 429) {
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            return {
              ok: false as const,
              status: 429,
              errorMessage:
                data.error ||
                'Muitas tentativas de login. Tente novamente em alguns minutos.',
            };
          }
          return { ok: true as const, status: res.status, errorMessage: null };
        } catch {
          return { ok: true as const, status: 0, errorMessage: null };
        }
      };

      const pre = await logAttempt({ checkOnly: true });
      if (!pre.ok) {
        return { error: new Error(pre.errorMessage || 'Login temporariamente bloqueado.') };
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      let loginSuccess = !error;
      if (error) {
        const logged = await logAttempt({ success: false });
        if (!logged.ok) {
          return { error: new Error(logged.errorMessage || error.message) };
        }
        return { error };
      }
      if (data.session?.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('is_blocked')
          .eq('id', data.session.user.id)
          .maybeSingle();
        if (profileData?.is_blocked) {
          loginSuccess = false;
          await logAttempt({ success: false });
          await supabase.auth.signOut();
          setAuthStateSafe({ status: 'unauthenticated' });
          return { error: new Error('Usuário bloqueado. Entre em contato com o administrador.') };
        }
        await hydrateSessionAndProfile(data.session, queryClient, (s) => commitAuthState(setAuthState, s));
      }
      await logAttempt({ success: loginSuccess });
      return { error: null };
    },

    signUp: async (email: string, password: string, fullName: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/`, data: { full_name: fullName } },
      });
      return { error };
    },

    signOut: async () => {
      const userId = stateRef.current.status === 'authenticated' ? stateRef.current.user.id : null;
      await supabase.auth.signOut();
      if (userId) queryClient.removeQueries({ queryKey: profileKey(userId) });
      setAuthStateSafe({ status: 'unauthenticated' });
    },

    updateProfile: async (fullName: string) => {
      const u = stateRef.current.status === 'authenticated' ? stateRef.current.user : null;
      if (!u?.id) return { error: new Error('Usuário não autenticado') };
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() || null })
        .eq('id', u.id);
      if (!error) queryClient.invalidateQueries({ queryKey: profileKey(u.id) });
      return { error };
    },

    updateAvatar: async (avatarUrl: string | null) => {
      const u = stateRef.current.status === 'authenticated' ? stateRef.current.user : null;
      if (!u?.id) return { error: new Error('Usuário não autenticado') };
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl?.trim() || null })
        .eq('id', u.id);
      if (!error) queryClient.invalidateQueries({ queryKey: profileKey(u.id) });
      return { error };
    },

    updateTheme: async (theme: ThemePreference) => {
      const u = stateRef.current.status === 'authenticated' ? stateRef.current.user : null;
      if (!u?.id) return { error: new Error('Usuário não autenticado') };
      const { error } = await supabase.from('profiles').update({ theme }).eq('id', u.id);
      if (!error) queryClient.invalidateQueries({ queryKey: profileKey(u.id) });
      return { error };
    },

    updateAccentColor: async (accentColor: string | null) => {
      const u = stateRef.current.status === 'authenticated' ? stateRef.current.user : null;
      if (!u?.id) return { error: new Error('Usuário não autenticado') };
      const { error } = await supabase.from('profiles').update({ accent_color: accentColor }).eq('id', u.id);
      if (!error) queryClient.invalidateQueries({ queryKey: profileKey(u.id) });
      return { error };
    },

    updateThemePalette: async (themePalette: string | null) => {
      const u = stateRef.current.status === 'authenticated' ? stateRef.current.user : null;
      if (!u?.id) return { error: new Error('Usuário não autenticado') };
      const { error } = await supabase.from('profiles').update({ theme_palette: themePalette }).eq('id', u.id);
      if (!error) queryClient.invalidateQueries({ queryKey: profileKey(u.id) });
      return { error };
    },

    updateAppBranding: async (data: {
      app_name?: string | null;
      app_description?: string | null;
      app_logo_url?: string | null;
      professional_registry_body?: string | null;
      professional_registry_number?: string | null;
    }) => {
      const u = stateRef.current.status === 'authenticated' ? stateRef.current.user : null;
      if (!u?.id) return { error: new Error('Usuário não autenticado') };
      const { error } = await supabase.from('profiles').update(data).eq('id', u.id);
      if (!error) queryClient.invalidateQueries({ queryKey: profileKey(u.id) });
      return { error };
    },

    updateProfessionalClinicProfile: async (data: {
      date_of_birth?: string | null;
      phone?: string | null;
      professional_registry_body?: string | null;
      professional_registry_number?: string | null;
      professional_specialty?: string | null;
    }) => {
      const u = stateRef.current.status === 'authenticated' ? stateRef.current.user : null;
      if (!u?.id) return { error: new Error('Usuário não autenticado') };
      const { error } = await supabase.from('profiles').update(data).eq('id', u.id);
      if (!error) queryClient.invalidateQueries({ queryKey: profileKey(u.id) });
      return { error: error ? new Error(error.message) : null };
    },

    updateDefaultSignature: async (dataUrl: string | null) => {
      const u = stateRef.current.status === 'authenticated' ? stateRef.current.user : null;
      if (!u?.id) return { error: new Error('Usuário não autenticado') };
      const { error } = await supabase
        .from('profiles')
        .update({ default_signature_data: dataUrl?.trim() || null })
        .eq('id', u.id);
      if (!error) queryClient.invalidateQueries({ queryKey: profileKey(u.id) });
      return { error };
    },

    updateProfessionalStamp: async (dataUrl: string | null) => {
      const u = stateRef.current.status === 'authenticated' ? stateRef.current.user : null;
      if (!u?.id) return { error: new Error('Usuário não autenticado') };
      const { error } = await supabase
        .from('profiles')
        .update({ professional_stamp_data: dataUrl?.trim() || null })
        .eq('id', u.id);
      if (!error) queryClient.invalidateQueries({ queryKey: profileKey(u.id) });
      return { error };
    },

    updateWorkingHours: async (data: {
      work_start_time?: string | null;
      work_end_time?: string | null;
      work_days?: number[] | null;
      lunch_start_time?: string | null;
      lunch_end_time?: string | null;
      lunch_breaks?: Array<{ start: string; end: string }> | null;
    }) => {
      const u = stateRef.current.status === 'authenticated' ? stateRef.current.user : null;
      if (!u?.id) return { error: new Error('Usuário não autenticado') };
      const { error } = await supabase.from('profiles').update(data).eq('id', u.id);
      if (!error) queryClient.invalidateQueries({ queryKey: profileKey(u.id) });
      return { error };
    },
  }), [queryClient]);

  const stateValue = authState;

  return (
    <AuthStateContext.Provider value={stateValue}>
      <AuthActionsContext.Provider value={actions}>
        {children}
      </AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  );
}

export function useAuthState() {
  const context = useContext(AuthStateContext);
  if (context === undefined) throw new Error('useAuthState must be used within an AuthProvider');
  return context;
}

export function useAuthActions() {
  const context = useContext(AuthActionsContext);
  if (context === undefined) throw new Error('useAuthActions must be used within an AuthProvider');
  return context;
}

/**
 * Hook unificado: estado + ações + profile do React Query.
 * Profile vem do cache (preenchido pelo AuthProvider antes de authenticated).
 * Layout autenticado nunca pinta sem profile (gate no provider).
 */
export function useAuth() {
  const state = useAuthState();
  const actions = useAuthActions();
  const userId = state.status === 'authenticated' ? state.user.id : undefined;
  const { data: profile } = useProfile(userId);

  return useMemo(() => {
    const base = {
      ...actions,
      loading: state.status === 'loading',
      user: state.status === 'authenticated' ? state.user : null,
      session: state.status === 'authenticated' ? state.session : null,
      profile: state.status === 'authenticated' ? profile ?? null : null,
    };
    return base;
  }, [state, actions, profile]);
}
