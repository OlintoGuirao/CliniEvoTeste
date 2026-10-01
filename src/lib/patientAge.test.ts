import { describe, expect, it } from 'vitest';
import { isPatientMinor } from '@/lib/patientAge';

describe('isPatientMinor', () => {
  const today = new Date(2026, 8, 28); // 28/09/2026

  it('retorna false sem data', () => {
    expect(isPatientMinor(null, today)).toBe(false);
    expect(isPatientMinor(undefined, today)).toBe(false);
  });

  it('considera menor quem ainda não completou 18 anos', () => {
    expect(isPatientMinor('2008-09-29', today)).toBe(true);
    expect(isPatientMinor('2010-01-01', today)).toBe(true);
  });

  it('considera adulto no dia do 18º aniversário', () => {
    expect(isPatientMinor('2008-09-28', today)).toBe(false);
    expect(isPatientMinor('2008-09-27', today)).toBe(false);
  });

  it('aceita Date', () => {
    expect(isPatientMinor(new Date(2012, 0, 15), today)).toBe(true);
  });
});
