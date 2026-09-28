import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

/** Props passadas pelo Recharts para o dot customizado */
export interface ChartDotProps {
  cx?: number;
  cy?: number;
  payload?: unknown;
  index?: number;
}

/**
 * Comportamento padronizado de gráficos (Recharts Line) no mobile:
 * - Pontos maiores para melhor toque
 * - Tooltip com trigger "click" no mobile (tap abre o tooltip)
 * - Dot com pointer-events: none no mobile para o toque passar ao gráfico
 */
export function useChartMobileBehavior() {
  const isMobile = useIsMobile();
  const chartDotRadius = isMobile ? 12 : 4;
  const tooltipTrigger: 'click' | 'hover' = isMobile ? 'click' : 'hover';

  const renderChartDot = (props: ChartDotProps) => {
    const { cx = 0, cy = 0 } = props;
    return (
      <g style={isMobile ? { pointerEvents: 'none' } : undefined}>
        <circle
          cx={cx}
          cy={cy}
          r={chartDotRadius}
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="#fff"
        />
      </g>
    );
  };

  return {
    isMobile,
    chartDotRadius,
    tooltipTrigger,
    renderChartDot,
  };
}
