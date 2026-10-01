import type { DentalPlanItemStatus, DentalPlanStatus } from '@/services/api/dentalPlansApi';
import type { ClinicProcedureSessionStatus } from '@/services/api/clinicProcedureSessionsApi';

/** Planos que liberam atendimento clínico. */
export const CLINIC_SOLD_PLAN_STATUSES: DentalPlanStatus[] = ['authorized', 'negotiating'];

/** Itens elegíveis para novo atendimento (não rejeitados). */
export const CLINIC_ATTENDABLE_ITEM_STATUSES: DentalPlanItemStatus[] = [
  'pending',
  'authorized',
  'done',
];

export type ClinicAuthorizedProcedureUiStatus =
  | 'authorized'
  | 'in_progress'
  | 'finished'
  | 'cancelled';

export function isClinicSoldPlanStatus(status: string | null | undefined): boolean {
  return CLINIC_SOLD_PLAN_STATUSES.includes(status as DentalPlanStatus);
}

export function isClinicAttendableItemStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  if (status === 'rejected') return false;
  return CLINIC_ATTENDABLE_ITEM_STATUSES.includes(status as DentalPlanItemStatus);
}

export function clinicAuthorizedProcedureUiStatus(params: {
  planStatus: string;
  itemStatus: string;
  openSessionStatus?: ClinicProcedureSessionStatus | null;
  finishedSessionsCount: number;
  quantity: number;
}): ClinicAuthorizedProcedureUiStatus {
  if (params.planStatus === 'cancelled' || params.itemStatus === 'rejected') {
    return 'cancelled';
  }
  if (
    params.itemStatus === 'done' ||
    params.finishedSessionsCount >= Math.max(1, params.quantity)
  ) {
    return 'finished';
  }
  if (
    params.openSessionStatus === 'draft' ||
    params.openSessionStatus === 'in_progress'
  ) {
    return 'in_progress';
  }
  return 'authorized';
}

export function clinicAuthorizedProcedureUiStatusLabel(
  status: ClinicAuthorizedProcedureUiStatus
): string {
  switch (status) {
    case 'authorized':
      return 'Autorizado';
    case 'in_progress':
      return 'Em andamento';
    case 'finished':
      return 'Finalizado';
    case 'cancelled':
      return 'Cancelado';
  }
}

export function clinicProcedureSessionStatusLabel(
  status: ClinicProcedureSessionStatus
): string {
  switch (status) {
    case 'draft':
      return 'Rascunho';
    case 'in_progress':
      return 'Em andamento';
    case 'finished':
      return 'Finalizado';
    case 'cancelled':
      return 'Cancelado';
  }
}

export function formatClinicLocationLabel(locations: Array<{
  tooth_number?: string | null;
  face?: string | null;
  region?: string | null;
}>): string | null {
  if (!locations.length) return null;
  const parts = locations.map((loc) => {
    if (loc.region) {
      if (loc.region === 'upper_arch') return 'Arcada superior';
      if (loc.region === 'lower_arch') return 'Arcada inferior';
      if (loc.region === 'both_arches') return 'Ambas as arcadas';
      return loc.region;
    }
    const tooth = loc.tooth_number ? `Dente ${loc.tooth_number}` : null;
    const face = loc.face ? `face ${loc.face}` : null;
    return [tooth, face].filter(Boolean).join(' · ') || null;
  }).filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}
