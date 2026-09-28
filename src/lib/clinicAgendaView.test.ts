import { describe, expect, it } from 'vitest';
import { addDays, startOfWeek } from 'date-fns';
import {
  clinicAgendaVisibleDays,
  nextWorkingDay,
  stepToWorkingDay,
} from './clinicAgendaView';

const WEEKDAYS = new Set([1, 2, 3, 4, 5]);

describe('clinicAgendaView', () => {
  it('pula sábado e domingo fechados', () => {
    const saturday = new Date(2026, 8, 5); // sáb 5 set 2026
    expect(stepToWorkingDay(saturday, WEEKDAYS, 1).getDay()).toBe(1);
    expect(nextWorkingDay(saturday, WEEKDAYS, 1).getDay()).toBe(1);
  });

  it('não lista sábado nem domingo na semana', () => {
    const weekStart = startOfWeek(new Date(2026, 8, 2), { weekStartsOn: 0 });
    const days = clinicAgendaVisibleDays({
      view: 'semana',
      day: weekStart,
      weekStart,
      workingDays: WEEKDAYS,
    });
    expect(days.map((d) => d.getDay())).toEqual([1, 2, 3, 4, 5]);
  });

  it('mostra o sábado se o expediente incluir sábado', () => {
    const weekStart = startOfWeek(new Date(2026, 8, 2), { weekStartsOn: 0 });
    const days = clinicAgendaVisibleDays({
      view: 'semana',
      day: weekStart,
      weekStart,
      workingDays: new Set([1, 2, 3, 4, 5, 6]),
    });
    expect(days.some((d) => d.getDay() === 6)).toBe(true);
    expect(days.some((d) => d.getDay() === 0)).toBe(false);
  });

  it('visão do dia devolve um único dia útil', () => {
    const sunday = new Date(2026, 8, 6);
    const days = clinicAgendaVisibleDays({
      view: 'dia',
      day: sunday,
      weekStart: sunday,
      workingDays: WEEKDAYS,
    });
    expect(days).toHaveLength(1);
    expect(days[0]!.getDay()).toBe(1);
    expect(addDays(sunday, 1).getDay()).toBe(1);
  });
});
