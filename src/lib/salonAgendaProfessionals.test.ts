import { describe, expect, it } from 'vitest';
import {
  resolveSalonAgendaDisplayLabel,
  sortSalonAgendaMembers,
} from '@/lib/salonAgendaProfessionals';

describe('salonAgendaProfessionals', () => {
  it('usa apelido quando definido', () => {
    expect(
      resolveSalonAgendaDisplayLabel({
        full_name: 'Zé du Corte',
        agenda_label_nickname: 'Zé',
      })
    ).toBe('Zé');
  });

  it('ordena por agenda_sort_order', () => {
    const sorted = sortSalonAgendaMembers([
      {
        user_id: 'a',
        full_name: 'Master',
        role: 'owner',
        agenda_sort_order: 1,
      },
      {
        user_id: 'b',
        full_name: 'Zé du Corte',
        role: 'professional',
        agenda_sort_order: 0,
      },
    ]);
    expect(sorted.map((m) => m.user_id)).toEqual(['b', 'a']);
  });
});
