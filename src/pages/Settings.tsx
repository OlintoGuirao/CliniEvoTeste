import { useState, useEffect, useRef, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicMaster } from '@/hooks/use-clinic-master';
import { useSalonAccount } from '@/hooks/use-salon-account';
import { useUiCopy } from '@/hooks/use-ui-copy';
import type { ThemePreference } from '@/contexts/AuthContext';
import { PageLoading } from '@/components/layout/PageLoading';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Palette, Sun, Moon, Monitor, Sparkles, Upload, Plus, Trash2 } from 'lucide-react';
import {
  createEmptyLunchBreak,
  createLunchBreakDraft,
  DEFAULT_LUNCH_BREAK_LABEL,
  getLunchBreaksFromProfile,
  prepareLunchBreaksForSave,
  type LunchBreak,
} from '@/lib/lunchBreaks';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { MobileBottomSafeSpacer } from '@/components/layout/mobile';
import { toast } from 'sonner';
import {
  ACCENT_PRESETS,
  applyThemeFromProfile,
  isThemePaletteCustomHex,
  normalizeThemePaletteValue,
} from '@/lib/theme-colors';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/utils';
import type { AgendaOpenMode } from '@/lib/agendaPreferences';
import {
  fetchProfessionalUiSettings,
  replaceProfessionalClinicClosedDays,
  replaceProfessionalVacationPeriods,
  updateAgendaSlotBlockColorOnly,
  upsertProfessionalUiSettings,
  type ClinicClosedDay,
  type VacationPeriod,
} from '@/services/api/dynamicProcedureFieldSettingsApi';
import { DEFAULT_CLINIC_CLOSED_NOTE } from '@/lib/clinicClosedDays';
import { isProgramaBotoxModuleEnabled } from '@/lib/professionalModules';
import { SalonAgendaProfessionalsOrderSection } from '@/components/settings/SalonAgendaProfessionalsOrderSection';
import { SalonMemberLabelColorPicker } from '@/components/salon/SalonMemberLabelColorPicker';
import { normalizeAgendaLabelColor } from '@/lib/salonTeamRoles';

const DEFAULT_AGENDA_SLOT_BLOCK_COLOR = '#475569';

const REGISTRY_OPTIONS = [
  { value: 'COREN', label: 'COREN (Enfermagem)' },
  { value: 'CRBM', label: 'CRBM (Biomedicina)' },
  { value: 'CRM', label: 'CRM (Medicina)' },
  { value: 'CRF', label: 'CRF (Farmácia)' },
  { value: 'CRO', label: 'CRO (Odontologia)' },
  { value: 'outro', label: 'Outro' },
] as const;

type VacationPeriodDraft = {
  startDate: string;
  endDate: string;
  message: string;
};

function formatDatePtBr(ymd: string): string {
  const key = String(ymd ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return ymd;
  return format(parseLocalDate(key), 'dd/MM/yyyy', { locale: ptBR });
}

function isVacationPeriodPast(endDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = parseLocalDate(String(endDate).slice(0, 10));
  end.setHours(0, 0, 0, 0);
  return end.getTime() < today.getTime();
}

function vacationPeriodCardClass(endDate: string): string {
  return isVacationPeriodPast(endDate)
    ? 'border-red-300/70 bg-red-50/80 text-red-900'
    : 'border-green-300/70 bg-green-50/80 text-green-900';
}

function buildWorkingHoursPayloadKey(params: {
  workStartTime: string;
  workEndTime: string;
  workDays: number[];
  lunchBreaks: LunchBreak[];
}): string {
  const lunchPayload = prepareLunchBreaksForSave(params.lunchBreaks);
  return JSON.stringify({
    work_start_time: params.workStartTime?.trim() || null,
    work_end_time: params.workEndTime?.trim() || null,
    work_days: params.workDays.length ? [...params.workDays].sort() : null,
    lunch_breaks: lunchPayload.lunch_breaks,
    lunch_start_time: lunchPayload.lunch_start_time,
    lunch_end_time: lunchPayload.lunch_end_time,
  });
}

export default function Settings() {
  const { profile, updateTheme, updateThemePalette, updateAppBranding, updateWorkingHours } = useAuth();
  const { isMaster: isClinicMaster, isClinicAccount, isLoading: masterLoading } = useClinicMaster();
  const { isSalonAccount, isSalonAdmin, isLoading: salonLoading } = useSalonAccount();
  const copy = useUiCopy();
  const { setTheme, resolvedTheme } = useTheme();
  const [savingBranding, setSavingBranding] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingWorkingHours, setSavingWorkingHours] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [savingThemePalette, setSavingThemePalette] = useState(false);
  const [appName, setAppName] = useState(profile?.app_name ?? 'CliniEvo');
  const [appDescription, setAppDescription] = useState(profile?.app_description ?? 'Gestão de Tratamentos');
  const [appLogoUrl, setAppLogoUrl] = useState(profile?.app_logo_url ?? '');
  const [workStartTime, setWorkStartTime] = useState(profile?.work_start_time ?? '08:00');
  const [workEndTime, setWorkEndTime] = useState(profile?.work_end_time ?? '18:00');
  const [workDays, setWorkDays] = useState<number[]>(profile?.work_days ?? [1, 2, 3, 4, 5]);
  const [lunchBreaks, setLunchBreaks] = useState<LunchBreak[]>([createEmptyLunchBreak()]);
  const [professionalRegistryBody, setProfessionalRegistryBody] = useState(profile?.professional_registry_body ?? '');
  const [professionalRegistryBodyOutro, setProfessionalRegistryBodyOutro] = useState('');
  const [professionalRegistryNumber, setProfessionalRegistryNumber] = useState(profile?.professional_registry_number ?? '');
  const [agendaOpenMode, setAgendaOpenMode] = useState<AgendaOpenMode>('dia');
  const [savingAgendaOpenMode, setSavingAgendaOpenMode] = useState(false);
  const [useMaxWeightReference, setUseMaxWeightReference] = useState(false);
  const [savingWeightReference, setSavingWeightReference] = useState(false);
  const [programaBotoxViewMode, setProgramaBotoxViewMode] = useState<'padrao' | 'planilha'>('padrao');
  const [savingProgramaBotoxViewMode, setSavingProgramaBotoxViewMode] = useState(false);
  const [showSessionTimeline, setShowSessionTimeline] = useState(false);
  const [savingSessionTimeline, setSavingSessionTimeline] = useState(false);
  const [showOccupiedSlotEncaixe, setShowOccupiedSlotEncaixe] = useState(true);
  const [savingOccupiedSlotEncaixe, setSavingOccupiedSlotEncaixe] = useState(false);
  const [agendaSlotBlockColor, setAgendaSlotBlockColor] = useState(DEFAULT_AGENDA_SLOT_BLOCK_COLOR);
  const [savingAgendaSlotBlockColor, setSavingAgendaSlotBlockColor] = useState(false);
  const [showDashboardBirthdays, setShowDashboardBirthdays] = useState(true);
  const [showDashboardFutureClients, setShowDashboardFutureClients] = useState(true);
  const [showDashboardBotoxReminders, setShowDashboardBotoxReminders] = useState(true);
  const [savingDashboardWidgets, setSavingDashboardWidgets] = useState(false);
  const [vacationDialogOpen, setVacationDialogOpen] = useState(false);
  const [vacationPeriods, setVacationPeriods] = useState<VacationPeriod[]>([]);
  const [vacationDraft, setVacationDraft] = useState<VacationPeriodDraft>({
    startDate: '',
    endDate: '',
    message: 'Férias',
  });
  const [savingVacation, setSavingVacation] = useState(false);
  const [clinicClosedDialogOpen, setClinicClosedDialogOpen] = useState(false);
  const [lunchBreakDialogOpen, setLunchBreakDialogOpen] = useState(false);
  const [lunchBreakDraft, setLunchBreakDraft] = useState<LunchBreak>(() => createLunchBreakDraft());
  const [clinicClosedDays, setClinicClosedDays] = useState<ClinicClosedDay[]>([]);
  const [clinicClosedDraftDate, setClinicClosedDraftDate] = useState('');
  const [clinicClosedDraftNote, setClinicClosedDraftNote] = useState(DEFAULT_CLINIC_CLOSED_NOTE);
  const [savingClinicClosed, setSavingClinicClosed] = useState(false);
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);
  const isDark = resolvedTheme === 'dark';
  const isProgramaBotoxEnabled = isProgramaBotoxModuleEnabled(profile);
  const workingHoursAutoSaveReadyRef = useRef(false);
  const lastSavedWorkingHoursKeyRef = useRef('');

  useEffect(() => {
    setAppName(profile?.app_name ?? 'CliniEvo');
    setAppDescription(profile?.app_description ?? 'Gestão de Tratamentos');
    setAppLogoUrl(profile?.app_logo_url ?? '');
    setWorkStartTime(profile?.work_start_time ?? '08:00');
    setWorkEndTime(profile?.work_end_time ?? '18:00');
    setWorkDays(profile?.work_days ?? [1, 2, 3, 4, 5]);
    const breaks = getLunchBreaksFromProfile(profile);
    setLunchBreaks(breaks.length > 0 ? breaks : [createEmptyLunchBreak()]);
    const body = profile?.professional_registry_body ?? '';
    const isPreset = ['COREN', 'CRBM', 'CRM', 'CRF', 'CRO'].includes(body);
    setProfessionalRegistryBody(isPreset ? body : (body ? 'outro' : ''));
    setProfessionalRegistryBodyOutro(isPreset ? '' : body);
    setProfessionalRegistryNumber(profile?.professional_registry_number ?? '');

    workingHoursAutoSaveReadyRef.current = false;
    const timer = window.setTimeout(() => {
      lastSavedWorkingHoursKeyRef.current = buildWorkingHoursPayloadKey({
        workStartTime: profile?.work_start_time ?? '08:00',
        workEndTime: profile?.work_end_time ?? '18:00',
        workDays: profile?.work_days ?? [1, 2, 3, 4, 5],
        lunchBreaks: breaks.length > 0 ? breaks : [createEmptyLunchBreak()],
      });
      workingHoursAutoSaveReadyRef.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [profile?.app_name, profile?.app_description, profile?.app_logo_url, profile?.professional_registry_body, profile?.professional_registry_number, profile?.work_start_time, profile?.work_end_time, profile?.work_days, profile?.lunch_breaks, profile?.lunch_start_time, profile?.lunch_end_time]);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const ui = await fetchProfessionalUiSettings({ professionalId: profile.id });
        if (!cancelled) {
          setAgendaOpenMode(ui.agenda_open_mode);
          setUseMaxWeightReference(ui.use_max_weight_reference);
          setProgramaBotoxViewMode(ui.programa_botox_view_mode);
          setShowSessionTimeline(ui.show_session_timeline);
          setShowOccupiedSlotEncaixe(ui.show_occupied_slot_encaixe);
          setAgendaSlotBlockColor(
            normalizeAgendaLabelColor(ui.agenda_slot_block_color) ?? DEFAULT_AGENDA_SLOT_BLOCK_COLOR
          );
          setShowDashboardBirthdays(ui.show_dashboard_birthdays);
          setShowDashboardFutureClients(ui.show_dashboard_future_clients);
          setShowDashboardBotoxReminders(ui.show_dashboard_botox_reminders);
          setVacationPeriods(ui.vacation_periods ?? []);
          setClinicClosedDays(ui.clinic_closed_days ?? []);
        }
      } catch {
        if (!cancelled) setAgendaOpenMode('dia');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const currentTheme = (profile?.theme ?? 'system') as ThemePreference;
  const handleThemeChange = async (value: string) => {
    const theme = value as ThemePreference;
    setTheme(theme);
    setSavingTheme(true);
    const { error } = await updateTheme(theme);
    setSavingTheme(false);
    if (error) toast.error('Não foi possível salvar a preferência de tema.');
    else toast.success('Tema atualizado.');
  };

  const currentThemePalette = profile?.theme_palette ?? null;
  const isCustomThemePalette = isThemePaletteCustomHex(currentThemePalette);
  const customThemePaletteHex = isCustomThemePalette ? (currentThemePalette ?? '#2d8a7a') : '#2d8a7a';

  const handleThemePaletteChange = async (value: string | null) => {
    const toSave = normalizeThemePaletteValue(value ?? 'default');
    if (!toSave) return;
    applyThemeFromProfile(toSave ?? undefined, null, isDark);
    setSavingThemePalette(true);
    const { error } = await updateThemePalette(toSave);
    setSavingThemePalette(false);
    if (error) toast.error('Não foi possível salvar o tema de cor.');
  };

  const handleCustomThemePaletteColor = async (hex: string) => {
    const toSave = normalizeThemePaletteValue(hex) ?? hex.toLowerCase();
    applyThemeFromProfile(toSave, null, isDark);
    setSavingThemePalette(true);
    const { error } = await updateThemePalette(toSave);
    setSavingThemePalette(false);
    if (error) toast.error('Não foi possível salvar o tema de cor.');
  };

  const handleSaveBranding = async () => {
    setSavingBranding(true);
    const registryBody =
      professionalRegistryBody === 'outro'
        ? professionalRegistryBodyOutro.trim() || null
        : professionalRegistryBody || null;
    const { error } = await updateAppBranding({
      app_name: appName.trim() || null,
      app_description: appDescription.trim() || null,
      app_logo_url: appLogoUrl.trim() || null,
      professional_registry_body: registryBody,
      professional_registry_number: professionalRegistryNumber.trim() || null,
    });
    setSavingBranding(false);
    if (error) toast.error('Não foi possível atualizar a identidade.');
    else toast.success('Identidade atualizada.');
  };

  const handleLogoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem precisa ter no máximo 5MB.');
      return;
    }
    if (!/^(jpe?g|png|gif|webp)$/.test(ext)) {
      toast.error('Use uma imagem (JPEG, PNG, GIF ou WebP).');
      return;
    }
    setUploadingLogo(true);
    const path = `${profile.id}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage.from('app-logos').upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });
    if (uploadError) {
      setUploadingLogo(false);
      toast.error('Não foi possível enviar a imagem.');
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('app-logos').getPublicUrl(path);
    setAppLogoUrl(publicUrl);
    setUploadingLogo(false);
    toast.success('Imagem selecionada. Clique em "Salvar identidade" para aplicar.');
    e.target.value = '';
  };

  const openLunchBreakDialog = () => {
    setLunchBreakDraft(createLunchBreakDraft());
    setLunchBreakDialogOpen(true);
  };

  const handleAddLunchBreak = () => {
    const start = lunchBreakDraft.start?.trim();
    const end = lunchBreakDraft.end?.trim();
    const description = lunchBreakDraft.description?.trim() || DEFAULT_LUNCH_BREAK_LABEL;
    if (!start || !end) {
      toast.error('Informe o início e o fim do intervalo.');
      return;
    }
    const parsed = prepareLunchBreaksForSave([{ start, end, description }]).lunch_breaks?.[0];
    if (!parsed) {
      toast.error('O horário de fim precisa ser depois do início.');
      return;
    }
    setLunchBreaks((prev) => {
      const hasOnlyEmptyRow =
        prev.length === 1 && !prev[0].start?.trim() && !prev[0].end?.trim();
      if (hasOnlyEmptyRow) return [{ ...parsed, description }];
      return [...prev, { ...parsed, description }];
    });
    setLunchBreakDialogOpen(false);
  };

  const saveWorkingHours = useCallback(async (options?: { silent?: boolean }) => {
    setSavingWorkingHours(true);
    const lunchPayload = prepareLunchBreaksForSave(lunchBreaks);
    const payload = {
      work_start_time: workStartTime?.trim() || null,
      work_end_time: workEndTime?.trim() || null,
      work_days: workDays.length ? workDays : null,
      ...lunchPayload,
    };
    const { error } = await updateWorkingHours(payload);
    setSavingWorkingHours(false);
    if (error) {
      toast.error('Não foi possível atualizar o horário.');
      return false;
    }
    lastSavedWorkingHoursKeyRef.current = buildWorkingHoursPayloadKey({
      workStartTime,
      workEndTime,
      workDays,
      lunchBreaks,
    });
    if (!options?.silent) toast.success('Horário atualizado.');
    return true;
  }, [lunchBreaks, updateWorkingHours, workDays, workEndTime, workStartTime]);

  useEffect(() => {
    if (!profile?.id || !workingHoursAutoSaveReadyRef.current) return;

    const nextKey = buildWorkingHoursPayloadKey({
      workStartTime,
      workEndTime,
      workDays,
      lunchBreaks,
    });
    if (nextKey === lastSavedWorkingHoursKeyRef.current) return;

    const timer = window.setTimeout(() => {
      void saveWorkingHours({ silent: true });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [workStartTime, workEndTime, workDays, lunchBreaks, profile?.id, saveWorkingHours]);

  const handleAgendaOpenModeChange = async (value: string) => {
    if (!profile?.id) return;
    const mode = value as AgendaOpenMode;
    setSavingAgendaOpenMode(true);
    try {
      const ui = await fetchProfessionalUiSettings({ professionalId: profile.id });
      await upsertProfessionalUiSettings({
        professionalId: profile.id,
        showSessionPhotos: ui.show_session_photos,
        showWhatsappUltraMsg: ui.show_whatsapp_ultramsg,
        agendaOpenMode: mode,
        useMaxWeightReference: ui.use_max_weight_reference,
        programaBotoxViewMode: ui.programa_botox_view_mode,
        showSessionTimeline: ui.show_session_timeline,
        showOccupiedSlotEncaixe: ui.show_occupied_slot_encaixe,
        vacationStartDate: ui.vacation_start_date,
        vacationEndDate: ui.vacation_end_date,
        vacationMessage: ui.vacation_message,
      });
      setAgendaOpenMode(mode);
      toast.success('Preferência de agenda salva.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSavingAgendaOpenMode(false);
    }
  };

  const handleUseMaxWeightReferenceChange = async (checked: boolean) => {
    if (!profile?.id) return;
    setSavingWeightReference(true);
    try {
      const ui = await fetchProfessionalUiSettings({ professionalId: profile.id });
      await upsertProfessionalUiSettings({
        professionalId: profile.id,
        showSessionPhotos: ui.show_session_photos,
        showWhatsappUltraMsg: ui.show_whatsapp_ultramsg,
        agendaOpenMode: ui.agenda_open_mode,
        useMaxWeightReference: checked,
        programaBotoxViewMode: ui.programa_botox_view_mode,
        showSessionTimeline: ui.show_session_timeline,
        showOccupiedSlotEncaixe: ui.show_occupied_slot_encaixe,
        vacationStartDate: ui.vacation_start_date,
        vacationEndDate: ui.vacation_end_date,
        vacationMessage: ui.vacation_message,
      });
      setUseMaxWeightReference(checked);
      toast.success('Parâmetro de peso salvo.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSavingWeightReference(false);
    }
  };

  const handleProgramaBotoxViewModeChange = async (mode: 'padrao' | 'planilha') => {
    if (!profile?.id) return;
    setSavingProgramaBotoxViewMode(true);
    try {
      const ui = await fetchProfessionalUiSettings({ professionalId: profile.id });
      await upsertProfessionalUiSettings({
        professionalId: profile.id,
        showSessionPhotos: ui.show_session_photos,
        showWhatsappUltraMsg: ui.show_whatsapp_ultramsg,
        agendaOpenMode: ui.agenda_open_mode,
        useMaxWeightReference: ui.use_max_weight_reference,
        programaBotoxViewMode: mode,
        showSessionTimeline: ui.show_session_timeline,
        showOccupiedSlotEncaixe: ui.show_occupied_slot_encaixe,
        vacationStartDate: ui.vacation_start_date,
        vacationEndDate: ui.vacation_end_date,
        vacationMessage: ui.vacation_message,
      });
      setProgramaBotoxViewMode(mode);
      toast.success('Modo do Programa de Botox salvo.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSavingProgramaBotoxViewMode(false);
    }
  };

  const handleShowSessionTimelineChange = async (checked: boolean) => {
    if (!profile?.id) return;
    setSavingSessionTimeline(true);
    try {
      const ui = await fetchProfessionalUiSettings({ professionalId: profile.id });
      await upsertProfessionalUiSettings({
        professionalId: profile.id,
        showSessionPhotos: ui.show_session_photos,
        showWhatsappUltraMsg: ui.show_whatsapp_ultramsg,
        agendaOpenMode: ui.agenda_open_mode,
        useMaxWeightReference: ui.use_max_weight_reference,
        programaBotoxViewMode: ui.programa_botox_view_mode,
        showSessionTimeline: checked,
        showOccupiedSlotEncaixe: ui.show_occupied_slot_encaixe,
        vacationStartDate: ui.vacation_start_date,
        vacationEndDate: ui.vacation_end_date,
        vacationMessage: ui.vacation_message,
      });
      setShowSessionTimeline(checked);
      toast.success('Parâmetro de timeline salvo.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSavingSessionTimeline(false);
    }
  };

  const handleDashboardWidgetChange = async (
    field: 'birthdays' | 'futureClients' | 'botoxReminders',
    checked: boolean
  ) => {
    if (!profile?.id) return;
    setSavingDashboardWidgets(true);
    try {
      const ui = await fetchProfessionalUiSettings({ professionalId: profile.id });
      const next = {
        birthdays: field === 'birthdays' ? checked : showDashboardBirthdays,
        futureClients: field === 'futureClients' ? checked : showDashboardFutureClients,
        botoxReminders: field === 'botoxReminders' ? checked : showDashboardBotoxReminders,
      };
      await upsertProfessionalUiSettings({
        professionalId: profile.id,
        showSessionPhotos: ui.show_session_photos,
        showWhatsappUltraMsg: ui.show_whatsapp_ultramsg,
        agendaOpenMode: ui.agenda_open_mode,
        useMaxWeightReference: ui.use_max_weight_reference,
        programaBotoxViewMode: ui.programa_botox_view_mode,
        showSessionTimeline: ui.show_session_timeline,
        showOccupiedSlotEncaixe: ui.show_occupied_slot_encaixe,
        showDashboardBirthdays: next.birthdays,
        showDashboardFutureClients: next.futureClients,
        showDashboardBotoxReminders: next.botoxReminders,
        vacationStartDate: ui.vacation_start_date,
        vacationEndDate: ui.vacation_end_date,
        vacationMessage: ui.vacation_message,
      });
      setShowDashboardBirthdays(next.birthdays);
      setShowDashboardFutureClients(next.futureClients);
      setShowDashboardBotoxReminders(next.botoxReminders);
      toast.success('Parâmetros do dashboard salvos.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSavingDashboardWidgets(false);
    }
  };

  const handleShowOccupiedSlotEncaixeChange = async (checked: boolean) => {
    if (!profile?.id) return;
    setSavingOccupiedSlotEncaixe(true);
    try {
      const ui = await fetchProfessionalUiSettings({ professionalId: profile.id });
      await upsertProfessionalUiSettings({
        professionalId: profile.id,
        showSessionPhotos: ui.show_session_photos,
        showWhatsappUltraMsg: ui.show_whatsapp_ultramsg,
        agendaOpenMode: ui.agenda_open_mode,
        useMaxWeightReference: ui.use_max_weight_reference,
        programaBotoxViewMode: ui.programa_botox_view_mode,
        showSessionTimeline: ui.show_session_timeline,
        showOccupiedSlotEncaixe: checked,
        vacationStartDate: ui.vacation_start_date,
        vacationEndDate: ui.vacation_end_date,
        vacationMessage: ui.vacation_message,
      });
      setShowOccupiedSlotEncaixe(checked);
      toast.success('Parâmetro de encaixe salvo.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSavingOccupiedSlotEncaixe(false);
    }
  };

  const handleAgendaSlotBlockColorChange = async (hex: string) => {
    if (!profile?.id) return;
    const next = normalizeAgendaLabelColor(hex) ?? DEFAULT_AGENDA_SLOT_BLOCK_COLOR;
    setAgendaSlotBlockColor(next);
    setSavingAgendaSlotBlockColor(true);
    try {
      await updateAgendaSlotBlockColorOnly({
        professionalId: profile.id,
        color: next,
      });
      toast.success('Cor do bloqueio na agenda salva.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar a cor.');
    } finally {
      setSavingAgendaSlotBlockColor(false);
    }
  };

  const persistVacationPeriods = async (nextPeriods: VacationPeriod[]) => {
    if (!profile?.id) return;
    setSavingVacation(true);
    try {
      const ui = await fetchProfessionalUiSettings({ professionalId: profile.id });
      await replaceProfessionalVacationPeriods({
        professionalId: profile.id,
        periods: nextPeriods.map((p) => ({
          startDate: p.start_date,
          endDate: p.end_date,
          message: p.message,
        })),
      });
      const first = nextPeriods[0];
      await upsertProfessionalUiSettings({
        professionalId: profile.id,
        showSessionPhotos: ui.show_session_photos,
        showWhatsappUltraMsg: ui.show_whatsapp_ultramsg,
        agendaOpenMode: ui.agenda_open_mode,
        useMaxWeightReference: ui.use_max_weight_reference,
        programaBotoxViewMode: ui.programa_botox_view_mode,
        showSessionTimeline: ui.show_session_timeline,
        showOccupiedSlotEncaixe: ui.show_occupied_slot_encaixe,
        vacationStartDate: first?.start_date ?? null,
        vacationEndDate: first?.end_date ?? null,
        vacationMessage: first?.message ?? null,
      });
      setVacationPeriods(nextPeriods);
    } catch (e) {
      throw e;
    } finally {
      setSavingVacation(false);
    }
  };

  const handleAddVacationPeriod = async () => {
    if (!profile?.id) return;
    if (!vacationDraft.startDate || !vacationDraft.endDate) {
      toast.error('Informe as datas de início e fim das férias.');
      return;
    }
    if (vacationDraft.startDate > vacationDraft.endDate) {
      toast.error('A data final precisa ser maior ou igual à data inicial.');
      return;
    }
    const overlap = vacationPeriods.some(
      (p) => !(vacationDraft.endDate < p.start_date || vacationDraft.startDate > p.end_date)
    );
    if (overlap) {
      toast.error('Esse período sobrepõe um período já cadastrado.');
      return;
    }
    const nextPeriods = [...vacationPeriods, {
      id: `tmp-${Date.now()}`,
      start_date: vacationDraft.startDate,
      end_date: vacationDraft.endDate,
      message: vacationDraft.message.trim() || 'Férias',
    }].sort((a, b) => a.start_date.localeCompare(b.start_date) || a.end_date.localeCompare(b.end_date));
    try {
      await persistVacationPeriods(nextPeriods);
      setVacationDraft({ startDate: '', endDate: '', message: 'Férias' });
      toast.success('Período de férias adicionado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível adicionar o período.');
    }
  };

  const handleRemoveVacationPeriod = async (periodId: string) => {
    const nextPeriods = vacationPeriods.filter((p) => p.id !== periodId);
    try {
      await persistVacationPeriods(nextPeriods);
      toast.success('Período de férias removido.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível remover o período.');
    }
  };

  const persistClinicClosedDays = async (nextDays: ClinicClosedDay[]) => {
    if (!profile?.id) return;
    setSavingClinicClosed(true);
    try {
      await replaceProfessionalClinicClosedDays({
        professionalId: profile.id,
        days: nextDays.map((day) => ({
          closedDate: day.closed_date,
          note: day.note,
        })),
      });
      setClinicClosedDays(nextDays);
    } catch (e) {
      throw e;
    } finally {
      setSavingClinicClosed(false);
    }
  };

  const handleAddClinicClosedDay = async () => {
    if (!profile?.id) return;
    if (!clinicClosedDraftDate) {
      toast.error(
        copy.isSalon
          ? 'Selecione o dia em que o salão ficará fechado.'
          : 'Selecione o dia em que a clínica ficará fechada.'
      );
      return;
    }
    if (clinicClosedDays.some((day) => day.closed_date === clinicClosedDraftDate)) {
      toast.error(
        copy.isSalon
          ? 'Esse dia já está cadastrado como salão fechado.'
          : 'Esse dia já está cadastrado como clínica fechada.'
      );
      return;
    }
    const nextDays = [...clinicClosedDays, {
      id: `tmp-${Date.now()}`,
      closed_date: clinicClosedDraftDate,
      note: clinicClosedDraftNote.trim() || DEFAULT_CLINIC_CLOSED_NOTE,
    }].sort((a, b) => a.closed_date.localeCompare(b.closed_date));
    try {
      await persistClinicClosedDays(nextDays);
      setClinicClosedDraftDate('');
      setClinicClosedDraftNote(DEFAULT_CLINIC_CLOSED_NOTE);
      toast.success(
        copy.isSalon ? 'Dia de salão fechado adicionado.' : 'Dia de clínica fechada adicionado.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível adicionar o dia.');
    }
  };

  const handleRemoveClinicClosedDay = async (dayId: string) => {
    const nextDays = clinicClosedDays.filter((day) => day.id !== dayId);
    try {
      await persistClinicClosedDays(nextDays);
      toast.success(
        copy.isSalon
          ? 'Dia removido da lista de salão fechado.'
          : 'Dia removido da lista de clínica fechada.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível remover o dia.');
    }
  };

  // Funcionários da filial não acessam (só Master / profissional único)
  if (masterLoading || (isSalonAccount && salonLoading)) {
    return <PageLoading />;
  }
  if (isClinicAccount && !isClinicMaster) {
    return <Navigate to="/dashboard" replace />;
  }
  if (isSalonAccount && !isSalonAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-5 animate-fade-in">
      <PageBreadcrumb
        segments={[
          { label: 'Início', path: '/dashboard' },
          { label: 'Configurações do sistema' },
        ]}
        className="mb-1 hidden md:block"
      />
      <div className="pb-3 md:pb-4 border-b border-border">
        <h1 className="text-base md:text-2xl font-bold text-foreground tracking-tight">
          Configurações do sistema
        </h1>
        <p className="text-muted-foreground mt-0.5 text-xs md:text-sm">
          Identidade, aparência e horários
        </p>
      </div>

      {/* Identidade */}
      <Card>
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="text-base md:text-xl font-semibold leading-none tracking-tight flex items-center gap-2">
            <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
            Identidade
          </CardTitle>
          <CardDescription className="text-xs">Logo, nome e descrição na sidebar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4 p-3 md:p-6">
          <div className="flex flex-col gap-3 md:gap-4 rounded-lg md:rounded-xl border bg-muted/30 p-3 md:p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-background text-primary-foreground shrink-0 overflow-hidden border">
                {appLogoUrl.trim() ? (
                  <img src={appLogoUrl} alt="" className="w-full h-full object-contain" />
                ) : (
                  <Sparkles className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-foreground break-words line-clamp-2">{appName || 'CliniEvo'}</span>
                <span className="text-xs text-muted-foreground break-words line-clamp-2">{appDescription || 'Gestão de Tratamentos'}</span>
              </div>
            </div>
            <Button
              className="w-full lg:w-auto shrink-0"
              onClick={handleSaveBranding}
              disabled={savingBranding || (appName === (profile?.app_name ?? 'CliniEvo') && appDescription === (profile?.app_description ?? 'Gestão de Tratamentos') && appLogoUrl === (profile?.app_logo_url ?? '') && ((professionalRegistryBody === 'outro' ? professionalRegistryBodyOutro.trim() : professionalRegistryBody) || null) === (profile?.professional_registry_body ?? null) && (professionalRegistryNumber.trim() || null) === (profile?.professional_registry_number ?? null))}
            >
              {savingBranding ? 'Salvando...' : 'Salvar identidade'}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3 rounded-xl border p-4">
              <div>
                <p className="text-sm font-semibold">Logo</p>
                <p className="text-xs text-muted-foreground">Envie uma imagem ou cole a URL.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="sr-only w-0 h-0"
                  id="app-logo-file"
                  onChange={handleLogoFileSelect}
                  disabled={uploadingLogo}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-xl"
                  onClick={() => document.getElementById('app-logo-file')?.click()}
                  disabled={uploadingLogo}
                >
                  <Upload className="w-4 h-4" />
                  {uploadingLogo ? 'Enviando...' : 'Escolher do computador'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Deixe em branco para usar o ícone padrão.</p>
            </div>

            <div className="space-y-3 rounded-xl border p-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="app-name">Nome</Label>
                  <Input
                    id="app-name"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="CliniEvo"
                    disabled={savingBranding}
                    className="rounded-xl h-11 sm:h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="app-description">Descrição</Label>
                  <Input
                    id="app-description"
                    value={appDescription}
                    onChange={(e) => setAppDescription(e.target.value)}
                    placeholder="Gestão de Tratamentos"
                    disabled={savingBranding}
                    className="rounded-xl h-11 sm:h-10"
                  />
                </div>
                {!isSalonAccount ? (
                <div className="space-y-2">
                  <Label htmlFor="registry-body">Órgão / Conselho profissional</Label>
                  <Select
                    value={professionalRegistryBody || 'none'}
                    onValueChange={(v) => {
                      setProfessionalRegistryBody(v === 'none' ? '' : v);
                      if (v !== 'outro') setProfessionalRegistryBodyOutro('');
                    }}
                    disabled={savingBranding}
                  >
                    <SelectTrigger id="registry-body" className="rounded-xl h-11 sm:h-10">
                      <SelectValue placeholder="Selecione (ex.: COREN)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {REGISTRY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {professionalRegistryBody === 'outro' && (
                    <Input
                      value={professionalRegistryBodyOutro}
                      onChange={(e) => setProfessionalRegistryBodyOutro(e.target.value)}
                      placeholder="Ex.: CRTA, outro conselho"
                      disabled={savingBranding}
                      className="mt-2 rounded-xl h-11 sm:h-10"
                    />
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="registry-number">Número de inscrição</Label>
                    <Input
                      id="registry-number"
                      value={professionalRegistryNumber}
                      onChange={(e) => setProfessionalRegistryNumber(e.target.value)}
                      placeholder="Ex.: 123456-SP"
                      disabled={savingBranding}
                      className="rounded-xl h-11 sm:h-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Usado em termos de consentimento (ex.: __COREN__).</p>
                </div>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aparência */}
      <Card>
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Palette className="w-4 h-4 md:w-5 md:h-5" />
            Aparência
          </CardTitle>
          <CardDescription className="text-xs">Tema do sistema. Preferência salva no perfil.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4 p-3 md:p-6 pt-0">
          <RadioGroup
            value={currentTheme}
            onValueChange={handleThemeChange}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3"
            disabled={savingTheme}
          >
            <Label htmlFor="theme-light" className="flex items-center gap-2 md:gap-3 rounded-lg border p-3 md:p-4 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors">
              <RadioGroupItem value="light" id="theme-light" className="sr-only peer" />
              <Sun className="w-5 h-5 text-amber-500" />
              <div>
                <p className="font-medium">Claro</p>
                <p className="text-sm text-muted-foreground">Tema claro</p>
              </div>
            </Label>
            <Label htmlFor="theme-dark" className="flex items-center gap-2 md:gap-3 rounded-lg border p-3 md:p-4 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors">
              <RadioGroupItem value="dark" id="theme-dark" className="sr-only peer" />
              <Moon className="w-5 h-5 text-slate-500" />
              <div>
                <p className="font-medium">Escuro</p>
                <p className="text-sm text-muted-foreground">Tema escuro</p>
              </div>
            </Label>
            <Label htmlFor="theme-system" className="flex items-center gap-2 md:gap-3 rounded-lg border p-3 md:p-4 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors">
              <RadioGroupItem value="system" id="theme-system" className="sr-only peer" />
              <Monitor className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Sistema</p>
                <p className="text-sm text-muted-foreground">Seguir o dispositivo</p>
              </div>
            </Label>
            <Popover open={colorPopoverOpen} onOpenChange={setColorPopoverOpen}>
              <PopoverTrigger asChild>
                <button type="button" className="flex items-center gap-2 md:gap-3 rounded-lg border p-3 md:p-4 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors text-left w-full border-dashed">
                  <div className="h-5 w-5 rounded-full shrink-0 border-2 border-dashed border-muted-foreground/50 flex items-center justify-center bg-muted/30">
                    <Palette className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Escolher cor</p>
                    <p className="text-sm text-muted-foreground">Sua cor em todo o sistema</p>
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-2rem)] max-w-80 p-4" align="start">
                <p className="font-medium mb-1">Sua cor em todo o sistema</p>
                <p className="text-xs text-muted-foreground mb-3">Altera toda a interface (fundo, cards, botões) para essa cor.</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {ACCENT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleThemePaletteChange(preset.id === 'default' ? null : preset.id)}
                      disabled={savingThemePalette}
                      className="h-8 w-8 rounded-full border-2 border-border hover:scale-110 transition-transform shrink-0"
                      style={{ backgroundColor: preset.hex }}
                      title={preset.name}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-muted-foreground">Personalizada:</span>
                  <input
                    type="color"
                    value={customThemePaletteHex}
                    onChange={(e) => handleCustomThemePaletteColor(e.target.value)}
                    className="h-9 w-14 cursor-pointer rounded border border-input bg-transparent"
                  />
                </div>
                <Separator className="my-3" />
                <p className="text-xs text-muted-foreground mb-2">Ver tema com a cor selecionada:</p>
                <div className="flex gap-2">
                  <Button type="button" variant={currentTheme === 'light' ? 'default' : 'outline'} size="sm" className="flex-1 gap-1.5" onClick={() => handleThemeChange('light')} disabled={savingTheme}>
                    <Sun className="w-4 h-4" />
                    Claro
                  </Button>
                  <Button type="button" variant={currentTheme === 'dark' ? 'default' : 'outline'} size="sm" className="flex-1 gap-1.5" onClick={() => handleThemeChange('dark')} disabled={savingTheme}>
                    <Moon className="w-4 h-4" />
                    Escuro
                  </Button>
                </div>
                <Separator className="my-3" />
                <Button type="button" variant="secondary" size="sm" className="w-full" onClick={() => { setColorPopoverOpen(false); toast.success('Tema de cor atualizado.'); }}>
                  Fechar
                </Button>
              </PopoverContent>
            </Popover>
          </RadioGroup>
          {savingTheme && <p className="text-sm text-muted-foreground">Salvando preferência...</p>}
        </CardContent>
      </Card>

      {/* Horário de funcionamento */}
      <Card>
        <CardHeader className="p-3 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base md:text-lg">Horário de funcionamento</CardTitle>
              <CardDescription className="text-xs">Agenda só mostra horários nesse intervalo. As alterações são salvas automaticamente.</CardDescription>
            </div>
            {savingWorkingHours && (
              <span className="text-xs text-muted-foreground shrink-0 pt-1">Salvando…</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4 p-3 md:p-6 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="work-start">Início</Label>
              <Input id="work-start" type="time" value={workStartTime} onChange={(e) => setWorkStartTime(e.target.value)} className="rounded-xl h-11 sm:h-10" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="work-end">Fim</Label>
              <Input id="work-end" type="time" value={workEndTime} onChange={(e) => setWorkEndTime(e.target.value)} className="rounded-xl h-11 sm:h-10" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Dias de trabalho</Label>
            <div className="grid grid-cols-4 lg:grid-cols-7 gap-2">
              {[
                { label: 'Dom', value: 0 },
                { label: 'Seg', value: 1 },
                { label: 'Ter', value: 2 },
                { label: 'Qua', value: 3 },
                { label: 'Qui', value: 4 },
                { label: 'Sex', value: 5 },
                { label: 'Sáb', value: 6 },
              ].map((d) => {
                const active = workDays.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setWorkDays((prev) => (active ? prev.filter((v) => v !== d.value) : Array.from(new Set([...prev, d.value])).sort()))}
                    className={`h-9 rounded-md border text-xs font-medium transition-colors ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted/30'}`}
                    aria-pressed={active}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Férias */}
      <Card>
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="text-base md:text-lg">Férias</CardTitle>
          <CardDescription className="text-xs">
            Durante os períodos cadastrados, a agenda fica bloqueada para novos agendamentos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4 p-3 md:p-6 pt-0">
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setVacationDialogOpen(true)} className="rounded-xl">
              Gerenciar férias
            </Button>
          </div>
          {vacationPeriods.length === 0 ? (
            <p className="text-xs text-muted-foreground rounded-xl border border-dashed px-3 py-3 text-center">
              Nenhum período de férias cadastrado.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {vacationPeriods.length === 1
                  ? '1 período configurado'
                  : `${vacationPeriods.length} períodos configurados`}
              </p>
              <div className="max-h-40 space-y-1.5 overflow-auto pr-1">
                {vacationPeriods.map((period) => (
                  <div
                    key={period.id}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${vacationPeriodCardClass(period.end_date)}`}
                  >
                    <span className="min-w-0">
                      {formatDatePtBr(period.start_date)} até {formatDatePtBr(period.end_date)}
                      {period.message?.trim() ? ` — ${period.message.trim()}` : ' — Férias'}
                    </span>
                    {!isVacationPeriodPast(period.end_date) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive shrink-0"
                        onClick={() => void handleRemoveVacationPeriod(period.id)}
                        disabled={savingVacation}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Intervalos de almoço */}
      <Card>
        <CardHeader className="p-3 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base md:text-lg">Intervalos de almoço</CardTitle>
              <CardDescription className="text-xs">
                Horários bloqueados na agenda para pausa. Você pode cadastrar mais de um intervalo. As alterações são salvas automaticamente.
              </CardDescription>
            </div>
            {savingWorkingHours && (
              <span className="text-xs text-muted-foreground shrink-0 pt-1">Salvando…</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4 p-3 md:p-6 pt-0">
          <div className="space-y-3">
            {lunchBreaks.map((item, index) => (
              <div key={`lunch-break-${index}`} className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground min-w-0 truncate">
                    {item.description?.trim() || DEFAULT_LUNCH_BREAK_LABEL}
                    <span className="text-muted-foreground/70 font-normal"> · Intervalo {index + 1}</span>
                  </p>
                  {lunchBreaks.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setLunchBreaks((prev) => prev.filter((_, i) => i !== index))}
                      aria-label={`Remover intervalo ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`lunch-description-${index}`}>Descrição na agenda</Label>
                  <Input
                    id={`lunch-description-${index}`}
                    value={item.description ?? ''}
                    placeholder={DEFAULT_LUNCH_BREAK_LABEL}
                    onChange={(e) =>
                      setLunchBreaks((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, description: e.target.value } : row
                        )
                      )
                    }
                    className="rounded-xl h-11 sm:h-10"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor={`lunch-start-${index}`}>Início</Label>
                    <Input
                      id={`lunch-start-${index}`}
                      type="time"
                      value={item.start}
                      onChange={(e) =>
                        setLunchBreaks((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, start: e.target.value } : row))
                        )
                      }
                      className="rounded-xl h-11 sm:h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`lunch-end-${index}`}>Fim</Label>
                    <Input
                      id={`lunch-end-${index}`}
                      type="time"
                      value={item.end}
                      onChange={(e) =>
                        setLunchBreaks((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, end: e.target.value } : row))
                        )
                      }
                      className="rounded-xl h-11 sm:h-10"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={openLunchBreakDialog}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar intervalo
          </Button>
        </CardContent>
      </Card>

      <Dialog open={lunchBreakDialogOpen} onOpenChange={setLunchBreakDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo intervalo</DialogTitle>
            <DialogDescription>
              Defina o horário e a descrição que aparecerá na agenda nesse período.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-2">
              <Label htmlFor="lunch-break-description">Descrição</Label>
              <Input
                id="lunch-break-description"
                value={lunchBreakDraft.description ?? ''}
                placeholder={DEFAULT_LUNCH_BREAK_LABEL}
                onChange={(e) =>
                  setLunchBreakDraft((prev) => ({ ...prev, description: e.target.value }))
                }
                className="rounded-xl h-11 sm:h-10"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="lunch-break-start">Início</Label>
                <Input
                  id="lunch-break-start"
                  type="time"
                  value={lunchBreakDraft.start}
                  onChange={(e) =>
                    setLunchBreakDraft((prev) => ({ ...prev, start: e.target.value }))
                  }
                  className="rounded-xl h-11 sm:h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lunch-break-end">Fim</Label>
                <Input
                  id="lunch-break-end"
                  type="time"
                  value={lunchBreakDraft.end}
                  onChange={(e) =>
                    setLunchBreakDraft((prev) => ({ ...prev, end: e.target.value }))
                  }
                  className="rounded-xl h-11 sm:h-10"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLunchBreakDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleAddLunchBreak}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fechar clínica / salão */}
      <Card>
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="text-base md:text-lg">
            {copy.isSalon ? 'Fechar salão' : 'Fechar clínica'}
          </CardTitle>
          <CardDescription className="text-xs">
            {copy.isSalon
              ? 'Em dias selecionados, o salão não aceita novos clientes. A agenda fica disponível apenas para uso pessoal.'
              : 'Em dias selecionados, a clínica não aceita novos pacientes. A agenda fica disponível apenas para uso pessoal.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4 p-3 md:p-6 pt-0">
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setClinicClosedDialogOpen(true)} className="rounded-xl">
              Gerenciar dias fechados
            </Button>
          </div>
          {clinicClosedDays.length === 0 ? (
            <p className="text-xs text-muted-foreground rounded-xl border border-dashed px-3 py-3 text-center">
              {copy.isSalon ? 'Nenhum dia com salão fechado.' : 'Nenhum dia com clínica fechada.'}
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {clinicClosedDays.length === 1
                  ? '1 dia configurado'
                  : `${clinicClosedDays.length} dias configurados`}
              </p>
              <div className="max-h-40 space-y-1.5 overflow-auto pr-1">
                {clinicClosedDays.map((day) => (
                  <div
                    key={day.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-300/70 bg-slate-50/80 px-3 py-2 text-xs text-slate-900"
                  >
                    <span className="min-w-0">
                      {formatDatePtBr(day.closed_date)}
                      {day.note?.trim() ? ` — ${day.note.trim()}` : ` — ${DEFAULT_CLINIC_CLOSED_NOTE}`}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-destructive shrink-0"
                      onClick={() => void handleRemoveClinicClosedDay(day.id)}
                      disabled={savingClinicClosed}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={vacationDialogOpen} onOpenChange={setVacationDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar férias</DialogTitle>
            <DialogDescription>
              Durante esse período, os horários livres da agenda ficam bloqueados com aviso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Períodos cadastrados</p>
              {vacationPeriods.length === 0 ? (
                <p className="text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-2">
                  Nenhum período cadastrado.
                </p>
              ) : (
                <div className="max-h-32 space-y-1.5 overflow-auto pr-1">
                  {vacationPeriods.map((period) => (
                    <div
                      key={period.id}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs ${vacationPeriodCardClass(period.end_date)}`}
                    >
                      <span className="min-w-0">
                        {formatDatePtBr(period.start_date)} até {formatDatePtBr(period.end_date)}
                        {period.message?.trim() ? ` (${period.message.trim()})` : ''}
                      </span>
                      {!isVacationPeriodPast(period.end_date) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-destructive"
                          onClick={() => void handleRemoveVacationPeriod(period.id)}
                          disabled={savingVacation}
                        >
                          Remover
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="vacation-start-date">Início</Label>
              <Input
                id="vacation-start-date"
                type="date"
                value={vacationDraft.startDate}
                onChange={(e) => setVacationDraft((prev) => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vacation-end-date">Fim</Label>
              <Input
                id="vacation-end-date"
                type="date"
                value={vacationDraft.endDate}
                onChange={(e) => setVacationDraft((prev) => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vacation-message">Mensagem na agenda</Label>
              <Input
                id="vacation-message"
                placeholder="Ex.: Férias"
                value={vacationDraft.message}
                onChange={(e) => setVacationDraft((prev) => ({ ...prev, message: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => setVacationDialogOpen(false)} disabled={savingVacation}>
              Fechar
            </Button>
            <Button type="button" onClick={handleAddVacationPeriod} disabled={savingVacation}>
              {savingVacation ? 'Salvando...' : 'Adicionar período'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clinicClosedDialogOpen} onOpenChange={setClinicClosedDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{copy.isSalon ? 'Fechar salão' : 'Fechar clínica'}</DialogTitle>
            <DialogDescription>
              {copy.isSalon
                ? 'Nos dias selecionados, o salão não aceita novos agendamentos de clientes. Você continua usando a agenda para marcar horários pessoais (reunião, curso, pessoal…).'
                : 'Nos dias selecionados, a clínica não aceita novos agendamentos de pacientes. Você continua usando a agenda para marcar horários pessoais (reunião, curso, pessoal…).'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Dias cadastrados</p>
              {clinicClosedDays.length === 0 ? (
                <p className="text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-2">
                  Nenhum dia cadastrado.
                </p>
              ) : (
                <div className="max-h-32 space-y-1.5 overflow-auto pr-1">
                  {clinicClosedDays.map((day) => (
                    <div
                      key={day.id}
                      className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs"
                    >
                      <span className="min-w-0">
                        {formatDatePtBr(day.closed_date)}
                        {day.note?.trim() ? ` — ${day.note.trim()}` : ''}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive"
                        onClick={() => void handleRemoveClinicClosedDay(day.id)}
                        disabled={savingClinicClosed}
                      >
                        Remover
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="clinic-closed-date">Dia</Label>
              <Input
                id="clinic-closed-date"
                type="date"
                value={clinicClosedDraftDate}
                onChange={(e) => setClinicClosedDraftDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clinic-closed-note">Rótulo na agenda</Label>
              <Input
                id="clinic-closed-note"
                placeholder="Ex.: Agenda pessoal"
                value={clinicClosedDraftNote}
                onChange={(e) => setClinicClosedDraftNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => setClinicClosedDialogOpen(false)} disabled={savingClinicClosed}>
              Fechar
            </Button>
            <Button type="button" onClick={handleAddClinicClosedDay} disabled={savingClinicClosed}>
              {savingClinicClosed ? 'Salvando...' : 'Adicionar dia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="text-base md:text-lg">Parâmetros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-3 md:p-6 pt-0">
          {!copy.isSalon ? (
          <div className="rounded-2xl border border-border/70 bg-gradient-to-b from-muted/25 to-muted/10 p-4 md:p-5 space-y-4">
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Define o que acontece ao tocar em &quot;Agendar próxima avaliação&quot; (ou similar) durante a consulta.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-sm font-semibold tracking-tight">Abrir como</Label>
              <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground">
                {savingAgendaOpenMode ? 'Salvando...' : 'Preferência salva automaticamente'}
              </span>
            </div>

            <div
              className="inline-flex w-full max-w-md rounded-full border border-primary/25 bg-primary/85 p-1 shadow-sm"
              role="group"
              aria-label="Modo de abertura da agenda"
            >
              {[
                { id: 'dia', short: 'D', title: 'Dia' },
                { id: 'semana', short: 'S', title: 'Semana' },
                { id: 'mes', short: 'M', title: 'Mês' },
              ].map((mode) => {
                const active = agendaOpenMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => handleAgendaOpenModeChange(mode.id)}
                    disabled={savingAgendaOpenMode}
                    title={mode.title}
                    aria-label={mode.title}
                    aria-pressed={active}
                    className={[
                      'h-9 flex-1 rounded-full text-sm font-semibold transition-all duration-200',
                      active
                        ? 'bg-background text-foreground shadow-sm ring-1 ring-primary/15'
                        : 'text-primary-foreground/95 hover:bg-primary-foreground/18',
                    ].join(' ')}
                  >
                    {mode.short}
                  </button>
                );
              })}
            </div>

            <p className="text-sm font-medium text-foreground leading-relaxed">
              {agendaOpenMode === 'dia' && 'Dia: pop-up com horários do dia calculado.'}
              {agendaOpenMode === 'semana' && 'Semana: pop-up com a grade da semana (setas para outras semanas).'}
              {agendaOpenMode === 'mes' && 'Mês: pop-up começando na semana do início do mês de referência.'}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Em <strong className="text-foreground font-medium">Semana</strong> e <strong className="text-foreground font-medium">Mês</strong>, o calendário abre no mesmo pop-up; use as setas para mudar de semana.
            </p>
          </div>
          ) : null}
          {!copy.isSalon && isProgramaBotoxEnabled ? (
          <div className="rounded-2xl border border-border/70 bg-gradient-to-b from-muted/20 to-muted/10 p-4 md:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold tracking-tight">Programa de Botox</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  No mobile/tablet: cards (padrão) ou planilha compacta. No desktop a visualização continua em planilha.
                </p>
              </div>
              <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground">
                {savingProgramaBotoxViewMode ? 'Salvando...' : 'Preferência salva automaticamente'}
              </span>
            </div>
            <div className="inline-flex w-full max-w-md rounded-full border border-primary/25 bg-primary/85 p-1 shadow-sm">
              {[
                { id: 'padrao', label: 'Cards' },
                { id: 'planilha', label: 'Planilha' },
              ].map((mode) => {
                const active = programaBotoxViewMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => handleProgramaBotoxViewModeChange(mode.id as 'padrao' | 'planilha')}
                    disabled={savingProgramaBotoxViewMode}
                    aria-pressed={active}
                    className={[
                      'h-9 flex-1 rounded-full text-sm font-semibold transition-all duration-200',
                      active
                        ? 'bg-background text-foreground shadow-sm ring-1 ring-primary/15'
                        : 'text-primary-foreground/95 hover:bg-primary-foreground/18',
                    ].join(' ')}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>
          ) : null}
          {!copy.isSalon ? (
          <div className="rounded-2xl border border-border/70 bg-gradient-to-b from-muted/20 to-muted/10 p-4 md:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold tracking-tight">Cálculo de peso na evolução</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Em redução de medidas, usa maior peso histórico como referência do card &quot;Peso total&quot;.
                </p>
              </div>
              <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground">
                {savingWeightReference ? 'Salvando...' : 'Preferência salva automaticamente'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/70 px-3 py-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Usar maior peso histórico</p>
                <p className="text-xs text-muted-foreground">Fórmula: maior peso do histórico - peso da sessão atual.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={useMaxWeightReference}
                onClick={() => handleUseMaxWeightReferenceChange(!useMaxWeightReference)}
                disabled={savingWeightReference}
                className={[
                  'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
                  useMaxWeightReference ? 'bg-primary' : 'bg-input',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                ].join(' ')}
              >
                <span
                  className={[
                    'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
                    useMaxWeightReference ? 'translate-x-5' : 'translate-x-0',
                  ].join(' ')}
                />
              </button>
            </div>
          </div>
          ) : null}
          {!copy.isSalon ? (
          <div className="rounded-2xl border border-border/70 bg-gradient-to-b from-muted/20 to-muted/10 p-4 md:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold tracking-tight">Registro de sessões em timeline</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quando ativo, troca a lista tradicional de sessões pelo modo Timeline na tela do procedimento.
                </p>
              </div>
              <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground">
                {savingSessionTimeline ? 'Salvando...' : 'Preferência salva automaticamente'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/70 px-3 py-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Mostrar Timeline</p>
                <p className="text-xs text-muted-foreground">No detalhe do procedimento, mostra a timeline clicável de sessões.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showSessionTimeline}
                onClick={() => handleShowSessionTimelineChange(!showSessionTimeline)}
                disabled={savingSessionTimeline}
                className={[
                  'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
                  showSessionTimeline ? 'bg-primary' : 'bg-input',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                ].join(' ')}
              >
                <span
                  className={[
                    'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
                    showSessionTimeline ? 'translate-x-5' : 'translate-x-0',
                  ].join(' ')}
                />
              </button>
            </div>
          </div>
          ) : null}
          <div className="rounded-2xl border border-border/70 bg-gradient-to-b from-muted/20 to-muted/10 p-4 md:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold tracking-tight">Início (dashboard)</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {copy.isSalon
                    ? 'Blocos extras abaixo da tabela de atendimentos do dia na página inicial.'
                    : 'Blocos extras abaixo da tabela de consultas do dia na página inicial.'}
                </p>
              </div>
              <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground">
                {savingDashboardWidgets ? 'Salvando...' : 'Preferência salva automaticamente'}
              </span>
            </div>
            {[
              {
                id: 'birthdays' as const,
                label: 'Aniversariantes da semana',
                desc: copy.isSalon
                  ? 'Clientes com aniversário nesta semana e atalho para WhatsApp.'
                  : 'Pacientes com aniversário nesta semana e atalho para WhatsApp.',
                checked: showDashboardBirthdays,
              },
              {
                id: 'futureClients' as const,
                label: 'Futuros clientes',
                desc: 'Avaliação com cadastro incompleto.',
                checked: showDashboardFutureClients,
              },
              ...(isProgramaBotoxEnabled && !copy.isSalon
                ? [
                    {
                      id: 'botoxReminders' as const,
                      label: 'Reaplicação Botox',
                      desc: 'Lembretes que vencem nos próximos 7 dias.',
                      checked: showDashboardBotoxReminders,
                    },
                  ]
                : []),
            ].map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-background/70 px-3 py-2"
              >
                <div className="space-y-0.5 pr-3 min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={item.checked}
                  onClick={() => handleDashboardWidgetChange(item.id, !item.checked)}
                  disabled={savingDashboardWidgets}
                  className={[
                    'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
                    item.checked ? 'bg-primary' : 'bg-input',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
                      item.checked ? 'translate-x-5' : 'translate-x-0',
                    ].join(' ')}
                  />
                </button>
              </div>
            ))}
          </div>

          {copy.isSalon && isSalonAdmin ? <SalonAgendaProfessionalsOrderSection /> : null}

          <div className="rounded-2xl border border-border/70 bg-gradient-to-b from-muted/20 to-muted/10 p-4 md:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold tracking-tight">Agenda: cor do bloqueio</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Define a cor dos horários bloqueados manualmente (ícone de alfinete) na agenda.
                </p>
              </div>
              <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground">
                {savingAgendaSlotBlockColor ? 'Salvando...' : 'Preferência salva automaticamente'}
              </span>
            </div>
            <SalonMemberLabelColorPicker
              id="agenda-slot-block-color"
              value={agendaSlotBlockColor}
              onChange={(hex) => void handleAgendaSlotBlockColorChange(hex)}
              disabled={savingAgendaSlotBlockColor}
              label="Cor do compromisso bloqueado"
              description="Aparece nos slots com bloqueio manual (pin) na agenda."
            />
          </div>

          <div className="rounded-2xl border border-border/70 bg-gradient-to-b from-muted/20 to-muted/10 p-4 md:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold tracking-tight">Agenda: encaixe em horário ocupado</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quando ativo, mostra a opção &quot;Encaixe&quot; no detalhe de um horário ocupado da agenda.
                </p>
              </div>
              <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground">
                {savingOccupiedSlotEncaixe ? 'Salvando...' : 'Preferência salva automaticamente'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/70 px-3 py-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Mostrar opção de Encaixe</p>
                <p className="text-xs text-muted-foreground">Exibe o checkbox de encaixe no modal de horário ocupado.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showOccupiedSlotEncaixe}
                onClick={() => handleShowOccupiedSlotEncaixeChange(!showOccupiedSlotEncaixe)}
                disabled={savingOccupiedSlotEncaixe}
                className={[
                  'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
                  showOccupiedSlotEncaixe ? 'bg-primary' : 'bg-input',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                ].join(' ')}
              >
                <span
                  className={[
                    'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
                    showOccupiedSlotEncaixe ? 'translate-x-5' : 'translate-x-0',
                  ].join(' ')}
                />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
      <MobileBottomSafeSpacer />
    </div>
  );
}
