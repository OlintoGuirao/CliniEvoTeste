import { describe, expect, it } from 'vitest';
import {
  calcDentalItemTotal,
  calcDentalLocationQuantity,
  calcDentalPlanGrandTotal,
  calcDentalPlanSubtotal,
  generateDentalAuthorizationCode,
} from './dentalPlanCalc';
import {
  applyToothSelection,
  formatTeethSelectionInput,
  hasProcedureToothFaceConflict,
  isDuplicateDentalItem,
  locationsFromTeethAndFaces,
  parseToothNumbersInput,
  quantityFromSelection,
  toggleFaceInSelection,
  toggleToothInSelection,
  validateToothNumbers,
} from './dentalSelection';

describe('dentalPlanCalc', () => {
  it('calcula total do item com desconto e acréscimo', () => {
    expect(
      calcDentalItemTotal({
        quantity: 2,
        unitPrice: 100,
        discountType: 'percent',
        discountValue: 10,
        surchargeType: 'amount',
        surchargeValue: 5,
      })
    ).toBe(185);
  });

  it('calcula subtotal e total do plano', () => {
    const items = [
      { quantity: 1, unitPrice: 100, totalValue: 100 },
      { quantity: 2, unitPrice: 50, totalValue: 100 },
    ];
    expect(calcDentalPlanSubtotal(items)).toBe(200);
    expect(
      calcDentalPlanGrandTotal({
        itemsSubtotal: 200,
        discountType: 'amount',
        discountValue: 20,
        surchargeType: 'percent',
        surchargeValue: 10,
      })
    ).toBe(200);
  });

  it('calcula quantidade por localizações e gera código de autorização', () => {
    expect(
      calcDentalLocationQuantity([
        { toothNumber: '11', face: 'M' },
        { toothNumber: '11', face: 'D' },
        { region: 'both_arches' },
      ])
    ).toBe(4);
    expect(generateDentalAuthorizationCode(new Date(2026, 8, 9, 12, 0, 0))).toMatch(
      /^AUTH-20260909-[A-Z0-9]{4}$/
    );
  });
});

describe('dentalSelection', () => {
  it('seleciona dentes, faces, raízes e regiões', () => {
    expect(toggleToothInSelection(['11'], '21')).toEqual(['11', '21']);
    expect(toggleToothInSelection(['11', '21'], '11')).toEqual(['21']);
    expect(toggleFaceInSelection([], '16', 'O')).toEqual([{ toothNumber: '16', faces: ['O'] }]);
    const locs = locationsFromTeethAndFaces({
      teeth: ['11', '21'],
      faceSelections: [{ toothNumber: '11', faces: ['M', 'D'] }],
      selectionType: 'group',
    });
    expect(locs).toHaveLength(3);
    expect(quantityFromSelection(locs)).toBe(3);
    expect(
      locationsFromTeethAndFaces({
        teeth: ['16'],
        rootSelections: [{ toothNumber: '16', roots: ['MB', 'DB'] }],
        selectionType: 'individual',
      })
    ).toEqual([
      { toothNumber: '16', root: 'MB' },
      { toothNumber: '16', root: 'DB' },
    ]);
    expect(
      locationsFromTeethAndFaces({
        teeth: [],
        region: 'upper_arch',
        selectionType: 'region',
      })
    ).toEqual([{ region: 'upper_arch' }]);
  });

  it('valida números e duplicidade', () => {
    expect(parseToothNumbersInput('11, 21 99')).toEqual(['11', '21', '99']);
    expect(validateToothNumbers(['11', '99'])).toEqual({ valid: ['11'], invalid: ['99'] });
    expect(
      isDuplicateDentalItem({
        existing: [{ procedureName: 'Restauração', locations: [{ toothNumber: '11', face: 'O' }] }],
        procedureName: 'Restauração',
        locations: [{ toothNumber: '11', face: 'O' }],
      })
    ).toBe(true);
  });

  it('aplica seleção com dedupe, mistura e formatação', () => {
    expect(formatTeethSelectionInput(['11', '11', '21'])).toBe('11, 21');
    expect(
      applyToothSelection({
        current: ['11'],
        incoming: ['21'],
        mode: 'add',
      }).next
    ).toEqual(['11', '21']);
    expect(
      applyToothSelection({
        current: ['11', '21'],
        incoming: ['11'],
        mode: 'toggle',
      }).next
    ).toEqual(['21']);
    expect(
      applyToothSelection({
        current: [],
        incoming: ['11', '51'],
        mode: 'replace',
        allowMixedDentition: false,
      }).needsMixedConfirm
    ).toBe(true);
    expect(
      applyToothSelection({
        current: [],
        incoming: ['11', '99'],
        mode: 'replace',
      })
    ).toMatchObject({ next: ['11'], invalid: ['99'] });
  });

  it('detecta conflito procedimento + dente + face', () => {
    const existing = [
      {
        id: 'a',
        procedureName: 'Restauração',
        locations: [{ toothNumber: '16', face: 'O' as const }],
      },
    ];
    expect(
      hasProcedureToothFaceConflict({
        existing,
        procedureName: 'Restauração',
        locations: [{ toothNumber: '16', face: 'O' }],
      })?.id
    ).toBe('a');
    expect(
      hasProcedureToothFaceConflict({
        existing,
        procedureName: 'Restauração',
        locations: [{ toothNumber: '26', face: 'O' }],
      })
    ).toBeNull();
  });
});
