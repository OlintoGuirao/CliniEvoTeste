import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ReactNode } from 'react';

const ROW_HEIGHT_ESTIMATE = 420;
const OVERSCAN = 3;

/**
 * Renders only visible rows when the list is large (e.g. 200+).
 * Use for large lists to keep rendering performant.
 */
export function VirtualizedPatientList({
  children,
  count,
  className = '',
}: {
  children: (index: number) => ReactNode;
  count: number;
  className?: string;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    overscan: OVERSCAN,
  });

  return (
    <div ref={parentRef} className={`h-[70vh] overflow-auto ${className}`}>
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full px-1"
            style={{
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {children(virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
