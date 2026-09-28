/**
 * Single source of truth for all React Query keys.
 * Use QUERY_KEYS and the key helpers below to prevent cache fragmentation and duplicate queries.
 */

export const QUERY_KEYS = {
  patients: ['patients'] as const,
  procedures: ['procedures'] as const,
  appointments: ['appointments'] as const,
  dashboard: ['dashboard'] as const,
  users: ['users'] as const,
  profile: ['profile'] as const,
  menuProcedures: ['menuProcedures'] as const,
  notifications: ['notifications'] as const,
  futureClientIds: ['future-client-ids'] as const,
  proceduresForFaturamento: ['procedures-for-faturamento'] as const,
  faturamento: ['faturamento'] as const,
  admin: {
    procedurePermissions: ['admin', 'procedure-permissions'] as const,
    users: ['admin', 'users'] as const,
    stats: ['admin', 'stats'] as const,
    activity: ['admin', 'activity'] as const,
  },
} as const;

/** Profile for a user (use for getProfile). */
export function profileKey(userId: string) {
  return [...QUERY_KEYS.profile, userId] as const;
}

/** Patients list for a given professional (use for fetchPatients). */
export function patientsListKey(professionalId: string) {
  return [...QUERY_KEYS.patients, professionalId] as const;
}

export function futureClientIdsKey(professionalId: string) {
  return [...QUERY_KEYS.futureClientIds, professionalId] as const;
}

export function menuProceduresKey(profileId: string) {
  return [...QUERY_KEYS.menuProcedures, profileId] as const;
}

export function notificationsKey(userId: string, updatedAt?: string) {
  return (updatedAt ? [...QUERY_KEYS.notifications, userId, updatedAt] : [...QUERY_KEYS.notifications, userId]) as const;
}

export function proceduresForFaturamentoKey(profileId: string) {
  return [...QUERY_KEYS.proceduresForFaturamento, profileId] as const;
}

export function faturamentoKey(professionalId: string, filtros: unknown) {
  return [...QUERY_KEYS.faturamento, professionalId, filtros] as const;
}

/** Dashboard batched data for a professional. */
export function dashboardKey(professionalId: string) {
  return [...QUERY_KEYS.dashboard, professionalId] as const;
}

/** Appointments for a professional in a date range (e.g. week). */
export function appointmentsKey(professionalId: string, startDate: string, endDate: string) {
  return [...QUERY_KEYS.appointments, professionalId, startDate, endDate] as const;
}

/** Backward-compatible alias: queryKeys.patients, queryKeys.patientList(id), etc. */
export const queryKeys = {
  patients: QUERY_KEYS.patients,
  profile: profileKey,
  patientList: patientsListKey,
  futureClientIds: futureClientIdsKey,
  menuProcedures: QUERY_KEYS.menuProcedures,
  menuProceduresForProfile: menuProceduresKey,
  notifications: notificationsKey,
  proceduresForFaturamento: proceduresForFaturamentoKey,
  faturamento: faturamentoKey,
  dashboard: dashboardKey,
  appointments: appointmentsKey,
  admin: QUERY_KEYS.admin,
} as const;
