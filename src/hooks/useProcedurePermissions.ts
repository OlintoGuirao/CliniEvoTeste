import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  fetchProcedurePermissions,
  upsertProcedurePermission,
  logAdminActivity,
  type Profile,
  type Procedure,
  type Permission,
} from '@/services/api/adminApi';
import { MENU_PROCEDURES_QUERY_KEY } from '@/components/layout/AppSidebar';

const DEBOUNCE_MS = 400;

export type ProcedurePermissionsData = {
  profiles: Profile[];
  procedures: Procedure[];
  permissions: Permission[];
};

function buildPermissionMap(permissions: Permission[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const p of permissions) {
    map.set(`${p.profile_id}:${p.procedure_id}`, p.visible);
  }
  return map;
}

function getVisible(
  permMap: Map<string, boolean>,
  profileId: string,
  procedureId: string
): boolean {
  const key = `${profileId}:${procedureId}`;
  if (permMap.has(key)) return permMap.get(key)!;
  // Fallback seguro: sem registro explicito, o procedimento permanece visivel.
  // Isso evita "desativar tudo" ao salvar apenas um item.
  return true;
}

export type UseProcedurePermissionsOptions = {
  adminEmail?: string;
  onSaved?: () => void;
};

/**
 * Hook para o painel admin: carrega e atualiza permissões via Supabase (mesma porta do app).
 * Só deve ser usado quando o usuário é admin@clinievo.com.br (RLS garante no backend).
 */
export function useProcedurePermissions(enabled: boolean, options?: UseProcedurePermissionsOptions) {
  const { adminEmail, onSaved } = options ?? {};
  const queryClient = useQueryClient();
  const [data, setData] = useState<ProcedurePermissionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchProcedurePermissions();
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const permMap = data ? buildPermissionMap(data.permissions) : new Map<string, boolean>();
  const isVisible = useCallback(
    (profileId: string, procedureId: string) =>
      getVisible(permMap, profileId, procedureId),
    [permMap]
  );

  const updatePermission = useCallback(
    (profileId: string, procedureId: string, visible: boolean) => {
      if (!data || !enabled) return;

      const key = `${profileId}:${procedureId}`;
      setData((prev) => {
        if (!prev) return prev;
        const existing = prev.permissions.find(
          (p) => p.profile_id === profileId && p.procedure_id === procedureId
        );
        const nextPerms = prev.permissions.filter(
          (p) => !(p.profile_id === profileId && p.procedure_id === procedureId)
        );
        nextPerms.push({
          ...(existing ?? {}),
          profile_id: profileId,
          procedure_id: procedureId,
          visible,
          id: existing?.id ?? '',
        } as Permission);
        return { ...prev, permissions: [...nextPerms] };
      });

      const debounceKey = key;
      if (debounceRef.current[debounceKey]) clearTimeout(debounceRef.current[debounceKey]);
      debounceRef.current[debounceKey] = setTimeout(async () => {
        setSavingId(debounceKey);
        try {
          await upsertProcedurePermission({ profileId, procedureId, visible });
          queryClient.invalidateQueries({ queryKey: MENU_PROCEDURES_QUERY_KEY });
          onSaved?.();
          if (adminEmail) {
            logAdminActivity({
              action: 'update',
              entity_type: 'permission',
              entity_id: `${profileId}:${procedureId}`,
              details: { profileId, procedureId, visible },
              admin_email: adminEmail,
            }).catch(() => {});
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Erro ao salvar');
        } finally {
          setSavingId(null);
          delete debounceRef.current[debounceKey];
        }
      }, DEBOUNCE_MS);
    },
    [data, enabled]
  );

  return {
    data,
    loading,
    error,
    savingId,
    isVisible,
    updatePermission,
    refetch: load,
  };
}

export function useIsAdmin(userEmail: string | undefined): boolean {
  return userEmail === 'admin@clinievo.com.br';
}
