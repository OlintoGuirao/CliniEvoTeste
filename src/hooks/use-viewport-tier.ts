import { useState, useEffect } from 'react';
import { DESKTOP_MIN_PX, NAV_BREAKPOINT_PX } from '@/lib/breakpoints';

export const TABLET_MIN_PX = NAV_BREAKPOINT_PX;
export { DESKTOP_MIN_PX };

export type ViewportTier = 'mobile' | 'desktop';

function resolveTier(width: number): ViewportTier {
  if (width < NAV_BREAKPOINT_PX) return 'mobile';
  return 'desktop';
}

/**
 * - mobile: < 1024 — menu celular (hambúrguer + bottom nav); inclui iPad portrait
 * - desktop: ≥ 1024 — sidebar completa
 */
export function useViewportTier(): ViewportTier {
  const [tier, setTier] = useState<ViewportTier>(() => {
    if (typeof window === 'undefined') return 'mobile';
    return resolveTier(window.innerWidth);
  });

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${NAV_BREAKPOINT_PX}px)`);
    const sync = () => setTier(resolveTier(window.innerWidth));
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return tier;
}
