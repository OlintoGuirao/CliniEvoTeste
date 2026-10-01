import {
  listDentalPlanItems,
  listDentalPlansForPatient,
  type DentalPlanItemLocationRow,
  type DentalPlanItemRow,
  type DentalTreatmentPlanRow,
} from '@/services/api/dentalPlansApi';
import {
  listClinicProcedureSessionsForPatient,
  type ClinicProcedureSessionRow,
} from '@/services/api/clinicProcedureSessionsApi';
import {
  clinicAuthorizedProcedureUiStatus,
  formatClinicLocationLabel,
  isClinicAttendableItemStatus,
  isClinicSoldPlanStatus,
  type ClinicAuthorizedProcedureUiStatus,
} from '@/lib/clinicAuthorizedProcedures';

export type ClinicAuthorizedProcedureCard = {
  planItemId: string;
  treatmentPlanId: string;
  planName: string;
  procedureId: string | null;
  procedureName: string;
  quantity: number;
  finishedCount: number;
  remainingCount: number;
  locationLabel: string | null;
  notes: string | null;
  responsibleProfessionalId: string;
  lastSessionAt: string | null;
  openSessionId: string | null;
  uiStatus: ClinicAuthorizedProcedureUiStatus;
  itemStatus: DentalPlanItemRow['status'];
  planStatus: DentalTreatmentPlanRow['status'];
  sessions: ClinicProcedureSessionRow[];
  locations: DentalPlanItemLocationRow[];
};

export async function listClinicAuthorizedProceduresForPatient(
  patientId: string
): Promise<ClinicAuthorizedProcedureCard[]> {
  const [plans, sessions] = await Promise.all([
    listDentalPlansForPatient(patientId),
    listClinicProcedureSessionsForPatient(patientId),
  ]);

  const soldPlans = plans.filter((plan) => isClinicSoldPlanStatus(plan.status));
  const cards: ClinicAuthorizedProcedureCard[] = [];

  for (const plan of soldPlans) {
    const { items, locations } = await listDentalPlanItems(plan.id);
    for (const item of items) {
      if (!isClinicAttendableItemStatus(item.status)) continue;

      const itemSessions = sessions.filter((s) => s.plan_item_id === item.id);
      const finishedCount = itemSessions.filter((s) => s.status === 'finished').length;
      const open = itemSessions.find(
        (s) => s.status === 'draft' || s.status === 'in_progress'
      );
      const last = itemSessions[0] ?? null;
      const itemLocations = locations.filter((loc) => loc.plan_item_id === item.id);
      const remainingCount = Math.max(0, item.quantity - finishedCount);

      cards.push({
        planItemId: item.id,
        treatmentPlanId: plan.id,
        planName: plan.name,
        procedureId: item.procedure_id,
        procedureName: item.procedure_name,
        quantity: item.quantity,
        finishedCount,
        remainingCount,
        locationLabel: formatClinicLocationLabel(itemLocations),
        notes: item.notes,
        responsibleProfessionalId: plan.responsible_professional_id,
        lastSessionAt: last?.finished_at ?? last?.updated_at ?? null,
        openSessionId: open?.id ?? null,
        uiStatus: clinicAuthorizedProcedureUiStatus({
          planStatus: plan.status,
          itemStatus: item.status,
          openSessionStatus: open?.status ?? null,
          finishedSessionsCount: finishedCount,
          quantity: item.quantity,
        }),
        itemStatus: item.status,
        planStatus: plan.status,
        sessions: itemSessions,
        locations: itemLocations,
      });
    }
  }

  return cards.sort((a, b) => {
    const rank = { in_progress: 0, authorized: 1, finished: 2, cancelled: 3 } as const;
    return rank[a.uiStatus] - rank[b.uiStatus] || a.procedureName.localeCompare(b.procedureName);
  });
}
