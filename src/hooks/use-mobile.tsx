import * as React from 'react';
import { NAV_BREAKPOINT_PX } from '@/lib/breakpoints';

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${NAV_BREAKPOINT_PX - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < NAV_BREAKPOINT_PX);
    };
    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < NAV_BREAKPOINT_PX);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!isMobile;
}
