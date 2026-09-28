import { useQuery, useQueryClient } from '@tanstack/react-query';
import { profileKey } from '@/api/queryKeys';
import { getProfile } from '@/api/profiles';

/**
 * Perfil do usuário via React Query.
 * enabled: !!userId — evita request quando não há usuário.
 * O AuthProvider prefaz setQueryData antes de setar status 'authenticated',
 * então no primeiro paint do layout o cache já está preenchido (sem flash).
 */
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: profileKey(userId ?? ''),
    queryFn: () => getProfile(userId!),
    enabled: !!userId?.trim(),
  });
}

/**
 * Invalida o cache do perfil (após updateProfile, updateAvatar, etc.).
 * Use no AuthContext após mutações que alteram o perfil.
 */
export function useInvalidateProfile() {
  const queryClient = useQueryClient();
  return (userId: string) => queryClient.invalidateQueries({ queryKey: profileKey(userId) });
}
