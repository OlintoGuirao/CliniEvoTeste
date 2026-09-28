import { Fragment, useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentPatient } from '@/contexts/CurrentPatientContext';
import { supabase } from '@/integrations/supabase/client';
import { getProceduresForProfile } from '@/lib/proceduresForProfile';
import { resolveBranchIdForInsert } from '@/lib/resolveBranchIdForInsert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { TreatmentDetailHeader } from '@/components/TreatmentDetailHeader';
import { Plus, Loader2, Calendar, BarChart3, ImageIcon, Trash2, TrendingDown, TrendingUp, Minus, Pencil, ChevronDown, ChevronUp, UserPlus, Bell, CalendarPlus, Wallet } from 'lucide-react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { format, addDays, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/utils';
import {
  deleteProcedureSessionById,
  deleteProcedureInstanceIfNoSessions,
} from '@/lib/procedureSessionDelete';
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
import type { AgendaOpenMode } from '@/lib/agendaPreferences';
import { fetchProfessionalUiSettings } from '@/services/api/dynamicProcedureFieldSettingsApi';
import { PhotoUploadField } from '@/components/PhotoUploadField';
import { BotoxFacialMap, type FacialPoint, type FacialStroke } from '@/components/BotoxFacialMap';
import { resolveApplicationMapProps, shouldShowApplicationMapInSession, shouldShowTerapiaCapilarScalpMap } from '@/lib/dynamicProcedureFields/consultationFieldLayout';
import { AntesDepoisCard } from '@/components/AntesDepoisCard';
import { BeforeAfterGalleryCard, type BeforeAfterGalleryValue } from '@/components/consultation/BeforeAfterGalleryCard';
import { AgendaDaySlotsContent } from '@/components/AgendaDaySlotsContent';
import { AgendaWeekSlotsContent } from '@/components/AgendaWeekSlotsContent';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { CollapsibleSection, ProcedureSummary, type ProcedureSummaryData } from '@/components/procedure-detail';
import type { Database, Json } from '@/integrations/supabase/types';
import type { FormaPagamento } from '@/types/faturamento';
import { FORMA_PAGAMENTO_LABEL } from '@/types/faturamento';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { buildEvolutionPdf, formatPhoneForWhatsApp, type EvolutionPdfResultWithUpload } from '@/lib/evolutionPdf';
import { calcImc, EVOLUCAO_METRICAS } from '@/lib/emagrecimentoRelatorio';
import {
  buildEmagrecimentoReportWhatsAppMessage,
  buildProcedureReportWhatsAppMessage,
  openWhatsAppWithFallback,
} from '@/lib/reportShare';
import { loadWhatsappManualTemplates } from '@/lib/loadWhatsappManualTemplates';
import type { jsPDF } from 'jspdf';
import { FileText } from 'lucide-react';

type ProcedureRow = Database['public']['Tables']['procedures']['Row'];
type ProcedureFieldRow = Database['public']['Tables']['procedure_fields']['Row'];

/** Slots "Depois" (Frente, Lado, Costas) — Antes = dados iniciais da 1ª sessão */
const EMAGRECIMENTO_DEPOIS_SLOTS: { value: string; label: string }[] = [
  { value: 'depois_frente', label: 'Depois - Frente' },
  { value: 'depois_lado', label: 'Depois - Lado' },
  { value: 'depois_costas', label: 'Depois - Costas' },
];

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

/** Procedimentos que exibem mapa de pontos de aplicação na sessão */
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

/** Quantidade de campos mostrados antes de "Mostrar tudo" (dados iniciais/atualizados genéricos) */
const INITIAL_PREVIEW_FIELDS = 6;
const CONSULTATION_DRAFT_KEY = 'consultation-session-draft';
const TIMELINE_ICON_URLS = {
  abdomen: '/Abdomen.png',
  braco: '/Braco.png',
  busto: '/Busto.png',
  cintura: '/Cintura.png',
  peso: '/Peso.png',
  protocolo: '/Protocolo.png',
  seringa: '/Seringa.png',
  quadril: '/Quadril.png',
} as const;

function formatImc(value: unknown): string {
  if (value == null || typeof value !== 'number' || !Number.isFinite(value)) return '';
  return value.toFixed(1);
}
type InstanceRow = Database['public']['Tables']['procedure_instances']['Row'];
type SessionRow = Database['public']['Tables']['procedure_sessions']['Row'];
type ResultRow = Database['public']['Tables']['procedure_results']['Row'];
type PhotoRow = Database['public']['Tables']['procedure_photos']['Row'];
type RecebimentoRow = Database['public']['Tables']['recebimentos']['Row'];

function renderSessionField(
  field: ProcedureFieldRow,
  value: unknown,
  onChange: (key: string, value: unknown) => void
) {
  const key = field.field_key;
  const label = key === 'ml' ? 'mg' : field.label;
  const type = field.field_type;
  const options = (field.options as string[]) ?? [];

  if (type === 'text') {
    return (
      <div key={field.id} className="space-y-2">
        <Label>{label}</Label>
        <Input
          value={(value as string) ?? ''}
          onChange={(e) => onChange(key, e.target.value)}
          placeholder={label}
        />
      </div>
    );
  }
  if (type === 'number') {
    if (key === 'imc') {
      return (
        <div key={field.id} className="space-y-2">
          <Label>{label}</Label>
          <Input
            type="text"
            value={formatImc(value)}
            readOnly
            className="bg-muted"
            placeholder="Preencha peso e altura"
          />
        </div>
      );
    }
    return (
      <div key={field.id} className="space-y-2">
        <Label>{label}</Label>
        <Input
          type="number"
          value={(value as number) ?? ''}
          onChange={(e) => onChange(key, e.target.value === '' ? null : Number(e.target.value))}
          placeholder={label}
        />
      </div>
    );
  }
  if (type === 'date') {
    return (
      <div key={field.id} className="space-y-2">
        <Label>{label}</Label>
        <Input
          type="date"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(key, e.target.value || null)}
        />
      </div>
    );
  }
  if (type === 'boolean') {
    return (
      <div key={field.id} className="flex items-center gap-2">
        <input
          type="checkbox"
          id={key}
          checked={!!value}
          onChange={(e) => onChange(key, e.target.checked)}
          className="rounded border-input"
        />
        <Label htmlFor={key}>{label}</Label>
      </div>
    );
  }
  if (type === 'select') {
    return (
      <div key={field.id} className="space-y-2">
        <Label>{label}</Label>
        <Select
          value={(value as string) ?? ''}
          onValueChange={(v) => onChange(key, v)}
        >
          <SelectTrigger>
            <SelectValue placeholder={label} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (type === 'select_multi') {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div key={field.id} className="space-y-2">
        <Label>{label}</Label>
        <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
          {options.map((opt) => {
            const checked = selected.includes(opt);
            return (
              <div key={opt} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`${key}-${opt}`}
                  checked={checked}
                  onChange={(e) => {
                    const on = e.target.checked;
                    const next = on ? [...selected, opt] : selected.filter((v) => v !== opt);
                    onChange(key, next);
                  }}
                  className="rounded border-input"
                />
                <Label htmlFor={`${key}-${opt}`}>{opt}</Label>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div key={field.id} className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={(value as string) ?? ''}
        onChange={(e) => onChange(key, e.target.value)}
        placeholder="URL ou caminho"
      />
    </div>
  );
}

type GalleryPairMaps = {
  galleryBeforeByIndex: Map<number, PhotoRow>;
  galleryAfterByIndex: Map<number, PhotoRow>;
  galleryPairIndexes: number[];
  captionByUrlPair: Map<string, string>;
  nonGalleryPhotos: PhotoRow[];
};

function buildGalleryPairMaps(otherPhotos: PhotoRow[], sessions: SessionRow[]): GalleryPairMaps {
  const galleryBeforeByIndex = new Map<number, PhotoRow>();
  const galleryAfterByIndex = new Map<number, PhotoRow>();
  const nonGalleryPhotos: PhotoRow[] = [];
  otherPhotos.forEach((p) => {
    const beforeMatch = /^gallery_before_(\d+)$/.exec(p.photo_type ?? '');
    if (beforeMatch) {
      galleryBeforeByIndex.set(Number(beforeMatch[1]), p);
      return;
    }
    const afterMatch = /^gallery_after_(\d+)$/.exec(p.photo_type ?? '');
    if (afterMatch) {
      galleryAfterByIndex.set(Number(afterMatch[1]), p);
      return;
    }
    nonGalleryPhotos.push(p);
  });
  const galleryPairIndexes = Array.from(
    new Set([...galleryBeforeByIndex.keys(), ...galleryAfterByIndex.keys()])
  ).sort((a, b) => a - b);
  const captionByUrlPair = new Map<string, string>();
  sessions.forEach((s) => {
    if (!s.data || typeof s.data !== 'object') return;
    const galleryData = (s.data as Record<string, unknown>).galeria_antes_depois;
    if (!galleryData || typeof galleryData !== 'object') return;
    const pairs = (galleryData as { pairs?: Array<{ before_url?: string | null; after_url?: string | null; caption?: string }> }).pairs;
    if (!Array.isArray(pairs)) return;
    pairs.forEach((pair) => {
      const beforeUrl = typeof pair?.before_url === 'string' ? pair.before_url.trim() : '';
      const afterUrl = typeof pair?.after_url === 'string' ? pair.after_url.trim() : '';
      const caption = typeof pair?.caption === 'string' ? pair.caption.trim() : '';
      if (!beforeUrl || !afterUrl || !caption) return;
      captionByUrlPair.set(`${beforeUrl}|||${afterUrl}`, caption);
    });
  });
  return { galleryBeforeByIndex, galleryAfterByIndex, galleryPairIndexes, captionByUrlPair, nonGalleryPhotos };
}

/** Ordem das fotos “Antes” e “Depois” alinhada à ordem atual dos índices de par. */
function photoListsFromPairIndexOrder(pairIndexOrder: number[], maps: GalleryPairMaps): { beforeList: PhotoRow[]; afterList: PhotoRow[] } {
  const beforeList: PhotoRow[] = [];
  const afterList: PhotoRow[] = [];
  for (const idx of pairIndexOrder) {
    const b = maps.galleryBeforeByIndex.get(idx);
    if (b) beforeList.push(b);
  }
  for (const idx of pairIndexOrder) {
    const a = maps.galleryAfterByIndex.get(idx);
    if (a) afterList.push(a);
  }
  return { beforeList, afterList };
}

function galleryBeforeSortableId(photoId: string): string {
  return `gb-${photoId}`;
}

function galleryAfterSortableId(photoId: string): string {
  return `ga-${photoId}`;
}

function SortableGallerySinglePhoto({
  photo,
  side,
  embedInPair,
}: {
  photo: PhotoRow;
  side: 'before' | 'after';
  /** Mesmo visual dos pares na grade (Antes | Depois dentro do cartão) */
  embedInPair?: boolean;
}) {
  const id = side === 'before' ? galleryBeforeSortableId(photo.id) : galleryAfterSortableId(photo.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.88 : 1,
  };
  const dragProps = { ...attributes, ...listeners };
  const label = side === 'before' ? 'Antes' : 'Depois';
  if (embedInPair) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="rounded-md border overflow-hidden bg-card select-none cursor-grab touch-none active:cursor-grabbing min-h-0"
        {...dragProps}
        aria-label={`Arraste para reordenar foto ${label}`}
      >
        <p className="text-[11px] text-muted-foreground px-2 py-1 text-center border-b border-dashed border-border/60">
          {label}
        </p>
        <div className="block aspect-square bg-muted overflow-hidden">
          <img src={photo.file_url} alt="" className="w-full h-full object-cover" decoding="async" loading="lazy" />
        </div>
      </div>
    );
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border overflow-hidden bg-card select-none cursor-grab touch-none active:cursor-grabbing"
      {...dragProps}
      aria-label={`Arraste para reordenar foto ${label}`}
    >
      <p className="text-[11px] text-muted-foreground px-2 py-1 text-center border-b bg-muted/30">{label}</p>
      <div className="block aspect-square bg-muted overflow-hidden">
        <img src={photo.file_url} alt="" className="w-full h-full object-cover" decoding="async" loading="lazy" />
      </div>
    </div>
  );
}

export default function ProcedureInstanceDetailPage() {
  const { slug, instanceId } = useParams<{ slug: string; instanceId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const { setPatientId: setCurrentPatientId } = useCurrentPatient();
  const [procedure, setProcedure] = useState<ProcedureRow | null>(null);
  const [instance, setInstance] = useState<InstanceRow | null>(null);
  const [patientName, setPatientName] = useState<string>('');
  const [patientPhone, setPatientPhone] = useState<string | null>(null);
  const [patientTreatmentStartDate, setPatientTreatmentStartDate] = useState<string | null>(null);
  const [fields, setFields] = useState<ProcedureFieldRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const firstSession = sessions.length > 0 ? sessions[sessions.length - 1]! : null;
  const latestSession = sessions.length > 0 ? sessions[0]! : null;
  const [results, setResults] = useState<ResultRow[]>([]);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  /** ID da sessão em edição; null = nova sessão */
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionFormData, setSessionFormData] = useState<Record<string, unknown>>({});
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sessionObservacoes, setSessionObservacoes] = useState('');
  const [savingSession, setSavingSession] = useState(false);
  const [loadingSessionBilling, setLoadingSessionBilling] = useState(false);
  const [sessionBilling, setSessionBilling] = useState<{
    recebimentoId: string | null;
    valor: string;
    forma_pagamento: FormaPagamento;
    parcelas: number;
  }>({
    recebimentoId: null,
    valor: '',
    forma_pagamento: 'pix',
    parcelas: 1,
  });
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [visualCompareOpen, setVisualCompareOpen] = useState(false);
  const [photoType, setPhotoType] = useState('evolucao');
  const [photoUrl, setPhotoUrl] = useState('');
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [expandedMeasuresIds, setExpandedMeasuresIds] = useState<Set<string>>(new Set());
  const [showSessionTimeline, setShowSessionTimeline] = useState(false);
  const [selectedTimelineSessionId, setSelectedTimelineSessionId] = useState<string | null>(null);
  /** Botox: lembrete de reaplicação */
  const [botoxDueDays, setBotoxDueDays] = useState<string>('');
  const [botoxReminders, setBotoxReminders] = useState<Array<{ id: string; due_date: string; notified_at: string | null }>>([]);
  const [savingBotoxReminder, setSavingBotoxReminder] = useState(false);
  /** Popup de horários (data escolhida = hoje + dias) */
  const [agendaPopupOpen, setAgendaPopupOpen] = useState(false);
  const [agendaContext, setAgendaContext] = useState<'botox' | 'emagrecimento' | null>(null);
  const [targetAgendaDate, setTargetAgendaDate] = useState<Date | null>(null);
  /** Emagrecimento: prazo em dias para próxima avaliação */
  const [emagrecimentoDueDays, setEmagrecimentoDueDays] = useState<string>('');
  /** Próxima avaliação (demais procedimentos): prazo em dias */
  const [proximaAvaliacaoDias, setProximaAvaliacaoDias] = useState<string>('');
  const [agendaDayAppointments, setAgendaDayAppointments] = useState<Array<{ appointment_date: string; start_time: string }>>([]);
  const [loadingAgendaDay, setLoadingAgendaDay] = useState(false);
  const [confirmSlotTime, setConfirmSlotTime] = useState<string | null>(null);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [agendaOpenMode, setAgendaOpenMode] = useState<AgendaOpenMode>('dia');
  const [useMaxWeightReference, setUseMaxWeightReference] = useState(false);
  const [showAllInitialData, setShowAllInitialData] = useState(false);
  const [showAllUpdatedData, setShowAllUpdatedData] = useState(false);
  const [evolucaoMedidasMode, setEvolucaoMedidasMode] = useState<'geral' | 'sessao'>('geral');
  const [exportingPdf, setExportingPdf] = useState(false);
  /** Compartilhamento web: gera link público e abre WhatsApp sem ir para página intermediária. */
  const [sharingWebReport, setSharingWebReport] = useState(false);
  const [editingGallery, setEditingGallery] = useState<BeforeAfterGalleryValue>({
    beforeImages: [],
    afterImages: [],
    pairs: [],
  });
  /** Reordenar fotos gallery_before_* / gallery_after_* individualmente (colunas alinhadas por linha) */
  const [galleryPairOrderEdit, setGalleryPairOrderEdit] = useState(false);
  const [galleryBeforeOrderDraft, setGalleryBeforeOrderDraft] = useState<PhotoRow[]>([]);
  const [galleryAfterOrderDraft, setGalleryAfterOrderDraft] = useState<PhotoRow[]>([]);
  const [savingGalleryPairOrder, setSavingGalleryPairOrder] = useState(false);
  const galleryPairReorderSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  /** No mobile: última sessão pode ser ocultada com o botão "Ocultar medidas" */
  const [latestSessionMeasuresCollapsed, setLatestSessionMeasuresCollapsed] = useState(false);

  const instanceData = ((instance as { data?: Record<string, unknown> } | null)?.data ?? {}) as Record<string, unknown>;

  const buildGalleryFromSessionPhotos = useCallback(
    (sessionId: string): BeforeAfterGalleryValue => {
      const sessionRow = sessions.find((s) => s.id === sessionId);
      const sessionData =
        (sessionRow?.data && typeof sessionRow.data === 'object'
          ? (sessionRow.data as Record<string, unknown>)
          : {}) ?? {};
      const galleryData =
        (sessionData.galeria_antes_depois &&
        typeof sessionData.galeria_antes_depois === 'object'
          ? (sessionData.galeria_antes_depois as { pairs?: Array<{ caption?: string }> })
          : null);
      const savedPairs = Array.isArray(galleryData?.pairs) ? galleryData!.pairs! : [];
      const sessionGalleryPhotos = photos.filter(
        (p) =>
          p.procedure_session_id === sessionId &&
          typeof p.photo_type === 'string' &&
          p.photo_type.startsWith('gallery_') &&
          typeof p.file_url === 'string' &&
          p.file_url.trim()
      );
      const before = sessionGalleryPhotos
        .filter((p) => p.photo_type.startsWith('gallery_before_'))
        .sort((a, b) => a.photo_type.localeCompare(b.photo_type))
        .map((p) => ({ id: p.id, url: p.file_url }));
      const after = sessionGalleryPhotos
        .filter((p) => p.photo_type.startsWith('gallery_after_'))
        .sort((a, b) => a.photo_type.localeCompare(b.photo_type))
        .map((p) => ({ id: p.id, url: p.file_url }));
      const pairCount = Math.min(before.length, after.length);
      return {
        beforeImages: before,
        afterImages: after,
        pairs: Array.from({ length: pairCount }).map((_, idx) => ({
          id: `pair-${before[idx]?.id ?? idx}-${after[idx]?.id ?? idx}`,
          beforeImageId: before[idx]?.id ?? '',
          afterImageId: after[idx]?.id ?? '',
          caption:
            typeof savedPairs[idx]?.caption === 'string'
              ? savedPairs[idx].caption ?? ''
              : '',
        })),
      };
    },
    [photos, sessions]
  );

  /** Mesma regra de `visiblePhotos` da comparação visual (exceto emagrecimento), para pares galeria */
  const galleryReorderSource = useMemo((): GalleryPairMaps | null => {
    if (slug === 'emagrecimento-reducao-medidas' || photos.length === 0) return null;
    const validSessionIds = new Set(sessions.map((s) => s.id));
    const visiblePhotos = photos.filter((p) => {
      const isBeforeAfter = p.photo_type === 'antes' || p.photo_type === 'depois';
      const hasValidSession = typeof p.procedure_session_id === 'string' && validSessionIds.has(p.procedure_session_id);
      if (isBeforeAfter) return hasValidSession;
      return p.procedure_session_id == null || hasValidSession;
    });
    const otherPhotos = visiblePhotos.filter((p) => p.photo_type !== 'antes' && p.photo_type !== 'depois');
    return buildGalleryPairMaps(otherPhotos, sessions);
  }, [slug, photos, sessions]);

  const activeFields = useMemo(
    () => fields.filter((f) => ((f as unknown as { active?: boolean }).active ?? true)),
    [fields]
  );
  const isBotoxRegiaoTratadaVisible = useMemo(() => {
    if (slug !== 'botox') return true;
    if (!activeFields.length) return true;
    return activeFields.some((f) => {
      const key = (f.field_key ?? '').trim().toLowerCase();
      const label = (f.label ?? '').trim().toLowerCase();
      return key === 'regiao_tratada' || key === 'região_tratada' || label === 'regiao tratada' || label === 'região tratada';
    });
  }, [activeFields, slug]);
  const visibleBotoxRegions = useMemo(() => {
    if (slug !== 'botox') return BOTOX_REGIOES;
    if (!activeFields.length) return BOTOX_REGIOES;
    const activeKeys = new Set(activeFields.map((f) => (f.field_key ?? '').trim().toLowerCase()));
    const hasPerRegionConfig = BOTOX_REGIOES.some((r) => activeKeys.has(`botox_regiao_${r.key}`));
    if (!hasPerRegionConfig) return BOTOX_REGIOES;
    return BOTOX_REGIOES.filter((r) => activeKeys.has(`botox_regiao_${r.key}`));
  }, [activeFields, slug]);

  const toggleSessionMeasures = (sessionId: string, isLatest: boolean) => {
    if (isLatest) {
      setLatestSessionMeasuresCollapsed((v) => !v);
    } else {
      setExpandedMeasuresIds((prev) => {
        const next = new Set(prev);
        if (next.has(sessionId)) next.delete(sessionId);
        else next.add(sessionId);
        return next;
      });
    }
  };

  useEffect(() => {
    if (!showSessionTimeline) {
      setSelectedTimelineSessionId(null);
      return;
    }
    if (sessions.length === 0) {
      setSelectedTimelineSessionId(null);
      return;
    }
    if (selectedTimelineSessionId && sessions.some((s) => s.id === selectedTimelineSessionId)) {
      return;
    }
    setSelectedTimelineSessionId(latestSession?.id ?? sessions[0]?.id ?? null);
  }, [showSessionTimeline, sessions, selectedTimelineSessionId, latestSession?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const ui = await fetchProfessionalUiSettings({ professionalId: profile.id });
        if (!cancelled) {
          setAgendaOpenMode(ui.agenda_open_mode);
          setUseMaxWeightReference(ui.use_max_weight_reference);
          setShowSessionTimeline(ui.show_session_timeline);
        }
      } catch {
        if (!cancelled) {
          setAgendaOpenMode('dia');
          setShowSessionTimeline(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  // Ao abrir o diálogo Nova sessão, preencher o formulário com os dados iniciais (ex.: altura_cm). Em modo edição não sobrescreve.
  useEffect(() => {
    if (!sessionDialogOpen) return;
    if (editingSessionId) return;
    setSessionDate(new Date().toISOString().slice(0, 10));
    setSessionObservacoes('');
    const firstSess = sessions.length > 0 ? sessions[sessions.length - 1] : null;
    const dataFromFirst = firstSess ? (firstSess as { data?: Record<string, unknown> }).data : undefined;
    const initial: Record<string, unknown> = { ...(instanceData ?? dataFromFirst ?? {}) };
    if (slug === 'botox') {
      if (!Array.isArray(initial.regiao_tratada)) initial.regiao_tratada = [];
      if (!initial.quantidade_por_ponto || typeof initial.quantidade_por_ponto !== 'object') initial.quantidade_por_ponto = {};
    }
    if (slug === 'preenchimento-facial') {
      Object.assign(initial, ensurePreenchimentoAplicacoesInData(initial));
    }
    if (slug === LIPOENZIMATICA_SLUG) {
      Object.assign(initial, ensureLipoenzimaticaSessionData(initial));
    }
    setSessionFormData((prev) => ({ ...initial, ...prev }));
  }, [sessionDialogOpen, editingSessionId, instanceData, sessions, slug]);

  // IMC automático no formulário de nova sessão: recalcular quando peso_atual ou altura_cm mudar
  useEffect(() => {
    if (!sessionDialogOpen) return;
    const peso = sessionFormData.peso_atual as number | null | undefined;
    const altura = sessionFormData.altura_cm as number | null | undefined;
    const imc = calcImc(peso, altura);
    setSessionFormData((prev) => {
      const current = prev.imc as number | undefined;
      if (imc != null && current === imc) return prev;
      if (imc == null && !('imc' in prev)) return prev;
      const next = { ...prev };
      if (imc != null) next.imc = imc;
      else delete next.imc;
      return next;
    });
  }, [sessionDialogOpen, sessionFormData.peso_atual, sessionFormData.altura_cm]);

  const getFieldLabel = (fieldKey: string) => {
    if (fieldKey === 'peso') return 'Peso (kg)';
    if (fieldKey === 'injetavel') return 'Injetável';
    if (fieldKey === 'produto_usado') return 'Produto usado';
    if (fieldKey === 'ml') return 'mg';
    if (fieldKey === 'pontos_aplicacao') return 'Pontos de aplicação';
    if (fieldKey === 'riscos_aplicacao') return 'Riscos no mapa';
    if (fieldKey === 'lote') return 'Lote';
    if (fieldKey === 'data_aplicacao') return 'Data de aplicação';
    if (fieldKey === 'regiao_tratada') return 'Regiões aplicadas';
    if (fieldKey === 'quantidade_por_ponto') return 'Quantidade por ponto';
    if (fieldKey === 'produto_utilizado') return 'Produto utilizado';
    if (fieldKey === 'numero_pontos_aplicacao') return 'Nº pontos de aplicação';
    if (fieldKey === 'diluicao_utilizada') return 'Diluição utilizada';
    if (fieldKey === 'marca_toxina') return 'Marca da toxina';
    if (fieldKey === 'data_validade') return 'Data de validade';
    if (fieldKey === 'quantidade_unidade') return 'Quantidade (unidade)';
    if (fieldKey === 'abdomen_superior_cm') return 'Abdômen superior (cm)';
    if (fieldKey === 'cintura_cm') return 'Cintura (cm)';
    if (fieldKey === 'abdomen_inferior_cm') return 'Abdômen inferior (cm)';
    if (fieldKey === 'braco_cm') return 'Braço (cm)';
    if (fieldKey === 'busto_cm') return 'Busto (cm)';
    if (fieldKey === 'quadril_cm') return 'Quadril (cm)';
    return fields.find((f) => f.field_key === fieldKey)?.label ?? fieldKey;
  };
  /** Entradas para exibição: Peso sempre primeiro quando existir (peso_inicial ou peso_atual). Emagrecimento: não exibe Injetável no card; quando injetável for Sim (dados atuais ou iniciais), força Produto usado e mg no final, nessa ordem. */
  const sessionDataEntriesForDisplay = (
    data: Record<string, unknown>,
    initialData?: Record<string, unknown>
  ) => {
    let base = sessionDataEntriesNoPhotos(data);
    if (slug === 'emagrecimento-reducao-medidas') {
      const injetavelSim = (data.injetavel as string) === 'Sim';
      const injetavelSimInicial = initialData != null && (initialData.injetavel as string) === 'Sim';
      const showInjectableFields = injetavelSim || injetavelSimInicial;
      // Remove o card "Injetável" dos grids e controla a ordem dos campos do injetável.
      base = base.filter(([key]) => key !== 'injetavel' && key !== 'produto_usado' && key !== 'ml');
      if (showInjectableFields) {
        base.push(['produto_usado', data.produto_usado ?? '']);
        base.push(['ml', data.ml ?? '']);
      }
    }
    // Pontos e riscos no mapa não vão para o grid (exibidos no mapa visual da sessão)
    base = base.filter(([key]) => key !== 'pontos_aplicacao' && key !== 'riscos_aplicacao');
    const pesoVal = data.peso_atual ?? data.peso_inicial;
    if (pesoVal != null && pesoVal !== '') {
      const rest = base.filter(([k]) => k !== 'peso_atual' && k !== 'peso_inicial');
      return [['peso', pesoVal] as [string, unknown], ...rest];
    }
    return base;
  };
  const formatSessionValue = (key: string, val: unknown) => {
    if (key === 'imc' && typeof val === 'number' && Number.isFinite(val)) return val.toFixed(1);
    if (key === 'regiao_tratada' && Array.isArray(val) && val.length > 0) {
      return val
        .map((k) => BOTOX_REGIOES.find((r) => r.key === k)?.label ?? String(k))
        .filter(Boolean)
        .join(', ');
    }
    if (key === 'quantidade_por_ponto' && val != null && typeof val === 'object' && !Array.isArray(val)) {
      const obj = val as Record<string, string | number>;
      return Object.entries(obj)
        .map(([k, v]) => {
          const label = BOTOX_REGIOES.find((r) => r.key === k)?.label ?? k;
          return `${label}: ${v ?? '—'}`;
        })
        .join(' · ');
    }
    if (Array.isArray(val)) {
      return val.map((v) => String(v)).join(', ');
    }
    const dateKeys = ['data_aplicacao', 'session_date', 'data_inicio', 'due_date', 'data_validade'];
    const strVal = val != null && val !== '' ? String(val) : '';
    if (dateKeys.includes(key) && /^\d{4}-\d{2}-\d{2}/.test(strVal)) {
      return format(parseLocalDate(strVal), 'dd/MM/yyyy', { locale: ptBR });
    }
    if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(strVal)) {
      return format(parseLocalDate(strVal.slice(0, 10)), 'dd/MM/yyyy', { locale: ptBR });
    }
    return strVal || '';
  };

  const summaryData: ProcedureSummaryData | null = useMemo(() => {
    if (sessions.length < 1 || !firstSession || !latestSession) return null;
    const firstData = (firstSession.data as Record<string, unknown>) ?? {};
    const latestData = (latestSession.data as Record<string, unknown>) ?? {};
    const toNum = (v: unknown): number | null => {
      if (v == null || v === '') return null;
      const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '.'));
      return Number.isFinite(n) ? n : null;
    };
    const pesoFirst = toNum(firstData.peso_atual);
    const pesoLatest = toNum(latestData.peso_atual);
    const historicWeights = sessions
      .map((s) => ((s.data as Record<string, unknown> | null)?.peso_atual))
      .map((v) => toNum(v))
      .filter((v): v is number => v != null);
    if (pesoFirst != null) historicWeights.push(pesoFirst);
    const maxHistoricWeight = historicWeights.length ? Math.max(...historicWeights) : null;
    const baseWeight = useMaxWeightReference ? maxHistoricWeight : pesoFirst;
    const pesoTotalKg = baseWeight != null && pesoLatest != null ? pesoLatest - baseWeight : null;
    const measureKeys = EVOLUCAO_METRICAS.filter((m) => m.unit !== 'kg').map((m) => m.key);
    const diffs: number[] = [];
    measureKeys.forEach((key) => {
      const f = toNum(firstData[key]);
      const l = toNum(latestData[key]);
      if (f != null && l != null) diffs.push(f - l);
    });
    const reducaoMediaCm = diffs.length > 0 ? diffs.reduce((a, b) => a + b, 0) / diffs.length : null;
    const tempoTratamentoDias =
      firstSession.session_date && latestSession.session_date
        ? Math.max(0, differenceInDays(parseLocalDate(latestSession.session_date), parseLocalDate(firstSession.session_date)))
        : 0;
    const hasOwn = (obj: Record<string, unknown>, key: string): boolean =>
      Object.prototype.hasOwnProperty.call(obj, key);
    const pickLatestThenFirst = (key: string): unknown => {
      if (hasOwn(latestData, key)) return latestData[key];
      return firstData[key];
    };
    const temCampoRegiaoTratada = fields.some((f) => f.field_key === 'regiao_tratada');
    let regiaoTratada: string | null = null;
    if (temCampoRegiaoTratada) {
      const val = pickLatestThenFirst('regiao_tratada');
      if (Array.isArray(val) && val.length > 0) {
        regiaoTratada = val
          .map((k) => BOTOX_REGIOES.find((r) => r.key === k)?.label ?? String(k))
          .filter(Boolean)
          .join(', ');
      } else if (val != null && String(val).trim() !== '') {
        regiaoTratada = String(val).trim();
      }
    }
    const produtoRaw = pickLatestThenFirst('produto_utilizado');
    const produtoUtilizado = slug === 'botox' && produtoRaw != null ? String(produtoRaw).trim() || null : undefined;
    return {
      pesoTotalKg,
      reducaoMediaCm,
      sessoesRealizadas: sessions.length,
      tempoTratamentoDias,
      regiaoTratada: temCampoRegiaoTratada ? regiaoTratada : undefined,
      produtoUtilizado: slug === 'botox' ? (produtoUtilizado ?? null) : undefined,
    };
  }, [sessions, sessions.length, firstSession, latestSession, fields, slug, useMaxWeightReference]);

  const loadProcedure = useCallback(async () => {
    if (!slug || !profile?.id) return;
    const procs = await getProceduresForProfile(profile.id);
    const data = procs.find((p) => p.slug === slug);
    setProcedure((data as ProcedureRow) ?? null);
    if (data?.id) {
      const { data: fieldsData } = await supabase
        .from('procedure_fields')
        .select('*')
        .eq('procedure_id', data.id)
        .order('sort_order');
      setFields((fieldsData ?? []) as ProcedureFieldRow[]);
    } else {
      setFields([]);
    }
  }, [slug, profile?.id]);

  const loadInstance = useCallback(async () => {
    if (!instanceId) return;
    const { data: instData } = await supabase
      .from('procedure_instances')
      .select('*')
      .eq('id', instanceId)
      .single();
    setInstance((instData as InstanceRow) ?? null);
    if (instData?.patient_id) {
      const { data: pat } = await supabase
        .from('patients')
        .select('full_name, phone, treatment_start_date')
        .eq('id', (instData as { patient_id: string }).patient_id)
        .single();
      const p = pat as { full_name: string; phone: string | null; treatment_start_date: string | null } | null;
      setPatientName(p?.full_name ?? '');
      setPatientPhone(p?.phone ?? null);
      setPatientTreatmentStartDate(p?.treatment_start_date ?? null);
    } else {
      setPatientPhone(null);
      setPatientTreatmentStartDate(null);
    }
  }, [instanceId]);

  const loadSessions = useCallback(async () => {
    if (!instanceId) return;
    const { data } = await supabase
      .from('procedure_sessions')
      .select('*')
      .eq('procedure_instance_id', instanceId)
      .order('session_date', { ascending: false });
    setSessions((data ?? []) as SessionRow[]);
  }, [instanceId]);

  const loadResults = useCallback(async () => {
    if (!instanceId) return;
    const { data } = await supabase
      .from('procedure_results')
      .select('*')
      .eq('procedure_instance_id', instanceId)
      .order('created_at', { ascending: false });
    setResults((data ?? []) as ResultRow[]);
  }, [instanceId]);

  const loadPhotos = useCallback(async () => {
    if (!instanceId) return;
    const { data } = await supabase
      .from('procedure_photos')
      .select('*')
      .eq('procedure_instance_id', instanceId)
      .order('created_at', { ascending: false });
    setPhotos((data ?? []) as PhotoRow[]);
  }, [instanceId]);

  const commitGalleryPhotoTypeUpdates = useCallback(
    async (updates: { id: string; photo_type: string }[]) => {
      if (!instanceId || updates.length === 0) return;
      setSavingGalleryPairOrder(true);
      try {
        const phase1 = updates.map((u) =>
          supabase.from('procedure_photos').update({ photo_type: `__reorder_${u.id}` }).eq('id', u.id)
        );
        const r1 = await Promise.all(phase1);
        for (const r of r1) {
          if (r.error) throw r.error;
        }
        const phase2 = updates.map((u) =>
          supabase.from('procedure_photos').update({ photo_type: u.photo_type }).eq('id', u.id)
        );
        const r2 = await Promise.all(phase2);
        for (const r of r2) {
          if (r.error) throw r.error;
        }
        await loadPhotos();
        setGalleryPairOrderEdit(false);
        setGalleryBeforeOrderDraft([]);
        setGalleryAfterOrderDraft([]);
        toast.success('Ordem das fotos atualizada.');
      } catch (e) {
        console.error(e);
        toast.error('Não foi possível salvar a nova ordem das fotos.');
        await loadPhotos();
      } finally {
        setSavingGalleryPairOrder(false);
      }
    },
    [instanceId, loadPhotos]
  );

  const persistGalleryColumnOrder = useCallback(
    async (beforeOrdered: PhotoRow[], afterOrdered: PhotoRow[]) => {
      const updates: { id: string; photo_type: string }[] = [];
      beforeOrdered.forEach((p, i) => updates.push({ id: p.id, photo_type: `gallery_before_${i + 1}` }));
      afterOrdered.forEach((p, i) => updates.push({ id: p.id, photo_type: `gallery_after_${i + 1}` }));
      await commitGalleryPhotoTypeUpdates(updates);
    },
    [commitGalleryPhotoTypeUpdates]
  );

  const onGalleryEditDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const a = String(active.id);
    const o = String(over.id);

    if (a.startsWith('gb-') && o.startsWith('gb-')) {
      const idA = a.slice(3);
      const idO = o.slice(3);
      setGalleryBeforeOrderDraft((draft) => {
        const oldIndex = draft.findIndex((p) => p.id === idA);
        const newIndex = draft.findIndex((p) => p.id === idO);
        if (oldIndex < 0 || newIndex < 0) return draft;
        return arrayMove(draft, oldIndex, newIndex);
      });
      return;
    }

    if (a.startsWith('ga-') && o.startsWith('ga-')) {
      const idA = a.slice(3);
      const idO = o.slice(3);
      setGalleryAfterOrderDraft((draft) => {
        const oldIndex = draft.findIndex((p) => p.id === idA);
        const newIndex = draft.findIndex((p) => p.id === idO);
        if (oldIndex < 0 || newIndex < 0) return draft;
        return arrayMove(draft, oldIndex, newIndex);
      });
    }
  }, []);

  useEffect(() => {
    setGalleryPairOrderEdit(false);
    setGalleryBeforeOrderDraft([]);
    setGalleryAfterOrderDraft([]);
  }, [instanceId, slug]);

  useEffect(() => {
    loadProcedure();
  }, [loadProcedure]);

  useEffect(() => {
    loadInstance();
  }, [loadInstance]);

  const loadBotoxReminders = useCallback(async () => {
    if (!instanceId || !(instance as { patient_id?: string })?.patient_id || !profile?.id) return;
    const { data } = await supabase
      .from('botox_reapplication_reminders')
      .select('id, due_date, notified_at')
      .eq('procedure_instance_id', instanceId)
      .order('due_date', { ascending: false });
    setBotoxReminders((data ?? []) as Array<{ id: string; due_date: string; notified_at: string | null }>);
  }, [instanceId, instance, profile?.id]);

  useEffect(() => {
    const pid = (instance as { patient_id?: string } | null)?.patient_id ?? null;
    setCurrentPatientId(pid);
    return () => setCurrentPatientId(null);
  }, [instance, setCurrentPatientId]);

  useEffect(() => {
    if (instance) {
      setLoading(false);
      loadSessions();
      loadResults();
      loadPhotos();
      if (slug === 'botox') loadBotoxReminders();
    }
  }, [instance, loadSessions, loadResults, loadPhotos, slug, loadBotoxReminders]);

  /** Abrir diálogo Nova sessão quando o header envia ?newSession=1 (botão Nova consulta na tela Emagrecimento). */
  useEffect(() => {
    if (slug !== 'emagrecimento-reducao-medidas') return;
    if (searchParams.get('newSession') === '1') {
      setSessionDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [slug, searchParams, setSearchParams]);

  const handleAddSession = async () => {
    if (!instanceId) return;

    if (slug === LIPOENZIMATICA_SLUG) {
      const lipoError = validateLipoenzimaticaSessionData(sessionFormData as Record<string, unknown>);
      if (lipoError) {
        toast.error(lipoError);
        return;
      }
    }

    if (slug && isNewCustomProcedureSlug(slug)) {
      const customError = validateNewCustomSessionData(slug, sessionFormData as Record<string, unknown>);
      if (customError) {
        toast.error(customError);
        return;
      }
    }

    setSavingSession(true);
    const formPayload =
      slug === 'preenchimento-facial'
        ? serializePreenchimentoFacialSessionData(sessionFormData as Record<string, unknown>)
        : slug === LIPOENZIMATICA_SLUG
          ? serializeLipoenzimaticaSessionData(sessionFormData as Record<string, unknown>)
          : slug && isNewCustomProcedureSlug(slug)
            ? serializeNewCustomSessionData(slug, sessionFormData as Record<string, unknown>)
            : (sessionFormData as Record<string, unknown>);
    let sessionData: Json = { ...formPayload } as Json;
    delete (sessionData as Record<string, unknown>).depois_frente;
    delete (sessionData as Record<string, unknown>).depois_lado;
    delete (sessionData as Record<string, unknown>).depois_costas;
    delete (sessionData as Record<string, unknown>).botox_foto_antes;
    delete (sessionData as Record<string, unknown>).botox_foto_depois;

    if (slug === 'botox') {
      const dateStrForData = sessionDate || new Date().toISOString().slice(0, 10);
      const qty = sessionFormData.quantidade_unidade;
      const qtyStr = typeof qty === 'string' ? qty.trim() : String(qty ?? '');
      sessionData = {
        ...(Array.isArray(sessionFormData.pontos_aplicacao) && sessionFormData.pontos_aplicacao.length > 0 && { pontos_aplicacao: sessionFormData.pontos_aplicacao }),
        ...(Array.isArray(sessionFormData.riscos_aplicacao) && sessionFormData.riscos_aplicacao.length > 0 && { riscos_aplicacao: sessionFormData.riscos_aplicacao }),
        ...(sessionFormData.produto_utilizado && { produto_utilizado: String(sessionFormData.produto_utilizado).trim() }),
        ...(Array.isArray(sessionFormData.regiao_tratada) && sessionFormData.regiao_tratada.length > 0 && { regiao_tratada: sessionFormData.regiao_tratada }),
        ...(sessionFormData.quantidade_por_ponto && typeof sessionFormData.quantidade_por_ponto === 'object' && Object.keys(sessionFormData.quantidade_por_ponto as object).length > 0 && { quantidade_por_ponto: sessionFormData.quantidade_por_ponto }),
        ...(qtyStr !== '' && { quantidade_unidade: (() => { const n = Number(qtyStr); return Number.isFinite(n) ? n : qtyStr; })() }),
        data_aplicacao: (sessionFormData.data_aplicacao as string)?.trim() || dateStrForData,
        ...(sessionFormData.lote && { lote: String(sessionFormData.lote).trim() }),
        ...(sessionFormData.marca_toxina && { marca_toxina: String(sessionFormData.marca_toxina).trim() }),
        ...(sessionFormData.data_validade && { data_validade: String(sessionFormData.data_validade).trim() }),
        ...(sessionFormData.numero_pontos_aplicacao && { numero_pontos_aplicacao: String(sessionFormData.numero_pontos_aplicacao).trim() }),
        ...(sessionFormData.diluicao_utilizada && { diluicao_utilizada: String(sessionFormData.diluicao_utilizada).trim() }),
        ...(sessionFormData.observacoes_botox && { observacoes_botox: String(sessionFormData.observacoes_botox).trim() }),
      } as Json;
    }

    const dateStr = sessionDate || new Date().toISOString().slice(0, 10);
    const observacoesStr = sessionObservacoes?.trim() || null;

    if (editingSessionId) {
      const targetEditingSessionId = editingSessionId;
      const { error } = await supabase
        .from('procedure_sessions')
        .update({
          session_date: dateStr,
          data: sessionData as Json,
          observacoes: observacoesStr,
        })
        .eq('id', targetEditingSessionId);

      if (error) {
        setSavingSession(false);
        toast.error('Não foi possível atualizar a sessão.');
        return;
      }

      // Atualiza imediatamente o estado local para refletir a edição sem depender do fetch.
      setSessions((prev) =>
        prev.map((session) =>
          session.id === targetEditingSessionId
            ? ({
                ...session,
                session_date: dateStr,
                data: sessionData as Json,
                observacoes: observacoesStr,
              } as SessionRow)
            : session
        )
      );

      // Fotos na edição: remover as antigas desta sessão e inserir as do formulário
      const editPhotoUrls: { type: string; url: string }[] = [];
      const urlStr = (v: unknown): string | null => {
        if (typeof v === 'string' && v.trim()) return v.trim();
        if (v && typeof v === 'object' && 'url' in v && typeof (v as { url: unknown }).url === 'string')
          return ((v as { url: string }).url || '').trim() || null;
        return null;
      };
      const u1 = urlStr(sessionFormData.depois_frente);
      const u2 = urlStr(sessionFormData.depois_lado);
      const u3 = urlStr(sessionFormData.depois_costas);
      if (u1) editPhotoUrls.push({ type: 'depois_frente', url: u1 });
      if (u2) editPhotoUrls.push({ type: 'depois_lado', url: u2 });
      if (u3) editPhotoUrls.push({ type: 'depois_costas', url: u3 });
      if (slug === 'botox') {
        const uAntes = urlStr(sessionFormData.botox_foto_antes);
        const uDepois = urlStr(sessionFormData.botox_foto_depois);
        if (uAntes) editPhotoUrls.push({ type: 'antes', url: uAntes });
        if (uDepois) editPhotoUrls.push({ type: 'depois', url: uDepois });
      }
      if (slug !== 'botox') {
        fields
          .filter((f) => f.field_type === 'image')
          .forEach((f) => {
            const u = urlStr(sessionFormData[f.field_key]);
            if (u) editPhotoUrls.push({ type: f.field_key, url: u });
          });
      }
      editingGallery.beforeImages.forEach((img, idx) => {
        if (img.url?.trim()) editPhotoUrls.push({ type: `gallery_before_${idx + 1}`, url: img.url.trim() });
      });
      editingGallery.afterImages.forEach((img, idx) => {
        if (img.url?.trim()) editPhotoUrls.push({ type: `gallery_after_${idx + 1}`, url: img.url.trim() });
      });

      const { error: deleteError } = await supabase
        .from('procedure_photos')
        .delete()
        .eq('procedure_session_id', targetEditingSessionId);

      if (deleteError) {
        console.error('Erro ao remover fotos antigas da sessão:', deleteError);
        toast.error('Sessão atualizada, mas não foi possível atualizar as fotos. Tente novamente.');
      }

      if (editPhotoUrls.length > 0) {
        const { error: insertError } = await supabase.from('procedure_photos').insert(
          editPhotoUrls.map(({ type, url }) => ({
            procedure_instance_id: instanceId,
            procedure_session_id: targetEditingSessionId,
            photo_type: type,
            file_url: url,
          }))
        );
        if (insertError) {
          console.error('Erro ao salvar fotos da sessão:', insertError);
          toast.error('Sessão atualizada, mas as fotos não foram salvas: ' + (insertError.message || 'erro ao inserir'));
        }
      }
      const billingValue = Number(String(sessionBilling.valor ?? '').replace(',', '.'));
      const procedureId = procedure?.id;
      const patientId = (instance as { patient_id?: string } | null)?.patient_id;
      if (procedureId && patientId && profile?.id && Number.isFinite(billingValue) && billingValue > 0) {
        const branchIdForBilling = await resolveBranchIdForInsert(profile);
        const billingPayload = {
          cliente_id: patientId,
          profissional_id: profile.id,
          procedimento_id: procedureId,
          valor_total: billingValue,
          valor_recebido: billingValue,
          forma_pagamento: sessionBilling.forma_pagamento,
          parcelas: sessionBilling.forma_pagamento === 'cartao' ? Math.max(1, sessionBilling.parcelas || 1) : null,
          status: 'pago' as const,
          data: `${dateStr}T00:00:00`,
          ...(branchIdForBilling ? { branch_id: branchIdForBilling } : {}),
        };
        if (sessionBilling.recebimentoId) {
          await supabase.from('recebimentos').update(billingPayload).eq('id', sessionBilling.recebimentoId);
        } else {
          await supabase.from('recebimentos').insert(billingPayload);
        }
      }
      await loadPhotos();

      if (
        slug &&
        isDepilacaoDefinitivaSlug(slug) &&
        targetEditingSessionId &&
        profile?.id &&
        (instance as { patient_id?: string })?.patient_id
      ) {
        try {
          await syncDepilacaoDefinitivaReminders({
            slug,
            patientId: (instance as { patient_id: string }).patient_id,
            professionalId: profile.id,
            procedureInstanceId: instanceId,
            procedureSessionId: targetEditingSessionId,
            data: formPayload as Record<string, unknown>,
          });
        } catch (e) {
          console.error(e);
        }
      }

      setSavingSession(false);
      setSessionDialogOpen(false);
      setEditingSessionId(null);
      setSessionFormData({});
      setSessionObservacoes('');
      setEditingGallery({ beforeImages: [], afterImages: [], pairs: [] });
      setSessionBilling({ recebimentoId: null, valor: '', forma_pagamento: 'pix', parcelas: 1 });
      toast.success('Sessão atualizada.');
      await loadSessions();
      return;
    }

    const { data: newSession, error } = await supabase
      .from('procedure_sessions')
      .insert({
        procedure_instance_id: instanceId,
        session_date: dateStr,
        data: sessionData as Json,
        observacoes: observacoesStr,
      })
      .select('id')
      .single();

    if (error) {
      setSavingSession(false);
      toast.error('Não foi possível salvar a sessão.');
      return;
    }

    const sessionId = (newSession as { id: string })?.id;
    const photoUrls: { type: string; url: string }[] = [];
    if (sessionFormData.depois_frente && typeof sessionFormData.depois_frente === 'string')
      photoUrls.push({ type: 'depois_frente', url: sessionFormData.depois_frente });
    if (sessionFormData.depois_lado && typeof sessionFormData.depois_lado === 'string')
      photoUrls.push({ type: 'depois_lado', url: sessionFormData.depois_lado });
    if (sessionFormData.depois_costas && typeof sessionFormData.depois_costas === 'string')
      photoUrls.push({ type: 'depois_costas', url: sessionFormData.depois_costas });
    if (slug === 'botox') {
      const uAntes = sessionFormData.botox_foto_antes;
      const uDepois = sessionFormData.botox_foto_depois;
      if (typeof uAntes === 'string' && uAntes.trim()) photoUrls.push({ type: 'antes', url: uAntes.trim() });
      if (typeof uDepois === 'string' && uDepois.trim()) photoUrls.push({ type: 'depois', url: uDepois.trim() });
    }
    if (slug !== 'botox') {
      fields
        .filter((f) => f.field_type === 'image')
        .forEach((f) => {
          const url = sessionFormData[f.field_key];
          if (url && typeof url === 'string' && url.trim())
            photoUrls.push({ type: f.field_key, url: url.trim() });
        });
    }

    if (slug === 'botox' && sessionId && profile?.id && (instance as { patient_id?: string })?.patient_id && botoxDueDays?.trim()) {
      const days = parseInt(botoxDueDays, 10);
      if (Number.isFinite(days) && days > 0) {
        const d = new Date(dateStr);
        d.setDate(d.getDate() + days);
        const dueDateStr = d.toISOString().slice(0, 10);
        await supabase.from('botox_reapplication_reminders').insert({
          patient_id: (instance as { patient_id: string }).patient_id,
          procedure_instance_id: instanceId,
          procedure_session_id: sessionId,
          professional_id: profile.id,
          due_date: dueDateStr,
        });
      }
    }

    if (
      slug &&
      isDepilacaoDefinitivaSlug(slug) &&
      sessionId &&
      profile?.id &&
      (instance as { patient_id?: string })?.patient_id
    ) {
      try {
        await syncDepilacaoDefinitivaReminders({
          slug,
          patientId: (instance as { patient_id: string }).patient_id,
          professionalId: profile.id,
          procedureInstanceId: instanceId,
          procedureSessionId: sessionId,
          data: formPayload as Record<string, unknown>,
        });
      } catch (e) {
        console.error(e);
      }
    }

    if (sessionId && photoUrls.length > 0) {
      await supabase.from('procedure_photos').insert(
        photoUrls.map(({ type, url }) => ({
          procedure_instance_id: instanceId,
          procedure_session_id: sessionId,
          photo_type: type,
          file_url: url,
        }))
      );
      loadPhotos();
    }

    setSavingSession(false);
    setSessionDialogOpen(false);
    setSessionFormData({});
    setSessionObservacoes('');
    toast.success('Sessão registrada.');
    loadSessions();
  };

  const openInNewConsultationEditor = useCallback(
    (overrides?: {
      sessionId?: string;
      formData?: Record<string, unknown>;
      formDate?: string;
      observacoes?: string;
      gallery?: BeforeAfterGalleryValue;
    }) => {
      const patientId = (instance as { patient_id?: string } | null)?.patient_id;
      const procedureSlug = String(slug ?? '').trim().toLowerCase();
      const targetSessionId = overrides?.sessionId ?? editingSessionId ?? '';
      const targetFormData = overrides?.formData ?? sessionFormData;
      const targetDate = overrides?.formDate ?? sessionDate;
      const targetObservacoes = overrides?.observacoes ?? sessionObservacoes;
      const targetGallery = overrides?.gallery ?? editingGallery;
      if (!patientId || !procedureSlug || !targetSessionId) {
        toast.error('Não foi possível abrir a Nova consulta para esta sessão.');
        return;
      }

      const draft: Record<string, unknown> = {
        patientId,
        savedAt: Date.now(),
        sessionDate: targetDate,
        sessionTime: '',
        selectedProcedureIds: procedure?.id ? [procedure.id] : [],
        observacoes: targetObservacoes ?? '',
        genericProcedureData: { [procedureSlug]: { ...targetFormData } },
        procedureValores: procedure?.id
          ? {
              [procedure.id]: {
                valor: sessionBilling.valor ?? '',
                forma_pagamento: sessionBilling.forma_pagamento ?? 'pix',
                parcelas: sessionBilling.parcelas ?? 1,
              },
            }
          : {},
        consultaValores: {
          valor: sessionBilling.valor ?? '',
          forma_pagamento: sessionBilling.forma_pagamento ?? 'pix',
          parcelas: sessionBilling.parcelas ?? 1,
        },
        botoxFotoAntes: null,
        botoxFotoDepois: null,
        botoxPhotosPorRegiao: {},
        emagrecimentoDepoisFrente: '',
        emagrecimentoDepoisLado: '',
        emagrecimentoDepoisCostas: '',
        comparisonGalleryBySlug:
          targetGallery.beforeImages.length || targetGallery.afterImages.length || targetGallery.pairs.length
            ? { [procedureSlug]: targetGallery }
            : {},
      };

      if (procedureSlug === 'botox') {
        draft.botoxPoints = (targetFormData.pontos_aplicacao as FacialPoint[] | undefined) ?? [];
        draft.botoxProdutoUtilizado = (targetFormData.produto_utilizado as string) ?? '';
        draft.botoxRegiaoTratada = (targetFormData.regiao_tratada as string[] | undefined) ?? [];
        draft.botoxQuantidadePorPonto = (targetFormData.quantidade_por_ponto as Record<string, string> | undefined) ?? {};
        draft.botoxQuantidadeUnidade = (targetFormData.quantidade_unidade as string) ?? '';
        draft.botoxDataAplicacao = (targetFormData.data_aplicacao as string) ?? targetDate;
        draft.botoxLote = (targetFormData.lote as string) ?? '';
        draft.botoxMarcaToxina = (targetFormData.marca_toxina as string) ?? '';
        draft.botoxDataValidade = (targetFormData.data_validade as string) ?? '';
        draft.botoxNumeroPontos = (targetFormData.numero_pontos_aplicacao as string) ?? '';
        draft.botoxDiluicao = (targetFormData.diluicao_utilizada as string) ?? '';
        draft.botoxObservacoes = (targetFormData.observacoes_botox as string) ?? '';
        draft.botoxFotoAntes = (targetFormData.botox_foto_antes as string) ?? null;
        draft.botoxFotoDepois = (targetFormData.botox_foto_depois as string) ?? null;
      }

      if (procedureSlug === 'emagrecimento-reducao-medidas') {
        draft.emagrecimentoPesoAtual = (targetFormData.peso_atual as string) ?? '';
        draft.emagrecimentoAlturaCm = (targetFormData.altura_cm as string) ?? '';
        draft.emagrecimentoAbdomenSuperior = (targetFormData.abdomen_superior_cm as string) ?? '';
        draft.emagrecimentoCintura = (targetFormData.cintura_cm as string) ?? '';
        draft.emagrecimentoAbdomenInferior = (targetFormData.abdomen_inferior_cm as string) ?? '';
        draft.emagrecimentoBraco = (targetFormData.braco_cm as string) ?? '';
        draft.emagrecimentoBusto = (targetFormData.busto_cm as string) ?? '';
        draft.emagrecimentoQuadril = (targetFormData.quadril_cm as string) ?? '';
        draft.emagrecimentoInjetavel = (targetFormData.injetavel as string) ?? '';
        draft.emagrecimentoProdutoUsado = (targetFormData.produto_usado as string) ?? '';
        draft.emagrecimentoMg = (targetFormData.mg as string) ?? '';
        draft.emagrecimentoDepoisFrente = (targetFormData.depois_frente as string) ?? '';
        draft.emagrecimentoDepoisLado = (targetFormData.depois_lado as string) ?? '';
        draft.emagrecimentoDepoisCostas = (targetFormData.depois_costas as string) ?? '';
      }

      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(CONSULTATION_DRAFT_KEY, JSON.stringify(draft));
        }
      } catch {
        // Ignora falhas de quota/armazenamento e segue com navegação.
      }

      const qs = new URLSearchParams({
        procedure: procedureSlug,
        editSessionId: String(targetSessionId),
        editInstanceId: String(instanceId ?? ''),
        returnTo: `/procedures/${procedureSlug}/${instanceId}`,
      });
      setSessionDialogOpen(false);
      navigate(`/consultation/${patientId}?${qs.toString()}`);
    },
    [
      instance,
      slug,
      editingSessionId,
      sessionFormData,
      sessionDate,
      sessionObservacoes,
      editingGallery,
      procedure,
      sessionBilling,
      instanceId,
      navigate,
    ]
  );

  const openEditSession = (s: SessionRow) => {
    const data = { ...((s.data as Record<string, unknown>) ?? {}) };
    photos
      .filter((p) => p.procedure_session_id === s.id && ['depois_frente', 'depois_lado', 'depois_costas'].includes(p.photo_type))
      .forEach((p) => {
        data[p.photo_type] = p.file_url;
      });
    if (slug === 'botox') {
      photos
        .filter((p) => p.procedure_session_id === s.id && (p.photo_type === 'antes' || p.photo_type === 'depois'))
        .forEach((p) => {
          if (p.photo_type === 'antes') data.botox_foto_antes = p.file_url;
          if (p.photo_type === 'depois') data.botox_foto_depois = p.file_url;
        });
    }
    if (slug !== 'botox') {
      fields
        .filter((f) => f.field_type === 'image')
        .forEach((f) => {
          const photo = photos.find(
            (p) =>
              p.procedure_session_id === s.id &&
              p.photo_type === f.field_key &&
              typeof p.file_url === 'string' &&
              p.file_url.trim()
          );
          if (photo?.file_url) data[f.field_key] = photo.file_url;
        });
    }
    const nextDate = String(s.session_date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    const nextObs = (s as { observacoes?: string | null }).observacoes ?? '';
    const nextGallery = buildGalleryFromSessionPhotos(s.id);
    setEditingSessionId(s.id);
    setSessionFormData(
      slug === 'preenchimento-facial'
        ? normalizePreenchimentoFacialSessionData(data)
        : slug === LIPOENZIMATICA_SLUG
          ? normalizeLipoenzimaticaSessionData(data)
          : slug && isNewCustomProcedureSlug(slug)
            ? normalizeNewCustomSessionData(slug, data)
            : data
    );
    setSessionDate(nextDate);
    setSessionObservacoes(nextObs);
    setEditingGallery(nextGallery);
    void (async () => {
      const procedureId = procedure?.id;
      const patientId = (instance as { patient_id?: string } | null)?.patient_id;
      if (!procedureId || !patientId || !profile?.id) {
        setSessionBilling({ recebimentoId: null, valor: '', forma_pagamento: 'pix', parcelas: 1 });
        return;
      }
      const day = String(s.session_date ?? '').slice(0, 10);
      if (!day) return;
      setLoadingSessionBilling(true);
      try {
        const dayStart = `${day}T00:00:00`;
        const dayEnd = `${day}T23:59:59`;
        let found: RecebimentoRow | null = null;
        const { data: byDay } = await supabase
          .from('recebimentos')
          .select('*')
          .eq('cliente_id', patientId)
          .eq('profissional_id', profile.id)
          .eq('procedimento_id', procedureId)
          .gte('data', dayStart)
          .lte('data', dayEnd)
          .order('data', { ascending: false })
          .limit(1)
          .maybeSingle();
        found = (byDay as RecebimentoRow | null) ?? null;
        if (!found) {
          const { data: latestUntilDay } = await supabase
            .from('recebimentos')
            .select('*')
            .eq('cliente_id', patientId)
            .eq('profissional_id', profile.id)
            .eq('procedimento_id', procedureId)
            .lte('data', dayEnd)
            .order('data', { ascending: false })
            .limit(1)
            .maybeSingle();
          found = (latestUntilDay as RecebimentoRow | null) ?? null;
        }
        setSessionBilling(
          found
            ? {
                recebimentoId: found.id,
                valor: String(found.valor_total ?? ''),
                forma_pagamento: (found.forma_pagamento as FormaPagamento) ?? 'pix',
                parcelas: found.parcelas && found.parcelas > 0 ? found.parcelas : 1,
              }
            : { recebimentoId: null, valor: '', forma_pagamento: 'pix', parcelas: 1 }
        );
      } finally {
        setLoadingSessionBilling(false);
      }
    })();
    openInNewConsultationEditor({
      sessionId: s.id,
      formData: data,
      formDate: nextDate,
      observacoes: nextObs,
      gallery: nextGallery,
    });
  };

  const openNewSessionInConsultation = useCallback(() => {
    const patientId = (instance as { patient_id?: string } | null)?.patient_id;
    const procedureSlug = String(slug ?? '').trim().toLowerCase();
    if (!patientId || !procedureSlug) {
      toast.error('Não foi possível abrir a Nova consulta para nova sessão.');
      return;
    }
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(CONSULTATION_DRAFT_KEY);
      }
    } catch {
      // Ignora falhas de storage.
    }
    navigate(`/consultation/${patientId}?procedure=${encodeURIComponent(procedureSlug)}`);
  }, [instance, slug, navigate]);

  const handleExportPdf = async () => {
    if (!summaryData || !procedure) return;
    setExportingPdf(true);
    try {
      const templates = await loadWhatsappManualTemplates(profile?.id);
      const reportEntry = templates.procedure_report;
      const patientWa = formatPhoneForWhatsApp(patientPhone);
      if (patientWa && !reportEntry.enabled) {
        toast.message('Mensagem desativada em Mensagens padrão.');
      }
      const whatsappNumber = reportEntry.enabled ? patientWa : null;
      const uploadPdfFunction =
        profile?.id && instanceId
          ? async (pdfBlob: Blob): Promise<string> => {
              const path = `${profile.id}/${instanceId}/${Date.now()}-resumo-evolucao.pdf`;
              const { error: uploadError } = await supabase.storage.from('evolution-pdfs').upload(path, pdfBlob, {
                contentType: 'application/pdf',
                upsert: false,
              });
              if (uploadError) throw uploadError;
              const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
              const shortSlug = Array.from(crypto.getRandomValues(new Uint8Array(10)))
                .map((b) => ALPHABET[b % ALPHABET.length])
                .join('');
              const { error: linkError } = await supabase.from('evolution_pdf_links').insert({
                slug: shortSlug,
                storage_path: path,
              });
              if (linkError) throw linkError;
              // No APK, window.location.origin é localhost. Use VITE_APP_URL para links públicos.
              // /r?slug= evita truncamento no WhatsApp; /r/xxx também funciona.
              const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
              const base = baseUrl.replace(/\/$/, '');
              return `${base}/r/${shortSlug}?slug=${shortSlug}`;
            }
          : undefined;

      const result = await buildEvolutionPdf({
        patientName,
        procedureName: procedure.name,
        instanceStartDate: instance?.data_inicio ?? null,
        summaryData,
        slug: slug ?? null,
        firstSession: firstSession
          ? {
              id: firstSession.id,
              session_date: firstSession.session_date,
              data: firstSession.data as Record<string, unknown> | null,
            }
          : null,
        latestSession: latestSession
          ? {
              id: latestSession.id,
              session_date: latestSession.session_date,
              data: latestSession.data as Record<string, unknown> | null,
            }
          : null,
        sessions: sessions.map((s) => ({
          id: s.id,
          session_date: s.session_date,
          data: s.data as Record<string, unknown> | null,
        })),
        photos: photos.map((p) => ({
          id: p.id,
          procedure_session_id: p.procedure_session_id,
          photo_type: p.photo_type,
          file_url: p.file_url,
        })),
        getMetricLabel: getFieldLabel,
        clinicContact: undefined,
        clinicName: profile?.full_name ?? 'Clínica',
        clientPhoneNumber: whatsappNumber ?? undefined,
        uploadPdfFunction: whatsappNumber ? uploadPdfFunction : undefined,
        professionalId: profile?.id,
      });

      const withUpload = result as EvolutionPdfResultWithUpload;
      const shouldSendAuditInDev = import.meta.env.VITE_ENABLE_DEV_AUDIT === 'true';
      const shouldSendAudit = !import.meta.env.DEV || shouldSendAuditInDev;
      if (shouldSendAudit && session?.access_token && instanceId) {
        fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'pdf_generated', entity: 'procedure_instance', entity_id: instanceId }),
        }).catch(() => {});
      }
      if (typeof result === 'object' && withUpload.whatsappUrl) {
        const messageText =
          withUpload.whatsappUrl && whatsappNumber
            ? buildProcedureReportWhatsAppMessage({
                patientName,
                clinicName: profile?.full_name,
                procedureName: procedure.name,
                reportUrl: withUpload.pdfUrl,
                template: reportEntry.message,
              })
            : '';
        if (whatsappNumber && messageText) {
          openWhatsAppWithFallback({ phone: whatsappNumber, text: messageText });
        } else if (whatsappNumber) {
          const fallbackText = `Olá ${patientName}, seu resumo de evolução está pronto!`;
          openWhatsAppWithFallback({ phone: whatsappNumber, text: fallbackText });
        } else {
          window.location.assign(withUpload.whatsappUrl);
        }
        toast.success('Link do WhatsApp aberto com o resumo. O cliente pode acessar o PDF pelo link.');
      } else {
        const doc = result as jsPDF;
        // Fallback: tenta gerar o link do PDF para WhatsApp mesmo quando buildEvolutionPdf
        // devolve apenas o documento (ex.: falha transitória no upload interno).
        if (whatsappNumber && uploadPdfFunction) {
          try {
            const pdfBlob = doc.output('blob');
            const pdfUrl = await uploadPdfFunction(pdfBlob);
            const messageWithLink = buildProcedureReportWhatsAppMessage({
              patientName,
              clinicName: profile?.full_name,
              procedureName: procedure.name,
              reportUrl: pdfUrl,
              template: reportEntry.message,
            });
            openWhatsAppWithFallback({ phone: whatsappNumber, text: messageWithLink });
            toast.success('Link do WhatsApp aberto com o resumo. O cliente pode acessar o PDF pelo link.');
            return;
          } catch {
            // Continua para o fluxo padrão de salvar localmente.
          }
        }

        const safeName = patientName.replace(/[^\p{L}\p{N}\s-]/gu, '').slice(0, 40).trim() || 'Paciente';
        const safeProcedure = procedure.name.replace(/[^\p{L}\p{N}\s-]/gu, '').slice(0, 30).trim() || 'Tratamento';
        const fileName = `Resumo-Evolucao-${safeName}-${safeProcedure}.pdf`;
        doc.save(fileName);
        toast.success('PDF gerado com sucesso.');
        const message = encodeURIComponent(
          'Olá! Segue em anexo o resumo da evolução do seu tratamento. (O PDF foi salvo — anexe e envie por aqui.)'
        );
        if (whatsappNumber) {
          window.location.assign(`https://wa.me/${whatsappNumber}?text=${message}`);
        } else if (!patientWa) {
          toast.info('Cadastre o telefone do paciente para abrir o WhatsApp automaticamente na próxima vez.');
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar o PDF. Tente novamente.');
    } finally {
      setExportingPdf(false);
    }
  };

  const shareProcedureWebReport = useCallback(async () => {
    if (!instanceId || !profile?.id || !slug) {
      toast.error('Não foi possível compartilhar o relatório.');
      return;
    }
    setSharingWebReport(true);
    try {
      const templates = await loadWhatsappManualTemplates(profile.id);
      const reportEntry = templates.procedure_report;
      if (!reportEntry.enabled) {
        toast.message('Mensagem desativada em Mensagens padrão.');
        return;
      }
      const isEmagrecimento = slug === 'emagrecimento-reducao-medidas';
      const rpcName = isEmagrecimento ? 'ensure_emagrecimento_report_link' : 'ensure_procedure_report_link';
      const publicPrefix = isEmagrecimento ? '/re/' : '/rp/';
      const { data, error } = await supabase.rpc(rpcName, {
        p_procedure_instance_id: instanceId,
      });
      if (error || typeof data !== 'string' || !data.trim()) {
        if (!isEmagrecimento) {
          toast.info('Não foi possível gerar o link web. Gerando PDF como alternativa...');
          await handleExportPdf();
        } else {
          toast.error('Não foi possível gerar o link do relatório. Tente novamente.');
        }
        return;
      }
      const wa = formatPhoneForWhatsApp(patientPhone);
      if (!wa) {
        toast.error('Cadastre o telefone do paciente na ficha para compartilhar pelo WhatsApp.');
        return;
      }
      const publicBase = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');
      const publicReportUrl = `${publicBase}${publicPrefix}${data.trim()}`;
      const message = isEmagrecimento
        ? buildEmagrecimentoReportWhatsAppMessage({
            patientName,
            clinicName: profile.full_name,
            reportUrl: publicReportUrl,
            template: reportEntry.message,
          })
        : buildProcedureReportWhatsAppMessage({
            patientName,
            clinicName: profile.full_name,
            procedureName: procedure?.name,
            reportUrl: publicReportUrl,
            template: reportEntry.message,
          });
      openWhatsAppWithFallback({ phone: wa, text: message });
      toast.success('Abrindo o WhatsApp com o link público do relatório.');
    } finally {
      setSharingWebReport(false);
    }
  }, [instanceId, profile?.id, profile?.full_name, patientPhone, patientName, procedure?.name, slug, handleExportPdf]);

  const handleAddBotoxReminder = async () => {
    const patientId = (instance as { patient_id: string })?.patient_id;
    if (!profile?.id || !instanceId || !patientId) return;
    let dueDateStr = '';
    if (botoxDueDays?.trim()) {
      const days = parseInt(botoxDueDays, 10);
      if (Number.isFinite(days) && days > 0) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        dueDateStr = d.toISOString().slice(0, 10);
      }
    }
    if (!dueDateStr) {
      toast.error('Informe o número de dias para a próxima reaplicação.');
      return;
    }
    setSavingBotoxReminder(true);
    const { error } = await supabase.from('botox_reapplication_reminders').insert({
      patient_id: patientId,
      procedure_instance_id: instanceId,
      procedure_session_id: null,
      professional_id: profile.id,
      due_date: dueDateStr,
    });
    setSavingBotoxReminder(false);
    if (error) {
      toast.error('Erro ao salvar lembrete.');
      return;
    }
    toast.success('Lembrete de reaplicação definido.');
    setBotoxDueDays('');
    loadBotoxReminders();
  };

  /** Data base para agendar: data da sessão atual (no dialog = data do form; fora = última sessão; senão hoje). */
  const getBaseDateForAgenda = (): Date => {
    if (sessionDialogOpen && sessionDate) return parseLocalDate(sessionDate);
    const lastDate = latestSession?.session_date;
    if (lastDate) return parseLocalDate(String(lastDate).slice(0, 10));
    return new Date();
  };

  const openAgendaPopup = () => {
    const days = parseInt(botoxDueDays, 10);
    if (!Number.isFinite(days) || days < 1) {
      toast.error('Informe o prazo em dias para ver os horários disponíveis.');
      return;
    }
    const targetDate = addDays(getBaseDateForAgenda(), days);
    setAgendaContext('botox');
    setTargetAgendaDate(targetDate);
    setAgendaPopupOpen(true);
    setConfirmSlotTime(null);
  };

  const openAgendaPopupEmagrecimento = () => {
    const days = parseInt(emagrecimentoDueDays, 10);
    if (!Number.isFinite(days) || days < 1) {
      toast.error('Informe o prazo em dias para ver os horários disponíveis.');
      return;
    }
    const targetDate = addDays(getBaseDateForAgenda(), days);
    setAgendaContext('emagrecimento');
    setTargetAgendaDate(targetDate);
    setAgendaPopupOpen(true);
    setConfirmSlotTime(null);
  };

  const openAgendaPopupProximaAvaliacao = () => {
    const days = parseInt(proximaAvaliacaoDias, 10);
    if (!Number.isFinite(days) || days < 1) {
      toast.error('Informe o prazo em dias para ver os horários disponíveis.');
      return;
    }
    const targetDate = addDays(getBaseDateForAgenda(), days);
    setAgendaContext(null);
    setTargetAgendaDate(targetDate);
    setAgendaPopupOpen(true);
    setConfirmSlotTime(null);
  };

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

  const confirmAppointmentAt = async (date: Date, slotTime: string) => {
    if (!profile?.id || !instance) return;
    const patientId = (instance as { patient_id: string }).patient_id;
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
    if (agendaContext === 'botox') {
      await supabase
        .from('botox_reapplication_reminders')
        .update({ notified_at: new Date().toISOString() })
        .eq('patient_id', patientId)
        .eq('professional_id', profile.id)
        .is('notified_at', null);
    }
    setConfirmSlotTime(null);
    setAgendaPopupOpen(false);
    setTargetAgendaDate(null);
    setAgendaContext(null);
    toast.success(
      agendaContext === 'emagrecimento'
        ? 'Consulta agendada para a próxima avaliação.'
        : agendaContext === 'botox'
          ? 'Consulta agendada para a reaplicação.'
          : 'Consulta agendada.'
    );
  };

  const handleConfirmAppointment = async () => {
    if (!targetAgendaDate || !confirmSlotTime) return;
    await confirmAppointmentAt(targetAgendaDate, confirmSlotTime);
  };

  const handleDeleteSession = async (id: string) => {
    const { error } = await deleteProcedureSessionById(id);
    setDeleteSessionId(null);
    if (error) {
      toast.error('Não foi possível excluir.');
      return;
    }
    if (instanceId) {
      const { error: cleanupError } = await deleteProcedureInstanceIfNoSessions(instanceId);
      if (cleanupError) {
        toast.error('Sessão excluída, mas não foi possível atualizar o procedimento.');
        loadSessions();
        loadPhotos();
        return;
      }
      const { count } = await supabase
        .from('procedure_instances')
        .select('id', { count: 'exact', head: true })
        .eq('id', instanceId);
      if ((count ?? 0) === 0) {
        toast.success('Sessão e procedimento removidos.');
        const returnPatientId = instance?.patient_id;
        navigate(returnPatientId ? `/patients/${returnPatientId}` : '/patients');
        return;
      }
    }
    toast.success('Sessão excluída.');
    loadSessions();
    loadPhotos();
  };

  const handleAddPhoto = async () => {
    if (!instanceId || !photoUrl.trim()) {
      toast.error('Informe a URL da foto ou use Escolher arquivo / Tirar foto.');
      return;
    }
    setSavingPhoto(true);
    const { error } = await supabase.from('procedure_photos').insert({
      procedure_instance_id: instanceId,
      procedure_session_id: null,
      photo_type: photoType,
      file_url: photoUrl.trim(),
    });
    setSavingPhoto(false);
    setPhotoDialogOpen(false);
    setPhotoUrl('');
    setPhotoType(slug === 'emagrecimento-reducao-medidas' ? 'depois_frente' : 'evolucao');
    if (error) {
      toast.error('Não foi possível salvar.');
      return;
    }
    toast.success('Foto adicionada.');
    loadPhotos();
  };

  if (!slug || !instanceId) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">URL inválida.</p>
      </div>
    );
  }

  if (loading && !instance) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!instance || !procedure) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Atendimento ou procedimento não encontrado.</p>
        <Button variant="link" asChild className="mt-2">
          <Link to={`/procedures/${slug}`}>Voltar à listagem</Link>
        </Button>
      </div>
    );
  }

  const backHref = instance ? `/patients/${(instance as { patient_id: string }).patient_id}` : `/procedures/${slug}`;
  const displayStartDate = patientTreatmentStartDate ?? instance.data_inicio;
  const subtitle = `${patientName} · Início ${format(parseLocalDate(displayStartDate), 'dd/MM/yyyy', { locale: ptBR })}`;
  const sessionDataEntries = (data: Record<string, unknown>) =>
    Object.entries(data).filter(([, v]) => v != null && v !== '');

  const isImageField = (key: string) =>
    key.startsWith('foto_') || fields.some((f) => f.field_key === key && f.field_type === 'image');
  const fieldsReady = fields.length > 0;
  const sessionDataEntriesNoPhotos = (data: Record<string, unknown>) =>
    sessionDataEntries(data).filter(([key]) => !isImageField(key));

  // Dados do gráfico: início (cadastro) + todas as sessões, ordenados por data
  const numericFields = fields.filter((f) => f.field_type === 'number');
  const hasPesoField = numericFields.some((f) => f.field_key === 'peso_inicial' || f.field_key === 'peso_atual');
  const chartData = (() => {
    const points: { date: string; dateLabel: string; [key: string]: string | number | null | undefined }[] = [];
    const firstSessionDateKey = firstSession?.session_date ? String(firstSession.session_date).slice(0, 10) : null;
    const displayStartDateKey = displayStartDate ? String(displayStartDate).slice(0, 10) : null;
    // Evita que o ponto inicial seja projetado para uma data futura (ex.: hoje) quando
    // a data de início está posterior à primeira sessão real registrada.
    const startDate =
      displayStartDateKey && firstSessionDateKey && displayStartDateKey > firstSessionDateKey
        ? firstSessionDateKey
        : (displayStartDateKey ?? instance?.data_inicio);
    const initialData = instanceData;
    const fallbackInitialData = (firstSession?.data as Record<string, unknown>) ?? {};
    const hasInitialData = Object.keys(initialData).length > 0;
    const initialSource = hasInitialData ? initialData : fallbackInitialData;
    const initialDate = startDate ?? firstSession?.session_date;
    // Sempre adiciona ponto do cadastro/início quando há data de início (para peso inicial aparecer ao filtrar)
    if (initialDate) {
      const point: { date: string; dateLabel: string; [key: string]: string | number | null | undefined } = {
        date: initialDate,
        dateLabel: format(parseLocalDate(initialDate), 'dd/MM/yy', { locale: ptBR }),
      };
      numericFields.forEach((f) => {
        const key = f.field_key;
        if (key === 'imc') {
          const peso = (initialSource.peso_inicial ?? initialSource.peso_atual) as number | undefined;
          const alt = initialSource.altura_cm as number | undefined;
          const v = calcImc(peso, alt);
          if (v != null) point[key] = v;
        } else if (key === 'peso_inicial' || key === 'peso_atual') {
          const v = (initialSource.peso_inicial ?? initialSource.peso_atual) as number | undefined;
          if (v != null && typeof v === 'number') point.peso = v;
        } else {
          const v = initialSource[key];
          if (v != null && typeof v === 'number') point[key] = v;
        }
      });
      point.peso = hasPesoField
        ? (initialSource.peso_inicial != null || initialSource.peso_atual != null
            ? Number(initialSource.peso_inicial ?? initialSource.peso_atual)
            : null)
        : undefined;
      points.push(point);
    }
    const getSessionRecencyTime = (session: SessionRow): number => {
      const row = session as unknown as { updated_at?: string | null; created_at?: string | null };
      const reference = row.updated_at ?? row.created_at ?? session.session_date;
      return new Date(reference ?? session.session_date).getTime();
    };
    const sortedSessions = [...sessions].sort((a, b) => {
      const byDate = new Date(a.session_date).getTime() - new Date(b.session_date).getTime();
      if (byDate !== 0) return byDate;
      return getSessionRecencyTime(a) - getSessionRecencyTime(b);
    });
    sortedSessions.forEach((s) => {
      if (!hasInitialData && firstSession && s.id === firstSession.id) return;
      const dataObj = (s.data as Record<string, unknown>) ?? {};
      const point: { date: string; dateLabel: string; [key: string]: string | number | null | undefined } = {
        date: s.session_date,
        dateLabel: format(parseLocalDate(s.session_date), 'dd/MM/yy', { locale: ptBR }),
      };
      numericFields.forEach((f) => {
        const key = f.field_key;
        if (key === 'imc') {
          const v = calcImc(dataObj.peso_atual as number, dataObj.altura_cm as number);
          if (v != null) point[key] = v;
        } else if (key === 'peso_inicial' || key === 'peso_atual') {
          const v = dataObj.peso_atual as number | undefined;
          if (v != null && typeof v === 'number') point.peso = v;
        } else {
          const v = dataObj[key];
          if (v != null && typeof v === 'number') point[key] = v;
        }
      });
      point.peso = hasPesoField ? (dataObj.peso_atual != null ? Number(dataObj.peso_atual) : null) : undefined;
      points.push(point);
    });
    const sortedPoints = points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latestPointByDay = new Map<string, (typeof sortedPoints)[number]>();
    sortedPoints.forEach((point) => {
      const dayKey = String(point.date).slice(0, 10);
      latestPointByDay.set(dayKey, {
        ...point,
        date: dayKey,
        dateLabel: format(parseLocalDate(dayKey), 'dd/MM/yy', { locale: ptBR }),
      });
    });
    return Array.from(latestPointByDay.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  })();

  const chartConfig: Record<string, { label: string; color?: string }> = {
    peso: {
      label: 'Peso (kg)',
      color: 'hsl(173, 58%, 39%)',
    },
  };
  const pesoChartData = chartData.filter((row) => typeof row.peso === 'number');
  const troncoMetricDefs: Array<{ key: string; label: string; color: string }> = [
    { key: 'busto_cm', label: 'Busto (cm)', color: '#0d9488' },
    { key: 'cintura_cm', label: 'Cintura (cm)', color: '#0284c7' },
    { key: 'abdomen_superior_cm', label: 'Abdômen superior (cm)', color: '#16a34a' },
    { key: 'abdomen_inferior_cm', label: 'Abdômen inferior (cm)', color: '#ca8a04' },
  ];
  const troncoIconByKey: Record<string, string> = {
    busto_cm: TIMELINE_ICON_URLS.busto,
    cintura_cm: TIMELINE_ICON_URLS.cintura,
    abdomen_superior_cm: TIMELINE_ICON_URLS.abdomen,
    abdomen_inferior_cm: TIMELINE_ICON_URLS.abdomen,
  };
  const troncoCharts = troncoMetricDefs
    .map((metric) => {
      const data = chartData
        .filter((row) => typeof row[metric.key] === 'number')
        .map((row) => ({
          date: row.date,
          dateLabel: row.dateLabel,
          [metric.key]: row[metric.key] as number,
        }));
      return { ...metric, data };
    })
    .filter((metric) => metric.data.length > 0);

  return (
    <div className="space-y-8 animate-fade-in min-w-0 overflow-visible">
      <TreatmentDetailHeader
        backHref={backHref}
        title={procedure.name}
        subtitle={subtitle}
        showBackLink
      />

      {summaryData && (
        <ProcedureSummary
          data={summaryData}
          slug={slug}
          rightAction={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full lg:w-auto gap-1.5 sm:gap-2 rounded-xl min-h-[44px] touch-manipulation text-xs sm:text-sm"
              onClick={() => void shareProcedureWebReport()}
              disabled={sharingWebReport}
            >
              {sharingWebReport ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <FileText className="h-4 w-4 shrink-0" aria-hidden />
              )}
              <span>
                {sharingWebReport ? 'Preparando link...' : 'Enviar Relatorio'}
              </span>
            </Button>
          }
        />
      )}

      {/* Evolução de Medidas — movido para cima (ordem: Resumo → Evolução → Sessões → Gráfico → Antes/Depois → Dados) */}
      {latestSession && sessions.length >= 1 && latestSession.data && typeof latestSession.data === 'object' && (() => {
        const currentData = latestSession.data as Record<string, unknown>;
        const baselineSession =
          evolucaoMedidasMode === 'geral'
            ? (sessions.length >= 2 ? sessions[sessions.length - 1]! : null)
            : (sessions.length >= 2 ? sessions[1]! : null);
        const baselineData = (baselineSession?.data as Record<string, unknown> | undefined) ?? {};
        const fmtByUnit = (n: number, unit: string) => {
          const safe = Math.abs(n) < 1e-9 ? 0 : n;
          const decimals = unit === 'kg' ? 1 : 1;
          return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(safe);
        };
        const toNum = (v: unknown): number | null => {
          if (v == null || v === '') return null;
          const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '.'));
          return Number.isFinite(n) ? n : null;
        };
        const metricCards = EVOLUCAO_METRICAS.filter((m) => {
          const val = toNum(currentData[m.key]);
          return val != null;
        }).map((m) => {
          const current = toNum(currentData[m.key])!;
          const previous = toNum(baselineData[m.key]);
          const diff = previous != null ? current - previous : null;
          return { ...m, current, previous, diff };
        });
        const evolucaoIconByKey: Record<string, string | undefined> = {
          peso: TIMELINE_ICON_URLS.peso,
          peso_atual: TIMELINE_ICON_URLS.peso,
          braco_cm: TIMELINE_ICON_URLS.braco,
          busto_cm: TIMELINE_ICON_URLS.busto,
          quadril_cm: TIMELINE_ICON_URLS.quadril,
          cintura_cm: TIMELINE_ICON_URLS.cintura,
          abdomen_inferior_cm: TIMELINE_ICON_URLS.abdomen,
          abdomen_superior_cm: TIMELINE_ICON_URLS.abdomen,
        };
        if (metricCards.length === 0) return null;
        return (
          <Card className="rounded-lg border border-border/80 bg-card text-card-foreground shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border bg-muted/30 p-3 md:p-4 pb-3 md:pb-4">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="flex min-w-0 items-center gap-2 text-sm md:text-base font-semibold tracking-tight">
                  <span className="flex h-8 w-8 md:h-9 md:w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BarChart3 className="w-4 h-4 md:w-5 md:h-5" />
                  </span>
                  <span className="min-w-0 leading-snug">Evolução de Medidas</span>
                </CardTitle>
                <div
                  className="flex shrink-0 gap-0.5 rounded-md border border-border/70 bg-background p-0.5"
                  role="tablist"
                  aria-label="Modo de evolução"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={evolucaoMedidasMode === 'geral'}
                    className={`rounded px-1.5 py-1 text-[10px] font-medium leading-tight transition-colors touch-manipulation sm:px-2 sm:text-[11px] ${
                      evolucaoMedidasMode === 'geral'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    }`}
                    onClick={() => setEvolucaoMedidasMode('geral')}
                  >
                    Geral
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={evolucaoMedidasMode === 'sessao'}
                    className={`rounded px-1.5 py-1 text-[10px] font-medium leading-tight transition-colors touch-manipulation sm:px-2 sm:text-[11px] ${
                      evolucaoMedidasMode === 'sessao'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    }`}
                    onClick={() => setEvolucaoMedidasMode('sessao')}
                  >
                    Por sessão
                  </button>
                </div>
              </div>
              <CardDescription className="mt-1 text-xs md:text-sm">
                {evolucaoMedidasMode === 'geral'
                  ? 'Resultado acumulado desde a primeira sessão até a mais recente.'
                  : 'Variação em relação à sessão anterior.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-2 md:pt-3">
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 md:gap-3">
                {metricCards.map(({ key, label, current, diff, unit = 'cm' }) => (
                  <div key={key} className="rounded-lg md:rounded-xl border border-border/60 bg-muted/10 px-2.5 py-2.5 md:px-4 md:py-4">
                    <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {evolucaoIconByKey[key] ? (
                        <img
                          src={evolucaoIconByKey[key]}
                          alt=""
                          className="h-4 w-4 shrink-0"
                        />
                      ) : null}
                      {label}
                    </p>
                    <p className="mt-1.5 text-lg font-bold text-foreground tabular-nums break-words">
                      {fmtByUnit(current, unit)} {unit}
                    </p>
                    {diff !== null ? (
                      <div className={`mt-2 flex items-center gap-2 text-sm font-semibold tabular-nums ${
                        diff < 0 ? 'text-green-600 dark:text-green-400' : diff > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                      }`}>
                        {diff < 0 ? <TrendingDown className="w-5 h-5 shrink-0" /> : diff > 0 ? <TrendingUp className="w-5 h-5 shrink-0" /> : <Minus className="w-5 h-5 shrink-0" />}
                        <span className="break-words">
                          {diff > 0 ? '+' : ''}
                          {fmtByUnit(diff, unit)} {unit}
                        </span>
                      </div>
                    ) : (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {evolucaoMedidasMode === 'geral' ? 'Sem sessão inicial' : 'Primeira medição'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Popup: horários (dia) ou grade semanal (semana/mês) — mesmo fluxo da consulta */}
      {(slug === 'botox' || slug === 'emagrecimento-reducao-medidas') && instance && profile?.id && (
        <Dialog open={agendaPopupOpen} onOpenChange={(open) => !open && (setAgendaPopupOpen(false), setTargetAgendaDate(null), setConfirmSlotTime(null), setAgendaContext(null))}>
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
                onConfirmBooking={(d, t) => void confirmAppointmentAt(d, t)}
                onCancelConfirm={() => {}}
              />
            ) : loadingAgendaDay ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : targetAgendaDate ? (
              <AgendaDaySlotsContent
                targetDate={targetAgendaDate}
                profile={profile}
                agendaDayAppointments={agendaDayAppointments}
                confirmSlotTime={confirmSlotTime}
                onSelectSlot={setConfirmSlotTime}
                onConfirm={handleConfirmAppointment}
                onCancelConfirm={() => setConfirmSlotTime(null)}
                saving={savingAppointment}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      )}

      {/* Resultados / Evolução — só onde faz sentido (ex.: emagrecimento com peso/medidas ao longo do tempo) */}
      {slug === 'emagrecimento-reducao-medidas' && (
        <Card className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <CardHeader className="flex flex-col space-y-1.5 p-3 md:p-4 border-b border-border">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm md:text-base font-semibold tracking-tight">
                  <BarChart3 className="w-4 h-4 md:w-5 md:h-5" />
                  Resultados / Evolução
                </CardTitle>
                <CardDescription className="mt-1 text-xs md:text-sm">Avaliações e evolução</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-2 md:pt-3">
            {pesoChartData.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">
                Preencha os dados iniciais e adicione sessões para ver a evolução no gráfico.
              </p>
            ) : (
              <div>
                <p className="mb-2 inline-flex items-center gap-2 text-xs font-medium text-[#3d3d3d] sm:text-sm">
                  <img src={TIMELINE_ICON_URLS.peso} alt="" className="h-5 w-5 shrink-0" />
                  Peso (kg)
                </p>
                <ChartContainer
                  config={chartConfig}
                  className="h-[280px] w-full"
                >
                  <LineChart data={pesoChartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v} kg`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="peso"
                      name="Peso (kg)"
                      stroke="var(--color-peso)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            )}
            {troncoCharts.length > 0 && (
              <div className="mt-6">
                <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
                  {troncoCharts.map((metric) => (
                    <div
                      key={`tronco-${metric.key}`}
                      className="min-w-0 rounded-xl border border-black/[0.06] bg-white/60 p-2.5 shadow-sm sm:p-3 print:border-border print:shadow-none"
                    >
                      <p className="mb-2 inline-flex items-center gap-2 text-xs font-medium text-[#3d3d3d] sm:text-sm">
                        <img
                          src={troncoIconByKey[metric.key] ?? TIMELINE_ICON_URLS.abdomen}
                          alt=""
                          className="h-5 w-5 shrink-0"
                        />
                        {metric.label}
                      </p>
                      <ChartContainer
                        config={{
                          [metric.key]: {
                            label: metric.label,
                            color: metric.color,
                          },
                        }}
                        className="aspect-auto h-[190px] w-full min-w-0 sm:h-[210px] md:h-[220px]"
                      >
                        <LineChart data={metric.data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} height={24} />
                          <YAxis
                            tick={{ fontSize: 10 }}
                            width={40}
                            tickFormatter={(value: number) =>
                              new Intl.NumberFormat('pt-BR', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 1,
                              }).format(value)
                            }
                            domain={['dataMin', 'dataMax']}
                          />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line
                            type="monotone"
                            dataKey={metric.key}
                            name={metric.label}
                            stroke={`var(--color-${metric.key})`}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls
                          />
                        </LineChart>
                      </ChartContainer>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Registro de sessões */}
      <Card className="rounded-lg border border-border/80 bg-card text-card-foreground shadow-sm overflow-hidden">
        <CardHeader className="space-y-1.5 p-3 md:p-4 flex flex-col gap-2 md:gap-3 border-b border-border bg-muted/20 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-sm md:text-lg font-semibold tracking-tight text-foreground">
              <span className="flex h-8 w-8 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-lg md:rounded-xl bg-primary/10 text-primary">
                <Calendar className="w-4 h-4 md:w-5 md:h-5" />
              </span>
              Registro de sessões
            </CardTitle>
            <CardDescription className="mt-0.5 md:mt-1.5 text-xs md:text-sm text-muted-foreground">
              Data e campos do procedimento por sessão
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 lg:w-auto lg:items-end">
            <Dialog
              open={sessionDialogOpen}
              onOpenChange={(open) => {
                setSessionDialogOpen(open);
                if (!open) {
                  setEditingSessionId(null);
                  setEditingGallery({ beforeImages: [], afterImages: [], pairs: [] });
                  setSessionBilling({ recebimentoId: null, valor: '', forma_pagamento: 'pix', parcelas: 1 });
                }
              }}
            >
              <Button className="w-full gap-2 shrink-0 lg:w-auto" type="button" onClick={openNewSessionInConsultation}>
                <Plus className="w-4 h-4" />
                Nova sessão
              </Button>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingSessionId ? 'Editar sessão' : 'Nova sessão'}</DialogTitle>
                <DialogDescription>
                  {editingSessionId
                    ? 'Para editar esta sessão, use a experiência completa da Nova consulta.'
                    : slug === 'emagrecimento-reducao-medidas'
                      ? 'Preencha peso atual, medidas e demais dados. Opcionalmente adicione fotos "Depois" abaixo.'
                      : 'Preencha os dados desta sessão. Inclua fotos antes/depois quando aplicável.'}
                </DialogDescription>
              </DialogHeader>
              {editingSessionId ? (
                <div className="py-4">
                  <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      A edição desta sessão foi movida para a tela de Nova consulta para manter um único fluxo.
                    </p>
                    <Button variant="secondary" onClick={() => openInNewConsultationEditor()} className="w-full">
                      Editar na Nova consulta
                    </Button>
                  </div>
                </div>
              ) : (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data da sessão</Label>
                    <Input
                      type="date"
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                    />
                  </div>
                </div>
                {editingSessionId && slug !== 'botox' && (
                  <div className="space-y-3 border rounded-lg border-border bg-muted/10 p-3">
                    <div className="space-y-1">
                      <Label className="text-sm font-semibold">Valor da sessão</Label>
                      <p className="text-xs text-muted-foreground">Atualiza o recebimento financeiro vinculado a esta sessão.</p>
                    </div>
                    {loadingSessionBilling ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Carregando valor...
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5 sm:col-span-1">
                          <Label className="text-xs">Valor (R$)</Label>
                          <Input
                            inputMode="decimal"
                            placeholder="0,00"
                            value={sessionBilling.valor}
                            onChange={(e) => setSessionBilling((prev) => ({ ...prev, valor: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-1">
                          <Label className="text-xs">Forma de pagamento</Label>
                          <Select
                            value={sessionBilling.forma_pagamento}
                            onValueChange={(v) => setSessionBilling((prev) => ({ ...prev, forma_pagamento: v as FormaPagamento }))}
                          >
                            <SelectTrigger>
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
                        {sessionBilling.forma_pagamento === 'cartao' && (
                          <div className="space-y-1.5 sm:col-span-1">
                            <Label className="text-xs">Parcelas</Label>
                            <Input
                              type="number"
                              min={1}
                              value={String(sessionBilling.parcelas)}
                              onChange={(e) =>
                                setSessionBilling((prev) => ({
                                  ...prev,
                                  parcelas: Math.max(1, Number(e.target.value || 1)),
                                }))
                              }
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {Boolean(editingSessionId && slug !== 'botox' && profile?.id && instanceId) && (
                  <BeforeAfterGalleryCard
                    title="Galeria Antes e Depois"
                    description="Use o mesmo padrão de upload/ordenação da sessão."
                    userId={profile.id}
                    instanceIdOrTemp={`${instanceId}-session-${editingSessionId}`}
                    value={editingGallery}
                    onChange={setEditingGallery}
                    disabled={false}
                  />
                )}
                {(() => {
                  const initialDataForSession = instanceData ?? (firstSession?.data as Record<string, unknown>) ?? {};
                  const injetavelSimInicial = (initialDataForSession.injetavel as string) === 'Sim';

                  if (slug === 'botox') {
                    const isEditingSession = Boolean(editingSessionId);
                    const botoxRegiaoTratada = (sessionFormData.regiao_tratada as string[] | undefined) ?? [];
                    const botoxQuantidadePorPonto = (sessionFormData.quantidade_por_ponto as Record<string, string> | undefined) ?? {};
                    return (
                      <>
                        <div className="space-y-2">
                          <Label>Foto antes da sessão</Label>
                          <BotoxFacialMap
                            points={(sessionFormData.pontos_aplicacao as FacialPoint[] | undefined) ?? []}
                            onChange={(points) => setSessionFormData((prev) => ({ ...prev, pontos_aplicacao: points }))}
                            strokes={(sessionFormData.riscos_aplicacao as FacialStroke[] | undefined) ?? []}
                            onStrokesChange={(next) =>
                              setSessionFormData((prev) => ({ ...prev, riscos_aplicacao: next }))
                            }
                            antesPhotoUrl={!isEditingSession ? ((sessionFormData.botox_foto_antes as string | null) ?? null) : undefined}
                            onAntesPhotoChange={
                              !isEditingSession
                                ? (url) => setSessionFormData((prev) => ({ ...prev, botox_foto_antes: url ?? '' }))
                                : undefined
                            }
                            antesUserId={!isEditingSession ? (profile?.id ?? '') : undefined}
                            antesInstanceIdOrTemp={!isEditingSession ? `${instanceId ?? 'botox'}-antes` : undefined}
                            antesDisabled={!isEditingSession ? !profile?.id : undefined}
                          />
                        </div>
                        {isBotoxRegiaoTratadaVisible && (
                          <Card>
                            <CardContent className="pt-4">
                              <div className="space-y-2">
                                <Label>Região tratada</Label>
                                <div className="flex flex-wrap gap-4">
                                  {visibleBotoxRegions.map(({ key, label }) => (
                                    <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                                      <Checkbox
                                        checked={botoxRegiaoTratada.includes(key)}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            setSessionFormData((prev) => ({
                                              ...prev,
                                              regiao_tratada: botoxRegiaoTratada.includes(key) ? botoxRegiaoTratada : [...botoxRegiaoTratada, key],
                                            }));
                                          } else {
                                            setSessionFormData((prev) => {
                                              const next = { ...prev };
                                              next.regiao_tratada = botoxRegiaoTratada.filter((k) => k !== key);
                                              const qpp = { ...botoxQuantidadePorPonto };
                                              delete qpp[key];
                                              next.quantidade_por_ponto = qpp;
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
                        {isBotoxRegiaoTratadaVisible &&
                          botoxRegiaoTratada.some((key) => visibleBotoxRegions.some((region) => region.key === key)) && (
                          <div className="space-y-2">
                            <Label>Quantidade por ponto</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {botoxRegiaoTratada
                                .filter((key) => visibleBotoxRegions.some((region) => region.key === key))
                                .map((key) => {
                                const reg = BOTOX_REGIOES.find((r) => r.key === key);
                                return (
                                  <div key={key} className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">{reg?.label ?? key}</Label>
                                    <Input
                                      value={botoxQuantidadePorPonto[key] ?? ''}
                                      onChange={(e) =>
                                        setSessionFormData((prev) => ({
                                          ...prev,
                                          quantidade_por_ponto: { ...botoxQuantidadePorPonto, [key]: e.target.value },
                                        }))
                                      }
                                      placeholder="Ex: 2 U"
                                    />
                                  </div>
                                );
                                })}
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Produto utilizado</Label>
                            <Input
                              value={(sessionFormData.produto_utilizado as string) ?? ''}
                              onChange={(e) => setSessionFormData((prev) => ({ ...prev, produto_utilizado: e.target.value }))}
                              placeholder="Ex: Botox, Dysport, etc."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Lote</Label>
                            <Input
                              value={(sessionFormData.lote as string) ?? ''}
                              onChange={(e) => setSessionFormData((prev) => ({ ...prev, lote: e.target.value }))}
                              placeholder="Número do lote"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Marca da toxina</Label>
                            <Input
                              value={(sessionFormData.marca_toxina as string) ?? ''}
                              onChange={(e) => setSessionFormData((prev) => ({ ...prev, marca_toxina: e.target.value }))}
                              placeholder="Ex: Botox, Dysport"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Data de validade</Label>
                            <Input
                              type="date"
                              value={(sessionFormData.data_validade as string) ?? ''}
                              onChange={(e) => setSessionFormData((prev) => ({ ...prev, data_validade: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Quantidade e/ou unidade total</Label>
                            <Input
                              value={(sessionFormData.quantidade_unidade as string) ?? ''}
                              onChange={(e) => setSessionFormData((prev) => ({ ...prev, quantidade_unidade: e.target.value }))}
                              placeholder="Ex: 50 U"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Data da aplicação</Label>
                            <Input
                              type="date"
                              value={((sessionFormData.data_aplicacao as string) || sessionDate) ?? ''}
                              onChange={(e) => setSessionFormData((prev) => ({ ...prev, data_aplicacao: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Número de pontos de aplicação</Label>
                            <Input
                              type="number"
                              min={0}
                              value={(sessionFormData.numero_pontos_aplicacao as string) ?? ''}
                              onChange={(e) => setSessionFormData((prev) => ({ ...prev, numero_pontos_aplicacao: e.target.value }))}
                              placeholder="Ex: 12"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Diluição utilizada</Label>
                            <Input
                              value={(sessionFormData.diluicao_utilizada as string) ?? ''}
                              onChange={(e) => setSessionFormData((prev) => ({ ...prev, diluicao_utilizada: e.target.value }))}
                              placeholder="Ex: 2,5 ml soro"
                            />
                          </div>
                        </div>
                        {!isEditingSession && profile?.id && instanceId && (
                          <div className="space-y-2 sm:max-w-[280px] mx-auto">
                            <PhotoUploadField
                              label="Foto depois da sessão"
                              value={(sessionFormData.botox_foto_depois as string) ?? null}
                              onChange={(url) => setSessionFormData((prev) => ({ ...prev, botox_foto_depois: url ?? '' }))}
                              userId={profile.id}
                              instanceIdOrTemp={`${instanceId}-botox-depois`}
                              disabled={false}
                              compact
                            />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Observações</Label>
                          <Textarea
                            value={(sessionFormData.observacoes_botox as string) ?? ''}
                            onChange={(e) => setSessionFormData((prev) => ({ ...prev, observacoes_botox: e.target.value }))}
                            placeholder="Observações do procedimento Botox"
                            rows={3}
                            className="resize-y"
                          />
                        </div>
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
                                  value={botoxDueDays}
                                  onChange={(e) => setBotoxDueDays(e.target.value)}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2 h-10 shrink-0 rounded-xl"
                                onClick={openAgendaPopup}
                              >
                                <CalendarPlus className="w-4 h-4" />
                                Agendar reaplicação
                              </Button>
                            </div>
                          </div>
                          {editingSessionId && (
                            <div className="mt-4">
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
                                  {loadingSessionBilling ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      Carregando valor...
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap items-end gap-3">
                                      <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Valor (R$)</Label>
                                        <Input
                                          type="text"
                                          className="w-28 h-9 rounded-xl"
                                          inputMode="decimal"
                                          placeholder="0,00"
                                          value={sessionBilling.valor}
                                          onChange={(e) => setSessionBilling((prev) => ({ ...prev, valor: e.target.value }))}
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Forma de pagamento</Label>
                                        <Select
                                          value={sessionBilling.forma_pagamento}
                                          onValueChange={(v) =>
                                            setSessionBilling((prev) => ({ ...prev, forma_pagamento: v as FormaPagamento }))
                                          }
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
                                      {sessionBilling.forma_pagamento === 'cartao' && (
                                        <div className="space-y-1.5">
                                          <Label className="text-xs font-medium">Parcelas</Label>
                                          <Input
                                            type="number"
                                            min={1}
                                            className="w-24 h-9 rounded-xl"
                                            value={String(sessionBilling.parcelas)}
                                            onChange={(e) =>
                                              setSessionBilling((prev) => ({
                                                ...prev,
                                                parcelas: Math.max(1, Number(e.target.value || 1)),
                                              }))
                                            }
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  }

                  const sessionFieldsRaw = activeFields
                    .filter((f) => f.field_key !== 'peso_inicial')
                    .filter((f) => {
                      if (slug === 'acelerador-metabolico' && f.label === 'Foto Antes da Sessão') return false;
                      if (slug === 'bioestimulador-colageno' && f.label === 'Data de retorno') return false;
                      if (slug === 'peim' && f.field_key === 'tipo_anestesia') {
                        return sessionFormData.uso_anestesia === true;
                      }
                      if (slug !== 'emagrecimento-reducao-medidas') return true;
                      if (f.field_key === 'produto_usado' || f.field_key === 'ml')
                        return injetavelSimInicial;
                      return true;
                    });
                  const sessionFields = [...sessionFieldsRaw].sort((a, b) => {
                    if (a.field_key === 'peso_atual') return -1;
                    if (b.field_key === 'peso_atual') return 1;
                    if (a.field_key === 'altura_cm') return -1;
                    if (b.field_key === 'altura_cm') return 1;
                    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
                  });
                  if (sessionFields.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground">Nenhum campo definido para esta sessão.</p>
                    );
                  }
                  const isBotoxReapplicationField = (field: ProcedureFieldRow) =>
                    slug === 'botox' &&
                    (field.field_key === 'data_retorno' ||
                      field.field_key === 'data_reaplicacao_prevista' ||
                      field.label === 'Data de retorno' ||
                      field.label === 'Data reaplicação prevista');

                  const showBeforeAfterGallery = Boolean(editingSessionId && slug !== 'botox' && profile?.id && instanceId);
                  const isPreenchimento = slug === 'preenchimento-facial';
                  const isLipoenzimatica = slug === LIPOENZIMATICA_SLUG;
                  const isDepilacaoDef = Boolean(slug && isDepilacaoDefinitivaSlug(slug));
                  const isRegionProc = Boolean(slug && isRegionProcedureSlug(slug));
                  const regionCfg = slug && isRegionProc ? getRegionConfig(slug) : null;
                  const aplicacoes = isPreenchimento
                    ? getPreenchimentoAplicacoesForForm(sessionFormData)
                    : [];
                  const lipoAreas = isLipoenzimatica
                    ? getLipoenzimaticaAreasForForm(sessionFormData)
                    : [];
                  const lipoProdutos = isLipoenzimatica
                    ? getLipoenzimaticaProdutosForForm(sessionFormData)
                    : [];
                  const depilacaoAreas = isDepilacaoDef
                    ? getDepilacaoFormAreas(sessionFormData)
                    : [];
                  const regionItems =
                    isRegionProc && regionCfg && slug
                      ? getRegionFormItems(slug, sessionFormData)
                      : [];

                  return (
                    <>
                      {isLipoenzimatica && profile?.id ? (
                        <>
                          <LipoenzimaticaAreasSection
                            items={lipoAreas}
                            onChange={(next) =>
                              setSessionFormData((prev) => ({
                                ...prev,
                                [LIPOENZIMATICA_AREAS_STORAGE_KEY]: next,
                              }))
                            }
                            userId={profile.id}
                            instanceIdOrTemp={`${instanceId}-lipo-areas`}
                            className="space-y-4"
                          />
                          <LipoenzimaticaProdutosRepeater
                            items={lipoProdutos}
                            onChange={(next) =>
                              setSessionFormData((prev) => ({
                                ...prev,
                                [LIPOENZIMATICA_PRODUTOS_STORAGE_KEY]: next,
                              }))
                            }
                            className="space-y-3"
                          />
                        </>
                      ) : null}
                      {isDepilacaoDef && slug ? (
                        <DepilacaoDefinitivaAreasSection
                          slug={slug}
                          items={depilacaoAreas}
                          onChange={(next) =>
                            setSessionFormData((prev) => ({
                              ...prev,
                              [DEPILACAO_AREAS_STORAGE_KEY]: next,
                            }))
                          }
                          sessionDate={sessionDate}
                          className="space-y-4"
                        />
                      ) : null}
                      {isRegionProc && regionCfg ? (
                        <ProcedureRegionBlocksSection
                          regions={regionCfg.regions}
                          fields={regionCfg.fields}
                          items={regionItems}
                          onChange={(next) =>
                            setSessionFormData((prev) => ({
                              ...prev,
                              [REGION_AREAS_STORAGE_KEY]: next,
                            }))
                          }
                          className="space-y-4"
                        />
                      ) : null}
                      {sessionFields
                        .filter(
                          (f) =>
                            !(isPreenchimento && isPreenchimentoRepeatableFieldKey(f.field_key)) &&
                            !(isLipoenzimatica && isLipoenzimaticaHiddenFieldKey(f.field_key)) &&
                            !(
                              slug &&
                              isNewCustomProcedureSlug(slug) &&
                              isNewCustomHiddenFieldKey(slug, f.field_key)
                            )
                        )
                        .map((f) => {
                        if (showBeforeAfterGallery && f.field_type === 'image') return null;

                        if (isPreenchimento && f.field_key === 'plano_aplicacao') {
                          return (
                            <Fragment key={`${f.id}-preenchimento`}>
                              <PreenchimentoAplicacaoRepeater
                                items={aplicacoes}
                                onChange={(next) =>
                                  setSessionFormData((prev) => ({
                                    ...prev,
                                    [PREENCHIMENTO_APLICACAO_STORAGE_KEY]: next,
                                  }))
                                }
                                className="space-y-3"
                              />
                              {renderSessionField(
                                f,
                                sessionFormData[f.field_key],
                                (key, value) =>
                                  setSessionFormData((prev) => ({ ...prev, [key]: value }))
                              )}
                            </Fragment>
                          );
                        }

                        return isBotoxReapplicationField(f) ? null : f.field_type === 'image' ? (
                          <div key={f.id} className="space-y-2">
                            <Label>{f.label}</Label>
                            {profile?.id && instanceId && (
                              <PhotoUploadField
                                label=""
                                value={(sessionFormData[f.field_key] as string) ?? null}
                                onChange={(url) => setSessionFormData((prev) => ({ ...prev, [f.field_key]: url ?? '' }))}
                                userId={profile.id}
                                instanceIdOrTemp={`${instanceId}-session-${f.field_key}`}
                                disabled={false}
                              />
                            )}
                          </div>
                        ) : (
                          renderSessionField(
                            f,
                            f.field_key === 'imc'
                              ? (calcImc(
                                  sessionFormData.peso_atual as number | undefined,
                                  sessionFormData.altura_cm as number | undefined
                                ) ?? (sessionFormData.imc as number | undefined))
                              : sessionFormData[f.field_key],
                            (key, value) => setSessionFormData((prev) => ({ ...prev, [key]: value }))
                          ));
                      })}
                    </>
                  );
                })()}
                {(slug !== 'botox' &&
                  ((slug === 'preenchimento-facial') ||
                    PROCEDURE_SLUGS_WITH_FACIAL_MAP.includes(slug as (typeof PROCEDURE_SLUGS_WITH_FACIAL_MAP)[number]) ||
                    shouldShowTerapiaCapilarScalpMap(slug, sessionFormData as Record<string, unknown>))) && (
                  <div className="border-t border-border pt-4">
                    {(() => {
                      const mapProps = resolveApplicationMapProps(slug, sessionFormData as Record<string, unknown>);
                      return (
                    <BotoxFacialMap
                      points={(sessionFormData.pontos_aplicacao as FacialPoint[] | undefined) ?? []}
                      onChange={(points) => setSessionFormData((prev) => ({ ...prev, pontos_aplicacao: points }))}
                      strokes={(sessionFormData.riscos_aplicacao as FacialStroke[] | undefined) ?? []}
                      onStrokesChange={(next) =>
                        setSessionFormData((prev) => ({ ...prev, riscos_aplicacao: next }))
                      }
                      imageSrc={mapProps.imageSrc}
                      caption={mapProps.caption}
                      viewBoxWidth={mapProps.viewBoxWidth}
                      viewBoxHeight={mapProps.viewBoxHeight}
                    />
                      );
                    })()}
                  </div>
                )}
                {slug === 'emagrecimento-reducao-medidas' && profile?.id && instanceId && !editingSessionId && (
                  <div className="border-t border-border pt-4 space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-1">Fotos Depois</h4>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <PhotoUploadField
                          label="Depois - Frente"
                          value={sessionFormData.depois_frente as string | undefined}
                          onChange={(url) => setSessionFormData((prev) => ({ ...prev, depois_frente: url ?? '' }))}
                          userId={profile.id}
                          instanceIdOrTemp={instanceId}
                          compact
                        />
                        <PhotoUploadField
                          label="Depois - Lado"
                          value={sessionFormData.depois_lado as string | undefined}
                          onChange={(url) => setSessionFormData((prev) => ({ ...prev, depois_lado: url ?? '' }))}
                          userId={profile.id}
                          instanceIdOrTemp={instanceId}
                          compact
                        />
                        <PhotoUploadField
                          label="Depois - Costas"
                          value={sessionFormData.depois_costas as string | undefined}
                          onChange={(url) => setSessionFormData((prev) => ({ ...prev, depois_costas: url ?? '' }))}
                          userId={profile.id}
                          instanceIdOrTemp={instanceId}
                          compact
                        />
                      </div>
                    </div>
                  </div>
                )}
                {slug && slug !== 'botox' && slug !== 'emagrecimento-reducao-medidas' && (
                  <div className="rounded-lg border border-border bg-muted/10 overflow-hidden border-t border-border pt-4">
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
                            value={proximaAvaliacaoDias}
                            onChange={(e) => setProximaAvaliacaoDias(e.target.value)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2 h-10 shrink-0 rounded-xl"
                          onClick={openAgendaPopupProximaAvaliacao}
                        >
                          <CalendarPlus className="w-4 h-4" />
                          Agendar próxima avaliação
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-2 border-t border-border pt-4">
                  <Label>Observações da sessão (opcional)</Label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Anotações sobre esta sessão..."
                    value={sessionObservacoes}
                    onChange={(e) => setSessionObservacoes(e.target.value)}
                  />
                </div>
              </div>
              )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSessionDialogOpen(false)}>
                    Cancelar
                  </Button>
                  {!editingSessionId && (
                    <Button onClick={handleAddSession} disabled={savingSession}>
                      {savingSession ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-border bg-muted/10">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/50 mb-4">
                <Calendar className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">Nenhuma sessão registrada</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Clique em &quot;Nova sessão&quot; para registrar o acompanhamento.
              </p>
            </div>
          ) : showSessionTimeline ? (
            <section>
              <div className="relative">
                <div className="absolute left-[15px] sm:left-5 top-6 bottom-6 w-px bg-border" aria-hidden="true" />
                <ul className="space-y-0">
                  {sessions.map((s) => {
                    const isSelected = selectedTimelineSessionId === s.id;
                    const isLatestSession = latestSession?.id === s.id;
                    const isFirstSession = firstSession?.id === s.id;
                    const dataObj = (s.data as Record<string, unknown>) ?? {};
                    const initialDataForDisplay = (firstSession?.data ?? instanceData) as Record<string, unknown> | undefined;
                    const entries = sessionDataEntriesForDisplay(dataObj, initialDataForDisplay);
                    const visibleEntries = entries.filter(([key]) => key !== 'galeria_antes_depois');
                    const hasMeasures = visibleEntries.length > 0;
                    const valuesByKey = new Map<string, unknown>(visibleEntries);
                    const isEmagrecimentoTimeline = slug === 'emagrecimento-reducao-medidas';
                    const pesoVal = valuesByKey.get('peso');
                    const imcVal = valuesByKey.get('imc');
                    const alturaVal = valuesByKey.get('altura_cm');
                    const produtoVal = valuesByKey.get('produto_usado') ?? valuesByKey.get('produto_utilizado');
                    const dosagemVal = valuesByKey.get('ml');
                    const sessionAntesUrl =
                      photos.find((p) => p.procedure_session_id === s.id && p.photo_type === 'antes')?.file_url?.trim() ?? '';
                    const sessionDepoisUrl =
                      photos.find((p) => p.procedure_session_id === s.id && p.photo_type === 'depois')?.file_url?.trim() ?? '';
                    const hasSessionBeforeAfterPhotos = Boolean(sessionAntesUrl || sessionDepoisUrl);
                    const sessionPhotos = photos.filter((p) => p.procedure_session_id === s.id);
                    const sessionGalleryBeforeByIndex = new Map<number, string>();
                    const sessionGalleryAfterByIndex = new Map<number, string>();
                    sessionPhotos.forEach((photo) => {
                      const beforeMatch = /^gallery_before_(\d+)$/.exec(photo.photo_type ?? '');
                      if (beforeMatch && typeof photo.file_url === 'string' && photo.file_url.trim()) {
                        sessionGalleryBeforeByIndex.set(Number(beforeMatch[1]), photo.file_url.trim());
                        return;
                      }
                      const afterMatch = /^gallery_after_(\d+)$/.exec(photo.photo_type ?? '');
                      if (afterMatch && typeof photo.file_url === 'string' && photo.file_url.trim()) {
                        sessionGalleryAfterByIndex.set(Number(afterMatch[1]), photo.file_url.trim());
                      }
                    });
                    const sessionGalleryPairIndexes = Array.from(
                      new Set([...sessionGalleryBeforeByIndex.keys(), ...sessionGalleryAfterByIndex.keys()])
                    ).sort((a, b) => a - b);
                    const sessionGalleryCaptionsByIndex = new Map<number, string>();
                    const sessionGalleryData = (dataObj.galeria_antes_depois as { pairs?: Array<{ caption?: string | null }> } | undefined)?.pairs;
                    if (Array.isArray(sessionGalleryData)) {
                      sessionGalleryData.forEach((pair, i) => {
                        const caption = typeof pair?.caption === 'string' ? pair.caption.trim() : '';
                        if (caption) sessionGalleryCaptionsByIndex.set(i + 1, caption);
                      });
                    }
                    const sessionGalleryPairs = sessionGalleryPairIndexes
                      .map((idx) => ({
                        idx,
                        beforeUrl: sessionGalleryBeforeByIndex.get(idx) ?? '',
                        afterUrl: sessionGalleryAfterByIndex.get(idx) ?? '',
                        caption: sessionGalleryCaptionsByIndex.get(idx) ?? '',
                      }))
                      .filter((pair) => pair.beforeUrl || pair.afterUrl);
                    const hasSessionGalleryPairs = sessionGalleryPairs.length > 0;
                    const isBotoxTimeline = slug === 'botox';
                    const isBioestimuladorColagenoTimeline = slug === 'bioestimulador-colageno';
                    const isFacialTimeline =
                      slug === 'botox' ||
                      slug === 'preenchimento-facial' ||
                      (PROCEDURE_SLUGS_WITH_FACIAL_MAP.includes(
                        slug as (typeof PROCEDURE_SLUGS_WITH_FACIAL_MAP)[number]
                      ) &&
                        slug !== 'harmonizacao-glutea');
                    const isProcedureInlineTimeline = isFacialTimeline;
                    const pts = Array.isArray(dataObj.pontos_aplicacao) ? (dataObj.pontos_aplicacao as FacialPoint[]) : [];
                    const risc = Array.isArray(dataObj.riscos_aplicacao) ? (dataObj.riscos_aplicacao as FacialStroke[]) : [];
                    const hasMapData = pts.length > 0 || risc.length > 0;
                    const fallbackData = initialDataForDisplay ?? {};
                    const hasOwnDataKey = (obj: Record<string, unknown>, key: string): boolean =>
                      Object.prototype.hasOwnProperty.call(obj, key);
                    const getFirstTimelineValue = (...keys: string[]): unknown => {
                      // 1) Prioriza SEMPRE os dados da própria sessão (inclusive para refletir edição imediatamente).
                      // Se houver chave na sessão, tenta todos os aliases antes de concluir vazio.
                      // Só evita fallback se ao menos uma chave-alias existir na sessão.
                      let foundOwnAlias = false;
                      for (const key of keys) {
                        if (!hasOwnDataKey(dataObj, key)) continue;
                        foundOwnAlias = true;
                        const value = dataObj[key];
                        if (value == null) continue;
                        if (typeof value === 'string' && value.trim() === '') continue;
                        return value;
                      }
                      if (foundOwnAlias) return null;
                      // 2) Fallback apenas quando a chave não existe na sessão atual.
                      for (const key of keys) {
                        const value = valuesByKey.get(key) ?? fallbackData[key];
                        if (value == null) continue;
                        if (typeof value === 'string' && value.trim() === '') continue;
                        return value;
                      }
                      return null;
                    };
                    const botoxProduto = getFirstTimelineValue(
                      'produto_utilizado',
                      'produto_usado',
                      'produto',
                      'produto_aplicado'
                    );
                    const botoxLote = getFirstTimelineValue(
                      'lote',
                      'numero_lote',
                      'lote_produto',
                      'lote_do_produto'
                    );
                    const botoxMarca = getFirstTimelineValue('marca_toxina', 'marca');
                    const botoxValidade = getFirstTimelineValue('data_validade', 'validade', 'validade_ate', 'valido_ate');
                    const botoxTecnica = getFirstTimelineValue('tecnica');
                    const botoxDiluicao = getFirstTimelineValue('diluicao_utilizada');
                    const botoxVolume = getFirstTimelineValue('quantidade_unidade', 'volume_aplicado', 'ml');
                    const botoxIntervalo = getFirstTimelineValue(
                      'intervalo_sessoes',
                      'intervalo_sessoes_dias',
                      'intervalo_reaplicacao_dias'
                    );
                    const botoxIntercorrencias = getFirstTimelineValue('intercorrencias') ?? (s as SessionRow).observacoes;
                    const botoxObservacoes = getFirstTimelineValue('observacoes_botox');
                    const botoxRegioes = getFirstTimelineValue('regiao_tratada', 'regioes_aplicadas');
                    const formatBotoxValue = (key: string, value: unknown, suffix?: string): string | null => {
                      if (value == null) return null;
                      const formatted = formatSessionValue(key, value).trim();
                      if (!formatted) return null;
                      return suffix ? `${formatted} ${suffix}` : formatted;
                    };
                    const botoxProdutoText = formatBotoxValue('produto_utilizado', botoxProduto);
                    const botoxLoteText = formatBotoxValue('lote', botoxLote);
                    const botoxSummaryItems = [
                      { label: 'Marca', value: formatBotoxValue('marca_toxina', botoxMarca) },
                      { label: 'Válido até', value: formatBotoxValue('data_validade', botoxValidade) },
                      { label: 'Técnica', value: formatBotoxValue('tecnica', botoxTecnica) },
                      { label: 'Diluição utilizada', value: formatBotoxValue('diluicao_utilizada', botoxDiluicao) },
                      { label: 'Volume aplicado', value: formatBotoxValue('ml', botoxVolume, 'mL') },
                      { label: 'Intervalo sessões', value: formatBotoxValue('intervalo_sessoes', botoxIntervalo, 'dias') },
                      { label: 'Intercorrências', value: formatBotoxValue('intercorrencias', botoxIntercorrencias) },
                      { label: 'Observações', value: formatBotoxValue('observacoes_botox', botoxObservacoes) },
                    ].filter((item) => Boolean(item.value));
                    const getFacialTimelineLabel = (key: string): string => {
                      const normalized = key.toLowerCase();
                      if (['produto', 'produto_usado', 'produto_utilizado', 'produto_aplicado'].includes(normalized)) return 'Produto';
                      if (['lote', 'numero_lote', 'lote_produto', 'lote_do_produto'].includes(normalized)) return 'Lote';
                      if (['marca', 'marca_toxina'].includes(normalized)) return 'Marca';
                      if (['data_validade', 'validade', 'validade_ate', 'valido_ate'].includes(normalized)) return 'Válido até';
                      if (normalized === 'tecnica') return 'Técnica';
                      if (normalized === 'diluicao_utilizada') return 'Diluição utilizada';
                      if (['quantidade_unidade', 'volume_aplicado', 'ml'].includes(normalized)) return 'Volume aplicado';
                      if (['intervalo_sessoes', 'intervalo_sessoes_dias', 'intervalo_reaplicacao_dias'].includes(normalized))
                        return 'Intervalo sessões';
                      if (normalized === 'intercorrencias') return 'Intercorrências';
                      if (['data_aplicacao', 'session_date'].includes(normalized)) return 'Data de aplicação';
                      if (['regiao_tratada', 'regioes_aplicadas'].includes(normalized)) return 'Regiões aplicadas';
                      return getFieldLabel(key);
                    };
                    const facialSummaryItems = !isBotoxTimeline && !isBioestimuladorColagenoTimeline
                      ? visibleEntries
                          .filter(([key]) =>
                            ![
                              'pontos_aplicacao',
                              'riscos_aplicacao',
                              'galeria_antes_depois',
                              'regiao_tratada',
                              'regioes_aplicadas',
                            ].includes(key)
                          )
                          .map(([key, val]) => {
                            const formatted = formatSessionValue(key, val).trim();
                            return {
                              label: getFacialTimelineLabel(key),
                              value: formatted || null,
                            };
                          })
                          .filter((item): item is { label: string; value: string } => Boolean(item.value))
                      : [];
                    if (!isBotoxTimeline && !isBioestimuladorColagenoTimeline) {
                      const sessionObs = ((s as SessionRow).observacoes ?? '').trim();
                      if (sessionObs) {
                        facialSummaryItems.push({ label: 'Observações', value: sessionObs });
                      }
                    }
                    const inlineSummaryItems =
                      isBotoxTimeline || isBioestimuladorColagenoTimeline
                        ? botoxSummaryItems
                        : facialSummaryItems;
                    const shouldShowEmptyInlineSummary =
                      inlineSummaryItems.length === 0 &&
                      !(isBotoxTimeline || isBioestimuladorColagenoTimeline
                        ? (botoxProdutoText || botoxLoteText)
                        : false);
                    const botoxRegioesText = formatBotoxValue('regiao_tratada', botoxRegioes);
                    return (
                      <li key={`timeline-${s.id}`} className="relative flex gap-4 sm:gap-5">
                        <div
                          className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-card text-primary ${
                            isSelected ? 'border-primary' : 'border-border'
                          }`}
                        >
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1 pb-6">
                          <div
                            className={`w-full cursor-pointer rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/30 ${
                              isSelected ? 'border-primary/70' : 'border-border'
                            }`}
                            onClick={() => setSelectedTimelineSessionId(s.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedTimelineSessionId(s.id);
                              }
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <time className="block font-semibold text-foreground">
                                  {format(parseLocalDate(s.session_date), "d 'de' MMMM yyyy", { locale: ptBR })}
                                </time>
                                <p className="mt-0.5 text-sm text-muted-foreground">{procedure.name}</p>
                                {isLatestSession && (
                                  <span className="mt-2 inline-flex rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                    Última sessão
                                  </span>
                                )}
                                {isFirstSession && (
                                  <span className="mt-2 ml-1 inline-flex rounded-full border border-border/70 bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                    Sessão inicial
                                  </span>
                                )}
                              </div>
                              <div
                                className="flex items-center justify-end gap-0.5"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                              >
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                  onClick={() => openEditSession(s)}
                                  title="Editar"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <AlertDialog open={deleteSessionId === s.id} onOpenChange={(o) => !o && setDeleteSessionId(null)}>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => setDeleteSessionId(s.id)}
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir sessão?</AlertDialogTitle>
                                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteSession(s.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Excluir
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>

                            {isSelected && (
                              <div className="mt-3">
                                {hasMeasures &&
                                  (isEmagrecimentoTimeline ? (
                                    <div className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-b from-primary/15 via-primary/10 to-primary/20">
                                      <div className="border-b border-primary/20 bg-background/85 px-4 py-3">
                                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:text-base">
                                          <span className="inline-flex items-center gap-2 font-semibold uppercase tracking-wide text-primary">
                                            <img src={TIMELINE_ICON_URLS.peso} alt="" className="h-5 w-5 shrink-0" />
                                            Peso:
                                          </span>
                                          <span className="text-xl font-bold text-foreground">
                                            {pesoVal != null ? `${formatSessionValue('peso', pesoVal)} kg` : '--'}
                                          </span>
                                          <span className="text-muted-foreground">
                                            IMC: {imcVal != null ? formatSessionValue('imc', imcVal) : '--'}
                                          </span>
                                          <span className="text-muted-foreground">
                                            Altura: {alturaVal != null ? formatSessionValue('altura_cm', alturaVal) : '--'}
                                          </span>
                                        </p>
                                      </div>

                                      <div className="grid grid-cols-1 gap-0 border-b border-primary/20 md:grid-cols-2">
                                        <div className="space-y-2 px-4 py-3 md:border-r md:border-primary/20">
                                          <p className="text-sm font-semibold text-foreground">Circunferências</p>
                                          {[
                                            ['busto_cm', 'Busto'],
                                            ['cintura_cm', 'Cintura'],
                                            ['quadril_cm', 'Quadril'],
                                          ].map(([key, label]) => (
                                            <div key={key} className="flex items-center justify-between text-sm">
                                              {(() => {
                                                const rawValue = valuesByKey.get(key);
                                                const displayValue =
                                                  rawValue == null || rawValue === ''
                                                    ? '--'
                                                    : `${formatSessionValue(key, rawValue)} cm`;
                                                return (
                                                  <>
                                              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                                {key === 'busto_cm' ? (
                                                  <img src={TIMELINE_ICON_URLS.busto} alt="" className="h-6 w-6 shrink-0" />
                                                ) : key === 'cintura_cm' ? (
                                                  <img src={TIMELINE_ICON_URLS.cintura} alt="" className="h-6 w-6 shrink-0" />
                                                ) : (
                                                  <img src={TIMELINE_ICON_URLS.quadril} alt="" className="h-6 w-6 shrink-0" />
                                                )}
                                                {label}
                                              </span>
                                              <span className="font-medium text-foreground">
                                                {displayValue}
                                              </span>
                                                  </>
                                                );
                                              })()}
                                            </div>
                                          ))}
                                        </div>
                                        <div className="space-y-2 px-4 py-3">
                                          <p className="text-sm font-semibold text-foreground">Detalhamento de corpo</p>
                                          {[
                                            ['braco_cm', 'Braço'],
                                            ['abdomen_superior_cm', 'Abdômen Sup.'],
                                            ['abdomen_inferior_cm', 'Abdômen Inf.'],
                                          ].map(([key, label]) => (
                                            <div key={key} className="flex items-center justify-between text-sm">
                                              {(() => {
                                                const rawValue = valuesByKey.get(key);
                                                const displayValue =
                                                  rawValue == null || rawValue === ''
                                                    ? '--'
                                                    : `${formatSessionValue(key, rawValue)} cm`;
                                                return (
                                                  <>
                                              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                                {key === 'braco_cm' ? (
                                                  <img src={TIMELINE_ICON_URLS.braco} alt="" className="h-6 w-6 shrink-0" />
                                                ) : (
                                                  <img src={TIMELINE_ICON_URLS.abdomen} alt="" className="h-6 w-6 shrink-0" />
                                                )}
                                                {label}
                                              </span>
                                              <span className="font-medium text-foreground">
                                                {displayValue}
                                              </span>
                                                  </>
                                                );
                                              })()}
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="bg-background/85 px-4 py-3">
                                        <p className="text-sm font-semibold text-foreground">Protocolo de tratamento</p>
                                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                          <span className="inline-flex items-center gap-1.5 min-w-0">
                                            <img src={TIMELINE_ICON_URLS.protocolo} alt="" className="h-6 w-6 shrink-0" />
                                            <span className="min-w-0 break-words">
                                              Produto usado:{' '}
                                              <span className="font-medium text-foreground">
                                                {produtoVal != null ? formatSessionValue('produto_usado', produtoVal) : '--'}
                                              </span>
                                            </span>
                                            <span className="hidden shrink-0 sm:inline">|</span>
                                          </span>
                                          <span className="inline-flex items-center gap-1.5 min-w-0">
                                            <img src={TIMELINE_ICON_URLS.seringa} alt="" className="h-6 w-6 shrink-0" />
                                            <span className="min-w-0 break-words">
                                              Dosagem (mg):{' '}
                                              <span className="font-medium text-foreground">
                                                {dosagemVal != null ? formatSessionValue('ml', dosagemVal) : '--'}
                                              </span>
                                            </span>
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ) : isProcedureInlineTimeline ? (
                                    <div className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-b from-primary/10 via-primary/5 to-primary/15 p-2 sm:p-4">
                                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(120px,0.85fr)] lg:gap-3">
                                        <div className="rounded-xl border border-border/60 bg-background/80 px-2.5 py-3 sm:px-3">
                                          <div className="space-y-3 text-sm">
                                            {botoxProdutoText ? (
                                              <div>
                                                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Produto</p>
                                                <p className="mt-0.5 text-lg font-bold text-foreground sm:text-xl">
                                                  {botoxProdutoText}
                                                </p>
                                                {botoxLoteText ? (
                                                  <p className="text-xs text-muted-foreground">
                                                    (Lote: {botoxLoteText})
                                                  </p>
                                                ) : null}
                                              </div>
                                            ) : null}
                                            {inlineSummaryItems.length > 0 ? (
                                              inlineSummaryItems.map((item) => (
                                                <div key={item.label}>
                                                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{item.label}</p>
                                                  <p className="mt-0.5 text-base font-semibold text-foreground whitespace-pre-wrap break-words sm:text-lg">
                                                    {item.value}
                                                  </p>
                                                </div>
                                              ))
                                            ) : shouldShowEmptyInlineSummary ? (
                                              <p className="text-xs text-muted-foreground">Sem dados preenchidos nesta sessão.</p>
                                            ) : null}
                                            {(isBotoxTimeline || isBioestimuladorColagenoTimeline) && !botoxProdutoText && botoxLoteText ? (
                                              <div>
                                                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Lote</p>
                                                <p className="mt-0.5 text-base font-semibold text-foreground whitespace-pre-wrap break-words sm:text-lg">
                                                  {botoxLoteText}
                                                </p>
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                        <div className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-background/80 px-2 py-2.5 sm:px-2.5 sm:py-2.5 md:px-3 md:py-3">
                                          <div className="flex flex-col items-start gap-1 lg:flex-row lg:items-center lg:justify-between lg:gap-2">
                                            <p className="text-[9px] font-semibold tracking-[0.02em] text-foreground sm:text-sm sm:tracking-wide break-words">
                                              Mapa de aplicação
                                            </p>
                                            <span className="inline-flex items-center rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium leading-none text-primary lg:self-auto lg:rounded-full lg:px-2 lg:text-[10px]">
                                              {pts.length} ponto{pts.length === 1 ? '' : 's'}
                                            </span>
                                          </div>
                                          <div className="mt-1.5 flex justify-center">
                                            {hasMapData ? (
                                              <div className="flex flex-col items-center">
                                                <BotoxFacialMap
                                                  points={pts}
                                                  onChange={() => {}}
                                                  strokes={risc}
                                                  readOnly
                                                  displaySize={98}
                                                  imageSrc={undefined}
                                                />
                                              </div>
                                            ) : (
                                              <div className="flex min-h-[220px] items-center justify-center text-sm text-muted-foreground">
                                                Sem mapa de aplicação
                                              </div>
                                            )}
                                          </div>
                                          {botoxRegioesText ? (
                                            <div className="mt-2 rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
                                              <p className="whitespace-nowrap text-center text-[8px] font-medium uppercase tracking-[0.02em] text-muted-foreground sm:text-[10px] sm:tracking-[0.08em]">Regiões aplicadas</p>
                                              <p className="mt-0.5 text-center text-xs font-medium leading-snug text-foreground sm:text-xs md:text-sm">
                                                {botoxRegioesText}
                                              </p>
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3 2xl:grid-cols-4">
                                      {visibleEntries.map(([key, val]) => (
                                        <div
                                          key={key}
                                          className={`rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5 ${
                                            key === 'data_aplicacao'
                                              ? 'order-1'
                                              : key === 'produto_utilizado'
                                                ? 'order-2'
                                                : key === 'regiao_tratada'
                                                  ? 'order-3 sm:col-span-2 xl:col-span-2'
                                                  : ''
                                          }`}
                                        >
                                          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground break-words">
                                            {getFieldLabel(key)}
                                          </p>
                                          <p className="mt-0.5 text-xs sm:text-sm font-semibold leading-relaxed text-foreground break-words whitespace-pre-wrap">
                                            {formatSessionValue(key, val)}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                {!isProcedureInlineTimeline && (s as SessionRow).observacoes?.trim() && (
                                  <div className="mt-3 border-t border-border/60 pt-3">
                                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Observações</p>
                                    <p className="whitespace-pre-wrap text-sm text-foreground">{(s as SessionRow).observacoes}</p>
                                  </div>
                                )}
                                {hasSessionGalleryPairs ? (
                                  <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                      Galeria antes/depois da sessão
                                    </p>
                                    <div className="overflow-x-auto pb-1">
                                      <div className="flex w-max min-w-full gap-2">
                                      {sessionGalleryPairs.map((pair) => (
                                        <div
                                          key={`${s.id}-gallery-pair-${pair.idx}`}
                                          className="min-w-[250px] max-w-[280px] flex-none overflow-hidden rounded-xl border border-border/60 bg-muted/15"
                                        >
                                          {pair.caption ? (
                                            <p className="border-b border-border/50 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground">
                                              {pair.caption}
                                            </p>
                                          ) : null}
                                          <div className="grid grid-cols-2 gap-0">
                                            <div className="border-r border-border/50">
                                              <p className="border-b border-border/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center">
                                                Antes
                                              </p>
                                              {pair.beforeUrl ? (
                                                <div className="aspect-[4/5] overflow-hidden bg-muted/40">
                                                  <img
                                                    src={pair.beforeUrl}
                                                    alt="Foto antes da galeria da sessão"
                                                    className="h-full w-full object-cover"
                                                    loading="lazy"
                                                    decoding="async"
                                                  />
                                                </div>
                                              ) : (
                                                <div className="flex aspect-[4/5] items-center justify-center p-2 text-[11px] text-muted-foreground">
                                                  Sem foto antes
                                                </div>
                                              )}
                                            </div>
                                            <div>
                                              <p className="border-b border-border/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center">
                                                Depois
                                              </p>
                                              {pair.afterUrl ? (
                                                <div className="aspect-[4/5] overflow-hidden bg-muted/40">
                                                  <img
                                                    src={pair.afterUrl}
                                                    alt="Foto depois da galeria da sessão"
                                                    className="h-full w-full object-cover"
                                                    loading="lazy"
                                                    decoding="async"
                                                  />
                                                </div>
                                              ) : (
                                                <div className="flex aspect-[4/5] items-center justify-center p-2 text-[11px] text-muted-foreground">
                                                  Sem foto depois
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                      </div>
                                    </div>
                                  </div>
                                ) : hasSessionBeforeAfterPhotos ? (
                                  <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                      Fotos da sessão
                                    </p>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                      <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/15">
                                        <p className="border-b border-border/50 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                          Antes
                                        </p>
                                        {sessionAntesUrl ? (
                                          <div className="aspect-[4/5] overflow-hidden bg-muted/40">
                                            <img
                                              src={sessionAntesUrl}
                                              alt="Foto antes da sessão"
                                              className="h-full w-full object-cover"
                                              loading="lazy"
                                              decoding="async"
                                            />
                                          </div>
                                        ) : (
                                          <div className="flex aspect-[4/5] items-center justify-center p-2 text-xs text-muted-foreground">
                                            Sem foto antes
                                          </div>
                                        )}
                                      </div>
                                      <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/15">
                                        <p className="border-b border-border/50 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                          Depois
                                        </p>
                                        {sessionDepoisUrl ? (
                                          <div className="aspect-[4/5] overflow-hidden bg-muted/40">
                                            <img
                                              src={sessionDepoisUrl}
                                              alt="Foto depois da sessão"
                                              className="h-full w-full object-cover"
                                              loading="lazy"
                                              decoding="async"
                                            />
                                          </div>
                                        ) : (
                                          <div className="flex aspect-[4/5] items-center justify-center p-2 text-xs text-muted-foreground">
                                            Sem foto depois
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ) : null}
                                {!isProcedureInlineTimeline &&
                                  shouldShowApplicationMapInSession(slug, dataObj, pts.length, risc.length) &&
                                  (() => {
                                    const mapProps = resolveApplicationMapProps(slug, dataObj);
                                    return (
                                      <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                          Mapa de aplicação
                                        </p>
                                        <div className="flex flex-col items-center gap-2">
                                          <BotoxFacialMap
                                            points={pts}
                                            onChange={() => {}}
                                            strokes={risc}
                                            readOnly
                                            displaySize={180}
                                            imageSrc={mapProps.imageSrc}
                                            caption={mapProps.caption}
                                            viewBoxWidth={mapProps.viewBoxWidth}
                                            viewBoxHeight={mapProps.viewBoxHeight}
                                          />
                                          <p className="text-xs text-muted-foreground">
                                            {pts.length} ponto(s)
                                            {risc.length > 0 ? ` · ${risc.length} risco(s)` : ''}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })()}
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          ) : (
            <ul className="space-y-3">
              {sessions.map((s) => {
                const dataObj = (s.data as Record<string, unknown>) ?? {};
                const initialDataForDisplay = (firstSession?.data ?? instanceData) as Record<string, unknown> | undefined;
                const entries = sessionDataEntriesForDisplay(dataObj, initialDataForDisplay);
                const visibleEntries = entries.filter(([key]) => key !== 'galeria_antes_depois');
                const hasMeasures = visibleEntries.length > 0;
                const isLatestSession = latestSession?.id === s.id;
                const isFirstSession = firstSession?.id === s.id;
                const isExpandedSession = isLatestSession ? !latestSessionMeasuresCollapsed : expandedMeasuresIds.has(s.id);
                return (
                  <li
                    key={s.id}
                    className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-all duration-200 hover:shadow-md"
                  >
                    <div className="p-4 sm:p-5">
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <Calendar className="h-5 w-5" />
                            </div>
                            <time className="min-w-0 text-base sm:text-lg font-semibold leading-tight text-foreground tabular-nums">
                              {format(parseLocalDate(s.session_date), "d 'de' MMM. yyyy", { locale: ptBR })}
                            </time>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {isLatestSession && (
                              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Última sessão</span>
                            )}
                            {isFirstSession && (
                              <span className="rounded-full border border-border/70 bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Sessão inicial</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 self-end shrink-0 sm:self-start">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            onClick={() => openEditSession(s)}
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog open={deleteSessionId === s.id} onOpenChange={(o) => !o && setDeleteSessionId(null)}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                            className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeleteSessionId(s.id)}
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir sessão?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteSession(s.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      {hasMeasures && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mb-3 h-10 w-full justify-between rounded-lg border border-border/70 bg-muted/10 py-2 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground sm:hidden"
                            onClick={() => toggleSessionMeasures(s.id, isLatestSession)}
                          >
                            <span className="text-sm font-medium">
                              {isExpandedSession ? 'Ocultar medidas' : 'Ver medidas'}
                            </span>
                            {isExpandedSession ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                          </Button>
                          <div
                            className={`grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 ${!isExpandedSession ? 'hidden sm:grid' : ''}`}
                          >
                            {visibleEntries.map(([key, val]) => (
                              <div
                                key={key}
                                className={`rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5 ${
                                  key === 'data_aplicacao'
                                    ? 'order-1'
                                    : key === 'produto_utilizado'
                                      ? 'order-2'
                                      : key === 'regiao_tratada'
                                        ? 'order-3 sm:col-span-2 md:col-span-3 lg:col-span-2'
                                        : ''
                                }`}
                              >
                                <p className="text-[10px] sm:text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground break-words">
                                  {getFieldLabel(key)}
                                </p>
                                <p className="mt-0.5 text-xs sm:text-sm font-semibold leading-relaxed text-foreground break-words whitespace-pre-wrap">
                                  {formatSessionValue(key, val)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      {(s as SessionRow).observacoes?.trim() && (
                        <div className="mt-3 pt-3 border-t border-border/60">
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Observações</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{(s as SessionRow).observacoes}</p>
                        </div>
                      )}
                      {shouldShowApplicationMapInSession(
                        slug,
                        dataObj,
                        Array.isArray(dataObj.pontos_aplicacao) ? (dataObj.pontos_aplicacao as FacialPoint[]).length : 0,
                        Array.isArray(dataObj.riscos_aplicacao) ? (dataObj.riscos_aplicacao as FacialStroke[]).length : 0
                      ) &&
                        (() => {
                          const pts = Array.isArray(dataObj.pontos_aplicacao) ? (dataObj.pontos_aplicacao as FacialPoint[]) : [];
                          const risc = Array.isArray(dataObj.riscos_aplicacao) ? (dataObj.riscos_aplicacao as FacialStroke[]) : [];
                          const mapProps = resolveApplicationMapProps(slug, dataObj);
                          return (
                        <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Mapa de aplicação
                          </p>
                          <div className="flex flex-col items-center gap-2">
                            <BotoxFacialMap
                              points={pts}
                              onChange={() => {}}
                              strokes={risc}
                              readOnly
                              displaySize={180}
                              imageSrc={mapProps.imageSrc}
                              caption={mapProps.caption}
                              viewBoxWidth={mapProps.viewBoxWidth}
                              viewBoxHeight={mapProps.viewBoxHeight}
                            />
                            <p className="text-xs text-muted-foreground">
                              {pts.length} ponto(s)
                              {risc.length > 0 ? ` · ${risc.length} risco(s)` : ''}
                            </p>
                          </div>
                        </div>
                          );
                        })()}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Dados iniciais — oculto a pedido
      <CollapsibleSection
        title="Dados iniciais"
        description={procedure.description ?? 'Data de início e status do procedimento'}
        defaultOpen={false}
        preview={
          firstSession?.data && typeof firstSession.data === 'object' ? (
            <div className="flex flex-wrap gap-3">
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Data de início</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">
                  {patientTreatmentStartDate
                    ? format(parseLocalDate(patientTreatmentStartDate), 'dd/MM/yyyy', { locale: ptBR })
                    : format(parseLocalDate(instance.data_inicio), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</p>
                <p className="mt-0.5 text-sm font-semibold">{instance.status === 'em_andamento' ? 'Em andamento' : instance.status}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum dado inicial registrado.</p>
          )
        }
      >
        {fieldsReady && firstSession?.data && typeof firstSession.data === 'object' && slug === 'emagrecimento-reducao-medidas' ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Data de início</p>
                  <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">
                    {patientTreatmentStartDate
                      ? format(parseLocalDate(patientTreatmentStartDate), 'dd/MM/yyyy', { locale: ptBR })
                      : format(parseLocalDate(instance.data_inicio), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>
                {sessionDataEntriesForDisplay(firstSession.data as Record<string, unknown>)
                  .filter(([key]) => ['peso', 'produto_usado', 'ml'].includes(key))
                  .map(([key, val]) => (
                    <div key={key} className="rounded-lg border border-border bg-muted/20 px-3 py-3">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{getFieldLabel(key)}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">{formatSessionValue(key, val)}</p>
                    </div>
                  ))}
              </div>
              {!showAllInitialData ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-2 w-full"
                  onClick={() => setShowAllInitialData(true)}
                >
                  <ChevronDown className="w-4 h-4" />
                  Mostrar tudo
                </Button>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-3">
                    <div className="rounded-lg border border-border bg-muted/20 px-3 py-3">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {instance.status === 'em_andamento' ? 'Em andamento' : instance.status}
                      </p>
                    </div>
                    {sessionDataEntriesForDisplay(firstSession.data as Record<string, unknown>)
                      .filter(([key]) => !['peso', 'produto_usado', 'ml'].includes(key))
                      .map(([key, val]) => (
                        <div key={key} className="rounded-lg border border-border bg-muted/20 px-3 py-3">
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{getFieldLabel(key)}</p>
                          <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">{formatSessionValue(key, val)}</p>
                        </div>
                      ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-2 w-full"
                    onClick={() => setShowAllInitialData(false)}
                  >
                    <ChevronUp className="w-4 h-4" />
                    Mostrar menos
                  </Button>
                </>
              )}
            </>
          ) : (
            (() => {
              const entries = fieldsReady && firstSession?.data && typeof firstSession.data === 'object'
                ? sessionDataEntriesForDisplay(firstSession.data as Record<string, unknown>)
                : [];
              const previewEntries = entries.slice(0, INITIAL_PREVIEW_FIELDS - 2);
              const restEntries = entries.slice(previewEntries.length);
              return (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div className="rounded-lg border border-border bg-muted/20 px-3 py-3">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Data de início</p>
                      <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">
                        {patientTreatmentStartDate
                          ? format(parseLocalDate(patientTreatmentStartDate), 'dd/MM/yyyy', { locale: ptBR })
                          : format(parseLocalDate(instance.data_inicio), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 px-3 py-3">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {instance.status === 'em_andamento' ? 'Em andamento' : instance.status}
                      </p>
                    </div>
                    {previewEntries.map(([key, val]) => (
                      <div key={key} className="rounded-lg border border-border bg-muted/20 px-3 py-3">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{getFieldLabel(key)}</p>
                        <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">{formatSessionValue(key, val)}</p>
                      </div>
                    ))}
                  </div>
                  {restEntries.length > 0 && (
                    !showAllInitialData ? (
                      <Button type="button" variant="outline" size="sm" className="mt-3 gap-2 w-full" onClick={() => setShowAllInitialData(true)}>
                        <ChevronDown className="w-4 h-4" />
                        Mostrar tudo
                      </Button>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-3">
                          {restEntries.map(([key, val]) => (
                            <div key={key} className="rounded-lg border border-border bg-muted/20 px-3 py-3">
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{getFieldLabel(key)}</p>
                              <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">{formatSessionValue(key, val)}</p>
                            </div>
                          ))}
                        </div>
                        <Button type="button" variant="outline" size="sm" className="mt-3 gap-2 w-full" onClick={() => setShowAllInitialData(false)}>
                          <ChevronUp className="w-4 h-4" />
                          Mostrar menos
                        </Button>
                      </>
                    )
                  )}
                  {entries.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum dado inicial registrado. Adicione uma sessão para preencher.</p>
                  )}
                </>
              );
            })()
          )}
          )}
      </CollapsibleSection>
      */}

      {/* Dados atualizados — oculto a pedido
      <CollapsibleSection
        title="Dados atualizados"
        description={latestSession ? `Última sessão (${format(parseLocalDate(latestSession.session_date), "d 'de' MMM yyyy", { locale: ptBR })})` : 'Última sessão'}
        defaultOpen={false}
        preview={
          latestSession?.data && typeof latestSession.data === 'object' ? (
            <div className="flex flex-wrap gap-3">
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Data</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">
                  {latestSession && format(parseLocalDate(latestSession.session_date), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum dado na última sessão.</p>
          )
        }
      >
        {latestSession && (
          <div className="space-y-3">
            {fieldsReady && latestSession.data && typeof latestSession.data === 'object' && slug === 'emagrecimento-reducao-medidas' ? (
              (() => {
                const entries = sessionDataEntriesForDisplay(
                  latestSession.data as Record<string, unknown>,
                  (firstSession?.data ?? instanceData) as Record<string, unknown> | undefined
                );
                const principalKeys = ['peso', 'produto_usado', 'ml'];
                const principalEntries = entries.filter(([key]) => principalKeys.includes(key));
                const restEntries = entries.filter(([key]) => !principalKeys.includes(key));
                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                      <div className="rounded-lg border border-border bg-muted/20 px-3 py-3">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Data</p>
                        <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">
                          {format(parseLocalDate(latestSession.session_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                      {principalEntries.map(([key, val]) => (
                        <div key={key} className="rounded-lg border border-border bg-muted/20 px-3 py-3">
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{getFieldLabel(key)}</p>
                          <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">{formatSessionValue(key, val)}</p>
                        </div>
                      ))}
                    </div>
                    {!showAllUpdatedData ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 gap-2 w-full"
                        onClick={() => setShowAllUpdatedData(true)}
                      >
                        <ChevronDown className="w-4 h-4" />
                        Mostrar tudo
                      </Button>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-3">
                          {restEntries.map(([key, val]) => (
                            <div key={key} className="rounded-lg border border-border bg-muted/20 px-3 py-3">
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{getFieldLabel(key)}</p>
                              <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">{formatSessionValue(key, val)}</p>
                            </div>
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3 gap-2 w-full"
                          onClick={() => setShowAllUpdatedData(false)}
                        >
                          <ChevronUp className="w-4 h-4" />
                          Mostrar menos
                        </Button>
                      </>
                    )}
                  </>
                );
              })()
            ) : (
              (() => {
                const entries = fieldsReady && latestSession.data && typeof latestSession.data === 'object'
                  ? sessionDataEntriesForDisplay(
                      latestSession.data as Record<string, unknown>,
                      (firstSession?.data ?? instanceData) as Record<string, unknown> | undefined
                    )
                  : [];
                const withDate = [
                  ['session_date', format(parseLocalDate(latestSession.session_date), 'dd/MM/yyyy', { locale: ptBR })],
                  ...entries,
                ] as [string, unknown][];
                const previewEntries = withDate.slice(0, INITIAL_PREVIEW_FIELDS);
                const restEntries = withDate.slice(previewEntries.length);
                const formatLabel = (key: string) => (key === 'session_date' ? 'Data' : getFieldLabel(key));
                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                      {previewEntries.map(([key, val]) => (
                        <div key={key} className="rounded-lg border border-border bg-muted/20 px-3 py-3">
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{formatLabel(key)}</p>
                          <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">{key === 'session_date' ? String(val) : formatSessionValue(key, val)}</p>
                        </div>
                      ))}
                    </div>
                    {restEntries.length > 0 && (
                      !showAllUpdatedData ? (
                        <Button type="button" variant="outline" size="sm" className="mt-3 gap-2 w-full" onClick={() => setShowAllUpdatedData(true)}>
                          <ChevronDown className="w-4 h-4" />
                          Mostrar tudo
                        </Button>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-3">
                            {restEntries.map(([key, val]) => (
                              <div key={key} className="rounded-lg border border-border bg-muted/20 px-3 py-3">
                                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{formatLabel(key)}</p>
                                <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">{key === 'session_date' ? String(val) : formatSessionValue(key, val)}</p>
                              </div>
                            ))}
                          </div>
                          <Button type="button" variant="outline" size="sm" className="mt-3 gap-2 w-full" onClick={() => setShowAllUpdatedData(false)}>
                            <ChevronUp className="w-4 h-4" />
                            Mostrar menos
                          </Button>
                        </>
                      )
                    )}
                    {withDate.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhum dado na última sessão.</p>
                    )}
                  </>
                );
              })()
            )}
          </div>
        )}
      </CollapsibleSection>
      */}

      {/* Comparação visual / Fotos */}
      <Card className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <CardHeader className="flex flex-col space-y-1.5 p-3 md:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm md:text-xl font-semibold leading-none tracking-tight flex items-center gap-2">
                <ImageIcon className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
                <span className="break-words">Comparação visual Antes x Depois</span>
              </CardTitle>
              <CardDescription className="text-xs md:text-sm text-muted-foreground mt-1">
                Fotos de evolução ou antes/depois
              </CardDescription>
            </div>
            {slug === 'emagrecimento-reducao-medidas' && (
              <Dialog open={visualCompareOpen} onOpenChange={setVisualCompareOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">Comparação visual</Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Comparação visual por data</DialogTitle>
                    <DialogDescription>
                      Antes x depois por sessão registrada.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {(() => {
                      const initialData = (firstSession?.data as Record<string, unknown>) ?? {};
                      const sorted = [...sessions].sort(
                        (a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
                      );
                      const sessionsWithDepois = sorted.filter((s) =>
                        photos.some((p) => p.procedure_session_id === s.id && p.photo_type?.startsWith('depois_'))
                      );
                      if (sessionsWithDepois.length === 0) {
                        return (
                          <p className="text-sm text-muted-foreground">
                            Nenhuma foto “Depois” registrada por sessão.
                          </p>
                        );
                      }
                      return (
                        <div className="grid grid-cols-1 gap-4">
                          {(['frente', 'lado', 'costas'] as const).map((pos) => {
                            const slotLabel = pos.charAt(0).toUpperCase() + pos.slice(1);
                            const fotoInicial = initialData[`foto_inicial_${pos}`] as string | undefined;
                            const firstSessionDepois = photos.find(
                              (p) => p.procedure_session_id === firstSession?.id && p.photo_type === `depois_${pos}`
                            )?.file_url;
                            const beforeUrl = fotoInicial ?? firstSessionDepois;
                            const itemsToShow = sessionsWithDepois.filter((s) =>
                              photos.some((p) => p.procedure_session_id === s.id && p.photo_type === `depois_${pos}`)
                            );
                            return (
                              <div key={pos} className="rounded-lg border border-border/70 p-3 bg-muted/10 space-y-3 min-w-[300px] overflow-x-auto">
                                <div className="text-sm font-semibold text-foreground text-center">{slotLabel}</div>
                                <div className="flex flex-nowrap gap-3">
                                  <div className="shrink-0 w-[250px] rounded-md border overflow-hidden bg-muted/30">
                                    <p className="text-[11px] font-medium text-muted-foreground px-2 py-1 text-center">Antes</p>
                                    {beforeUrl ? (
                                      <div className="block aspect-[4/5] bg-muted overflow-hidden">
                                        <img src={beforeUrl} alt={`${slotLabel} antes`} className="w-full h-full object-cover" decoding="async" loading="lazy" />
                                      </div>
                                    ) : (
                                      <div className="aspect-[4/5] flex items-center justify-center text-[11px] text-muted-foreground border-t border-dashed">
                                        Sem foto
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-nowrap gap-2 shrink-0">
                                    {itemsToShow.map((s) => {
                                      const isFirst = s.id === firstSession?.id;
                                      const dateLabel = isFirst
                                        ? '1ª sessão (referência)'
                                        : format(parseLocalDate(s.session_date), "d 'de' MMM yyyy", { locale: ptBR });
                                      const afterUrl = photos.find(
                                        (p) => p.procedure_session_id === s.id && p.photo_type === `depois_${pos}`
                                      )?.file_url;
                                      return (
                                        <div key={`${s.id}-${pos}`} className="rounded-md border overflow-hidden bg-muted/30 min-w-[250px] w-[250px]">
                                          <p className="text-[10px] font-medium text-muted-foreground px-2 py-1 text-center">
                                            {dateLabel}
                                          </p>
                                          {afterUrl ? (
                                            <div className="block aspect-[4/5] bg-muted overflow-hidden">
                                              <img src={afterUrl} alt={`${slotLabel} depois`} className="w-full h-full object-cover" decoding="async" loading="lazy" />
                                            </div>
                                          ) : (
                                            <div className="aspect-[4/5] flex items-center justify-center text-[10px] text-muted-foreground border-t border-dashed">
                                              Sem foto
                                            </div>
                                          )}
                                        </div>
                                      );
                                      })}
                                    </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-4 pt-0">
          {slug === 'emagrecimento-reducao-medidas' ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Antes = referência inicial (fotos dos dados iniciais ou da 1ª sessão). Depois = apenas sessões seguintes à primeira, para comparação.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(() => {
                  const sessionIds = new Set(sessions.map((s) => s.id));
                  const photosFromExistingSessions = photos.filter(
                    (p) => p.procedure_session_id != null && sessionIds.has(p.procedure_session_id)
                  );
                  const isOnlyFirstSession = sessions.length === 1;
                  return (['frente', 'lado', 'costas'] as const).map((pos) => {
                    const slotLabel = pos.charAt(0).toUpperCase() + pos.slice(1);
                    const initialData = (firstSession?.data as Record<string, unknown>) ?? {};
                    const fotoInicial = initialData[`foto_inicial_${pos}`] as string | undefined;
                    const firstSessionDepoisUrl = photosFromExistingSessions.find(
                      (p) => p.procedure_session_id === firstSession?.id && p.photo_type === `depois_${pos}`
                    )?.file_url;
                    const beforeUrl = fotoInicial ?? firstSessionDepoisUrl;
                    const afterPhoto = photosFromExistingSessions
                      .filter((p) => p.procedure_session_id !== firstSession?.id && p.photo_type === `depois_${pos}`)
                      .sort((a, b) => {
                        const aSession = sessions.find((s) => s.id === a.procedure_session_id);
                        const bSession = sessions.find((s) => s.id === b.procedure_session_id);
                        return new Date(bSession?.session_date ?? 0).getTime() - new Date(aSession?.session_date ?? 0).getTime();
                      })[0];
                    const afterUrl = afterPhoto?.file_url;
                  return (
                    <div key={pos} className="space-y-2">
                      <div className="text-xs font-semibold text-foreground text-center">{slotLabel}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md border overflow-hidden bg-muted/30">
                          <p className="text-[11px] font-medium text-muted-foreground px-2 py-1 text-center">Antes</p>
                          {beforeUrl ? (
                            <div className="block aspect-[4/5] bg-muted overflow-hidden">
                              <img src={beforeUrl} alt={`${slotLabel} antes`} className="w-full h-full object-cover" decoding="async" loading="lazy" />
                            </div>
                          ) : (
                            <div className="aspect-[4/5] flex items-center justify-center text-[11px] text-muted-foreground border-t border-dashed">
                              Sem foto
                            </div>
                          )}
                        </div>
                        <div className="rounded-md border overflow-hidden bg-muted/30">
                          <p className="text-[11px] font-medium text-muted-foreground px-2 py-1 text-center">Depois</p>
                          {afterUrl ? (
                            <div className="block aspect-[4/5] bg-muted overflow-hidden">
                              <img src={afterUrl} alt={`${slotLabel} depois`} className="w-full h-full object-cover" decoding="async" loading="lazy" />
                            </div>
                          ) : (
                            <div className="aspect-[4/5] flex items-center justify-center p-2 text-[11px] text-muted-foreground border-t border-dashed text-center">
                              {isOnlyFirstSession ? 'A partir da 2ª sessão' : 'Sem foto'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
                })()}
              </div>
            </div>
          ) : photos.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">Nenhuma foto adicionada.</p>
          ) : (() => {
            const validSessionIds = new Set(sessions.map((s) => s.id));
            const sessionLinkedPhotos = photos.filter(
              (p) => typeof p.procedure_session_id === 'string' && validSessionIds.has(p.procedure_session_id)
            );
            const visiblePhotos = photos.filter((p) => {
              const isBeforeAfter = p.photo_type === 'antes' || p.photo_type === 'depois';
              const hasValidSession = typeof p.procedure_session_id === 'string' && validSessionIds.has(p.procedure_session_id);
              // "antes/depois" só deve existir quando vinculado a sessão válida.
              if (isBeforeAfter) return hasValidSession;
              return p.procedure_session_id == null || hasValidSession;
            });
            const latestSessionWithBeforeAfter = sessions.find((s) =>
              sessionLinkedPhotos.some((p) => p.procedure_session_id === s.id && (p.photo_type === 'antes' || p.photo_type === 'depois'))
            );
            const beforeAfterSource = latestSessionWithBeforeAfter
              ? sessionLinkedPhotos.filter((p) => p.procedure_session_id === latestSessionWithBeforeAfter.id)
              : [];
            const antesUrl = beforeAfterSource.find((p) => p.photo_type === 'antes')?.file_url ?? null;
            const depoisUrl = beforeAfterSource.find((p) => p.photo_type === 'depois')?.file_url ?? null;
            const hasAntesDepoisPair = antesUrl && depoisUrl;
            return (
              <div className="space-y-6">
                {hasAntesDepoisPair ? (
                  <AntesDepoisCard
                    beforeImageUrl={antesUrl}
                    afterImageUrl={depoisUrl}
                    areaTreatedTitle="Área Tratada"
                    areaTreatedDescription={procedure?.name ? `Antes e depois do procedimento: ${procedure.name}` : 'Comparação antes e depois do tratamento estético.'}
                    showHeader={true}
                    beforeDescription="Estado natural antes do tratamento"
                    afterDescription="Resultado após o tratamento estético"
                  />
                ) : null}
                {(() => {
                  const gpMaps =
                    galleryReorderSource ?? {
                      galleryBeforeByIndex: new Map<number, PhotoRow>(),
                      galleryAfterByIndex: new Map<number, PhotoRow>(),
                      galleryPairIndexes: [] as number[],
                      captionByUrlPair: new Map<string, string>(),
                      nonGalleryPhotos: [] as PhotoRow[],
                    };
                  const {
                    galleryBeforeByIndex,
                    galleryAfterByIndex,
                    galleryPairIndexes,
                    captionByUrlPair,
                    nonGalleryPhotos,
                  } = gpMaps;
                  const showOtherPhotos = galleryPairIndexes.length > 0 || nonGalleryPhotos.length > 0;
                  const beforePhotoCount = galleryBeforeByIndex.size;
                  const afterPhotoCount = galleryAfterByIndex.size;
                  const canReorderGallery =
                    Boolean(profile?.id) &&
                    (galleryPairIndexes.length >= 2 || beforePhotoCount >= 2 || afterPhotoCount >= 2);
                  return showOtherPhotos ? (
                  <div className={hasAntesDepoisPair ? 'space-y-2' : ''}>
                    {hasAntesDepoisPair && <p className="text-sm font-medium text-muted-foreground">Outras fotos da evolução</p>}
                    {galleryPairIndexes.length > 0 && (
                      <div className="space-y-3">
                        {canReorderGallery ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {!galleryPairOrderEdit ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => {
                                  if (!galleryReorderSource) return;
                                  const lists = photoListsFromPairIndexOrder(
                                    galleryReorderSource.galleryPairIndexes,
                                    galleryReorderSource
                                  );
                                  setGalleryBeforeOrderDraft(lists.beforeList);
                                  setGalleryAfterOrderDraft(lists.afterList);
                                  setGalleryPairOrderEdit(true);
                                }}
                              >
                                <Pencil className="h-4 w-4 shrink-0" />
                                Editar ordem
                              </Button>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={savingGalleryPairOrder || !galleryReorderSource}
                                  onClick={() => {
                                    void persistGalleryColumnOrder(galleryBeforeOrderDraft, galleryAfterOrderDraft);
                                  }}
                                >
                                  {savingGalleryPairOrder ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin mr-1 inline" />
                                      Salvando…
                                    </>
                                  ) : (
                                    'Salvar ordem'
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={savingGalleryPairOrder}
                                  onClick={() => {
                                    setGalleryPairOrderEdit(false);
                                    setGalleryBeforeOrderDraft([]);
                                    setGalleryAfterOrderDraft([]);
                                  }}
                                >
                                  Cancelar
                                </Button>
                                <p className="text-xs text-muted-foreground basis-full">
                                  A grade é a mesma da visualização: arraste uma foto para trocar a ordem só entre Antes ou só entre Depois.
                                </p>
                              </>
                            )}
                          </div>
                        ) : null}
                        {galleryPairOrderEdit ? (
                          <DndContext
                            sensors={galleryPairReorderSensors}
                            collisionDetection={closestCenter}
                            onDragEnd={onGalleryEditDragEnd}
                          >
                            {(() => {
                              const maxEditRows = Math.max(
                                galleryBeforeOrderDraft.length,
                                galleryAfterOrderDraft.length
                              );
                              if (maxEditRows === 0) {
                                return (
                                  <p className="text-xs text-muted-foreground">Nenhuma foto da galeria para ordenar.</p>
                                );
                              }
                              const beforeIds = galleryBeforeOrderDraft.map((p) => galleryBeforeSortableId(p.id));
                              const afterIds = galleryAfterOrderDraft.map((p) => galleryAfterSortableId(p.id));
                              return (
                                <SortableContext id="gal-edit-before" items={beforeIds} strategy={rectSortingStrategy}>
                                  <SortableContext id="gal-edit-after" items={afterIds} strategy={rectSortingStrategy}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {Array.from({ length: maxEditRows }, (_, i) => {
                                        const b = galleryBeforeOrderDraft[i];
                                        const a = galleryAfterOrderDraft[i];
                                        const pairCaption =
                                          b?.file_url && a?.file_url
                                            ? captionByUrlPair.get(`${b.file_url}|||${a.file_url}`) ?? ''
                                            : '';
                                        return (
                                          <div
                                            key={`edit-gallery-row-${i}`}
                                            className="rounded-lg border border-border overflow-hidden p-3 space-y-2 bg-card/40"
                                          >
                                            {pairCaption ? (
                                              <p className="text-xs font-medium text-muted-foreground">{pairCaption}</p>
                                            ) : null}
                                            <div className="grid grid-cols-2 gap-3">
                                              {b ? (
                                                <SortableGallerySinglePhoto
                                                  photo={b}
                                                  side="before"
                                                  embedInPair
                                                />
                                              ) : (
                                                <div className="rounded-md border overflow-hidden bg-muted/20">
                                                  <p className="text-[11px] text-muted-foreground px-2 py-1 text-center">
                                                    Antes
                                                  </p>
                                                  <div className="aspect-square flex items-center justify-center text-[11px] text-muted-foreground border-t border-dashed">
                                                    Sem foto
                                                  </div>
                                                </div>
                                              )}
                                              {a ? (
                                                <SortableGallerySinglePhoto
                                                  photo={a}
                                                  side="after"
                                                  embedInPair
                                                />
                                              ) : (
                                                <div className="rounded-md border overflow-hidden bg-muted/20">
                                                  <p className="text-[11px] text-muted-foreground px-2 py-1 text-center">
                                                    Depois
                                                  </p>
                                                  <div className="aspect-square flex items-center justify-center text-[11px] text-muted-foreground border-t border-dashed">
                                                    Sem foto
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </SortableContext>
                                </SortableContext>
                              );
                            })()}
                          </DndContext>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {galleryPairIndexes.map((idx) => {
                              const before = galleryBeforeByIndex.get(idx);
                              const after = galleryAfterByIndex.get(idx);
                              const pairCaption =
                                before?.file_url && after?.file_url
                                  ? captionByUrlPair.get(`${before.file_url}|||${after.file_url}`) ?? ''
                                  : '';
                              return (
                                <div key={`gallery-pair-${idx}`} className="rounded-lg border overflow-hidden p-3 space-y-2">
                                  {pairCaption ? (
                                    <p className="text-xs font-medium text-muted-foreground">{pairCaption}</p>
                                  ) : null}
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-md border overflow-hidden">
                                      <p className="text-[11px] text-muted-foreground px-2 py-1 text-center">Antes</p>
                                      {before ? (
                                        <div className="block aspect-square bg-muted overflow-hidden">
                                          <img src={before.file_url} alt={`gallery_before_${idx}`} className="w-full h-full object-cover" decoding="async" loading="lazy" />
                                        </div>
                                      ) : (
                                        <div className="aspect-square flex items-center justify-center text-[11px] text-muted-foreground border-t border-dashed">
                                          Sem foto
                                        </div>
                                      )}
                                    </div>
                                    <div className="rounded-md border overflow-hidden">
                                      <p className="text-[11px] text-muted-foreground px-2 py-1 text-center">Depois</p>
                                      {after ? (
                                        <div className="block aspect-square bg-muted overflow-hidden">
                                          <img src={after.file_url} alt={`gallery_after_${idx}`} className="w-full h-full object-cover" decoding="async" loading="lazy" />
                                        </div>
                                      ) : (
                                        <div className="aspect-square flex items-center justify-center text-[11px] text-muted-foreground border-t border-dashed">
                                          Sem foto
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {nonGalleryPhotos.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {nonGalleryPhotos.map((p) => (
                          <div key={p.id} className="rounded-lg border overflow-hidden">
                            <div className="block aspect-square bg-muted overflow-hidden">
                              <img src={p.file_url} alt={p.photo_type} className="w-full h-full object-cover" decoding="async" loading="lazy" />
                            </div>
                            <p className="text-xs text-muted-foreground p-2 break-words">{p.photo_type}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  ) : null;
                })()}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
