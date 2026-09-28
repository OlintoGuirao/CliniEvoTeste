import { supabase } from '@/integrations/supabase/client';

import type { Database } from '@/integrations/supabase/types';
import { normalizeAgendaOpenMode, type AgendaOpenMode } from '@/lib/agendaPreferences';
import { normalizeIgnoredPhoneList } from '@/lib/whatsappIgnoredPhones';
import {
  normalizeWhatsappManualTemplates,
  type WhatsappManualTemplatesMap,
} from '@/lib/whatsappManualTemplates';
import { normalizeAppointmentReminder1hHours } from '@/lib/appointmentReminder1h';

export type ProcedureFieldRow = Database['public']['Tables']['procedure_fields']['Row'];

export type ProcedureFieldSettingsPayload = Array<{
  procedure_field_id: string;
  is_active: boolean;
  is_required: boolean;
  sort_order: number;
}>;

export type ProcedureFieldWithSettings = ProcedureFieldRow & {
  is_active: boolean;
  is_required: boolean;
  sort_order: number;
};

export type VacationPeriod = {
  id: string;
  start_date: string;
  end_date: string;
  message: string | null;
};

export type ClinicClosedDay = {
  id: string;
  closed_date: string;
  note: string | null;
};

export async function fetchProcedureFieldSettings(params: {
  professionalId: string;
  procedureId: string;
}): Promise<ProcedureFieldWithSettings[]> {
  const { professionalId, procedureId } = params;

  const [{ data: fields }, settingsRes] = await Promise.all([
    supabase.from('procedure_fields').select('*').eq('procedure_id', procedureId).order('sort_order'),
    (supabase as any)
      .from('professional_procedure_field_settings')
      .select('procedure_field_id, is_active, is_required, sort_order')
      .eq('professional_id', professionalId)
      .eq('procedure_id', procedureId),
  ]);

  const settingsData = (settingsRes?.data ?? []) as Array<{
    procedure_field_id: string;
    is_active: boolean;
    is_required: boolean;
    sort_order: number;
  }>;

  const settingsByFieldId = new Map<string, (typeof settingsData)[number]>();
  for (const s of settingsData) settingsByFieldId.set(String(s.procedure_field_id), s);

  const list = (fields ?? []) as ProcedureFieldRow[];
  return list.map((f) => {
    const cfg = settingsByFieldId.get(String(f.id));
    return {
      ...f,
      is_active: cfg?.is_active ?? true,
      is_required: cfg?.is_required ?? false,
      sort_order: cfg?.sort_order ?? f.sort_order,
    };
  });
}

export async function upsertProcedureFieldSettings(params: {
  professionalId: string;
  procedureId: string;
  fields: ProcedureFieldSettingsPayload;
}): Promise<void> {
  const { professionalId, procedureId, fields } = params;

  const rows = fields.map((f) => ({
    professional_id: professionalId,
    procedure_id: procedureId,
    procedure_field_id: f.procedure_field_id,
    is_active: f.is_active,
    is_required: f.is_required,
    sort_order: f.sort_order,
  }));

  const { error } = await (supabase as any).from('professional_procedure_field_settings').upsert(rows, {
    onConflict: 'professional_id,procedure_field_id',
  });

  if (error) throw new Error(error.message);
}

export async function fetchProfessionalUiSettings(params: {
  professionalId: string;
}): Promise<{
  show_session_photos: boolean;
  show_whatsapp_ultramsg: boolean;
  agenda_open_mode: AgendaOpenMode;
  use_max_weight_reference: boolean;
  programa_botox_view_mode: 'padrao' | 'planilha';
  show_session_timeline: boolean;
  show_occupied_slot_encaixe: boolean;
  /** Cor Hex dos bloqueios manuais (pin) na agenda. Null = cinza padrão. */
  agenda_slot_block_color: string | null;
  show_dashboard_birthdays: boolean;
  show_dashboard_future_clients: boolean;
  show_dashboard_botox_reminders: boolean;
  auto_send_programa_botox_billing: boolean;
  auto_send_budget_quote_billing: boolean;
  whatsapp_secretary_enabled: boolean;
  appointment_reminder_24h_enabled: boolean;
  appointment_reminder_1h_enabled: boolean;
  appointment_reminder_1h_hours: number;
  appointment_presence_confirmation_enabled: boolean;
  appointment_presence_confirmation_24h_enabled: boolean;
  whatsapp_send_warmup_enabled: boolean;
  whatsapp_send_warmup_started_at: string | null;
  whatsapp_bot_name: string;
  birthday_whatsapp_enabled: boolean;
  birthday_whatsapp_message: string | null;
  appointment_reminder_24h_message: string | null;
  appointment_reminder_1h_message: string | null;
  appointment_presence_confirmation_message: string | null;
  whatsapp_message_templates: WhatsappManualTemplatesMap;
  whatsapp_ignored_phones: string[];
  show_whatsapp_botox_billing_section: boolean;
  show_whatsapp_birthday_section: boolean;
  show_whatsapp_promotions_section: boolean;
  show_whatsapp_promotion_history_section: boolean;
  show_before_after_gallery: boolean;
  show_next_evaluation_section: boolean;
  vacation_start_date: string | null;
  vacation_end_date: string | null;
  vacation_message: string | null;
  vacation_periods: VacationPeriod[];
  clinic_closed_days: ClinicClosedDay[];
}> {
  const { professionalId } = params;
  const { data, error } = await (supabase as any)
    .from('professional_ui_settings')
    .select('*')
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  let vacationPeriods: VacationPeriod[] = [];
  const periodsRes = await (supabase as any)
    .from('professional_vacation_periods')
    .select('id, start_date, end_date, message')
    .eq('professional_id', professionalId)
    .order('start_date', { ascending: true })
    .order('end_date', { ascending: true });

  if (!periodsRes.error) {
    vacationPeriods = ((periodsRes.data ?? []) as VacationPeriod[]).map((p) => ({
      id: String(p.id),
      start_date: String(p.start_date),
      end_date: String(p.end_date),
      message: p.message?.trim() || null,
    }));
  }

  const firstPeriod = vacationPeriods[0];

  let clinicClosedDays: ClinicClosedDay[] = [];
  const closedDaysRes = await (supabase as any)
    .from('professional_clinic_closed_days')
    .select('id, closed_date, note')
    .eq('professional_id', professionalId)
    .order('closed_date', { ascending: true });

  if (!closedDaysRes.error) {
    clinicClosedDays = ((closedDaysRes.data ?? []) as ClinicClosedDay[]).map((item) => ({
      id: String(item.id),
      closed_date: String(item.closed_date),
      note: item.note?.trim() || null,
    }));
  }

  return {
    show_session_photos: data?.show_session_photos ?? true,
    show_whatsapp_ultramsg: data?.show_whatsapp_ultramsg ?? true,
    agenda_open_mode: normalizeAgendaOpenMode(data?.agenda_open_mode),
    use_max_weight_reference: data?.use_max_weight_reference ?? false,
    programa_botox_view_mode: data?.programa_botox_view_mode === 'planilha' ? 'planilha' : 'padrao',
    show_session_timeline: data?.show_session_timeline ?? false,
    show_occupied_slot_encaixe: data?.show_occupied_slot_encaixe ?? true,
    agenda_slot_block_color: (() => {
      const raw = data?.agenda_slot_block_color;
      if (typeof raw !== 'string') return null;
      const trimmed = raw.trim();
      if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed.toLowerCase();
      if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`;
      return null;
    })(),
    show_dashboard_birthdays: data?.show_dashboard_birthdays ?? true,
    show_dashboard_future_clients: data?.show_dashboard_future_clients ?? true,
    show_dashboard_botox_reminders: data?.show_dashboard_botox_reminders ?? true,
    auto_send_programa_botox_billing: data?.auto_send_programa_botox_billing ?? false,
    auto_send_budget_quote_billing: data?.auto_send_budget_quote_billing ?? false,
    whatsapp_secretary_enabled: data?.whatsapp_secretary_enabled ?? false,
    appointment_reminder_24h_enabled: data?.appointment_reminder_24h_enabled ?? true,
    appointment_reminder_1h_enabled: data?.appointment_reminder_1h_enabled ?? true,
    appointment_reminder_1h_hours: normalizeAppointmentReminder1hHours(
      data?.appointment_reminder_1h_hours
    ),
    appointment_presence_confirmation_enabled:
      data?.appointment_presence_confirmation_enabled ?? true,
    appointment_presence_confirmation_24h_enabled:
      data?.appointment_presence_confirmation_24h_enabled ?? false,
    whatsapp_send_warmup_enabled: data?.whatsapp_send_warmup_enabled ?? true,
    whatsapp_send_warmup_started_at: data?.whatsapp_send_warmup_started_at
      ? String(data.whatsapp_send_warmup_started_at)
      : null,
    whatsapp_bot_name: String(data?.whatsapp_bot_name || '').trim() || 'Secretária Virtual',
    birthday_whatsapp_enabled: data?.birthday_whatsapp_enabled ?? false,
    birthday_whatsapp_message: data?.birthday_whatsapp_message?.trim() || null,
    appointment_reminder_24h_message: data?.appointment_reminder_24h_message?.trim() || null,
    appointment_reminder_1h_message: data?.appointment_reminder_1h_message?.trim() || null,
    appointment_presence_confirmation_message:
      data?.appointment_presence_confirmation_message?.trim() || null,
    whatsapp_message_templates: normalizeWhatsappManualTemplates(data?.whatsapp_message_templates),
    whatsapp_ignored_phones: Array.isArray(data?.whatsapp_ignored_phones)
      ? (data.whatsapp_ignored_phones as string[])
      : [],
    show_whatsapp_botox_billing_section: data?.show_whatsapp_botox_billing_section ?? true,
    show_whatsapp_birthday_section: data?.show_whatsapp_birthday_section ?? true,
    show_whatsapp_promotions_section: data?.show_whatsapp_promotions_section ?? true,
    show_whatsapp_promotion_history_section: data?.show_whatsapp_promotion_history_section ?? true,
    show_before_after_gallery: data?.show_before_after_gallery ?? true,
    show_next_evaluation_section: data?.show_next_evaluation_section ?? true,
    vacation_start_date: firstPeriod?.start_date ?? data?.vacation_start_date ?? null,
    vacation_end_date: firstPeriod?.end_date ?? data?.vacation_end_date ?? null,
    vacation_message: firstPeriod?.message ?? (data?.vacation_message?.trim() || null),
    vacation_periods: vacationPeriods,
    clinic_closed_days: clinicClosedDays,
  };
}

export async function replaceProfessionalVacationPeriods(params: {
  professionalId: string;
  periods: Array<{ startDate: string; endDate: string; message?: string | null }>;
}): Promise<void> {
  const { professionalId, periods } = params;

  const { error: deleteError } = await (supabase as any)
    .from('professional_vacation_periods')
    .delete()
    .eq('professional_id', professionalId);
  if (deleteError) throw new Error(deleteError.message);

  if (periods.length === 0) return;

  const rows = periods.map((p) => ({
    professional_id: professionalId,
    start_date: p.startDate,
    end_date: p.endDate,
    message: p.message?.trim() || 'Férias',
  }));

  const { error: insertError } = await (supabase as any)
    .from('professional_vacation_periods')
    .insert(rows);
  if (insertError) throw new Error(insertError.message);
}

export async function replaceProfessionalClinicClosedDays(params: {
  professionalId: string;
  days: Array<{ closedDate: string; note?: string | null }>;
}): Promise<void> {
  const { professionalId, days } = params;

  const { error: deleteError } = await (supabase as any)
    .from('professional_clinic_closed_days')
    .delete()
    .eq('professional_id', professionalId);
  if (deleteError) throw new Error(deleteError.message);

  if (days.length === 0) return;

  const rows = days.map((day) => ({
    professional_id: professionalId,
    closed_date: day.closedDate,
    note: day.note?.trim() || 'Agenda pessoal',
  }));

  const { error: insertError } = await (supabase as any)
    .from('professional_clinic_closed_days')
    .insert(rows);
  if (insertError) throw new Error(insertError.message);
}

export async function upsertProfessionalUiSettings(params: {
  professionalId: string;
  showSessionPhotos: boolean;
  showWhatsappUltraMsg: boolean;
  /** Se omitido, mantém o valor atual no banco (útil no painel admin). */
  agendaOpenMode?: AgendaOpenMode;
  /** Se omitido, mantém o valor atual no banco. */
  useMaxWeightReference?: boolean;
  /** Se omitido, mantém o valor atual no banco. */
  programaBotoxViewMode?: 'padrao' | 'planilha';
  /** Se omitido, mantém o valor atual no banco. */
  showSessionTimeline?: boolean;
  /** Se omitido, mantém o valor atual no banco. */
  showOccupiedSlotEncaixe?: boolean;
  /** Se omitido, mantém o valor atual no banco. Cor dos bloqueios manuais (pin). */
  agendaSlotBlockColor?: string | null;
  showDashboardBirthdays?: boolean;
  showDashboardFutureClients?: boolean;
  showDashboardBotoxReminders?: boolean;
  /** Se omitido, mantém o valor atual no banco. */
  autoSendProgramaBotoxBilling?: boolean;
  /** Se omitido, mantém o valor atual no banco. */
  autoSendBudgetQuoteBilling?: boolean;
  /** Se omitido, mantém o valor atual no banco. */
  whatsappSecretaryEnabled?: boolean;
  /** Se omitido, mantém o valor atual no banco. */
  appointmentReminder24hEnabled?: boolean;
  /** Se omitido, mantém o valor atual no banco. */
  appointmentReminder1hEnabled?: boolean;
  /** Se omitido, mantém o valor atual no banco. Antecedência em horas (1–24). */
  appointmentReminder1hHours?: number;
  /** Se omitido, mantém o valor atual no banco. */
  appointmentPresenceConfirmationEnabled?: boolean;
  /** Se omitido, mantém o valor atual no banco. Confirmação no lembrete de 24h. */
  appointmentPresenceConfirmation24hEnabled?: boolean;
  /** Se omitido, mantém o valor atual no banco. */
  whatsappSendWarmupEnabled?: boolean;
  /** Se omitido, mantém o valor atual no banco. */
  whatsappBotName?: string;
  /** Se omitido, mantém o valor atual no banco. */
  birthdayWhatsappEnabled?: boolean;
  /** Se omitido, mantém o valor atual no banco. */
  birthdayWhatsappMessage?: string | null;
  /** Se omitido, mantém o valor atual no banco. Null/vazio = mensagem padrão do lembrete 24h. */
  appointmentReminder24hMessage?: string | null;
  /** Se omitido, mantém o valor atual no banco. Null/vazio = mensagem padrão do lembrete próximo. */
  appointmentReminder1hMessage?: string | null;
  /** Se omitido, mantém o valor atual no banco. Null/vazio = bloco padrão de confirmação 1/2. */
  appointmentPresenceConfirmationMessage?: string | null;
  /** Se omitido, mantém o valor atual no banco. */
  whatsappMessageTemplates?: WhatsappManualTemplatesMap;
  /** Se omitido, mantém o valor atual no banco. */
  vacationStartDate?: string | null;
  /** Se omitido, mantém o valor atual no banco. */
  vacationEndDate?: string | null;
  /** Se omitido, mantém o valor atual no banco. */
  vacationMessage?: string | null;
  /** Se omitido, mantém o valor atual no banco. */
  whatsappIgnoredPhones?: string[];
  /** Se omitido, mantém o valor atual no banco. */
  showWhatsappBotoxBillingSection?: boolean;
  /** Se omitido, mantém o valor atual no banco. */
  showWhatsappBirthdaySection?: boolean;
  /** Se omitido, mantém o valor atual no banco. */
  showWhatsappPromotionsSection?: boolean;
  /** Se omitido, mantém o valor atual no banco. */
  showWhatsappPromotionHistorySection?: boolean;
  /** Se omitido, mantém o valor atual no banco. */
  showBeforeAfterGallery?: boolean;
  /** Se omitido, mantém o valor atual no banco. */
  showNextEvaluationSection?: boolean;
}): Promise<void> {
  const { professionalId, showSessionPhotos, showWhatsappUltraMsg } = params;
  let agendaOpenMode = params.agendaOpenMode;
  let useMaxWeightReference = params.useMaxWeightReference;
  let programaBotoxViewMode = params.programaBotoxViewMode;
  let showSessionTimeline = params.showSessionTimeline;
  let showOccupiedSlotEncaixe = params.showOccupiedSlotEncaixe;
  let agendaSlotBlockColor = params.agendaSlotBlockColor;
  let showDashboardBirthdays = params.showDashboardBirthdays;
  let showDashboardFutureClients = params.showDashboardFutureClients;
  let showDashboardBotoxReminders = params.showDashboardBotoxReminders;
  let autoSendProgramaBotoxBilling = params.autoSendProgramaBotoxBilling;
  let autoSendBudgetQuoteBilling = params.autoSendBudgetQuoteBilling;
  let whatsappSecretaryEnabled = params.whatsappSecretaryEnabled;
  let appointmentReminder24hEnabled = params.appointmentReminder24hEnabled;
  let appointmentReminder1hEnabled = params.appointmentReminder1hEnabled;
  let appointmentReminder1hHours = params.appointmentReminder1hHours;
  let appointmentPresenceConfirmationEnabled = params.appointmentPresenceConfirmationEnabled;
  let appointmentPresenceConfirmation24hEnabled = params.appointmentPresenceConfirmation24hEnabled;
  let whatsappSendWarmupEnabled = params.whatsappSendWarmupEnabled;
  let whatsappBotName = params.whatsappBotName;
  let birthdayWhatsappEnabled = params.birthdayWhatsappEnabled;
  let birthdayWhatsappMessage = params.birthdayWhatsappMessage;
  let appointmentReminder24hMessage = params.appointmentReminder24hMessage;
  let appointmentReminder1hMessage = params.appointmentReminder1hMessage;
  let appointmentPresenceConfirmationMessage = params.appointmentPresenceConfirmationMessage;
  let whatsappMessageTemplates = params.whatsappMessageTemplates;
  let vacationStartDate = params.vacationStartDate;
  let vacationEndDate = params.vacationEndDate;
  let vacationMessage = params.vacationMessage;
  let whatsappIgnoredPhones = params.whatsappIgnoredPhones;
  let showWhatsappBotoxBillingSection = params.showWhatsappBotoxBillingSection;
  let showWhatsappBirthdaySection = params.showWhatsappBirthdaySection;
  let showWhatsappPromotionsSection = params.showWhatsappPromotionsSection;
  let showWhatsappPromotionHistorySection = params.showWhatsappPromotionHistorySection;
  let showBeforeAfterGallery = params.showBeforeAfterGallery;
  let showNextEvaluationSection = params.showNextEvaluationSection;
  if (
    agendaOpenMode === undefined ||
    useMaxWeightReference === undefined ||
    programaBotoxViewMode === undefined ||
    showSessionTimeline === undefined ||
    showOccupiedSlotEncaixe === undefined ||
    agendaSlotBlockColor === undefined ||
    showDashboardBirthdays === undefined ||
    showDashboardFutureClients === undefined ||
    showDashboardBotoxReminders === undefined ||
    autoSendProgramaBotoxBilling === undefined ||
    autoSendBudgetQuoteBilling === undefined ||
    whatsappSecretaryEnabled === undefined ||
    appointmentReminder24hEnabled === undefined ||
    appointmentReminder1hEnabled === undefined ||
    appointmentReminder1hHours === undefined ||
    appointmentPresenceConfirmationEnabled === undefined ||
    appointmentPresenceConfirmation24hEnabled === undefined ||
    whatsappSendWarmupEnabled === undefined ||
    whatsappBotName === undefined ||
    birthdayWhatsappEnabled === undefined ||
    birthdayWhatsappMessage === undefined ||
    appointmentReminder24hMessage === undefined ||
    appointmentReminder1hMessage === undefined ||
    appointmentPresenceConfirmationMessage === undefined ||
    whatsappMessageTemplates === undefined ||
    vacationStartDate === undefined ||
    vacationEndDate === undefined ||
    vacationMessage === undefined ||
    whatsappIgnoredPhones === undefined ||
    showWhatsappBotoxBillingSection === undefined ||
    showWhatsappBirthdaySection === undefined ||
    showWhatsappPromotionsSection === undefined ||
    showWhatsappPromotionHistorySection === undefined ||
    showBeforeAfterGallery === undefined ||
    showNextEvaluationSection === undefined
  ) {
    const cur = await fetchProfessionalUiSettings({ professionalId });
    if (agendaOpenMode === undefined) agendaOpenMode = cur.agenda_open_mode;
    if (useMaxWeightReference === undefined) useMaxWeightReference = cur.use_max_weight_reference;
    if (programaBotoxViewMode === undefined) programaBotoxViewMode = cur.programa_botox_view_mode;
    if (showSessionTimeline === undefined) showSessionTimeline = cur.show_session_timeline;
    if (showOccupiedSlotEncaixe === undefined) showOccupiedSlotEncaixe = cur.show_occupied_slot_encaixe;
    if (agendaSlotBlockColor === undefined) agendaSlotBlockColor = cur.agenda_slot_block_color;
    if (showDashboardBirthdays === undefined) showDashboardBirthdays = cur.show_dashboard_birthdays;
    if (showDashboardFutureClients === undefined) showDashboardFutureClients = cur.show_dashboard_future_clients;
    if (showDashboardBotoxReminders === undefined) showDashboardBotoxReminders = cur.show_dashboard_botox_reminders;
    if (autoSendProgramaBotoxBilling === undefined) {
      autoSendProgramaBotoxBilling = cur.auto_send_programa_botox_billing;
    }
    if (autoSendBudgetQuoteBilling === undefined) {
      autoSendBudgetQuoteBilling = cur.auto_send_budget_quote_billing;
    }
    if (whatsappSecretaryEnabled === undefined) {
      whatsappSecretaryEnabled = cur.whatsapp_secretary_enabled;
    }
    if (appointmentReminder24hEnabled === undefined) {
      appointmentReminder24hEnabled = cur.appointment_reminder_24h_enabled;
    }
    if (appointmentReminder1hEnabled === undefined) {
      appointmentReminder1hEnabled = cur.appointment_reminder_1h_enabled;
    }
    if (appointmentReminder1hHours === undefined) {
      appointmentReminder1hHours = cur.appointment_reminder_1h_hours;
    }
    if (appointmentPresenceConfirmationEnabled === undefined) {
      appointmentPresenceConfirmationEnabled = cur.appointment_presence_confirmation_enabled;
    }
    if (appointmentPresenceConfirmation24hEnabled === undefined) {
      appointmentPresenceConfirmation24hEnabled = cur.appointment_presence_confirmation_24h_enabled;
    }
    if (whatsappSendWarmupEnabled === undefined) {
      whatsappSendWarmupEnabled = cur.whatsapp_send_warmup_enabled;
    }
    if (whatsappBotName === undefined) {
      whatsappBotName = cur.whatsapp_bot_name;
    }
    if (birthdayWhatsappEnabled === undefined) {
      birthdayWhatsappEnabled = cur.birthday_whatsapp_enabled;
    }
    if (birthdayWhatsappMessage === undefined) {
      birthdayWhatsappMessage = cur.birthday_whatsapp_message;
    }
    if (appointmentReminder24hMessage === undefined) {
      appointmentReminder24hMessage = cur.appointment_reminder_24h_message;
    }
    if (appointmentReminder1hMessage === undefined) {
      appointmentReminder1hMessage = cur.appointment_reminder_1h_message;
    }
    if (appointmentPresenceConfirmationMessage === undefined) {
      appointmentPresenceConfirmationMessage = cur.appointment_presence_confirmation_message;
    }
    if (whatsappMessageTemplates === undefined) {
      whatsappMessageTemplates = cur.whatsapp_message_templates;
    }
    if (vacationStartDate === undefined) vacationStartDate = cur.vacation_start_date;
    if (vacationEndDate === undefined) vacationEndDate = cur.vacation_end_date;
    if (vacationMessage === undefined) vacationMessage = cur.vacation_message;
    if (whatsappIgnoredPhones === undefined) whatsappIgnoredPhones = cur.whatsapp_ignored_phones;
    if (showWhatsappBotoxBillingSection === undefined) {
      showWhatsappBotoxBillingSection = cur.show_whatsapp_botox_billing_section;
    }
    if (showWhatsappBirthdaySection === undefined) {
      showWhatsappBirthdaySection = cur.show_whatsapp_birthday_section;
    }
    if (showWhatsappPromotionsSection === undefined) {
      showWhatsappPromotionsSection = cur.show_whatsapp_promotions_section;
    }
    if (showWhatsappPromotionHistorySection === undefined) {
      showWhatsappPromotionHistorySection = cur.show_whatsapp_promotion_history_section;
    }
    if (showBeforeAfterGallery === undefined) {
      showBeforeAfterGallery = cur.show_before_after_gallery;
    }
    if (showNextEvaluationSection === undefined) {
      showNextEvaluationSection = cur.show_next_evaluation_section;
    }
  }

  const payload: Record<string, unknown> = {
    professional_id: professionalId,
    show_session_photos: showSessionPhotos,
    show_whatsapp_ultramsg: showWhatsappUltraMsg,
    agenda_open_mode: agendaOpenMode,
    use_max_weight_reference: useMaxWeightReference,
    programa_botox_view_mode: programaBotoxViewMode,
    show_session_timeline: showSessionTimeline,
    show_occupied_slot_encaixe: showOccupiedSlotEncaixe,
    agenda_slot_block_color: (() => {
      if (agendaSlotBlockColor == null || agendaSlotBlockColor === '') return null;
      const trimmed = String(agendaSlotBlockColor).trim();
      if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed.toLowerCase();
      if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`;
      return null;
    })(),
    show_dashboard_birthdays: showDashboardBirthdays,
    show_dashboard_future_clients: showDashboardFutureClients,
    show_dashboard_botox_reminders: showDashboardBotoxReminders,
    auto_send_programa_botox_billing: autoSendProgramaBotoxBilling,
    auto_send_budget_quote_billing: autoSendBudgetQuoteBilling,
    whatsapp_secretary_enabled: whatsappSecretaryEnabled,
    appointment_reminder_24h_enabled: appointmentReminder24hEnabled,
    appointment_reminder_1h_enabled: appointmentReminder1hEnabled,
    appointment_reminder_1h_hours: normalizeAppointmentReminder1hHours(appointmentReminder1hHours),
    appointment_presence_confirmation_enabled: appointmentPresenceConfirmationEnabled,
    appointment_presence_confirmation_24h_enabled: appointmentPresenceConfirmation24hEnabled,
    whatsapp_send_warmup_enabled: whatsappSendWarmupEnabled,
    whatsapp_bot_name: String(whatsappBotName || '').trim() || 'Secretária Virtual',
    birthday_whatsapp_enabled: birthdayWhatsappEnabled,
    birthday_whatsapp_message: birthdayWhatsappMessage,
    appointment_reminder_24h_message: appointmentReminder24hMessage,
    appointment_reminder_1h_message: appointmentReminder1hMessage,
    appointment_presence_confirmation_message: appointmentPresenceConfirmationMessage,
    whatsapp_message_templates: whatsappMessageTemplates,
    vacation_start_date: vacationStartDate,
    vacation_end_date: vacationEndDate,
    vacation_message: vacationMessage,
    whatsapp_ignored_phones: whatsappIgnoredPhones ?? [],
    show_whatsapp_botox_billing_section: showWhatsappBotoxBillingSection,
    show_whatsapp_birthday_section: showWhatsappBirthdaySection,
    show_whatsapp_promotions_section: showWhatsappPromotionsSection,
    show_whatsapp_promotion_history_section: showWhatsappPromotionHistorySection,
    show_before_after_gallery: showBeforeAfterGallery,
    show_next_evaluation_section: showNextEvaluationSection,
  };

  // Remove colunas ausentes no schema (PGRST204 / 42703) e tenta de novo — evita 400 em cascata.
  const working = { ...payload };
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { error } = await (supabase as any)
      .from('professional_ui_settings')
      .upsert(working, { onConflict: 'professional_id' });
    if (!error) return;

    const errText = `${error.message || ''} ${error.details || ''} ${error.hint || ''} ${error.code || ''}`;
    const missingCol =
      errText.match(
        /Could not find the '([^']+)' column of 'professional_ui_settings'/i
      )?.[1] ||
      errText.match(/column professional_ui_settings\.([a-z0-9_]+) does not exist/i)?.[1] ||
      errText.match(/Could not find the '([^']+)' column/i)?.[1] ||
      (error.code === 'PGRST204'
        ? Object.keys(working).find((key) => key !== 'professional_id' && errText.includes(key))
        : undefined);
    if (missingCol && missingCol in working) {
      delete working[missingCol];
      continue;
    }
    throw new Error(error.message);
  }
  throw new Error('Não foi possível salvar as preferências de UI.');
}

/** Atualiza só a cor dos bloqueios manuais na agenda. */
export async function updateAgendaSlotBlockColorOnly(params: {
  professionalId: string;
  color: string | null;
}): Promise<void> {
  const { professionalId } = params;
  const normalized =
    params.color == null || params.color === ''
      ? null
      : (() => {
          const trimmed = String(params.color).trim();
          if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed.toLowerCase();
          if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`;
          return null;
        })();

  const { data: existing, error: readErr } = await (supabase as any)
    .from('professional_ui_settings')
    .select('professional_id')
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (readErr) throw new Error(readErr.message);

  const columnMissingHint =
    'Coluna agenda_slot_block_color ausente no banco. Rode no SQL Editor do Supabase a migration 20260921160000_agenda_slot_block_color.sql';

  const isMissingColumn = (error: { message?: string; code?: string }) => {
    const msg = String(error.message || '');
    return /agenda_slot_block_color/i.test(msg) || error.code === 'PGRST204';
  };

  if (existing) {
    const { error } = await (supabase as any)
      .from('professional_ui_settings')
      .update({ agenda_slot_block_color: normalized })
      .eq('professional_id', professionalId);
    if (error) {
      if (isMissingColumn(error)) throw new Error(columnMissingHint);
      throw new Error(error.message);
    }
    return;
  }

  const { error } = await (supabase as any).from('professional_ui_settings').insert({
    professional_id: professionalId,
    agenda_slot_block_color: normalized,
  });
  if (error) {
    if (isMissingColumn(error)) throw new Error(columnMissingHint);
    throw new Error(error.message);
  }
}
export async function fetchWhatsappIgnoredPhonesOnly(params: {
  professionalId: string;
}): Promise<string[]> {
  const { data, error } = await (supabase as any)
    .from('professional_ui_settings')
    .select('whatsapp_ignored_phones')
    .eq('professional_id', params.professionalId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return [];
  return normalizeIgnoredPhoneList(data.whatsapp_ignored_phones);
}

/** Atualiza só whatsapp_ignored_phones — evita sobrescrever outras configs no upsert completo. */
export async function updateWhatsappIgnoredPhonesOnly(params: {
  professionalId: string;
  phones: string[];
}): Promise<void> {
  const { professionalId } = params;
  const normalized = normalizeIgnoredPhoneList(params.phones);

  const { data: existing, error: readErr } = await (supabase as any)
    .from('professional_ui_settings')
    .select('professional_id')
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (readErr) throw new Error(readErr.message);

  if (existing) {
    const { error } = await (supabase as any)
      .from('professional_ui_settings')
      .update({ whatsapp_ignored_phones: normalized })
      .eq('professional_id', professionalId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await (supabase as any).from('professional_ui_settings').insert({
    professional_id: professionalId,
    whatsapp_ignored_phones: normalized,
  });
  if (error) throw new Error(error.message);
}

/** Atualiza só whatsapp_message_templates — evita upsert completo e 400 em cascata. */
export async function updateWhatsappMessageTemplatesOnly(params: {
  professionalId: string;
  templates: WhatsappManualTemplatesMap;
}): Promise<void> {
  const { professionalId } = params;
  const templates = normalizeWhatsappManualTemplates(params.templates);

  const { data: existing, error: readErr } = await (supabase as any)
    .from('professional_ui_settings')
    .select('professional_id')
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (readErr) throw new Error(readErr.message);

  const columnMissingHint =
    'Coluna whatsapp_message_templates ausente no banco. Rode no SQL Editor do Supabase a migration 20260921150000_professional_ui_settings_whatsapp_columns.sql';

  if (existing) {
    const { error } = await (supabase as any)
      .from('professional_ui_settings')
      .update({ whatsapp_message_templates: templates })
      .eq('professional_id', professionalId);
    if (error) {
      const msg = String(error.message || '');
      if (/whatsapp_message_templates/i.test(msg) || error.code === 'PGRST204') {
        throw new Error(columnMissingHint);
      }
      throw new Error(msg);
    }
    return;
  }

  const { error } = await (supabase as any).from('professional_ui_settings').insert({
    professional_id: professionalId,
    whatsapp_message_templates: templates,
  });
  if (error) {
    const msg = String(error.message || '');
    if (/whatsapp_message_templates/i.test(msg) || error.code === 'PGRST204') {
      throw new Error(columnMissingHint);
    }
    throw new Error(msg);
  }
}

