import { Loader2 } from 'lucide-react';

export interface AppLoaderProps {
  /** Optional message below the spinner */
  message?: string;
  /** Optional class name for the container */
  className?: string;
}

/**
 * Global app loading state. Uses theme-aware Tailwind classes (bg-background, text-primary)
 * so it respects CSS variables applied before React mounts (e.g. from index.html script).
 */
export function AppLoader({ message, className = '' }: AppLoaderProps) {
  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground ${className}`}
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
      {message ? (
        <p className="text-sm font-medium text-foreground/80">{message}</p>
      ) : null}
    </div>
  );
}
