import { describe, expect, it } from 'vitest';
import { normalizeSearchText, searchBrazilianCities } from './brazilianCities';

const SAMPLE_CITIES = ['Ribeirão Preto', 'Rio de Janeiro', 'São Paulo', 'Ribeirão Pires'];

describe('brazilianCities', () => {
  it('normaliza texto sem acentos', () => {
    expect(normalizeSearchText('São Paulo')).toBe('sao paulo');
  });

  it('filtra cidades por trecho digitado', () => {
    const results = searchBrazilianCities(SAMPLE_CITIES, 'Ribe');
    expect(results).toEqual(['Ribeirão Preto', 'Ribeirão Pires']);
  });

  it('prioriza cidades que começam com o termo', () => {
    const results = searchBrazilianCities(['Barra do Ribeiro', 'Ribeirão Preto'], 'ribe');
    expect(results[0]).toBe('Ribeirão Preto');
  });
});
