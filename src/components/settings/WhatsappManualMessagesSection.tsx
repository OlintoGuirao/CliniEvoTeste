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
  updateWhatsappMessageTemplatesOnly,
} from '@/services/api/dynamicProcedureFieldSettingsApi';
import {
  DEFAULT_WHATSAPP_MANUAL_MESSAGES,
  WHATSAPP_MANUAL_TEMPLATE_KEYS,
  WHATSAPP_MANUAL_TEMPLATE_META,
  applyWhatsappPlaceholders,
  defaultWhatsappManualTemplatesMap,
  type WhatsappManualTemplateKey,
  type WhatsappManualTemplatesMap,
} from '@/lib/whatsappManualTemplates';
import { WhatsappPlaceholderChips } from '@/components/settings/WhatsappPlaceholderChips';
import { WhatsappMessageEditor } from '@/components/settings/WhatsappMessageEditor';
import { WhatsappFormattedPreview } from '@/components/settings/WhatsappFormattedPreview';
import { cn } from '@/lib/utils';
import { useUiCopy } from '@/hooks/use-ui-copy';
import { isSalonAccount } from '@/lib/accountType';
import { normalizeWhatsappMarkers } from '@/lib/whatsappFormatting';

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

const PREVIEW_VARS: Record<string, string> = {
  nome: 'Maria Silva',
  primeiro_nome: 'Maria',
  profissional: 'Dra. Ana',
  clinica: 'Clínica Aura',
  consulta: 'consulta',
  procedimento: 'Botox',
  procedimento_part: ' do procedimento Botox',
  assunto: 'Sua consulta de Botox com Dra. Ana',
  assunto_prep: 'da sua consulta de Botox com Dra. Ana',
  agendado: 'agendada',
  dia: 'segunda-feira',
  data: '21 de setembro',
  quando: 'às 14:00',
  horario: '14:00',
  hora: '14:00',
  url: 'https://exemplo.app/link',
  valor: 'R$ 150,00',
  referencia: 'Referente à consulta, ',
  descricao: 'consulta',
  fotos_intro: 'Segue a foto',
  data_part: ' em segunda-feira, 21 de setembro',
};

function ManualTemplateTextarea({
  id,
  templateKey,
  value,
  disabled,
  placeholders,
  showSalonNomePlaceholder,
  onChange,
}: {
  id: string;
  templateKey: WhatsappManualTemplateKey;
  value: string;
  disabled?: boolean;
  placeholders: string[];
  showSalonNomePlaceholder?: boolean;
  onChange: (next: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const insertRef = useRef<((token: string) => void) | null>(null);
  return (
    <>
      <WhatsappMessageEditor
        id={id}
        value={value}
        disabled={disabled}
        textareaRef={textareaRef}
        insertRef={insertRef}
        placeholder={
          'Deixe em branco para usar a mensagem padrão:\n\n' +
          DEFAULT_WHATSAPP_MANUAL_MESSAGES[templateKey]
        }
        onChange={(next) => onChange(normalizeWhatsappMarkers(next))}
      />
      <WhatsappPlaceholderChips
        placeholders={placeholders}
        value={value}
        onChange={onChange}
        textareaRef={textareaRef}
        insertRef={insertRef}
        disabled={disabled}
        showSalonNomePlaceholder={showSalonNomePlaceholder}
      />
    </>
  );
}

export function WhatsappManualMessagesSection() {
  const { profile } = useAuth();
  const copy = useUiCopy();
  const isSalonProfile = copy.isSalon || isSalonAccount(profile?.account_type);
  const salonName = profile?.app_name?.trim() || profile?.full_name || 'Salão Aura';
  const [templates, setTemplates] = useState<WhatsappManualTemplatesMap>(
    defaultWhatsappManualTemplatesMap()
  );
  const [drafts, setDrafts] = useState<Record<WhatsappManualTemplateKey, string>>(
    () =>
      WHATSAPP_MANUAL_TEMPLATE_KEYS.reduce(
        (acc, key) => {
          acc[key] = '';
          return acc;
        },
        {} as Record<WhatsappManualTemplateKey, string>
      )
  );
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<WhatsappManualTemplateKey | null>(null);
  const [togglingKey, setTogglingKey] = useState<WhatsappManualTemplateKey | null>(null);
  const [openAccordion, setOpenAccordion] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!profile?.id) return;
      setLoading(true);
      try {
        const ui = await fetchProfessionalUiSettings({ professionalId: profile.id });
        if (cancelled) return;
        setTemplates(ui.whatsapp_message_templates);
        setDrafts(
          WHATSAPP_MANUAL_TEMPLATE_KEYS.reduce(
            (acc, key) => {
              acc[key] = ui.whatsapp_message_templates[key].message ?? '';
              return acc;
            },
            {} as Record<WhatsappManualTemplateKey, string>
          )
        );
      } catch {
        if (!cancelled) {
          setTemplates(defaultWhatsappManualTemplatesMap());
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

  const persist = async (next: WhatsappManualTemplatesMap) => {
    if (!profile?.id) return;
    await updateWhatsappMessageTemplatesOnly({
      professionalId: profile.id,
      templates: next,
    });
  };

  const handleToggle = async (key: WhatsappManualTemplateKey, enabled: boolean) => {
    setTogglingKey(key);
    try {
      const next = {
        ...templates,
        [key]: { ...templates[key], enabled },
      };
      await persist(next);
      setTemplates(next);
      toast.success(
        enabled
          ? `${WHATSAPP_MANUAL_TEMPLATE_META[key].title} ativada.`
          : `${WHATSAPP_MANUAL_TEMPLATE_META[key].title} desativada.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setTogglingKey(null);
    }
  };

  const handleSave = async (key: WhatsappManualTemplateKey) => {
    setSavingKey(key);
    try {
      const trimmed = drafts[key].trim();
      const next = {
        ...templates,
        [key]: { ...templates[key], message: trimmed || null },
      };
      await persist(next);
      setTemplates(next);
      setDrafts((prev) => ({ ...prev, [key]: trimmed }));
      setOpenAccordion((prev) => prev.filter((v) => v !== key));
      toast.success(
        trimmed
          ? 'Mensagem salva.'
          : 'Personalização removida — será usada a mensagem padrão.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar a mensagem.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleRestore = (key: WhatsappManualTemplateKey) => {
    setDrafts((prev) => ({ ...prev, [key]: DEFAULT_WHATSAPP_MANUAL_MESSAGES[key] }));
  };

  const previews = useMemo(() => {
    const vars = {
      ...PREVIEW_VARS,
      ...(isSalonProfile
        ? {
            clinica: salonName,
            nome_salao: salonName,
            consulta: 'atendimento',
            assunto: `Seu atendimento de Botox com ${PREVIEW_VARS.profissional}`,
            assunto_prep: `do seu atendimento de Botox com ${PREVIEW_VARS.profissional}`,
            agendado: 'agendado',
          }
        : { nome_salao: PREVIEW_VARS.clinica }),
    };
    return WHATSAPP_MANUAL_TEMPLATE_KEYS.reduce(
      (acc, key) => {
        const raw = drafts[key].trim() || DEFAULT_WHATSAPP_MANUAL_MESSAGES[key];
        acc[key] = applyWhatsappPlaceholders(raw, vars);
        return acc;
      },
      {} as Record<WhatsappManualTemplateKey, string>
    );
  }, [drafts, isSalonProfile, salonName]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Mensagens usadas em ações manuais (Agenda, Dashboard, ficha, orçamento, cobrança e
        relatórios). Desative para ocultar/pular o envio; campo vazio usa o texto padrão do
        sistema.
      </p>
      <Accordion
        type="multiple"
        value={openAccordion}
        onValueChange={setOpenAccordion}
        className="rounded-xl border border-border/70"
      >
        {WHATSAPP_MANUAL_TEMPLATE_KEYS.map((key) => {
          const meta = WHATSAPP_MANUAL_TEMPLATE_META[key];
          const dirty =
            drafts[key].trim() !== (templates[key].message ?? '').trim();
          return (
            <AccordionItem key={key} value={key} className="px-3">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2 text-left">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{meta.title}</p>
                    <p className="text-xs text-muted-foreground font-normal leading-relaxed">
                      {meta.description}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                      templates[key].enabled
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {templates[key].enabled ? 'Ativa' : 'Off'}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <p className="text-sm">Permitir envio desta mensagem</p>
                  <SettingsSwitch
                    checked={templates[key].enabled}
                    disabled={loading || togglingKey === key}
                    aria-label={`Ativar ${meta.title}`}
                    onChange={(checked) => void handleToggle(key, checked)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`wa-tpl-${key}`}>Texto da mensagem</Label>
                  <ManualTemplateTextarea
                    id={`wa-tpl-${key}`}
                    templateKey={key}
                    value={drafts[key]}
                    disabled={loading || savingKey === key}
                    placeholders={meta.placeholders}
                    showSalonNomePlaceholder={isSalonProfile}
                    onChange={(next) => setDrafts((prev) => ({ ...prev, [key]: next }))}
                  />
                </div>
                <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {drafts[key].trim() ? 'Prévia' : 'Prévia do padrão'}
                  </p>
                  <WhatsappFormattedPreview text={previews[key]} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={loading || savingKey === key || !dirty}
                    onClick={() => void handleSave(key)}
                  >
                    {savingKey === key ? 'Salvando...' : 'Salvar'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loading || savingKey === key}
                    onClick={() => handleRestore(key)}
                  >
                    Restaurar padrão
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
