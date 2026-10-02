import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  Check,
  Copy,
  Eraser,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicMemberRole } from '@/hooks/use-clinic-member-role';
import { QUERY_KEYS } from '@/api/queryKeys';
import { Odontogram } from '@/components/dental/Odontogram';
import { OdontogramSelectionPanel } from '@/components/dental/OdontogramSelectionPanel';
import {
  createEmptyPaymentDraft,
  DentalPaymentConditionEditor,
  DentalPaymentConditionsList,
  formatPaymentConditionsSummary,
  type DentalPaymentCondition,
} from '@/components/dental/DentalPaymentConditions';
import { PatientTabPanelSection } from '@/components/patient-detail/PatientDetailTabPanel';
import { PatientDocumentsSection } from '@/components/patient-detail/PatientDocumentsSection';
import { formatPhoneForWhatsApp } from '@/lib/evolutionPdf';
import {
  buildBudgetQuoteWhatsAppMessage,
  openWhatsAppWithFallback,
} from '@/lib/reportShare';
import { loadWhatsappManualTemplates } from '@/lib/loadWhatsappManualTemplates';
import { ensureBudgetQuotePublicSlug } from '@/services/api/budgetQuotesApi';
import { isClinicOnlyAccount } from '@/lib/accountType';
import { normalizeSearchText } from '@/lib/brazilianCities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DENTAL_FACE_LABELS,
  DENTAL_REGION_LABELS,
  DENTAL_ROOT_LABELS,
  DENTAL_TOOTH_CONDITION_LABELS,
  facesForTooth,
  resolveToothNumberForDeciduousCondition,
  resolveToothNumberForPermanentCondition,
  rootsForTooth,
  type DentalArchRegion,
  type DentalRootCode,
  type DentalToothCondition,
  type DentalToothFace,
} from '@/lib/dentalFdi';
import {
  calcDentalItemTotal,
  calcDentalPlanGrandTotal,
  calcDentalPlanSubtotal,
} from '@/lib/dentalPlanCalc';
import {
  applyToothSelection,
  formatTeethSelectionInput,
  hasProcedureToothFaceConflict,
  isDuplicateDentalItem,
  locationsFromTeethAndFaces,
  parseToothNumbersInput,
  PERMANENT_ALL_TEETH,
  PERMANENT_LOWER_ARCH,
  PERMANENT_UPPER_ARCH,
  quantityFromSelection,
  splitLocationsForIndividual,
  toggleFaceInSelection,
  toggleRootInSelection,
  validateToothNumbers,
  type DentalSelectionLocation,
  type DentalSelectionType,
  type DentalToothFaceSelection,
  type DentalToothRootSelection,
} from '@/lib/dentalSelection';
import { formatBrl } from '@/lib/budgetQuote';
import {
  CLINIC_PRICE_TIER_LABELS,
  CLINIC_PRICE_TIERS,
  DEFAULT_CLINIC_PRICE_TIER,
  type ClinicPriceTier,
} from '@/lib/clinicPriceTiers';
import { isClinicalCouncilBody, resolveProfileRegistryBody } from '@/lib/clinicTeamRoles';
import { useOrganizationProcedurePrices } from '@/hooks/use-organization-procedure-prices';
import { useClinicPatientOrigins } from '@/hooks/use-clinic-patient-origins';
import { fetchClinicAgendaProfessionals } from '@/lib/clinicAgendaBooking';
import { fetchClinicTeam } from '@/services/api/clinicTeamApi';
import { originNameById } from '@/services/api/clinicPatientOriginsApi';
import {
  addDentalPlanItem,
  createDentalPlan,
  deleteDentalPlan,
  deleteDentalPlanItem,
  listDentalPlanItems,
  listDentalPlansForPatient,
  listPatientToothConditions,
  requestDentalPlanAuthorization,
  sendDentalPlanToNegotiation,
  updateDentalPlan,
  updateDentalPlanItem,
  upsertPatientToothConditions,
  type DentalPlanItemLocationRow,
  type DentalPlanItemRow,
  type DentalPlanItemStatus,
  type DentalPlanStatus,
  type DentalTreatmentPlanRow,
} from '@/services/api/dentalPlansApi';

const PLAN_STATUS_LABEL: Record<DentalPlanStatus, string> = {
  open: 'Aberto',
  authorized: 'Autorizado',
  negotiating: 'Em negociação',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};

function planStatusBadgeLabel(plan: Pick<DentalTreatmentPlanRow, 'status' | 'payment_terms'>): string {
  if (plan.payment_terms?.trim()) return 'Vendido';
  return PLAN_STATUS_LABEL[plan.status];
}

const ITEM_STATUS_LABEL: Record<DentalPlanItemStatus, string> = {
  pending: 'Solicitado',
  authorized: 'Autorizado',
  rejected: 'Indeferido',
  done: 'Concluído',
};

/** Motivos comerciais (recepção) — gravados como indeferimento com nota. */
const COMMERCIAL_SITUATION_REASONS = [
  'Achou caro',
  'Pediu orçamento',
  'Quer convênio',
  'Quer fechar mais adiante',
] as const;

function itemStatusDisplayLabel(item: Pick<DentalPlanItemRow, 'status' | 'notes'>): string {
  if (item.status === 'rejected' && item.notes?.startsWith('Indeferido:')) {
    const reason = item.notes.replace(/^Indeferido:\s*/i, '').trim();
    if (reason) return reason;
  }
  return ITEM_STATUS_LABEL[item.status];
}

type CatalogProcedure = {
  id: string;
  name: string;
  specialty: string | null;
  category?: string | null;
  slug?: string | null;
};
type MoneyAdjustType = 'percent' | 'amount';

function formatLocations(
  itemId: string,
  locations: DentalPlanItemLocationRow[]
): string {
  const locs = locations.filter((l) => l.plan_item_id === itemId);
  if (locs.length === 0) return '—';
  return locs
    .map((l) => {
      if (l.region) return DENTAL_REGION_LABELS[l.region as DentalArchRegion] ?? l.region;
      const tooth = l.tooth_number ?? '';
      const face = l.face ? `/${l.face}` : '';
      const root = l.root ? `/R:${l.root}` : '';
      return `${tooth}${face}${root}`;
    })
    .join(', ');
}

/** Colunas da tabela: dente/região e face. */
function formatItemTableLocation(
  itemId: string,
  locations: DentalPlanItemLocationRow[]
): { toothOrRegion: string; face: string } {
  const locs = locations.filter((l) => l.plan_item_id === itemId);
  if (locs.length === 0) return { toothOrRegion: '—', face: '—' };

  const regions = locs
    .map((l) => l.region)
    .filter((r): r is string => !!r)
    .map((r) => DENTAL_REGION_LABELS[r as DentalArchRegion] ?? r);
  if (regions.length > 0) {
    return { toothOrRegion: [...new Set(regions)].join(', '), face: '—' };
  }

  const teeth = [
    ...new Set(locs.map((l) => l.tooth_number).filter((t): t is string => !!t)),
  ];
  const faces = locs
    .map((l) => l.face)
    .filter((f): f is string => !!f)
    .map((f) => DENTAL_FACE_LABELS[f as DentalToothFace] ?? f);
  const uniqueFaces = [...new Set(faces)];

  return {
    toothOrRegion: teeth.length > 0 ? teeth.join(', ') : '—',
    face: uniqueFaces.length === 0 ? 'Dente inteiro' : uniqueFaces.join(', '),
  };
}

function parseMoneyInput(raw: string): number {
  return Number(String(raw).replace(',', '.')) || 0;
}

function itemLocationsAsSelection(
  itemId: string,
  locations: DentalPlanItemLocationRow[]
): DentalSelectionLocation[] {
  return locations
    .filter((l) => l.plan_item_id === itemId)
    .map((l) => ({
      toothNumber: l.tooth_number,
      face: l.face as DentalToothFace | null,
      root: l.root,
      region: l.region as DentalArchRegion | null,
    }));
}

export function PatientDentalPlansSection({
  patientId,
  focusPlanId,
  preferCreatePlan = false,
}: {
  patientId: string;
  /** Quando informado, carrega e exibe somente este plano (pop-up da notificação). */
  focusPlanId?: string | null;
  /** Se true e não há planos, abre o dialog de criar plano após carregar. */
  preferCreatePlan?: boolean;
}) {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const isClinicAccount = isClinicOnlyAccount(profile?.account_type);
  const professionalId = profile?.id ?? user?.id ?? null;
  const { isClinicClinicalProfessional } = useClinicMemberRole();
  /** Valores e resumo comercial: recepção/atendente/master — não o Dr. clínico. */
  const showCommercialDetails = !isClinicClinicalProfessional;
  const { getPrice } = useOrganizationProcedurePrices();
  const { origins: clinicOrigins } = useClinicPatientOrigins({ activeOnly: false });
  const lockedToPlan = Boolean(focusPlanId);

  const [plans, setPlans] = useState<DentalTreatmentPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlanId, setActivePlanId] = useState<string | null>(focusPlanId ?? null);
  const [items, setItems] = useState<DentalPlanItemRow[]>([]);
  const [locations, setLocations] = useState<DentalPlanItemLocationRow[]>([]);
  const [conditionsByTooth, setConditionsByTooth] = useState<
    Record<string, DentalToothCondition>
  >({});
  const [selectedTeeth, setSelectedTeeth] = useState<string[]>([]);
  const [faceFocusTooth, setFaceFocusTooth] = useState<string | null>(null);
  const [faceSelections, setFaceSelections] = useState<DentalToothFaceSelection[]>([]);
  const [rootSelections, setRootSelections] = useState<DentalToothRootSelection[]>([]);
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanType, setNewPlanType] = useState('odontologico');
  const [newPlanOrigin, setNewPlanOrigin] = useState('');
  const [newPlanDesc, setNewPlanDesc] = useState('');
  const [newResponsibleId, setNewResponsibleId] = useState<string>('');

  const [conditionOpen, setConditionOpen] = useState(false);
  const [conditionValue, setConditionValue] = useState<DentalToothCondition>('ausente');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectionMenuOpen, setSelectionMenuOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<'upper' | 'lower' | 'all' | null>(null);
  const [sheetProcSearch, setSheetProcSearch] = useState('');

  const [procedureOpen, setProcedureOpen] = useState(false);
  const [procSearch, setProcSearch] = useState('');
  const [procId, setProcId] = useState<string | null>(null);
  const [procName, setProcName] = useState('');
  const [procSpecialty, setProcSpecialty] = useState('');
  const [procNotes, setProcNotes] = useState('');
  const [teethInput, setTeethInput] = useState('');
  const [teethInputFocused, setTeethInputFocused] = useState(false);
  const [priceTier, setPriceTier] = useState<ClinicPriceTier>(DEFAULT_CLINIC_PRICE_TIER);
  const [unitPrice, setUnitPrice] = useState('0');
  const [procDiscountType, setProcDiscountType] = useState<MoneyAdjustType | 'none'>('none');
  const [procDiscountValue, setProcDiscountValue] = useState('0');
  const [procSurchargeType, setProcSurchargeType] = useState<MoneyAdjustType | 'none'>('none');
  const [procSurchargeValue, setProcSurchargeValue] = useState('0');
  const [selectionType, setSelectionType] = useState<DentalSelectionType>('individual');
  const [region, setRegion] = useState<DentalArchRegion>('upper_arch');
  const [missingWarningAck, setMissingWarningAck] = useState(false);

  const [editItem, setEditItem] = useState<DentalPlanItemRow | null>(null);
  const [editStatus, setEditStatus] = useState<DentalPlanItemStatus>('pending');
  const [editRejectReason, setEditRejectReason] = useState('');
  const [rejectReasonOpen, setRejectReasonOpen] = useState(false);
  const [editDiscountType, setEditDiscountType] = useState<MoneyAdjustType | 'none'>('none');
  const [editDiscountValue, setEditDiscountValue] = useState('0');
  const [editSurchargeType, setEditSurchargeType] = useState<MoneyAdjustType | 'none'>('none');
  const [editSurchargeValue, setEditSurchargeValue] = useState('0');
  const [editNotes, setEditNotes] = useState('');
  const [editUnitPrice, setEditUnitPrice] = useState('0');
  const [editQuantity, setEditQuantity] = useState('1');
  const [editProcId, setEditProcId] = useState<string | null>(null);
  const [editProcName, setEditProcName] = useState('');
  const [editProcSearch, setEditProcSearch] = useState('');
  const [editProcSpecialty, setEditProcSpecialty] = useState<string | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptDefineOpen, setAcceptDefineOpen] = useState(false);
  const [acceptConditions, setAcceptConditions] = useState<DentalPaymentCondition[]>([]);
  const [acceptEditingId, setAcceptEditingId] = useState<string | null>(null);
  const [planRejectOpen, setPlanRejectOpen] = useState(false);
  const [planRejectReason, setPlanRejectReason] = useState('');
  const [priceAdjustItem, setPriceAdjustItem] = useState<DentalPlanItemRow | null>(null);
  const [priceAdjustValue, setPriceAdjustValue] = useState('0');
  const [acceptEditorInitial, setAcceptEditorInitial] = useState(() =>
    createEmptyPaymentDraft(0)
  );

  const [duplicateSource, setDuplicateSource] = useState<DentalPlanItemRow | null>(null);
  const [dupMode, setDupMode] = useState<'tooth' | 'region'>('tooth');
  const [dupTeethInput, setDupTeethInput] = useState('');
  const [dupFace, setDupFace] = useState<DentalToothFace | 'whole'>('whole');
  const [dupRegion, setDupRegion] = useState<DentalArchRegion>('upper_arch');
  const [dupConflictItemId, setDupConflictItemId] = useState<string | null>(null);
  const [pendingDupLocations, setPendingDupLocations] = useState<DentalSelectionLocation[] | null>(
    null
  );

  const [planDiscountType, setPlanDiscountType] = useState<MoneyAdjustType | 'none'>('none');
  const [planDiscountValue, setPlanDiscountValue] = useState('0');
  const [planSurchargeType, setPlanSurchargeType] = useState<MoneyAdjustType | 'none'>('none');
  const [planSurchargeValue, setPlanSurchargeValue] = useState('0');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [commercialNotes, setCommercialNotes] = useState('');

  const catalogQuery = useQuery({
    queryKey: ['dental-procedure-catalog', 'v2'],
    enabled: isClinicAccount,
    queryFn: async (): Promise<CatalogProcedure[]> => {
      // PostgREST: em ilike/like o coringa é `*` (não `%`).
      const { data, error } = await supabase
        .from('procedures')
        .select('id, name, specialty, category, slug')
        .eq('is_active', true)
        .or(
          [
            'specialty.eq.odontologico',
            'category.ilike.*odont*',
            'slug.ilike.odontologia-*',
          ].join(',')
        )
        .order('specialty')
        .order('name');
      if (error) throw error;
      return (data ?? []) as CatalogProcedure[];
    },
    staleTime: 60_000,
  });

  const patientMetaQuery = useQuery({
    queryKey: ['dental-plan-patient-meta', patientId],
    enabled: Boolean(isClinicAccount && patientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('full_name, phone, professional_id, origin_id')
        .eq('id', patientId)
        .maybeSingle();
      if (error) throw error;
      return {
        fullName: (data?.full_name as string | null) ?? null,
        phone: (data?.phone as string | null) ?? null,
        professionalId: (data?.professional_id as string | null) ?? null,
        originId: (data?.origin_id as string | null) ?? null,
      };
    },
    staleTime: 60_000,
  });
  const patientFullName = patientMetaQuery.data?.fullName?.trim() || null;
  const patientPhone = patientMetaQuery.data?.phone ?? null;
  const patientProfessionalId = patientMetaQuery.data?.professionalId ?? null;
  const defaultPlanOrigin = useMemo(
    () => originNameById(clinicOrigins, patientMetaQuery.data?.originId).trim(),
    [clinicOrigins, patientMetaQuery.data?.originId]
  );

  const teamQuery = useQuery({
    queryKey: ['clinic-team-dental'],
    enabled: isClinicAccount,
    queryFn: fetchClinicTeam,
    staleTime: 60_000,
    retry: false,
  });

  /** Fallback para recepção/equipe (API /team exige master). */
  const agendaProsQuery = useQuery({
    queryKey: ['clinic-agenda-professionals-dental-responsible'],
    enabled: isClinicAccount,
    queryFn: fetchClinicAgendaProfessionals,
    staleTime: 60_000,
  });

  const clinicalMembers = useMemo(() => {
    const members = teamQuery.data?.members ?? [];
    return members.filter((m) => {
      if (m.is_blocked) return false;
      if (m.role === 'attendant') return false;
      if (m.role === 'owner' || m.role === 'professional') {
        const body = resolveProfileRegistryBody(
          m.professional_registry_body,
          m.staff_title
        );
        return !body || isClinicalCouncilBody(body) || body === 'CRO';
      }
      return false;
    });
  }, [teamQuery.data]);

  const responsibleOptions = useMemo(() => {
    const byId = new Map(clinicalMembers.map((m) => [m.user_id, m]));
    const team = teamQuery.data?.members ?? [];

    const ensureMember = (
      userId: string | null | undefined,
      fallbackName?: string | null,
      opts?: { allowAttendant?: boolean }
    ) => {
      if (!userId || byId.has(userId)) return;
      const fromTeam = team.find((m) => m.user_id === userId && !m.is_blocked);
      if (fromTeam) {
        if (fromTeam.role === 'attendant' && !opts?.allowAttendant) return;
        byId.set(userId, fromTeam);
        return;
      }
      const fromAgenda = (agendaProsQuery.data ?? []).find((p) => p.userId === userId);
      if (!fromAgenda && !opts?.allowAttendant && !fallbackName) {
        // Sem nome e sem vínculo na agenda clínica → não inclui (evita UUID na lista).
        return;
      }
      if (!fromAgenda && !fallbackName) return;
      byId.set(userId, {
        membership_id: `local:${userId}`,
        user_id: userId,
        role: 'professional',
        created_at: '',
        email: '',
        full_name: fromAgenda?.name?.trim() || fallbackName?.trim() || null,
        is_blocked: false,
        account_type: 'clinic',
      } as (typeof clinicalMembers)[number]);
    };

    // Fonte principal: profissionais da agenda (exclui recepção).
    for (const p of agendaProsQuery.data ?? []) {
      ensureMember(p.userId, p.name);
    }

    // Complementa com membros clínicos da equipe (quando a API master responde).
    for (const m of clinicalMembers) {
      ensureMember(m.user_id, m.full_name);
    }

    // Só inclui o profissional da ficha se for clínico (não recepção).
    if (patientProfessionalId) {
      const onAgenda = (agendaProsQuery.data ?? []).some((p) => p.userId === patientProfessionalId);
      const onClinical = clinicalMembers.some((m) => m.user_id === patientProfessionalId);
      if (onAgenda || onClinical) {
        ensureMember(patientProfessionalId, null);
      }
    }

    // Usuário logado só entra se for clínico.
    if (professionalId) {
      const onAgenda = (agendaProsQuery.data ?? []).some((p) => p.userId === professionalId);
      const onClinical = clinicalMembers.some((m) => m.user_id === professionalId);
      if (onAgenda || onClinical || isClinicClinicalProfessional) {
        ensureMember(professionalId, profile?.full_name);
      }
    }

    return Array.from(byId.values()).sort((a, b) => {
      const nameA =
        a.full_name?.trim() ||
        a.email?.trim() ||
        'Profissional';
      const nameB =
        b.full_name?.trim() ||
        b.email?.trim() ||
        'Profissional';
      return nameA.localeCompare(nameB, 'pt-BR');
    });
  }, [
    clinicalMembers,
    teamQuery.data?.members,
    agendaProsQuery.data,
    professionalId,
    patientProfessionalId,
    profile?.full_name,
    isClinicClinicalProfessional,
  ]);

  const professionalNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (professionalId) {
      const selfName = profile?.full_name?.trim() || profile?.email?.trim() || 'Você';
      map.set(professionalId, selfName);
    }
    for (const m of teamQuery.data?.members ?? []) {
      const name = m.full_name?.trim() || m.email?.trim();
      if (name) map.set(m.user_id, name);
    }
    for (const p of agendaProsQuery.data ?? []) {
      const name = p.name?.trim();
      if (name && !map.has(p.userId)) map.set(p.userId, name);
    }
    for (const m of responsibleOptions) {
      if (map.has(m.user_id)) continue;
      const name = m.full_name?.trim() || m.email?.trim();
      if (name) map.set(m.user_id, name);
    }
    return map;
  }, [
    professionalId,
    profile?.full_name,
    profile?.email,
    teamQuery.data?.members,
    agendaProsQuery.data,
    responsibleOptions,
  ]);

  const optionIdsMissingName = useMemo(
    () =>
      responsibleOptions
        .map((m) => m.user_id)
        .filter((id) => !professionalNameById.has(id)),
    [responsibleOptions, professionalNameById]
  );

  const planProfessionalIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of plans) {
      if (p.responsible_professional_id) ids.add(p.responsible_professional_id);
      if (p.professional_id) ids.add(p.professional_id);
    }
    return [...ids];
  }, [plans]);

  const missingProfessionalIds = useMemo(() => {
    const fromPlans = planProfessionalIds.filter((id) => !professionalNameById.has(id));
    return [...new Set([...fromPlans, ...optionIdsMissingName])];
  }, [planProfessionalIds, professionalNameById, optionIdsMissingName]);

  const profilesNameQuery = useQuery({
    queryKey: ['dental-plan-professional-names', missingProfessionalIds.join(',')],
    enabled: isClinicAccount && missingProfessionalIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', missingProfessionalIds);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; full_name: string | null }>;
    },
    staleTime: 60_000,
  });

  const resolvedProfessionalNameById = useMemo(() => {
    const map = new Map(professionalNameById);
    for (const row of profilesNameQuery.data ?? []) {
      const name = row.full_name?.trim();
      if (name) map.set(row.id, name);
    }
    return map;
  }, [professionalNameById, profilesNameQuery.data]);

  function responsibleOptionLabel(userId: string, fallbackName?: string | null): string {
    return (
      resolvedProfessionalNameById.get(userId) ||
      fallbackName?.trim() ||
      'Profissional'
    );
  }

  function resolvePlanResponsibleName(plan: DentalTreatmentPlanRow): string {
    const userId = plan.responsible_professional_id || plan.professional_id;
    if (!userId) return '—';
    return resolvedProfessionalNameById.get(userId) || '—';
  }

  const defaultResponsibleId = useMemo(() => {
    const optionIds = new Set(responsibleOptions.map((m) => m.user_id));
    const clinicalIds = new Set(clinicalMembers.map((m) => m.user_id));
    // 1) Profissional clínico vinculado na ficha (não recepção)
    if (patientProfessionalId && optionIds.has(patientProfessionalId)) {
      return patientProfessionalId;
    }
    // 2) Usuário logado, se for clínico e estiver na lista
    if (professionalId && clinicalIds.has(professionalId) && optionIds.has(professionalId)) {
      return professionalId;
    }
    if (professionalId && isClinicClinicalProfessional && optionIds.has(professionalId)) {
      return professionalId;
    }
    // 3) Primeiro dentista/profissional da lista clínica
    return clinicalMembers[0]?.user_id ?? responsibleOptions[0]?.user_id ?? '';
  }, [
    responsibleOptions,
    clinicalMembers,
    professionalId,
    patientProfessionalId,
    isClinicClinicalProfessional,
  ]);

  const activePlan = useMemo(
    () => plans.find((p) => p.id === activePlanId) ?? null,
    [plans, activePlanId]
  );

  const isPlanAccepted = Boolean(activePlan?.payment_terms?.trim());
  const isPlanEditLocked =
    isPlanAccepted ||
    activePlan?.status === 'negotiating' ||
    activePlan?.status === 'finished' ||
    activePlan?.status === 'cancelled';

  const itemsSubtotal = useMemo(
    () =>
      calcDentalPlanSubtotal(
        items.map((i) => ({
          quantity: i.quantity,
          unitPrice: Number(i.unit_price),
          totalValue: Number(i.total_value),
          discountType: i.discount_type,
          discountValue: Number(i.discount_value),
          surchargeType: i.surcharge_type,
          surchargeValue: Number(i.surcharge_value),
        }))
      ),
    [items]
  );

  const grandTotal = useMemo(
    () =>
      calcDentalPlanGrandTotal({
        itemsSubtotal,
        discountType: planDiscountType === 'none' ? null : planDiscountType,
        discountValue: parseMoneyInput(planDiscountValue),
        surchargeType: planSurchargeType === 'none' ? null : planSurchargeType,
        surchargeValue: parseMoneyInput(planSurchargeValue),
      }),
    [itemsSubtotal, planDiscountType, planDiscountValue, planSurchargeType, planSurchargeValue]
  );

  const filteredProcedures = useMemo(() => {
    const q = normalizeSearchText(procSearch.trim());
    const list = catalogQuery.data ?? [];
    if (!q) return list.slice(0, 40);
    return list
      .filter(
        (p) =>
          normalizeSearchText(p.name).includes(q) ||
          normalizeSearchText(p.specialty ?? '').includes(q)
      )
      .slice(0, 40);
  }, [catalogQuery.data, procSearch]);

  const sheetProcedureOptions = useMemo(() => {
    const q = normalizeSearchText(sheetProcSearch.trim());
    const list = catalogQuery.data ?? [];
    // Só lista resultados enquanto digita (evita dropdown sempre aberto).
    if (!q) return [];
    return list
      .filter(
        (p) =>
          normalizeSearchText(p.name).includes(q) ||
          normalizeSearchText(p.specialty ?? '').includes(q)
      )
      .slice(0, 40);
  }, [catalogQuery.data, sheetProcSearch]);

  const editProcedureOptions = useMemo(() => {
    const q = normalizeSearchText(editProcSearch.trim());
    const list = catalogQuery.data ?? [];
    if (!q) return [];
    return list
      .filter(
        (p) =>
          normalizeSearchText(p.name).includes(q) ||
          normalizeSearchText(p.specialty ?? '').includes(q)
      )
      .slice(0, 40);
  }, [catalogQuery.data, editProcSearch]);

  const draftLocations = useMemo(() => {
    if (selectionType === 'region') {
      return locationsFromTeethAndFaces({
        teeth: [],
        region,
        selectionType: 'region',
      });
    }
    return locationsFromTeethAndFaces({
      teeth: selectedTeeth,
      faceSelections,
      rootSelections,
      selectionType,
    });
  }, [selectionType, region, selectedTeeth, faceSelections, rootSelections]);

  const draftQty = quantityFromSelection(draftLocations);

  const effectiveAddQty =
    selectionType === 'individual'
      ? Math.max(draftLocations.length, 1)
      : draftQty;

  const draftAddTotal = useMemo(() => {
    const discountType = procDiscountType === 'none' ? null : procDiscountType;
    const discountValue = parseMoneyInput(procDiscountValue);
    const surchargeType = procSurchargeType === 'none' ? null : procSurchargeType;
    const surchargeValue = parseMoneyInput(procSurchargeValue);
    const unit = parseMoneyInput(unitPrice);

    if (selectionType === 'individual') {
      const groups =
        draftLocations.length > 0 ? splitLocationsForIndividual(draftLocations) : [[]];
      return groups.reduce(
        (sum, locs) =>
          sum +
          calcDentalItemTotal({
            quantity: Math.max(quantityFromSelection(locs), 1),
            unitPrice: unit,
            discountType,
            discountValue,
            surchargeType,
            surchargeValue,
          }),
        0
      );
    }

    return calcDentalItemTotal({
      quantity: Math.max(draftQty, 1),
      unitPrice: unit,
      discountType,
      discountValue,
      surchargeType,
      surchargeValue,
    });
  }, [
    selectionType,
    draftLocations,
    draftQty,
    unitPrice,
    procDiscountType,
    procDiscountValue,
    procSurchargeType,
    procSurchargeValue,
  ]);

  const addSelectionSummary = useMemo(() => {
    if (selectionType === 'region') {
      return {
        lines: [`Região: ${DENTAL_REGION_LABELS[region]}`, `Quantidade: ${draftQty}`],
        hint: 'Um item para a região selecionada.',
      };
    }
    if (selectionType === 'group') {
      const teethLabel =
        selectedTeeth.length === 0
          ? '—'
          : selectedTeeth.length <= 4
            ? selectedTeeth.join(', ')
            : `${selectedTeeth.slice(0, 4).join(', ')}… (+${selectedTeeth.length - 4})`;
      const facesLabel =
        faceSelections.length === 0
          ? 'Dente inteiro'
          : faceSelections
              .map((s) => `${s.toothNumber}(${s.faces.map((f) => DENTAL_FACE_LABELS[f]).join(', ')})`)
              .join('; ');
      return {
        lines: [
          `Dentes: ${teethLabel}`,
          `Faces: ${facesLabel}`,
          `Quantidade: ${draftQty}`,
        ],
        hint: 'Um único item agrupando todos os dentes/faces.',
      };
    }
    const first = draftLocations[0];
    const example =
      first?.toothNumber != null
        ? `Dente: ${first.toothNumber}${
            first.face ? ` · Face: ${DENTAL_FACE_LABELS[first.face as DentalToothFace] ?? first.face}` : ''
          }${first.root ? ` · Raiz: ${first.root}` : ''}`
        : selectedTeeth[0]
          ? `Dente: ${selectedTeeth[0]}`
          : 'Selecione dente(s)';
    return {
      lines: [
        example,
        `Quantidade: ${Math.max(draftLocations.length, 1)}`,
        draftLocations.length > 1
          ? `${draftLocations.length} itens serão criados (1 por localização).`
          : '1 item será criado.',
      ],
      hint: 'Individual: um procedimento por dente/face/raiz.',
    };
  }, [
    selectionType,
    region,
    draftQty,
    selectedTeeth,
    faceSelections,
    draftLocations,
  ]);

  const missingSelected = useMemo(
    () =>
      selectedTeeth.filter((t) => {
        const c = conditionsByTooth[t];
        return c === 'ausente' || c === 'ausencia_coroa';
      }),
    [selectedTeeth, conditionsByTooth]
  );

  const absentTeethAll = useMemo(
    () =>
      Object.entries(conditionsByTooth)
        .filter(([, c]) => c === 'ausente' || c === 'ausencia_coroa')
        .map(([t]) => t),
    [conditionsByTooth]
  );

  const itemsForSelectedTeeth = useMemo(() => {
    if (selectedTeeth.length === 0) return [];
    const set = new Set(selectedTeeth);
    return items.filter((item) =>
      locations.some(
        (l) =>
          l.plan_item_id === item.id &&
          l.tooth_number != null &&
          set.has(l.tooth_number)
      )
    );
  }, [items, locations, selectedTeeth]);

  const canDuplicateProcedure = itemsForSelectedTeeth.length > 0;

  const refreshPlans = useCallback(async () => {
    const rows = await listDentalPlansForPatient(patientId);
    if (focusPlanId) {
      const focused = rows.filter((p) => p.id === focusPlanId);
      setPlans(focused);
      setActivePlanId(focusPlanId);
      return focused;
    }
    setPlans(rows);
    return rows;
  }, [patientId, focusPlanId]);

  const refreshConditions = useCallback(async () => {
    const rows = await listPatientToothConditions(patientId);
    const map: Record<string, DentalToothCondition> = {};
    for (const row of rows) map[row.tooth_number] = row.condition;
    setConditionsByTooth(map);
  }, [patientId]);

  const refreshPlanDetail = useCallback(async (planId: string) => {
    const detail = await listDentalPlanItems(planId);
    setItems(detail.items);
    setLocations(detail.locations);
    return detail;
  }, []);

  function applyPlanLocationsToSelection(locs: DentalPlanItemLocationRow[]) {
    const toothSet = new Set<string>();
    const faceMap = new Map<string, Set<DentalToothFace>>();
    const rootMap = new Map<string, Set<string>>();

    for (const loc of locs) {
      const tooth = loc.tooth_number?.trim();
      if (!tooth) continue;
      toothSet.add(tooth);
      if (loc.face) {
        const faces = faceMap.get(tooth) ?? new Set<DentalToothFace>();
        faces.add(loc.face as DentalToothFace);
        faceMap.set(tooth, faces);
      }
      if (loc.root) {
        const roots = rootMap.get(tooth) ?? new Set<string>();
        roots.add(loc.root);
        rootMap.set(tooth, roots);
      }
    }

    const teeth = [...toothSet].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
    setBulkMode(null);
    setSelectedTeeth(teeth);
    setFaceSelections(
      [...faceMap.entries()].map(([toothNumber, faces]) => ({
        toothNumber,
        faces: [...faces],
      }))
    );
    setRootSelections(
      [...rootMap.entries()].map(([toothNumber, roots]) => ({
        toothNumber,
        roots: [...roots],
      }))
    );
    setFaceFocusTooth(teeth[teeth.length - 1] ?? null);
    setTeethInput(formatTeethSelectionInput(teeth));
    if (teeth.length > 1) setSelectionType('group');
    else if (teeth.length === 1) setSelectionType('individual');
  }

  const loadAll = useCallback(async () => {
    if (!isClinicAccount) {
      setLoading(false);
      setPlans([]);
      setConditionsByTooth({});
      return;
    }
    setLoading(true);
    try {
      await Promise.all([refreshPlans(), refreshConditions()]);
    } catch {
      toast.error('Não foi possível carregar os planos odontológicos.');
    } finally {
      setLoading(false);
    }
  }, [isClinicAccount, refreshPlans, refreshConditions]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!preferCreatePlan || loading || lockedToPlan || focusPlanId) return;
    if (plans.length === 0) setCreateOpen(true);
  }, [preferCreatePlan, loading, lockedToPlan, focusPlanId, plans.length]);

  useEffect(() => {
    if (!activePlanId) {
      setItems([]);
      setLocations([]);
      clearSelection();
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const detail = await listDentalPlanItems(activePlanId);
        if (cancelled) return;
        setItems(detail.items);
        setLocations(detail.locations);
        applyPlanLocationsToSelection(detail.locations);
      } catch {
        if (!cancelled) toast.error('Erro ao carregar itens do plano.');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage à troca de plano
  }, [activePlanId]);

  useEffect(() => {
    if (!activePlan) return;
    setPlanDiscountType(activePlan.discount_type ?? 'none');
    setPlanDiscountValue(String(activePlan.discount_value ?? 0));
    setPlanSurchargeType(activePlan.surcharge_type ?? 'none');
    setPlanSurchargeValue(String(activePlan.surcharge_value ?? 0));
    setPaymentTerms(activePlan.payment_terms ?? '');
    setCommercialNotes(activePlan.commercial_notes ?? '');
  }, [activePlan]);

  useEffect(() => {
    if (!createOpen) return;
    if (defaultResponsibleId) setNewResponsibleId(defaultResponsibleId);
    setNewPlanOrigin(defaultPlanOrigin);
  }, [createOpen, defaultResponsibleId, defaultPlanOrigin]);

  useEffect(() => {
    if (teethInputFocused) return;
    if (bulkMode === 'all') {
      setTeethInput('');
      return;
    }
    setTeethInput(formatTeethSelectionInput(selectedTeeth));
  }, [selectedTeeth, teethInputFocused, bulkMode]);

  useEffect(() => {
    if (isPlanAccepted || isPlanEditLocked) {
      setSelectionMenuOpen(false);
      return;
    }
    if (selectedTeeth.length > 0) setSelectionMenuOpen(true);
  }, [selectedTeeth.length, isPlanAccepted, isPlanEditLocked]);

  useEffect(() => {
    setFaceSelections((prev) => {
      const next = prev.filter((s) => selectedTeeth.includes(s.toothNumber));
      return next.length === prev.length ? prev : next;
    });
    setRootSelections((prev) => {
      const next = prev.filter((s) => selectedTeeth.includes(s.toothNumber));
      return next.length === prev.length ? prev : next;
    });
  }, [selectedTeeth]);

  useEffect(() => {
    if (selectedTeeth.length === 0) {
      if (faceFocusTooth != null) setFaceFocusTooth(null);
      return;
    }
    if (!faceFocusTooth || !selectedTeeth.includes(faceFocusTooth)) {
      setFaceFocusTooth(selectedTeeth[selectedTeeth.length - 1] ?? null);
    }
  }, [selectedTeeth, faceFocusTooth]);

  function commitToothSelection(
    incoming: string[],
    mode: 'replace' | 'add' | 'toggle',
    opts?: { allowMixed?: boolean; silentInvalid?: boolean }
  ): boolean {
    const first = applyToothSelection({
      current: selectedTeeth,
      incoming,
      mode,
      allowMixedDentition: false,
    });

    if (first.invalid.length && !opts?.silentInvalid) {
      toast.error(`Números inválidos ou inexistentes: ${first.invalid.join(', ')}`);
    }

    if (first.needsMixedConfirm && !opts?.allowMixed) {
      const ok = window.confirm(
        'A seleção mistura dentes permanentes e decíduos. Deseja continuar?'
      );
      if (!ok) return false;
      const confirmed = applyToothSelection({
        current: selectedTeeth,
        incoming,
        mode,
        allowMixedDentition: true,
      });
      setSelectedTeeth(confirmed.next);
      return confirmed.next !== selectedTeeth || confirmed.next.length > 0;
    }

    if (!first.needsMixedConfirm) {
      setSelectedTeeth(first.next);
    }
    return true;
  }

  function handleSelectTooth(
    tooth: string,
    opts: { additive: boolean; dragAdd?: boolean }
  ) {
    setBulkMode(null);
    setFaceFocusTooth(tooth);
    if (opts.dragAdd) {
      const result = applyToothSelection({
        current: selectedTeeth,
        incoming: [tooth],
        mode: 'add',
        allowMixedDentition: false,
      });
      // No arraste, não pergunta mistura a cada dente — só adiciona se compatível.
      if (!result.needsMixedConfirm) setSelectedTeeth(result.next);
      return;
    }
    if (opts.additive) {
      commitToothSelection([tooth], 'toggle', { silentInvalid: true });
      return;
    }
    if (selectedTeeth.length === 1 && selectedTeeth[0] === tooth) {
      setSelectedTeeth([]);
      setFaceFocusTooth(null);
      return;
    }
    commitToothSelection([tooth], 'replace', { silentInvalid: true });
  }

  function handleToggleFace(tooth: string, face: DentalToothFace) {
    setBulkMode(null);
    setFaceFocusTooth(tooth);
    commitToothSelection([tooth], 'add', { silentInvalid: true });
    setFaceSelections((prev) => toggleFaceInSelection(prev, tooth, face));
  }

  function clearSelection() {
    setSelectedTeeth([]);
    setFaceFocusTooth(null);
    setFaceSelections([]);
    setRootSelections([]);
    setTeethInput('');
    setBulkMode(null);
    setSheetProcSearch('');
  }

  function selectArch(teeth: readonly string[], mode: 'upper' | 'lower' | 'all') {
    commitToothSelection([...teeth], 'replace');
    setFaceSelections([]);
    setRootSelections([]);
    setBulkMode(mode);
    setFaceFocusTooth(null);
    setSelectionType('group');
    if (mode === 'all') setTeethInput('');
  }

  function handleTeethInputChange(value: string) {
    setBulkMode(null);
    setTeethInput(value);
    const parsed = parseToothNumbersInput(value);
    if (parsed.length === 0) {
      if (value.trim() === '') {
        setSelectedTeeth([]);
        setFaceFocusTooth(null);
      }
      return;
    }
    const preview = applyToothSelection({
      current: [],
      incoming: parsed,
      mode: 'replace',
      allowMixedDentition: false,
    });
    // Destaca números válidos enquanto digita; mistura permanente/decíduo só no Aplicar.
    if (!preview.needsMixedConfirm) {
      setSelectedTeeth(preview.next);
      setFaceFocusTooth(preview.next[preview.next.length - 1] ?? null);
    }
  }

  function applyTeethInput() {
    setBulkMode(null);
    const parsed = parseToothNumbersInput(teethInput);
    const ok = commitToothSelection(parsed, 'replace');
    if (ok) {
      const { valid } = validateToothNumbers(parsed);
      setTeethInput(formatTeethSelectionInput(valid));
    }
  }

  async function handleCreatePlan() {
    if (!professionalId) return;
    const name = newPlanName.trim();
    if (!name) {
      toast.error('Informe o nome do plano.');
      return;
    }
    const responsible = newResponsibleId || defaultResponsibleId;
    if (!responsible) {
      toast.error('Selecione o profissional responsável.');
      return;
    }
    setBusy(true);
    try {
      const plan = await createDentalPlan({
        patientId,
        professionalId,
        responsibleProfessionalId: responsible,
        createdBy: professionalId,
        name,
        planType: newPlanType.trim() || 'odontologico',
        origin: newPlanOrigin.trim() || null,
        description: newPlanDesc.trim() || null,
      });
      toast.success('Plano criado.');
      setCreateOpen(false);
      setNewPlanName('');
      setNewPlanType('odontologico');
      setNewPlanOrigin(defaultPlanOrigin);
      setNewPlanDesc('');
      setNewResponsibleId(defaultResponsibleId);
      await refreshPlans();
      setActivePlanId(plan.id);
    } catch {
      toast.error('Erro ao criar plano.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePlan() {
    if (!deletePlanId) return;
    setBusy(true);
    try {
      await deleteDentalPlan(deletePlanId);
      toast.success('Plano excluído.');
      if (activePlanId === deletePlanId) {
        setActivePlanId(null);
        clearSelection();
      }
      setDeletePlanId(null);
      await refreshPlans();
    } catch {
      toast.error('Erro ao excluir plano.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveCondition() {
    if (!professionalId || selectedTeeth.length === 0) {
      toast.error('Selecione ao menos um dente.');
      return;
    }
    setBusy(true);
    try {
      let teeth = [...selectedTeeth];
      if (conditionValue === 'deciduo') {
        teeth = teeth.map(resolveToothNumberForDeciduousCondition);
      } else if (conditionValue === 'permanente') {
        teeth = teeth.map(resolveToothNumberForPermanentCondition);
      }
      await upsertPatientToothConditions({
        patientId,
        updatedBy: professionalId,
        teeth,
        condition: conditionValue,
      });
      toast.success('Situação clínica atualizada.');
      setConditionOpen(false);
      clearSelection();
      await refreshConditions();
    } catch {
      toast.error('Erro ao salvar situação do dente.');
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkAbsentQuick() {
    if (!professionalId || selectedTeeth.length === 0) {
      toast.error('Selecione ao menos um dente.');
      return;
    }
    setBusy(true);
    try {
      await upsertPatientToothConditions({
        patientId,
        updatedBy: professionalId,
        teeth: selectedTeeth,
        condition: 'ausente',
      });
      toast.success(
        selectedTeeth.length === 1
          ? `Dente ${selectedTeeth[0]} marcado como ausente.`
          : `${selectedTeeth.length} dentes marcados como ausentes.`
      );
      await refreshConditions();
    } catch {
      toast.error('Erro ao marcar dente como ausente.');
    } finally {
      setBusy(false);
    }
  }

  function scrollToProceduresList() {
    const el = document.getElementById('dental-plan-procedures-list');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openProcedureModal(opts?: {
    selectionType?: DentalSelectionType;
    region?: DentalArchRegion;
    procedureName?: string;
    procedureId?: string | null;
    specialty?: string | null;
    clearFaces?: boolean;
    unitPrice?: number | string;
    notes?: string | null;
    teeth?: string[];
  }) {
    if (!activePlan) {
      toast.error('Abra ou crie um plano primeiro.');
      return;
    }
    if (isPlanEditLocked) {
      toast.error('Plano aceito — edição bloqueada.');
      return;
    }
    const teeth = opts?.teeth ?? selectedTeeth;
    if (opts?.clearFaces) {
      setFaceSelections([]);
    }
    if (opts?.selectionType) {
      setSelectionType(opts.selectionType);
    } else if (teeth.length === 0) {
      setSelectionType('region');
    } else {
      setSelectionType(teeth.length > 1 ? 'group' : 'individual');
    }
    if (opts?.region) setRegion(opts.region);
    setProcSearch(opts?.procedureName?.trim() || '');
    setProcId(opts?.procedureId ?? null);
    setProcName(opts?.procedureName?.trim() || '');
    setProcSpecialty(opts?.specialty ?? '');
    setProcNotes(opts?.notes?.trim() || '');
    setTeethInput(teeth.join(', '));
    setPriceTier(DEFAULT_CLINIC_PRICE_TIER);
    setProcDiscountType('none');
    setProcDiscountValue('0');
    setProcSurchargeType('none');
    setProcSurchargeValue('0');
    if (opts?.unitPrice != null) {
      setUnitPrice(String(opts.unitPrice));
    } else if (opts?.procedureId) {
      const price = getPrice(opts.procedureId, DEFAULT_CLINIC_PRICE_TIER);
      setUnitPrice(price != null ? String(price) : '0');
    } else {
      setUnitPrice('0');
    }
    setMissingWarningAck(false);
    setProcedureOpen(true);
  }

  function openDuplicateItemDialog(source: DentalPlanItemRow) {
    const sourceLocs = itemLocationsAsSelection(source.id, locations);
    const isRegion =
      source.selection_type === 'region' || sourceLocs.some((l) => !!l.region);
    setDuplicateSource(source);
    setDupMode(isRegion ? 'region' : 'tooth');
    setDupRegion(
      (sourceLocs.find((l) => l.region)?.region as DentalArchRegion) ?? 'upper_arch'
    );
    const sourceTeeth = sourceLocs
      .map((l) => l.toothNumber)
      .filter((t): t is string => !!t);
    // Prefere dentes já selecionados no odontograma (destino), se houver.
    setDupTeethInput(
      selectedTeeth.length > 0
        ? selectedTeeth.join(', ')
        : sourceTeeth.length === 1
          ? ''
          : ''
    );
    const faces = sourceLocs.map((l) => l.face).filter((f): f is DentalToothFace => !!f);
    setDupFace(faces.length === 1 ? faces[0]! : 'whole');
    setDupConflictItemId(null);
    setPendingDupLocations(null);
  }

  function buildDuplicateLocations(): DentalSelectionLocation[] | null {
    if (!duplicateSource) return null;
    if (dupMode === 'region') {
      return [{ region: dupRegion }];
    }
    const parsed = parseToothNumbersInput(dupTeethInput);
    const { valid, invalid } = validateToothNumbers(parsed);
    if (invalid.length) {
      toast.error(`Números inválidos: ${invalid.join(', ')}`);
      return null;
    }
    if (valid.length === 0) {
      toast.error('Informe o(s) dente(s) de destino.');
      return null;
    }
    const face = dupFace === 'whole' ? null : dupFace;
    return valid.map((toothNumber) => ({
      toothNumber,
      face,
      root: null,
      region: null,
    }));
  }

  function existingItemsForConflict() {
    return items.map((item) => ({
      id: item.id,
      procedureName: item.procedure_name,
      locations: itemLocationsAsSelection(item.id, locations),
    }));
  }

  async function createDuplicatedItem(locs: DentalSelectionLocation[]) {
    if (!activePlan || !duplicateSource) return;
    const qty = quantityFromSelection(locs);
    await addDentalPlanItem({
      planId: activePlan.id,
      procedureId: duplicateSource.procedure_id,
      procedureName: duplicateSource.procedure_name,
      specialty: duplicateSource.specialty,
      priceTable:
        (duplicateSource.price_table as ClinicPriceTier) || DEFAULT_CLINIC_PRICE_TIER,
      selectionType:
        locs.some((l) => l.region) ? 'region' : locs.length > 1 ? 'group' : 'individual',
      quantity: qty,
      unitPrice: Number(duplicateSource.unit_price),
      discountType: duplicateSource.discount_type,
      discountValue: Number(duplicateSource.discount_value),
      surchargeType: duplicateSource.surcharge_type,
      surchargeValue: Number(duplicateSource.surcharge_value),
      notes: duplicateSource.notes,
      locations: locs,
      sortOrder: items.length,
    });
  }

  async function consolidateIntoItem(targetItemId: string, addQty: number) {
    const target = items.find((i) => i.id === targetItemId);
    if (!target) return;
    const nextQty = Number(target.quantity) + addQty;
    await updateDentalPlanItem(targetItemId, {
      quantity: nextQty,
      unit_price: Number(target.unit_price),
      discount_type: target.discount_type,
      discount_value: Number(target.discount_value),
      surcharge_type: target.surcharge_type,
      surcharge_value: Number(target.surcharge_value),
    });
  }

  async function confirmDuplicateItem(forceCreate = false) {
    if (!activePlan || !duplicateSource) return;
    const locs = pendingDupLocations ?? buildDuplicateLocations();
    if (!locs) return;

    if (!forceCreate) {
      const conflict = hasProcedureToothFaceConflict({
        existing: existingItemsForConflict(),
        procedureName: duplicateSource.procedure_name,
        locations: locs,
      });
      if (conflict?.id) {
        setPendingDupLocations(locs);
        setDupConflictItemId(conflict.id);
        return;
      }
    }

    setBusy(true);
    try {
      await createDuplicatedItem(locs);
      toast.success(`Procedimento “${duplicateSource.procedure_name}” duplicado.`);
      setDuplicateSource(null);
      setPendingDupLocations(null);
      setDupConflictItemId(null);
      await refreshPlanDetail(activePlan.id);
    } catch {
      toast.error('Erro ao duplicar procedimento.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmConsolidateDuplicate() {
    if (!activePlan || !duplicateSource || !dupConflictItemId || !pendingDupLocations) return;
    setBusy(true);
    try {
      const addQty = quantityFromSelection(pendingDupLocations);
      await consolidateIntoItem(dupConflictItemId, addQty);
      toast.success('Quantidade consolidada no item existente.');
      setDuplicateSource(null);
      setPendingDupLocations(null);
      setDupConflictItemId(null);
      await refreshPlanDetail(activePlan.id);
    } catch {
      toast.error('Erro ao consolidar procedimento.');
    } finally {
      setBusy(false);
    }
  }

  function handleDuplicateProcedure() {
    if (!activePlan) {
      toast.error('Abra ou crie um plano primeiro.');
      return;
    }
    const source = itemsForSelectedTeeth[itemsForSelectedTeeth.length - 1];
    if (!source) {
      toast.error('Nenhum procedimento nestes dentes para duplicar.');
      return;
    }
    openDuplicateItemDialog(source);
  }

  function openToothHistory() {
    if (selectedTeeth.length === 0) {
      toast.error('Selecione ao menos um dente.');
      return;
    }
    setHistoryOpen(true);
  }

  function pickProcedure(p: CatalogProcedure) {
    setProcId(p.id);
    setProcName(p.name);
    setProcSpecialty(p.specialty ?? '');
    const price = getPrice(p.id, priceTier);
    setUnitPrice(price != null ? String(price) : '0');
  }

  function clearSheetProcedurePick() {
    setProcId(null);
    setProcName('');
    setProcSpecialty('');
    setUnitPrice('0');
  }

  async function handleSheetAddProcedure(p: {
    id: string;
    name: string;
    specialty: string | null;
  }) {
    if (!activePlan) {
      toast.error('Abra ou crie um plano primeiro.');
      return;
    }
    if (selectedTeeth.length === 0) {
      toast.error('Selecione ao menos um dente.');
      return;
    }

    const procedureName = p.name.trim();
    const specialty = (p.specialty ?? '').trim() || null;
    const price = getPrice(p.id, priceTier);
    const unit = price != null ? Number(price) : 0;

    // Em massa (todos): um item em grupo, dente inteiro, sem faces.
    const useGroup = bulkMode === 'all' || selectedTeeth.length > 1;
    const locs = locationsFromTeethAndFaces({
      teeth: selectedTeeth,
      faceSelections: bulkMode === 'all' ? [] : faceSelections,
      rootSelections: bulkMode === 'all' ? [] : rootSelections,
      selectionType: useGroup ? 'group' : 'individual',
    });

    const existing: Array<{ procedureName: string; locations: DentalSelectionLocation[] }> =
      items.map((item) => ({
      procedureName: item.procedure_name,
      locations: locations
        .filter((l) => l.plan_item_id === item.id)
        .map((l) => ({
          toothNumber: l.tooth_number,
          face: l.face as DentalToothFace | null,
          root: l.root,
          region: l.region as DentalArchRegion | null,
        })),
    }));

    if (
      isDuplicateDentalItem({
        existing,
        procedureName,
        locations: locs,
      })
    ) {
      toast.error('Já existe o mesmo procedimento nestas localizações.');
      return;
    }

    const qty = quantityFromSelection(locs);
    setBusy(true);
    try {
      await addDentalPlanItem({
        planId: activePlan.id,
        procedureId: p.id,
        procedureName,
        specialty,
        priceTable: priceTier,
        selectionType: useGroup ? 'group' : 'individual',
        quantity: qty,
        unitPrice: unit,
        locations: locs,
        sortOrder: items.length,
      });
      toast.success(`${procedureName} adicionado.`);
      clearSheetProcedurePick();
      setSheetProcSearch('');
      const detail = await refreshPlanDetail(activePlan.id);
      applyPlanLocationsToSelection(detail.locations);
    } catch {
      toast.error('Erro ao adicionar procedimento.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSheetDeleteItem(itemId: string) {
    if (!activePlan) return;
    setBusy(true);
    try {
      await deleteDentalPlanItem(itemId);
      toast.success('Procedimento removido.');
      await refreshPlanDetail(activePlan.id);
    } catch {
      toast.error('Erro ao remover item.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!procId || !procedureOpen) return;
    const price = getPrice(procId, priceTier);
    if (price != null) setUnitPrice(String(price));
  }, [priceTier, procId, getPrice, procedureOpen]);

  async function handleAddProcedure() {
    if (!activePlan) return;
    const name = procName.trim();
    if (!name) {
      toast.error('Informe o procedimento.');
      return;
    }
    if (selectionType !== 'region' && selectedTeeth.length === 0) {
      toast.error('Selecione ao menos um dente ou use região.');
      return;
    }
    if (missingSelected.length > 0 && !missingWarningAck) {
      toast.message('Confirme o alerta de dente ausente antes de continuar.');
      return;
    }

    const existing: Array<{ procedureName: string; locations: DentalSelectionLocation[] }> =
      items.map((item) => ({
      procedureName: item.procedure_name,
      locations: locations
        .filter((l) => l.plan_item_id === item.id)
        .map((l) => ({
          toothNumber: l.tooth_number,
          face: l.face as DentalToothFace | null,
          root: l.root,
          region: l.region as DentalArchRegion | null,
        })),
    }));

    const locationGroups =
      selectionType === 'individual'
        ? splitLocationsForIndividual(draftLocations)
        : [draftLocations];

    for (const locs of locationGroups) {
      if (
        isDuplicateDentalItem({
          existing,
          procedureName: name,
          locations: locs,
        })
      ) {
        toast.error('Já existe o mesmo procedimento nestas localizações.');
        return;
      }
    }

    const unit = parseMoneyInput(unitPrice);
    const discountType = procDiscountType === 'none' ? null : procDiscountType;
    const discountValue = parseMoneyInput(procDiscountValue);
    const surchargeType = procSurchargeType === 'none' ? null : procSurchargeType;
    const surchargeValue = parseMoneyInput(procSurchargeValue);
    setBusy(true);
    try {
      let sort = items.length;
      for (const locs of locationGroups) {
        const qty = quantityFromSelection(locs);
        await addDentalPlanItem({
          planId: activePlan.id,
          procedureId: procId,
          procedureName: name,
          specialty: procSpecialty.trim() || null,
          priceTable: priceTier,
          selectionType,
          quantity: qty,
          unitPrice: unit,
          discountType,
          discountValue,
          surchargeType,
          surchargeValue,
          notes: procNotes.trim() || null,
          locations: locs,
          sortOrder: sort++,
        });
        existing.push({ procedureName: name, locations: locs });
      }
      toast.success(
        selectionType === 'individual' && locationGroups.length > 1
          ? `${locationGroups.length} itens adicionados (seleção individual).`
          : 'Procedimento adicionado ao plano.'
      );
      setProcedureOpen(false);
      const detail = await refreshPlanDetail(activePlan.id);
      applyPlanLocationsToSelection(detail.locations);
    } catch {
      toast.error('Erro ao adicionar procedimento.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!activePlan) return;
    if (!window.confirm('Remover este procedimento do plano?')) return;
    setBusy(true);
    try {
      await deleteDentalPlanItem(itemId);
      toast.success('Item removido.');
      await refreshPlanDetail(activePlan.id);
    } catch {
      toast.error('Erro ao remover item.');
    } finally {
      setBusy(false);
    }
  }

  function openPriceAdjust(item: DentalPlanItemRow) {
    setPriceAdjustItem(item);
    const n = Number(item.unit_price) || 0;
    setPriceAdjustValue(n.toFixed(2).replace('.', ','));
  }

  function nudgePriceAdjust(delta: number) {
    const current = parseMoneyInput(priceAdjustValue);
    const next = Math.max(0, current + delta);
    setPriceAdjustValue(next.toFixed(2).replace('.', ','));
  }

  async function handleSavePriceAdjust() {
    if (!priceAdjustItem || !activePlan) return;
    setBusy(true);
    try {
      await updateDentalPlanItem(priceAdjustItem.id, {
        unit_price: parseMoneyInput(priceAdjustValue),
      });
      toast.success('Valor atualizado.');
      setPriceAdjustItem(null);
      await refreshPlanDetail(activePlan.id);
    } catch {
      toast.error('Erro ao atualizar o valor.');
    } finally {
      setBusy(false);
    }
  }

  function openEditItem(item: DentalPlanItemRow) {
    setEditItem(item);
    setEditStatus(item.status);
    const existingReject =
      item.status === 'rejected' && item.notes?.startsWith('Indeferido:')
        ? item.notes.replace(/^Indeferido:\s*/i, '').trim()
        : item.status === 'rejected'
          ? (item.notes ?? '')
          : '';
    setEditRejectReason(existingReject);
    setRejectReasonOpen(false);
    setEditDiscountType(item.discount_type ?? 'none');
    setEditDiscountValue(String(item.discount_value ?? 0));
    setEditSurchargeType(item.surcharge_type ?? 'none');
    setEditSurchargeValue(String(item.surcharge_value ?? 0));
    setEditNotes(
      item.status === 'rejected' && item.notes?.startsWith('Indeferido:')
        ? ''
        : (item.notes ?? '')
    );
    setEditUnitPrice(String(item.unit_price ?? 0));
    setEditQuantity(String(item.quantity ?? 1));
    setEditProcId(item.procedure_id);
    setEditProcName(item.procedure_name);
    setEditProcSearch('');
    setEditProcSpecialty(item.specialty);
  }

  async function handleCommercialSituation(
    item: DentalPlanItemRow,
    reason: (typeof COMMERCIAL_SITUATION_REASONS)[number]
  ) {
    if (!activePlan) return;
    setBusy(true);
    try {
      await updateDentalPlanItem(item.id, {
        status: 'rejected',
        notes: `Indeferido: ${reason}`,
      });
      toast.success(`Situação: ${reason}`);
      await refreshPlanDetail(activePlan.id);
    } catch {
      toast.error('Erro ao atualizar a situação.');
    } finally {
      setBusy(false);
    }
  }

  async function persistItemStatus(status: DentalPlanItemStatus, rejectReason: string) {
    if (!editItem || !activePlan) return;
    const notes =
      status === 'rejected'
        ? `Indeferido: ${rejectReason.trim()}`
        : showCommercialDetails
          ? null
          : editNotes.trim() || null;
    await updateDentalPlanItem(editItem.id, {
      status,
      notes,
    });
    toast.success('Situação atualizada.');
    setEditItem(null);
    setRejectReasonOpen(false);
    setEditRejectReason('');
    await refreshPlanDetail(activePlan.id);
  }

  async function handleSaveEditItem() {
    if (!editItem || !activePlan) return;

    // Recepção: corrige procedimento / quantidade (não usa mais a caneta para situação).
    if (showCommercialDetails) {
      const name = editProcName.trim();
      if (name.length < 2) {
        toast.error('Informe o nome do procedimento.');
        return;
      }
      setBusy(true);
      try {
        await updateDentalPlanItem(editItem.id, {
          procedure_id: editProcId,
          procedure_name: name,
          specialty: editProcSpecialty,
          quantity: Math.max(1, Math.round(Number(editQuantity) || 1)),
          notes: editNotes.trim() || null,
        });
        toast.success('Procedimento atualizado.');
        setEditItem(null);
        await refreshPlanDetail(activePlan.id);
      } catch {
        toast.error('Erro ao atualizar procedimento.');
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      await updateDentalPlanItem(editItem.id, {
        unit_price: parseMoneyInput(editUnitPrice),
        discount_type: editDiscountType === 'none' ? null : editDiscountType,
        discount_value: parseMoneyInput(editDiscountValue),
        surcharge_type: editSurchargeType === 'none' ? null : editSurchargeType,
        surcharge_value: parseMoneyInput(editSurchargeValue),
        notes: editNotes.trim() || null,
      });
      toast.success('Item atualizado.');
      setEditItem(null);
      await refreshPlanDetail(activePlan.id);
    } catch {
      toast.error('Erro ao atualizar item.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmRejectReason() {
    if (!editRejectReason.trim()) {
      toast.error('Informe o motivo do indeferimento.');
      return;
    }
    setBusy(true);
    try {
      await persistItemStatus('rejected', editRejectReason);
    } catch {
      toast.error('Erro ao indeferir procedimento.');
    } finally {
      setBusy(false);
    }
  }

  function planAcceptSubtotal() {
    const acceptedSubtotal = items
      .filter((i) => i.status !== 'rejected')
      .reduce((sum, i) => sum + Number(i.total_value || 0), 0);
    if (acceptedSubtotal > 0) return acceptedSubtotal;
    return grandTotal > 0 ? grandTotal : 0;
  }

  function openAcceptDialog() {
    setAcceptConditions([]);
    setAcceptEditingId(null);
    setAcceptEditorInitial(createEmptyPaymentDraft(planAcceptSubtotal()));
    setAcceptDefineOpen(false);
    setAcceptOpen(true);
  }

  function openAddPaymentCondition() {
    const currentSum = acceptConditions.reduce((s, c) => s + c.amount, 0);
    const remaining = Math.max(0, planAcceptSubtotal() - currentSum);
    setAcceptEditingId(null);
    setAcceptEditorInitial(createEmptyPaymentDraft(remaining || planAcceptSubtotal()));
    setAcceptDefineOpen(true);
  }

  function openEditPaymentCondition(id: string) {
    const current = acceptConditions.find((c) => c.id === id);
    if (!current) return;
    setAcceptEditingId(id);
    setAcceptEditorInitial(current);
    setAcceptDefineOpen(true);
  }

  function savePaymentCondition(condition: Omit<DentalPaymentCondition, 'id'>) {
    if (acceptEditingId) {
      setAcceptConditions((prev) =>
        prev.map((c) => (c.id === acceptEditingId ? { ...condition, id: c.id } : c))
      );
    } else {
      setAcceptConditions((prev) => [
        ...prev,
        { ...condition, id: crypto.randomUUID() },
      ]);
    }
    setAcceptDefineOpen(false);
    setAcceptEditingId(null);
  }

  function removePaymentCondition(id: string) {
    setAcceptConditions((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleAcceptPlan() {
    if (!activePlan) return;
    if (acceptConditions.length === 0) {
      toast.error('Adicione ao menos uma condição de pagamento.');
      return;
    }
    const total = acceptConditions.reduce((s, c) => s + c.amount, 0);
    if (!(total > 0)) {
      toast.error('Informe valores válidos nas condições de pagamento.');
      return;
    }
    const acceptedItems = items.filter((i) => i.status !== 'rejected');
    if (acceptedItems.length === 0) {
      toast.error('Não há procedimentos aceitos no plano.');
      return;
    }

    setBusy(true);
    try {
      for (const item of acceptedItems) {
        if (item.status !== 'authorized' && item.status !== 'done') {
          await updateDentalPlanItem(item.id, { status: 'authorized' });
        }
      }

      const paymentSummary = formatPaymentConditionsSummary(acceptConditions);
      await updateDentalPlan(activePlan.id, {
        status: 'authorized',
        payment_terms: paymentSummary,
      });

      toast.success('Venda registrada com as condições de pagamento.');
      setAcceptOpen(false);
      setSelectionMenuOpen(false);
      await refreshPlans();
      const detail = await refreshPlanDetail(activePlan.id);
      applyPlanLocationsToSelection(detail.locations);
    } catch {
      toast.error('Erro ao registrar a venda.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRejectPlan() {
    if (!activePlan) return;
    if (!planRejectReason.trim()) {
      toast.error('Informe o motivo do indeferimento.');
      return;
    }
    setBusy(true);
    try {
      const reason = planRejectReason.trim();
      const pendingItems = items.filter(
        (i) => i.status === 'pending' || i.status === 'authorized'
      );
      for (const item of pendingItems) {
        await updateDentalPlanItem(item.id, {
          status: 'rejected',
          notes: `Indeferido: ${reason}`,
        });
      }
      const prevNotes = activePlan.commercial_notes?.trim() || '';
      await updateDentalPlan(activePlan.id, {
        status: 'cancelled',
        commercial_notes: prevNotes
          ? `${prevNotes}\nIndeferido: ${reason}`
          : `Indeferido: ${reason}`,
      });
      toast.success('Plano indeferido.');
      setPlanRejectOpen(false);
      setPlanRejectReason('');
      await refreshPlans();
      await refreshPlanDetail(activePlan.id);
    } catch {
      toast.error('Erro ao indeferir o plano.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSendBudgetWhatsApp() {
    if (!activePlan || !professionalId) return;
    const sellable = items.filter((i) => i.status !== 'rejected');
    if (sellable.length === 0) {
      toast.error('Inclua ao menos um procedimento para enviar o orçamento.');
      return;
    }
    const wa = formatPhoneForWhatsApp(patientPhone);
    if (!wa) {
      toast.error('Cadastre o telefone do paciente na ficha para enviar pelo WhatsApp.');
      return;
    }

    setBusy(true);
    try {
      let budgetQuoteId = activePlan.budget_quote_id?.trim() || null;
      if (!budgetQuoteId) {
        const result = await sendDentalPlanToNegotiation({
          planId: activePlan.id,
          professionalId,
          patientId,
          planName: activePlan.name,
          notes: activePlan.commercial_notes,
          items: sellable.map((item) => ({
            id: item.id,
            procedure_id: item.procedure_id,
            procedure_name: item.procedure_name,
            quantity: item.quantity,
            unit_price: Number(item.unit_price) || 0,
            total_value: Number(item.total_value) || 0,
            price_table: item.price_table,
          })),
        });
        budgetQuoteId = result.budgetQuoteId;
        await refreshPlans();
        await refreshPlanDetail(activePlan.id);
      }

      const slug = await ensureBudgetQuotePublicSlug(budgetQuoteId);
      const base = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');
      const budgetUrl = `${base}/ro/${slug}`;
      const templates = await loadWhatsappManualTemplates(professionalId);
      const entry = templates.budget_quote;
      if (!entry.enabled) {
        toast.message('Mensagem desativada em Mensagens padrão.');
        return;
      }
      const message = buildBudgetQuoteWhatsAppMessage({
        patientName: patientFullName,
        clinicName: profile?.app_name || profile?.full_name,
        budgetUrl,
        template: entry.message,
      });
      openWhatsAppWithFallback({ phone: wa, text: message });
      toast.success('Abrindo o WhatsApp com o orçamento…');
    } catch {
      toast.error('Não foi possível enviar o orçamento.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAuthorize() {
    if (!activePlan) return;
    if (items.length === 0) {
      toast.error('Inclua ao menos um procedimento antes de autorizar.');
      return;
    }
    setBusy(true);
    try {
      await handleSavePlanCommercialInner();
      const updated = await requestDentalPlanAuthorization(activePlan.id);
      toast.success(
        `Autorização gerada: ${updated.authorization_code}. A recepção foi avisada para vender ou enviar o orçamento.`
      );
      await refreshPlans();
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
    } catch {
      toast.error('Erro ao solicitar autorização.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePlanCommercialInner() {
    if (!activePlan) return;
    await updateDentalPlan(activePlan.id, {
      discount_type: planDiscountType === 'none' ? null : planDiscountType,
      discount_value: parseMoneyInput(planDiscountValue),
      surcharge_type: planSurchargeType === 'none' ? null : planSurchargeType,
      surcharge_value: parseMoneyInput(planSurchargeValue),
      payment_terms: paymentTerms.trim() || null,
      commercial_notes: commercialNotes.trim() || null,
    });
  }

  if (!isClinicAccount) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando planos odontológicos…
      </div>
    );
  }

  if (activePlan) {
    const responsibleName = resolvePlanResponsibleName(activePlan);

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {lockedToPlan ? null : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                setActivePlanId(null);
                clearSelection();
              }}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Planos
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-foreground">{activePlan.name}</h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{planStatusBadgeLabel(activePlan)}</Badge>
              <span>Tipo: {activePlan.plan_type}</span>
              <span>Resp.: {responsibleName}</span>
              {activePlan.authorization_code ? (
                <span className="font-mono">{activePlan.authorization_code}</span>
              ) : null}
              {activePlan.budget_quote_id ? (
                <Link
                  className="text-primary underline-offset-2 hover:underline"
                  to={`/orcamento/${activePlan.budget_quote_id}`}
                >
                  Ver orçamento
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <PatientTabPanelSection
          title="Odontograma"
          action={
            isPlanEditLocked ? null : (
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="rounded-lg"
                disabled={selectedTeeth.length === 0 && faceSelections.length === 0}
                onClick={clearSelection}
              >
                <Eraser className="mr-1 h-3.5 w-3.5" />
                Limpar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-lg"
                disabled={selectedTeeth.length === 0}
                onClick={() => setConditionOpen(true)}
              >
                Atualizar situação do dente
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-lg"
                onClick={() => openProcedureModal()}
              >
                <Plus className="mr-1 h-4 w-4" />
                Adicionar procedimento
              </Button>
            </div>
            )
          }
        >
          {isPlanEditLocked ? null : (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(
              [
                ['upper_arch', 'Arcada superior'],
                ['lower_arch', 'Arcada inferior'],
                ['both_arches', 'Ambas as arcadas'],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant="outline"
                className="rounded-lg text-xs"
                onClick={() => {
                  openProcedureModal({ selectionType: 'region', region: key });
                }}
              >
                {label}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="rounded-lg text-xs"
              onClick={() => setSelectionMenuOpen(true)}
            >
              Menu de seleção
              {selectedTeeth.length > 0 ? ` (${selectedTeeth.length})` : ''}
            </Button>
          </div>
          )}

          <Odontogram
            selectedTeeth={selectedTeeth}
            onSelectTooth={handleSelectTooth}
            faceSelections={faceSelections}
            onToggleFace={handleToggleFace}
            conditionsByTooth={conditionsByTooth}
            disabled={busy || isPlanEditLocked}
          />

          {!isPlanEditLocked ? (
          <Dialog open={selectionMenuOpen} onOpenChange={setSelectionMenuOpen}>
            <DialogContent
              className={cn(
                'flex max-h-[min(90dvh,720px)] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0',
                'sm:max-w-md sm:rounded-xl'
              )}
            >
              <div className="shrink-0 border-b border-[color:var(--odontograma-selected-border)] bg-[color:var(--odontograma-selected-soft)] px-4 py-4 pr-12">
                <DialogHeader className="space-y-1 text-left">
                  <DialogTitle className="text-base">
                    {bulkMode === 'all'
                      ? 'Todos os dentes'
                      : selectedTeeth.length === 0
                        ? 'Menu do odontograma'
                        : selectedTeeth.length === 1
                          ? `Dente ${selectedTeeth[0]}`
                          : `${selectedTeeth.length} dentes`}
                  </DialogTitle>
                  <DialogDescription>
                    {bulkMode === 'all'
                      ? 'Seleção em massa — escolha o procedimento no menu.'
                      : 'Seleção, faces e ações rápidas.'}
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <OdontogramSelectionPanel
                  className="mt-0 border-0 bg-transparent p-0 shadow-none"
                  variant="menu"
                  bulkMode={bulkMode}
                  selectedTeeth={selectedTeeth}
                  faceFocusTooth={faceFocusTooth}
                  onFaceFocusToothChange={setFaceFocusTooth}
                  faceSelections={faceSelections}
                  onToggleFace={handleToggleFace}
                  teethInput={teethInput}
                  onTeethInputChange={handleTeethInputChange}
                  onTeethInputCommit={applyTeethInput}
                  onTeethInputFocusChange={setTeethInputFocused}
                  disabled={busy}
                  busy={busy}
                  canDuplicateProcedure={canDuplicateProcedure}
                  procedureOptions={sheetProcedureOptions}
                  procedureSearch={sheetProcSearch}
                  onProcedureSearchChange={setSheetProcSearch}
                  onPickProcedure={(p) => void handleSheetAddProcedure(p)}
                  priceTier={showCommercialDetails ? priceTier : undefined}
                  onPriceTierChange={showCommercialDetails ? setPriceTier : undefined}
                  getProcedurePriceLabel={
                    showCommercialDetails
                      ? (id) => {
                          const price = getPrice(id, priceTier);
                          return price != null
                            ? price.toLocaleString('pt-BR', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              })
                            : null;
                        }
                      : undefined
                  }
                  linkedPlanItems={itemsForSelectedTeeth.map((item) => ({
                    id: item.id,
                    name: item.procedure_name,
                    detail: formatLocations(item.id, locations),
                  }))}
                  onDeleteLinkedItem={(id) => void handleSheetDeleteItem(id)}
                  onSelectUpperArch={() => selectArch(PERMANENT_UPPER_ARCH, 'upper')}
                  onSelectLowerArch={() => selectArch(PERMANENT_LOWER_ARCH, 'lower')}
                  onSelectAll={() => selectArch(PERMANENT_ALL_TEETH, 'all')}
                  onChangeCondition={() => {
                    setSelectionMenuOpen(false);
                    setConditionOpen(true);
                  }}
                  onMarkAbsent={() => void handleMarkAbsentQuick()}
                  onDuplicateProcedure={() => {
                    setSelectionMenuOpen(false);
                    handleDuplicateProcedure();
                  }}
                  onClearSelection={clearSelection}
                />
              </div>
            </DialogContent>
          </Dialog>
          ) : null}
        </PatientTabPanelSection>

        <PatientTabPanelSection title="Tabela de procedimentos">
          <div id="dental-plan-procedures-list">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum procedimento ainda. Selecione dentes/faces no odontograma e adicione um
              procedimento.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Procedimento</TableHead>
                    <TableHead>Dente/região</TableHead>
                    {showCommercialDetails ? (
                      <>
                        <TableHead>Face</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead className="text-right">Valor unitário</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </>
                    ) : null}
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[1%] whitespace-nowrap text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const loc = formatItemTableLocation(item.id, locations);
                    const locked = busy || isPlanEditLocked;
                    const statusEditLocked =
                      busy ||
                      isPlanAccepted ||
                      activePlan.status === 'finished' ||
                      activePlan.status === 'cancelled';
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="max-w-[200px] truncate font-medium">
                          {item.procedure_name}
                        </TableCell>
                        <TableCell className="font-mono text-sm font-medium">
                          {loc.toothOrRegion}
                        </TableCell>
                        {showCommercialDetails ? (
                          <>
                            <TableCell className="text-sm text-muted-foreground">
                              {loc.face}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatBrl(Number(item.unit_price))}
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {formatBrl(Number(item.total_value))}
                            </TableCell>
                          </>
                        ) : null}
                        <TableCell>
                          <Badge variant="outline">{itemStatusDisplayLabel(item)}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center justify-end gap-0.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                              disabled={
                                showCommercialDetails ? statusEditLocked : locked
                              }
                              title={
                                showCommercialDetails
                                  ? 'Editar procedimento'
                                  : 'Editar'
                              }
                              aria-label={
                                showCommercialDetails
                                  ? 'Editar procedimento'
                                  : 'Editar'
                              }
                              onClick={() => openEditItem(item)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {showCommercialDetails ? (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                                disabled={statusEditLocked}
                                title="Ajustar valor"
                                aria-label="Ajustar valor"
                                onClick={() => openPriceAdjust(item)}
                              >
                                <span className="text-[11px] font-semibold tabular-nums leading-none">
                                  R$
                                </span>
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                                disabled={locked}
                                title="Duplicar"
                                aria-label="Duplicar"
                                onClick={() => openDuplicateItemDialog(item)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {showCommercialDetails ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    disabled={statusEditLocked}
                                    title="Situação"
                                    aria-label="Situação"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  <DropdownMenuLabel>Situação</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {COMMERCIAL_SITUATION_REASONS.map((reason) => (
                                    <DropdownMenuItem
                                      key={reason}
                                      disabled={busy}
                                      onSelect={() =>
                                        void handleCommercialSituation(item, reason)
                                      }
                                    >
                                      {reason}
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    disabled={busy || locked}
                                    className="text-destructive focus:text-destructive"
                                    onSelect={() => void handleDeleteItem(item.id)}
                                  >
                                    Excluir procedimento
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                disabled={locked}
                                title="Excluir"
                                aria-label="Excluir"
                                onClick={() => void handleDeleteItem(item.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {showCommercialDetails ? (
                    <TableRow className="bg-muted/20 font-medium hover:bg-muted/20">
                      <TableCell colSpan={3}>Totais</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {items
                          .filter((i) => i.status !== 'rejected')
                          .reduce((sum, i) => sum + Number(i.quantity || 0), 0)}
                      </TableCell>
                      <TableCell />
                      <TableCell className="text-right tabular-nums">
                        {formatBrl(
                          items
                            .filter((i) => i.status !== 'rejected')
                            .reduce((sum, i) => sum + Number(i.total_value || 0), 0)
                        )}
                      </TableCell>
                      <TableCell />
                      <TableCell />
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          )}
          </div>
          {!showCommercialDetails ? (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border/40 pt-3">
              {activePlan.authorization_code ? (
                <p className="mr-auto text-xs text-muted-foreground">
                  Autorização: <span className="font-mono">{activePlan.authorization_code}</span>
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={
                  busy ||
                  activePlan.status === 'authorized' ||
                  activePlan.status === 'negotiating' ||
                  items.length === 0
                }
                onClick={() => void handleAuthorize()}
              >
                <ShieldCheck className="mr-1.5 h-4 w-4" />
                Solicitar autorização
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border/40 pt-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={
                  busy ||
                  items.length === 0 ||
                  activePlan.status === 'finished' ||
                  activePlan.status === 'cancelled' ||
                  !!activePlan.payment_terms?.trim()
                }
                onClick={() => {
                  setPlanRejectReason('');
                  setPlanRejectOpen(true);
                }}
              >
                <XCircle className="mr-1.5 h-4 w-4" />
                Indeferir
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={
                  busy ||
                  items.length === 0 ||
                  activePlan.status === 'finished' ||
                  activePlan.status === 'cancelled' ||
                  !!activePlan.payment_terms?.trim()
                }
                onClick={() => void handleSendBudgetWhatsApp()}
              >
                <MessageCircle className="mr-1.5 h-4 w-4" />
                Enviar orçamento
              </Button>
              <Button
                type="button"
                className="rounded-xl"
                disabled={
                  busy ||
                  items.length === 0 ||
                  activePlan.status === 'negotiating' ||
                  activePlan.status === 'finished' ||
                  activePlan.status === 'cancelled' ||
                  !!activePlan.payment_terms?.trim()
                }
                onClick={openAcceptDialog}
              >
                <Check className="mr-1.5 h-4 w-4" />
                Vender
              </Button>
            </div>
          )}
        </PatientTabPanelSection>

        {/* Condition dialog */}
        <Dialog open={conditionOpen} onOpenChange={setConditionOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Atualizar situação do dente</DialogTitle>
              <DialogDescription>
                Aplique uma situação clínica a um ou mais dentes selecionados.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Dente(s)</Label>
                <div className="flex min-h-10 flex-wrap gap-1.5 rounded-xl border border-input bg-background px-2 py-2">
                  {selectedTeeth.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Nenhum dente selecionado</span>
                  ) : (
                    selectedTeeth.map((tooth) => (
                      <button
                        key={tooth}
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
                        onClick={() =>
                          setSelectedTeeth((prev) => prev.filter((t) => t !== tooth))
                        }
                        title="Remover da seleção"
                      >
                        {tooth}
                        <span aria-hidden>×</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Situação do dente <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={conditionValue}
                  onValueChange={(v) => setConditionValue(v as DentalToothCondition)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DENTAL_TOOTH_CONDITION_LABELS) as DentalToothCondition[]).map(
                      (key) => (
                        <SelectItem key={key} value={key}>
                          {DENTAL_TOOTH_CONDITION_LABELS[key]}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConditionOpen(false)} disabled={busy}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleSaveCondition()} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Histórico do(s) dente(s)</DialogTitle>
              <DialogDescription>
                Situação clínica e procedimentos do plano atual para{' '}
                {selectedTeeth.join(', ')}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-sm font-medium">Situação clínica</p>
                {selectedTeeth.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum dente selecionado.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {selectedTeeth.map((tooth) => {
                      const cond = conditionsByTooth[tooth];
                      return (
                        <li
                          key={tooth}
                          className="flex items-center justify-between rounded-lg border px-3 py-2"
                        >
                          <span className="font-mono font-medium">{tooth}</span>
                          <span className="text-muted-foreground">
                            {cond ? DENTAL_TOOTH_CONDITION_LABELS[cond] : 'Sem registro'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium">Procedimentos neste plano</p>
                {itemsForSelectedTeeth.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum procedimento vinculado a estes dentes no plano atual.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {itemsForSelectedTeeth.map((item) => (
                      <li key={item.id} className="rounded-lg border px-3 py-2 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium">{item.procedure_name}</span>
                          <Badge variant="outline">{ITEM_STATUS_LABEL[item.status]}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatLocations(item.id, locations)} · {formatBrl(Number(item.total_value))}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => {
                  setHistoryOpen(false);
                  scrollToProceduresList();
                }}
              >
                Ver lista completa de procedimentos
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setHistoryOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Procedure dialog */}
        <Dialog open={procedureOpen} onOpenChange={setProcedureOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Adicionar procedimento</DialogTitle>
              <DialogDescription>
                Preencha a localização e os valores. A quantidade é calculada automaticamente pela
                seleção.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>
                  Procedimento <span className="text-destructive">*</span>
                </Label>
                <Input
                  className="rounded-xl"
                  value={procSearch || procName}
                  onChange={(e) => {
                    setProcSearch(e.target.value);
                    setProcName(e.target.value);
                    setProcId(null);
                  }}
                  placeholder="Buscar procedimento…"
                />
                <div className="max-h-36 overflow-y-auto rounded-lg border border-border/50">
                  {filteredProcedures.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="flex w-full px-3 py-2 text-left text-sm hover:bg-muted/60"
                      onClick={() => {
                        pickProcedure(p);
                        setProcSearch('');
                      }}
                    >
                      <span className="truncate">{p.name}</span>
                      {p.specialty ? (
                        <span className="ml-auto pl-2 text-xs text-muted-foreground">
                          {p.specialty}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Especialidade</Label>
                <Input
                  className="rounded-xl"
                  value={procSpecialty}
                  onChange={(e) => setProcSpecialty(e.target.value)}
                  placeholder="Ex.: Dentística, Endodontia…"
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  Tipo de seleção <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectionType}
                  onValueChange={(v) => setSelectionType(v as DentalSelectionType)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="group">Em grupo</SelectItem>
                    <SelectItem value="region">Região</SelectItem>
                  </SelectContent>
                </Select>
                <div className="rounded-xl border border-[color:var(--odontograma-selected-border)] bg-[color:var(--odontograma-selected-soft)] px-3 py-2 text-xs">
                  <p className="font-medium text-[color:var(--odontograma-selected)]">
                    {addSelectionSummary.hint}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    {addSelectionSummary.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {selectionType !== 'region' ? (
                <>
                  <div className="space-y-1.5">
                    <Label>
                      Dente(s) <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex min-h-10 flex-wrap gap-1 rounded-xl border border-input px-2 py-1.5">
                      {selectedTeeth.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Nenhum dente</span>
                      ) : (
                        selectedTeeth.map((tooth) => (
                          <button
                            key={tooth}
                            type="button"
                            className="rounded-full bg-muted px-2 text-xs"
                            onClick={() =>
                              setSelectedTeeth((prev) => prev.filter((t) => t !== tooth))
                            }
                          >
                            {tooth} ×
                          </button>
                        ))
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Input
                        className="rounded-xl font-mono"
                        value={teethInput}
                        onChange={(e) => handleTeethInputChange(e.target.value)}
                        onFocus={() => setTeethInputFocused(true)}
                        onBlur={() => {
                          setTeethInputFocused(false);
                          applyTeethInput();
                        }}
                        placeholder="11, 12, 13, 16"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={applyTeethInput}
                      >
                        Aplicar
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Face(s)</Label>
                      <div className="flex max-h-32 flex-wrap content-start gap-1 overflow-y-auto rounded-xl border border-input p-2">
                        {selectedTeeth.length === 0 ? (
                          <span className="text-[11px] text-muted-foreground">
                            Selecione dentes primeiro
                          </span>
                        ) : (
                          selectedTeeth.slice(0, 6).flatMap((tooth) =>
                            facesForTooth(tooth).map((face) => {
                              const on = faceSelections
                                .find((s) => s.toothNumber === tooth)
                                ?.faces.includes(face);
                              return (
                                <button
                                  key={`${tooth}-${face}`}
                                  type="button"
                                  title={`${tooth} — ${DENTAL_FACE_LABELS[face]}`}
                                  className={
                                    on
                                      ? 'rounded-md bg-[color:var(--odontograma-selected)] px-1.5 py-0.5 text-[10px] text-white'
                                      : 'rounded-md bg-muted px-1.5 py-0.5 text-[10px]'
                                  }
                                  onClick={() =>
                                    setFaceSelections((prev) =>
                                      toggleFaceInSelection(prev, tooth, face)
                                    )
                                  }
                                >
                                  {tooth}/{face}
                                </button>
                              );
                            })
                          )
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Raiz(es)</Label>
                      <div className="flex max-h-32 flex-wrap content-start gap-1 overflow-y-auto rounded-xl border border-input p-2">
                        {selectedTeeth.length === 0 ? (
                          <span className="text-[11px] text-muted-foreground">
                            Selecione dentes primeiro
                          </span>
                        ) : (
                          selectedTeeth.slice(0, 6).flatMap((tooth) =>
                            rootsForTooth(tooth).map((root) => {
                              const on = rootSelections
                                .find((s) => s.toothNumber === tooth)
                                ?.roots.includes(root);
                              return (
                                <button
                                  key={`${tooth}-${root}`}
                                  type="button"
                                  title={`${tooth} — ${DENTAL_ROOT_LABELS[root as DentalRootCode] ?? root}`}
                                  className={
                                    on
                                      ? 'rounded-md bg-[color:var(--odontograma-selected)] px-1.5 py-0.5 text-[10px] text-white'
                                      : 'rounded-md bg-muted px-1.5 py-0.5 text-[10px]'
                                  }
                                  onClick={() =>
                                    setRootSelections((prev) =>
                                      toggleRootInSelection(prev, tooth, root)
                                    )
                                  }
                                >
                                  {tooth}/{root}
                                </button>
                              );
                            })
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              <div className="space-y-1.5">
                <Label>Região</Label>
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {(
                    [
                      ['upper_arch', 'Arcada superior'],
                      ['lower_arch', 'Arcada inferior'],
                      ['both_arches', 'Ambas as arcadas'],
                    ] as const
                  ).map(([key, label]) => (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant={selectionType === 'region' && region === key ? 'default' : 'outline'}
                      className="rounded-lg text-xs"
                      onClick={() => {
                        setSelectionType('region');
                        setRegion(key);
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <Select
                  value={region}
                  onValueChange={(v) => {
                    setRegion(v as DentalArchRegion);
                    setSelectionType('region');
                  }}
                  disabled={selectionType !== 'region'}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecione a região" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DENTAL_REGION_LABELS) as DentalArchRegion[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {DENTAL_REGION_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectionType !== 'region' ? (
                  <p className="text-[11px] text-muted-foreground">
                    Use os botões acima para mudar o tipo para Região.
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label>
                  Tabela de preço <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={priceTier}
                  onValueChange={(v) => setPriceTier(v as ClinicPriceTier)}
                  disabled={busy}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLINIC_PRICE_TIERS.map((tier) => (
                      <SelectItem key={tier} value={tier}>
                        {CLINIC_PRICE_TIER_LABELS[tier]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>
                    Quantidade <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    className="rounded-xl"
                    value={String(effectiveAddQty)}
                    readOnly
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Preenchida automaticamente pela seleção
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Valor unitário</Label>
                  <Input
                    className="rounded-xl"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Desconto</Label>
                  <div className="flex gap-2">
                    <Select
                      value={procDiscountType}
                      onValueChange={(v) => setProcDiscountType(v as MoneyAdjustType | 'none')}
                    >
                      <SelectTrigger className="w-[110px] rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="amount">R$</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      className="rounded-xl"
                      value={procDiscountValue}
                      onChange={(e) => setProcDiscountValue(e.target.value)}
                      disabled={procDiscountType === 'none'}
                      inputMode="decimal"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Acréscimo</Label>
                  <div className="flex gap-2">
                    <Select
                      value={procSurchargeType}
                      onValueChange={(v) => setProcSurchargeType(v as MoneyAdjustType | 'none')}
                    >
                      <SelectTrigger className="w-[110px] rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="amount">R$</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      className="rounded-xl"
                      value={procSurchargeValue}
                      onChange={(e) => setProcSurchargeValue(e.target.value)}
                      disabled={procSurchargeType === 'none'}
                      inputMode="decimal"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea
                  className="rounded-xl"
                  rows={2}
                  value={procNotes}
                  onChange={(e) => setProcNotes(e.target.value)}
                />
              </div>

              <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                Total estimado:{' '}
                <span className="font-semibold tabular-nums">{formatBrl(draftAddTotal)}</span>
                {selectionType === 'individual' && draftLocations.length > 1 ? (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({draftLocations.length} itens × valores acima)
                  </span>
                ) : null}
              </p>

              {missingSelected.length > 0 ? (
                <Alert variant="destructive">
                  <AlertTitle>Dente ausente / sem coroa</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>
                      Seleção inclui dente(s) com ausência: {missingSelected.join(', ')}.
                    </p>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={missingWarningAck}
                        onChange={(e) => setMissingWarningAck(e.target.checked)}
                      />
                      Confirmo e desejo continuar
                    </label>
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setProcedureOpen(false)}
                disabled={busy}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleAddProcedure()} disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-1 h-4 w-4" />
                )}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Duplicate item — alterar só a localização */}
        <Dialog
          open={!!duplicateSource}
          onOpenChange={(open) => {
            if (!open) {
              setDuplicateSource(null);
              setPendingDupLocations(null);
              setDupConflictItemId(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Duplicar procedimento</DialogTitle>
              <DialogDescription>
                Copia “{duplicateSource?.procedure_name}” alterando somente a localização.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Origem: {duplicateSource ? formatLocations(duplicateSource.id, locations) : '—'} ·{' '}
                {formatBrl(Number(duplicateSource?.unit_price ?? 0))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={dupMode === 'tooth' ? 'default' : 'outline'}
                  className="rounded-lg text-xs"
                  onClick={() => setDupMode('tooth')}
                >
                  Outro dente
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={dupMode === 'region' ? 'default' : 'outline'}
                  className="rounded-lg text-xs"
                  onClick={() => setDupMode('region')}
                >
                  Região
                </Button>
              </div>
              {dupMode === 'tooth' ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Dente(s) de destino</Label>
                    <Input
                      className="rounded-xl font-mono"
                      value={dupTeethInput}
                      onChange={(e) => setDupTeethInput(e.target.value)}
                      placeholder="Ex.: 26"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Face</Label>
                    <Select
                      value={dupFace}
                      onValueChange={(v) => setDupFace(v as DentalToothFace | 'whole')}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whole">Dente inteiro</SelectItem>
                        {(Object.keys(DENTAL_FACE_LABELS) as DentalToothFace[]).map((f) => (
                          <SelectItem key={f} value={f}>
                            {DENTAL_FACE_LABELS[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <Label>Região</Label>
                  <div className="mb-1.5 flex flex-wrap gap-1.5">
                    {(
                      [
                        ['upper_arch', 'Arcada superior'],
                        ['lower_arch', 'Arcada inferior'],
                        ['both_arches', 'Ambas as arcadas'],
                      ] as const
                    ).map(([key, label]) => (
                      <Button
                        key={key}
                        type="button"
                        size="sm"
                        variant={dupRegion === key ? 'default' : 'outline'}
                        className="rounded-lg text-xs"
                        onClick={() => setDupRegion(key)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDuplicateSource(null)}
                disabled={busy}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void confirmDuplicateItem(false)}
                disabled={busy}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="mr-1 h-4 w-4" />}
                Duplicar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={!!dupConflictItemId}
          onOpenChange={(open) => {
            if (!open) {
              setDupConflictItemId(null);
              setPendingDupLocations(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Procedimento já existe nesta localização</AlertDialogTitle>
              <AlertDialogDescription>
                Já há o mesmo procedimento + dente + face (ou região). Deseja consolidar a
                quantidade no item existente ou criar outro item mesmo assim?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
              <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void confirmConsolidateDuplicate()}
              >
                Consolidar
              </Button>
              <AlertDialogAction
                disabled={busy}
                onClick={(e) => {
                  e.preventDefault();
                  void confirmDuplicateItem(true);
                }}
              >
                Criar outro item
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog
          open={!!priceAdjustItem}
          onOpenChange={(open) => {
            if (!open && !busy) setPriceAdjustItem(null);
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Ajustar valor</DialogTitle>
              <DialogDescription>{priceAdjustItem?.procedure_name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="dental-price-adjust">Valor unitário (R$)</Label>
                <Input
                  id="dental-price-adjust"
                  className="rounded-xl text-base tabular-nums"
                  inputMode="decimal"
                  value={priceAdjustValue}
                  onChange={(e) => setPriceAdjustValue(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {([-100, -50, -10, 10, 50, 100] as const).map((delta) => (
                  <Button
                    key={delta}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-lg tabular-nums"
                    disabled={busy}
                    onClick={() => nudgePriceAdjust(delta)}
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Total atual do item:{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {formatBrl(
                    (Number(priceAdjustItem?.quantity) || 1) * parseMoneyInput(priceAdjustValue)
                  )}
                </span>
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setPriceAdjustItem(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void handleSavePriceAdjust()}
              >
                Salvar valor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit item dialog */}
        <Dialog
          open={!!editItem && !rejectReasonOpen}
          onOpenChange={(open) => {
            if (!open && !busy) {
              setEditItem(null);
              setRejectReasonOpen(false);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {showCommercialDetails ? 'Editar procedimento' : 'Editar item'}
              </DialogTitle>
              <DialogDescription>
                {showCommercialDetails
                  ? 'Corrija o procedimento se o preenchimento estiver errado.'
                  : editItem?.procedure_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {showCommercialDetails ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Procedimento</Label>
                    <Input
                      className="rounded-xl"
                      value={editProcSearch || editProcName}
                      onChange={(e) => {
                        setEditProcSearch(e.target.value);
                        setEditProcName(e.target.value);
                        setEditProcId(null);
                        setEditProcSpecialty(null);
                      }}
                      placeholder="Digite para buscar ou corrigir o nome…"
                    />
                    {editProcedureOptions.length > 0 ? (
                      <ul className="max-h-40 overflow-y-auto rounded-xl border border-border/60 bg-background">
                        {editProcedureOptions.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted/50"
                              onClick={() => {
                                setEditProcId(p.id);
                                setEditProcName(p.name);
                                setEditProcSpecialty(p.specialty);
                                setEditProcSearch('');
                              }}
                            >
                              <span className="font-medium">{p.name}</span>
                              {p.specialty ? (
                                <span className="text-xs text-muted-foreground">{p.specialty}</span>
                              ) : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {editProcId ? (
                      <p className="text-xs text-muted-foreground">
                        Selecionado: <span className="font-medium text-foreground">{editProcName}</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dental-edit-qty">Quantidade</Label>
                    <Input
                      id="dental-edit-qty"
                      className="w-24 rounded-xl"
                      type="number"
                      min={1}
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dental-edit-notes">Observações</Label>
                    <Textarea
                      id="dental-edit-notes"
                      className="rounded-xl"
                      rows={2}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                    />
                  </div>
                </>
              ) : null}

              {!showCommercialDetails ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Valor unitário</Label>
                    <Input
                      className="rounded-xl"
                      value={editUnitPrice}
                      onChange={(e) => setEditUnitPrice(e.target.value)}
                      inputMode="decimal"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Desconto</Label>
                    <div className="flex gap-2">
                      <Select
                        value={editDiscountType}
                        onValueChange={(v) => setEditDiscountType(v as MoneyAdjustType | 'none')}
                      >
                        <SelectTrigger className="w-[110px] rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          <SelectItem value="percent">%</SelectItem>
                          <SelectItem value="amount">R$</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        className="rounded-xl"
                        value={editDiscountValue}
                        onChange={(e) => setEditDiscountValue(e.target.value)}
                        disabled={editDiscountType === 'none'}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Acréscimo</Label>
                    <div className="flex gap-2">
                      <Select
                        value={editSurchargeType}
                        onValueChange={(v) => setEditSurchargeType(v as MoneyAdjustType | 'none')}
                      >
                        <SelectTrigger className="w-[110px] rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          <SelectItem value="percent">%</SelectItem>
                          <SelectItem value="amount">R$</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        className="rounded-xl"
                        value={editSurchargeValue}
                        onChange={(e) => setEditSurchargeValue(e.target.value)}
                        disabled={editSurchargeType === 'none'}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Observação</Label>
                    <Textarea
                      className="rounded-xl"
                      rows={2}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                    />
                  </div>
                </>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditItem(null)}
                disabled={busy}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleSaveEditItem()} disabled={busy}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={rejectReasonOpen}
          onOpenChange={(open) => {
            if (busy) return;
            setRejectReasonOpen(open);
            if (!open && editStatus === 'rejected' && !editRejectReason.trim()) {
              setEditStatus(editItem?.status ?? 'pending');
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Motivo do indeferimento</DialogTitle>
              <DialogDescription>
                Informe por que o procedimento{' '}
                <span className="font-medium text-foreground">
                  {editItem?.procedure_name}
                </span>{' '}
                foi indeferido.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="dental-reject-reason">Motivo</Label>
              <Textarea
                id="dental-reject-reason"
                className="rounded-xl"
                rows={3}
                value={editRejectReason}
                onChange={(e) => setEditRejectReason(e.target.value)}
                placeholder="Descreva o motivo…"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setRejectReasonOpen(false);
                  setEditStatus(editItem?.status ?? 'pending');
                  setEditRejectReason('');
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void handleConfirmRejectReason()}
              >
                Confirmar indeferimento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={acceptOpen}
          onOpenChange={(open) => {
            if (busy) return;
            setAcceptOpen(open);
            if (!open) setAcceptDefineOpen(false);
          }}
        >
          <DialogContent className="flex max-h-[90dvh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
            <DialogHeader className="sr-only">
              <DialogTitle>Venda do plano de tratamento</DialogTitle>
              <DialogDescription>
                Defina as condições de pagamento e conclua a venda.
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
              <DentalPaymentConditionsList
                conditions={acceptConditions}
                patientName={patientFullName ?? null}
                planTotal={planAcceptSubtotal()}
                disabled={busy}
                onAdd={openAddPaymentCondition}
                onEdit={openEditPaymentCondition}
                onRemove={removePaymentCondition}
              />

              {activePlan?.id ? (
                <PatientDocumentsSection
                  patientId={patientId}
                  dentalPlanId={activePlan.id}
                  compact
                />
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/40 bg-muted/10 px-4 py-3 sm:px-5">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={busy}
                onClick={() => setAcceptOpen(false)}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Voltar
              </Button>
              <Button
                type="button"
                className="rounded-xl"
                disabled={busy || acceptConditions.length === 0}
                onClick={() => void handleAcceptPlan()}
              >
                {busy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-4 w-4" />
                )}
                Concluir venda
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={planRejectOpen}
          onOpenChange={(open) => {
            if (busy) return;
            setPlanRejectOpen(open);
            if (!open) setPlanRejectReason('');
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Indeferir plano</DialogTitle>
              <DialogDescription>
                Use quando o paciente não quiser fechar agora. O plano será cancelado e os
                procedimentos pendentes marcados como indeferidos.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="dental-plan-reject-reason">Motivo</Label>
              <Textarea
                id="dental-plan-reject-reason"
                className="rounded-xl"
                rows={3}
                value={planRejectReason}
                onChange={(e) => setPlanRejectReason(e.target.value)}
                placeholder="Ex.: paciente pediu para pensar / voltar outro dia…"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setPlanRejectOpen(false);
                  setPlanRejectReason('');
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => void handleRejectPlan()}
              >
                Confirmar indeferimento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DentalPaymentConditionEditor
          open={acceptDefineOpen}
          onOpenChange={(open) => {
            if (!busy) {
              setAcceptDefineOpen(open);
              if (!open) setAcceptEditingId(null);
            }
          }}
          initial={acceptEditorInitial}
          editingId={acceptEditingId}
          planTotal={planAcceptSubtotal()}
          currentSum={acceptConditions
            .filter((c) => c.id !== acceptEditingId)
            .reduce((s, c) => s + c.amount, 0)}
          onSave={savePaymentCondition}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PatientTabPanelSection
        title="Planos odontológicos"
        action={
          lockedToPlan ? null : (
            <Button type="button" size="sm" className="rounded-xl" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Novo plano
            </Button>
          )
        }
      >
        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {lockedToPlan
              ? 'Plano não encontrado ou já foi tratado.'
              : 'Nenhum plano ainda. Crie um plano de tratamento para usar o odontograma e montar o orçamento clínico.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {plans.map((plan) => (
              <li key={plan.id}>
                <div className="flex items-stretch gap-1.5">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-border/50 bg-background px-3 py-3 text-left transition-colors hover:bg-muted/40"
                    onClick={() => setActivePlanId(plan.id)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{plan.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {format(new Date(plan.created_at), 'dd MMM yyyy', { locale: ptBR })}
                        {plan.authorization_code ? ` · ${plan.authorization_code}` : ''}
                      </p>
                    </div>
                    <Badge variant="secondary">{planStatusBadgeLabel(plan)}</Badge>
                  </button>
                  {lockedToPlan ? null : (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-auto w-10 shrink-0 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Excluir plano"
                      aria-label={`Excluir plano ${plan.name}`}
                      disabled={busy}
                      onClick={() => setDeletePlanId(plan.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PatientTabPanelSection>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          className="z-[1800] sm:max-w-md"
          overlayClassName="z-[1800]"
        >
          <DialogHeader>
            <DialogTitle>Novo plano de tratamento</DialogTitle>
            <DialogDescription>
              Dados clínicos do plano. A negociação comercial acontece depois, via orçamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="dental-plan-name">Nome</Label>
              <Input
                id="dental-plan-name"
                className="rounded-xl"
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                placeholder="Ex.: Plano reabilitação superior"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={newPlanType} onValueChange={setNewPlanType}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="odontologico">Odontológico</SelectItem>
                  <SelectItem value="ortodontico">Ortodontico</SelectItem>
                  <SelectItem value="implantodontia">Implantodontia</SelectItem>
                  <SelectItem value="estetico">Estético</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Profissional responsável</Label>
              <p className="text-xs text-muted-foreground">
                Dentista responsável pela avaliação / plano.
              </p>
              <Select
                value={newResponsibleId || undefined}
                onValueChange={setNewResponsibleId}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione o dentista">
                    {newResponsibleId
                      ? responsibleOptionLabel(
                          newResponsibleId,
                          responsibleOptions.find((m) => m.user_id === newResponsibleId)?.full_name
                        )
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="z-[1900]">
                  {responsibleOptions.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {responsibleOptionLabel(m.user_id, m.full_name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dental-plan-origin">Origem (opcional)</Label>
              <Input
                id="dental-plan-origin"
                className="rounded-xl"
                value={newPlanOrigin}
                onChange={(e) => setNewPlanOrigin(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dental-plan-desc">Descrição (opcional)</Label>
              <Textarea
                id="dental-plan-desc"
                className="rounded-xl"
                value={newPlanDesc}
                onChange={(e) => setNewPlanDesc(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleCreatePlan()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar plano'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deletePlanId != null}
        onOpenChange={(open) => {
          if (!open && !busy) setDeletePlanId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove o plano, procedimentos e localizações vinculados. O orçamento comercial,
              se existir, não é excluído automaticamente.
              {deletePlanId
                ? ` Plano: ${plans.find((p) => p.id === deletePlanId)?.name ?? ''}`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDeletePlan();
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
