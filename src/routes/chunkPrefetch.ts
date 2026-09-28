/**
 * Lazy route chunk prefetch: path -> import fn.
 * Call the fn on nav link hover to load the route chunk before navigation (instant transition).
 */
export const routeChunkPrefetch: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('@/pages/Dashboard'),
  '/patients': () => import('@/pages/Patients'),
  '/agenda': () => import('@/pages/Agenda'),
  '/patients/new': () => import('@/pages/NewPatient'),
  '/settings': () => import('@/pages/Settings'),
  '/settings/profile': () => import('@/pages/SettingsProfile'),
  '/settings/whatsapp': () => import('@/pages/SettingsWhatsApp'),
  '/settings/equipe': () => import('@/pages/SettingsClinicTeam'),
  '/settings/filiais': () => import('@/pages/SettingsClinicBranches'),
  '/settings/procedimentos': () => import('@/pages/SettingsClinicProcedures'),
  '/settings/origens': () => import('@/pages/SettingsClinicOrigins'),
  '/settings/tipos-ficha': () => import('@/pages/SettingsClinicRecordTypes'),
  '/settings/procedimentos-salao': () => import('@/pages/SettingsSalonProcedures'),
  '/faturamento': () => import('@/pages/Faturamento'),
  '/consultation': () => import('@/pages/ConsultationChoosePatientPage'),
};

/**
 * Prefetch a route chunk by path (loads the lazy component bundle).
 * Call on MouseEnter for instant navigation.
 */
export function prefetchRouteChunk(path: string): void {
  const fn = routeChunkPrefetch[path];
  if (fn) fn();
}

/**
 * Prefetch by dynamic import fn (e.g. for links that use the same lazy as the router).
 */
export function prefetchRouteChunkByImport(importFn: () => Promise<unknown>): void {
  importFn();
}
