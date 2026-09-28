import { describe, expect, it } from 'vitest';
import { filterSalonProceduresByQuery } from './salonProcedureSearch';

const PROCEDURES = [
  { id: '1', name: 'Coloração' },
  { id: '2', name: 'Corte feminino' },
  { id: '3', name: 'Corte masculino' },
  { id: '4', name: 'Escova' },
  { id: '5', name: 'Hidratação de corte' },
];

describe('filterSalonProceduresByQuery', () => {
  it('filtra pelo começo do nome, como Cor → Corte', () => {
    const results = filterSalonProceduresByQuery(PROCEDURES, 'Cor');
    expect(results.map((p) => p.name)).toEqual([
      'Corte feminino',
      'Corte masculino',
      'Hidratação de corte',
    ]);
  });

  it('ignora acentos e maiúsculas', () => {
    const results = filterSalonProceduresByQuery(
      [{ id: '1', name: 'Escova Progressiva' }],
      'esc'
    );
    expect(results).toHaveLength(1);
  });

  it('sem texto devolve a lista', () => {
    expect(filterSalonProceduresByQuery(PROCEDURES, '').map((p) => p.id)).toEqual(
      PROCEDURES.map((p) => p.id)
    );
  });
});
