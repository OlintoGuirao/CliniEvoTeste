import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUiCopy, type UiCopy } from '@/lib/uiCopy';
import { isSalonAccount } from '@/lib/accountType';

/**
 * Labels da UI. Só muda para conta salão.
 * Clínica e profissional único sempre veem Consulta / Pacientes / Clínica.
 */
export function useUiCopy(): UiCopy & { isSalon: boolean } {
  const { profile } = useAuth();
  return useMemo(() => {
    const isSalon = isSalonAccount(profile?.account_type);
    return { ...getUiCopy(isSalon ? 'salon' : 'solo'), isSalon };
  }, [profile?.account_type]);
}
