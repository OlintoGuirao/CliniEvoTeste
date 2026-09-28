import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, FileQuestion } from 'lucide-react';

/**
 * Página pública que exibe o PDF de resumo de evolução a partir de um slug curto.
 * Aceita slug no path (/r/abc123) ou na query (/r?slug=abc123) para evitar truncamento no WhatsApp.
 * Mantém "Carregando..." até o redirecionamento terminar (evita flash de "Link inválido").
 */
export default function VerResumoPage() {
  const { slug: slugParam } = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const slug = (slugParam?.trim() || searchParams.get('slug')?.trim() || searchParams.get('id')?.trim() || '').toLowerCase();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (!slug) {
      setError(true);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('evolution_pdf_links')
          .select('storage_path')
          .eq('slug', slug.trim())
          .maybeSingle();

        if (fetchError || !data?.storage_path) {
          setError(true);
          setLoading(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from('evolution-pdfs')
          .getPublicUrl(data.storage_path);

        // No mobile: abrir o PDF direto (redirecionar) em vez de mostrar iframe na app
        if (typeof window !== 'undefined' && urlData?.publicUrl) {
          redirectingRef.current = true;
          window.location.replace(urlData.publicUrl);
          return;
        }
        setPdfUrl(urlData.publicUrl);
      } catch {
        setError(true);
      } finally {
        if (!redirectingRef.current) setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (error || !pdfUrl) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-4">
        <FileQuestion className="h-14 w-14 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-semibold text-foreground">Link inválido ou expirado</h1>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Este link do resumo de evolução não existe ou não está mais disponível.
        </p>
        <p className="text-xs text-muted-foreground text-center max-w-sm mt-2">
          Se você abriu pelo WhatsApp, tente tocar longo no link e “Abrir link” ou copie o link completo e cole no navegador.
        </p>
      </div>
    );
  }

  // Fallback (ex.: quando replace não ocorreu): exibir iframe
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <iframe
        title="Resumo da Evolução"
        src={pdfUrl}
        className="w-full flex-1 border-0 min-h-[100vh]"
      />
    </div>
  );
}
