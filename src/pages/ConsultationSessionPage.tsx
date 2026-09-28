import { Fragment, useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUiCopy } from '@/hooks/use-ui-copy';
import { supabase } from '@/integrations/supabase/client';
import { getProceduresForProfile } from '@/lib/proceduresForProfile';
import { fetchSalonProcedures, type SalonProcedure } from '@/services/api/salonProceduresApi';
import { SalonProcedurePicker } from '@/components/salon/SalonProcedurePicker';
import { SalonSessionPhotosField } from '@/components/salon/SalonSessionPhotosField';
import { SALON_PROCEDURE_ID_PREFIX } from '@/lib/salonAppointmentNotes';
import { resolveBranchIdForInsert } from '@/lib/resolveBranchIdForInsert';
import { insertSalonRecebimentosForSession } from '@/lib/salonRecebimentos';
import {
  CLINIC_PRICE_TIERS,
  CLINIC_PRICE_TIER_LABELS,
  DEFAULT_CLINIC_PRICE_TIER,
  type ClinicPriceTier,
} from '@/lib/clinicPriceTiers';
import { useOrganizationProcedurePrices } from '@/hooks/use-organization-procedure-prices';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bell,
  Calendar,
  CalendarPlus,
  Loader2,
  User,
  Stethoscope,
  FileText,
  CheckCircle2,
  Clock,
  Activity,
  ImageIcon,
  ChevronDown,
  Scissors,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, differenceInYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/utils';
import { normalizeAgendaOpenMode, type AgendaOpenMode } from '@/lib/agendaPreferences';
import { renderDynamicProcedureField } from '@/lib/dynamicProcedureFields/render';
import { validateRequiredProcedureFields } from '@/lib/dynamicProcedureFields/validation';
import { buildProcedureFieldRenderPlan, isProcedureFieldFullWidthOnDesktop, resolveApplicationMapProps, shouldShowTerapiaCapilarScalpMap } from '@/lib/dynamicProcedureFields/consultationFieldLayout';
import { PreenchimentoAplicacaoRepeater } from '@/components/consultation/PreenchimentoAplicacaoRepeater';
import { LipoenzimaticaAreasSection } from '@/components/consultation/LipoenzimaticaAreasSection';
import { LipoenzimaticaProdutosRepeater } from '@/components/consultation/LipoenzimaticaProdutosRepeater';
import {
  ensurePreenchimentoAplicacoesInData,
  getPreenchimentoAplicacoesForForm,
  isPreenchimentoRepeatableFieldKey,
  normalizePreenchimentoFacialSessionData,
  parsePreenchimentoAplicacoes,
  serializePreenchimentoFacialSessionData,
  PREENCHIMENTO_APLICACAO_STORAGE_KEY,
} from '@/lib/preenchimentoFacial';
import {
  ensureLipoenzimaticaSessionData,
  getLipoenzimaticaAreasForForm,
  getLipoenzimaticaProdutosForForm,
  isLipoenzimaticaHiddenFieldKey,
  LIPOENZIMATICA_AREAS_STORAGE_KEY,
  LIPOENZIMATICA_PRODUTOS_STORAGE_KEY,
  LIPOENZIMATICA_SLUG,
  normalizeLipoenzimaticaSessionData,
  parseLipoenzimaticaProdutos,
  serializeLipoenzimaticaSessionData,
  validateLipoenzimaticaSessionData,
} from '@/lib/lipoenzimatica';
import { DepilacaoDefinitivaAreasSection } from '@/components/consultation/DepilacaoDefinitivaAreasSection';
import { ProcedureRegionBlocksSection } from '@/components/consultation/ProcedureRegionBlocksSection';
import {
  DEPILACAO_AREAS_STORAGE_KEY,
  getDepilacaoFormAreas,
  getRegionConfig,
  getRegionFormItems,
  isNewCustomHiddenFieldKey,
  isNewCustomProcedureSlug,
  normalizeNewCustomSessionData,
  REGION_AREAS_STORAGE_KEY,
  serializeNewCustomSessionData,
  syncDepilacaoDefinitivaReminders,
  validateNewCustomSessionData,
} from '@/lib/newProceduresSession';
import { isDepilacaoDefinitivaSlug } from '@/lib/depilacaoDefinitiva';
import { isRegionProcedureSlug } from '@/lib/procedureRegionBlocks';
import { BotoxFacialMap, type FacialPoint, type FacialStroke } from '@/components/BotoxFacialMap';
import { SignaturePad } from '@/components/SignaturePad';
import { PhotoUploadField } from '@/components/PhotoUploadField';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AgendaDaySlotsContent } from '@/components/AgendaDaySlotsContent';
import { AgendaWeekSlotsContent } from '@/components/AgendaWeekSlotsContent';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { PageLoading } from '@/components/layout/PageLoading';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Database, Json } from '@/integrations/supabase/types';
import type { FormaPagamento } from '@/types/faturamento';
import { FORMA_PAGAMENTO_LABEL } from '@/types/faturamento';
import { Wallet } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import {
  ProcedureSearchInput,
  ProcedureCategorySection,
  SelectedProceduresCounter,
} from '@/components/consultation';
import {
  BeforeAfterGalleryCard,
  type BeforeAfterGalleryValue,
  type GalleryImage,
} from '@/components/consultation/BeforeAfterGalleryCard';

type ProcedureFieldRow = Database['public']['Tables']['procedure_fields']['Row'];

function normalizeComparisonFieldText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isLegacyBeforeAfterImageField(field: ProcedureFieldRow): boolean {
  if (field.field_type !== 'image') return false;
  const label = normalizeComparisonFieldText(field.label);
  const key = normalizeComparisonFieldText(field.field_key).replace(/[-\s]/g, '_');
  return (
    label.includes('foto antes') ||
    label.includes('foto depois') ||
    key.includes('foto_antes') ||
    key.includes('foto_depois') ||
    key.includes('before') ||
    key.includes('after') ||
    key.includes('antes') ||
    key.includes('depois')
  );
}

/** IMC = peso (kg) / (altura em m)². Altura em cm. */
function calcImc(pesoKg: number | null | undefined, alturaCm: number | null | undefined): number | null {
  if (pesoKg == null || alturaCm == null || pesoKg <= 0 || alturaCm <= 0) return null;
  const altM = (alturaCm >= 0.5 && alturaCm <= 3 ? alturaCm * 100 : alturaCm) / 100;
  const imc = pesoKg / (altM * altM);
  const rounded = Math.round(imc * 10) / 10;
  return rounded >= 5 && rounded <= 100 ? rounded : null;
}

function parseMoneyInput(value: unknown): number {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  let normalized = raw.replace(/[^\d,.-]/g, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

/** Procedimentos que exigem termo de consentimento (slug do procedimento → slug do termo) */
const PROCEDURE_TERM_SLUGS: Record<string, string> = {
  botox: 'consentimento-botox',
  'preenchimento-facial': 'consentimento-preenchedores',
  'bioestimulador-colageno': 'consentimento-preenchedores',
  'fios-pdo': 'consentimento-preenchedores',
  endolaser: 'consentimento-endolaser',
  'lipo-papada-enzimatica': 'consentimento-preenchedores',
  lipoenzimatica: 'consentimento-preenchedores',
};

/** Regiões para Botox (checkboxes); ao marcar, aparece campo "Quantidade por ponto" */
const BOTOX_REGIOES = [
  { key: 'testa', label: 'Testa' },
  { key: 'glabela', label: 'Glabela' },
  { key: 'pes_de_galinha', label: 'Pés de galinha' },
  { key: 'sobrancelha', label: 'Sobrancelha' },
  { key: 'bunny_lines', label: 'Bunny lines' },
  { key: 'masseter', label: 'Masseter' },
  { key: 'queixo', label: 'Queixo' },
  { key: 'depressor_angulo_boca', label: 'Depressor do ângulo da boca' },
  { key: 'pescoco', label: 'Pescoço' },
] as const;

/** Procedimentos que exibem mapa facial para marcar pontos de aplicação */
const PROCEDURE_SLUGS_WITH_FACIAL_MAP = [
  'bioestimulador-colageno',
  'endolaser',
  'fios-pdo',
  'harmonizacao-glutea',
  'microagulhamento',
  'preenchimento-facial',
  'skinbooster',
  'ultrassom-microfocado',
] as const;

interface Procedure {
  id: string;
  name: string;
  slug: string;
  category?: string;
  description?: string | null;
}

/** Ordem e labels das categorias na seção Procedimentos realizados */
const PROCEDURE_CATEGORY_ORDER = [
  'Facial',
  'Corporal',
  'Injetáveis',
  'Avaliação',
  'Tecnologia',
  'Outros',
] as const;

function normalizeProcedureCategory(category: string | undefined): (typeof PROCEDURE_CATEGORY_ORDER)[number] {
  if (!category || !category.trim()) return 'Outros';
  const lower = category.trim().toLowerCase();
  if (lower.includes('facial')) return 'Facial';
  if (lower.includes('corporal') || lower.includes('corpo')) return 'Corporal';
  if (lower.includes('injetável') || lower.includes('injetavel')) return 'Injetáveis';
  if (lower.includes('avaliação') || lower.includes('avaliacao')) return 'Avaliação';
  if (lower.includes('tecnologia') || lower.includes('tecnológico')) return 'Tecnologia';
  const first = category.trim().charAt(0).toUpperCase() + category.trim().slice(1).toLowerCase();
  return PROCEDURE_CATEGORY_ORDER.includes(first as (typeof PROCEDURE_CATEGORY_ORDER)[number])
    ? (first as (typeof PROCEDURE_CATEGORY_ORDER)[number])
    : 'Outros';
}

interface Term {
  id: string;
  slug: string;
  version: number;
  title: string;
  body: string;
}

interface PatientSessionSummary {
  id: string;
  session_date: string;
  observacoes: string | null;
  procedure_sessions?: Array<{
    id: string;
    procedure_instance_id: string;
    procedure_instances?: { procedures: { name: string; slug: string } | null } | null;
  }>;
}

/** Decode imagem em tamanho reduzido para evitar pico de RAM no Android. Quem chama deve fazer bmp.close() após usar se for ImageBitmap. */
async function loadImageBitmapResized(
  src: string,
  maxW: number,
  maxH: number
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'undefined') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    return new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  const res = await fetch(src, { mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return createImageBitmap(blob, {
    resizeWidth: maxW,
    resizeHeight: maxH,
    resizeQuality: 'high',
  });
}

const CONSULTATION_DRAFT_KEY = 'consultation-session-draft';
const CONSULTATION_DRAFT_MAX_AGE_MS = 30 * 60 * 1000; // 30 min

/** Renderiza um campo dinâmico da consulta (text, number, date, boolean, select, image) */
function renderGenericProcedureField(
  field: ProcedureFieldRow,
  value: unknown,
  onChange: (key: string, value: unknown) => void,
  sessionDate: string,
  userId: string,
  instanceIdOrTemp: string,
  onCameraOpen?: () => void,
  previewVisible?: boolean,
  onCameraClose?: () => void,
  labelOverride?: string,
  optionsOverride?: string[]
) {
  return renderDynamicProcedureField({
    field,
    value,
    onChange,
    labelOverride,
    optionsOverride,
    sessionDate,
    userId,
    instanceIdOrTemp,
    previewVisible,
    onCameraOpen,
    onCameraClose,
  });
}

const PEIM_LABEL_OVERRIDES: Record<string, string> = {
  regiao_tratada: 'Região tratada',
  quantidade_microvasos: 'Qtd. microvasos (estimativa)',
  classificacao_vasos: 'Classificação dos vasos',
  cor_vasos: 'Cor dos vasos',
  volume_total_ml: 'Volume total (ml)',
  quantidade_aplicacoes: 'Qtd. aplicações',
  uso_anestesia: 'Uso de anestesia',
  tempo_procedimento_min: 'Tempo do procedimento (min)',
};

const PEIM_OPTIONS_OVERRIDES: Record<string, string[]> = {
  classificacao_vasos: ['Telangiectasia', 'Reticular', 'Outros'],
  cor_vasos: ['Vermelho', 'Roxo', 'Azul'],
  tecnica_utilizada: ['Injeção direta', 'Espuma', 'Mista'],
  substancia_utilizada: ['Glicose 50%', 'Glicose 75%', 'Outra'],
  contraindicacoes: ['Gestação', 'Lactação', 'Trombose', 'Alergia', 'Diabetes descompensada', 'Outros'],
};

function hasGalleryContent(gallery: BeforeAfterGalleryValue | undefined): boolean {
  if (!gallery) return false;
  return gallery.beforeImages.length > 0 || gallery.afterImages.length > 0 || gallery.pairs.length > 0;
}

function galleryToSessionJson(gallery: BeforeAfterGalleryValue): Json {
  const beforeMap = new Map(gallery.beforeImages.map((img) => [img.id, img.url]));
  const afterMap = new Map(gallery.afterImages.map((img) => [img.id, img.url]));
  return {
    before_images: gallery.beforeImages.map((img) => img.url),
    after_images: gallery.afterImages.map((img) => img.url),
    pairs: gallery.pairs.map((pair) => ({
      before_url: beforeMap.get(pair.beforeImageId) ?? null,
      after_url: afterMap.get(pair.afterImageId) ?? null,
      caption: pair.caption ?? '',
    })),
  } as Json;
}

function galleryToPhotoEntries(gallery: BeforeAfterGalleryValue): { photo_type: string; file_url: string }[] {
  const entries: { photo_type: string; file_url: string }[] = [];
  gallery.beforeImages.forEach((img, idx) => entries.push({ photo_type: `gallery_before_${idx + 1}`, file_url: img.url }));
  gallery.afterImages.forEach((img, idx) => entries.push({ photo_type: `gallery_after_${idx + 1}`, file_url: img.url }));
  return entries;
}

export default function ConsultationSessionPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const copy = useUiCopy();
  const focusProcedureSlug = (searchParams.get('procedure') ?? '').trim().toLowerCase() || null;
  const salonProcedureId = (searchParams.get('salonProcedure') ?? '').trim() || null;
  const salonProcedureNameParam = (searchParams.get('salonProcedureName') ?? '').trim() || null;
  const linkedAppointmentId = (searchParams.get('appointmentId') ?? '').trim() || null;
  const editSessionId = (searchParams.get('editSessionId') ?? '').trim() || null;
  const editInstanceId = (searchParams.get('editInstanceId') ?? '').trim() || null;
  const returnTo = (searchParams.get('returnTo') ?? '').trim() || null;
  const isEditingExistingSession = Boolean(editSessionId);
  const isFocusedProcedureOnly = Boolean(focusProcedureSlug);
  /** Salão: catálogo próprio (salon_procedures), sem procedimentos clínicos globais. */
  const isSalonProcedureMode =
    copy.isSalon && !focusProcedureSlug && !isEditingExistingSession;
  const isBotoxOnlyConsultation = focusProcedureSlug === 'botox';
  const pageTitle = isEditingExistingSession
    ? 'Editar sessão'
    : isSalonProcedureMode && salonProcedureNameParam
      ? `Atendimento — ${salonProcedureNameParam}`
      : focusProcedureSlug === 'depilacao-laser'
        ? 'Nova depilação a laser'
        : isFocusedProcedureOnly
          ? 'Nova sessão'
          : copy.newConsultation;
  const submitLabel = isEditingExistingSession
    ? 'Salvar alterações'
    : copy.isSalon
      ? 'Finalizar atendimento'
      : 'Finalizar consulta';
  const cancelHref = returnTo || (focusProcedureSlug && patientId ? `/patients/${patientId}` : '/consultation');
  const navigate = useNavigate();
  const { isClinicAccount, getPriceInput } = useOrganizationProcedurePrices();
  const isMobile = useIsMobile();
  const [patient, setPatient] = useState<{
    full_name: string;
    date_of_birth: string | null;
    cpf: string | null;
    phone: string | null;
    city: string | null;
    address: string | null;
    profession?: string | null;
    sex?: string | null;
    referred_by?: string | null;
    treatment_start_date?: string | null;
    consultation_objective?: string | null;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
  } | null>(null);
  const [lastSessions, setLastSessions] = useState<PatientSessionSummary[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [salonProcedures, setSalonProcedures] = useState<SalonProcedure[]>([]);
  const [selectedSalonProcedureIds, setSelectedSalonProcedureIds] = useState<Set<string>>(
    new Set()
  );
  const [salonProcedureSearchQuery, setSalonProcedureSearchQuery] = useState('');
  const [salonSessionPhotos, setSalonSessionPhotos] = useState<string[]>([]);
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sessionTime, setSessionTime] = useState(() => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  });
  const [selectedProcedureIds, setSelectedProcedureIds] = useState<Set<string>>(new Set());
  const [botoxPoints, setBotoxPoints] = useState<FacialPoint[]>([]);
  const [botoxReapplicationDue, setBotoxReapplicationDue] = useState('');
  const [botoxPrazoDias, setBotoxPrazoDias] = useState('');
  const [savingBotoxReminder, setSavingBotoxReminder] = useState(false);
  const [botoxProdutoUtilizado, setBotoxProdutoUtilizado] = useState('');
  const [botoxRegiaoTratada, setBotoxRegiaoTratada] = useState<string[]>([]);
  const [botoxQuantidadePorPonto, setBotoxQuantidadePorPonto] = useState<Record<string, string>>({});
  const [botoxQuantidadeUnidade, setBotoxQuantidadeUnidade] = useState('');
  const [botoxDataAplicacao, setBotoxDataAplicacao] = useState('');
  const [botoxLote, setBotoxLote] = useState('');
  const [botoxMarcaToxina, setBotoxMarcaToxina] = useState('');
  const [botoxDataValidade, setBotoxDataValidade] = useState('');
  const [botoxNumeroPontos, setBotoxNumeroPontos] = useState('');
  const [botoxDiluicao, setBotoxDiluicao] = useState('');
  const [botoxObservacoes, setBotoxObservacoes] = useState('');
  const [botoxFotoAntes, setBotoxFotoAntes] = useState<string | null>(null);
  const [botoxFotoDepois, setBotoxFotoDepois] = useState<string | null>(null);
  /** Antes/depois por região (Testa, Glabela, etc.) para compartilhar story por procedimento */
  const [botoxPhotosPorRegiao, setBotoxPhotosPorRegiao] = useState<Record<string, { antes: string | null; depois: string | null }>>(() =>
    Object.fromEntries(BOTOX_REGIOES.map((r) => [r.key, { antes: null, depois: null }]))
  );
  const [observacoes, setObservacoes] = useState('');
  const [terms, setTerms] = useState<Term[]>([]);
  const [signedTerms, setSignedTerms] = useState<Record<string, string>>({});
  const [signedProfessionalSignature, setSignedProfessionalSignature] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emagrecimentoPesoAtual, setEmagrecimentoPesoAtual] = useState<string>('');
  const [emagrecimentoAlturaCm, setEmagrecimentoAlturaCm] = useState<string>('');
  const [emagrecimentoAbdomenSuperior, setEmagrecimentoAbdomenSuperior] = useState<string>('');
  const [emagrecimentoCintura, setEmagrecimentoCintura] = useState<string>('');
  const [emagrecimentoAbdomenInferior, setEmagrecimentoAbdomenInferior] = useState<string>('');
  const [emagrecimentoBraco, setEmagrecimentoBraco] = useState<string>('');
  const [emagrecimentoBusto, setEmagrecimentoBusto] = useState<string>('');
  const [emagrecimentoQuadril, setEmagrecimentoQuadril] = useState<string>('');
  const [emagrecimentoInjetavel, setEmagrecimentoInjetavel] = useState<string>('');
  const [emagrecimentoProdutoUsado, setEmagrecimentoProdutoUsado] = useState('');
  const [emagrecimentoMg, setEmagrecimentoMg] = useState('');
  const [emagrecimentoDepoisFrente, setEmagrecimentoDepoisFrente] = useState('');
  const [emagrecimentoDepoisLado, setEmagrecimentoDepoisLado] = useState('');
  const [emagrecimentoDepoisCostas, setEmagrecimentoDepoisCostas] = useState('');
  const [emagrecimentoPrazoDias, setEmagrecimentoPrazoDias] = useState('');
  /** Prazo em dias para "Próxima avaliação" por procedimento (slug -> dias) */
  const [proximaAvaliacaoPorSlug, setProximaAvaliacaoPorSlug] = useState<Record<string, string>>({});
  /** Popup agenda: data = sessionDate + prazo (dias) */
  const [agendaOpenMode, setAgendaOpenMode] = useState<AgendaOpenMode>('dia');
  const [agendaPopupOpen, setAgendaPopupOpen] = useState(false);
  const [targetAgendaDate, setTargetAgendaDate] = useState<Date | null>(null);
  const [agendaDayAppointments, setAgendaDayAppointments] = useState<Array<{ appointment_date: string; start_time: string }>>([]);
  const [loadingAgendaDay, setLoadingAgendaDay] = useState(false);
  const [clinicClosedDates, setClinicClosedDates] = useState<string[]>([]);
  const [confirmSlotTime, setConfirmSlotTime] = useState<string | null>(null);
  const [savingAppointment, setSavingAppointment] = useState(false);
  /** Qual card de procedimento genérico está expandido (colapsados por padrão) */
  const [expandedGenericProcedureId, setExpandedGenericProcedureId] = useState<string | null>(null);
  const [expandedBotox, setExpandedBotox] = useState(false);
  const [expandedEmagrecimento, setExpandedEmagrecimento] = useState(false);
  /** Campos dinâmicos por procedimento (exceto Botox e Emagrecimento): slug -> lista de fields */
  const [procedureFieldsBySlug, setProcedureFieldsBySlug] = useState<
    Record<string, Array<ProcedureFieldRow & { isRequired?: boolean }>>
  >({});
  const [showSessionPhotos, setShowSessionPhotos] = useState(true);
  const [showBeforeAfterGallery, setShowBeforeAfterGallery] = useState(true);
  const [showNextEvaluationSection, setShowNextEvaluationSection] = useState(true);
  /** Valores dos campos por procedimento: slug -> { field_key -> value } */
  const [genericProcedureData, setGenericProcedureData] = useState<Record<string, Record<string, unknown>>>({});
  /** Valor e forma de pagamento por procedimento (card Valores em cada procedimento); parcelas quando forma = cartão */
  const [procedureValores, setProcedureValores] = useState<
    Record<
      string,
      { valor: string; forma_pagamento: FormaPagamento; parcelas?: number; price_tier?: ClinicPriceTier }
    >
  >({});
  /** Valor e forma de pagamento da consulta (quando há 2+ procedimentos) */
  const [consultaValores, setConsultaValores] = useState<{ valor: string; forma_pagamento: FormaPagamento; parcelas?: number }>({
    valor: '',
    forma_pagamento: 'pix' as FormaPagamento,
    parcelas: 1,
  });
  /** Busca na seção de procedimentos realizados */
  const [procedureSearchQuery, setProcedureSearchQuery] = useState('');
  /** Métricas da última sessão (emagrecimento) para comparação: { busto_cm, cintura_cm, ... } */
  const [lastSessionMetrics, setLastSessionMetrics] = useState<Record<string, number> | null>(null);
  /** True enquanto a câmera nativa está aberta: esconde todas as prévias para liberar RAM (câmera traseira) */
  const [cameraOpening, setCameraOpening] = useState(false);
  /** Galeria antes/depois por procedimento (slug -> gallery data). */
  const [comparisonGalleryBySlug, setComparisonGalleryBySlug] = useState<Record<string, BeforeAfterGalleryValue>>({});
  const [editHydrated, setEditHydrated] = useState(false);

  const selectedSlugs = useMemo(
    () =>
      procedures
        .filter((p) => selectedProcedureIds.has(p.id))
        .map((p) => p.slug),
    [procedures, selectedProcedureIds]
  );

  useEffect(() => {
    if (!selectedSlugs.includes('preenchimento-facial')) return;
    setGenericProcedureData((prev) => {
      const slug = 'preenchimento-facial';
      const cur = prev[slug] ?? {};
      const parsed = parsePreenchimentoAplicacoes(cur[PREENCHIMENTO_APLICACAO_STORAGE_KEY]);
      if (parsed.length > 0) return prev;
      return {
        ...prev,
        [slug]: ensurePreenchimentoAplicacoesInData(cur),
      };
    });
  }, [selectedSlugs]);

  useEffect(() => {
    if (!selectedSlugs.includes(LIPOENZIMATICA_SLUG)) return;
    setGenericProcedureData((prev) => {
      const cur = prev[LIPOENZIMATICA_SLUG] ?? {};
      const produtos = parseLipoenzimaticaProdutos(cur[LIPOENZIMATICA_PRODUTOS_STORAGE_KEY]);
      if (produtos.length > 0) return prev;
      return {
        ...prev,
        [LIPOENZIMATICA_SLUG]: ensureLipoenzimaticaSessionData(cur),
      };
    });
  }, [selectedSlugs]);

  const hasBotox = selectedSlugs.includes('botox');
  const hasEmagrecimento = selectedSlugs.includes('emagrecimento-reducao-medidas');
  const requiredTermSlugs = [...new Set(selectedSlugs.map((s) => PROCEDURE_TERM_SLUGS[s]).filter(Boolean))];
  const isMultiProcedimentos = selectedProcedureIds.size > 1;

  useEffect(() => {
    // Mantém o padrão: quando há apenas 1 procedimento selecionado, abre só o card dele.
    if (selectedSlugs.length !== 1) return;
    const onlySlug = selectedSlugs[0];
    if (!onlySlug) return;
    if (onlySlug === 'botox') {
      setExpandedBotox(true);
      setExpandedEmagrecimento(false);
      setExpandedGenericProcedureId(null);
      return;
    }
    if (onlySlug === 'emagrecimento-reducao-medidas') {
      setExpandedBotox(false);
      setExpandedEmagrecimento(true);
      setExpandedGenericProcedureId(null);
      return;
    }
    const onlyProc = procedures.find((p) => p.slug === onlySlug);
    setExpandedBotox(false);
    setExpandedEmagrecimento(false);
    setExpandedGenericProcedureId(onlyProc?.id ?? null);
  }, [selectedSlugs, procedures]);

  const procedureSearchLower = procedureSearchQuery.trim().toLowerCase();
  const proceduresScope = useMemo(() => {
    if (focusProcedureSlug) return procedures.filter((p) => p.slug === focusProcedureSlug);
    return procedures;
  }, [procedures, focusProcedureSlug]);
  const filteredProcedures = procedureSearchLower
    ? proceduresScope.filter(
        (p) =>
          p.name.toLowerCase().includes(procedureSearchLower) ||
          (p.category?.toLowerCase().includes(procedureSearchLower) ?? false) ||
          p.slug.toLowerCase().includes(procedureSearchLower)
      )
    : proceduresScope;

  const shouldShowSessionPhotosSection = showSessionPhotos;
  const isBotoxRegiaoTratadaVisible = useMemo(() => {
    const fields = procedureFieldsBySlug['botox'];
    if (!fields?.length) return true;
    return fields.some((f) => {
      const label = (f.label ?? '').trim().toLowerCase();
      const key = (f.field_key ?? '').trim().toLowerCase();
      return key === 'regiao_tratada' || key === 'região_tratada' || label === 'regiao tratada' || label === 'região tratada';
    });
  }, [procedureFieldsBySlug]);
  const visibleBotoxRegions = useMemo(() => {
    const fields = procedureFieldsBySlug['botox'];
    if (!fields?.length) return BOTOX_REGIOES;
    const activeKeys = new Set(fields.map((f) => (f.field_key ?? '').trim().toLowerCase()));
    const hasPerRegionConfig = BOTOX_REGIOES.some((r) => activeKeys.has(`botox_regiao_${r.key}`));
    if (!hasPerRegionConfig) return BOTOX_REGIOES;
    return BOTOX_REGIOES.filter((r) => activeKeys.has(`botox_regiao_${r.key}`));
  }, [procedureFieldsBySlug]);

  const emptyGallery = useMemo<BeforeAfterGalleryValue>(
    () => ({ beforeImages: [], afterImages: [], pairs: [] }),
    []
  );

  const setGalleryForSlug = useCallback((slug: string, next: BeforeAfterGalleryValue) => {
    setComparisonGalleryBySlug((prev) => ({ ...prev, [slug]: next }));
  }, []);

  const getGalleryForSlug = useCallback(
    (slug: string): BeforeAfterGalleryValue => comparisonGalleryBySlug[slug] ?? emptyGallery,
    [comparisonGalleryBySlug, emptyGallery]
  );

  const proceduresByCategory = useMemo(() => {
    const map = new Map<string, Procedure[]>();
    PROCEDURE_CATEGORY_ORDER.forEach((cat) => map.set(cat, []));
    filteredProcedures.forEach((p) => {
      const cat = normalizeProcedureCategory(p.category);
      map.get(cat)?.push(p);
    });
    return PROCEDURE_CATEGORY_ORDER.filter((cat) => (map.get(cat)?.length ?? 0) > 0).map((cat) => ({
      title: cat,
      procedures: map.get(cat) ?? [],
    }));
  }, [filteredProcedures]);

  const antesDepoisUrls = useMemo((): { antes: string | null; depois: string | null } => {
    if (hasBotox && botoxFotoAntes?.trim() && botoxFotoDepois?.trim())
      return { antes: botoxFotoAntes.trim(), depois: botoxFotoDepois.trim() };
    for (const slug of selectedSlugs) {
      if (slug === 'botox' || slug === 'emagrecimento-reducao-medidas') continue;
      const fields = procedureFieldsBySlug[slug];
      const data = genericProcedureData[slug];
      if (!fields?.length || !data) continue;
      let antes: string | null = null;
      let depois: string | null = null;
      const antesKey = fields.find(
        (f) => f.field_type === 'image' && /antes|before/i.test(f.label || '')
      )?.field_key;
      const depoisKey = fields.find(
        (f) => f.field_type === 'image' && /depois|after/i.test(f.label || '')
      )?.field_key;
      if (antesKey && typeof data[antesKey] === 'string' && (data[antesKey] as string).trim())
        antes = (data[antesKey] as string).trim();
      if (depoisKey && typeof data[depoisKey] === 'string' && (data[depoisKey] as string).trim())
        depois = (data[depoisKey] as string).trim();
      if (antes || depois) return { antes, depois };
    }
    if (hasBotox && botoxFotoAntes?.trim()) return { antes: botoxFotoAntes.trim(), depois: null };
    if (hasBotox && botoxFotoDepois?.trim()) return { antes: null, depois: botoxFotoDepois.trim() };
    if (hasEmagrecimento && emagrecimentoDepoisFrente?.trim())
      return { antes: null, depois: emagrecimentoDepoisFrente.trim() };
    if (hasEmagrecimento && emagrecimentoDepoisLado?.trim())
      return { antes: null, depois: emagrecimentoDepoisLado.trim() };
    if (hasEmagrecimento && emagrecimentoDepoisCostas?.trim())
      return { antes: null, depois: emagrecimentoDepoisCostas.trim() };
    return { antes: null, depois: null };
  }, [
    hasBotox,
    hasEmagrecimento,
    selectedSlugs,
    botoxFotoAntes,
    botoxFotoDepois,
    emagrecimentoDepoisFrente,
    emagrecimentoDepoisLado,
    emagrecimentoDepoisCostas,
    procedureFieldsBySlug,
    genericProcedureData,
  ]);

  const firstSessionPhotoUrl = useMemo(() => {
    if (antesDepoisUrls.antes) return antesDepoisUrls.antes;
    if (antesDepoisUrls.depois) return antesDepoisUrls.depois;
    return null;
  }, [antesDepoisUrls]);

  /** Tema "Minimalista Moderna com Foco Cirúrgico" — mesmo do AntesDepoisCard */
  const STORY_THEME = {
    background: '#FAFAF8',
    textPrimary: '#1A1A1A',
    antes: '#10B981',
    depois: '#0F3A7D',
    cta: '#F59E0B',
    border: 'rgba(26, 26, 26, 0.08)',
    white: '#FFFFFF',
  };

  const drawAntesDepoisStory = useCallback(
    async (
      antesUrl: string | null,
      depoisUrl: string | null,
      options?: { regiaoTratada?: string | null; clinicLogoUrl?: string | null }
    ): Promise<Blob> => {
      const W = 1080;
      const H = 1920;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2d not available');

      const regiaoTratada = options?.regiaoTratada?.trim() ?? null;
      const clinicLogoUrl = options?.clinicLogoUrl?.trim() ?? null;

      // Fundo com gradiente muito leve (mantém minimalista)
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#F5F5F3');
      bgGrad.addColorStop(0.5, STORY_THEME.background);
      bgGrad.addColorStop(1, '#F0F0EE');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Header: fundo branco com borda inferior sutil
      const headerH = 340;
      ctx.fillStyle = STORY_THEME.white;
      ctx.fillRect(0, 0, W, headerH);
      ctx.strokeStyle = STORY_THEME.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, headerH);
      ctx.lineTo(W, headerH);
      ctx.stroke();

      ctx.textAlign = 'center';

      // Topo: ícone da clínica (logo) ou texto "CLINIEVO"
      const logoSize = 88;
      const logoY = 56;
      let logoDrawn = false;
      if (clinicLogoUrl) {
        try {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.crossOrigin = 'anonymous';
            el.onload = () => resolve(el);
            el.onerror = reject;
            el.src = clinicLogoUrl;
          });
          const sx = W / 2 - logoSize / 2;
          ctx.drawImage(img, sx, logoY, logoSize, logoSize);
          logoDrawn = true;
        } catch {
          /* logo falhou ao carregar */
        }
      }
      if (!logoDrawn) {
        ctx.font = '600 24px system-ui, sans-serif';
        ctx.fillStyle = STORY_THEME.textPrimary;
        ctx.globalAlpha = 0.7;
        ctx.fillText('CLINIEVO', W / 2, logoY + logoSize / 2 + 8);
        ctx.globalAlpha = 1;
      }

      const badgeY = 120;
      ctx.fillStyle = STORY_THEME.textPrimary;
      ctx.font = 'bold 56px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('RESULTADO DA SESSÃO', W / 2, badgeY + 72);

      ctx.fillStyle = STORY_THEME.textPrimary;
      ctx.globalAlpha = 0.85;
      ctx.font = '400 28px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('Antes e depois do tratamento estético', W / 2, badgeY + 124);
      ctx.globalAlpha = 1;

      // Região tratada (acima dos cards), quando informada (ex.: Botox — Testa)
      const topAreaY = regiaoTratada ? 420 : 380;
      if (regiaoTratada) {
        const regiaoY = 368;
        ctx.font = '600 22px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = STORY_THEME.textPrimary;
        ctx.globalAlpha = 0.9;
        ctx.fillText('Região tratada', W / 2, regiaoY - 8);
        ctx.font = 'bold 32px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.globalAlpha = 1;
        ctx.fillText(regiaoTratada, W / 2, regiaoY + 32);
      }

      // Área central com dois cards (tema claro, sombras sutis)
      const sidePadding = 96;
      const cardsHeight = 1080;
      const columnWidth = (W - sidePadding * 2 - 40) / 2;

      const drawSlot = async (
        index: number,
        url: string | null,
        label: string,
        badgeColorFrom: string,
        badgeColorTo: string
      ) => {
        const cardX = sidePadding + index * (columnWidth + 40);
        const cardY = topAreaY;
        const cardW = columnWidth;
        const cardH = cardsHeight;
        const radius = 48;

        // Card base branco com sombra sutil
        ctx.save();
        ctx.shadowColor = 'rgba(26, 26, 26, 0.08)';
        ctx.shadowBlur = 32;
        ctx.shadowOffsetY = 8;
        ctx.fillStyle = STORY_THEME.white;
        ctx.beginPath();
        ctx.moveTo(cardX + radius, cardY);
        ctx.lineTo(cardX + cardW - radius, cardY);
        ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + radius);
        ctx.lineTo(cardX + cardW, cardY + cardH - radius);
        ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - radius, cardY + cardH);
        ctx.lineTo(cardX + radius, cardY + cardH);
        ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - radius);
        ctx.lineTo(cardX, cardY + radius);
        ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = STORY_THEME.border;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Badge ANTES/DEPOIS com gradiente
        const chipHeight = 52;
        const chipRadius = chipHeight / 2;
        const chipPaddingX = 28;
        ctx.font = '600 26px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
        const chipText = label.toUpperCase();
        const textWidth = ctx.measureText(chipText).width;
        const chipWidth = textWidth + chipPaddingX * 2;
        const chipX = index === 0 ? cardX + 36 : cardX + cardW - chipWidth - 36;
        const chipY = cardY + 28;

        const chipGrad = ctx.createLinearGradient(chipX, chipY, chipX + chipWidth, chipY + chipHeight);
        chipGrad.addColorStop(0, badgeColorFrom);
        chipGrad.addColorStop(1, badgeColorTo);
        ctx.fillStyle = chipGrad;
        ctx.beginPath();
        ctx.moveTo(chipX + chipRadius, chipY);
        ctx.lineTo(chipX + chipWidth - chipRadius, chipY);
        ctx.quadraticCurveTo(chipX + chipWidth, chipY, chipX + chipWidth, chipY + chipRadius);
        ctx.lineTo(chipX + chipWidth, chipY + chipHeight - chipRadius);
        ctx.quadraticCurveTo(
          chipX + chipWidth,
          chipY + chipHeight,
          chipX + chipWidth - chipRadius,
          chipY + chipHeight
        );
        ctx.lineTo(chipX + chipRadius, chipY + chipHeight);
        ctx.quadraticCurveTo(chipX, chipY + chipHeight, chipX, chipY + chipRadius);
        ctx.lineTo(chipX, chipY + chipRadius);
        ctx.quadraticCurveTo(chipX, chipY, chipX + chipRadius, chipY);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(chipText, chipX + chipWidth / 2, chipY + chipHeight / 2 + 8);

        // Área da foto dentro do card
        const photoPadding = 40;
        const photoX = cardX + photoPadding;
        const photoY = cardY + chipHeight + 56;
        const photoW = cardW - photoPadding * 2;
        const photoH = cardH - (chipHeight + 56 + photoPadding * 1.5);
        const photoRadius = 40;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(photoX + photoRadius, photoY);
        ctx.lineTo(photoX + photoW - photoRadius, photoY);
        ctx.quadraticCurveTo(photoX + photoW, photoY, photoX + photoW, photoY + photoRadius);
        ctx.lineTo(photoX + photoW, photoY + photoH - photoRadius);
        ctx.quadraticCurveTo(
          photoX + photoW,
          photoY + photoH,
          photoX + photoW - photoRadius,
          photoY + photoH
        );
        ctx.lineTo(photoX + photoRadius, photoY + photoH);
        ctx.quadraticCurveTo(photoX, photoY + photoH, photoX, photoY + photoH - photoRadius);
        ctx.lineTo(photoX, photoY + photoRadius);
        ctx.quadraticCurveTo(photoX, photoY, photoX + photoRadius, photoY);
        ctx.closePath();
        ctx.clip();

        if (url) {
          const maxDecodeW = 540;
          const maxDecodeH = 960;
          try {
            const imgOrBmp = await loadImageBitmapResized(url, maxDecodeW, maxDecodeH);
            const w = 'naturalWidth' in imgOrBmp ? imgOrBmp.naturalWidth : imgOrBmp.width;
            const h = 'naturalHeight' in imgOrBmp ? imgOrBmp.naturalHeight : imgOrBmp.height;
            const scale = Math.min(photoW / w, photoH / h);
            const sw = w * scale;
            const sh = h * scale;
            const sx = photoX + (photoW - sw) / 2;
            const sy = photoY + (photoH - sh) / 2;
            ctx.drawImage(imgOrBmp, sx, sy, sw, sh);
            if ('close' in imgOrBmp && typeof imgOrBmp.close === 'function') imgOrBmp.close();
          } catch {
            ctx.fillStyle = 'rgba(26, 26, 26, 0.04)';
            ctx.fillRect(photoX, photoY, photoW, photoH);
            ctx.fillStyle = STORY_THEME.textPrimary;
            ctx.globalAlpha = 0.5;
            ctx.font = '500 28px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Foto', photoX + photoW / 2, photoY + photoH / 2 + 10);
            ctx.globalAlpha = 1;
          }
        } else {
          ctx.fillStyle = 'rgba(26, 26, 26, 0.04)';
          ctx.fillRect(photoX, photoY, photoW, photoH);
          ctx.fillStyle = STORY_THEME.textPrimary;
          ctx.globalAlpha = 0.5;
          ctx.font = '500 28px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Foto', photoX + photoW / 2, photoY + photoH / 2 + 10);
          ctx.globalAlpha = 1;
        }

        ctx.restore();

        // Borda interna sutil na área da foto (destaca do fundo)
        ctx.strokeStyle = 'rgba(26, 26, 26, 0.06)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(photoX + photoRadius, photoY);
        ctx.lineTo(photoX + photoW - photoRadius, photoY);
        ctx.quadraticCurveTo(photoX + photoW, photoY, photoX + photoW, photoY + photoRadius);
        ctx.lineTo(photoX + photoW, photoY + photoH - photoRadius);
        ctx.quadraticCurveTo(photoX + photoW, photoY + photoH, photoX + photoW - photoRadius, photoY + photoH);
        ctx.lineTo(photoX + photoRadius, photoY + photoH);
        ctx.quadraticCurveTo(photoX, photoY + photoH, photoX, photoY + photoH - photoRadius);
        ctx.lineTo(photoX, photoY + photoRadius);
        ctx.quadraticCurveTo(photoX, photoY, photoX + photoRadius, photoY);
        ctx.closePath();
        ctx.stroke();
      };

      // Antes à esquerda (gradiente verde menta), Depois à direita (gradiente azul)
      await drawSlot(0, antesUrl, 'Antes', STORY_THEME.antes, '#34D399');
      await drawSlot(1, depoisUrl, 'Depois', STORY_THEME.depois, '#2563EB');

      // Linha divisória sutil entre os dois cards (reforça a comparação)
      const gapCenterX = W / 2;
      ctx.strokeStyle = 'rgba(26, 26, 26, 0.06)';
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.moveTo(gapCenterX, topAreaY + 60);
      ctx.lineTo(gapCenterX, topAreaY + cardsHeight - 20);
      ctx.stroke();
      ctx.setLineDash([]);

      // Indicador de transformação (seta) entre os cards
      const arrowY = topAreaY + cardsHeight / 2;
      const arrowSize = 28;
      ctx.fillStyle = STORY_THEME.textPrimary;
      ctx.globalAlpha = 0.35;
      ctx.font = `600 ${arrowSize}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('→', gapCenterX, arrowY);
      ctx.globalAlpha = 1;
      ctx.textBaseline = 'alphabetic';

      // Rodapé: fundo branco, selo de autenticidade + CTA
      const footerTop = topAreaY + cardsHeight + 24;
      ctx.fillStyle = STORY_THEME.white;
      ctx.fillRect(0, footerTop, W, H - footerTop);
      ctx.strokeStyle = STORY_THEME.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, footerTop);
      ctx.lineTo(W, footerTop);
      ctx.stroke();

      ctx.textAlign = 'center';

      // Selo de autenticidade
      ctx.fillStyle = STORY_THEME.textPrimary;
      ctx.globalAlpha = 0.65;
      ctx.font = '500 22px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('Resultado real • Sem filtros', W / 2, footerTop + 52);
      ctx.globalAlpha = 1;

      // CTA "Agende sua avaliação"
      const ctaLabel = 'Agende sua avaliação';
      ctx.font = '700 26px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      const ctaW = ctx.measureText(ctaLabel).width + 80;
      const ctaH = 56;
      const ctaX = (W - ctaW) / 2;
      const ctaY = footerTop + 88;
      const ctaR = ctaH / 2;

      ctx.fillStyle = STORY_THEME.cta;
      ctx.beginPath();
      ctx.moveTo(ctaX + ctaR, ctaY);
      ctx.lineTo(ctaX + ctaW - ctaR, ctaY);
      ctx.quadraticCurveTo(ctaX + ctaW, ctaY, ctaX + ctaW, ctaY + ctaR);
      ctx.lineTo(ctaX + ctaW, ctaY + ctaH - ctaR);
      ctx.quadraticCurveTo(ctaX + ctaW, ctaY + ctaH, ctaX + ctaW - ctaR, ctaY + ctaH);
      ctx.lineTo(ctaX + ctaR, ctaY + ctaH);
      ctx.quadraticCurveTo(ctaX, ctaY + ctaH, ctaX, ctaY + ctaH - ctaR);
      ctx.lineTo(ctaX, ctaY + ctaR);
      ctx.quadraticCurveTo(ctaX, ctaY, ctaX + ctaR, ctaY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = STORY_THEME.textPrimary;
      ctx.fillText(ctaLabel, W / 2, ctaY + ctaH / 2 + 8);

      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
          'image/jpeg',
          0.92
        );
      });
    },
    []
  );

  /** Compartilha um blob (imagem antes/depois) no share sheet (Android) ou navigator.share (web). */
  const shareBlobAsStory = useCallback(async (blob: Blob, title: string) => {
    const isNative = Capacitor.getPlatform() !== 'web';
    if (isNative && Capacitor.getPlatform() === 'android') {
      const blobToBase64 = (b: Blob): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1] ?? '');
          };
          reader.onerror = reject;
          reader.readAsDataURL(b);
        });
      const base64 = await blobToBase64(blob);
      const writeResult = await Filesystem.writeFile({
        path: `antes-depois-${Date.now()}.jpg`,
        data: base64,
        directory: Directory.Data,
      });
      const canShare = await Share.canShare();
      if (!canShare?.value) {
        toast.error('Compartilhamento não disponível neste dispositivo.');
        return;
      }
      await Share.share({ url: writeResult.uri, title, dialogTitle: 'Compartilhar' });
      toast.success('Escolha o Instagram no menu para publicar o story.');
      return;
    }
    const file = new File([blob], 'antes-depois-story.jpg', { type: blob.type || 'image/jpeg' });
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        toast.success('Compartilhe no Instagram pelo menu que abriu.');
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError')
          window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
      }
    } else {
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
      toast.info('Abra o Instagram e adicione a foto ao story.');
    }
  }, []);

  const handleShareBotoxStoryPorRegiao = useCallback(
    async (regiaoKey: string, regiaoLabel: string) => {
      const pair = botoxPhotosPorRegiao[regiaoKey];
      if (!pair?.antes?.trim() || !pair?.depois?.trim()) {
        toast.error(`Adicione foto antes e depois em "${regiaoLabel}" para compartilhar.`);
        return;
      }
      try {
        const blob = await drawAntesDepoisStory(pair.antes, pair.depois, {
          regiaoTratada: regiaoLabel,
          clinicLogoUrl: profile?.app_logo_url ?? null,
        });
        await shareBlobAsStory(blob, `Antes e Depois — ${regiaoLabel}`);
      } catch (err: unknown) {
        const msg = (err as { message?: string })?.message ?? (err as Error)?.toString?.() ?? 'Erro ao gerar story.';
        toast.error(msg, { duration: 8000 });
      }
    },
    [botoxPhotosPorRegiao, drawAntesDepoisStory, shareBlobAsStory, profile?.app_logo_url]
  );

  const handleShareToInstagram = useCallback(async () => {
    const { antes, depois } = antesDepoisUrls;
    const hasPair = antes || depois;

    const urlToBlob = async (url: string): Promise<Blob | null> => {
      try {
        if (url.startsWith('data:')) {
          const [header, base64] = url.split(',');
          const mime = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg';
          const bin = atob(base64);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          return new Blob([arr], { type: mime });
        }
        const res = await fetch(url, { mode: 'cors' });
        return await res.blob();
      } catch {
        return null;
      }
    };

    let blob: Blob | null = null;
    if (hasPair) {
      try {
        blob = await drawAntesDepoisStory(antes, depois, {
          clinicLogoUrl: profile?.app_logo_url ?? null,
        });
      } catch {
        if (antes) blob = await urlToBlob(antes);
        else if (depois) blob = await urlToBlob(depois);
      }
    } else {
      const first = firstSessionPhotoUrl;
      if (first) blob = await urlToBlob(first);
    }

    if (!blob) {
      toast.info('Adicione fotos de antes e/ou depois na sessão para gerar o story.');
      return;
    }

    const title = hasPair ? 'Antes e Depois — Sessão' : 'Foto da sessão';
    try {
      await shareBlobAsStory(blob, title);
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ?? (err as Error)?.toString?.() ?? 'Erro desconhecido';
      toast.error(msg, { duration: 8000 });
    }
  }, [antesDepoisUrls, firstSessionPhotoUrl, drawAntesDepoisStory, shareBlobAsStory, profile?.app_logo_url]);

  const loadData = useCallback(async () => {
    if (!patientId || !profile?.id) return;
    setLoading(true);
    try {
      const patientQuery = supabase
        .from('patients')
        .select(
          'full_name, date_of_birth, cpf, phone, city, address, profession, sex, referred_by, treatment_start_date, consultation_objective, emergency_contact_name, emergency_contact_phone'
        )
        .eq('id', patientId)
        .single();
      const sessionsQuery = supabase
        .from('patient_sessions')
        .select('id, session_date, observacoes, procedure_sessions(id, procedure_instance_id, procedure_instances(procedures(name, slug)))')
        .eq('patient_id', patientId)
        .order('session_date', { ascending: false })
        .limit(5);

      if (isSalonProcedureMode) {
        const [patientRes, sessionsRes, salonProcs] = await Promise.all([
          patientQuery,
          sessionsQuery,
          fetchSalonProcedures().catch(() => [] as SalonProcedure[]),
        ]);
        setPatient(
          (patientRes.data as {
            full_name: string;
            date_of_birth: string | null;
            cpf: string | null;
            phone: string | null;
            city: string | null;
            address: string | null;
            profession: string | null;
            sex: string | null;
            referred_by: string | null;
            treatment_start_date: string | null;
            consultation_objective: string | null;
            emergency_contact_name: string | null;
            emergency_contact_phone: string | null;
          }) ?? null
        );
        setLastSessions((sessionsRes.data ?? []) as PatientSessionSummary[]);
        setSalonProcedures(
          salonProcs.filter((p) => p.is_active !== false).sort((a, b) => a.name.localeCompare(b.name))
        );
        setProcedures([]);
        return;
      }

      const [patientRes, sessionsRes, upRes, procs] = await Promise.all([
        patientQuery,
        sessionsQuery,
        supabase
          .from('user_procedures')
          .select('procedure_id, is_active')
          .eq('user_id', profile.id),
        getProceduresForProfile(profile.id),
      ]);
      setPatient(
        (patientRes.data as {
          full_name: string;
          date_of_birth: string | null;
          cpf: string | null;
          phone: string | null;
          city: string | null;
          address: string | null;
          profession: string | null;
          sex: string | null;
          referred_by: string | null;
          treatment_start_date: string | null;
          consultation_objective: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
        }) ?? null
      );
      const validLastSessions = ((sessionsRes.data ?? []) as PatientSessionSummary[]).filter(
        (s) => Array.isArray(s.procedure_sessions) && s.procedure_sessions.length > 0
      );
      setLastSessions(validLastSessions);
      const prefs = (upRes.data ?? []) as { procedure_id: string; is_active: boolean }[];
      const prefsMap = new Map(prefs.map((p) => [p.procedure_id, p]));
      const activeOnly = procs.filter((p) => {
        const up = prefsMap.get(p.id);
        if (!up) return true;
        return up.is_active !== false;
      });
      const bySlug = new Map<string, Procedure>();
      activeOnly.forEach((p) => {
        if (!bySlug.has(p.slug)) bySlug.set(p.slug, p);
      });
      setProcedures(Array.from(bySlug.values()).sort((a, b) => a.name.localeCompare(b.name)));

      const emagProc = activeOnly.find((p) => p.slug === 'emagrecimento-reducao-medidas');
      if (emagProc?.id) {
        const { data: instances } = await supabase
          .from('procedure_instances')
          .select('id')
          .eq('patient_id', patientId)
          .eq('procedure_id', emagProc.id)
          .eq('status', 'em_andamento')
          .limit(1);
        const instanceId = (instances?.[0] as { id: string } | undefined)?.id;
        if (instanceId) {
          const { data: lastSession } = await supabase
            .from('procedure_sessions')
            .select('data')
            .eq('procedure_instance_id', instanceId)
            .order('session_date', { ascending: false })
            .limit(1)
            .maybeSingle();
          const data = (lastSession as { data?: Record<string, unknown> } | null)?.data;
          if (data && typeof data === 'object') {
            const metrics: Record<string, number> = {};
            ['busto_cm', 'cintura_cm', 'quadril_cm', 'abdomen_superior_cm', 'abdomen_inferior_cm', 'braco_cm', 'peso_kg'].forEach((key) => {
              const v = data[key];
              if (typeof v === 'number' && Number.isFinite(v)) metrics[key] = v;
            });
            if (Object.keys(metrics).length > 0) setLastSessionMetrics(metrics);
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [patientId, profile?.id, isSalonProcedureMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!focusProcedureSlug || procedures.length === 0) return;
    const proc = procedures.find((p) => p.slug === focusProcedureSlug);
    if (!proc) return;
    setSelectedProcedureIds(new Set([proc.id]));
  }, [focusProcedureSlug, procedures]);

  useEffect(() => {
    if (!isSalonProcedureMode || salonProcedures.length === 0) return;
    const next = new Set<string>();
    if (salonProcedureId && salonProcedures.some((p) => p.id === salonProcedureId)) {
      next.add(salonProcedureId);
    } else if (salonProcedureNameParam) {
      const match = salonProcedures.find(
        (p) => p.name.trim().toLowerCase() === salonProcedureNameParam.trim().toLowerCase()
      );
      if (match) next.add(match.id);
    }
    if (next.size === 0) return;
    setSelectedSalonProcedureIds(next);
  }, [isSalonProcedureMode, salonProcedures, salonProcedureId, salonProcedureNameParam]);

  useEffect(() => {
    if (!isEditingExistingSession || !editSessionId || !patientId || !profile?.id || editHydrated) return;
    (async () => {
      try {
        const { data: procSession, error: procSessionErr } = await supabase
          .from('procedure_sessions')
          .select('id, session_date, patient_session_id, procedure_instance_id, data, observacoes')
          .eq('id', editSessionId)
          .single();
        if (procSessionErr) throw procSessionErr;
        const sessionData = (procSession?.data && typeof procSession.data === 'object'
          ? (procSession.data as Record<string, unknown>)
          : {}) as Record<string, unknown>;
        const sessionDateStr = String(procSession?.session_date ?? '').slice(0, 10);
        if (sessionDateStr) setSessionDate(sessionDateStr);
        if (typeof procSession?.observacoes === 'string') setObservacoes(procSession.observacoes);
        const psId = procSession?.patient_session_id ?? null;
        const resolvedInstanceId = editInstanceId || procSession?.procedure_instance_id || null;
        if (psId) {
          const { data: patientSessionRow, error: patientSessionErr } = await supabase
            .from('patient_sessions')
            .select('start_time')
            .eq('id', psId)
            .maybeSingle();
          if (!patientSessionErr) {
            const rawStartTime = typeof patientSessionRow?.start_time === 'string' ? patientSessionRow.start_time : '';
            if (rawStartTime) setSessionTime(rawStartTime.slice(0, 5));
          }
        }

        if (resolvedInstanceId) {
          const { data: inst, error: instErr } = await supabase
            .from('procedure_instances')
            .select('procedure_id, procedures(slug)')
            .eq('id', resolvedInstanceId)
            .single();
          if (!instErr && inst?.procedure_id) {
            const pid = String(inst.procedure_id);
            const procSlug = (inst as { procedures?: { slug?: string } | null })?.procedures?.slug ?? '';
            setSelectedProcedureIds(new Set([pid]));
            if (procSlug) {
              if (procSlug === 'botox') {
                setBotoxPoints((sessionData.pontos_aplicacao as FacialPoint[] | undefined) ?? []);
                setBotoxProdutoUtilizado(String(sessionData.produto_utilizado ?? ''));
                setBotoxRegiaoTratada((sessionData.regiao_tratada as string[] | undefined) ?? []);
                setBotoxQuantidadePorPonto((sessionData.quantidade_por_ponto as Record<string, string> | undefined) ?? {});
                setBotoxQuantidadeUnidade(String(sessionData.quantidade_unidade ?? ''));
                setBotoxDataAplicacao(String(sessionData.data_aplicacao ?? ''));
                setBotoxLote(String(sessionData.lote ?? ''));
                setBotoxMarcaToxina(String(sessionData.marca_toxina ?? ''));
                setBotoxDataValidade(String(sessionData.data_validade ?? ''));
                setBotoxNumeroPontos(String(sessionData.numero_pontos_aplicacao ?? ''));
                setBotoxDiluicao(String(sessionData.diluicao_utilizada ?? ''));
                setBotoxObservacoes(String(sessionData.observacoes_botox ?? ''));
              } else if (procSlug === 'emagrecimento-reducao-medidas') {
                setEmagrecimentoPesoAtual(String(sessionData.peso_atual ?? ''));
                setEmagrecimentoAlturaCm(String(sessionData.altura_cm ?? ''));
                setEmagrecimentoAbdomenSuperior(String(sessionData.abdomen_superior_cm ?? ''));
                setEmagrecimentoCintura(String(sessionData.cintura_cm ?? ''));
                setEmagrecimentoAbdomenInferior(String(sessionData.abdomen_inferior_cm ?? ''));
                setEmagrecimentoBraco(String(sessionData.braco_cm ?? ''));
                setEmagrecimentoBusto(String(sessionData.busto_cm ?? ''));
                setEmagrecimentoQuadril(String(sessionData.quadril_cm ?? ''));
                setEmagrecimentoInjetavel(String(sessionData.injetavel ?? ''));
                setEmagrecimentoProdutoUsado(String(sessionData.produto_usado ?? ''));
                setEmagrecimentoMg(String(sessionData.ml ?? ''));
              } else {
                const hydrated =
                  procSlug === 'preenchimento-facial'
                    ? normalizePreenchimentoFacialSessionData(sessionData ?? {})
                    : procSlug === LIPOENZIMATICA_SLUG
                      ? normalizeLipoenzimaticaSessionData(sessionData ?? {})
                      : isNewCustomProcedureSlug(procSlug)
                        ? normalizeNewCustomSessionData(procSlug, sessionData ?? {})
                        : { ...(sessionData ?? {}) };
                setGenericProcedureData((prev) => ({
                  ...prev,
                  [procSlug]: hydrated,
                }));
              }
            }
            const sessionDay = String(procSession?.session_date ?? '').slice(0, 10);
            if (sessionDay) {
              const dayStart = `${sessionDay}T00:00:00`;
              const dayEnd = `${sessionDay}T23:59:59`;
              let found: any = null;
              const { data: byDayRows } = await supabase
                .from('recebimentos')
                .select('*')
                .eq('cliente_id', patientId)
                .eq('profissional_id', profile.id)
                .eq('procedimento_id', pid)
                .gte('data', dayStart)
                .lte('data', dayEnd)
                .order('data', { ascending: false })
                .limit(1);
              found = (byDayRows ?? [])[0] ?? null;
              if (!found) {
                const { data: latestUntilDayRows } = await supabase
                  .from('recebimentos')
                  .select('*')
                  .eq('cliente_id', patientId)
                  .eq('profissional_id', profile.id)
                  .eq('procedimento_id', pid)
                  .lte('data', dayEnd)
                  .order('data', { ascending: false })
                  .limit(1);
                found = (latestUntilDayRows ?? [])[0] ?? null;
              }
              if (found) {
                setProcedureValores((prev) => ({
                  ...prev,
                  [pid]: {
                    valor: String(found.valor_total ?? ''),
                    forma_pagamento: (found.forma_pagamento as FormaPagamento) ?? 'pix',
                    parcelas: found.parcelas && found.parcelas > 0 ? found.parcelas : 1,
                  },
                }));
              }
            }
          }
        }

        const { data: editPhotos } = await supabase
          .from('procedure_photos')
          .select('id, photo_type, file_url')
          .eq('procedure_session_id', editSessionId);
        const photos = (editPhotos ?? []) as Array<{ id: string; photo_type: string; file_url: string }>;
        const botoxAntes = photos.find((p) => p.photo_type === 'antes')?.file_url ?? null;
        const botoxDepois = photos.find((p) => p.photo_type === 'depois')?.file_url ?? null;
        if (botoxAntes != null) setBotoxFotoAntes(botoxAntes);
        if (botoxDepois != null) setBotoxFotoDepois(botoxDepois);
        const nextRegionPhotos = Object.fromEntries(
          BOTOX_REGIOES.map((r) => {
            const antes = photos.find((p) => p.photo_type === `antes_${r.key}`)?.file_url ?? null;
            const depois = photos.find((p) => p.photo_type === `depois_${r.key}`)?.file_url ?? null;
            return [r.key, { antes, depois }];
          })
        ) as Record<string, { antes: string | null; depois: string | null }>;
        setBotoxPhotosPorRegiao(nextRegionPhotos);
        const beforeImages = photos
          .filter((p) => /^gallery_before_\d+$/.test(p.photo_type))
          .sort((a, b) => a.photo_type.localeCompare(b.photo_type))
          .map((p) => ({ id: p.id, url: p.file_url }));
        const afterImages = photos
          .filter((p) => /^gallery_after_\d+$/.test(p.photo_type))
          .sort((a, b) => a.photo_type.localeCompare(b.photo_type))
          .map((p) => ({ id: p.id, url: p.file_url }));
        const savedPairs = (
          (sessionData.galeria_antes_depois as { pairs?: Array<{ caption?: string }> } | undefined)?.pairs ?? []
        ) as Array<{ caption?: string }>;
        const pairCount = Math.min(beforeImages.length, afterImages.length);
        const hydratedGallery: BeforeAfterGalleryValue = {
          beforeImages,
          afterImages,
          pairs: Array.from({ length: pairCount }).map((_, idx) => ({
            id: `pair-${beforeImages[idx]?.id ?? idx}-${afterImages[idx]?.id ?? idx}`,
            beforeImageId: beforeImages[idx]?.id ?? '',
            afterImageId: afterImages[idx]?.id ?? '',
            caption: typeof savedPairs[idx]?.caption === 'string' ? savedPairs[idx].caption ?? '' : '',
          })),
        };
        const explicitSlug = focusProcedureSlug || ((inst as { procedures?: { slug?: string } | null })?.procedures?.slug ?? '');
        if (explicitSlug && (beforeImages.length || afterImages.length || hydratedGallery.pairs.length)) {
          setComparisonGalleryBySlug((prev) => ({ ...prev, [explicitSlug]: hydratedGallery }));
        }
        if (String(sessionData.depois_frente ?? '').trim()) setEmagrecimentoDepoisFrente(String(sessionData.depois_frente ?? ''));
        if (String(sessionData.depois_lado ?? '').trim()) setEmagrecimentoDepoisLado(String(sessionData.depois_lado ?? ''));
        if (String(sessionData.depois_costas ?? '').trim()) setEmagrecimentoDepoisCostas(String(sessionData.depois_costas ?? ''));
        photos.forEach((p) => {
          if (p.photo_type === 'depois_frente') setEmagrecimentoDepoisFrente(p.file_url);
          if (p.photo_type === 'depois_lado') setEmagrecimentoDepoisLado(p.file_url);
          if (p.photo_type === 'depois_costas') setEmagrecimentoDepoisCostas(p.file_url);
        });

        if (psId) {
          const { data: signatures } = await supabase
            .from('term_signatures')
            .select('signature_data, professional_signature_data, term_id, terms(slug)')
            .eq('patient_session_id', psId);
          const loadedTerms: Record<string, string> = {};
          let loadedProfessional = '';
          (signatures ?? []).forEach((row: any) => {
            const slug = row?.terms?.slug as string | undefined;
            const sig = row?.signature_data as string | undefined;
            if (slug && sig) loadedTerms[slug] = sig;
            if (!loadedProfessional && typeof row?.professional_signature_data === 'string' && row.professional_signature_data) {
              loadedProfessional = row.professional_signature_data;
            }
          });
          if (Object.keys(loadedTerms).length > 0) setSignedTerms((prev) => ({ ...loadedTerms, ...prev }));
          if (loadedProfessional) setSignedProfessionalSignature((prev) => prev || loadedProfessional);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setEditHydrated(true);
      }
    })();
  }, [isEditingExistingSession, editSessionId, editInstanceId, patientId, profile?.id, editHydrated]);

  /** Persiste rascunho da sessão antes de abrir a câmera (restaurar se o Android matar o processo) */
  const saveConsultationDraft = useCallback(() => {
    if (!patientId || typeof sessionStorage === 'undefined') return;
    try {
      const draft = {
        patientId,
        savedAt: Date.now(),
        sessionDate,
        sessionTime,
        selectedProcedureIds: Array.from(selectedProcedureIds),
        observacoes,
        genericProcedureData,
        procedureValores,
        consultaValores,
        botoxPoints,
        botoxProdutoUtilizado,
        botoxRegiaoTratada,
        botoxQuantidadePorPonto,
        botoxQuantidadeUnidade,
        botoxDataAplicacao,
        botoxLote,
        botoxMarcaToxina,
        botoxDataValidade,
        botoxNumeroPontos,
        botoxDiluicao,
        botoxObservacoes,
        emagrecimentoPesoAtual,
        emagrecimentoAlturaCm,
        emagrecimentoAbdomenSuperior,
        emagrecimentoCintura,
        emagrecimentoAbdomenInferior,
        emagrecimentoBraco,
        emagrecimentoBusto,
        emagrecimentoQuadril,
        emagrecimentoInjetavel,
        emagrecimentoProdutoUsado,
        emagrecimentoMg,
        botoxFotoAntes,
        botoxFotoDepois,
        botoxPhotosPorRegiao,
        emagrecimentoDepoisFrente,
        emagrecimentoDepoisLado,
        emagrecimentoDepoisCostas,
        comparisonGalleryBySlug,
        salonSessionPhotos: isSalonProcedureMode ? salonSessionPhotos : undefined,
        selectedSalonProcedureIds: isSalonProcedureMode
          ? Array.from(selectedSalonProcedureIds)
          : undefined,
      };
      sessionStorage.setItem(CONSULTATION_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignorar falha de quota ou parse
    }
  }, [
    patientId,
    selectedProcedureIds,
    sessionDate,
    sessionTime,
    observacoes,
    genericProcedureData,
    procedureValores,
    consultaValores,
    botoxPoints,
    botoxProdutoUtilizado,
    botoxRegiaoTratada,
    botoxQuantidadePorPonto,
    botoxQuantidadeUnidade,
    botoxDataAplicacao,
    botoxLote,
    botoxMarcaToxina,
    botoxDataValidade,
    botoxNumeroPontos,
    botoxDiluicao,
    botoxObservacoes,
    emagrecimentoPesoAtual,
    emagrecimentoAlturaCm,
    emagrecimentoAbdomenSuperior,
    emagrecimentoCintura,
    emagrecimentoAbdomenInferior,
    emagrecimentoBraco,
    emagrecimentoBusto,
    emagrecimentoQuadril,
    emagrecimentoInjetavel,
    emagrecimentoProdutoUsado,
    emagrecimentoMg,
    botoxFotoAntes,
    botoxFotoDepois,
    botoxPhotosPorRegiao,
    emagrecimentoDepoisFrente,
    emagrecimentoDepoisLado,
    emagrecimentoDepoisCostas,
    comparisonGalleryBySlug,
    isSalonProcedureMode,
    salonSessionPhotos,
    selectedSalonProcedureIds,
  ]);

  /** Antes de abrir a câmera: persiste rascunho e esconde todas as prévias para liberar RAM (câmera traseira) */
  const handleBeforeCameraOpen = useCallback(() => {
    saveConsultationDraft();
    setCameraOpening(true);
  }, [saveConsultationDraft]);

  /** Quando a câmera fecha: restaura exibição das prévias */
  const handleCameraClose = useCallback(() => {
    setCameraOpening(false);
  }, []);

  /** Restaura rascunho se o app foi morto ao voltar da câmera */
  useEffect(() => {
    if (!patientId || typeof sessionStorage === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(CONSULTATION_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        patientId: string;
        savedAt: number;
        sessionDate?: string;
        sessionTime?: string;
        selectedProcedureIds: string[];
        observacoes?: string;
        genericProcedureData: Record<string, Record<string, unknown>>;
        procedureValores?: Record<
          string,
          { valor: string; forma_pagamento: FormaPagamento; parcelas?: number; price_tier?: ClinicPriceTier }
        >;
        consultaValores?: { valor: string; forma_pagamento: FormaPagamento; parcelas?: number };
        botoxPoints?: FacialPoint[];
        botoxProdutoUtilizado?: string;
        botoxRegiaoTratada?: string[];
        botoxQuantidadePorPonto?: Record<string, string>;
        botoxQuantidadeUnidade?: string;
        botoxDataAplicacao?: string;
        botoxLote?: string;
        botoxMarcaToxina?: string;
        botoxDataValidade?: string;
        botoxNumeroPontos?: string;
        botoxDiluicao?: string;
        botoxObservacoes?: string;
        emagrecimentoPesoAtual?: string;
        emagrecimentoAlturaCm?: string;
        emagrecimentoAbdomenSuperior?: string;
        emagrecimentoCintura?: string;
        emagrecimentoAbdomenInferior?: string;
        emagrecimentoBraco?: string;
        emagrecimentoBusto?: string;
        emagrecimentoQuadril?: string;
        emagrecimentoInjetavel?: string;
        emagrecimentoProdutoUsado?: string;
        emagrecimentoMg?: string;
        botoxFotoAntes: string | null;
        botoxFotoDepois: string | null;
        botoxPhotosPorRegiao?: Record<string, { antes: string | null; depois: string | null }>;
        emagrecimentoDepoisFrente: string;
        emagrecimentoDepoisLado: string;
        emagrecimentoDepoisCostas: string;
        comparisonGalleryBySlug?: Record<string, BeforeAfterGalleryValue>;
        salonSessionPhotos?: string[];
        selectedSalonProcedureIds?: string[];
      };
      if (draft.patientId !== patientId) return;
      if (Date.now() - draft.savedAt > CONSULTATION_DRAFT_MAX_AGE_MS) {
        sessionStorage.removeItem(CONSULTATION_DRAFT_KEY);
        return;
      }
      if (typeof draft.sessionDate === 'string' && draft.sessionDate) setSessionDate(draft.sessionDate);
      if (typeof draft.sessionTime === 'string') setSessionTime(draft.sessionTime);
      setSelectedProcedureIds(new Set(draft.selectedProcedureIds ?? []));
      if (typeof draft.observacoes === 'string') setObservacoes(draft.observacoes);
      if (draft.genericProcedureData) setGenericProcedureData(draft.genericProcedureData);
      if (draft.procedureValores && typeof draft.procedureValores === 'object') setProcedureValores(draft.procedureValores);
      if (draft.consultaValores && typeof draft.consultaValores === 'object') setConsultaValores(draft.consultaValores);
      if (Array.isArray(draft.botoxPoints)) setBotoxPoints(draft.botoxPoints);
      if (typeof draft.botoxProdutoUtilizado === 'string') setBotoxProdutoUtilizado(draft.botoxProdutoUtilizado);
      if (Array.isArray(draft.botoxRegiaoTratada)) setBotoxRegiaoTratada(draft.botoxRegiaoTratada);
      if (draft.botoxQuantidadePorPonto && typeof draft.botoxQuantidadePorPonto === 'object')
        setBotoxQuantidadePorPonto(draft.botoxQuantidadePorPonto);
      if (typeof draft.botoxQuantidadeUnidade === 'string') setBotoxQuantidadeUnidade(draft.botoxQuantidadeUnidade);
      if (typeof draft.botoxDataAplicacao === 'string') setBotoxDataAplicacao(draft.botoxDataAplicacao);
      if (typeof draft.botoxLote === 'string') setBotoxLote(draft.botoxLote);
      if (typeof draft.botoxMarcaToxina === 'string') setBotoxMarcaToxina(draft.botoxMarcaToxina);
      if (typeof draft.botoxDataValidade === 'string') setBotoxDataValidade(draft.botoxDataValidade);
      if (typeof draft.botoxNumeroPontos === 'string') setBotoxNumeroPontos(draft.botoxNumeroPontos);
      if (typeof draft.botoxDiluicao === 'string') setBotoxDiluicao(draft.botoxDiluicao);
      if (typeof draft.botoxObservacoes === 'string') setBotoxObservacoes(draft.botoxObservacoes);
      if (typeof draft.emagrecimentoPesoAtual === 'string') setEmagrecimentoPesoAtual(draft.emagrecimentoPesoAtual);
      if (typeof draft.emagrecimentoAlturaCm === 'string') setEmagrecimentoAlturaCm(draft.emagrecimentoAlturaCm);
      if (typeof draft.emagrecimentoAbdomenSuperior === 'string') setEmagrecimentoAbdomenSuperior(draft.emagrecimentoAbdomenSuperior);
      if (typeof draft.emagrecimentoCintura === 'string') setEmagrecimentoCintura(draft.emagrecimentoCintura);
      if (typeof draft.emagrecimentoAbdomenInferior === 'string') setEmagrecimentoAbdomenInferior(draft.emagrecimentoAbdomenInferior);
      if (typeof draft.emagrecimentoBraco === 'string') setEmagrecimentoBraco(draft.emagrecimentoBraco);
      if (typeof draft.emagrecimentoBusto === 'string') setEmagrecimentoBusto(draft.emagrecimentoBusto);
      if (typeof draft.emagrecimentoQuadril === 'string') setEmagrecimentoQuadril(draft.emagrecimentoQuadril);
      if (typeof draft.emagrecimentoInjetavel === 'string') setEmagrecimentoInjetavel(draft.emagrecimentoInjetavel);
      if (typeof draft.emagrecimentoProdutoUsado === 'string') setEmagrecimentoProdutoUsado(draft.emagrecimentoProdutoUsado);
      if (typeof draft.emagrecimentoMg === 'string') setEmagrecimentoMg(draft.emagrecimentoMg);
      if (draft.botoxFotoAntes != null) setBotoxFotoAntes(draft.botoxFotoAntes);
      if (draft.botoxFotoDepois != null) setBotoxFotoDepois(draft.botoxFotoDepois);
      if (draft.botoxPhotosPorRegiao && typeof draft.botoxPhotosPorRegiao === 'object')
        setBotoxPhotosPorRegiao(draft.botoxPhotosPorRegiao);
      if (draft.emagrecimentoDepoisFrente != null) setEmagrecimentoDepoisFrente(draft.emagrecimentoDepoisFrente);
      if (draft.emagrecimentoDepoisLado != null) setEmagrecimentoDepoisLado(draft.emagrecimentoDepoisLado);
      if (draft.emagrecimentoDepoisCostas != null) setEmagrecimentoDepoisCostas(draft.emagrecimentoDepoisCostas);
      if (draft.comparisonGalleryBySlug && typeof draft.comparisonGalleryBySlug === 'object') {
        setComparisonGalleryBySlug(draft.comparisonGalleryBySlug);
      }
      if (Array.isArray(draft.salonSessionPhotos)) {
        setSalonSessionPhotos(draft.salonSessionPhotos.filter((u): u is string => typeof u === 'string'));
      }
      if (Array.isArray(draft.selectedSalonProcedureIds)) {
        setSelectedSalonProcedureIds(new Set(draft.selectedSalonProcedureIds));
      }
      sessionStorage.removeItem(CONSULTATION_DRAFT_KEY);
      toast.success('Rascunho da sessão restaurado.');
    } catch {
      sessionStorage.removeItem(CONSULTATION_DRAFT_KEY);
    }
    return () => {
      try {
        sessionStorage.removeItem(CONSULTATION_DRAFT_KEY);
      } catch {}
    };
  }, [patientId]);

  /** Recarrega procedure_fields + configurações por profissional para os procedimentos selecionados. */
  const loadProcedureFieldsForSelection = useCallback(async (showToast = false) => {
    const professionalId = profile?.id;

    // Configuração global da tela por profissional (não vinculada a slug/procedimento)
    if (professionalId) {
      const uiRow = await (supabase as any)
        .from('professional_ui_settings')
        .select('show_session_photos, show_before_after_gallery, show_next_evaluation_section, agenda_open_mode')
        .eq('professional_id', professionalId)
        .maybeSingle();
      const globalShowSessionPhotos = uiRow?.data?.show_session_photos;
      setShowSessionPhotos(globalShowSessionPhotos !== false);
      setShowBeforeAfterGallery(uiRow?.data?.show_before_after_gallery !== false);
      setShowNextEvaluationSection(uiRow?.data?.show_next_evaluation_section !== false);
      setAgendaOpenMode(normalizeAgendaOpenMode(uiRow?.data?.agenda_open_mode));
      const closedRes = await (supabase as any)
        .from('professional_clinic_closed_days')
        .select('closed_date')
        .eq('professional_id', professionalId);
      if (!closedRes.error) {
        setClinicClosedDates(
          ((closedRes.data ?? []) as Array<{ closed_date: string }>).map((row) => String(row.closed_date))
        );
      }
    }

    const selectedSlugsWithSettings = selectedSlugs;
    if (selectedSlugsWithSettings.length === 0) {
      setProcedureFieldsBySlug({});
      if (showToast) toast.success('Campos atualizados.');
      return;
    }
    const procIds = selectedSlugsWithSettings
      .map((slug) => procedures.find((p) => p.slug === slug)?.id)
      .filter(Boolean) as string[];
    if (procIds.length === 0) {
      if (showToast) toast.success('Campos atualizados.');
      return;
    }
    try {
      const { data: fieldsData } = await supabase
        .from('procedure_fields')
        .select('*')
        .in('procedure_id', procIds)
        .order('sort_order');

      const settingsRows = professionalId
        ? await (supabase as any)
            .from('professional_procedure_field_settings')
            .select('procedure_field_id, is_active, is_required, sort_order')
            .eq('professional_id', professionalId)
            .in('procedure_id', procIds)
        : { data: [] as any[] };

      const settingsData = (settingsRows?.data ?? []) as Array<{
        procedure_field_id: string;
        is_active: boolean;
        is_required: boolean;
        sort_order: number;
      }>;

      const byProcedureId = new Map<string, ProcedureFieldRow[]>();
      (fieldsData ?? []).forEach((row) => {
        const r = row as ProcedureFieldRow;
        const list = byProcedureId.get(r.procedure_id) ?? [];
        list.push(r);
        byProcedureId.set(r.procedure_id, list);
      });

      const settingsByFieldId = new Map<string, typeof settingsData[number]>();
      for (const s of settingsData) {
        settingsByFieldId.set(String(s.procedure_field_id), s);
      }

      const bySlug: Record<string, Array<ProcedureFieldRow & { isRequired?: boolean }>> = {};
      procedures.forEach((p) => {
        const list = byProcedureId.get(p.id);
        if (!list?.length) return;

        const enriched = list
          .map((f) => {
            const cfg = settingsByFieldId.get(String(f.id));
            const isActive = cfg?.is_active ?? true;
            const isRequired = cfg?.is_required ?? false;
            const configSortOrder = cfg?.sort_order ?? f.sort_order;
            return { ...f, isRequired, isActive, configSortOrder };
          })
          .filter((f) => (f as any).isActive !== false)
          .sort((a, b) => (a as any).configSortOrder - (b as any).configSortOrder);

        bySlug[p.slug] = enriched;
      });

      setProcedureFieldsBySlug(bySlug);
      if (showToast) toast.success('Campos atualizados.');
    } catch (e) {
      console.error(e);
      if (showToast) toast.error('Erro ao atualizar campos.');
    }
  }, [selectedSlugs, procedures, profile?.id, selectedProcedureIds]);

  /** Carrega procedure_fields dos procedimentos selecionados (inclui Botox para aplicar permissões em blocos fixos). */
  useEffect(() => {
    loadProcedureFieldsForSelection(false);
  }, [loadProcedureFieldsForSelection]);

  useEffect(() => {
    if (requiredTermSlugs.length === 0) {
      setTerms([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('terms')
        .select('id, slug, version, title, body')
        .in('slug', requiredTermSlugs)
        .eq('active', true)
        .order('version', { ascending: false });
      const bySlug = new Map<string, Term>();
      (data ?? []).forEach((t) => {
        const row = t as Term;
        if (!bySlug.has(row.slug)) bySlug.set(row.slug, row);
      });
      setTerms(Array.from(bySlug.values()));
    })();
  }, [requiredTermSlugs.join(',')]);

  useEffect(() => {
    if (!agendaPopupOpen || !targetAgendaDate || !profile?.id) return;
    if (agendaOpenMode !== 'dia') return;
    setLoadingAgendaDay(true);
    const dateStr = format(targetAgendaDate, 'yyyy-MM-dd');
    (async () => {
      try {
        const { data } = await supabase
          .from('appointments')
          .select('appointment_date, start_time')
          .eq('professional_id', profile.id)
          .eq('appointment_date', dateStr);
        setAgendaDayAppointments((data as Array<{ appointment_date: string; start_time: string }>) ?? []);
      } finally {
        setLoadingAgendaDay(false);
      }
    })();
  }, [agendaPopupOpen, targetAgendaDate, profile?.id, agendaOpenMode]);

  const openAgendaPopupFromSessionDate = (prazoDias: string) => {
    const days = parseInt(prazoDias, 10);
    if (!Number.isFinite(days) || days < 1) {
      toast.error('Informe o prazo em dias para ver os horários disponíveis.');
      return;
    }
    const targetDate = addDays(parseLocalDate(sessionDate), days);
    setTargetAgendaDate(targetDate);
    setAgendaPopupOpen(true);
    setConfirmSlotTime(null);
  };

  const handleMeLembrarBotox = async () => {
    if (!profile?.id || !patientId || !instanceId) return;
    const days = parseInt(botoxPrazoDias, 10);
    if (!Number.isFinite(days) || days < 1) {
      toast.error('Informe o prazo em dias para criar o lembrete.');
      return;
    }
    const dueDate = addDays(parseLocalDate(sessionDate), days);
    const dueDateStr = format(dueDate, 'yyyy-MM-dd');
    setSavingBotoxReminder(true);
    try {
      const { error } = await supabase.from('botox_reapplication_reminders').insert({
        patient_id: patientId,
        procedure_instance_id: instanceId,
        procedure_session_id: null,
        professional_id: profile.id,
        due_date: dueDateStr,
      });
      if (error) throw error;
      toast.success('Lembrete criado. Vamos te avisar 7 dias antes do vencimento.');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao criar lembrete.');
    } finally {
      setSavingBotoxReminder(false);
    }
  };

  const confirmConsultationAt = async (date: Date, slotTime: string) => {
    if (!profile?.id || !patientId) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    const timeStr = slotTime.length === 5 ? slotTime : `${slotTime.slice(0, 5)}:00`;
    setSavingAppointment(true);
    const { error } = await supabase
      .from('appointments')
      .insert({
        professional_id: profile.id,
        patient_id: patientId,
        appointment_date: dateStr,
        start_time: timeStr,
        notes: null,
      })
      .select('id')
      .single();
    setSavingAppointment(false);
    if (error) {
      if ((error as { code?: string }).code === '23505') toast.error('Este horário já está ocupado.');
      else toast.error('Erro ao agendar.');
      return;
    }
    setConfirmSlotTime(null);
    setAgendaPopupOpen(false);
    setTargetAgendaDate(null);
    toast.success('Consulta agendada.');
  };

  const handleConfirmConsultationAppointment = async () => {
    if (!targetAgendaDate || !confirmSlotTime) return;
    await confirmConsultationAt(targetAgendaDate, confirmSlotTime);
  };

  const toggleSalonProcedure = (id: string) => {
    setSelectedSalonProcedureIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleProcedure = (id: string) => {
    if (isFocusedProcedureOnly && focusProcedureSlug) {
      const focusedProc = procedures.find((p) => p.slug === focusProcedureSlug);
      if (!focusedProc || id !== focusedProc.id) {
        toast.message(
          isBotoxOnlyConsultation
            ? 'Este atendimento é apenas para Botox.'
            : 'Este atendimento é apenas para o procedimento selecionado.'
        );
        return;
      }
      if (selectedProcedureIds.has(id) && selectedProcedureIds.size <= 1) return;
    }
    const isAdding = !selectedProcedureIds.has(id);
    setSelectedProcedureIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (isAdding) {
      setExpandedGenericProcedureId(id);
      const botoxProc = procedures.find((p) => p.slug === 'botox');
      const emagrecimentoProc = procedures.find((p) => p.slug === 'emagrecimento-reducao-medidas');
      if (botoxProc?.id === id) setExpandedBotox(true);
      if (emagrecimentoProc?.id === id) setExpandedEmagrecimento(true);
      if (isClinicAccount) {
        const suggested = getPriceInput(id, DEFAULT_CLINIC_PRICE_TIER);
        setProcedureValores((prev) => ({
          ...prev,
          [id]: {
            valor: suggested || prev[id]?.valor || '',
            forma_pagamento: prev[id]?.forma_pagamento ?? ('pix' as FormaPagamento),
            parcelas: prev[id]?.parcelas ?? 1,
            price_tier: DEFAULT_CLINIC_PRICE_TIER,
          },
        }));
      }
    }
  };

  const getProcedureValor = (procedureId: string) =>
    procedureValores[procedureId] ?? {
      valor: '',
      forma_pagamento: 'pix' as FormaPagamento,
      parcelas: 1,
      price_tier: isClinicAccount ? DEFAULT_CLINIC_PRICE_TIER : undefined,
    };

  const setProcedureValor = (procedureId: string, valor: string, forma_pagamento?: FormaPagamento) => {
    setProcedureValores((prev) => {
      const cur = prev[procedureId] ?? {
        valor: '',
        forma_pagamento: 'pix' as FormaPagamento,
        parcelas: 1,
        price_tier: isClinicAccount ? DEFAULT_CLINIC_PRICE_TIER : undefined,
      };
      const nextForma = forma_pagamento ?? cur.forma_pagamento;
      return {
        ...prev,
        [procedureId]: {
          valor: valor ?? cur.valor,
          forma_pagamento: nextForma,
          parcelas: nextForma === 'cartao' ? (cur.parcelas ?? 1) : undefined,
          price_tier: cur.price_tier,
        },
      };
    });
  };

  const setProcedurePriceTier = (procedureId: string, tier: ClinicPriceTier) => {
    const suggested = getPriceInput(procedureId, tier);
    setProcedureValores((prev) => {
      const cur = prev[procedureId] ?? {
        valor: '',
        forma_pagamento: 'pix' as FormaPagamento,
        parcelas: 1,
      };
      return {
        ...prev,
        [procedureId]: {
          ...cur,
          price_tier: tier,
          valor: suggested || cur.valor,
        },
      };
    });
  };

  const setProcedureParcelas = (procedureId: string, parcelas: number) => {
    setProcedureValores((prev) => {
      const cur = prev[procedureId] ?? {
        valor: '',
        forma_pagamento: 'pix' as FormaPagamento,
        parcelas: 1,
        price_tier: isClinicAccount ? DEFAULT_CLINIC_PRICE_TIER : undefined,
      };
      return { ...prev, [procedureId]: { ...cur, parcelas } };
    });
  };

  /** Card Valores (valor R$ + forma de pagamento) reutilizável — usar abaixo do conteúdo de cada procedimento */
  const renderValoresBlock = (procedureId: string, className?: string) => {
    const val = getProcedureValor(procedureId);
    return (
      <div className={className ?? 'mt-4'}>
        <div className="rounded-lg border border-border bg-muted/10 overflow-hidden">
          <div className="flex flex-col space-y-1.5 p-3 sm:p-4 border-b border-border bg-muted/30 pb-3">
            <h3 className="sm:text-xl flex items-center gap-2 text-base font-semibold tracking-tight">
              <Wallet className="w-5 h-5 text-primary" />
              Valores
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Valor cobrado e forma de pagamento deste procedimento.
            </p>
          </div>
          <div className="sm:p-4 p-4 pt-3">
            <div className="flex flex-wrap items-end gap-3">
              {isClinicAccount ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tipo de preço</Label>
                  <Select
                    value={val.price_tier || DEFAULT_CLINIC_PRICE_TIER}
                    onValueChange={(v) => setProcedurePriceTier(procedureId, v as ClinicPriceTier)}
                  >
                    <SelectTrigger className="w-[140px] h-9 rounded-xl">
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
              ) : null}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Valor (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={val.valor}
                  onChange={(e) => setProcedureValor(procedureId, e.target.value)}
                  className="w-28 h-9 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Forma de pagamento</Label>
                <Select
                  value={val.forma_pagamento}
                  onValueChange={(v) => setProcedureValor(procedureId, val.valor, v as FormaPagamento)}
                >
                  <SelectTrigger className="w-[130px] h-9 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FORMA_PAGAMENTO_LABEL) as FormaPagamento[]).map((fp) => (
                      <SelectItem key={fp} value={fp}>
                        {FORMA_PAGAMENTO_LABEL[fp]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {val.forma_pagamento === 'cartao' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Parcelas</Label>
                  <Select
                    value={String(val.parcelas ?? 1)}
                    onValueChange={(v) => setProcedureParcelas(procedureId, Number(v))}
                  >
                    <SelectTrigger className="w-[100px] h-9 rounded-xl">
                      <SelectValue placeholder="Parcelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n === 1 ? '1x (à vista)' : `${n}x`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const setConsultaValor = (valor: string, forma_pagamento?: FormaPagamento) => {
    setConsultaValores((prev) => {
      const nextForma = forma_pagamento ?? prev.forma_pagamento;
      return {
        valor: valor ?? prev.valor,
        forma_pagamento: nextForma,
        parcelas: nextForma === 'cartao' ? (prev.parcelas ?? 1) : undefined,
      };
    });
  };

  const setConsultaParcelas = (parcelas: number) => setConsultaValores((prev) => ({ ...prev, parcelas }));

  const renderConsultaValoresBlock = (className?: string) => {
    const val = consultaValores;
    return (
      <div className={className ?? 'mt-4'}>
        <div className="rounded-lg border border-border bg-muted/10 overflow-hidden">
          <div className="flex flex-col space-y-1.5 p-3 sm:p-4 border-b border-border bg-muted/30 pb-3">
            <h3 className="sm:text-xl flex items-center gap-2 text-base font-semibold tracking-tight">
              <Wallet className="w-5 h-5 text-primary" />
              Valor da consulta
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Valor total cobrado neste atendimento (com múltiplos procedimentos).
            </p>
          </div>
          <div className="sm:p-4 p-4 pt-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Valor (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={val.valor}
                  onChange={(e) => setConsultaValor(e.target.value)}
                  className="w-28 h-9 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Forma de pagamento</Label>
                <Select value={val.forma_pagamento} onValueChange={(v) => setConsultaValor(val.valor, v as FormaPagamento)}>
                  <SelectTrigger className="w-[130px] h-9 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FORMA_PAGAMENTO_LABEL) as FormaPagamento[]).map((fp) => (
                      <SelectItem key={fp} value={fp}>
                        {FORMA_PAGAMENTO_LABEL[fp]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {val.forma_pagamento === 'cartao' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Parcelas</Label>
                  <Select value={String(val.parcelas ?? 1)} onValueChange={(v) => setConsultaParcelas(Number(v))}>
                    <SelectTrigger className="w-[100px] h-9 rounded-xl">
                      <SelectValue placeholder="Parcelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n === 1 ? '1x (à vista)' : `${n}x`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleSignTerm = (termSlug: string, dataUrl: string) => {
    setSignedTerms((prev) => ({ ...prev, [termSlug]: dataUrl }));
    toast.success('Assinatura registrada para este termo.');
  };

  const allRequiredTermsSigned = requiredTermSlugs.length === 0 || requiredTermSlugs.every((slug) => signedTerms[slug]);

  const handleFinalize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !profile?.id) return;
    if (isSalonProcedureMode) {
      if (selectedSalonProcedureIds.size === 0) {
        toast.error('Marque ao menos um procedimento realizado.');
        return;
      }
    } else if (selectedProcedureIds.size === 0) {
      toast.error('Marque ao menos um procedimento realizado.');
      return;
    }
    if (!isSalonProcedureMode && !allRequiredTermsSigned) {
      toast.error('Assine todos os termos obrigatórios dos procedimentos selecionados.');
      return;
    }

    // Validação centralizada: campos dinâmicos obrigatórios (por profissional).
    // Se um campo estiver inativo, ele não aparece e não entra na validação.
    if (!isSalonProcedureMode) {
    for (const slug of selectedSlugs) {
      const fields = procedureFieldsBySlug[slug] ?? [];
      if (fields.length === 0) continue;

      const fieldsForValidation =
        slug === 'preenchimento-facial'
          ? fields.filter((f) => !isPreenchimentoRepeatableFieldKey(f.field_key))
          : slug === LIPOENZIMATICA_SLUG
            ? fields.filter((f) => !isLipoenzimaticaHiddenFieldKey(f.field_key))
            : isNewCustomProcedureSlug(slug)
              ? fields.filter((f) => !isNewCustomHiddenFieldKey(slug, f.field_key))
              : fields;
      const { valid, errors } = validateRequiredProcedureFields(
        fieldsForValidation as any,
        genericProcedureData[slug] ?? {},
        { sessionDate }
      );

      if (!valid) {
        const firstError = Object.values(errors)[0];
        toast.error(firstError ?? 'Preencha os campos obrigatórios.');
        return;
      }

      if (slug === LIPOENZIMATICA_SLUG) {
        const lipoError = validateLipoenzimaticaSessionData(genericProcedureData[slug] ?? {});
        if (lipoError) {
          toast.error(lipoError);
          return;
        }
      }

      if (isNewCustomProcedureSlug(slug)) {
        const customError = validateNewCustomSessionData(slug, genericProcedureData[slug] ?? {});
        if (customError) {
          toast.error(customError);
          return;
        }
      }
    }
    }

    setSaving(true);
    try {
      const startTime = sessionTime && sessionTime.length >= 5 ? `${sessionTime.slice(0, 5)}:00` : null;

      if (isSalonProcedureMode) {
        const selected = salonProcedures.filter((p) => selectedSalonProcedureIds.has(p.id));
        const procLines = selected.map((p) => `Procedimento: ${p.name}`);
        const idLines = selected.map((p) => `${SALON_PROCEDURE_ID_PREFIX}${p.id}`);
        const valorTotal = parseMoneyInput(consultaValores.valor);
        const valorLine =
          valorTotal > 0
            ? `Valor: R$ ${valorTotal.toFixed(2).replace('.', ',')} (${consultaValores.forma_pagamento})`
            : '';
        const observacoesPayload = [
          ...procLines,
          ...idLines,
          observacoes.trim(),
          valorLine,
        ]
          .filter(Boolean)
          .join('\n');

        let sessionProfessionalId = profile.id;
        if (linkedAppointmentId) {
          const { data: linkedApt } = await supabase
            .from('appointments')
            .select('professional_id')
            .eq('id', linkedAppointmentId)
            .maybeSingle();
          if (linkedApt?.professional_id) {
            sessionProfessionalId = linkedApt.professional_id;
          }
        }

        const { data: psRow, error: psError } = await supabase
          .from('patient_sessions')
          .insert({
            patient_id: patientId,
            professional_id: sessionProfessionalId,
            session_date: sessionDate,
            start_time: startTime,
            observacoes: observacoesPayload || null,
          })
          .select('id')
          .single();
        if (psError) throw psError;

        if (salonSessionPhotos.length > 0 && psRow?.id) {
          const { error: photosError } = await supabase.from('patient_session_photos').insert(
            salonSessionPhotos.map((file_url, sort_order) => ({
              patient_session_id: psRow.id,
              file_url,
              sort_order,
            }))
          );
          if (photosError) throw photosError;
        }

        if (valorTotal > 0 && psRow?.id && selected.length > 0) {
          const branchIdForBilling = await resolveBranchIdForInsert(profile);
          const { error: recError } = await insertSalonRecebimentosForSession({
            patientSessionId: psRow.id,
            patientId,
            professionalId: sessionProfessionalId,
            sessionDate,
            sessionTime,
            salonProcedureIds: selected.map((p) => p.id),
            valorTotal,
            formaPagamento: consultaValores.forma_pagamento,
            parcelas: consultaValores.parcelas,
            branchId: branchIdForBilling,
          });
          if (recError) throw recError;
        }

        toast.success('Atendimento finalizado com sucesso.');
        navigate(returnTo || `/patients/${patientId}`);
        return;
      }

      if (isEditingExistingSession && editSessionId) {
        if (selectedProcedureIds.size !== 1) {
          throw new Error('A edição da sessão exige exatamente um procedimento selecionado.');
        }
        const selectedProcedureId = Array.from(selectedProcedureIds)[0];
        const proc = procedures.find((p) => p.id === selectedProcedureId);
        if (!proc) throw new Error('Procedimento da sessão não encontrado.');
        const comparisonGallery = comparisonGalleryBySlug[proc.slug];
        const resolvedInstanceId = editInstanceId || '';

        const { data: existingSessionRef, error: existingSessionRefErr } = await supabase
          .from('procedure_sessions')
          .select('patient_session_id, procedure_instance_id')
          .eq('id', editSessionId)
          .single();
        if (existingSessionRefErr) throw existingSessionRefErr;
        const linkedPatientSessionId = existingSessionRef?.patient_session_id ?? null;
        const instanceId = resolvedInstanceId || existingSessionRef?.procedure_instance_id || null;
        if (!instanceId) throw new Error('Instância da sessão não encontrada.');

        if (linkedPatientSessionId) {
          const { error: psUpdateErr } = await supabase
            .from('patient_sessions')
            .update({
              session_date: sessionDate,
              start_time: startTime,
              observacoes: observacoes.trim() || null,
            })
            .eq('id', linkedPatientSessionId);
          if (psUpdateErr) throw psUpdateErr;
        }

        if (linkedPatientSessionId) {
          await supabase.from('term_signatures').delete().eq('patient_session_id', linkedPatientSessionId);
          for (const termSlug of requiredTermSlugs) {
            const signatureData = signedTerms[termSlug];
            const term = terms.find((t) => t.slug === termSlug);
            if (!term || !signatureData) continue;
            await supabase.from('term_signatures').insert({
              patient_id: patientId,
              patient_session_id: linkedPatientSessionId,
              procedure_session_id: editSessionId,
              term_id: term.id,
              signature_data: signatureData,
              professional_signature_data: signedProfessionalSignature.trim() || null,
            });
          }
        }

        let sessionData: Json = {};
        if (proc.slug === 'botox') {
          sessionData = {
            ...(botoxPoints.length > 0 && { pontos_aplicacao: botoxPoints }),
            ...(botoxProdutoUtilizado.trim() && { produto_utilizado: botoxProdutoUtilizado.trim() }),
            ...(botoxRegiaoTratada.length > 0 && { regiao_tratada: botoxRegiaoTratada }),
            ...(Object.keys(botoxQuantidadePorPonto).length > 0 && { quantidade_por_ponto: botoxQuantidadePorPonto }),
            ...(botoxQuantidadeUnidade.trim()
              ? (() => {
                  const u = botoxQuantidadeUnidade.trim();
                  const n = Number(u);
                  return { quantidade_unidade: Number.isFinite(n) ? n : u };
                })()
              : {}),
            data_aplicacao: botoxDataAplicacao.trim() || sessionDate,
            ...(botoxLote.trim() && { lote: botoxLote.trim() }),
            ...(botoxMarcaToxina.trim() && { marca_toxina: botoxMarcaToxina.trim() }),
            ...(botoxDataValidade.trim() && { data_validade: botoxDataValidade.trim() }),
            ...(botoxNumeroPontos.trim() && { numero_pontos_aplicacao: botoxNumeroPontos.trim() }),
            ...(botoxDiluicao.trim() && { diluicao_utilizada: botoxDiluicao.trim() }),
            ...(botoxObservacoes.trim() && { observacoes_botox: botoxObservacoes.trim() }),
            ...(hasGalleryContent(comparisonGallery) && { galeria_antes_depois: galleryToSessionJson(comparisonGallery!) }),
          } as unknown as Json;
        } else if (proc.slug === 'emagrecimento-reducao-medidas') {
          const peso = emagrecimentoPesoAtual.trim() ? Number(emagrecimentoPesoAtual) : null;
          const altura = emagrecimentoAlturaCm.trim() ? Number(emagrecimentoAlturaCm) : null;
          const imc = calcImc(peso, altura);
          sessionData = {
            ...(peso != null && Number.isFinite(peso) && { peso_atual: peso }),
            ...(altura != null && Number.isFinite(altura) && { altura_cm: altura }),
            ...(imc != null && { imc }),
            ...(emagrecimentoAbdomenSuperior.trim() && Number.isFinite(Number(emagrecimentoAbdomenSuperior)) && { abdomen_superior_cm: Number(emagrecimentoAbdomenSuperior) }),
            ...(emagrecimentoCintura.trim() && Number.isFinite(Number(emagrecimentoCintura)) && { cintura_cm: Number(emagrecimentoCintura) }),
            ...(emagrecimentoAbdomenInferior.trim() && Number.isFinite(Number(emagrecimentoAbdomenInferior)) && { abdomen_inferior_cm: Number(emagrecimentoAbdomenInferior) }),
            ...(emagrecimentoBraco.trim() && Number.isFinite(Number(emagrecimentoBraco)) && { braco_cm: Number(emagrecimentoBraco) }),
            ...(emagrecimentoBusto.trim() && Number.isFinite(Number(emagrecimentoBusto)) && { busto_cm: Number(emagrecimentoBusto) }),
            ...(emagrecimentoQuadril.trim() && Number.isFinite(Number(emagrecimentoQuadril)) && { quadril_cm: Number(emagrecimentoQuadril) }),
            ...(emagrecimentoInjetavel && { injetavel: emagrecimentoInjetavel }),
            ...(emagrecimentoInjetavel === 'Sim' && emagrecimentoProdutoUsado.trim() && { produto_usado: emagrecimentoProdutoUsado.trim() }),
            ...(emagrecimentoInjetavel === 'Sim' && emagrecimentoMg.trim() && Number.isFinite(Number(emagrecimentoMg)) && { ml: Number(emagrecimentoMg) }),
            ...(hasGalleryContent(comparisonGallery) && { galeria_antes_depois: galleryToSessionJson(comparisonGallery!) }),
          } as Json;
        } else {
          const genericData = genericProcedureData[proc.slug];
          if (genericData && typeof genericData === 'object') {
            const payload =
              proc.slug === 'preenchimento-facial'
                ? serializePreenchimentoFacialSessionData(genericData as Record<string, unknown>)
                : proc.slug === LIPOENZIMATICA_SLUG
                  ? serializeLipoenzimaticaSessionData(genericData as Record<string, unknown>)
                  : isNewCustomProcedureSlug(proc.slug)
                    ? serializeNewCustomSessionData(proc.slug, genericData as Record<string, unknown>)
                    : genericData;
            sessionData = {
              ...payload,
              ...(hasGalleryContent(comparisonGallery) && { galeria_antes_depois: galleryToSessionJson(comparisonGallery!) }),
            } as Json;
          }
        }

        const editValor = getProcedureValor(selectedProcedureId);
        const valorTotal = parseMoneyInput(editValor.valor);
        if (valorTotal > 0) {
          const dataRecebimento = `${sessionDate}T${(sessionTime?.slice(0, 5) || '00:00')}:00`;
          const branchIdForBilling = await resolveBranchIdForInsert(profile);
          const branchBillingFields = branchIdForBilling ? { branch_id: branchIdForBilling } : {};
          const day = sessionDate;
          const dayStart = `${day}T00:00:00`;
          const dayEnd = `${day}T23:59:59`;
          let found: any = null;
          const { data: byDayRows } = await supabase
            .from('recebimentos')
            .select('*')
            .eq('cliente_id', patientId)
            .eq('profissional_id', profile.id)
            .eq('procedimento_id', selectedProcedureId)
            .gte('data', dayStart)
            .lte('data', dayEnd)
            .order('data', { ascending: false })
            .limit(50);
          const byDayList = (byDayRows ?? []) as Array<{ id: string }>;
          found = byDayList[0] ?? null;
          if (!found) {
            const { data: latestUntilDayRows } = await supabase
              .from('recebimentos')
              .select('*')
              .eq('cliente_id', patientId)
              .eq('profissional_id', profile.id)
              .eq('procedimento_id', selectedProcedureId)
              .lte('data', dayEnd)
              .order('data', { ascending: false })
              .limit(1);
            found = (latestUntilDayRows ?? [])[0] ?? null;
          }
          if (byDayList.length > 0) {
            await supabase
              .from('recebimentos')
              .update({
                valor_total: valorTotal,
                valor_recebido: valorTotal,
                forma_pagamento: editValor.forma_pagamento,
                parcelas: editValor.forma_pagamento === 'cartao' ? (editValor.parcelas ?? 1) : null,
                status: 'pago',
                data: dataRecebimento,
                ...(isClinicAccount && editValor.price_tier
                  ? { price_tier: editValor.price_tier }
                  : {}),
              })
              .in(
                'id',
                byDayList
                  .map((r) => r.id)
                  .filter((id): id is string => typeof id === 'string' && id.length > 0)
              );
          } else if (found?.id) {
            await supabase
              .from('recebimentos')
              .update({
                valor_total: valorTotal,
                valor_recebido: valorTotal,
                forma_pagamento: editValor.forma_pagamento,
                parcelas: editValor.forma_pagamento === 'cartao' ? (editValor.parcelas ?? 1) : null,
                status: 'pago',
                data: dataRecebimento,
                ...(isClinicAccount && editValor.price_tier
                  ? { price_tier: editValor.price_tier }
                  : {}),
              })
              .eq('id', found.id);
          } else {
            await supabase.from('recebimentos').insert({
              cliente_id: patientId,
              profissional_id: profile.id,
              procedimento_id: selectedProcedureId,
              valor_total: valorTotal,
              valor_recebido: valorTotal,
              forma_pagamento: editValor.forma_pagamento,
              parcelas: editValor.forma_pagamento === 'cartao' ? (editValor.parcelas ?? 1) : null,
              status: 'pago',
              data: dataRecebimento,
              ...(isClinicAccount && editValor.price_tier
                ? { price_tier: editValor.price_tier }
                : {}),
              ...branchBillingFields,
            });
          }
        }

        const { error: updateSessionErr } = await supabase
          .from('procedure_sessions')
          .update({
            session_date: sessionDate,
            data: sessionData,
            observacoes: observacoes.trim() || null,
          })
          .eq('id', editSessionId);
        if (updateSessionErr) throw updateSessionErr;

        await supabase.from('procedure_photos').delete().eq('procedure_session_id', editSessionId);

        if (proc.slug === 'botox') {
          await supabase.from('botox_reapplication_reminders').delete().eq('procedure_session_id', editSessionId);
          if (botoxReapplicationDue.trim()) {
            await supabase.from('botox_reapplication_reminders').insert({
              patient_id: patientId,
              procedure_instance_id: instanceId,
              procedure_session_id: editSessionId,
              professional_id: profile.id,
              due_date: botoxReapplicationDue.trim(),
            });
          }
          const entries: { photo_type: string; file_url: string }[] = [];
          if (botoxFotoAntes?.trim()) entries.push({ photo_type: 'antes', file_url: botoxFotoAntes.trim() });
          if (botoxFotoDepois?.trim()) entries.push({ photo_type: 'depois', file_url: botoxFotoDepois.trim() });
          BOTOX_REGIOES.forEach(({ key }) => {
            const pair = botoxPhotosPorRegiao[key];
            if (pair?.antes?.trim()) entries.push({ photo_type: `antes_${key}`, file_url: pair.antes.trim() });
            if (pair?.depois?.trim()) entries.push({ photo_type: `depois_${key}`, file_url: pair.depois.trim() });
          });
          if (comparisonGallery && hasGalleryContent(comparisonGallery)) entries.push(...galleryToPhotoEntries(comparisonGallery));
          if (entries.length) {
            await supabase.from('procedure_photos').insert(entries.map((p) => ({
              procedure_instance_id: instanceId,
              procedure_session_id: editSessionId,
              photo_type: p.photo_type,
              file_url: p.file_url,
            })));
          }
        } else if (proc.slug === 'emagrecimento-reducao-medidas') {
          const entries: { photo_type: string; file_url: string }[] = [];
          if (emagrecimentoDepoisFrente.trim()) entries.push({ photo_type: 'depois_frente', file_url: emagrecimentoDepoisFrente });
          if (emagrecimentoDepoisLado.trim()) entries.push({ photo_type: 'depois_lado', file_url: emagrecimentoDepoisLado });
          if (emagrecimentoDepoisCostas.trim()) entries.push({ photo_type: 'depois_costas', file_url: emagrecimentoDepoisCostas });
          if (comparisonGallery && hasGalleryContent(comparisonGallery)) entries.push(...galleryToPhotoEntries(comparisonGallery));
          if (entries.length) {
            await supabase.from('procedure_photos').insert(entries.map((p) => ({
              procedure_instance_id: instanceId,
              procedure_session_id: editSessionId,
              photo_type: p.photo_type,
              file_url: p.file_url,
            })));
          }
        } else {
          const fields = procedureFieldsBySlug[proc.slug] ?? [];
          const data = genericProcedureData[proc.slug];
          if (data && typeof data === 'object') {
            const entries: { photo_type: string; file_url: string }[] = [];
            fields.forEach((f) => {
              if (f.field_type !== 'image') return;
              const url = data[f.field_key];
              if (typeof url === 'string' && url.trim()) entries.push({ photo_type: f.field_key, file_url: url.trim() });
            });
            if (comparisonGallery && hasGalleryContent(comparisonGallery)) entries.push(...galleryToPhotoEntries(comparisonGallery));
            if (entries.length) {
              await supabase.from('procedure_photos').insert(entries.map((p) => ({
                procedure_instance_id: instanceId,
                procedure_session_id: editSessionId,
                photo_type: p.photo_type,
                file_url: p.file_url,
              })));
            }
          }
        }

        toast.success('Sessão atualizada com sucesso.');
        navigate(returnTo || `/procedures/${proc.slug}/${instanceId}`);
        return;
      }
      const { data: patientSession, error: psError } = await supabase
        .from('patient_sessions')
        .insert({
          patient_id: patientId,
          professional_id: profile.id,
          session_date: sessionDate,
          start_time: startTime,
          observacoes: observacoes.trim() || null,
        })
        .select('id')
        .single();
      if (psError) throw psError;
      const psId = (patientSession as { id: string }).id;

      for (const procedureId of selectedProcedureIds) {
        const proc = procedures.find((p) => p.id === procedureId);
        const comparisonGallery = proc ? comparisonGalleryBySlug[proc.slug] : undefined;
        const { data: existing } = await supabase
          .from('procedure_instances')
          .select('id')
          .eq('patient_id', patientId)
          .eq('procedure_id', procedureId)
          .maybeSingle();
        let instanceId: string;
        if (existing?.id) {
          instanceId = (existing as { id: string }).id;
        } else {
          const { data: newInst, error: instErr } = await supabase
            .from('procedure_instances')
            .insert({
              procedure_id: procedureId,
              patient_id: patientId,
              professional_id: profile.id,
              data_inicio: sessionDate,
              status: 'em_andamento',
            })
            .select('id')
            .single();
          if (instErr) throw instErr;
          instanceId = (newInst as { id: string }).id;
        }
        let sessionData: Json = {};
        if (proc?.slug === 'botox') {
          sessionData = {
            ...(botoxPoints.length > 0 && { pontos_aplicacao: botoxPoints }),
            ...(botoxProdutoUtilizado.trim() && { produto_utilizado: botoxProdutoUtilizado.trim() }),
            ...(botoxRegiaoTratada.length > 0 && { regiao_tratada: botoxRegiaoTratada }),
            ...(Object.keys(botoxQuantidadePorPonto).length > 0 && {
              quantidade_por_ponto: botoxQuantidadePorPonto,
            }),
            ...(botoxQuantidadeUnidade.trim() !== ''
              ? (() => {
                  const u = botoxQuantidadeUnidade.trim();
                  const n = Number(u);
                  return { quantidade_unidade: Number.isFinite(n) ? n : u };
                })()
              : {}),
            data_aplicacao: botoxDataAplicacao.trim() || sessionDate,
            ...(botoxLote.trim() && { lote: botoxLote.trim() }),
            ...(botoxMarcaToxina.trim() && { marca_toxina: botoxMarcaToxina.trim() }),
            ...(botoxDataValidade.trim() && { data_validade: botoxDataValidade.trim() }),
            ...(botoxNumeroPontos.trim() && {
              numero_pontos_aplicacao: botoxNumeroPontos.trim(),
            }),
            ...(botoxDiluicao.trim() && { diluicao_utilizada: botoxDiluicao.trim() }),
            ...(botoxObservacoes.trim() && { observacoes_botox: botoxObservacoes.trim() }),
            ...(hasGalleryContent(comparisonGallery) && { galeria_antes_depois: galleryToSessionJson(comparisonGallery!) }),
          } as unknown as Json;
        } else if (proc?.slug === 'emagrecimento-reducao-medidas') {
          const peso = emagrecimentoPesoAtual.trim() ? Number(emagrecimentoPesoAtual) : null;
          const altura = emagrecimentoAlturaCm.trim() ? Number(emagrecimentoAlturaCm) : null;
          const imc = calcImc(peso, altura);
          sessionData = {
            ...(peso != null && Number.isFinite(peso) && { peso_atual: peso }),
            ...(altura != null && Number.isFinite(altura) && { altura_cm: altura }),
            ...(imc != null && { imc }),
            ...(emagrecimentoAbdomenSuperior.trim() && Number.isFinite(Number(emagrecimentoAbdomenSuperior)) && {
              abdomen_superior_cm: Number(emagrecimentoAbdomenSuperior),
            }),
            ...(emagrecimentoCintura.trim() && Number.isFinite(Number(emagrecimentoCintura)) && {
              cintura_cm: Number(emagrecimentoCintura),
            }),
            ...(emagrecimentoAbdomenInferior.trim() && Number.isFinite(Number(emagrecimentoAbdomenInferior)) && {
              abdomen_inferior_cm: Number(emagrecimentoAbdomenInferior),
            }),
            ...(emagrecimentoBraco.trim() && Number.isFinite(Number(emagrecimentoBraco)) && {
              braco_cm: Number(emagrecimentoBraco),
            }),
            ...(emagrecimentoBusto.trim() && Number.isFinite(Number(emagrecimentoBusto)) && {
              busto_cm: Number(emagrecimentoBusto),
            }),
            ...(emagrecimentoQuadril.trim() && Number.isFinite(Number(emagrecimentoQuadril)) && {
              quadril_cm: Number(emagrecimentoQuadril),
            }),
            ...(emagrecimentoInjetavel && { injetavel: emagrecimentoInjetavel }),
            ...(emagrecimentoInjetavel === 'Sim' && emagrecimentoProdutoUsado.trim() && {
              produto_usado: emagrecimentoProdutoUsado.trim(),
            }),
            ...(emagrecimentoInjetavel === 'Sim' && emagrecimentoMg.trim() && Number.isFinite(Number(emagrecimentoMg)) && {
              ml: Number(emagrecimentoMg),
            }),
            ...(hasGalleryContent(comparisonGallery) && { galeria_antes_depois: galleryToSessionJson(comparisonGallery!) }),
          } as Json;
        } else {
          const genericData = genericProcedureData[proc.slug];
          if (genericData && typeof genericData === 'object') {
            const payload =
              proc.slug === 'preenchimento-facial'
                ? serializePreenchimentoFacialSessionData(genericData as Record<string, unknown>)
                : proc.slug === LIPOENZIMATICA_SLUG
                  ? serializeLipoenzimaticaSessionData(genericData as Record<string, unknown>)
                  : isNewCustomProcedureSlug(proc.slug)
                    ? serializeNewCustomSessionData(proc.slug, genericData as Record<string, unknown>)
                    : genericData;
            sessionData = {
              ...payload,
              ...(hasGalleryContent(comparisonGallery) && { galeria_antes_depois: galleryToSessionJson(comparisonGallery!) }),
            } as Json;
          }
        }
        const { data: psRow, error: pssErr } = await supabase
          .from('procedure_sessions')
          .insert({
            procedure_instance_id: instanceId,
            patient_session_id: psId,
            session_date: sessionDate,
            data: sessionData,
            observacoes: observacoes.trim() || null,
          })
          .select('id')
          .single();
        if (pssErr) throw pssErr;

        if (proc?.slug === 'botox') {
          if (botoxReapplicationDue.trim()) {
            await supabase.from('botox_reapplication_reminders').insert({
              patient_id: patientId,
              procedure_instance_id: instanceId,
              procedure_session_id: (psRow as { id: string }).id,
              professional_id: profile.id,
              due_date: botoxReapplicationDue.trim(),
            });
          }
          const sessionId = (psRow as { id: string }).id;
          const botoxPhotos: { photo_type: string; file_url: string }[] = [];
          if (botoxFotoAntes?.trim()) botoxPhotos.push({ photo_type: 'antes', file_url: botoxFotoAntes.trim() });
          if (botoxFotoDepois?.trim()) botoxPhotos.push({ photo_type: 'depois', file_url: botoxFotoDepois.trim() });
          BOTOX_REGIOES.forEach(({ key }) => {
            const pair = botoxPhotosPorRegiao[key];
            if (pair?.antes?.trim()) botoxPhotos.push({ photo_type: `antes_${key}`, file_url: pair.antes.trim() });
            if (pair?.depois?.trim()) botoxPhotos.push({ photo_type: `depois_${key}`, file_url: pair.depois.trim() });
          });
          if (comparisonGallery && hasGalleryContent(comparisonGallery)) {
            botoxPhotos.push(...galleryToPhotoEntries(comparisonGallery));
          }
          if (botoxPhotos.length > 0) {
            await supabase.from('procedure_photos').insert(
              botoxPhotos.map((p) => ({
                procedure_instance_id: instanceId,
                procedure_session_id: sessionId,
                photo_type: p.photo_type,
                file_url: p.file_url,
              }))
            );
          }
        }
        if (proc?.slug === 'emagrecimento-reducao-medidas') {
          const sessionId = (psRow as { id: string }).id;
          const photoEntries: { type: string; url: string }[] = [];
          if (emagrecimentoDepoisFrente.trim()) photoEntries.push({ type: 'depois_frente', url: emagrecimentoDepoisFrente });
          if (emagrecimentoDepoisLado.trim()) photoEntries.push({ type: 'depois_lado', url: emagrecimentoDepoisLado });
          if (emagrecimentoDepoisCostas.trim()) photoEntries.push({ type: 'depois_costas', url: emagrecimentoDepoisCostas });
          if (comparisonGallery && hasGalleryContent(comparisonGallery)) {
            galleryToPhotoEntries(comparisonGallery).forEach((entry) =>
              photoEntries.push({ type: entry.photo_type, url: entry.file_url })
            );
          }
          if (photoEntries.length > 0) {
            await supabase.from('procedure_photos').insert(
              photoEntries.map(({ type, url }) => ({
                procedure_instance_id: instanceId,
                procedure_session_id: sessionId,
                photo_type: type,
                file_url: url,
              }))
            );
          }
        } else {
          const sessionId = (psRow as { id: string }).id;
          const fields = procedureFieldsBySlug[proc.slug];
          const data = genericProcedureData[proc.slug];
          if (fields?.length && data && typeof data === 'object') {
            const photoEntries: { photo_type: string; file_url: string }[] = [];
            fields.forEach((f) => {
              if (f.field_type === 'image') {
                const url = data[f.field_key];
                if (url && typeof url === 'string' && url.trim()) {
                  photoEntries.push({ photo_type: f.field_key, file_url: url.trim() });
                }
              }
            });
            if (comparisonGallery && hasGalleryContent(comparisonGallery)) {
              photoEntries.push(...galleryToPhotoEntries(comparisonGallery));
            }
            if (photoEntries.length > 0) {
              await supabase.from('procedure_photos').insert(
                photoEntries.map((p) => ({
                  procedure_instance_id: instanceId,
                  procedure_session_id: sessionId,
                  photo_type: p.photo_type,
                  file_url: p.file_url,
                }))
              );
            }
          }
          if (
            isDepilacaoDefinitivaSlug(proc.slug) &&
            patientId &&
            profile?.id &&
            instanceId &&
            sessionId &&
            data &&
            typeof data === 'object'
          ) {
            try {
              await syncDepilacaoDefinitivaReminders({
                slug: proc.slug,
                patientId,
                professionalId: profile.id,
                procedureInstanceId: instanceId,
                procedureSessionId: sessionId,
                data: serializeNewCustomSessionData(proc.slug, data as Record<string, unknown>),
              });
            } catch (e) {
              console.error(e);
            }
          }
        }
      }

      for (const termSlug of requiredTermSlugs) {
        const signatureData = signedTerms[termSlug];
        const term = terms.find((t) => t.slug === termSlug);
        if (!term || !signatureData) continue;
        await supabase.from('term_signatures').insert({
          patient_id: patientId,
          patient_session_id: psId,
          procedure_session_id: null,
          term_id: term.id,
          signature_data: signatureData,
          professional_signature_data: signedProfessionalSignature.trim() || null,
        });
      }

      const dataRecebimento = `${sessionDate}T${(sessionTime?.slice(0, 5) || '00:00')}:00`;
      const branchIdForBilling = await resolveBranchIdForInsert(profile);
      const branchBillingFields = branchIdForBilling ? { branch_id: branchIdForBilling } : {};
      if (isMultiProcedimentos) {
        const total = parseMoneyInput(consultaValores.valor);
        if (total > 0) {
          const ids = Array.from(selectedProcedureIds);
          ids.sort((a, b) => {
            const an = procedures.find((p) => p.id === a)?.name ?? '';
            const bn = procedures.find((p) => p.id === b)?.name ?? '';
            return an.localeCompare(bn);
          });
          for (let i = 0; i < ids.length; i++) {
            const procedureId = ids[i];
            const valorTotal = i === 0 ? total : 0;
            await supabase.from('recebimentos').insert({
              cliente_id: patientId,
              profissional_id: profile.id,
              procedimento_id: procedureId,
              valor_total: valorTotal,
              valor_recebido: valorTotal,
              forma_pagamento: consultaValores.forma_pagamento,
              parcelas: consultaValores.forma_pagamento === 'cartao' ? (consultaValores.parcelas ?? 1) : null,
              status: 'pago',
              data: dataRecebimento,
              ...branchBillingFields,
            });
          }
        }
      } else {
        for (const procedureId of selectedProcedureIds) {
          const v = getProcedureValor(procedureId);
          const valorTotal = parseMoneyInput(v.valor);
          if (valorTotal > 0) {
            await supabase.from('recebimentos').insert({
              cliente_id: patientId,
              profissional_id: profile.id,
              procedimento_id: procedureId,
              valor_total: valorTotal,
              valor_recebido: valorTotal,
              forma_pagamento: v.forma_pagamento,
              parcelas: v.forma_pagamento === 'cartao' ? (v.parcelas ?? 1) : null,
              status: 'pago',
              data: dataRecebimento,
              ...(isClinicAccount && v.price_tier ? { price_tier: v.price_tier } : {}),
              ...branchBillingFields,
            });
          }
        }
      }

      const onlyAvaliacao =
        selectedSlugs.length === 1 && selectedSlugs[0] === 'avaliacao';

      if (linkedAppointmentId) {
        await supabase.from('appointments').delete().eq('id', linkedAppointmentId);
      }

      toast.success(
        onlyAvaliacao
          ? 'Avaliação registrada. O paciente está em Futuros clientes.'
          : 'Consulta finalizada com sucesso.'
      );
      navigate(
        returnTo ||
          (onlyAvaliacao ? '/dashboard' : `/patients/${patientId}`)
      );
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar consulta.');
    } finally {
      setSaving(false);
    }
  };

  if (!patientId) {
    navigate(returnTo || '/consultation');
    return null;
  }

  if (loading && !patient) {
    return <PageLoading />;
  }

  if (!patient) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Paciente não encontrado.</p>
        <Button variant="link" asChild className="mt-2">
          <Link to={cancelHref}>Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in max-w-3xl mx-auto pb-44 md:pb-12">
      <PageBreadcrumb
        segments={[
          { label: 'Início', path: '/dashboard' },
          {
            label: pageTitle,
            path: returnTo || (focusProcedureSlug === 'depilacao-laser' ? '/depilacao-laser/start' : '/consultation'),
          },
          { label: patient?.full_name ?? 'Consulta' },
        ]}
        className="mb-1 hidden md:block"
      />
      {/* Header unificado: paciente + contexto (últimas sessões) — layout aprimorado */}
      <header className="sticky top-0 z-30 rounded-xl border border-border/80 bg-card/95 backdrop-blur shadow-sm overflow-hidden">
        <div className="px-4 py-4 md:px-5 md:py-5">
          <h1 className="text-base md:text-xl font-bold text-foreground break-words line-clamp-2 tracking-tight">
            {patient.full_name}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">{pageTitle}</p>
        </div>
        {!isEditingExistingSession && (
          <div className="border-t border-border/50">
            <div className="px-4 py-3 md:px-5 md:py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Últimas sessões
              </p>
            </div>
            <div className="px-4 pb-4 md:px-5 md:pb-5 pt-0">
              {lastSessions.length > 0 ? (
                <ul className="space-y-0">
                  {lastSessions.slice(0, 3).map((s, index) => (
                    (() => {
                      const firstProcedureSession = (s.procedure_sessions ?? [])[0] as
                        | { id: string; procedure_instance_id: string; procedure_instances?: { procedures?: { slug?: string } } }
                        | undefined;
                      const targetSlug = firstProcedureSession?.procedure_instances?.procedures?.slug;
                      const targetProcedureSessionId = firstProcedureSession?.id;
                      const targetInstanceId = firstProcedureSession?.procedure_instance_id;
                      const canEdit = false;
                      return (
                    <li
                      key={s.id}
                      className="flex items-start gap-3 py-2.5 text-sm first:pt-0 last:pb-0 border-b border-border/40 last:border-b-0"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground mt-0.5">
                        <Calendar className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          className={`w-full text-left rounded-lg border border-border bg-card p-4 transition-colors ${
                            canEdit ? 'hover:bg-muted/30 cursor-pointer' : 'cursor-default'
                          }`}
                          disabled={!canEdit}
                          onClick={() => {
                            if (!canEdit || !targetSlug || !targetProcedureSessionId || !targetInstanceId) return;
                            const qs = new URLSearchParams({
                              procedure: targetSlug,
                              editSessionId: targetProcedureSessionId,
                              editInstanceId: targetInstanceId,
                              returnTo: `/patients/${patientId}`,
                            });
                            navigate(`/consultation/${patientId}?${qs.toString()}`);
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <time className="font-semibold text-foreground block">
                                {format(parseLocalDate(s.session_date), "d 'de' MMMM yyyy", { locale: ptBR })}
                              </time>
                              {s.procedure_sessions?.length ? (
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  {(s.procedure_sessions as unknown[])
                                    .map((ps: { procedure_instances?: { procedures?: { name?: string } } }) => ps.procedure_instances?.procedures?.name ?? '')
                                    .filter(Boolean)
                                    .join(' · ')}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      </div>
                    </li>
                      );
                    })()
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground py-1">Nenhuma sessão anterior registrada.</p>
              )}
            </div>
          </div>
        )}
      </header>

      <form onSubmit={handleFinalize} className="space-y-4 md:space-y-6">
        {/* Data e hora — mobile: compacto */}
        <Card>
          <CardHeader className="pb-1.5 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-sm md:text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              Dados da consulta
            </CardTitle>
            <CardDescription className="text-xs">Data, hora e status da sessão.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 p-3 md:p-6 pt-0">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Horário</Label>
              <Input type="time" value={sessionTime} onChange={(e) => setSessionTime(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Status</Label>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                Em andamento
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Procedimentos realizados — mobile: compacto */}
        <Card id="procedimentos-realizados">
          <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-sm md:text-lg flex items-center gap-2">
                  {isSalonProcedureMode ? (
                    <Scissors className="w-4 h-4 md:w-5 md:h-5 text-primary shrink-0" />
                  ) : (
                    <Stethoscope className="w-4 h-4 md:w-5 md:h-5 text-primary shrink-0" />
                  )}
                  {isSalonProcedureMode ? 'Procedimentos do salão' : 'Procedimentos realizados'}
                </CardTitle>
                <SelectedProceduresCounter
                  count={
                    isSalonProcedureMode
                      ? selectedSalonProcedureIds.size
                      : selectedProcedureIds.size
                  }
                />
              </div>
            </div>
            <CardDescription>
              {isSalonProcedureMode
                ? 'Selecione os procedimentos cadastrados no salão realizados neste atendimento.'
                : isBotoxOnlyConsultation
                  ? 'Atendimento vinculado à agenda como Botox — só este procedimento pode ser registrado.'
                  : focusProcedureSlug === 'depilacao-laser'
                    ? 'Atendimento de Depilação a Laser — preencha os dados da sessão abaixo.'
                    : isFocusedProcedureOnly
                      ? 'Atendimento focado neste procedimento.'
                      : 'Selecione os procedimentos realizados neste atendimento.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 md:space-y-4 p-3 md:p-6 pt-0">
            {isSalonProcedureMode ? (
              <SalonProcedurePicker
                procedures={salonProcedures}
                selectedIds={selectedSalonProcedureIds}
                onToggle={toggleSalonProcedure}
                searchQuery={salonProcedureSearchQuery}
                onSearchChange={setSalonProcedureSearchQuery}
              />
            ) : (
              <>
            {!isFocusedProcedureOnly ? (
            <ProcedureSearchInput
              value={procedureSearchQuery}
              onChange={setProcedureSearchQuery}
              placeholder="🔍 Buscar procedimento…"
            />
            ) : null}
            <div className="space-y-3">
              {proceduresByCategory.map(({ title, procedures: procs }, index) => (
                <ProcedureCategorySection
                  key={title}
                  title={title}
                  procedures={procs}
                  selectedIds={selectedProcedureIds}
                  onToggle={toggleProcedure}
                  defaultOpen={index === 0}
                />
              ))}
            </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Botox: mapa facial e campos */}
        {!isSalonProcedureMode && hasBotox && (
          <Collapsible open={expandedBotox} onOpenChange={setExpandedBotox}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 gap-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg p-3 md:p-6">
                  <div className="flex flex-col space-y-1.5 text-left">
                    <CardTitle className="text-sm md:text-base flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 md:w-5 md:h-5 text-primary shrink-0" />
                      Botox — mapa facial e reaplicação
                    </CardTitle>
                    <CardDescription className="text-xs">Foto antes/depois, regiões, produto e prazo para reaplicação.</CardDescription>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${expandedBotox ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 p-3 md:p-6 pt-0">
                  {/* 1. Região tratada (checkboxes) */}
                  {isBotoxRegiaoTratadaVisible && (
                    <Card>
                      <CardContent className="p-3 sm:p-4 pt-4">
                        <div className="space-y-2">
                          <Label>Região tratada</Label>
                          <div className="flex flex-wrap gap-4">
                            {visibleBotoxRegions.map(({ key, label }) => (
                              <label
                                key={key}
                                className="flex items-center gap-2 cursor-pointer text-sm"
                              >
                                <Checkbox
                                  checked={botoxRegiaoTratada.includes(key)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setBotoxRegiaoTratada((prev) => (prev.includes(key) ? prev : [...prev, key]));
                                    } else {
                                      setBotoxRegiaoTratada((prev) => prev.filter((k) => k !== key));
                                      setBotoxQuantidadePorPonto((prev) => {
                                        const next = { ...prev };
                                        delete next[key];
                                        return next;
                                      });
                                    }
                                  }}
                                />
                                <span>{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 2. Mapa facial (pontos de aplicação) */}
                  <div className="space-y-2">
                    <BotoxFacialMap
                      points={botoxPoints}
                      onChange={setBotoxPoints}
                    />
                  </div>

                  {/* 3. Card por região tratada: quantidade por ponto + antes/depois + compartilhar story — uma região por linha */}
                  {isBotoxRegiaoTratadaVisible && showSessionPhotos && botoxRegiaoTratada.length > 0 && (
                    <div className="flex flex-col gap-4">
                      {visibleBotoxRegions.filter((r) => botoxRegiaoTratada.includes(r.key)).map(({ key: regiaoKey, label: regiaoLabel }) => {
                        const pair = botoxPhotosPorRegiao[regiaoKey] ?? { antes: null, depois: null };
                        const canShare = pair.antes?.trim() && pair.depois?.trim();
                        return (
                          <div
                            key={regiaoKey}
                            className="rounded-lg border border-border bg-card p-3 space-y-3"
                          >
                            <p className="text-sm font-medium text-foreground">{regiaoLabel}</p>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium leading-none">Quantidade por ponto</Label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label className="font-medium text-xs text-muted-foreground">{regiaoLabel}</Label>
                                  <Input
                                    value={botoxQuantidadePorPonto[regiaoKey] ?? ''}
                                    onChange={(e) =>
                                      setBotoxQuantidadePorPonto((prev) => ({
                                        ...prev,
                                        [regiaoKey]: e.target.value,
                                      }))
                                    }
                                    placeholder="Ex: 2 U"
                                    className="h-11 sm:h-10 rounded-xl"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <PhotoUploadField
                                  label="Antes"
                                  value={pair.antes}
                                  onChange={(url) =>
                                    setBotoxPhotosPorRegiao((prev) => ({
                                      ...prev,
                                      [regiaoKey]: { ...(prev[regiaoKey] ?? { antes: null, depois: null }), antes: url ?? null },
                                    }))
                                  }
                                  userId={profile?.id ?? ''}
                                  instanceIdOrTemp={`botox-regiao-${regiaoKey}-antes`}
                                  disabled={!profile?.id}
                                  compact
                                  previewVisible={expandedBotox && !cameraOpening}
                                  onCameraOpen={handleBeforeCameraOpen}
                                  onCameraClose={handleCameraClose}
                                />
                              </div>
                              <div>
                                <PhotoUploadField
                                  label="Depois"
                                  value={pair.depois}
                                  onChange={(url) =>
                                    setBotoxPhotosPorRegiao((prev) => ({
                                      ...prev,
                                      [regiaoKey]: { ...(prev[regiaoKey] ?? { antes: null, depois: null }), depois: url ?? null },
                                    }))
                                  }
                                  userId={profile?.id ?? ''}
                                  instanceIdOrTemp={`botox-regiao-${regiaoKey}-depois`}
                                  disabled={!profile?.id}
                                  compact
                                  previewVisible={expandedBotox && !cameraOpening}
                                  onCameraOpen={handleBeforeCameraOpen}
                                  onCameraClose={handleCameraClose}
                                />
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full gap-2 rounded-xl"
                              disabled={!canShare}
                              onClick={() => handleShareBotoxStoryPorRegiao(regiaoKey, regiaoLabel)}
                            >
                              <ImageIcon className="h-4 w-4" />
                              Compartilhar story
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Produto utilizado</Label>
                      <Input
                        value={botoxProdutoUtilizado}
                        onChange={(e) => setBotoxProdutoUtilizado(e.target.value)}
                        placeholder="Ex: Botox, Dysport, etc."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Lote</Label>
                      <Input
                        value={botoxLote}
                        onChange={(e) => setBotoxLote(e.target.value)}
                        placeholder="Número do lote"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Marca da toxina</Label>
                      <Input
                        value={botoxMarcaToxina}
                        onChange={(e) => setBotoxMarcaToxina(e.target.value)}
                        placeholder="Ex: Botox, Dysport"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data de validade</Label>
                      <Input
                        type="date"
                        value={botoxDataValidade}
                        onChange={(e) => setBotoxDataValidade(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantidade e/ou unidade total</Label>
                      <Input
                        value={botoxQuantidadeUnidade}
                        onChange={(e) => setBotoxQuantidadeUnidade(e.target.value)}
                        placeholder="Ex: 50 U"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data da aplicação</Label>
                      <Input
                        type="date"
                        value={botoxDataAplicacao || sessionDate}
                        onChange={(e) => setBotoxDataAplicacao(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Número de pontos de aplicação</Label>
                      <Input
                        type="number"
                        min={0}
                        value={botoxNumeroPontos}
                        onChange={(e) => setBotoxNumeroPontos(e.target.value)}
                        placeholder="Ex: 12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Diluição utilizada</Label>
                      <Input
                        value={botoxDiluicao}
                        onChange={(e) => setBotoxDiluicao(e.target.value)}
                        placeholder="Ex: 2,5 ml soro"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      value={botoxObservacoes}
                      onChange={(e) => setBotoxObservacoes(e.target.value)}
                      placeholder="Observações do procedimento Botox"
                      rows={3}
                      className="resize-y"
                    />
                  </div>

                  {showBeforeAfterGallery ? (
                  <BeforeAfterGalleryCard
                    title="Galeria Antes e Depois"
                    description="Monte comparações por pares para este procedimento."
                    userId={profile?.id ?? ''}
                    instanceIdOrTemp={`consult-botox-${patientId ?? 'temp'}`}
                    value={getGalleryForSlug('botox')}
                    onChange={(next) => setGalleryForSlug('botox', next)}
                    disabled={!profile?.id}
                  />
                  ) : null}

                  {/* Reaplicação Botox: oculto quando a consulta veio da agenda/programa Botox */}
                  {!isBotoxOnlyConsultation && (
                    <div className="rounded-lg border border-border bg-muted/10 overflow-hidden">
                      <div className="flex flex-col space-y-1.5 p-3 sm:p-4 border-b border-border bg-muted/30 pb-3">
                        <h3 className="sm:text-xl flex items-center gap-2 text-base font-semibold tracking-tight">
                          <Bell className="w-5 h-5 text-primary" />
                          Reaplicação Botox
                        </h3>
                        <p className="sm:text-sm text-muted-foreground mt-1 text-sm">
                          Defina o prazo para a próxima reaplicação; ao agendar, o paciente pode receber lembrete por WhatsApp.
                        </p>
                      </div>
                      <div className="sm:p-4 p-4 pt-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Prazo (dias)</Label>
                            <Input
                              type="number"
                              min={1}
                              placeholder="ex.: 90 dias"
                              className="h-10 w-40 rounded-xl"
                              value={botoxPrazoDias}
                              onChange={(e) => setBotoxPrazoDias(e.target.value)}
                            />
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 h-10 shrink-0"
                            onClick={() => openAgendaPopupFromSessionDate(botoxPrazoDias)}
                          >
                            <CalendarPlus className="w-4 h-4" />
                            Agendar reaplicação
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 h-10 shrink-0"
                            onClick={handleMeLembrarBotox}
                            disabled={savingBotoxReminder}
                            title="Criar lembrete para o profissional (7 dias antes)"
                          >
                            <Bell className="w-4 h-4" />
                            Me lembrar
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {!isMultiProcedimentos && procedures.find((p) => p.slug === 'botox') && renderValoresBlock(procedures.find((p) => p.slug === 'botox')!.id)}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Emagrecimento: peso, medidas, injetável, fotos */}
        {hasEmagrecimento && profile?.id && (
          <Collapsible open={expandedEmagrecimento} onOpenChange={setExpandedEmagrecimento}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 gap-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg p-3 md:p-6">
                  <div className="flex flex-col space-y-1.5 text-left">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4 md:w-5 md:h-5 text-primary shrink-0" />
                      <span className="break-words">Emagrecimento / Redução de Medidas</span>
                    </CardTitle>
                    <CardDescription className="text-xs">Peso, medidas e fotos &quot;Depois&quot; opcionais.</CardDescription>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${expandedEmagrecimento ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
            <CardContent className="space-y-3 md:space-y-4 p-3 md:p-6 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data da sessão</Label>
                  <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Peso atual (kg)</Label>
                <Input
                  type="number"
                  placeholder="Peso atual (kg)"
                  value={emagrecimentoPesoAtual}
                  onChange={(e) => setEmagrecimentoPesoAtual(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Altura (cm)</Label>
                <Input
                  type="number"
                  placeholder="Altura (cm)"
                  value={emagrecimentoAlturaCm}
                  onChange={(e) => setEmagrecimentoAlturaCm(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>IMC</Label>
                <Input
                  type="text"
                  readOnly
                  className="bg-muted"
                  placeholder="Preencha peso e altura"
                  value={
                    calcImc(
                      emagrecimentoPesoAtual.trim() ? Number(emagrecimentoPesoAtual) : null,
                      emagrecimentoAlturaCm.trim() ? Number(emagrecimentoAlturaCm) : null
                    )?.toFixed(1) ?? ''
                  }
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Abdômen superior (cm)</Label>
                  <Input
                    type="number"
                    placeholder="Abdômen superior (cm)"
                    value={emagrecimentoAbdomenSuperior}
                    onChange={(e) => setEmagrecimentoAbdomenSuperior(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cintura (cm)</Label>
                  <Input
                    type="number"
                    placeholder="Cintura (cm)"
                    value={emagrecimentoCintura}
                    onChange={(e) => setEmagrecimentoCintura(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Abdômen inferior (cm)</Label>
                  <Input
                    type="number"
                    placeholder="Abdômen inferior (cm)"
                    value={emagrecimentoAbdomenInferior}
                    onChange={(e) => setEmagrecimentoAbdomenInferior(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Braço (cm)</Label>
                  <Input
                    type="number"
                    placeholder="Braço (cm)"
                    value={emagrecimentoBraco}
                    onChange={(e) => setEmagrecimentoBraco(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Busto (cm)</Label>
                  <Input
                    type="number"
                    placeholder="Busto (cm)"
                    value={emagrecimentoBusto}
                    onChange={(e) => setEmagrecimentoBusto(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quadril (cm)</Label>
                  <Input
                    type="number"
                    placeholder="Quadril (cm)"
                    value={emagrecimentoQuadril}
                    onChange={(e) => setEmagrecimentoQuadril(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Injetável</Label>
                <Select value={emagrecimentoInjetavel} onValueChange={setEmagrecimentoInjetavel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Não">Não</SelectItem>
                    <SelectItem value="Sim">Sim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {emagrecimentoInjetavel === 'Sim' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Produto usado</Label>
                    <Input
                      placeholder="Produto usado"
                      value={emagrecimentoProdutoUsado}
                      onChange={(e) => setEmagrecimentoProdutoUsado(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>mg</Label>
                    <Input
                      type="number"
                      placeholder="mg"
                      value={emagrecimentoMg}
                      onChange={(e) => setEmagrecimentoMg(e.target.value)}
                    />
                  </div>
                </div>
              )}
              {showNextEvaluationSection ? (
              <div className="rounded-lg border border-border bg-muted/10 overflow-hidden">
                <div className="flex flex-col space-y-1.5 p-3 sm:p-4 border-b border-border bg-muted/30 pb-3">
                  <h3 className="sm:text-xl flex items-center gap-2 text-base font-semibold tracking-tight">
                    <Bell className="w-5 h-5 text-primary" />
                    Próxima avaliação
                  </h3>
                  <p className="sm:text-sm text-muted-foreground mt-1 text-sm">
                    Defina o prazo para a próxima avaliação; ao agendar, o paciente pode receber lembrete por WhatsApp.
                  </p>
                </div>
                <div className="sm:p-4 p-4 pt-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Prazo</Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="ex.: 90 dias"
                        className="h-10 w-40 rounded-xl"
                        value={emagrecimentoPrazoDias}
                        onChange={(e) => setEmagrecimentoPrazoDias(e.target.value)}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 h-10 shrink-0"
                      onClick={() => openAgendaPopupFromSessionDate(emagrecimentoPrazoDias)}
                    >
                      <CalendarPlus className="w-4 h-4" />
                      Agendar próxima avaliação
                    </Button>
                  </div>
                </div>
              </div>
              ) : null}
              {showBeforeAfterGallery ? (
              <BeforeAfterGalleryCard
                title="Galeria Antes e Depois"
                description="Organize fotos e gere pares para comparação visual."
                userId={profile.id}
                instanceIdOrTemp={`consult-emagrecimento-${patientId ?? 'temp'}`}
                value={getGalleryForSlug('emagrecimento-reducao-medidas')}
                onChange={(next) => setGalleryForSlug('emagrecimento-reducao-medidas', next)}
                disabled={!profile?.id}
              />
              ) : null}
                {!isMultiProcedimentos &&
                  procedures.find((p) => p.slug === 'emagrecimento-reducao-medidas') &&
                  renderValoresBlock(procedures.find((p) => p.slug === 'emagrecimento-reducao-medidas')!.id)}
            </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Telinhas dinâmicas para os demais procedimentos selecionados */}
        {selectedSlugs
          .filter((s) => s !== 'botox' && s !== 'emagrecimento-reducao-medidas')
          .map((slug) => {
            const proc = procedures.find((p) => p.slug === slug);
            const fields = procedureFieldsBySlug[slug];
            if (!proc || !fields?.length) return null;
            const data = genericProcedureData[slug] ?? {};
            const setData = (key: string, value: unknown) => {
              setGenericProcedureData((prev) => ({
                ...prev,
                [slug]: { ...(prev[slug] ?? {}), [key]: value },
              }));
            };
            const showFacialMap = PROCEDURE_SLUGS_WITH_FACIAL_MAP.includes(slug as (typeof PROCEDURE_SLUGS_WITH_FACIAL_MAP)[number]);
            const facialPoints = (data.pontos_aplicacao as FacialPoint[] | undefined) ?? [];
            const facialStrokes = (data.riscos_aplicacao as FacialStroke[] | undefined) ?? [];
            const isExpanded = expandedGenericProcedureId === proc.id;
            const isPeim = slug === 'peim';
            const isPreenchimento = slug === 'preenchimento-facial';
            const isLipoenzimatica = slug === LIPOENZIMATICA_SLUG;
            const isDepilacaoDef = isDepilacaoDefinitivaSlug(slug);
            const isRegionProc = isRegionProcedureSlug(slug);
            const regionCfg = isRegionProc ? getRegionConfig(slug) : null;
            const aplicacoes = isPreenchimento
              ? getPreenchimentoAplicacoesForForm(data)
              : [];
            const lipoAreas = isLipoenzimatica ? getLipoenzimaticaAreasForForm(data) : [];
            const lipoProdutos = isLipoenzimatica ? getLipoenzimaticaProdutosForForm(data) : [];
            const depilacaoAreas = isDepilacaoDef ? getDepilacaoFormAreas(data) : [];
            const regionItems =
              isRegionProc && regionCfg ? getRegionFormItems(slug, data) : [];
            const usoAnestesia = data.uso_anestesia === true;
            return (
              <Collapsible
                key={proc.id}
                open={isExpanded}
                onOpenChange={(open) => setExpandedGenericProcedureId(open ? proc.id : null)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 gap-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
                      <div className="flex flex-col space-y-1.5 text-left">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Stethoscope className="w-5 h-5 text-primary shrink-0" />
                          {proc.name}
                        </CardTitle>
                        <CardDescription>
                          Clique para preencher os dados desta sessão
                        </CardDescription>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        aria-hidden
                      />
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0">
                      {showFacialMap && (
                        <div className="flex flex-col items-center">
                          <BotoxFacialMap
                            points={Array.isArray(facialPoints) ? facialPoints : []}
                            onChange={(points) => setData('pontos_aplicacao', points)}
                            strokes={Array.isArray(facialStrokes) ? facialStrokes : []}
                            onStrokesChange={(next) => setData('riscos_aplicacao', next)}
                            className="w-full"
                            imageSrc={slug === 'harmonizacao-glutea' ? '/gluteal-map.png' : undefined}
                            caption={slug === 'harmonizacao-glutea' ? 'Mapa glúteo — clique para marcar pontos de aplicação' : undefined}
                            antesPreviewVisible={isExpanded && !cameraOpening}
                            onCameraOpen={handleBeforeCameraOpen}
                            onCameraClose={handleCameraClose}
                          />
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {isLipoenzimatica ? (
                        <>
                          <LipoenzimaticaAreasSection
                            items={lipoAreas}
                            onChange={(next) => setData(LIPOENZIMATICA_AREAS_STORAGE_KEY, next)}
                            userId={profile?.id ?? ''}
                            instanceIdOrTemp={`consult-${slug}`}
                            onCameraOpen={handleBeforeCameraOpen}
                            onCameraClose={handleCameraClose}
                            previewVisible={isExpanded && !cameraOpening}
                          />
                          <LipoenzimaticaProdutosRepeater
                            items={lipoProdutos}
                            onChange={(next) => setData(LIPOENZIMATICA_PRODUTOS_STORAGE_KEY, next)}
                          />
                        </>
                      ) : null}
                      {isDepilacaoDef ? (
                        <DepilacaoDefinitivaAreasSection
                          slug={slug}
                          items={depilacaoAreas}
                          onChange={(next) => setData(DEPILACAO_AREAS_STORAGE_KEY, next)}
                          sessionDate={sessionDate}
                        />
                      ) : null}
                      {isRegionProc && regionCfg ? (
                        <ProcedureRegionBlocksSection
                          regions={regionCfg.regions}
                          fields={regionCfg.fields}
                          items={regionItems}
                          onChange={(next) => setData(REGION_AREAS_STORAGE_KEY, next)}
                        />
                      ) : null}
                      {(() => {
                        const filteredFields = fields.filter(
                          (field) =>
                            !isLegacyBeforeAfterImageField(field) &&
                            !(slug === 'bioestimulador-colageno' && field.label === 'Data de retorno') &&
                            !(isPeim && field.field_key === 'tipo_anestesia' && !usoAnestesia) &&
                            !(isPreenchimento && isPreenchimentoRepeatableFieldKey(field.field_key)) &&
                            !(isLipoenzimatica && isLipoenzimaticaHiddenFieldKey(field.field_key)) &&
                            !(isNewCustomProcedureSlug(slug) && isNewCustomHiddenFieldKey(slug, field.field_key))
                        );
                        const fieldRenderPlan = buildProcedureFieldRenderPlan(slug, filteredFields);

                        return fieldRenderPlan.map((item) => {
                          if (item.kind === 'boolean_group') {
                            return (
                              <div
                                key={item.title}
                                className="col-span-full rounded-xl border border-border/60 bg-muted/15 p-4 space-y-3"
                              >
                                <p className="text-sm font-medium text-foreground">{item.title}</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                  {item.fields.map((field) => (
                                    <div key={field.id}>
                                      {renderGenericProcedureField(
                                        field,
                                        data[field.field_key],
                                        (key, value) => setData(key, value),
                                        sessionDate,
                                        profile?.id ?? '',
                                        `consult-${slug}`,
                                        handleBeforeCameraOpen,
                                        isExpanded && !cameraOpening,
                                        handleCameraClose
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }

                          const field = item.field;
                          const fullWidthOnDesktop = isProcedureFieldFullWidthOnDesktop(field, slug);
                          const labelOverride = isPeim ? PEIM_LABEL_OVERRIDES[field.field_key] : undefined;
                          const optionsOverride = isPeim ? PEIM_OPTIONS_OVERRIDES[field.field_key] : undefined;
                          const scalpMapProps = resolveApplicationMapProps(slug, data);

                          if (isPreenchimento && field.field_key === 'plano_aplicacao') {
                            return (
                              <Fragment key={`${field.id}-preenchimento`}>
                                <PreenchimentoAplicacaoRepeater
                                  items={aplicacoes}
                                  onChange={(next) =>
                                    setData(PREENCHIMENTO_APLICACAO_STORAGE_KEY, next)
                                  }
                                />
                                <div className={fullWidthOnDesktop ? 'col-span-full' : undefined}>
                                  {renderGenericProcedureField(
                                    field,
                                    data[field.field_key],
                                    (key, value) => setData(key, value),
                                    sessionDate,
                                    profile?.id ?? '',
                                    `consult-${slug}`,
                                    handleBeforeCameraOpen,
                                    isExpanded && !cameraOpening,
                                    handleCameraClose,
                                    labelOverride,
                                    optionsOverride
                                  )}
                                </div>
                              </Fragment>
                            );
                          }

                          return (
                            <Fragment key={field.id}>
                              <div className={fullWidthOnDesktop ? 'col-span-full' : undefined}>
                                {renderGenericProcedureField(
                                  field,
                                  data[field.field_key],
                                  (key, value) => setData(key, value),
                                  sessionDate,
                                  profile?.id ?? '',
                                  `consult-${slug}`,
                                  handleBeforeCameraOpen,
                                  isExpanded && !cameraOpening,
                                  handleCameraClose,
                                  labelOverride,
                                  optionsOverride
                                )}
                              </div>
                              {field.field_key === 'tecnica_utilizada' && shouldShowTerapiaCapilarScalpMap(slug, data) ? (
                                <div className="col-span-full flex flex-col items-center">
                                  <BotoxFacialMap
                                    points={Array.isArray(facialPoints) ? facialPoints : []}
                                    onChange={(points) => setData('pontos_aplicacao', points)}
                                    className="w-full"
                                    imageSrc={scalpMapProps.imageSrc}
                                    caption={scalpMapProps.caption}
                                    viewBoxWidth={scalpMapProps.viewBoxWidth}
                                    viewBoxHeight={scalpMapProps.viewBoxHeight}
                                    antesPreviewVisible={isExpanded && !cameraOpening}
                                    onCameraOpen={handleBeforeCameraOpen}
                                    onCameraClose={handleCameraClose}
                                  />
                                </div>
                              ) : null}
                            </Fragment>
                          );
                        });
                      })()}
                      </div>
                      {showBeforeAfterGallery ? (
                      <BeforeAfterGalleryCard
                        title="Galeria Antes e Depois"
                        description="Upload múltiplo com pares editáveis para este procedimento."
                        userId={profile?.id ?? ''}
                        instanceIdOrTemp={`consult-${slug}-${patientId ?? 'temp'}`}
                        value={getGalleryForSlug(slug)}
                        onChange={(next) => setGalleryForSlug(slug, next)}
                        disabled={!profile?.id}
                      />
                      ) : null}
                      {showNextEvaluationSection ? (
                      <div className="rounded-lg border border-border bg-muted/10 overflow-hidden">
                        <div className="flex flex-col space-y-1.5 p-3 sm:p-4 border-b border-border bg-muted/30 pb-3">
                          <h3 className="sm:text-xl flex items-center gap-2 text-base font-semibold tracking-tight">
                            <Bell className="w-5 h-5 text-primary" />
                            Próxima avaliação
                          </h3>
                          <p className="sm:text-sm text-muted-foreground mt-1 text-sm">
                            Defina o prazo para a próxima avaliação; ao agendar, o paciente pode receber lembrete por WhatsApp.
                          </p>
                        </div>
                        <div className="sm:p-4 p-4 pt-3">
                          <div className="flex flex-wrap items-end gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium">Prazo</Label>
                              <Input
                                type="number"
                                min={1}
                                placeholder="ex.: 90 dias"
                                className="h-10 w-40 rounded-xl"
                                value={proximaAvaliacaoPorSlug[slug] ?? ''}
                                onChange={(e) =>
                                  setProximaAvaliacaoPorSlug((prev) => ({ ...prev, [slug]: e.target.value }))
                                }
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-2 h-10 shrink-0 rounded-xl"
                              onClick={() => openAgendaPopupFromSessionDate(proximaAvaliacaoPorSlug[slug] ?? '')}
                            >
                              <CalendarPlus className="w-4 h-4" />
                              Agendar próxima avaliação
                            </Button>
                          </div>
                        </div>
                      </div>
                      ) : null}
                    {!isMultiProcedimentos && renderValoresBlock(proc.id)}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}

        {isSalonProcedureMode && (
          <Card>
            <CardHeader className="pb-1.5 md:pb-2 p-3 md:p-6">
              <CardTitle className="text-sm md:text-base flex items-center gap-2">
                <Wallet className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                Valor do atendimento
              </CardTitle>
              <CardDescription className="text-xs">
                Informe o valor cobrado neste atendimento (opcional).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">{renderConsultaValoresBlock('')}</CardContent>
          </Card>
        )}

        {isMultiProcedimentos && (
          <Card>
            <CardHeader className="pb-1.5 md:pb-2 p-3 md:p-6">
              <CardTitle className="text-sm md:text-base flex items-center gap-2">
                <Wallet className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                Valor da consulta
              </CardTitle>
              <CardDescription className="text-xs">
                Você selecionou múltiplos procedimentos. Informe o valor total deste atendimento.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">{renderConsultaValoresBlock('')}</CardContent>
          </Card>
        )}

        {/* Observações */}
        <Card>
          <CardHeader className="pb-1.5 md:pb-2 p-3 md:p-6">
            <CardTitle className="text-sm md:text-base flex items-center gap-2">
              <FileText className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              Observações da sessão
            </CardTitle>
            <CardDescription className="text-xs">Reação, ajustes, recomendações.</CardDescription>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex.: Reação do paciente, ajustes feitos, recomendações para a próxima sessão..."
              className="min-h-[100px] rounded-xl"
            />
          </CardContent>
        </Card>

        {/* Fotos do atendimento — salão: upload múltiplo */}
        {isSalonProcedureMode && profile?.id && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-primary" />
                Fotos do atendimento
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Adicione quantas fotos quiser deste atendimento (opcional).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <SalonSessionPhotosField
                photos={salonSessionPhotos}
                onChange={setSalonSessionPhotos}
                userId={profile.id}
                patientId={patientId}
                onCameraOpen={handleBeforeCameraOpen}
                onCameraClose={handleCameraClose}
                previewVisible={!cameraOpening}
              />
            </CardContent>
          </Card>
        )}

        {/* Fotos adicionadas (antes e depois da sessão) — clínica/solo */}
        {!isSalonProcedureMode && shouldShowSessionPhotosSection && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5">
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  Fotos da sessão
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Fotos de antes e depois adicionadas nesta consulta.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleShareToInstagram}
                className="shrink-0 rounded-full h-9 w-9"
                title="Compartilhar no Instagram Story"
                aria-label="Compartilhar no Instagram Story"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[#E4405F]"
                >
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                </svg>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            {(() => {
              const hasBotoxPhotos = hasBotox && (botoxFotoAntes || botoxFotoDepois);
              const hasEmagrecimentoPhotos =
                hasEmagrecimento &&
                (emagrecimentoDepoisFrente || emagrecimentoDepoisLado || emagrecimentoDepoisCostas);
              const genericPhotosByProc = selectedSlugs
                .filter((s) => s !== 'botox' && s !== 'emagrecimento-reducao-medidas')
                .map((slug) => {
                  const proc = procedures.find((p) => p.slug === slug);
                  const fields = procedureFieldsBySlug[slug];
                  const data = genericProcedureData[slug];
                  if (!proc || !fields?.length || !data) return null;
                  const entries: { label: string; url: string }[] = [];
                  fields.forEach((f) => {
                    if (f.field_type === 'image') {
                      const url = data[f.field_key];
                      if (url && typeof url === 'string' && url.trim())
                        entries.push({ label: f.label, url: url.trim() });
                    }
                  });
                  return entries.length ? { name: proc.name, entries } : null;
                })
                .filter(Boolean) as { name: string; entries: { label: string; url: string }[] }[];
              const hasGenericPhotos = genericPhotosByProc.some((p) => p.entries.length > 0);
              if (!hasBotoxPhotos && !hasEmagrecimentoPhotos && !hasGenericPhotos) {
                return (
                  <p className="text-sm text-muted-foreground py-4 text-center rounded-xl border border-dashed border-muted-foreground/30 bg-muted/10">
                    Nenhuma foto adicionada nesta sessão.
                  </p>
                );
              }
              return (
                <div className="space-y-4">
                  {hasBotoxPhotos && (
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2">Botox</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {botoxFotoAntes && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Foto antes da sessão</p>
                            <a
                              href={botoxFotoAntes}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-xl border border-input overflow-hidden bg-muted/20 hover:opacity-90 transition-opacity"
                            >
                              <img
                                src={botoxFotoAntes}
                                alt="Antes da sessão"
                                className="w-full aspect-square object-cover"
                                decoding="async"
                                loading="lazy"
                              />
                            </a>
                          </div>
                        )}
                        {botoxFotoDepois && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Foto depois da sessão</p>
                            <a
                              href={botoxFotoDepois}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-xl border border-input overflow-hidden bg-muted/20 hover:opacity-90 transition-opacity"
                            >
                              <img
                                src={botoxFotoDepois}
                                alt="Depois da sessão"
                                className="w-full aspect-square object-cover"
                                decoding="async"
                                loading="lazy"
                              />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {hasEmagrecimentoPhotos && (
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2">Emagrecimento / Redução de Medidas</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {emagrecimentoDepoisFrente && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Depois — Frente</p>
                            <a
                              href={emagrecimentoDepoisFrente}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-xl border border-input overflow-hidden bg-muted/20 hover:opacity-90 transition-opacity"
                            >
                              <img
                                src={emagrecimentoDepoisFrente}
                                alt="Depois Frente"
                                decoding="async"
                                loading="lazy"
                                className="w-full aspect-square object-cover"
                              />
                            </a>
                          </div>
                        )}
                        {emagrecimentoDepoisLado && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Depois — Lado</p>
                            <a
                              href={emagrecimentoDepoisLado}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-xl border border-input overflow-hidden bg-muted/20 hover:opacity-90 transition-opacity"
                            >
                              <img
                                src={emagrecimentoDepoisLado}
                                alt="Depois Lado"
                                decoding="async"
                                loading="lazy"
                                className="w-full aspect-square object-cover"
                              />
                            </a>
                          </div>
                        )}
                        {emagrecimentoDepoisCostas && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Depois — Costas</p>
                            <a
                              href={emagrecimentoDepoisCostas}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-xl border border-input overflow-hidden bg-muted/20 hover:opacity-90 transition-opacity"
                            >
                              <img
                                src={emagrecimentoDepoisCostas}
                                alt="Depois Costas"
                                decoding="async"
                                loading="lazy"
                                className="w-full aspect-square object-cover"
                              />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {genericPhotosByProc.map(({ name, entries }) => (
                    <div key={name}>
                      <p className="text-sm font-medium text-foreground mb-2">{name}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {entries.map(({ label, url }) => (
                          <div key={label} className="space-y-1">
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-xl border border-input overflow-hidden bg-muted/20 hover:opacity-90 transition-opacity"
                            >
                              <img
                                src={url}
                                alt={label}
                                decoding="async"
                                loading="lazy"
                                className="w-full aspect-square object-cover"
                              />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
        )}

        {/* Termos e assinatura */}
        {requiredTermSlugs.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Termos e assinatura digital
              </CardTitle>
              <CardDescription>
                Leia cada termo e capture a assinatura do paciente e do profissional. Obrigatório para finalizar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {terms.map((term) => (
                <div key={term.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">{term.title}</h3>
                    {signedTerms[term.slug] ? (
                      <span className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Assinado
                      </span>
                    ) : null}
                  </div>
                  <div className="max-h-[420px] overflow-y-auto overflow-x-hidden rounded border border-input bg-muted/20 p-4 text-sm text-foreground/90 whitespace-pre-wrap break-words">
                    {term.body
                      .replace(/__NOME_PACIENTE__/g, patient?.full_name ?? '_________________________')
                      .replace(/__CPF__/g, patient?.cpf ?? '_________________________')
                      .replace(/__PROFISSIONAL__/g, profile?.full_name ?? '_________________________')
                      .replace(/__DATA__/g, format(new Date(), "d 'de' MMMM yyyy", { locale: ptBR }))
                      .replace(/__COREN__/g, [profile?.professional_registry_body, profile?.professional_registry_number].filter(Boolean).join(' ') ?? '_________________________')
                      .replace(/__IDADE__/g, patient?.date_of_birth ? String(differenceInYears(new Date(), parseLocalDate(patient.date_of_birth))) : '______')
                      .replace(/__TELEFONE__/g, patient?.phone ?? '______')
                      .replace(/__CIDADE__/g, patient?.city ?? '______')
                      .replace(/__ENDERECO__/g, patient?.address ?? '______')}
                  </div>
                  {!signedTerms[term.slug] ? (
                    <SignaturePad
                      label="Assinatura do paciente"
                      onSave={(dataUrl) => handleSignTerm(term.slug, dataUrl)}
                      height={160}
                    />
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <img src={signedTerms[term.slug]} alt="Assinatura do paciente" className="h-16 w-auto border rounded bg-muted/30 shrink-0" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full min-w-0 whitespace-normal text-left sm:w-auto sm:text-center"
                        onClick={() => setSignedTerms((prev) => ({ ...prev, [term.slug]: '' }))}
                      >
                        Refazer assinatura
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {requiredTermSlugs.length > 0 && (
                <div className="rounded-lg border p-4 space-y-3">
                  <h3 className="font-semibold text-foreground">Assinatura do profissional</h3>
                  {!signedProfessionalSignature ? (
                    <>
                      {profile?.default_signature_data && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setSignedProfessionalSignature(profile.default_signature_data!)}
                          >
                            Usar minha assinatura padrão
                          </Button>
                          <span className="text-xs text-muted-foreground">ou assine abaixo</span>
                        </div>
                      )}
                      <SignaturePad
                        label="Assinatura do profissional"
                        onSave={setSignedProfessionalSignature}
                        height={160}
                      />
                    </>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <img src={signedProfessionalSignature} alt="Assinatura do profissional" className="h-16 w-auto border rounded bg-muted/30 shrink-0" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-w-0 whitespace-normal text-left sm:text-center"
                        onClick={() => setSignedProfessionalSignature('')}
                      >
                        Refazer assinatura do profissional
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-3 hidden md:flex">
          <Button type="submit" disabled={saving || !allRequiredTermsSigned} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {submitLabel}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to={cancelHref}>Cancelar</Link>
          </Button>
        </div>
      </form>

      {/* Mobile: rodapé fixo acima da bottom nav — Cancelar e Finalizar consulta */}
      <div
        className="md:hidden fixed left-0 right-0 z-[1105] p-3 bg-background/95 backdrop-blur border-t border-border"
        style={{ bottom: 'max(64px, calc(64px + env(safe-area-inset-bottom)))' }}
      >
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-14 gap-2 rounded-xl font-medium min-h-[44px] touch-manipulation" asChild>
            <Link to={cancelHref}>Cancelar</Link>
          </Button>
          <Button
            type="button"
            className="flex-1 h-14 gap-2 rounded-xl font-medium min-h-[44px] touch-manipulation"
            onClick={handleFinalize}
            disabled={saving || !allRequiredTermsSigned}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            {submitLabel}
          </Button>
        </div>
      </div>

      {/* Popup agenda: data da sessão + prazo (dias) */}
      {profile?.id && patientId && (
        <Dialog
          open={agendaPopupOpen}
          onOpenChange={(open) => {
            if (!open) {
              setAgendaPopupOpen(false);
              setTargetAgendaDate(null);
              setConfirmSlotTime(null);
            }
          }}
        >
          <DialogContent
            className={
              agendaOpenMode === 'dia'
                ? 'sm:max-w-sm'
                : 'sm:max-w-lg w-[calc(100vw-1.5rem)] max-h-[min(90vh,640px)] flex flex-col'
            }
          >
            <DialogHeader>
              <DialogTitle>
                {agendaOpenMode === 'dia'
                  ? 'Horários disponíveis'
                  : agendaOpenMode === 'semana'
                    ? 'Agenda da semana'
                    : 'Agenda do mês'}
              </DialogTitle>
              <DialogDescription>
                {targetAgendaDate
                  ? agendaOpenMode === 'dia'
                    ? format(targetAgendaDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : `Escolha um horário livre. Referência: ${format(targetAgendaDate, "d 'de' MMMM", { locale: ptBR })}.`
                  : 'Carregando…'}
              </DialogDescription>
            </DialogHeader>
            {agendaOpenMode !== 'dia' && targetAgendaDate ? (
              <AgendaWeekSlotsContent
                anchorDate={targetAgendaDate}
                scope={agendaOpenMode === 'semana' ? 'week' : 'month'}
                profile={profile}
                professionalId={profile.id}
                saving={savingAppointment}
                onConfirmBooking={(d, t) => void confirmConsultationAt(d, t)}
                onCancelConfirm={() => {}}
                clinicClosedDates={clinicClosedDates}
              />
            ) : loadingAgendaDay ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : targetAgendaDate ? (
              <AgendaDaySlotsContent
                targetDate={targetAgendaDate}
                profile={profile}
                agendaDayAppointments={agendaDayAppointments}
                confirmSlotTime={confirmSlotTime}
                onSelectSlot={setConfirmSlotTime}
                onConfirm={handleConfirmConsultationAppointment}
                onCancelConfirm={() => setConfirmSlotTime(null)}
                saving={savingAppointment}
                clinicClosedDates={clinicClosedDates}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
