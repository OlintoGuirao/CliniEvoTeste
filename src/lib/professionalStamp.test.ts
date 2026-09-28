import { describe, expect, it } from 'vitest';
import {
  formatProfessionalStampRegistry,
  formatProfessionalStampTitle,
} from './professionalStamp';

describe('formatProfessionalStampRegistry', () => {
  it('monta formato físico CRO-UF número', () => {
    expect(formatProfessionalStampRegistry('CRO', '23044-GO')).toBe('CRO-GO 23044');
  });

  it('aceita registro já no formato UF - número', () => {
    expect(formatProfessionalStampRegistry('CRO', 'GO - 23044')).toBe('CRO-GO 23044');
  });

  it('retorna vazio sem dados', () => {
    expect(formatProfessionalStampRegistry(null, null)).toBe('');
  });
});

describe('formatProfessionalStampTitle', () => {
  it('usa Cirurgiã Dentista para CRO sem especialidade', () => {
    expect(formatProfessionalStampTitle('CRO', null)).toBe('Cirurgiã Dentista');
  });

  it('usa especialidade quando informada', () => {
    expect(formatProfessionalStampTitle('CRO', 'Implantodontista')).toBe('Implantodontista');
  });

  it('mapeia Dentista/Clínico geral para Cirurgiã Dentista no CRO', () => {
    expect(formatProfessionalStampTitle('CRO', 'Dentista')).toBe('Cirurgiã Dentista');
    expect(formatProfessionalStampTitle('CRO', 'Clínico geral')).toBe('Cirurgiã Dentista');
  });
});
