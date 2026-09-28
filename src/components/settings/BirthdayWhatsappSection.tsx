import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import {
  fetchProfessionalUiSettings,
  upsertProfessionalUiSettings,
} from '@/services/api/dynamicProcedureFieldSettingsApi';
import {
  buildBirthdayWhatsappPreview,
  DEFAULT_BIRTHDAY_WHATSAPP_MESSAGE,
  runBirthdayWhatsappTestNow,
} from '@/lib/birthdayWhatsapp';
import { WhatsappPlaceholderChips } from '@/components/settings/WhatsappPlaceholderChips';
import { WhatsappMessageEditor } from '@/components/settings/WhatsappMessageEditor';
import { WhatsappFormattedPreview } from '@/components/settings/WhatsappFormattedPreview';
import { normalizeWhatsappMarkers } from '@/lib/whatsappFormatting';
import { cn } from '@/lib/utils';

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
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
        checked ? 'bg-primary' : 'bg-input',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50'
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

export function BirthdayWhatsappSection() {
  const { profile } = useAuth();
  const messageTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messageInsertRef = useRef<((token: string) => void) | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingEnabled, setSavingEnabled] = useState(false);
  const [savingMessage, setSavingMessage] = useState(false);
  const [testing, setTesting] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!profile?.id) return;
      setLoading(true);
      try {
        const ui = await fetchProfessionalUiSettings({ professionalId: profile.id });
        if (cancelled) return;
        setEnabled(ui.birthday_whatsapp_enabled);
        const template = ui.birthday_whatsapp_message?.trim() || '';
        setMessage(template);
        setSavedMessage(template);
      } catch {
        if (!cancelled) {
          setEnabled(false);
          setMessage('');
          setSavedMessage('');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const preview = useMemo(
    () =>
      buildBirthdayWhatsappPreview(
        message,
        'Maria Silva',
        profile?.app_name?.trim() || profile?.full_name || 'Profissional'
      ),
    [message, profile?.app_name, profile?.full_name]
  );

  const messageDirty = message.trim() !== savedMessage.trim();

  const persistSettings = async (patch: {
    birthdayWhatsappEnabled?: boolean;
    birthdayWhatsappMessage?: string | null;
  }) => {
    if (!profile?.id) return;
    const ui = await fetchProfessionalUiSettings({ professionalId: profile.id });
    await upsertProfessionalUiSettings({
      professionalId: profile.id,
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
      autoSendProgramaBotoxBilling: ui.auto_send_programa_botox_billing,
      whatsappSecretaryEnabled: ui.whatsapp_secretary_enabled,
      appointmentReminder24hEnabled: ui.appointment_reminder_24h_enabled,
      birthdayWhatsappEnabled: patch.birthdayWhatsappEnabled ?? ui.birthday_whatsapp_enabled,
      birthdayWhatsappMessage: patch.birthdayWhatsappMessage ?? ui.birthday_whatsapp_message,
      appointmentReminder24hMessage: ui.appointment_reminder_24h_message,
      whatsappMessageTemplates: ui.whatsapp_message_templates,
      vacationStartDate: ui.vacation_start_date,
      vacationEndDate: ui.vacation_end_date,
      vacationMessage: ui.vacation_message,
    });
  };

  const handleEnabledChange = async (checked: boolean) => {
    if (!profile?.id) return;
    setSavingEnabled(true);
    try {
      await persistSettings({ birthdayWhatsappEnabled: checked });
      setEnabled(checked);
      toast.success(
        checked
          ? 'Parabéns automáticos ativados — envio na segunda-feira da semana do aniversário.'
          : 'Parabéns automáticos desativados.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSavingEnabled(false);
    }
  };

  const handleSaveMessage = async () => {
    if (!profile?.id) return;
    const trimmed = message.trim();
    setSavingMessage(true);
    try {
      await persistSettings({ birthdayWhatsappMessage: trimmed || null });
      setSavedMessage(trimmed);
      setOpenAccordion((prev) => prev.filter((v) => v !== 'birthday-auto'));
      toast.success(
        trimmed
          ? 'Mensagem de aniversário salva.'
          : 'Mensagem personalizada removida — será usada a mensagem padrão de parabéns.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar a mensagem.');
    } finally {
      setSavingMessage(false);
    }
  };

  const handleRestoreMessage = () => {
    setMessage(DEFAULT_BIRTHDAY_WHATSAPP_MESSAGE);
  };

  const handleTestNow = async () => {
    if (!profile?.id) return;
    if (messageDirty) {
      toast.message('Salve a mensagem antes de testar o envio.');
      return;
    }
    setTesting(true);
    try {
      const result = await runBirthdayWhatsappTestNow(profile.id);
      if (!result.ok) {
        toast.error(result.error || 'Não foi possível testar o envio.');
        return;
      }
      const summary = result.summary;
      if (summary && summary.sent > 0) {
        const names = (summary.sentPatients ?? []).map((p) => p.patientName).join(', ');
        toast.success(result.message || `Enviado para ${summary.sent} aniversariante(s).`, {
          description: names ? `Pacientes: ${names}` : undefined,
        });
        return;
      }
      if (summary && summary.errors > 0) {
        const firstError = summary.errorPatients?.[0]?.error;
        toast.error(firstError || 'Nenhuma mensagem enviada. Verifique telefone e WhatsApp conectado.');
        return;
      }
      toast.message(
        result.message ||
          'Nenhum aniversariante desta semana com cadastro completo e telefone na aba Pacientes.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível testar o envio.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Accordion
      type="multiple"
      value={openAccordion}
      onValueChange={setOpenAccordion}
      className="rounded-xl border border-border/70"
    >
      <AccordionItem value="birthday-auto" className="px-3">
        <AccordionTrigger className="hover:no-underline py-3">
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2 text-left">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">Parabéns de aniversário</p>
              <p className="text-xs text-muted-foreground font-normal leading-relaxed">
                Envio automático às segundas — uma mensagem por paciente na semana do aniversário.
              </p>
            </div>
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}
            >
              {enabled ? 'Ativa' : 'Off'}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <div className="min-w-0 space-y-0.5 pr-3">
              <p className="text-sm">Permitir envio desta mensagem</p>
              <p className="text-xs text-muted-foreground">
                Toda <strong className="font-medium text-foreground/90">segunda-feira às 9h</strong>{' '}
                (Brasília), uma vez por paciente na semana do aniversário.
              </p>
            </div>
            <SettingsSwitch
              checked={enabled}
              disabled={loading || savingEnabled}
              aria-label="Ativar parabéns automáticos de aniversário"
              onChange={(checked) => void handleEnabledChange(checked)}
            />
          </div>

          <div className="space-y-2" data-birthday-wa-editor="1">
            <Label htmlFor="birthday-message">Texto da mensagem</Label>
            <WhatsappMessageEditor
              id="birthday-message"
              value={message}
              disabled={loading || savingMessage}
              textareaRef={messageTextareaRef}
              insertRef={messageInsertRef}
              minHeightClassName="min-h-[160px]"
              placeholder={
                'Deixe em branco para usar a mensagem padrão:\n\n' + DEFAULT_BIRTHDAY_WHATSAPP_MESSAGE
              }
              onChange={(next) => setMessage(normalizeWhatsappMarkers(next))}
            />
            <p className="text-xs text-muted-foreground">
              Use as abas Texto/Visual e os ícones de formatação (negrito, itálico, riscado). Vazio =
              mensagem padrão. {'{{profissional}}'} usa o nome da clínica em Configurações do
              sistema.
            </p>
            <WhatsappPlaceholderChips
              placeholders={['nome', 'primeiro_nome', 'profissional']}
              value={message}
              onChange={(next) => setMessage(normalizeWhatsappMarkers(next))}
              textareaRef={messageTextareaRef}
              insertRef={messageInsertRef}
              disabled={loading || savingMessage}
            />
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {message.trim()
                ? 'Prévia da sua mensagem'
                : 'Prévia da mensagem padrão (será enviada se o campo estiver vazio)'}
            </p>
            <WhatsappFormattedPreview text={preview} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={loading || savingMessage || !messageDirty}
              onClick={() => void handleSaveMessage()}
            >
              {savingMessage ? 'Salvando...' : 'Salvar mensagem'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || savingMessage}
              onClick={handleRestoreMessage}
            >
              Restaurar padrão
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || testing || !enabled}
              onClick={() => void handleTestNow()}
            >
              {testing ? 'Enviando...' : 'Testar envio'}
            </Button>
          </div>

          <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100 space-y-1">
            <p>
              Exemplo: aniversário na <strong>quinta</strong> → mensagem enviada na{' '}
              <strong>segunda</strong> da mesma semana.
            </p>
            <p>
              Só pacientes da aba <strong>Pacientes</strong> com data de nascimento e telefone.
              Máximo uma mensagem por paciente por ano.
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
