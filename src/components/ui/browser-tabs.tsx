import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const BrowserTabs = TabsPrimitive.Root;

const BrowserTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <div className="border-b border-border/70 bg-muted/35 px-1.5 pt-1.5 md:px-2 md:pt-2">
    <div className="overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <TabsPrimitive.List
        ref={ref}
        className={cn(
          'inline-flex h-auto w-max min-w-full items-end justify-start gap-0.5 bg-transparent p-0 pr-1 text-muted-foreground',
          className
        )}
        {...props}
      />
    </div>
  </div>
));
BrowserTabsList.displayName = 'BrowserTabsList';

const BrowserTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-2 md:px-4 md:py-2.5',
      'text-xs md:text-sm font-medium min-h-[40px] md:min-h-[42px] touch-manipulation',
      'rounded-t-lg border border-transparent border-b-0 transition-all',
      'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=inactive]:border-b-border data-[state=inactive]:bg-muted/55 data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/80',
      'data-[state=active]:z-10 data-[state=active]:-mb-px data-[state=active]:border-border data-[state=active]:border-b-card data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_0_0_hsl(var(--card))]',
      className
    )}
    {...props}
  />
));
BrowserTabsTrigger.displayName = 'BrowserTabsTrigger';

const BrowserTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-0 rounded-b-xl border border-t-0 border-border bg-muted/20 p-4 sm:p-5',
      'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
BrowserTabsContent.displayName = 'BrowserTabsContent';

export { BrowserTabs, BrowserTabsList, BrowserTabsTrigger, BrowserTabsContent };
