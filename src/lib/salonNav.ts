/**
 * Menu exclusivo da conta Salão.
 * Clínica e profissional único não usam este filtro.
 */

export const SALON_MAIN_PATHS = [
  '/dashboard',
  '/consultation',
  '/agenda',
  '/patients',
  '/fluxo-caixa',
] as const;

export const SALON_SETTINGS_PATHS = [
  '/settings',
  '/settings/profile',
  '/settings/whatsapp',
  '/settings/equipe',
  '/settings/procedimentos-salao',
] as const;

export function isSalonNavPath(path: string): boolean {
  const normalized = path.split('?')[0];

  // Configurações: rotas irmãs — match exato (/settings ≠ /settings/procedimentos).
  if ((SALON_SETTINGS_PATHS as readonly string[]).includes(normalized)) return true;

  // Menu principal: permite sub-rotas (ex.: /patients/:id, /consultation/:id).
  return SALON_MAIN_PATHS.some(
    (p) => normalized === p || normalized.startsWith(`${p}/`)
  );
}

export function filterNavForSalon<T extends Record<string, unknown>>(
  items: T[],
  pathKey: 'url' | 'path' = 'url'
): T[] {
  return items.filter((item) => {
    const path = String(item[pathKey] ?? '');
    return isSalonNavPath(path);
  });
}
