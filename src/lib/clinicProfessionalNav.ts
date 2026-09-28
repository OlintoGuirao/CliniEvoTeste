/**
 * Navegação do profissional clínico da clínica (membro que não é master nem recepção).
 * Contas solo, salão, master e recepção não passam por estes filtros.
 */

/** Itens permitidos no menu principal (sem Nova consulta). */
export const CLINIC_PROFESSIONAL_NAV_PATHS = [
  '/dashboard',
  '/agenda',
  '/patients',
  '/anotacoes',
  '/orcamento',
  '/receituario',
] as const;

/** Rotas acessíveis (inclui consulta existente na ficha do paciente). */
export const CLINIC_PROFESSIONAL_ROUTE_PATHS = [
  ...CLINIC_PROFESSIONAL_NAV_PATHS,
  '/consultation',
] as const;

export const CLINIC_PROFESSIONAL_SETTINGS_PATHS = ['/settings/profile'] as const;

function normalizePath(path: string): string {
  return path.split('?')[0];
}

function matchesAllowedPath(normalized: string, allowed: string): boolean {
  return normalized === allowed || normalized.startsWith(`${allowed}/`);
}

export function isClinicProfessionalNavPath(path: string): boolean {
  const normalized = normalizePath(path);
  if (normalized === '/patients/new' || normalized.startsWith('/patients/new/')) return false;
  return CLINIC_PROFESSIONAL_NAV_PATHS.some((p) => matchesAllowedPath(normalized, p));
}

export function isClinicProfessionalSettingsPath(path: string): boolean {
  const normalized = normalizePath(path);
  return CLINIC_PROFESSIONAL_SETTINGS_PATHS.some((p) => matchesAllowedPath(normalized, p));
}

export function isClinicProfessionalRouteAllowed(path: string): boolean {
  const normalized = normalizePath(path);
  if (normalized === '/patients/new' || normalized.startsWith('/patients/new/')) return false;
  const allowed = [...CLINIC_PROFESSIONAL_ROUTE_PATHS, ...CLINIC_PROFESSIONAL_SETTINGS_PATHS];
  return allowed.some((p) => matchesAllowedPath(normalized, p));
}

export function filterNavForClinicProfessional<T extends Record<string, unknown>>(
  items: T[],
  isClinicClinicalProfessional: boolean,
  pathKey: 'url' | 'path' = 'url'
): T[] {
  if (!isClinicClinicalProfessional) return items;
  return items.filter((item) => {
    const path = String(item[pathKey] ?? '');
    return isClinicProfessionalNavPath(path);
  });
}

export function filterSettingsNavForClinicProfessional<T extends Record<string, unknown>>(
  items: T[],
  isClinicClinicalProfessional: boolean,
  pathKey: 'url' | 'path' = 'url'
): T[] {
  if (!isClinicClinicalProfessional) return items;
  return items.filter((item) => {
    const path = String(item[pathKey] ?? '');
    return isClinicProfessionalSettingsPath(path);
  });
}
