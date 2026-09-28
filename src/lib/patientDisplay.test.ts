import { describe, expect, it } from 'vitest';
import { formatPatientDisplayName, patientMatchesSearch } from './patientDisplay';

describe('patientDisplay', () => {
  it('formata nome com apelido', () => {
    expect(formatPatientDisplayName('fabiola ferreira', 'Fabii')).toBe('Fabiola Ferreira (Fabii)');
  });

  it('encontra cliente pelo apelido', () => {
    const patient = { full_name: 'Fabiola Ferreira', nickname: 'Fabii', phone: '11999999999' };
    expect(patientMatchesSearch(patient, 'Fabii')).toBe(true);
    expect(patientMatchesSearch(patient, 'fabi')).toBe(true);
    expect(patientMatchesSearch(patient, 'Maria')).toBe(false);
  });
});
