/** Tipo de conta definido pelo Admin Master — três fluxos separados. */
export type AccountType = 'solo' | 'clinic' | 'salon';

export const ACCOUNT_TYPES: AccountType[] = ['solo', 'clinic', 'salon'];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  solo: 'Profissional único',
  clinic: 'Clínica',
  salon: 'Cabeleireiro (Salão)',
};

export function normalizeAccountType(value: unknown): AccountType {
  if (value === 'clinic') return 'clinic';
  if (value === 'salon') return 'salon';
  return 'solo';
}

export function accountTypeLabel(value: unknown): string {
  return ACCOUNT_TYPE_LABELS[normalizeAccountType(value)];
}

/** @deprecated Prefer isClinicOnlyAccount / isSalonAccount — fluxos separados. */
export function isSharedOrgAccount(value: unknown): boolean {
  const t = normalizeAccountType(value);
  return t === 'clinic' || t === 'salon';
}

/** Conta Salão (cabeleireiro) — glossário e Admin do salão. */
export function isSalonAccount(value: unknown): boolean {
  return normalizeAccountType(value) === 'salon';
}

/** Conta Clínica (Master / filiais / preços) — não inclui salão nem solo. */
export function isClinicOnlyAccount(value: unknown): boolean {
  return normalizeAccountType(value) === 'clinic';
}
