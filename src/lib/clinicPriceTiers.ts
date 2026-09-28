export const CLINIC_PRICE_TIERS = [
  'oficial',
  'particular',
  'parcerias',
  'funcionarios',
  'convenio',
] as const;

export type ClinicPriceTier = (typeof CLINIC_PRICE_TIERS)[number];

export const CLINIC_PRICE_TIER_LABELS: Record<ClinicPriceTier, string> = {
  oficial: 'Oficial',
  particular: 'Particular',
  parcerias: 'Parcerias',
  funcionarios: 'Funcionários',
  convenio: 'Convênio',
};

/** Campo em organization_procedures / branch_prices por tier. */
export const CLINIC_PRICE_TIER_FIELDS: Record<ClinicPriceTier, keyof ClinicPriceFieldsInput> = {
  oficial: 'price_oficial',
  particular: 'price_particular',
  parcerias: 'price_parcerias',
  funcionarios: 'price_funcionarios',
  convenio: 'price_convenio',
};

export const DEFAULT_CLINIC_PRICE_TIER: ClinicPriceTier = 'particular';

export type OrganizationProcedurePrices = {
  procedure_id: string;
  price_oficial: number | null;
  price_particular: number | null;
  price_parcerias: number | null;
  price_funcionarios: number | null;
  price_convenio: number | null;
};

export function isClinicPriceTier(value: unknown): value is ClinicPriceTier {
  return typeof value === 'string' && (CLINIC_PRICE_TIERS as readonly string[]).includes(value);
}

export function priceForTier(
  row: OrganizationProcedurePrices | null | undefined,
  tier: ClinicPriceTier
): number | null {
  if (!row) return null;
  const field = CLINIC_PRICE_TIER_FIELDS[tier];
  const value = row[field];
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(value);
}

/** Formata número para o input de valor da consulta (pt-BR com vírgula). */
export function formatPriceInput(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '';
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export type ClinicPriceFieldsInput = {
  price_oficial: string;
  price_particular: string;
  price_parcerias: string;
  price_funcionarios: string;
  price_convenio: string;
};

export const EMPTY_CLINIC_PRICE_FIELDS: ClinicPriceFieldsInput = {
  price_oficial: '',
  price_particular: '',
  price_parcerias: '',
  price_funcionarios: '',
  price_convenio: '',
};

/** Garante todas as chaves de preço (evita input controlado com undefined). */
export function normalizeClinicPriceFields(
  fields: Partial<ClinicPriceFieldsInput> | null | undefined
): ClinicPriceFieldsInput {
  return { ...EMPTY_CLINIC_PRICE_FIELDS, ...fields };
}
