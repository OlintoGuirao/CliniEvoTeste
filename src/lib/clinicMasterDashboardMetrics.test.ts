import { describe, expect, it } from 'vitest';
import {
  computeComparison,
  computeConversionRate,
  computeTicketMedio,
  previousPeriod,
} from '@/lib/clinicMasterDashboardMetrics';

describe('clinicMasterDashboardMetrics', () => {
  it('calcula período anterior com mesma duração', () => {
    const prev = previousPeriod('2026-03-01', '2026-03-31');
    expect(prev.dataFim).toBe('2026-02-28');
    expect(prev.dataInicio).toBe('2026-01-29');
  });

  it('computa comparação percentual', () => {
    const c = computeComparison(120, 100);
    expect(c.deltaPercent).toBe(20);
    expect(c.trend).toBe('up');
  });

  it('evita divisão por zero na conversão', () => {
    const c = computeConversionRate(5, 0);
    expect(c.ratePercent).toBeNull();
    expect(c.denominator).toBe(0);
  });

  it('calcula ticket médio', () => {
    expect(computeTicketMedio(1000, 4)).toBe(250);
    expect(computeTicketMedio(1000, 0)).toBeNull();
  });
});
