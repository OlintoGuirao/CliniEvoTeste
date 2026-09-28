import { describe, expect, it } from 'vitest';
import { matchClinicProcedurePrices } from './clinicProcedurePriceImport';

describe('matchClinicProcedurePrices', () => {
  it('casa por nome normalizado e lista faltantes', () => {
    const catalog = [
      { id: '1', name: 'Limpeza Infantil' },
      { id: '2', name: 'Exodontia I' },
    ];
    const { matched, missing } = matchClinicProcedurePrices(
      [
        { name: 'limpeza infantil', price: 120, rowNumber: 2 },
        { name: 'Procedimento Inexistente', price: 50, rowNumber: 3 },
        { name: 'Exodontia I', price: 200, rowNumber: 4 },
      ],
      catalog
    );
    expect(matched).toHaveLength(2);
    expect(matched.map((m) => m.procedure.id).sort()).toEqual(['1', '2']);
    expect(missing).toHaveLength(1);
    expect(missing[0]?.name).toBe('Procedimento Inexistente');
  });
});
