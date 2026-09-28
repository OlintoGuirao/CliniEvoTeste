import { useEffect, useState } from 'react';

/**
 * Returns false during SSR / initial render, true after React has mounted.
 * Use in theme-dependent or client-only components to prevent hydration mismatch
 * and theme flicker (e.g. avoid rendering theme-sensitive UI until mounted).
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
