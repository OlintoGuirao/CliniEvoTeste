import { describe, expect, it } from 'vitest';
import { isIndicationOriginName } from './clinicPatientOrigin';

describe('isIndicationOriginName', () => {
  it('reconhece Indicação com e sem acento', () => {
    expect(isIndicationOriginName('Indicação')).toBe(true);
    expect(isIndicationOriginName('indicacao')).toBe(true);
    expect(isIndicationOriginName('INDICAÇÃO')).toBe(true);
  });

  it('não trata outras origens como indicação', () => {
    expect(isIndicationOriginName('Instagram')).toBe(false);
    expect(isIndicationOriginName('Google')).toBe(false);
    expect(isIndicationOriginName('')).toBe(false);
  });
});
