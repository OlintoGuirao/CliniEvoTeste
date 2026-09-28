export type DentalMoneyAdjustType = 'percent' | 'amount';

export type DentalPlanItemCalcInput = {
  quantity: number;
  unitPrice: number;
  discountType?: DentalMoneyAdjustType | null;
  discountValue?: number | null;
  surchargeType?: DentalMoneyAdjustType | null;
  surchargeValue?: number | null;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function applyAdjust(
  base: number,
  type: DentalMoneyAdjustType | null | undefined,
  value: number | null | undefined
): number {
  const amount = Number(value ?? 0);
  if (!type || !Number.isFinite(amount) || amount <= 0) return 0;
  if (type === 'percent') return roundMoney((base * amount) / 100);
  return roundMoney(amount);
}

/** quantidade × unitário − desconto + acréscimo */
export function calcDentalItemTotal(input: DentalPlanItemCalcInput): number {
  const qty = Math.max(0, Math.floor(Number(input.quantity) || 0));
  const unit = Math.max(0, Number(input.unitPrice) || 0);
  const subtotal = roundMoney(qty * unit);
  const discount = applyAdjust(subtotal, input.discountType, input.discountValue);
  const surcharge = applyAdjust(subtotal, input.surchargeType, input.surchargeValue);
  return roundMoney(Math.max(0, subtotal - discount + surcharge));
}

export function calcDentalPlanSubtotal(
  items: Array<{ totalValue?: number | null } & DentalPlanItemCalcInput>
): number {
  return roundMoney(
    items.reduce((sum, item) => {
      const total =
        item.totalValue != null && Number.isFinite(Number(item.totalValue))
          ? Number(item.totalValue)
          : calcDentalItemTotal(item);
      return sum + total;
    }, 0)
  );
}

export function calcDentalPlanGrandTotal(params: {
  itemsSubtotal: number;
  discountType?: DentalMoneyAdjustType | null;
  discountValue?: number | null;
  surchargeType?: DentalMoneyAdjustType | null;
  surchargeValue?: number | null;
}): number {
  const subtotal = Math.max(0, Number(params.itemsSubtotal) || 0);
  const discount = applyAdjust(subtotal, params.discountType, params.discountValue);
  const surcharge = applyAdjust(subtotal, params.surchargeType, params.surchargeValue);
  return roundMoney(Math.max(0, subtotal - discount + surcharge));
}

/** Quantidade = nº de localizações válidas (dente/face/raiz/região). */
export function calcDentalLocationQuantity(
  locations: Array<{ toothNumber?: string | null; region?: string | null; face?: string | null; root?: string | null }>
): number {
  const keys = new Set<string>();
  for (const loc of locations) {
    if (loc.region === 'both_arches') {
      keys.add('region:upper_arch');
      keys.add('region:lower_arch');
      continue;
    }
    if (loc.region) {
      keys.add(`region:${loc.region}`);
      continue;
    }
    const tooth = (loc.toothNumber || '').trim();
    if (!tooth) continue;
    const face = (loc.face || '').trim();
    const root = (loc.root || '').trim();
    keys.add(`tooth:${tooth}|face:${face}|root:${root}`);
  }
  return Math.max(keys.size, 0);
}

export function generateDentalAuthorizationCode(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AUTH-${y}${m}${d}-${rand}`;
}
