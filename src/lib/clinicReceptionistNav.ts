/**
 * Navegação restrita da equipe de recepção/atendimento da clínica
 * (secretária, recepcionista, atendente).
 * Contas solo, salão e demais perfis da clínica não passam por estes filtros.
 */

export const CLINIC_RECEPTIONIST_NAV_PATHS = [
  '/dashboard',
  '/agenda',
  '/patients',
  '/atendimento',
  '/operacional',
  '/cobranca',
  '/orcamento',
  '/receituario',
] as const;

/** Rotas de conta permitidas além do menu principal. */
export const CLINIC_RECEPTIONIST_SETTINGS_PATHS = [
  '/settings/profile',
  '/settings/whatsapp',
] as const;

function normalizePath(path: string): string {
  return path.split('?')[0];
}

function matchesAllowedPath(normalized: string, allowed: string): boolean {
  return normalized === allowed || normalized.startsWith(`${allowed}/`);
}

export function isClinicReceptionistNavPath(path: string): boolean {
  const normalized = normalizePath(path);
  return CLINIC_RECEPTIONIST_NAV_PATHS.some((p) => matchesAllowedPath(normalized, p));
}

export function isClinicReceptionistSettingsPath(path: string): boolean {
  const normalized = normalizePath(path);
  return CLINIC_RECEPTIONIST_SETTINGS_PATHS.some((p) => matchesAllowedPath(normalized, p));
}

export function isClinicReceptionistRouteAllowed(path: string): boolean {
  const normalized = normalizePath(path);
  const allowed = [...CLINIC_RECEPTIONIST_NAV_PATHS, ...CLINIC_RECEPTIONIST_SETTINGS_PATHS];
  return allowed.some((p) => matchesAllowedPath(normalized, p));
}

export function filterNavForClinicReceptionist<T extends Record<string, unknown>>(
  items: T[],
  isFrontDeskStaff: boolean,
  pathKey: 'url' | 'path' = 'url'
): T[] {
  if (!isFrontDeskStaff) return items;
  return items.filter((item) => {
    const path = String(item[pathKey] ?? '');
    return isClinicReceptionistNavPath(path);
  });
}

export function filterSettingsNavForClinicReceptionist<T extends Record<string, unknown>>(
  items: T[],
  isFrontDeskStaff: boolean,
  pathKey: 'url' | 'path' = 'url'
): T[] {
  if (!isFrontDeskStaff) return items;
  return items.filter((item) => {
    const path = String(item[pathKey] ?? '');
    return isClinicReceptionistSettingsPath(path);
  });
}
