import { useMemo } from 'react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  BrowserTabs,
  BrowserTabsContent,
  BrowserTabsList,
  BrowserTabsTrigger,
} from '@/components/ui/browser-tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  MessageCircle,
  MessageSquareText,
  RefreshCw,
  QrCode,
  Wallet,
  CheckCircle2,
  Unplug,
  Bot,
  PauseCircle,
  CircleHelp,
  Megaphone,
  PhoneOff,
  ShieldCheck,
  ShieldAlert,
  Receipt,
  Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getChatbotApiBase } from '@/lib/programaBotoxBilling';
import { isProgramaBotoxModuleEnabled, isProfessionalModuleEnabled, MODULE_KEY_ORCAMENTO } from '@/lib/professionalModules';
import {
  fetchProfessionalUiSettings,
  upsertProfessionalUiSettings,
} from '@/services/api/dynamicProcedureFieldSettingsApi';
import { BirthdayWhatsappSection } from '@/components/settings/BirthdayWhatsappSection';
import { WhatsappManualMessagesSection } from '@/components/settings/WhatsappManualMessagesSection';
import { WhatsappPlaceholderChips } from '@/components/settings/WhatsappPlaceholderChips';
import type { WhatsappPlaceholderChipItem } from '@/components/settings/WhatsappPlaceholderChips';
import { WhatsappMessageEditor } from '@/components/settings/WhatsappMessageEditor';
import { WhatsappFormattedPreview } from '@/components/settings/WhatsappFormattedPreview';
import { normalizeWhatsappMarkers } from '@/lib/whatsappFormatting';
import { Reminder24hStatusPanel } from '@/components/settings/Reminder24hStatusPanel';
import { WhatsappPairingByNumberPanel } from '@/components/whatsapp/WhatsappPairingByNumberPanel';
import { WhatsappFaqSection } from '@/components/settings/WhatsappFaqSection';
import { WhatsappPromotionSection } from '@/components/settings/WhatsappPromotionSection';
import { WhatsappIgnoredNumbersSection } from '@/components/settings/WhatsappIgnoredNumbersSection';
import { WhatsappBotoxBillingPatientsSection } from '@/components/settings/WhatsappBotoxBillingPatientsSection';
import { WhatsappBudgetQuoteBillingSection } from '@/components/settings/WhatsappBudgetQuoteBillingSection';
import {
  applyPresenceConfirmation,
  buildAppointmentReminder24hPreview,
  DEFAULT_APPOINTMENT_REMINDER_24H_MESSAGE,
  DEFAULT_PRESENCE_CONFIRMATION_PROMPT,
  resolvePresenceConfirmationPrompt,
} from '@/lib/appointmentReminder24h';
import {
  APPOINTMENT_REMINDER_1H_HOURS_MAX,
  APPOINTMENT_REMINDER_1H_HOURS_MIN,
  DEFAULT_APPOINTMENT_REMINDER_1H_HOURS,
  DEFAULT_APPOINTMENT_REMINDER_1H_MESSAGE,
  formatReminderNearHoursLabel,
  normalizeAppointmentReminder1hHours,
} from '@/lib/appointmentReminder1h';
import { Checkbox } from '@/components/ui/checkbox';
import { useUiCopy } from '@/hooks/use-ui-copy';
import { isSalonAccount } from '@/lib/accountType';
import { useClinicFrontDeskScope } from '@/hooks/use-clinic-front-desk-scope';
import { useClinicBranchContext } from '@/contexts/ClinicBranchContext';

function SettingsSwitch({
  checked,
  disabled,
  onChange,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={[
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
        checked ? 'bg-primary' : 'bg-input',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}

export default function SettingsWhatsApp() {
  const { profile } = useAuth();
  const { isFrontDeskStaff, scope: frontDeskScope, isLoading: frontDeskLoading } =
    useClinicFrontDeskScope();
  const { isClinicAccount, effectiveBranchId, branches, isLoading: branchLoading } =
    useClinicBranchContext();

  const whatsappProfessionalId = useMemo(() => {
    if (isFrontDeskStaff) {
      if (frontDeskLoading || !frontDeskScope?.whatsappProfessionalId) return '';
      return frontDeskScope.whatsappProfessionalId;
    }
    return profile?.id ?? '';
  }, [isFrontDeskStaff, frontDeskLoading, frontDeskScope?.whatsappProfessionalId, profile?.id]);

  /** Clínica: lista de bloqueados fica na filial (RLS permite recepção editar). */
  const whatsappBranchId = useMemo(() => {
    if (!isClinicAccount || branchLoading) return null;
    if (effectiveBranchId) return effectiveBranchId;
    return branches[0]?.id ?? null;
  }, [isClinicAccount, branchLoading, effectiveBranchId, branches]);
  const copy = useUiCopy();
  const patientWord = copy.patient.toLowerCase();
  const isSalonProfile = copy.isSalon || isSalonAccount(profile?.account_type);
  const salonName = profile?.app_name?.trim() || profile?.full_name || 'Salão';

  const reminderPlaceholderChips = useMemo(
    (): WhatsappPlaceholderChipItem[] => [
      'nome',
      'primeiro_nome',
      'consulta',
      'procedimento',
      'dia',
      'data',
      'horario',
      'hora',
      'hora_fim',
      'profissional',
      ...(isSalonProfile ? (['nome_salao'] as const) : []),
      'confirmacao_presenca',
    ],
    [isSalonProfile]
  );

  const reminderPlaceholderHint = isSalonProfile
    ? 'Use {{nome_salao}} no final se quiser. {{confirmacao_presenca}} posiciona o bloco de confirmação; sem ele, a confirmação vai automaticamente ao final.'
    : 'Use {{confirmacao_presenca}} para posicionar o bloco de confirmação; sem ele, a confirmação vai automaticamente ao final.';

  const isProgramaBotoxEnabled = isProgramaBotoxModuleEnabled(profile);
  const isOrcamentoEnabled = isProfessionalModuleEnabled(profile, MODULE_KEY_ORCAMENTO);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [disconnectingQr, setDisconnectingQr] = useState(false);
  const [whatsappQr, setWhatsappQr] = useState<string | null>(null);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [whatsappInstanceId, setWhatsappInstanceId] = useState('');
  const [awaitingPairing, setAwaitingPairing] = useState(false);
  const pairingActiveRef = useRef(false);
  const statusPollInFlightRef = useRef(false);
  const reminder24hTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const reminder24hInsertRef = useRef<((token: string) => void) | null>(null);
  const [showWhatsappCard, setShowWhatsappCard] = useState(true);
  const [whatsappSecretaryEnabled, setWhatsappSecretaryEnabled] = useState(false);
  const [appointmentReminder24hEnabled, setAppointmentReminder24hEnabled] = useState(true);
  const [appointmentReminder24hMessage, setAppointmentReminder24hMessage] = useState('');
  const [savedAppointmentReminder24hMessage, setSavedAppointmentReminder24hMessage] = useState('');
  const [savingReminderMessage, setSavingReminderMessage] = useState(false);
  const [messagesAccordionOpen, setMessagesAccordionOpen] = useState<string[]>([]);
  const [appointmentReminder1hEnabled, setAppointmentReminder1hEnabled] = useState(true);
  const [appointmentReminder1hHours, setAppointmentReminder1hHours] = useState(
    DEFAULT_APPOINTMENT_REMINDER_1H_HOURS
  );
  const [appointmentReminder1hMessage, setAppointmentReminder1hMessage] = useState('');
  const [savedAppointmentReminder1hMessage, setSavedAppointmentReminder1hMessage] = useState('');
  const [savingReminder1hMessage, setSavingReminder1hMessage] = useState(false);
  const [savingReminder1hHours, setSavingReminder1hHours] = useState(false);
  const reminder1hTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const reminder1hInsertRef = useRef<((token: string) => void) | null>(null);
  const [appointmentPresenceConfirmation24hEnabled, setAppointmentPresenceConfirmation24hEnabled] =
    useState(false);
  const [appointmentPresenceConfirmation1hEnabled, setAppointmentPresenceConfirmation1hEnabled] =
    useState(true);
  const [presenceConfirmationMessage, setPresenceConfirmationMessage] = useState('');
  const [savedPresenceConfirmationMessage, setSavedPresenceConfirmationMessage] = useState('');
  const [savingPresenceConfirmationMessage, setSavingPresenceConfirmationMessage] = useState(false);
  const [savingSecretary, setSavingSecretary] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);
  const [savingReminder1h, setSavingReminder1h] = useState(false);
  const [savingPresenceConfirmation24h, setSavingPresenceConfirmation24h] = useState(false);
  const [savingPresenceConfirmation1h, setSavingPresenceConfirmation1h] = useState(false);
  const [whatsappSendWarmupEnabled, setWhatsappSendWarmupEnabled] = useState(true);
  const [savingWarmup, setSavingWarmup] = useState(false);
  const [warmupDisableConfirmOpen, setWarmupDisableConfirmOpen] = useState(false);
  const [whatsappBotName, setWhatsappBotName] = useState('Secretária Virtual');
  const [botNameDraft, setBotNameDraft] = useState('Secretária Virtual');
  const [savingBotName, setSavingBotName] = useState(false);
  const [autoSendProgramaBotoxBilling, setAutoSendProgramaBotoxBilling] = useState(false);
  const [savingAutoSendProgramaBotoxBilling, setSavingAutoSendProgramaBotoxBilling] = useState(false);
  const [autoSendBudgetQuoteBilling, setAutoSendBudgetQuoteBilling] = useState(false);
  const [savingAutoSendBudgetQuoteBilling, setSavingAutoSendBudgetQuoteBilling] = useState(false);
  const [showWhatsappBotoxBillingSection, setShowWhatsappBotoxBillingSection] = useState(true);
  const [showWhatsappBirthdaySection, setShowWhatsappBirthdaySection] = useState(true);
  const [showWhatsappPromotionsSection, setShowWhatsappPromotionsSection] = useState(true);
  const [showWhatsappPromotionHistorySection, setShowWhatsappPromotionHistorySection] = useState(true);
  const [connectMode, setConnectMode] = useState<'qr' | 'phone'>('qr');

  const qrDialogOpen =
    !whatsappConnected && (loadingQr || Boolean(whatsappQr) || awaitingPairing);

  const closeQrDialog = () => {
    setWhatsappQr(null);
    setAwaitingPairing(false);
    pairingActiveRef.current = false;
    setConnectMode('qr');
  };

  const CHATBOT_API_BASE = getChatbotApiBase();
  const ensureApiBase = () => {
    if (CHATBOT_API_BASE) return true;
    toast.error('Configure VITE_CHATBOT_API_URL no Vercel para conectar o WhatsApp (Evolution API).');
    return false;
  };

  const persistUiSettings = async (patch: {
    whatsappSecretaryEnabled?: boolean;
    appointmentReminder24hEnabled?: boolean;
    appointmentReminder24hMessage?: string | null;
    appointmentReminder1hEnabled?: boolean;
    appointmentReminder1hHours?: number;
    appointmentReminder1hMessage?: string | null;
    appointmentPresenceConfirmationEnabled?: boolean;
    appointmentPresenceConfirmation24hEnabled?: boolean;
    appointmentPresenceConfirmationMessage?: string | null;
    autoSendProgramaBotoxBilling?: boolean;
    autoSendBudgetQuoteBilling?: boolean;
    whatsappSendWarmupEnabled?: boolean;
    whatsappBotName?: string;
  }) => {
    if (!whatsappProfessionalId) return;
    const ui = await fetchProfessionalUiSettings({ professionalId: whatsappProfessionalId });
    await upsertProfessionalUiSettings({
      professionalId: whatsappProfessionalId,
      showSessionPhotos: ui.show_session_photos,
      showWhatsappUltraMsg: ui.show_whatsapp_ultramsg,
      agendaOpenMode: ui.agenda_open_mode,
      useMaxWeightReference: ui.use_max_weight_reference,
      programaBotoxViewMode: ui.programa_botox_view_mode,
      showSessionTimeline: ui.show_session_timeline,
      showOccupiedSlotEncaixe: ui.show_occupied_slot_encaixe,
      showDashboardBirthdays: ui.show_dashboard_birthdays,
      showDashboardFutureClients: ui.show_dashboard_future_clients,
      showDashboardBotoxReminders: ui.show_dashboard_botox_reminders,
      autoSendProgramaBotoxBilling:
        patch.autoSendProgramaBotoxBilling ?? ui.auto_send_programa_botox_billing,
      autoSendBudgetQuoteBilling:
        patch.autoSendBudgetQuoteBilling ?? ui.auto_send_budget_quote_billing,
      whatsappSecretaryEnabled: patch.whatsappSecretaryEnabled ?? ui.whatsapp_secretary_enabled,
      appointmentReminder24hEnabled:
        patch.appointmentReminder24hEnabled ?? ui.appointment_reminder_24h_enabled,
      appointmentReminder24hMessage:
        patch.appointmentReminder24hMessage !== undefined
          ? patch.appointmentReminder24hMessage
          : ui.appointment_reminder_24h_message,
      appointmentReminder1hEnabled:
        patch.appointmentReminder1hEnabled ?? ui.appointment_reminder_1h_enabled,
      appointmentReminder1hHours:
        patch.appointmentReminder1hHours ?? ui.appointment_reminder_1h_hours,
      appointmentReminder1hMessage:
        patch.appointmentReminder1hMessage !== undefined
          ? patch.appointmentReminder1hMessage
          : ui.appointment_reminder_1h_message,
      appointmentPresenceConfirmationEnabled:
        patch.appointmentPresenceConfirmationEnabled ??
        ui.appointment_presence_confirmation_enabled,
      appointmentPresenceConfirmation24hEnabled:
        patch.appointmentPresenceConfirmation24hEnabled ??
        ui.appointment_presence_confirmation_24h_enabled,
      appointmentPresenceConfirmationMessage:
        patch.appointmentPresenceConfirmationMessage !== undefined
          ? patch.appointmentPresenceConfirmationMessage
          : ui.appointment_presence_confirmation_message,
      whatsappSendWarmupEnabled:
        patch.whatsappSendWarmupEnabled ?? ui.whatsapp_send_warmup_enabled,
      whatsappBotName: patch.whatsappBotName ?? ui.whatsapp_bot_name,
      whatsappMessageTemplates: ui.whatsapp_message_templates,
      vacationStartDate: ui.vacation_start_date,
      vacationEndDate: ui.vacation_end_date,
      vacationMessage: ui.vacation_message,
    });
  };

  type EvolutionConnectionPayload = {
    connected?: boolean;
    instanceId?: string;
    qr?: string | null;
    error?: string;
  };

  const parseEvolutionJson = async (res: Response): Promise<EvolutionConnectionPayload | null> => {
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('json')) return null;
    return res.json();
  };

  /** Status leve; se o backend na VPS ainda não tiver /evolution/status, usa /evolution/qr. */
  const fetchEvolutionConnection = async (
    professionalId: string
  ): Promise<{ ok: true; data: EvolutionConnectionPayload } | { ok: false; error: string }> => {
    const statusRes = await fetch(`${CHATBOT_API_BASE}/evolution/status/${professionalId}`);
    let res = statusRes;
    let data = await parseEvolutionJson(statusRes);

    if (statusRes.status === 404 || !data) {
      res = await fetch(`${CHATBOT_API_BASE}/evolution/qr/${professionalId}`);
      data = await parseEvolutionJson(res);
    }

    if (!data) {
      return {
        ok: false,
        error:
          'Servidor retornou resposta inválida. Atualize o backend na VPS (pm2 restart) e tente de novo.',
      };
    }
    if (!res.ok) {
      return { ok: false, error: data.error || 'Falha ao verificar conexão' };
    }
    return { ok: true, data };
  };

  const applyConnectionPayload = (
    data: EvolutionConnectionPayload,
    options?: { preserveExistingQr?: boolean }
  ) => {
    const connected = Boolean(data?.connected);
    setWhatsappConnected(connected);
    setWhatsappInstanceId(typeof data?.instanceId === 'string' ? data.instanceId : '');
    if (connected) {
      setWhatsappQr(null);
      setAwaitingPairing(false);
      return true;
    }
    if (typeof data?.qr === 'string' && data.qr && !options?.preserveExistingQr) {
      setWhatsappQr(data.qr);
      setAwaitingPairing(true);
      pairingActiveRef.current = true;
    }
    return false;
  };

  const refreshConnectionStatus = async (options?: { silent?: boolean }) => {
    if (!whatsappProfessionalId) return false;
    if (!ensureApiBase()) return false;
    if (statusPollInFlightRef.current) return false;

    const showSpinner = !options?.silent;
    statusPollInFlightRef.current = true;
    if (showSpinner) setCheckingStatus(true);
    try {
      const result = await fetchEvolutionConnection(whatsappProfessionalId);
      if (!result.ok) {
        throw new Error(result.error);
      }
      const wasConnected = applyConnectionPayload(result.data, {
        preserveExistingQr: options?.silent,
      });
      if (wasConnected && pairingActiveRef.current) {
        pairingActiveRef.current = false;
        toast.success('WhatsApp conectado com sucesso!');
      }
      return wasConnected;
    } catch (error) {
      console.error('Erro ao verificar status da Evolution:', error);
      if (!options?.silent) {
        toast.error(error instanceof Error ? error.message : 'Não foi possível verificar a conexão');
      }
      return false;
    } finally {
      statusPollInFlightRef.current = false;
      if (showSpinner) setCheckingStatus(false);
    }
  };

  const requestPairingQr = async (opts: { forceRestart?: boolean } = {}) => {
    if (!whatsappProfessionalId) return;
    if (!ensureApiBase()) return;
    setLoadingQr(true);
    try {
      const qs = opts.forceRestart ? '?forceRestart=1' : '';
      const res = await fetch(
        `${CHATBOT_API_BASE}/evolution/qr/${whatsappProfessionalId}${qs}`
      );
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('json')) {
        throw new Error('Servidor retornou resposta inválida. Aguarde o redeploy na Vercel.');
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Falha ao gerar QR Code');
      }
      const connected = applyConnectionPayload(data);
      if (connected) {
        toast.success('WhatsApp já está conectado.');
        return;
      }
      if (!data?.qr) {
        toast.message('QR Code indisponível. Tente Por número ou Atualizar QR.');
        setAwaitingPairing(true);
        return;
      }
      setAwaitingPairing(true);
    } catch (error) {
      console.error('Erro ao gerar QR da Evolution:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar o QR Code');
      setWhatsappQr(null);
      setAwaitingPairing(false);
      pairingActiveRef.current = false;
    } finally {
      setLoadingQr(false);
    }
  };

  const handleDisconnectWhatsapp = async () => {
    if (!whatsappProfessionalId) return;
    if (!ensureApiBase()) return;
    setDisconnectingQr(true);
    try {
      const res = await fetch(`${CHATBOT_API_BASE}/evolution/disconnect/${whatsappProfessionalId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Falha ao desconectar instância');
      }
      setWhatsappQr(null);
      setWhatsappConnected(false);
      setAwaitingPairing(false);
      pairingActiveRef.current = false;
      if (typeof data?.instanceId === 'string' && data.instanceId) {
        setWhatsappInstanceId(data.instanceId);
      }
      toast.success(data?.message || 'WhatsApp desconectado.');
      await refreshConnectionStatus({ silent: true });
    } catch (error) {
      console.error('Erro ao desconectar Evolution:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível desconectar o WhatsApp');
    } finally {
      setDisconnectingQr(false);
    }
  };

  useEffect(() => {
    if (whatsappProfessionalId) {
      void refreshConnectionStatus({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whatsappProfessionalId]);

  useEffect(() => {
    if (!whatsappProfessionalId || whatsappConnected) return;
    if (!awaitingPairing && !whatsappQr) return;

    const tick = () => {
      void refreshConnectionStatus({ silent: true });
    };

    tick();
    const timer = window.setInterval(tick, 2500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingPairing, whatsappQr, whatsappConnected, whatsappProfessionalId]);

  // Não renovar QR automaticamente: o endpoint pode reiniciar a sessão (forceRestart)
  // e derrubar o WhatsApp do profissional. Status continua sendo checado a cada 2.5s.
  // QR expirado → usuário toca em "Atualizar QR Code".

  useEffect(() => {
    let cancelled = false;
    const loadUiSetting = async () => {
      if (!whatsappProfessionalId) return;
      try {
        const ui = await fetchProfessionalUiSettings({ professionalId: whatsappProfessionalId });
        if (cancelled) return;
        setShowWhatsappCard(ui.show_whatsapp_ultramsg);
        setWhatsappSecretaryEnabled(ui.whatsapp_secretary_enabled);
        setAppointmentReminder24hEnabled(ui.appointment_reminder_24h_enabled);
        const reminderTemplate = ui.appointment_reminder_24h_message?.trim() || '';
        setAppointmentReminder24hMessage(reminderTemplate);
        setSavedAppointmentReminder24hMessage(reminderTemplate);
        setAppointmentReminder1hEnabled(ui.appointment_reminder_1h_enabled);
        setAppointmentReminder1hHours(
          normalizeAppointmentReminder1hHours(ui.appointment_reminder_1h_hours)
        );
        const reminder1hTemplate = ui.appointment_reminder_1h_message?.trim() || '';
        setAppointmentReminder1hMessage(reminder1hTemplate);
        setSavedAppointmentReminder1hMessage(reminder1hTemplate);
        setAppointmentPresenceConfirmation24hEnabled(ui.appointment_presence_confirmation_24h_enabled);
        setAppointmentPresenceConfirmation1hEnabled(ui.appointment_presence_confirmation_enabled);
        const presenceTpl = ui.appointment_presence_confirmation_message?.trim() || '';
        setPresenceConfirmationMessage(presenceTpl);
        setSavedPresenceConfirmationMessage(presenceTpl);
        setWhatsappSendWarmupEnabled(ui.whatsapp_send_warmup_enabled);
        setWhatsappBotName(ui.whatsapp_bot_name);
        setBotNameDraft(ui.whatsapp_bot_name);
        setAutoSendProgramaBotoxBilling(ui.auto_send_programa_botox_billing);
        setAutoSendBudgetQuoteBilling(ui.auto_send_budget_quote_billing);
        setShowWhatsappBotoxBillingSection(ui.show_whatsapp_botox_billing_section);
        setShowWhatsappBirthdaySection(ui.show_whatsapp_birthday_section);
        setShowWhatsappPromotionsSection(ui.show_whatsapp_promotions_section);
        setShowWhatsappPromotionHistorySection(ui.show_whatsapp_promotion_history_section);
      } catch {
        if (!cancelled) {
          setShowWhatsappCard(true);
          setWhatsappSecretaryEnabled(true);
          setAppointmentReminder24hEnabled(true);
          setAppointmentReminder24hMessage('');
          setSavedAppointmentReminder24hMessage('');
          setAppointmentReminder1hEnabled(true);
          setAppointmentReminder1hHours(DEFAULT_APPOINTMENT_REMINDER_1H_HOURS);
          setAppointmentReminder1hMessage('');
          setSavedAppointmentReminder1hMessage('');
          setAppointmentPresenceConfirmation24hEnabled(false);
          setAppointmentPresenceConfirmation1hEnabled(true);
          setPresenceConfirmationMessage('');
          setSavedPresenceConfirmationMessage('');
          setWhatsappSendWarmupEnabled(true);
          setWhatsappBotName('Secretária Virtual');
          setBotNameDraft('Secretária Virtual');
          setAutoSendProgramaBotoxBilling(false);
          setShowWhatsappBotoxBillingSection(true);
          setShowWhatsappBirthdaySection(true);
          setShowWhatsappPromotionsSection(true);
          setShowWhatsappPromotionHistorySection(true);
        }
      }
    };
    void loadUiSetting();
    return () => {
      cancelled = true;
    };
  }, [whatsappProfessionalId]);

  const handleWhatsappSecretaryChange = async (checked: boolean) => {
    if (!whatsappProfessionalId) return;
    setSavingSecretary(true);
    try {
      await persistUiSettings({ whatsappSecretaryEnabled: checked });
      setWhatsappSecretaryEnabled(checked);
      toast.success(
        checked
          ? 'Secretária virtual ativada — o WhatsApp responderá automaticamente.'
          : 'Secretária virtual pausada — você atende manualmente pelo WhatsApp.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSavingSecretary(false);
    }
  };

  const handleWhatsappSendWarmupChange = (checked: boolean) => {
    if (!whatsappProfessionalId) return;
    if (!checked && whatsappSendWarmupEnabled) {
      setWarmupDisableConfirmOpen(true);
      return;
    }
    void persistWhatsappSendWarmup(checked);
  };

  const persistWhatsappSendWarmup = async (checked: boolean) => {
    if (!whatsappProfessionalId) return;
    setSavingWarmup(true);
    try {
      await persistUiSettings({ whatsappSendWarmupEnabled: checked });
      setWhatsappSendWarmupEnabled(checked);
      setWarmupDisableConfirmOpen(false);
      toast.success(
        checked
          ? 'Trava Anti-bloqueio ativada — limite progressivo só nos disparos de promoção.'
          : 'Trava Anti-bloqueio desativada — promoções sem limite diário progressivo.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSavingWarmup(false);
    }
  };

  const handleSaveBotName = async () => {
    if (!whatsappProfessionalId) return;
    const next = botNameDraft.trim() || 'Secretária Virtual';
    setSavingBotName(true);
    try {
      await persistUiSettings({ whatsappBotName: next });
      setWhatsappBotName(next);
      setBotNameDraft(next);
      toast.success('Nome do bot atualizado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSavingBotName(false);
    }
  };

  const handleAutoSendProgramaBotoxBillingChange = async (checked: boolean) => {
    if (!whatsappProfessionalId) return;
    setSavingAutoSendProgramaBotoxBilling(true);
    try {
      await persistUiSettings({ autoSendProgramaBotoxBilling: checked });
      setAutoSendProgramaBotoxBilling(checked);
      toast.success(
        checked
          ? 'Cobrança automática do programa de Botox ativada.'
          : 'Cobrança automática do programa de Botox desativada.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSavingAutoSendProgramaBotoxBilling(false);
    }
  };

  const handleAutoSendBudgetQuoteBillingChange = async (checked: boolean) => {
    if (!whatsappProfessionalId) return;
    setSavingAutoSendBudgetQuoteBilling(true);
    try {
      await persistUiSettings({ autoSendBudgetQuoteBilling: checked });
      setAutoSendBudgetQuoteBilling(checked);
      toast.success(
        checked
          ? 'Cobrança automática de orçamentos ativada.'
          : 'Cobrança automática de orçamentos desativada.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSavingAutoSendBudgetQuoteBilling(false);
    }
  };

  const handleReminder24hChange = async (checked: boolean) => {
    if (!whatsappProfessionalId) return;
    setSavingReminder(true);
    try {
      await persistUiSettings({ appointmentReminder24hEnabled: checked });
      setAppointmentReminder24hEnabled(checked);
      toast.success(
        checked
          ? 'Lembrete automático 24h ativado para novos agendamentos.'
          : 'Lembrete automático 24h desativado.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSavingReminder(false);
    }
  };

  const reminder24hMessageDirty =
    appointmentReminder24hMessage.trim() !== savedAppointmentReminder24hMessage.trim();

  const reminder24hPreview = useMemo(() => {
    const base = buildAppointmentReminder24hPreview(appointmentReminder24hMessage, {
      nome: 'Maria Silva',
      procedimento: isSalonProfile ? 'Corte feminino' : 'Consulta',
      data: 'amanhã dia (14/08/2026)',
      hora: '10:30',
      profissional: isSalonProfile
        ? profile?.full_name?.trim() || 'Ana'
        : profile?.app_name?.trim() || profile?.full_name || 'Dra. Ana',
      nomeSalao: salonName,
      isSalon: isSalonProfile,
    });
    return applyPresenceConfirmation(
      base,
      presenceConfirmationMessage,
      appointmentPresenceConfirmation24hEnabled
    );
  }, [
    appointmentReminder24hMessage,
    appointmentPresenceConfirmation24hEnabled,
    presenceConfirmationMessage,
    isSalonProfile,
    salonName,
    profile?.app_name,
    profile?.full_name,
  ]);

  const handleSaveReminder24hMessage = async () => {
    if (!whatsappProfessionalId) return;
    const trimmed = appointmentReminder24hMessage.trim();
    setSavingReminderMessage(true);
    try {
      await persistUiSettings({ appointmentReminder24hMessage: trimmed || null });
      setSavedAppointmentReminder24hMessage(trimmed);
      setMessagesAccordionOpen((prev) => prev.filter((v) => v !== 'reminder-24h'));
      toast.success(
        trimmed
          ? 'Mensagem do lembrete 24h salva.'
          : 'Mensagem personalizada removida — será usada a mensagem padrão.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar a mensagem.');
    } finally {
      setSavingReminderMessage(false);
    }
  };

  const handleRestoreReminder24hMessage = () => {
    setAppointmentReminder24hMessage(DEFAULT_APPOINTMENT_REMINDER_24H_MESSAGE);
  };

  const handleReminder1hChange = async (checked: boolean) => {
    if (!whatsappProfessionalId) return;
    setSavingReminder1h(true);
    try {
      await persistUiSettings({ appointmentReminder1hEnabled: checked });
      setAppointmentReminder1hEnabled(checked);
      toast.success(
        checked
          ? `Lembrete automático de ${formatReminderNearHoursLabel(appointmentReminder1hHours)} ativado.`
          : 'Lembrete automático próximo desativado.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSavingReminder1h(false);
    }
  };

  const handleReminder1hHoursChange = async (raw: string) => {
    if (!whatsappProfessionalId) return;
    const hours = normalizeAppointmentReminder1hHours(raw);
    setAppointmentReminder1hHours(hours);
    setSavingReminder1hHours(true);
    try {
      await persistUiSettings({ appointmentReminder1hHours: hours });
      toast.success(
        `Lembrete será enviado cerca de ${formatReminderNearHoursLabel(hours)} antes da consulta.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar as horas.');
    } finally {
      setSavingReminder1hHours(false);
    }
  };

  const reminder1hMessageDirty =
    appointmentReminder1hMessage.trim() !== savedAppointmentReminder1hMessage.trim();

  const reminder1hPreview = useMemo(() => {
    const base = buildAppointmentReminder24hPreview(
      appointmentReminder1hMessage.trim() || DEFAULT_APPOINTMENT_REMINDER_1H_MESSAGE,
      {
        nome: 'Maria Silva',
        procedimento: isSalonProfile ? 'Corte feminino' : 'Consulta',
        data: '21/09/2026',
        hora: '14:00',
        profissional: isSalonProfile
          ? profile?.full_name?.trim() || 'Ana'
          : profile?.app_name?.trim() || profile?.full_name || 'Dra. Ana',
        nomeSalao: salonName,
        isSalon: isSalonProfile,
      }
    );
    return applyPresenceConfirmation(
      base,
      presenceConfirmationMessage,
      appointmentPresenceConfirmation1hEnabled
    );
  }, [
    appointmentReminder1hMessage,
    appointmentPresenceConfirmation1hEnabled,
    presenceConfirmationMessage,
    isSalonProfile,
    salonName,
    profile?.app_name,
    profile?.full_name,
  ]);

  const presenceConfirmationMessageDirty =
    presenceConfirmationMessage.trim() !== savedPresenceConfirmationMessage.trim();

  const resolvedPresencePrompt = useMemo(
    () => resolvePresenceConfirmationPrompt(presenceConfirmationMessage),
    [presenceConfirmationMessage]
  );

  const handleSavePresenceConfirmationMessage = async () => {
    if (!whatsappProfessionalId) return;
    const trimmed = presenceConfirmationMessage.trim();
    setSavingPresenceConfirmationMessage(true);
    try {
      await persistUiSettings({ appointmentPresenceConfirmationMessage: trimmed || null });
      setSavedPresenceConfirmationMessage(trimmed);
      toast.success(
        trimmed
          ? 'Texto de confirmação de presença salvo.'
          : 'Texto personalizado removido — será usado o padrão.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSavingPresenceConfirmationMessage(false);
    }
  };

  const handleRestorePresenceConfirmationMessage = () => {
    setPresenceConfirmationMessage(DEFAULT_PRESENCE_CONFIRMATION_PROMPT);
  };

  const handleSaveReminder1hMessage = async () => {
    if (!whatsappProfessionalId) return;
    const trimmed = appointmentReminder1hMessage.trim();
    setSavingReminder1hMessage(true);
    try {
      await persistUiSettings({ appointmentReminder1hMessage: trimmed || null });
      setSavedAppointmentReminder1hMessage(trimmed);
      setMessagesAccordionOpen((prev) => prev.filter((v) => v !== 'reminder-near'));
      toast.success(
        trimmed
          ? 'Mensagem do lembrete próximo salva.'
          : 'Mensagem personalizada removida — será usada a mensagem padrão.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar a mensagem.');
    } finally {
      setSavingReminder1hMessage(false);
    }
  };

  const handleRestoreReminder1hMessage = () => {
    setAppointmentReminder1hMessage(DEFAULT_APPOINTMENT_REMINDER_1H_MESSAGE);
  };

  const handlePresenceConfirmation24hChange = async (checked: boolean) => {
    if (!whatsappProfessionalId) return;
    setSavingPresenceConfirmation24h(true);
    try {
      await persistUiSettings({ appointmentPresenceConfirmation24hEnabled: checked });
      setAppointmentPresenceConfirmation24hEnabled(checked);
      toast.success(
        checked
          ? 'Confirmação de presença ativada no lembrete de 24h.'
          : 'Confirmação de presença desativada no lembrete de 24h — será enviado apenas o lembrete.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSavingPresenceConfirmation24h(false);
    }
  };

  const handlePresenceConfirmation1hChange = async (checked: boolean) => {
    if (!whatsappProfessionalId) return;
    setSavingPresenceConfirmation1h(true);
    try {
      await persistUiSettings({ appointmentPresenceConfirmationEnabled: checked });
      setAppointmentPresenceConfirmation1hEnabled(checked);
      toast.success(
        checked
          ? 'Confirmação de presença ativada no lembrete de 1h.'
          : 'Confirmação de presença desativada no lembrete de 1h — será enviado apenas o lembrete.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSavingPresenceConfirmation1h(false);
    }
  };

  if (!showWhatsappCard) {
    return (
      <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
        <div className="pb-4 border-b border-border">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Conta
          </p>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground tracking-tight">
            Secretária WhatsApp
          </h1>
        </div>
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            A integração WhatsApp está desabilitada para este perfil. Entre em contato com o suporte
            se precisar ativar.
          </CardContent>
        </Card>
      </div>
    );
  }

  const showBotoxBillingCard = showWhatsappBotoxBillingSection && isProgramaBotoxEnabled;
  const showOrcamentoBillingCard = isOrcamentoEnabled;
  const showBillingTab = showBotoxBillingCard || showOrcamentoBillingCard;
  const showBirthdayTab = showWhatsappBirthdaySection;
  const showPromotionsTab =
    showWhatsappPromotionsSection || showWhatsappPromotionHistorySection;

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div className="pb-4 border-b border-border">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
          Conta
        </p>
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground tracking-tight">
          Secretária WhatsApp
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Integração do WhatsApp e mensagens padrão (lembretes, aniversário e automações)
        </p>
      </div>

      <BrowserTabs defaultValue="integracao" className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <BrowserTabsList>
          <BrowserTabsTrigger value="integracao">
            <MessageCircle className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            Integração
          </BrowserTabsTrigger>
          <BrowserTabsTrigger value="mensagens">
            <MessageSquareText className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <span className="hidden sm:inline">Mensagens padrão</span>
            <span className="sm:hidden">Msgs</span>
          </BrowserTabsTrigger>
          {showBillingTab ? (
            <BrowserTabsTrigger value="cobranca">
              <Wallet className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              Cobrança
            </BrowserTabsTrigger>
          ) : null}
          <BrowserTabsTrigger value="duvidas">
            <CircleHelp className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <span className="hidden sm:inline">Dúvidas</span>
            <span className="sm:hidden">FAQ</span>
          </BrowserTabsTrigger>
          {showPromotionsTab ? (
            <BrowserTabsTrigger value="promocoes">
              <Megaphone className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              <span className="hidden sm:inline">Promoções</span>
              <span className="sm:hidden">Promo</span>
            </BrowserTabsTrigger>
          ) : null}
          <BrowserTabsTrigger value="numeros-bloqueados">
            <PhoneOff className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <span className="hidden sm:inline">Números bloqueados</span>
            <span className="sm:hidden">Bloq.</span>
          </BrowserTabsTrigger>
        </BrowserTabsList>

        <BrowserTabsContent value="integracao" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            WhatsApp (Evolution API)
          </CardTitle>
          <CardDescription>
            Conecte o número do profissional pelo QR Code. A instância é criada automaticamente no
            servidor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={cn(
              'flex items-center justify-between gap-3 rounded-xl border px-3 py-3',
              whatsappSecretaryEnabled
                ? 'border-primary/20 bg-primary/5 dark:bg-primary/10'
                : 'border-amber-200/80 bg-amber-50/60 dark:border-amber-800/60 dark:bg-amber-950/25'
            )}
          >
            <div className="flex min-w-0 items-start gap-2.5">
              {whatsappSecretaryEnabled ? (
                <Bot className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              ) : (
                <PauseCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
              )}
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium leading-snug">Secretária virtual</p>
                <p
                  className={cn(
                    'text-xs leading-relaxed',
                    whatsappSecretaryEnabled
                      ? 'text-muted-foreground'
                      : 'text-amber-900/90 dark:text-amber-100/90'
                  )}
                >
                  {whatsappSecretaryEnabled
                    ? `Responde agendamentos e consultas automaticamente quando o ${patientWord} manda mensagem.`
                    : (appointmentReminder1hEnabled && appointmentPresenceConfirmation1hEnabled) ||
                        (appointmentReminder24hEnabled && appointmentPresenceConfirmation24hEnabled)
                      ? 'Pausada — o menu e agendamentos automáticos ficam desligados. Lembretes automáticos continuam; confirmação de presença (1, 2 ou 3) após lembrete ainda funciona.'
                      : 'Pausada — o menu e agendamentos automáticos ficam desligados. Lembretes automáticos continuam.'}
                </p>
              </div>
            </div>
            <SettingsSwitch
              checked={whatsappSecretaryEnabled}
              disabled={savingSecretary}
              aria-label="Ativar secretária virtual"
              onChange={(checked) => void handleWhatsappSecretaryChange(checked)}
            />
          </div>

          <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-3 space-y-2">
            <div className="flex items-start gap-2.5">
              <Bot className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-medium leading-snug">Nome do bot</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Aparece na tela de Atendimento para diferenciar mensagens do bot e as suas.
                  Atual: <span className="font-medium text-foreground">{whatsappBotName}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={botNameDraft}
                onChange={(e) => setBotNameDraft(e.target.value)}
                placeholder="Secretária Virtual"
                maxLength={40}
                className="h-9"
              />
              <Button
                type="button"
                size="sm"
                className="shrink-0"
                disabled={
                  savingBotName ||
                  (botNameDraft.trim() || 'Secretária Virtual') === whatsappBotName
                }
                onClick={() => void handleSaveBotName()}
              >
                {savingBotName ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>

          <div
            className={cn(
              'flex items-center justify-between gap-3 rounded-xl border px-3 py-3',
              whatsappSendWarmupEnabled
                ? 'border-border/70 bg-background/70'
                : 'border-amber-200/80 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-950/20'
            )}
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <ShieldCheck
                className={cn(
                  'mt-0.5 h-5 w-5 shrink-0',
                  whatsappSendWarmupEnabled
                    ? 'text-primary'
                    : 'text-amber-700 dark:text-amber-300'
                )}
              />
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium leading-snug">Trava Anti-bloqueio</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                        title="Sobre a Trava Anti-bloqueio"
                        aria-label="Sobre a Trava Anti-bloqueio"
                      >
                        <CircleHelp className="h-3.5 w-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] p-3 z-[1400]" align="start">
                      <p className="text-sm font-semibold mb-1.5">Como funciona</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Vale só para disparos de promoções. Nos primeiros dias o limite é baixo
                        (ex.: 20/dia) e sobe com o tempo (50, 100, 250, 500, até 1000). Secretária,
                        lembretes e cobranças não entram na contagem. Isso reduz o risco de a Meta
                        bloquear o número por volume alto cedo demais.
                      </p>
                    </PopoverContent>
                  </Popover>
                </div>
                <p
                  className={cn(
                    'text-xs leading-relaxed',
                    whatsappSendWarmupEnabled
                      ? 'text-muted-foreground'
                      : 'text-amber-900/90 dark:text-amber-100/90'
                  )}
                >
                  {whatsappSendWarmupEnabled
                    ? 'Warm-up ativo só em promoções: o limite diário de disparos sobe gradualmente. Secretária, lembretes e cobranças não são limitados. Recomenda-se manter ativada.'
                    : 'Desativada — promoções não seguem o limite progressivo diário. Use com cautela.'}
                </p>
              </div>
            </div>
            <SettingsSwitch
              checked={whatsappSendWarmupEnabled}
              disabled={savingWarmup}
              aria-label="Ativar Trava Anti-bloqueio"
              onChange={(checked) => handleWhatsappSendWarmupChange(checked)}
            />
          </div>

          <div
            className={cn(
              'flex flex-col gap-3 rounded-xl border px-3 py-3 sm:flex-row sm:items-center sm:justify-between',
              (checkingStatus || loadingQr) && 'border-border/70 bg-muted/20',
              !checkingStatus &&
                !loadingQr &&
                whatsappConnected &&
                'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100',
              !checkingStatus &&
                !loadingQr &&
                !whatsappConnected &&
                'border-amber-200/80 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-950/20'
            )}
          >
            <div className="flex min-w-0 items-start gap-2.5">
              {checkingStatus || loadingQr ? (
                <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
              ) : whatsappConnected ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
              )}
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-medium leading-snug">
                  {checkingStatus
                    ? 'Verificando conexão...'
                    : loadingQr
                      ? 'Gerando QR Code...'
                      : whatsappConnected
                        ? 'WhatsApp conectado com sucesso'
                        : awaitingPairing
                          ? 'Aguardando leitura do QR Code'
                          : 'WhatsApp desconectado'}
                </p>
                <p
                  className={cn(
                    'text-xs leading-relaxed',
                    whatsappConnected && !checkingStatus && !loadingQr
                      ? 'text-emerald-800/80 dark:text-emerald-200/80'
                      : 'text-muted-foreground'
                  )}
                >
                  {checkingStatus
                    ? 'Consultando status da instância.'
                    : loadingQr
                      ? 'Preparando pareamento com o WhatsApp.'
                      : whatsappConnected
                        ? whatsappInstanceId
                          ? `Instância ${whatsappInstanceId} · pronto para enviar mensagens`
                          : 'Número pronto para enviar mensagens.'
                        : awaitingPairing
                          ? 'Abra WhatsApp → Aparelhos conectados → Conectar aparelho.'
                          : 'Conecte o número para ativar a secretária e os envios automáticos.'}
                </p>
              </div>
            </div>

            <TooltipProvider delayDuration={300}>
              {!checkingStatus && !loadingQr && whatsappConnected ? (
                <div className="flex w-full shrink-0 items-center gap-1.5 sm:w-auto sm:justify-end">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0 border-emerald-300/80 bg-white/80 dark:border-emerald-800 dark:bg-emerald-950/40"
                        onClick={() => void refreshConnectionStatus()}
                        disabled={checkingStatus}
                        aria-label="Atualizar status"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Atualizar status</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0 border-emerald-300/80 bg-white/80 text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-emerald-800 dark:bg-emerald-950/40"
                        onClick={handleDisconnectWhatsapp}
                        disabled={disconnectingQr}
                        aria-label="Desconectar WhatsApp"
                      >
                        {disconnectingQr ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Unplug className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Desconectar WhatsApp</TooltipContent>
                  </Tooltip>
                </div>
              ) : !checkingStatus && !loadingQr ? (
                <div className="flex w-full shrink-0 items-center gap-1.5 sm:w-auto sm:justify-end">
                  {!whatsappConnected ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 shrink-0 border-emerald-300/80 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
                          title="Como conectar"
                          aria-label="Como conectar o WhatsApp"
                        >
                          <CircleHelp className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] p-3 z-[1400]" align="end" side="top">
                        <p className="text-sm font-semibold text-foreground mb-1.5">Como conectar</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Toque em <span className="font-medium text-foreground">Conectar</span> para
                          abrir o QR Code. Se já escaneou antes, use o botão de atualizar para
                          verificar o status.
                        </p>
                      </PopoverContent>
                    </Popover>
                  ) : null}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0 bg-background/80"
                        onClick={() => void refreshConnectionStatus()}
                        aria-label="Verificar conexão"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Verificar conexão</TooltipContent>
                  </Tooltip>
                  {!whatsappConnected ? (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="h-10 min-w-0 flex-1 gap-1.5 sm:flex-initial sm:px-3"
                      onClick={() => void requestPairingQr()}
                      disabled={loadingQr}
                    >
                      <QrCode className="h-4 w-4" />
                      Conectar
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </TooltipProvider>
          </div>

          {whatsappConnected && !loadingQr ? (
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-800/60 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
              <p className="font-medium">Tudo certo com a conexão</p>
              <p className="mt-1 text-xs text-emerald-800/85 dark:text-emerald-200/85">
                A secretária, lembretes, cobranças e promoções usam este número. Não é necessário
                gerar QR Code novamente.
              </p>
            </div>
          ) : null}

          <Dialog
            open={qrDialogOpen}
            onOpenChange={(open) => {
              if (!open) closeQrDialog();
            }}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  Conectar WhatsApp
                </DialogTitle>
                <DialogDescription>
                  Use o QR Code ou, se o celular não conectar, use o código pelo número.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-1.5 rounded-lg border bg-muted/40 p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={connectMode === 'qr' ? 'default' : 'ghost'}
                  className="h-9 gap-1.5"
                  onClick={() => {
                    setConnectMode('qr');
                    if (!whatsappQr) void requestPairingQr();
                  }}
                >
                  <QrCode className="h-4 w-4" />
                  QR Code
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={connectMode === 'phone' ? 'default' : 'ghost'}
                  className="h-9 gap-1.5"
                  onClick={() => {
                    setConnectMode('phone');
                    setAwaitingPairing(true);
                  }}
                >
                  <Phone className="h-4 w-4" />
                  Por número
                </Button>
              </div>

              {connectMode === 'qr' ? (
                <>
                  <div className="flex flex-col items-center gap-3 py-1">
                    {loadingQr && !whatsappQr ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
                        <RefreshCw className="h-8 w-8 animate-spin" />
                        Gerando QR Code...
                      </div>
                    ) : whatsappQr ? (
                      <>
                        <div className="w-full max-w-[280px]">
                          <img
                            src={whatsappQr}
                            alt="QR Code Evolution API"
                            className="w-full h-auto rounded-lg border bg-white"
                          />
                        </div>
                        <p className="flex items-center justify-center gap-1.5 text-xs text-center text-muted-foreground">
                          {awaitingPairing ? (
                            <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                          ) : null}
                          Aguardando leitura… se falhar no celular, use Atualizar QR ou Por número.
                        </p>
                      </>
                    ) : (
                      <p className="py-8 text-sm text-muted-foreground text-center">
                        QR Code indisponível. Tente atualizar ou use Por número.
                      </p>
                    )}
                  </div>

                  <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => void requestPairingQr({ forceRestart: true })}
                      disabled={loadingQr}
                    >
                      {loadingQr ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Atualizando...
                        </>
                      ) : (
                        'Atualizar QR Code'
                      )}
                    </Button>
                    <Button type="button" variant="ghost" onClick={closeQrDialog}>
                      Cancelar
                    </Button>
                  </DialogFooter>
                </>
              ) : whatsappProfessionalId ? (
                <>
                  <WhatsappPairingByNumberPanel
                    professionalId={whatsappProfessionalId}
                    onConnected={() => {
                      setWhatsappConnected(true);
                      closeQrDialog();
                    }}
                  />
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={closeQrDialog}>
                      Cancelar
                    </Button>
                  </DialogFooter>
                </>
              ) : null}
            </DialogContent>
          </Dialog>

          <Dialog open={warmupDisableConfirmOpen} onOpenChange={setWarmupDisableConfirmOpen}>
            <DialogContent className="max-w-sm gap-0 p-6 text-center sm:rounded-2xl">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50">
                <ShieldAlert className="h-7 w-7 text-amber-700 dark:text-amber-300" strokeWidth={1.75} />
              </div>
              <DialogHeader className="space-y-2 text-center sm:text-center">
                <DialogTitle className="text-lg font-semibold">
                  Atenção: proteção do número
                </DialogTitle>
                <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                  Manter a Trava Anti-bloqueio ativada é importante para reduzir o risco de o seu
                  número ser banido pela Meta por enviar um volume alto em um número novo. Não há
                  garantia total, mas a trava ajuda a minimizar o risco. Deseja mesmo desativar?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-6 flex-col gap-2 sm:flex-row sm:justify-center">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-full sm:w-auto sm:min-w-[7.5rem]"
                  disabled={savingWarmup}
                  onClick={() => setWarmupDisableConfirmOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="w-full rounded-full bg-foreground text-background hover:bg-foreground/90 sm:w-auto sm:min-w-[7.5rem]"
                  disabled={savingWarmup}
                  onClick={() => void persistWhatsappSendWarmup(false)}
                >
                  {savingWarmup ? 'Salvando...' : 'Estou ciente'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
        </BrowserTabsContent>

          
        <BrowserTabsContent value="mensagens" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareText className="w-5 h-5" />
                Mensagens padrão
              </CardTitle>
              <CardDescription>
                Ative ou pause cada envio automático e personalize o texto. Campo vazio usa a
                mensagem padrão do sistema; use &quot;Restaurar padrão&quot; para voltar ao original.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
          <Accordion
            type="multiple"
            value={messagesAccordionOpen}
            onValueChange={setMessagesAccordionOpen}
            className="rounded-xl border border-border/70"
          >
            <AccordionItem value="reminder-24h" className="px-3">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2 text-left">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">Lembrete automático 24h</p>
                    <p className="text-xs text-muted-foreground font-normal leading-relaxed">
                      Enviado 24 horas antes da consulta agendada pela secretária.
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                      appointmentReminder24hEnabled
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {appointmentReminder24hEnabled ? 'Ativa' : 'Off'}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <p className="text-sm">Permitir envio desta mensagem</p>
                  <SettingsSwitch
                    checked={appointmentReminder24hEnabled}
                    disabled={savingReminder}
                    aria-label="Ativar lembrete 24h"
                    onChange={(checked) => void handleReminder24hChange(checked)}
                  />
                </div>

                {appointmentReminder24hEnabled ? (
                  <label
                    htmlFor="presence-confirmation-24h-checkbox"
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                      appointmentPresenceConfirmation24hEnabled
                        ? 'border-primary/20 bg-primary/5'
                        : 'border-border/60 bg-muted/10'
                    )}
                  >
                    <Checkbox
                      id="presence-confirmation-24h-checkbox"
                      checked={appointmentPresenceConfirmation24hEnabled}
                      disabled={savingPresenceConfirmation24h || savingReminder}
                      onCheckedChange={(checked) =>
                        void handlePresenceConfirmation24hChange(checked === true)
                      }
                      className="mt-0.5"
                    />
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium leading-snug">Confirmação de presença</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {appointmentPresenceConfirmation24hEnabled
                          ? `Envia lembrete e permite que o ${patientWord} confirme (*1*), reagende (*2*) ou cancele (*3*). Use a variável “Bloco de confirmação” no texto para escolher a posição; sem ela, o bloco vai ao final.`
                          : 'Desmarcado: envia somente a mensagem de lembrete, sem opções de confirmação.'}
                      </p>
                    </div>
                  </label>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="reminder-24h-message">Texto da mensagem</Label>
                  <div className="space-y-0">
                    <WhatsappMessageEditor
                      id="reminder-24h-message"
                      value={appointmentReminder24hMessage}
                      disabled={savingReminderMessage}
                      textareaRef={reminder24hTextareaRef}
                      insertRef={reminder24hInsertRef}
                      className={
                        appointmentPresenceConfirmation24hEnabled
                          ? 'rounded-b-none border-b-0'
                          : undefined
                      }
                      placeholder={
                        'Deixe em branco para usar a mensagem padrão:\n\n' +
                        DEFAULT_APPOINTMENT_REMINDER_24H_MESSAGE +
                        (appointmentPresenceConfirmation24hEnabled
                          ? `\n\n${resolvedPresencePrompt}`
                          : '')
                      }
                      onChange={(next) =>
                        setAppointmentReminder24hMessage(normalizeWhatsappMarkers(next))
                      }
                    />
                    {appointmentPresenceConfirmation24hEnabled ? (
                      <div className="space-y-2 rounded-b-xl border border-primary/25 bg-primary/5 px-3 py-2.5">
                        <Label
                          htmlFor="presence-confirmation-message-24h"
                          className="text-[11px] font-medium text-primary"
                        >
                          Confirmação de presença (editável — acrescentada no envio)
                        </Label>
                        <Textarea
                          id="presence-confirmation-message-24h"
                          rows={5}
                          value={presenceConfirmationMessage}
                          disabled={savingPresenceConfirmationMessage}
                          placeholder={
                            'Deixe em branco para usar o padrão:\n\n' +
                            DEFAULT_PRESENCE_CONFIRMATION_PROMPT
                          }
                          className="bg-background"
                          onChange={(e) => setPresenceConfirmationMessage(e.target.value)}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={
                              savingPresenceConfirmationMessage || !presenceConfirmationMessageDirty
                            }
                            onClick={() => void handleSavePresenceConfirmationMessage()}
                          >
                            {savingPresenceConfirmationMessage ? 'Salvando...' : 'Salvar confirmação'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={savingPresenceConfirmationMessage}
                            onClick={handleRestorePresenceConfirmationMessage}
                          >
                            Restaurar padrão
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <WhatsappPlaceholderChips
                    placeholders={reminderPlaceholderChips}
                    value={appointmentReminder24hMessage}
                    onChange={setAppointmentReminder24hMessage}
                    textareaRef={reminder24hTextareaRef}
                    insertRef={reminder24hInsertRef}
                    disabled={savingReminderMessage}
                    hint={reminderPlaceholderHint}
                    showSalonNomePlaceholder={isSalonProfile}
                  />
                </div>
                <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {appointmentReminder24hMessage.trim()
                      ? 'Prévia da sua mensagem'
                      : 'Prévia da mensagem padrão (enviada se o campo estiver vazio)'}
                  </p>
                  <WhatsappFormattedPreview text={reminder24hPreview} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingReminderMessage || !reminder24hMessageDirty}
                    onClick={() => void handleSaveReminder24hMessage()}
                  >
                    {savingReminderMessage ? 'Salvando...' : 'Salvar mensagem'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={savingReminderMessage}
                    onClick={handleRestoreReminder24hMessage}
                  >
                    Restaurar padrão
                  </Button>
                </div>

                {whatsappProfessionalId && appointmentReminder24hEnabled ? (
                  <Reminder24hStatusPanel
                    professionalId={whatsappProfessionalId}
                    enabled={appointmentReminder24hEnabled}
                    patientWord={patientWord}
                  />
                ) : null}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="reminder-near" className="px-3">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2 text-left">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">
                      Lembrete próximo (
                      {formatReminderNearHoursLabel(appointmentReminder1hHours)} antes)
                    </p>
                    <p className="text-xs text-muted-foreground font-normal leading-relaxed">
                      Enviado perto do horário da consulta (antecedência configurável).
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                      appointmentReminder1hEnabled
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {appointmentReminder1hEnabled ? 'Ativa' : 'Off'}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <p className="text-sm">Permitir envio desta mensagem</p>
                  <SettingsSwitch
                    checked={appointmentReminder1hEnabled}
                    disabled={savingReminder1h}
                    aria-label="Ativar lembrete próximo"
                    onChange={(checked) => void handleReminder1hChange(checked)}
                  />
                </div>

                {appointmentReminder1hEnabled ? (
                  <>
                    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                      <Label htmlFor="reminder-1h-hours">Enviar quantas horas antes?</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          id="reminder-1h-hours"
                          type="number"
                          min={APPOINTMENT_REMINDER_1H_HOURS_MIN}
                          max={APPOINTMENT_REMINDER_1H_HOURS_MAX}
                          step={1}
                          className="h-9 w-24"
                          value={appointmentReminder1hHours}
                          disabled={savingReminder1hHours || savingReminder1h}
                          onChange={(e) =>
                            setAppointmentReminder1hHours(
                              normalizeAppointmentReminder1hHours(e.target.value)
                            )
                          }
                          onBlur={(e) => void handleReminder1hHoursChange(e.target.value)}
                        />
                        <span className="text-xs text-muted-foreground">
                          horas antes (1 a 24). Salva ao sair do campo.
                        </span>
                      </div>
                    </div>

                    <label
                      htmlFor="presence-confirmation-1h-checkbox"
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                        appointmentPresenceConfirmation1hEnabled
                          ? 'border-primary/20 bg-primary/5'
                          : 'border-border/60 bg-muted/10'
                      )}
                    >
                      <Checkbox
                        id="presence-confirmation-1h-checkbox"
                        checked={appointmentPresenceConfirmation1hEnabled}
                        disabled={savingPresenceConfirmation1h || savingReminder1h}
                        onCheckedChange={(checked) =>
                          void handlePresenceConfirmation1hChange(checked === true)
                        }
                        className="mt-0.5"
                      />
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-medium leading-snug">Confirmação de presença</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {appointmentPresenceConfirmation1hEnabled
                            ? `Envia lembrete e permite que o ${patientWord} confirme (*1*), reagende (*2*) ou cancele (*3*). Use a variável “Bloco de confirmação” no texto para escolher a posição; sem ela, o bloco vai ao final.`
                          : 'Desmarcado: envia somente a mensagem de lembrete, sem opções de confirmação.'}
                        </p>
                      </div>
                    </label>

                    <div className="space-y-2">
                      <Label htmlFor="reminder-1h-message">Texto da mensagem</Label>
                      <div className="space-y-0">
                        <WhatsappMessageEditor
                          id="reminder-1h-message"
                          value={appointmentReminder1hMessage}
                          disabled={savingReminder1hMessage}
                          textareaRef={reminder1hTextareaRef}
                          insertRef={reminder1hInsertRef}
                          className={
                            appointmentPresenceConfirmation1hEnabled
                              ? 'rounded-b-none border-b-0'
                              : undefined
                          }
                          placeholder={
                            'Deixe em branco para usar a mensagem padrão:\n\n' +
                            DEFAULT_APPOINTMENT_REMINDER_1H_MESSAGE +
                            (appointmentPresenceConfirmation1hEnabled
                              ? `\n\n${resolvedPresencePrompt}`
                              : '')
                          }
                          onChange={(next) =>
                            setAppointmentReminder1hMessage(normalizeWhatsappMarkers(next))
                          }
                        />
                        {appointmentPresenceConfirmation1hEnabled ? (
                          <div className="space-y-2 rounded-b-xl border border-primary/25 bg-primary/5 px-3 py-2.5">
                            <Label
                              htmlFor="presence-confirmation-message-1h"
                              className="text-[11px] font-medium text-primary"
                            >
                              Confirmação de presença (editável — acrescentada no envio)
                            </Label>
                            <Textarea
                              id="presence-confirmation-message-1h"
                              rows={5}
                              value={presenceConfirmationMessage}
                              disabled={savingPresenceConfirmationMessage}
                              placeholder={
                                'Deixe em branco para usar o padrão:\n\n' +
                                DEFAULT_PRESENCE_CONFIRMATION_PROMPT
                              }
                              className="bg-background"
                              onChange={(e) => setPresenceConfirmationMessage(e.target.value)}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={
                                  savingPresenceConfirmationMessage ||
                                  !presenceConfirmationMessageDirty
                                }
                                onClick={() => void handleSavePresenceConfirmationMessage()}
                              >
                                {savingPresenceConfirmationMessage
                                  ? 'Salvando...'
                                  : 'Salvar confirmação'}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={savingPresenceConfirmationMessage}
                                onClick={handleRestorePresenceConfirmationMessage}
                              >
                                Restaurar padrão
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <WhatsappPlaceholderChips
                        placeholders={reminderPlaceholderChips}
                        value={appointmentReminder1hMessage}
                        onChange={setAppointmentReminder1hMessage}
                        textareaRef={reminder1hTextareaRef}
                        insertRef={reminder1hInsertRef}
                        disabled={savingReminder1hMessage}
                        hint={reminderPlaceholderHint}
                        showSalonNomePlaceholder={isSalonProfile}
                      />
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {appointmentReminder1hMessage.trim()
                          ? 'Prévia da sua mensagem'
                          : 'Prévia da mensagem padrão (enviada se o campo estiver vazio)'}
                      </p>
                      <WhatsappFormattedPreview text={reminder1hPreview} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingReminder1hMessage || !reminder1hMessageDirty}
                        onClick={() => void handleSaveReminder1hMessage()}
                      >
                        {savingReminder1hMessage ? 'Salvando...' : 'Salvar mensagem'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={savingReminder1hMessage}
                        onClick={handleRestoreReminder1hMessage}
                      >
                        Restaurar padrão
                      </Button>
                    </div>
                  </>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
            </CardContent>
          </Card>
          <WhatsappManualMessagesSection />
          {showBirthdayTab ? <BirthdayWhatsappSection /> : null}
        </BrowserTabsContent>

          {showBillingTab ? (
          <BrowserTabsContent value="cobranca" className="space-y-4">
            {showBotoxBillingCard ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Cobrança — Programa de Botox
                </CardTitle>
                <CardDescription>
                  Mensagens automáticas de mensalidade pelo WhatsApp conectado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/70 px-3 py-2">
                  <div className="space-y-0.5 pr-3 min-w-0">
                    <p className="text-sm font-medium">Cobrança automática por WhatsApp</p>
                    <p className="text-xs text-muted-foreground">
                      No dia de vencimento de cada paciente, envia a mensagem pelo WhatsApp conectado
                      (Evolution API), se a mensalidade do mês ainda estiver pendente.
                    </p>
                  </div>
                  <SettingsSwitch
                    checked={autoSendProgramaBotoxBilling}
                    disabled={savingAutoSendProgramaBotoxBilling}
                    aria-label="Ativar cobrança automática por WhatsApp"
                    onChange={(checked) => void handleAutoSendProgramaBotoxBillingChange(checked)}
                  />
                </div>

                <div className="rounded-xl border border-dashed border-border/70 bg-background/50 px-3 py-3 text-xs text-muted-foreground space-y-1">
                  <p className="text-sm font-medium text-foreground">Cobrança PIX aos pendentes</p>
                  <p>
                    Use o botão na lista abaixo. O sistema calcula os meses em atraso, multiplica pelo
                    valor da mensalidade, monta a mensagem e envia o QR Code PIX pelo WhatsApp conectado.
                  </p>
                  <p>É necessário ter a chave PIX cadastrada em Cobrança e o WhatsApp conectado.</p>
                </div>

                <WhatsappBotoxBillingPatientsSection />
              </CardContent>
            </Card>
            ) : null}

            {showOrcamentoBillingCard ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Cobrança — Orçamentos
                </CardTitle>
                <CardDescription>
                  Parcelas de orçamentos aceitos pelo WhatsApp conectado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/70 px-3 py-2">
                  <div className="space-y-0.5 pr-3 min-w-0">
                    <p className="text-sm font-medium">Cobrança automática por WhatsApp</p>
                    <p className="text-xs text-muted-foreground">
                      No dia de vencimento escolhido pelo paciente, envia o QR Code PIX pelo WhatsApp
                      conectado se houver parcela do mês ainda pendente.
                    </p>
                  </div>
                  <SettingsSwitch
                    checked={autoSendBudgetQuoteBilling}
                    disabled={savingAutoSendBudgetQuoteBilling}
                    aria-label="Ativar cobrança automática de orçamentos por WhatsApp"
                    onChange={(checked) => void handleAutoSendBudgetQuoteBillingChange(checked)}
                  />
                </div>

                <div className="rounded-xl border border-dashed border-border/70 bg-background/50 px-3 py-3 text-xs text-muted-foreground space-y-1">
                  <p className="text-sm font-medium text-foreground">Cobrança PIX aos pendentes</p>
                  <p>
                    Use o botão na lista abaixo. O sistema soma as parcelas em atraso do orçamento
                    aceito, monta a mensagem e envia o QR Code PIX pelo WhatsApp conectado.
                  </p>
                  <p>É necessário ter a chave PIX cadastrada em Cobrança e o WhatsApp conectado.</p>
                </div>

                <WhatsappBudgetQuoteBillingSection />
              </CardContent>
            </Card>
            ) : null}
          </BrowserTabsContent>
        ) : null}


        <BrowserTabsContent value="duvidas" className="space-y-4">
          <WhatsappFaqSection />
        </BrowserTabsContent>

        {showPromotionsTab ? (
          <BrowserTabsContent value="promocoes" className="space-y-4">
            <WhatsappPromotionSection
              showPromotions={showWhatsappPromotionsSection}
              showHistory={showWhatsappPromotionHistorySection}
            />
          </BrowserTabsContent>
        ) : null}

        <BrowserTabsContent value="numeros-bloqueados" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PhoneOff className="w-5 h-5" />
                Números bloqueados
              </CardTitle>
              <CardDescription>
                Números que a secretária virtual não deve responder automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isClinicAccount && branchLoading ? (
                <p className="text-xs text-muted-foreground">Carregando filial...</p>
              ) : (
                <WhatsappIgnoredNumbersSection
                  professionalId={whatsappProfessionalId}
                  branchId={isClinicAccount ? whatsappBranchId : undefined}
                />
              )}
            </CardContent>
          </Card>
        </BrowserTabsContent>
      </BrowserTabs>
    </div>
  );
}
