import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

type BrowserNavTab = {
  to: string;
  label: string;
  shortLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
};

type BrowserNavTabsProps = {
  tabs: readonly BrowserNavTab[];
  'aria-label'?: string;
};

export function BrowserNavTabs({ tabs, 'aria-label': ariaLabel }: BrowserNavTabsProps) {
  return (
    <div
      className="flex justify-start border-b border-border bg-muted/30 px-2 pt-2"
      role="navigation"
      aria-label={ariaLabel}
    >
      <div className="inline-flex items-end justify-start gap-0.5">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                'relative inline-flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-medium',
                'rounded-t-lg border border-transparent border-b-0 transition-all',
                'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isActive
                  ? 'z-10 -mb-px border-border bg-card text-foreground shadow-[0_-1px_0_0_hsl(var(--card))]'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              )
            }
          >
            {tab.icon ? <tab.icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.shortLabel ?? tab.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
