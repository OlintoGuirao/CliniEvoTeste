import { describe, expect, it, vi, afterEach } from 'vitest';
import { cepDigits, formatCepDisplay, isCompleteCep, lookupCep } from './viaCep';

describe('viaCep', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('extrai só os dígitos do CEP', () => {
    expect(cepDigits('14.015-000')).toBe('14015000');
    expect(cepDigits('14015-000 extra')).toBe('14015000');
  });

  it('formata o CEP para exibição', () => {
    expect(formatCepDisplay('14015')).toBe('14015');
    expect(formatCepDisplay('14015000')).toBe('14015-000');
  });

  it('reconhece CEP completo', () => {
    expect(isCompleteCep('14015-000')).toBe(true);
    expect(isCompleteCep('14015-00')).toBe(false);
  });

  it('consulta a ViaCEP e monta o endereço', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          cep: '14015-000',
          logradouro: 'Rua São Sebastião',
          bairro: 'Centro',
          localidade: 'Ribeirão Preto',
          uf: 'SP',
        }),
      })
    );

    await expect(lookupCep('14015-000')).resolves.toEqual({
      zipCode: '14015000',
      street: 'Rua São Sebastião',
      neighborhood: 'Centro',
      city: 'Ribeirão Preto - SP',
      state: 'SP',
    });
  });

  it('retorna null quando o CEP não existe', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ erro: true }),
      })
    );

    await expect(lookupCep('00000000')).resolves.toBeNull();
  });
});
