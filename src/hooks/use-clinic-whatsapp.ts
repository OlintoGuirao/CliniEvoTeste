import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchEvolutionConnection,
  requestEvolutionQr,
  type EvolutionConnectionPayload,
} from '@/lib/evolutionConnection';

export function useClinicWhatsapp(professionalId: string | undefined) {
  const [qr, setQr] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const pollRef = useRef(false);

  const connectionQuery = useQuery({
    queryKey: ['clinic-whatsapp-connection', professionalId],
    enabled: Boolean(professionalId),
    queryFn: async () => {
      const result = await fetchEvolutionConnection(professionalId!);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    staleTime: 15_000,
    refetchInterval: (query) => {
      const connected = Boolean((query.state.data as EvolutionConnectionPayload | undefined)?.connected);
      return connected ? false : 8_000;
    },
  });

  const connected = Boolean(connectionQuery.data?.connected);

  useEffect(() => {
    if (connected) {
      setQr(null);
    }
  }, [connected]);

  const refresh = useCallback(async () => {
    await connectionQuery.refetch();
  }, [connectionQuery]);

  const connect = useCallback(async () => {
    if (!professionalId || pollRef.current) return;
    setLoadingQr(true);
    setConnectError(null);
    try {
      const result = await requestEvolutionQr(professionalId);
      if (!result.ok) {
        setConnectError(result.error);
        return;
      }
      const data = result.data;
      if (data.connected) {
        setQr(null);
        await refresh();
        return;
      }
      if (typeof data.qr === 'string' && data.qr) {
        setQr(data.qr);
      }
      await refresh();
    } finally {
      setLoadingQr(false);
    }
  }, [professionalId, refresh]);

  const connectionError =
    connectionQuery.error instanceof Error ? connectionQuery.error.message : null;

  return {
    connected,
    qr,
    loadingQr,
    checking: connectionQuery.isLoading || connectionQuery.isFetching,
    error: connectError || connectionError,
    refresh,
    connect,
  };
}
