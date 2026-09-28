import { describe, expect, it } from 'vitest';
import {
  parseRegistryNumberAndUf,
  resolveRegistryNumber,
  emptyMemberRoleDraft,
} from '@/components/clinic/ClinicMemberRoleFields';

describe('registry number + UF', () => {
  it('parseia UF no prefixo', () => {
    expect(parseRegistryNumberAndUf('MS - 0103')).toEqual({
      registryUf: 'MS',
      registryNumber: '0103',
    });
  });

  it('parseia UF no sufixo', () => {
    expect(parseRegistryNumberAndUf('123456-SP')).toEqual({
      registryNumber: '123456',
      registryUf: 'SP',
    });
  });

  it('monta formato número-estado', () => {
    const draft = { ...emptyMemberRoleDraft(), registryNumber: '0103', registryUf: 'MS' };
    expect(resolveRegistryNumber(draft)).toBe('0103-MS');
  });
});
