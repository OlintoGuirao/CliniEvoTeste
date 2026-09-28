import { Loader2 } from 'lucide-react';

interface PageLoadingProps {
  /** Texto exibido abaixo do spinner. */
  message?: string;
  /** Classe opcional no container. */
  className?: string;
  /**
   * Se true, cobre a tela inteira (incluindo header/sidebar).
   * Nada é exibido até os dados carregarem — só então o conteúdo da página aparece.
   */
  fullScreen?: boolean;
}

/**
 * Tela de carregamento. Com fullScreen, cobre toda a interface e só mostra o conteúdo após carregar.
 */
export function PageLoading({
  message = 'Carregando...',
  className = '',
  fullScreen = true,
}: PageLoadingProps) {
  const content = (
    <>
      <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
      <p className="text-sm font-medium text-foreground/80">{message}</p>
    </>
  );

  if (fullScreen) {
    return (
      <div
        className={`fixed inset-0 z-[2000] flex flex-col items-center justify-center gap-4 bg-background ${className}`}
        aria-live="polite"
        aria-busy="true"
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-[280px] flex-col items-center justify-center gap-4 py-12 text-muted-foreground ${className}`}
      aria-live="polite"
      aria-busy="true"
    >
      {content}
    </div>
  );
}
