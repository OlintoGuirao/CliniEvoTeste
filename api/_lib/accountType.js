/** Tipos de conta alinhados ao enum organization_type. */
export const ACCOUNT_TYPES = ['solo', 'clinic', 'salon'];

export function normalizeAccountType(value) {
  if (value === 'clinic' || value === 'salon') return value;
  return 'solo';
}

export function isSharedOrgType(value) {
  const t = normalizeAccountType(value);
  return t === 'clinic' || t === 'salon';
}

export function orgTypeLabel(type) {
  if (type === 'salon') return 'salão';
  if (type === 'clinic') return 'clínica';
  return 'organização';
}
