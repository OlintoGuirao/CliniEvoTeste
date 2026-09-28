import { describe, expect, it } from 'vitest';
import {
  inferRegionFromTeeth,
  matchCatalogProcedure,
  resolveQuickProcedureContext,
  DENTAL_QUICK_PROCEDURES,
} from './dentalQuickActions';

describe('dentalQuickActions', () => {
  it('infere região a partir dos dentes', () => {
    expect(inferRegionFromTeeth(['11', '21'])).toBe('upper_arch');
    expect(inferRegionFromTeeth(['36', '46'])).toBe('lower_arch');
    expect(inferRegionFromTeeth(['11', '36'])).toBe('both_arches');
  });

  it('casa procedimento do catálogo por termo', () => {
    const catalog = [
      { id: '1', name: 'Restauração em resina' },
      { id: '2', name: 'Profilaxia / Limpeza' },
    ];
    const rest = DENTAL_QUICK_PROCEDURES.find((p) => p.key === 'restauracao')!;
    const limp = DENTAL_QUICK_PROCEDURES.find((p) => p.key === 'limpeza')!;
    expect(matchCatalogProcedure(catalog, rest)?.id).toBe('1');
    expect(matchCatalogProcedure(catalog, limp)?.id).toBe('2');
  });

  it('resolve contexto de restauração, limpeza, canal e implante', () => {
    const restauracao = DENTAL_QUICK_PROCEDURES.find((p) => p.key === 'restauracao')!;
    const limpeza = DENTAL_QUICK_PROCEDURES.find((p) => p.key === 'limpeza')!;
    const canal = DENTAL_QUICK_PROCEDURES.find((p) => p.key === 'canal')!;
    const implante = DENTAL_QUICK_PROCEDURES.find((p) => p.key === 'implante')!;

    expect(
      resolveQuickProcedureContext({
        preset: restauracao,
        selectedTeeth: ['16'],
        hasFaces: true,
        absentTeeth: [],
      })
    ).toMatchObject({ selectionType: 'individual', clearFaces: false });

    expect(
      resolveQuickProcedureContext({
        preset: limpeza,
        selectedTeeth: ['11', '21'],
        hasFaces: false,
        absentTeeth: [],
      })
    ).toMatchObject({ selectionType: 'region', region: 'upper_arch', clearFaces: true });

    expect(
      resolveQuickProcedureContext({
        preset: canal,
        selectedTeeth: ['16'],
        hasFaces: true,
        absentTeeth: [],
      })
    ).toMatchObject({ selectionType: 'individual', clearFaces: true });

    expect(
      resolveQuickProcedureContext({
        preset: implante,
        selectedTeeth: [],
        hasFaces: false,
        absentTeeth: ['16'],
      })
    ).toMatchObject({ selectionType: 'region' });
  });
});
