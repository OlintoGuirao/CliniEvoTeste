import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAdminUsers, fetchProcedurePermissions, setUserDisabledModules } from '@/services/api/adminApi';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BrowserTabs, BrowserTabsContent, BrowserTabsList, BrowserTabsTrigger } from '@/components/ui/browser-tabs';
import { Loader2, Search, Eye } from 'lucide-react';
import { ProcedureFieldsScreenPreview } from '@/components/admin/ProcedureFieldsScreenPreview';
import { toast } from 'sonner';
import type { Profile, Procedure } from '@/services/api/adminApi';
import {
  createProcedureField,
} from '@/services/api/adminApi';
import type { ProcedureFieldWithSettings } from '@/services/api/dynamicProcedureFieldSettingsApi';
import {
  fetchProcedureFieldSettings,
  fetchProfessionalUiSettings,
  upsertProcedureFieldSettings,
  upsertProfessionalUiSettings,
} from '@/services/api/dynamicProcedureFieldSettingsApi';

const ADMIN_EMAIL = 'admin@clinievo.com.br';

/** Chave em `profiles.disabled_modules` — alinhada à rota `/insumos-nf`. */
const MODULE_KEY_INSUMOS_NF = 'insumos-nf';
const MODULE_KEY_PROGRAMA_BOTOX = 'programa-botox';
const MODULE_KEY_ANOTACOES = 'anotacoes';
const MODULE_KEY_ORCAMENTO = 'orcamento';
const MODULE_KEY_RECEITUARIO = 'receituario';
const MODULE_KEY_FLUXO_CAIXA = 'fluxo-caixa';
const MODULE_KEY_COBRANCA = 'cobranca';
const MODULE_KEY_DEPILACAO_LASER = 'depilacao-laser';
const MODULE_KEY_ATENDIMENTO = 'atendimento';

const BOTOX_REGION_PERMISSION_FIELDS = [
  { fieldKey: 'regiao_tratada', label: 'Região tratada' },
  { fieldKey: 'botox_regiao_testa', label: 'Testa' },
  { fieldKey: 'botox_regiao_glabela', label: 'Glabela' },
  { fieldKey: 'botox_regiao_pes_de_galinha', label: 'Pés de galinha' },
  { fieldKey: 'botox_regiao_sobrancelha', label: 'Sobrancelha' },
  { fieldKey: 'botox_regiao_bunny_lines', label: 'Bunny lines' },
  { fieldKey: 'botox_regiao_masseter', label: 'Masseter' },
  { fieldKey: 'botox_regiao_queixo', label: 'Queixo' },
  { fieldKey: 'botox_regiao_depressor_angulo_boca', label: 'Depressor do ângulo da boca' },
  { fieldKey: 'botox_regiao_pescoco', label: 'Pescoço' },
] as const;

function PermissionsScreen({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isAdmin = user?.email === ADMIN_EMAIL;

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);

  const [professionalId, setProfessionalId] = useState<string>('');
  const [procedureId, setProcedureId] = useState<string>('');
  /** '' = ainda não escolheu; 'modules' = módulos e integrações; caso contrário = id do procedimento */
  const [configTarget, setConfigTarget] = useState<string>('');
  const [modulesSubTab, setModulesSubTab] = useState<'bot' | 'geral'>('bot');

  const [fields, setFields] = useState<ProcedureFieldWithSettings[]>([]);
  const [showSessionPhotos, setShowSessionPhotos] = useState(true);
  const [showBeforeAfterGallery, setShowBeforeAfterGallery] = useState(true);
  const [showNextEvaluationSection, setShowNextEvaluationSection] = useState(true);
  const [showWhatsappUltraMsg, setShowWhatsappUltraMsg] = useState(true);
  const [showWhatsappBotoxBillingSection, setShowWhatsappBotoxBillingSection] = useState(true);
  const [showWhatsappBirthdaySection, setShowWhatsappBirthdaySection] = useState(true);
  const [showWhatsappPromotionsSection, setShowWhatsappPromotionsSection] = useState(true);
  const [showWhatsappPromotionHistorySection, setShowWhatsappPromotionHistorySection] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingModuleToggle, setSavingModuleToggle] = useState(false);

  // Usado somente para o switch de módulos (disabled_modules vem da tabela profiles)
  const [profilesWithModules, setProfilesWithModules] = useState<ProfileWithModules[]>([]);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [fieldSearch, setFieldSearch] = useState('');

  useEffect(() => {
    if (user === null) return;
    if (!isAdmin) navigate('/dashboard', { replace: true });
  }, [user, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchProcedurePermissions();
        if (cancelled) return;
        setProfiles(res.profiles);
        setProcedures(res.procedures);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Erro ao carregar dados');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (!professionalId || !procedureId) return;

    let cancelled = false;
    (async () => {
      try {
        setFields([]);
        const list = await fetchProcedureFieldSettings({ professionalId, procedureId });
        const finalList = await ensureBotoxRegionPermissionFields(procedureId, list, professionalId);
        if (cancelled) return;
        // Ordenação inicial: usa o sort_order atual já retornado
        setFields(finalList.slice().sort((a, b) => a.sort_order - b.sort_order));
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Erro ao carregar campos');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, professionalId, procedureId]);

  useEffect(() => {
    if (!isAdmin || !professionalId) return;
    let cancelled = false;
    (async () => {
      try {
        const ui = await fetchProfessionalUiSettings({ professionalId });
        if (cancelled) return;
        setShowSessionPhotos(ui.show_session_photos);
        setShowBeforeAfterGallery(ui.show_before_after_gallery);
        setShowNextEvaluationSection(ui.show_next_evaluation_section);
        setShowWhatsappUltraMsg(ui.show_whatsapp_ultramsg);
        setShowWhatsappBotoxBillingSection(ui.show_whatsapp_botox_billing_section);
        setShowWhatsappBirthdaySection(ui.show_whatsapp_birthday_section);
        setShowWhatsappPromotionsSection(ui.show_whatsapp_promotions_section);
        setShowWhatsappPromotionHistorySection(ui.show_whatsapp_promotion_history_section);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Erro ao carregar configurações de UI');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, professionalId]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAdminUsers();
        if (cancelled) return;
        setProfilesWithModules(data as ProfileWithModules[]);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Erro ao carregar módulos');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const disabledModulesForProfessional = useMemo(() => {
    const p = profilesWithModules.find((x) => x.id === professionalId);
    return p?.disabled_modules ?? [];
  }, [profilesWithModules, professionalId]);

  const isBotoxModuleEnabled = !disabledModulesForProfessional.includes(MODULE_KEY_PROGRAMA_BOTOX);
  const isAnotacoesModuleEnabled = !disabledModulesForProfessional.includes(MODULE_KEY_ANOTACOES);
  const isInsumosModuleEnabled = !disabledModulesForProfessional.includes(MODULE_KEY_INSUMOS_NF);
  const isOrcamentoModuleEnabled = !disabledModulesForProfessional.includes(MODULE_KEY_ORCAMENTO);
  const isReceituarioModuleEnabled = !disabledModulesForProfessional.includes(MODULE_KEY_RECEITUARIO);
  const isFluxoCaixaModuleEnabled = !disabledModulesForProfessional.includes(MODULE_KEY_FLUXO_CAIXA);
  const isCobrancaModuleEnabled = !disabledModulesForProfessional.includes(MODULE_KEY_COBRANCA);
  const isDepilacaoLaserModuleEnabled = !disabledModulesForProfessional.includes(MODULE_KEY_DEPILACAO_LASER);
  const isAtendimentoModuleEnabled = !disabledModulesForProfessional.includes(MODULE_KEY_ATENDIMENTO);

  const isModulesTarget = configTarget === 'modules';
  const isProcedureTarget = configTarget !== '' && configTarget !== 'modules';

  const handleProfessionalChange = (id: string) => {
    setProfessionalId(id);
    setFields([]);
    setModulesSubTab('bot');
  };

  const handleConfigTargetChange = (value: string) => {
    setConfigTarget(value);
    if (value === 'modules') {
      setProcedureId('');
      setFields([]);
      setModulesSubTab('bot');
      return;
    }
    setProcedureId(value);
  };

  const toggleProfessionalModule = async (moduleKey: string, checked: boolean) => {
    if (!professionalId) return;
    const current = disabledModulesForProfessional ?? [];
    const updated = checked ? current.filter((k) => k !== moduleKey) : Array.from(new Set([...current, moduleKey]));

    setSavingModuleToggle(true);
    try {
      await setUserDisabledModules({ userId: professionalId, disabledModules: updated });
      setProfilesWithModules((prev) => prev.map((p) => (p.id === professionalId ? { ...p, disabled_modules: updated } : p)));
      toast.success('Acesso do módulo atualizado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar módulo.');
    } finally {
      setSavingModuleToggle(false);
    }
  };

  const toggleWhatsappCardForProfessional = async (checked: boolean) => {
    if (!professionalId) return;
    setSavingModuleToggle(true);
    try {
      await upsertProfessionalUiSettings({
        professionalId,
        showSessionPhotos,
        showWhatsappUltraMsg: checked,
      });
      setShowWhatsappUltraMsg(checked);
      toast.success(
        checked
          ? 'Card de conexão WhatsApp habilitado no perfil do profissional.'
          : 'Card de conexão WhatsApp oculto no perfil do profissional.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar WhatsApp no perfil.');
    } finally {
      setSavingModuleToggle(false);
    }
  };

  const toggleWhatsappSectionVisibility = async (
    field:
      | 'showWhatsappBotoxBillingSection'
      | 'showWhatsappBirthdaySection'
      | 'showWhatsappPromotionsSection'
      | 'showWhatsappPromotionHistorySection',
    checked: boolean,
    label: string
  ) => {
    if (!professionalId) return;
    setSavingModuleToggle(true);
    try {
      await upsertProfessionalUiSettings({
        professionalId,
        showSessionPhotos,
        showWhatsappUltraMsg,
        [field]: checked,
      });
      if (field === 'showWhatsappBotoxBillingSection') setShowWhatsappBotoxBillingSection(checked);
      if (field === 'showWhatsappBirthdaySection') setShowWhatsappBirthdaySection(checked);
      if (field === 'showWhatsappPromotionsSection') setShowWhatsappPromotionsSection(checked);
      if (field === 'showWhatsappPromotionHistorySection') {
        setShowWhatsappPromotionHistorySection(checked);
      }
      toast.success(checked ? `${label} visível para o profissional.` : `${label} oculto para o profissional.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar visibilidade.');
    } finally {
      setSavingModuleToggle(false);
    }
  };

  const ensureBotoxRegionPermissionFields = async (
    targetProcedureId: string,
    currentList: ProcedureFieldWithSettings[],
    targetProfessionalId: string
  ): Promise<ProcedureFieldWithSettings[]> => {
    const proc = procedures.find((p) => p.id === targetProcedureId);
    if (!proc || proc.slug !== 'botox') return currentList;

    const existingKeys = new Set(currentList.map((f) => f.field_key));
    const missing = BOTOX_REGION_PERMISSION_FIELDS.filter((f) => !existingKeys.has(f.fieldKey));
    if (missing.length === 0) return currentList;

    let nextSort = Math.max(0, ...currentList.map((f) => f.sort_order || 0)) + 1;
    for (const field of missing) {
      await createProcedureField({
        procedureId: targetProcedureId,
        fieldKey: field.fieldKey,
        label: field.label,
        fieldType: 'boolean',
        sortOrder: nextSort++,
      });
    }

    return await fetchProcedureFieldSettings({
      professionalId: targetProfessionalId,
      procedureId: targetProcedureId,
    });
  };

  const save = async () => {
    if (!isAdmin) return;
    if (!professionalId || !procedureId) return;

    setSaving(true);
    try {
      await upsertProcedureFieldSettings({
        professionalId,
        procedureId,
        fields: fields.map((f, idx) => ({
          procedure_field_id: f.id,
          is_active: f.is_active,
          is_required: f.is_required && f.is_active,
          sort_order: idx + 1,
        })),
      });
      await upsertProfessionalUiSettings({
        professionalId,
        showSessionPhotos,
        showWhatsappUltraMsg,
        showBeforeAfterGallery,
        showNextEvaluationSection,
      });
      toast.success('Configurações de campos salvas.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const hasFields = fields.length > 0;

  const reorder = (from: number, to: number) => {
    setFields((prev) => {
      const next = prev.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const currentProfileName = useMemo(() => {
    const p = profiles.find((x) => x.id === professionalId);
    return p ? (p.full_name || p.email) : 'Não selecionado';
  }, [profiles, professionalId]);

  const currentProcedureName = useMemo(() => {
    const p = procedures.find((x) => x.id === procedureId);
    return p?.name ?? 'Não selecionado';
  }, [procedures, procedureId]);

  const currentProcedureSlug = useMemo(() => {
    const p = procedures.find((x) => x.id === procedureId);
    return p?.slug ?? '';
  }, [procedures, procedureId]);

  const renderedFields = useMemo(() => {
    const query = fieldSearch.trim().toLowerCase();
    if (!query) return fields;
    return fields.filter((f) =>
      `${f.label} ${f.field_key} ${f.field_type}`.toLowerCase().includes(query)
    );
  }, [fields, fieldSearch]);

  if (!isAdmin) return null;

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      {!embedded ? (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurar Campos Dinâmicos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ative/desative, marque obrigatório e ajuste a ordem por profissional.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Seleção</CardTitle>
          <p className="text-sm text-muted-foreground">
            Escolha o profissional e o que deseja configurar para este perfil.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Profissional</p>
              <Select
                value={professionalId || undefined}
                onValueChange={handleProfessionalChange}
                disabled={loading}
              >
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">O que configurar</p>
              <Select
                value={configTarget || undefined}
                onValueChange={handleConfigTargetChange}
                disabled={loading || !professionalId}
              >
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {procedures.map((proc) => (
                    <SelectItem key={proc.id} value={proc.id}>
                      {proc.name}
                    </SelectItem>
                  ))}
                  {procedures.length > 0 ? <SelectSeparator /> : null}
                  <SelectItem value="modules">Módulos e integrações</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              {isProcedureTarget ? (
                <Button onClick={save} disabled={saving || !hasFields} className="w-full md:w-auto">
                  {saving ? 'Salvando...' : 'Salvar configurações'}
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {isModulesTarget && professionalId ? (
        <Card key={professionalId} className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Módulos e integrações</CardTitle>
            <p className="text-sm text-muted-foreground">
              Controle de exibição de itens e integrações para{' '}
              <span className="font-medium text-foreground">{currentProfileName}</span>.
            </p>
          </CardHeader>
          <CardContent className="p-0 pt-0 overflow-hidden">
            <BrowserTabs
              value={modulesSubTab}
              onValueChange={(v) => setModulesSubTab(v as 'bot' | 'geral')}
            >
              <BrowserTabsList>
                <BrowserTabsTrigger value="bot">Bot</BrowserTabsTrigger>
                <BrowserTabsTrigger value="geral">Geral</BrowserTabsTrigger>
              </BrowserTabsList>

              <BrowserTabsContent value="bot" className="rounded-none border-x-0 border-b-0 space-y-4">
                <div className="rounded-xl border bg-card p-4 space-y-0">
                  <div className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">WhatsApp (Evolution API)</p>
                      <p className="text-xs text-muted-foreground">
                        Exibe o card com QR Code em Configurações → Meu perfil para o profissional conectar o número.
                      </p>
                    </div>
                    <Switch
                      checked={showWhatsappUltraMsg}
                      onCheckedChange={(checked) => void toggleWhatsappCardForProfessional(checked === true)}
                      disabled={savingModuleToggle || !professionalId}
                      aria-label="Mostrar card WhatsApp no perfil do profissional"
                    />
                  </div>

                  {showWhatsappUltraMsg ? (
                    <div className="border-t divide-y">
                      <div className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Cobrança — Programa de Botox</p>
                          <p className="text-xs text-muted-foreground">
                            Card de cobrança automática na Secretária WhatsApp.
                          </p>
                        </div>
                        <Switch
                          checked={showWhatsappBotoxBillingSection}
                          onCheckedChange={(checked) =>
                            void toggleWhatsappSectionVisibility(
                              'showWhatsappBotoxBillingSection',
                              checked === true,
                              'Cobrança — Programa de Botox'
                            )
                          }
                          disabled={savingModuleToggle || !professionalId}
                          aria-label="Exibir cobrança do programa de Botox"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Parabéns de aniversário</p>
                          <p className="text-xs text-muted-foreground">
                            Card de mensagens automáticas de aniversário.
                          </p>
                        </div>
                        <Switch
                          checked={showWhatsappBirthdaySection}
                          onCheckedChange={(checked) =>
                            void toggleWhatsappSectionVisibility(
                              'showWhatsappBirthdaySection',
                              checked === true,
                              'Parabéns de aniversário'
                            )
                          }
                          disabled={savingModuleToggle || !professionalId}
                          aria-label="Exibir parabéns de aniversário"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Promoções automáticas</p>
                          <p className="text-xs text-muted-foreground">
                            Card para cadastrar e enviar promoções pelo bot.
                          </p>
                        </div>
                        <Switch
                          checked={showWhatsappPromotionsSection}
                          onCheckedChange={(checked) =>
                            void toggleWhatsappSectionVisibility(
                              'showWhatsappPromotionsSection',
                              checked === true,
                              'Promoções automáticas'
                            )
                          }
                          disabled={savingModuleToggle || !professionalId}
                          aria-label="Exibir promoções automáticas"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Últimos envios</p>
                          <p className="text-xs text-muted-foreground">
                            Histórico de promoções disparadas na Secretária WhatsApp.
                          </p>
                        </div>
                        <Switch
                          checked={showWhatsappPromotionHistorySection}
                          onCheckedChange={(checked) =>
                            void toggleWhatsappSectionVisibility(
                              'showWhatsappPromotionHistorySection',
                              checked === true,
                              'Últimos envios'
                            )
                          }
                          disabled={savingModuleToggle || !professionalId}
                          aria-label="Exibir últimos envios de promoções"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </BrowserTabsContent>

              <BrowserTabsContent value="geral" className="rounded-none border-x-0 border-b-0 space-y-4">
                <div className="rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Programa de Botox</p>
                      <p className="text-xs text-muted-foreground">Controla se o item aparece no menu do profissional.</p>
                    </div>
                    <Switch
                      checked={isBotoxModuleEnabled}
                      onCheckedChange={(checked) => toggleProfessionalModule(MODULE_KEY_PROGRAMA_BOTOX, checked === true)}
                      disabled={savingModuleToggle}
                      aria-label="Habilitar Programa de Botox"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Anotações</p>
                      <p className="text-xs text-muted-foreground">Controla se o item aparece no menu do profissional.</p>
                    </div>
                    <Switch
                      checked={isAnotacoesModuleEnabled}
                      onCheckedChange={(checked) => toggleProfessionalModule(MODULE_KEY_ANOTACOES, checked === true)}
                      disabled={savingModuleToggle}
                      aria-label="Habilitar Anotações"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Atendimento</p>
                      <p className="text-xs text-muted-foreground">
                        Inbox WhatsApp quando o paciente escolhe &quot;Falar com o profissional&quot;.
                      </p>
                    </div>
                    <Switch
                      checked={isAtendimentoModuleEnabled}
                      onCheckedChange={(checked) => toggleProfessionalModule(MODULE_KEY_ATENDIMENTO, checked === true)}
                      disabled={savingModuleToggle}
                      aria-label="Habilitar Atendimento"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Entradas NF (Insumos)</p>
                      <p className="text-xs text-muted-foreground">Controla se o item aparece no menu do profissional.</p>
                    </div>
                    <Switch
                      checked={isInsumosModuleEnabled}
                      onCheckedChange={(checked) => toggleProfessionalModule(MODULE_KEY_INSUMOS_NF, checked === true)}
                      disabled={savingModuleToggle}
                      aria-label="Habilitar Entradas NF (Insumos)"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Orçamentos</p>
                      <p className="text-xs text-muted-foreground">Controla se o item aparece no menu do profissional.</p>
                    </div>
                    <Switch
                      checked={isOrcamentoModuleEnabled}
                      onCheckedChange={(checked) => toggleProfessionalModule(MODULE_KEY_ORCAMENTO, checked === true)}
                      disabled={savingModuleToggle}
                      aria-label="Habilitar Orçamentos"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Fluxo de caixa</p>
                      <p className="text-xs text-muted-foreground">Controla se o item aparece no menu do profissional.</p>
                    </div>
                    <Switch
                      checked={isFluxoCaixaModuleEnabled}
                      onCheckedChange={(checked) => toggleProfessionalModule(MODULE_KEY_FLUXO_CAIXA, checked === true)}
                      disabled={savingModuleToggle}
                      aria-label="Habilitar Fluxo de caixa"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Cobrança</p>
                      <p className="text-xs text-muted-foreground">Controla se o item aparece no menu do profissional.</p>
                    </div>
                    <Switch
                      checked={isCobrancaModuleEnabled}
                      onCheckedChange={(checked) => toggleProfessionalModule(MODULE_KEY_COBRANCA, checked === true)}
                      disabled={savingModuleToggle}
                      aria-label="Habilitar Cobrança"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Depilação a laser</p>
                      <p className="text-xs text-muted-foreground">Controla se o item aparece no menu do profissional.</p>
                    </div>
                    <Switch
                      checked={isDepilacaoLaserModuleEnabled}
                      onCheckedChange={(checked) => toggleProfessionalModule(MODULE_KEY_DEPILACAO_LASER, checked === true)}
                      disabled={savingModuleToggle}
                      aria-label="Habilitar Depilação a laser"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Receitas</p>
                      <p className="text-xs text-muted-foreground">Controla se o item aparece no menu do profissional.</p>
                    </div>
                    <Switch
                      checked={isReceituarioModuleEnabled}
                      onCheckedChange={(checked) => toggleProfessionalModule(MODULE_KEY_RECEITUARIO, checked === true)}
                      disabled={savingModuleToggle}
                      aria-label="Habilitar Receitas"
                    />
                  </div>
                </div>
              </BrowserTabsContent>
            </BrowserTabs>
          </CardContent>
        </Card>
      ) : null}

      {isProcedureTarget ? (
        <>
      <div className="sticky top-2 z-20">
        <Card className="border-primary/20 bg-background/95 backdrop-blur">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Profissional:</span> <span className="font-medium">{currentProfileName}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Procedimento:</span> <span className="font-medium">{currentProcedureName}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Campos:</span> <span className="font-medium">{fields.length}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Campos do procedimento</CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure visibilidade e obrigatoriedade dos campos para{' '}
            <span className="font-medium text-foreground">{currentProcedureName}</span>.
          </p>
        </CardHeader>

        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Carregando...</span>
            </div>
          ) : (
            <>
              {!hasFields ? (
                <p className="text-muted-foreground py-6 text-sm">Nenhum campo encontrado para esse procedimento.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Arraste para ordenar e use os toggles para ativar/obrigatório.</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Buscar campo por nome, chave ou tipo"
                      value={fieldSearch}
                      onChange={(e) => setFieldSearch(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    {renderedFields.map((f, idx) => (
                      <div
                        key={f.id}
                        draggable
                        onDragStart={() => setDragIndex(idx)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragIndex == null || dragIndex === idx) return;
                          reorder(dragIndex, idx);
                          setDragIndex(idx);
                        }}
                        className="flex items-center justify-between gap-3 border rounded-xl p-3 bg-background"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                            <p className="font-medium text-sm truncate" title={f.label}>
                              {f.label}
                            </p>
                            <span className="text-[11px] text-muted-foreground shrink-0">{f.field_type}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Ativo</span>
                            <Switch
                              checked={f.is_active}
                              onCheckedChange={(checked) => {
                                setFields((prev) =>
                                  prev.map((x) => {
                                    if (x.id !== f.id) return x;
                                    const nextActive = checked === true;
                                    return { ...x, is_active: nextActive, is_required: nextActive ? x.is_required : false };
                                  })
                                );
                              }}
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={f.is_active && f.is_required}
                              disabled={!f.is_active}
                              onCheckedChange={(c) => {
                                setFields((prev) =>
                                  prev.map((x) => (x.id !== f.id ? x : { ...x, is_required: c === true }))
                                );
                              }}
                              aria-label={`Obrigatório ${f.label}`}
                            />
                            <span className="text-xs text-muted-foreground">Obrigatório</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Mostrar seção "Fotos da sessão" (geral da tela)</p>
                      <p className="text-xs text-muted-foreground">
                        Controla a exibição do card no formulário da consulta, independente do procedimento/slug.
                      </p>
                    </div>
                    <Switch checked={showSessionPhotos} onCheckedChange={(v) => setShowSessionPhotos(v === true)} />
                  </div>
                  <div className="rounded-xl border p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Galeria Antes e Depois</p>
                      <p className="text-xs text-muted-foreground">
                        Card de upload e pares editáveis dentro de cada procedimento na consulta.
                      </p>
                    </div>
                    <Switch
                      checked={showBeforeAfterGallery}
                      onCheckedChange={(v) => setShowBeforeAfterGallery(v === true)}
                    />
                  </div>
                  <div className="rounded-xl border p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Próxima avaliação</p>
                      <p className="text-xs text-muted-foreground">
                        Card de prazo e agendamento da próxima avaliação na consulta.
                      </p>
                    </div>
                    <Switch
                      checked={showNextEvaluationSection}
                      onCheckedChange={(v) => setShowNextEvaluationSection(v === true)}
                    />
                  </div>
                </div>
              )}

            </>
          )}
        </CardContent>
      </Card>

      <Card className="xl:sticky xl:top-20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" aria-hidden />
            Prévia da tela
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Atualiza em tempo real ao ativar, desativar ou marcar campos como obrigatórios.
          </p>
        </CardHeader>
        <CardContent className="pt-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Carregando...</span>
            </div>
          ) : (
            <ProcedureFieldsScreenPreview
              procedureName={currentProcedureName}
              procedureSlug={currentProcedureSlug}
              professionalId={professionalId}
              fields={fields}
              showSessionPhotos={showSessionPhotos}
              showBeforeAfterGallery={showBeforeAfterGallery}
              showNextEvaluationSection={showNextEvaluationSection}
            />
          )}
        </CardContent>
      </Card>
      </div>
        </>
      ) : null}
    </div>
  );
}

type ProfileWithModules = Profile & { disabled_modules?: string[] | null };

function ModulesScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ProfileWithModules[]>([]);
  const [professionalId, setProfessionalId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [showWhatsappCard, setShowWhatsappCard] = useState(true);
  const [loadingWhatsappSetting, setLoadingWhatsappSetting] = useState(false);

  const canAccess = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (user === null) return;
    if (!canAccess) navigate('/dashboard', { replace: true });
  }, [user, canAccess, navigate]);

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    setLoading(true);
    fetchAdminUsers()
      .then((data) => {
        if (cancelled) return;
        setProfiles(data as ProfileWithModules[]);
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error(e instanceof Error ? e.message : 'Erro ao carregar perfis');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canAccess]);

  useEffect(() => {
    if (!professionalId && profiles.length > 0) setProfessionalId(profiles[0].id);
  }, [profiles, professionalId]);

  useEffect(() => {
    if (!professionalId) return;
    let cancelled = false;
    setLoadingWhatsappSetting(true);
    void (async () => {
      try {
        const ui = await fetchProfessionalUiSettings({ professionalId });
        if (!cancelled) setShowWhatsappCard(ui.show_whatsapp_ultramsg);
      } catch (e) {
        if (!cancelled) {
          setShowWhatsappCard(true);
          toast.error(e instanceof Error ? e.message : 'Erro ao carregar opção de WhatsApp');
        }
      } finally {
        if (!cancelled) setLoadingWhatsappSetting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [professionalId]);

  const current = profiles.find((p) => p.id === professionalId);
  const disabledModules = current?.disabled_modules ?? [];
  const isBotoxModuleEnabled = !disabledModules.includes(MODULE_KEY_PROGRAMA_BOTOX);
  const isAnotacoesModuleEnabled = !disabledModules.includes(MODULE_KEY_ANOTACOES);
  const isInsumosModuleEnabled = !disabledModules.includes(MODULE_KEY_INSUMOS_NF);
  const isOrcamentoModuleEnabled = !disabledModules.includes(MODULE_KEY_ORCAMENTO);
  const isReceituarioModuleEnabled = !disabledModules.includes(MODULE_KEY_RECEITUARIO);
  const isFluxoCaixaModuleEnabled = !disabledModules.includes(MODULE_KEY_FLUXO_CAIXA);
  const isCobrancaModuleEnabled = !disabledModules.includes(MODULE_KEY_COBRANCA);
  const isDepilacaoLaserModuleEnabled = !disabledModules.includes(MODULE_KEY_DEPILACAO_LASER);
  const isAtendimentoModuleEnabled = !disabledModules.includes(MODULE_KEY_ATENDIMENTO);

  const toggleModuleForProfile = async (moduleKey: string, checked: boolean) => {
    if (!current) return;
    setSaving(true);
    try {
      const updated = checked
        ? disabledModules.filter((k) => k !== moduleKey)
        : Array.from(new Set([...disabledModules, moduleKey]));

      await setUserDisabledModules({ userId: current.id, disabledModules: updated });
      setProfiles((prev) => prev.map((p) => (p.id === current.id ? { ...p, disabled_modules: updated } : p)));
      toast.success('Acesso do módulo atualizado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar módulo.');
    } finally {
      setSaving(false);
    }
  };

  const toggleWhatsappCardForProfile = async (checked: boolean) => {
    if (!current) return;
    setSaving(true);
    try {
      const ui = await fetchProfessionalUiSettings({ professionalId: current.id });
      await upsertProfessionalUiSettings({
        professionalId: current.id,
        showSessionPhotos: ui.show_session_photos,
        showWhatsappUltraMsg: checked,
      });
      setShowWhatsappCard(checked);
      toast.success(
        checked
          ? 'Card de conexão WhatsApp habilitado no perfil do profissional.'
          : 'Card de conexão WhatsApp oculto no perfil do profissional.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar WhatsApp no perfil.');
    } finally {
      setSaving(false);
    }
  };

  if (!canAccess) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Módulos</h1>
        <p className="text-muted-foreground text-sm mt-1">Controle de exibição de itens por profissional.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Carregando...</span>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Profissional</p>
                <Select value={professionalId} onValueChange={setProfessionalId} disabled={saving || profiles.length === 0}>
                  <SelectTrigger className="rounded-xl h-10">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name || p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4 border-t space-y-4">
                <div>
                  <p className="text-sm font-semibold mb-1">WhatsApp (Evolution API)</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Habilita o card com QR Code em <span className="font-medium">Configurações → Meu perfil</span> para
                    o profissional conectar o número.
                  </p>
                  <div className="rounded-xl border bg-card p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Mostrar conexão WhatsApp no perfil</p>
                        <p className="text-xs text-muted-foreground">
                          Exibe o QR Code para vincular o WhatsApp via Evolution API.
                        </p>
                      </div>
                      <Switch
                        checked={showWhatsappCard}
                        onCheckedChange={(checked) => void toggleWhatsappCardForProfile(checked === true)}
                        disabled={saving || loadingWhatsappSetting || !current}
                        aria-label="Mostrar card WhatsApp no perfil do profissional"
                      />
                    </div>
                  </div>
                </div>

                <div>
                <p className="text-sm font-semibold mb-3">Módulos do menu</p>
                <div className="rounded-xl border bg-card p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Programa de Botox</p>
                      <p className="text-xs text-muted-foreground">Controla se o item aparece no menu do profissional.</p>
                    </div>
                    <Switch
                      checked={isBotoxModuleEnabled}
                      onCheckedChange={(checked) => toggleModuleForProfile(MODULE_KEY_PROGRAMA_BOTOX, checked === true)}
                      disabled={saving || !current}
                      aria-label="Habilitar Programa de Botox"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Anotações</p>
                      <p className="text-xs text-muted-foreground">Controla se o item aparece no menu do profissional.</p>
                    </div>
                    <Switch
                      checked={isAnotacoesModuleEnabled}
                      onCheckedChange={(checked) => toggleModuleForProfile(MODULE_KEY_ANOTACOES, checked === true)}
                      disabled={saving || !current}
                      aria-label="Habilitar Anotações"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Atendimento</p>
                      <p className="text-xs text-muted-foreground">
                        Inbox WhatsApp quando o paciente escolhe &quot;Falar com o profissional&quot;.
                      </p>
                    </div>
                    <Switch
                      checked={isAtendimentoModuleEnabled}
                      onCheckedChange={(checked) => toggleModuleForProfile(MODULE_KEY_ATENDIMENTO, checked === true)}
                      disabled={saving || !current}
                      aria-label="Habilitar Atendimento"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Entradas NF (Insumos)</p>
                      <p className="text-xs text-muted-foreground">Controla se o item aparece no menu do profissional.</p>
                    </div>
                    <Switch
                      checked={isInsumosModuleEnabled}
                      onCheckedChange={(checked) => toggleModuleForProfile(MODULE_KEY_INSUMOS_NF, checked === true)}
                      disabled={saving || !current}
                      aria-label="Habilitar Entradas NF (Insumos)"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Orçamentos</p>
                      <p className="text-xs text-muted-foreground">Controla se o item aparece no menu do profissional.</p>
                    </div>
                    <Switch
                      checked={isOrcamentoModuleEnabled}
                      onCheckedChange={(checked) => toggleModuleForProfile(MODULE_KEY_ORCAMENTO, checked === true)}
                      disabled={saving || !current}
                      aria-label="Habilitar Orçamentos"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Fluxo de caixa</p>
                      <p className="text-xs text-muted-foreground">Controla se o item aparece no menu do profissional.</p>
                    </div>
                    <Switch
                      checked={isFluxoCaixaModuleEnabled}
                      onCheckedChange={(checked) => toggleModuleForProfile(MODULE_KEY_FLUXO_CAIXA, checked === true)}
                      disabled={saving || !current}
                      aria-label="Habilitar Fluxo de caixa"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Cobrança</p>
                      <p className="text-xs text-muted-foreground">Controla se o item aparece no menu do profissional.</p>
                    </div>
                    <Switch
                      checked={isCobrancaModuleEnabled}
                      onCheckedChange={(checked) => toggleModuleForProfile(MODULE_KEY_COBRANCA, checked === true)}
                      disabled={saving || !current}
                      aria-label="Habilitar Cobrança"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Depilação a laser</p>
                      <p className="text-xs text-muted-foreground">Controla se o item aparece no menu do profissional.</p>
                    </div>
                    <Switch
                      checked={isDepilacaoLaserModuleEnabled}
                      onCheckedChange={(checked) => toggleModuleForProfile(MODULE_KEY_DEPILACAO_LASER, checked === true)}
                      disabled={saving || !current}
                      aria-label="Habilitar Depilação a laser"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Receitas</p>
                      <p className="text-xs text-muted-foreground">Controla se o item aparece no menu do profissional.</p>
                    </div>
                    <Switch
                      checked={isReceituarioModuleEnabled}
                      onCheckedChange={(checked) => toggleModuleForProfile(MODULE_KEY_RECEITUARIO, checked === true)}
                      disabled={saving || !current}
                      aria-label="Habilitar Receitas"
                    />
                  </div>
                </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminProcedureFieldSettingsPage({
  mode = 'permissions',
  embedded = false,
}: {
  mode?: 'permissions' | 'modules';
  embedded?: boolean;
}) {
  return mode === 'modules' ? <ModulesScreen /> : <PermissionsScreen embedded={embedded} />;
}

