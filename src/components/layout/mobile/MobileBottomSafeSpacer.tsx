interface MobileBottomSafeSpacerProps {
  className?: string;
}

export function MobileBottomSafeSpacer({ className }: MobileBottomSafeSpacerProps) {
  const baseClass =
    'nav:hidden h-[calc(var(--mobile-bottom-nav-height)+var(--mobile-bottom-safe-gap)+env(safe-area-inset-bottom))]';
  return <div className={className ? `${baseClass} ${className}` : baseClass} aria-hidden />;
}
