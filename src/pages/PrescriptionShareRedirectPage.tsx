import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

function decodeBase64Url(token: string): string | null {
  try {
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return decodeURIComponent(escape(atob(padded)));
  } catch {
    return null;
  }
}

export default function PrescriptionShareRedirectPage() {
  const [error, setError] = useState<string | null>(null);

  const token = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('f');
  }, []);

  useEffect(() => {
    if (!token) {
      setError('Link inválido.');
      return;
    }

    const filePath = decodeBase64Url(token);
    if (!filePath) {
      setError('Link inválido.');
      return;
    }

    const { data } = supabase.storage.from('patient-exams').getPublicUrl(filePath);
    if (!data?.publicUrl) {
      setError('Arquivo não encontrado.');
      return;
    }

    window.location.replace(data.publicUrl);
  }, [token]);

  return (
    <div className="min-h-[60vh] grid place-items-center px-6">
      <p className="text-sm text-muted-foreground">{error ?? 'Abrindo receituário...'}</p>
    </div>
  );
}
