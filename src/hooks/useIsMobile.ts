import { useState, useEffect } from 'react';
import { NAV_BREAKPOINT_PX } from '@/lib/breakpoints';

/**
 * Hook para detectar viewport “phone” (largura < 744px).
 * iPad Mini/Air usam sidebar; só phones usam bottom nav.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth < NAV_BREAKPOINT_PX;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${NAV_BREAKPOINT_PX - 1}px)`);
    const handler = () => setIsMobile(mql.matches);
    handler();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

export const MOBILE_BREAKPOINT_PX = NAV_BREAKPOINT_PX;
