import { describe, expect, it } from 'vitest';
import {
  deciduousToPermanentFdi,
  permanentToDeciduousFdi,
  resolveToothNumberForDeciduousCondition,
  resolveToothNumberForPermanentCondition,
  isValidFdiTooth,
  facesForTooth,
} from './dentalFdi';

describe('dentalFdi', () => {
  it('converte permanente ↔ decíduo no padrão FDI', () => {
    expect(permanentToDeciduousFdi('11')).toBe('51');
    expect(permanentToDeciduousFdi('25')).toBe('65');
    expect(permanentToDeciduousFdi('36')).toBeNull();
    expect(deciduousToPermanentFdi('51')).toBe('11');
    expect(deciduousToPermanentFdi('85')).toBe('45');
  });

  it('resolve número ao marcar decíduo/permanente', () => {
    expect(resolveToothNumberForDeciduousCondition('14')).toBe('54');
    expect(resolveToothNumberForDeciduousCondition('54')).toBe('54');
    expect(resolveToothNumberForDeciduousCondition('18')).toBe('18');
    expect(resolveToothNumberForPermanentCondition('61')).toBe('21');
    expect(resolveToothNumberForPermanentCondition('21')).toBe('21');
  });

  it('valida FDI e faces por tipo de dente', () => {
    expect(isValidFdiTooth('11')).toBe(true);
    expect(isValidFdiTooth('99')).toBe(false);
    expect(facesForTooth('11')).toContain('I');
    expect(facesForTooth('16')).toContain('O');
  });
});
