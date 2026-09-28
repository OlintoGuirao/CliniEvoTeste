import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Subscribes to Supabase realtime for patients and procedure_instances.
 * Invalidates React Query cache when data changes so the UI stays in sync
 * (e.g. when another tab or device creates/updates/deletes a patient).
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();
  const professionalId = profile?.id ?? user?.id;

  useEffect(() => {
    if (!professionalId) return;

    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patients',
          filter: `professional_id=eq.${professionalId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.patientList(professionalId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(professionalId) });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'procedure_instances',
          filter: `professional_id=eq.${professionalId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.patientList(professionalId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.futureClientIds(professionalId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(professionalId) });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `professional_id=eq.${professionalId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(professionalId) });
          window.dispatchEvent(new CustomEvent('agenda:refresh'));
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patient_sessions',
          filter: `professional_id=eq.${professionalId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(professionalId) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [professionalId, queryClient]);

  return <>{children}</>;
}
