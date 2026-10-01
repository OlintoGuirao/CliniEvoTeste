import { describe, expect, it } from 'vitest';
import {
  clinicAuthorizedProcedureUiStatus,
  clinicAuthorizedProcedureUiStatusLabel,
  formatClinicLocationLabel,
  isClinicAttendableItemStatus,
  isClinicSoldPlanStatus,
} from './clinicAuthorizedProcedures';

describe('clinicAuthorizedProcedures', () => {
  it('aceita apenas planos autorizados/negociando', () => {
    expect(isClinicSoldPlanStatus('authorized')).toBe(true);
    expect(isClinicSoldPlanStatus('negotiating')).toBe(true);
    expect(isClinicSoldPlanStatus('open')).toBe(false);
    expect(isClinicSoldPlanStatus('cancelled')).toBe(false);
    expect(isClinicSoldPlanStatus('finished')).toBe(false);
  });

  it('filtra itens rejeitados', () => {
    expect(isClinicAttendableItemStatus('authorized')).toBe(true);
    expect(isClinicAttendableItemStatus('pending')).toBe(true);
    expect(isClinicAttendableItemStatus('done')).toBe(true);
    expect(isClinicAttendableItemStatus('rejected')).toBe(false);
  });

  it('calcula status de UI do procedimento', () => {
    expect(
      clinicAuthorizedProcedureUiStatus({
        planStatus: 'authorized',
        itemStatus: 'authorized',
        openSessionStatus: null,
        finishedSessionsCount: 0,
        quantity: 2,
      })
    ).toBe('authorized');

    expect(
      clinicAuthorizedProcedureUiStatus({
        planStatus: 'authorized',
        itemStatus: 'authorized',
        openSessionStatus: 'in_progress',
        finishedSessionsCount: 0,
        quantity: 2,
      })
    ).toBe('in_progress');

    expect(
      clinicAuthorizedProcedureUiStatus({
        planStatus: 'authorized',
        itemStatus: 'done',
        openSessionStatus: null,
        finishedSessionsCount: 1,
        quantity: 2,
      })
    ).toBe('finished');

    expect(
      clinicAuthorizedProcedureUiStatus({
        planStatus: 'cancelled',
        itemStatus: 'authorized',
        openSessionStatus: null,
        finishedSessionsCount: 0,
        quantity: 1,
      })
    ).toBe('cancelled');
  });

  it('formata localização e labels', () => {
    expect(clinicAuthorizedProcedureUiStatusLabel('authorized')).toBe('Autorizado');
    expect(formatClinicLocationLabel([{ tooth_number: '16', face: 'O' }])).toBe(
      'Dente 16 · face O'
    );
    expect(formatClinicLocationLabel([{ region: 'upper_arch' }])).toBe('Arcada superior');
  });
});
