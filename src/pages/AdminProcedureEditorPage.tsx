import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchProcedurePermissions,
  createProcedure,
  createProcedureField,
  updateProcedure,
  deleteProcedure,
  updateProcedureField,
  deleteProcedureField,
  upsertProcedurePermission,
  type Profile,
  type Procedure,
} from '@/services/api/adminApi';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, Search, Pencil, Trash2, Eye, Plus } from 'lucide-react';
import { ProcedureFieldsScreenPreview } from '@/components/admin/ProcedureFieldsScreenPreview';
import { ProcedureSqlPanel } from '@/components/admin/ProcedureSqlPanel';
import { toast } from 'sonner';
import type { ProcedureFieldWithSettings } from '@/services/api/dynamicProcedureFieldSettingsApi';
import {
  fetchProcedureFieldSettings,
  fetchProfessionalUiSettings,
  upsertProcedureFieldSettings,
  upsertProfessionalUiSettings,
} from '@/services/api/dynamicProcedureFieldSettingsApi';
import {
  combineSqlBlocks,
  generateCreateFieldSql,
  generateCreateProcedureSql,
  generateFieldSettingsSql,
  generateProcedurePermissionsSql,
} from '@/lib/adminProcedureSql';
import {
  PROCEDURE_SPECIALTIES,
  PROCEDURE_SPECIALTY_LABELS,
  type ProcedureSpecialty,
} from '@/lib/procedureSpecialty';

const ADMIN_EMAIL = 'admin@clinievo.com.br';
const FIELD_TYPES = ['text', 'number', 'select', 'boolean', 'date', 'image'] as const;
const NEW_PROCEDURE_VALUE = '__new__';
const NEW_CATEGORY_VALUE = '__new_category__';
const MIN_FIELDS_FOR_ASSIGNMENT = 3;

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function profileLabel(p: Profile): string {
  return p.full_name || p.email;
}

export function AdminProcedureEditorPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);

  const [professionalId, setProfessionalId] = useState('');
  const [procedureId, setProcedureId] = useState('');
  const [editorMode, setEditorMode] = useState<'existing' | 'new'>('existing');

  const [fields, setFields] = useState<ProcedureFieldWithSettings[]>([]);
  const [showSessionPhotos, setShowSessionPhotos] = useState(true);
  const [showBeforeAfterGallery, setShowBeforeAfterGallery] = useState(true);
  const [showNextEvaluationSection, setShowNextEvaluationSection] = useState(true);
  const [showWhatsappUltraMsg, setShowWhatsappUltraMsg] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatedSql, setGeneratedSql] = useState('');

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [creatingProcedure, setCreatingProcedure] = useState(false);
  const [creatingField, setCreatingField] = useState(false);
  const [updatingProcedure, setUpdatingProcedure] = useState(false);
  const [deletingProcedure, setDeletingProcedure] = useState(false);
  const [updatingField, setUpdatingField] = useState(false);
  const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null);

  const [newProcedure, setNewProcedure] = useState({
    name: '',
    slug: '',
    category: '',
    specialty: '' as ProcedureSpecialty | '',
    description: '',
  });
  const [newCategoryMode, setNewCategoryMode] = useState<'existing' | 'custom'>('existing');
  const [newCategoryCustom, setNewCategoryCustom] = useState('');
  const [assignProfileIds, setAssignProfileIds] = useState<string[]>([]);
  /** Procedimento criado no passo 1, aguardando campos e atribuição a profissionais. */
  const [awaitingAssignmentProcedureId, setAwaitingAssignmentProcedureId] = useState<string | null>(null);
  const [assigningProcedure, setAssigningProcedure] = useState(false);

  const [newField, setNewField] = useState<{
    label: string;
    fieldKey: string;
    fieldType: (typeof FIELD_TYPES)[number];
    optionsCsv: string;
  }>({ label: '', fieldKey: '', fieldType: 'text', optionsCsv: '' });

  const [editProcedure, setEditProcedure] = useState({
    name: '',
    slug: '',
    category: '',
    specialty: '' as ProcedureSpecialty | '',
    description: '',
  });
  const [editingFieldId, setEditingFieldId] = useState('');
  const [editField, setEditField] = useState<{
    label: string;
    fieldKey: string;
    fieldType: (typeof FIELD_TYPES)[number];
    optionsCsv: string;
  }>({ label: '', fieldKey: '', fieldType: 'text', optionsCsv: '' });

  const [adminTab, setAdminTab] = useState<'procedimentos' | 'campos' | null>(null);
  const [fieldSearch, setFieldSearch] = useState('');

  const profileLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of profiles) map[p.id] = profileLabel(p);
    return map;
  }, [profiles]);

  const procedureCategories = useMemo(() => {
    const set = new Set(procedures.map((p) => p.category).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [procedures]);

  const isAwaitingAssignment =
    awaitingAssignmentProcedureId !== null && procedureId === awaitingAssignmentProcedureId;
  const canAssignProfessionals = isAwaitingAssignment && fields.length >= MIN_FIELDS_FOR_ASSIGNMENT;
  const fieldsUntilAssignment = Math.max(0, MIN_FIELDS_FOR_ASSIGNMENT - fields.length);

  const resolveNewProcedureCategory = () => {
    if (newCategoryMode === 'custom') return newCategoryCustom.trim();
    return newProcedure.category.trim();
  };

  useEffect(() => {
    if (isAwaitingAssignment) {
      setAdminTab('campos');
    }
  }, [isAwaitingAssignment]);

  useEffect(() => {
    if (user === null) return;
    if (!isAdmin) navigate('/dashboard', { replace: true });
  }, [user, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
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
    if (!professionalId || !procedureId || editorMode !== 'existing') {
      setFields([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        setFields([]);
        const list = await fetchProcedureFieldSettings({ professionalId, procedureId });
        if (cancelled) return;
        setFields(list.slice().sort((a, b) => a.sort_order - b.sort_order));
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Erro ao carregar campos');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [professionalId, procedureId, editorMode]);

  useEffect(() => {
    if (!professionalId) return;
    let cancelled = false;
    void (async () => {
      try {
        const ui = await fetchProfessionalUiSettings({ professionalId });
        if (cancelled) return;
        setShowSessionPhotos(ui.show_session_photos);
        setShowBeforeAfterGallery(ui.show_before_after_gallery);
        setShowNextEvaluationSection(ui.show_next_evaluation_section);
        setShowWhatsappUltraMsg(ui.show_whatsapp_ultramsg);
      } catch {
        if (!cancelled) setShowSessionPhotos(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [professionalId]);

  useEffect(() => {
    const current = procedures.find((p) => p.id === procedureId);
    if (!current) return;
    setEditProcedure({
      name: current.name ?? '',
      slug: current.slug ?? '',
      category: current.category ?? '',
      specialty: (current.specialty as ProcedureSpecialty | null | undefined) ?? '',
      description: current.description ?? '',
    });
  }, [procedureId, procedures]);

  useEffect(() => {
    if (!editingFieldId) {
      setEditField({ label: '', fieldKey: '', fieldType: 'text', optionsCsv: '' });
      return;
    }
    const f = fields.find((x) => x.id === editingFieldId);
    if (!f) return;
    const options = Array.isArray(f.options) ? (f.options as string[]).join(', ') : '';
    const fieldType = FIELD_TYPES.includes(f.field_type as (typeof FIELD_TYPES)[number])
      ? (f.field_type as (typeof FIELD_TYPES)[number])
      : 'text';
    setEditField({ label: f.label, fieldKey: f.field_key, fieldType, optionsCsv: options });
  }, [editingFieldId, fields]);

  const appendSql = (block: string) => {
    setGeneratedSql((prev) => combineSqlBlocks([prev, block]));
  };

  const handleProfessionalChange = (id: string) => {
    setProfessionalId(id);
    setProcedureId('');
    setEditorMode('existing');
    setFields([]);
    if (!assignProfileIds.includes(id)) {
      setAssignProfileIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }
  };

  const handleProcedureChange = (value: string) => {
    if (value === NEW_PROCEDURE_VALUE) {
      setEditorMode('new');
      setProcedureId('');
      setFields([]);
      setAwaitingAssignmentProcedureId(null);
      setNewProcedure({ name: '', slug: '', category: '', description: '' });
      setNewCategoryMode('existing');
      setNewCategoryCustom('');
      setAdminTab(null);
      return;
    }
    setEditorMode('existing');
    setProcedureId(value);
    setAdminTab(null);
    if (value !== awaitingAssignmentProcedureId) {
      setAwaitingAssignmentProcedureId(null);
    }
  };

  const toggleAssignProfile = (id: string, checked: boolean) => {
    setAssignProfileIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  const reloadFields = async () => {
    if (!professionalId || !procedureId) return;
    const list = await fetchProcedureFieldSettings({ professionalId, procedureId });
    setFields(list.slice().sort((a, b) => a.sort_order - b.sort_order));
  };

  const save = async () => {
    if (!professionalId || !procedureId) return;
    const proc = procedures.find((p) => p.id === procedureId);
    if (!proc) return;

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

      const sql = generateFieldSettingsSql({
        procedureSlug: proc.slug,
        professionalId,
        professionalLabel: profileLabels[professionalId],
        fields: fields.map((f, idx) => ({
          fieldKey: f.field_key,
          isActive: f.is_active,
          isRequired: f.is_required && f.is_active,
          sortOrder: idx + 1,
        })),
      });
      appendSql(sql);
      toast.success('Configurações salvas no banco. SQL gerado abaixo.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProcedureBase = async () => {
    const name = newProcedure.name.trim();
    const slug = (newProcedure.slug.trim() || slugify(name)).trim();
    const category = resolveNewProcedureCategory();
    if (!name || !slug) {
      toast.error('Preencha o nome do procedimento.');
      return;
    }
    if (!category) {
      toast.error('Selecione ou informe a categoria do procedimento.');
      return;
    }

    const specialty = newProcedure.specialty || null;
    if (!specialty) {
      toast.error('Selecione a especialidade do procedimento.');
      return;
    }

    setCreatingProcedure(true);
    try {
      const description = newProcedure.description;
      const created = await createProcedure({ name, slug, category, specialty, description });

      setProcedures((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      setProcedureId(created.id);
      setEditorMode('existing');
      setAwaitingAssignmentProcedureId(created.id);
      setAdminTab('campos');
      setNewProcedure({ name: '', slug: '', category: '', specialty: '', description: '' });
      setNewCategoryMode('existing');
      setNewCategoryCustom('');

      appendSql(
        generateCreateProcedureSql({
          name,
          slug,
          category,
          description,
          profileIds: [],
          profileLabels,
        })
      );

      toast.success('Procedimento criado. Agora adicione pelo menos 3 campos.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar procedimento');
    } finally {
      setCreatingProcedure(false);
    }
  };

  const handleAssignProcedure = async () => {
    if (!procedureId || !canAssignProfessionals) return;
    const proc = procedures.find((p) => p.id === procedureId);
    if (!proc) return;

    const targetProfiles = assignProfileIds.length > 0 ? assignProfileIds : professionalId ? [professionalId] : [];
    if (targetProfiles.length === 0) {
      toast.error('Selecione ao menos um profissional para atribuir o procedimento.');
      return;
    }

    setAssigningProcedure(true);
    try {
      for (const profileId of targetProfiles) {
        await upsertProcedurePermission({ profileId, procedureId, visible: true });
      }

      appendSql(
        generateProcedurePermissionsSql({
          procedureSlug: proc.slug,
          profileIds: targetProfiles,
          profileLabels,
        })
      );

      setAwaitingAssignmentProcedureId(null);
      toast.success('Procedimento atribuído aos profissionais selecionados.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atribuir procedimento');
    } finally {
      setAssigningProcedure(false);
    }
  };

  const handleCreateField = async () => {
    if (!procedureId || !professionalId) return;
    const proc = procedures.find((p) => p.id === procedureId);
    if (!proc) return;

    const label = newField.label.trim();
    const fieldKey = (newField.fieldKey.trim() || slugify(label).replace(/-/g, '_')).trim();
    if (!label || !fieldKey) {
      toast.error('Preencha o nome e a chave do campo.');
      return;
    }
    const options =
      newField.fieldType === 'select'
        ? newField.optionsCsv.split(',').map((v) => v.trim()).filter(Boolean)
        : [];
    if (newField.fieldType === 'select' && options.length === 0) {
      toast.error('Informe ao menos uma opção para campo select.');
      return;
    }

    setCreatingField(true);
    try {
      await createProcedureField({
        procedureId,
        fieldKey,
        label,
        fieldType: newField.fieldType,
        options,
        sortOrder: fields.length + 1,
      });
      await reloadFields();
      setNewField({ label: '', fieldKey: '', fieldType: 'text', optionsCsv: '' });

      appendSql(
        generateCreateFieldSql({
          procedureSlug: proc.slug,
          fieldKey,
          label,
          fieldType: newField.fieldType,
          options,
          sortOrder: fields.length + 1,
          professionalId,
          professionalLabel: profileLabels[professionalId],
          isActive: true,
          isRequired: false,
        })
      );

      toast.success(
        fields.length + 1 >= MIN_FIELDS_FOR_ASSIGNMENT
          ? 'Campo criado. Você já pode atribuir o procedimento aos profissionais.'
          : 'Campo criado. SQL gerado para este profissional.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar campo');
    } finally {
      setCreatingField(false);
    }
  };

  const handleUpdateProcedure = async () => {
    if (!procedureId) return;
    const name = editProcedure.name.trim();
    const slug = editProcedure.slug.trim();
    const category = editProcedure.category.trim();
    const specialty = editProcedure.specialty || null;
    if (!name || !slug || !category) {
      toast.error('Preencha nome, slug e categoria.');
      return;
    }
    if (!specialty) {
      toast.error('Selecione a especialidade.');
      return;
    }
    setUpdatingProcedure(true);
    try {
      const updated = await updateProcedure({
        procedureId,
        name,
        slug,
        category,
        specialty,
        description: editProcedure.description,
      });
      setProcedures((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      toast.success('Procedimento atualizado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar procedimento');
    } finally {
      setUpdatingProcedure(false);
    }
  };

  const handleDeleteProcedure = async () => {
    if (!procedureId) return;
    const current = procedures.find((p) => p.id === procedureId);
    const ok = window.confirm(`Excluir procedimento "${current?.name ?? ''}"? Esta ação remove também os campos.`);
    if (!ok) return;
    setDeletingProcedure(true);
    try {
      await deleteProcedure(procedureId);
      const next = procedures.filter((p) => p.id !== procedureId);
      setProcedures(next);
      setProcedureId('');
      setEditorMode('existing');
      setFields([]);
      toast.success('Procedimento excluído.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir procedimento');
    } finally {
      setDeletingProcedure(false);
    }
  };

  const handleUpdateField = async () => {
    if (!editingFieldId) return;
    const label = editField.label.trim();
    const fieldKey = editField.fieldKey.trim();
    if (!label || !fieldKey) {
      toast.error('Preencha o nome e a chave do campo.');
      return;
    }
    const options =
      editField.fieldType === 'select'
        ? editField.optionsCsv.split(',').map((v) => v.trim()).filter(Boolean)
        : [];
    if (editField.fieldType === 'select' && options.length === 0) {
      toast.error('Informe ao menos uma opção para campo select.');
      return;
    }
    setUpdatingField(true);
    try {
      await updateProcedureField({
        fieldId: editingFieldId,
        fieldKey,
        label,
        fieldType: editField.fieldType,
        options,
      });
      await reloadFields();
      toast.success('Campo atualizado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar campo');
    } finally {
      setUpdatingField(false);
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    const f = fields.find((x) => x.id === fieldId);
    const ok = window.confirm(`Excluir campo "${f?.label ?? ''}"?`);
    if (!ok) return;
    setDeletingFieldId(fieldId);
    try {
      await deleteProcedureField(fieldId);
      await reloadFields();
      if (editingFieldId === fieldId) setEditingFieldId('');
      toast.success('Campo excluído.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir campo');
    } finally {
      setDeletingFieldId(null);
    }
  };

  const reorder = (from: number, to: number) => {
    setFields((prev) => {
      const next = prev.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const currentProfileName = profileLabels[professionalId] ?? 'Não selecionado';
  const currentProcedure = procedures.find((p) => p.id === procedureId);
  const currentProcedureName = currentProcedure?.name ?? 'Não selecionado';
  const currentProcedureSlug = currentProcedure?.slug ?? '';
  const hasProcedureSelected = editorMode === 'existing' && Boolean(procedureId);
  const hasFields = fields.length > 0;

  const renderedFields = useMemo(() => {
    const query = fieldSearch.trim().toLowerCase();
    if (!query) return fields;
    return fields.filter((f) => `${f.label} ${f.field_key} ${f.field_type}`.toLowerCase().includes(query));
  }, [fields, fieldSearch]);

  if (!isAdmin) return null;

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      {!embedded ? (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Criar / modificar procedimento</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monte a tela do procedimento com prévia em tempo real e gere o SQL para arquivar no banco.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Seleção</CardTitle>
          <p className="text-sm text-muted-foreground">
            Escolha o profissional de referência (prévia) e o procedimento a criar ou editar.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Profissional (prévia)</p>
              <Select value={professionalId || undefined} onValueChange={handleProfessionalChange} disabled={loading}>
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {profileLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Procedimento</p>
              <Select
                value={editorMode === 'new' ? NEW_PROCEDURE_VALUE : procedureId || undefined}
                onValueChange={handleProcedureChange}
                disabled={loading || !professionalId}
              >
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue placeholder="Selecione ou crie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_PROCEDURE_VALUE}>
                    <span className="flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Criar novo procedimento
                    </span>
                  </SelectItem>
                  {procedures.length > 0 ? <SelectSeparator /> : null}
                  {procedures.map((proc) => (
                    <SelectItem key={proc.id} value={proc.id}>
                      {proc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              {hasProcedureSelected ? (
                <Button onClick={() => void save()} disabled={saving || !hasFields} className="w-full md:w-auto">
                  {saving ? 'Salvando...' : 'Salvar configurações do profissional'}
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {editorMode === 'new' && professionalId ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Passo 1 — Dados do procedimento</CardTitle>
            <p className="text-sm text-muted-foreground">
              Defina nome e categoria. Depois você criará os campos e, com pelo menos 3 campos, poderá atribuir a
              profissionais.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Nome do procedimento"
                value={newProcedure.name}
                onChange={(e) =>
                  setNewProcedure((prev) => ({
                    ...prev,
                    name: e.target.value,
                    slug: prev.slug ? prev.slug : slugify(e.target.value),
                  }))
                }
              />
              <Input
                placeholder="Slug (ex: novo-procedimento)"
                value={newProcedure.slug}
                onChange={(e) => setNewProcedure((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
              />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Categoria</p>
                <Select
                  value={newCategoryMode === 'custom' ? NEW_CATEGORY_VALUE : newProcedure.category || undefined}
                  onValueChange={(v) => {
                    if (v === NEW_CATEGORY_VALUE) {
                      setNewCategoryMode('custom');
                      setNewProcedure((prev) => ({ ...prev, category: '' }));
                      return;
                    }
                    setNewCategoryMode('existing');
                    setNewCategoryCustom('');
                    setNewProcedure((prev) => ({ ...prev, category: v }));
                  }}
                >
                  <SelectTrigger className="rounded-xl h-10">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {procedureCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                    {procedureCategories.length > 0 ? <SelectSeparator /> : null}
                    <SelectItem value={NEW_CATEGORY_VALUE}>Nova categoria...</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Especialidade</p>
                <Select
                  value={newProcedure.specialty || undefined}
                  onValueChange={(v) =>
                    setNewProcedure((prev) => ({ ...prev, specialty: v as ProcedureSpecialty }))
                  }
                >
                  <SelectTrigger className="rounded-xl h-10">
                    <SelectValue placeholder="Selecione a especialidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROCEDURE_SPECIALTIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {PROCEDURE_SPECIALTY_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {newCategoryMode === 'custom' ? (
                <Input
                  placeholder="Nome da nova categoria"
                  value={newCategoryCustom}
                  onChange={(e) => setNewCategoryCustom(e.target.value)}
                />
              ) : (
                <Input
                  placeholder="Descrição (opcional)"
                  value={newProcedure.description}
                  onChange={(e) => setNewProcedure((prev) => ({ ...prev, description: e.target.value }))}
                />
              )}
              {newCategoryMode === 'custom' ? (
                <Input
                  className="md:col-span-2"
                  placeholder="Descrição (opcional)"
                  value={newProcedure.description}
                  onChange={(e) => setNewProcedure((prev) => ({ ...prev, description: e.target.value }))}
                />
              ) : null}
            </div>

            <Button
              type="button"
              onClick={() => void handleCreateProcedureBase()}
              disabled={
                creatingProcedure ||
                !newProcedure.name.trim() ||
                !resolveNewProcedureCategory() ||
                !newProcedure.specialty
              }
            >
              {creatingProcedure ? 'Criando...' : 'Criar procedimento e ir para os campos'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {hasProcedureSelected ? (
        <>
          <div className="sticky top-2 z-20">
            <Card className="border-primary/20 bg-background/95 backdrop-blur">
              <CardContent className="py-3">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Profissional:</span>{' '}
                    <span className="font-medium">{currentProfileName}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Procedimento:</span>{' '}
                    <span className="font-medium">{currentProcedureName}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Campos:</span>{' '}
                    <span className="font-medium">{fields.length}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {isAwaitingAssignment ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-4 space-y-3">
                <p className="text-sm font-medium">
                  Passo 2 — Criar campos ({fields.length}/{MIN_FIELDS_FOR_ASSIGNMENT})
                </p>
                <p className="text-xs text-muted-foreground">
                  {canAssignProfessionals
                    ? 'Campos mínimos criados. Agora você pode atribuir o procedimento aos profissionais abaixo.'
                    : `Adicione mais ${fieldsUntilAssignment} campo${fieldsUntilAssignment === 1 ? '' : 's'} para liberar a atribuição.`}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {canAssignProfessionals ? (
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Passo 3 — Atribuir a profissionais</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Escolha quem verá este procedimento no menu. O profissional da prévia já vem sugerido.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-xl border p-4">
                  {profiles.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={assignProfileIds.includes(p.id)}
                        onCheckedChange={(c) => toggleAssignProfile(p.id, c === true)}
                      />
                      <span className="truncate">{profileLabel(p)}</span>
                    </label>
                  ))}
                </div>
                <Button
                  type="button"
                  onClick={() => void handleAssignProcedure()}
                  disabled={assigningProcedure || assignProfileIds.length === 0}
                >
                  {assigningProcedure ? 'Atribuindo...' : 'Atribuir procedimento e gerar SQL'}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Cadastro</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {!isAwaitingAssignment ? (
                  <div className="grid w-full grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant={adminTab === 'procedimentos' ? 'default' : 'outline'}
                      onClick={() => setAdminTab('procedimentos')}
                      className="h-11"
                    >
                      Editar procedimento
                    </Button>
                    <Button
                      type="button"
                      variant={adminTab === 'campos' ? 'default' : 'outline'}
                      onClick={() => setAdminTab('campos')}
                      className="h-11"
                    >
                      Criar novos campos
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Crie os campos do procedimento. A edição avançada do procedimento fica disponível após a
                    atribuição.
                  </p>
                )}

                {!isAwaitingAssignment && adminTab === 'procedimentos' ? (
                  <Accordion type="single" collapsible className="rounded-xl border px-4">
                    <AccordionItem value="edit-procedure" className="border-b-0">
                      <AccordionTrigger className="py-3 text-sm font-medium">
                        Editar / excluir procedimento selecionado
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input
                              placeholder="Nome"
                              value={editProcedure.name}
                              onChange={(e) => setEditProcedure((prev) => ({ ...prev, name: e.target.value }))}
                            />
                            <Input
                              placeholder="Slug"
                              value={editProcedure.slug}
                              onChange={(e) =>
                                setEditProcedure((prev) => ({ ...prev, slug: slugify(e.target.value) }))
                              }
                            />
                            <Input
                              placeholder="Categoria"
                              value={editProcedure.category}
                              onChange={(e) => setEditProcedure((prev) => ({ ...prev, category: e.target.value }))}
                            />
                            <div className="space-y-1.5">
                              <Select
                                value={editProcedure.specialty || undefined}
                                onValueChange={(v) =>
                                  setEditProcedure((prev) => ({
                                    ...prev,
                                    specialty: v as ProcedureSpecialty,
                                  }))
                                }
                              >
                                <SelectTrigger className="rounded-xl h-10">
                                  <SelectValue placeholder="Especialidade" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PROCEDURE_SPECIALTIES.map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {PROCEDURE_SPECIALTY_LABELS[s]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Input
                              placeholder="Descrição (opcional)"
                              value={editProcedure.description}
                              onChange={(e) => setEditProcedure((prev) => ({ ...prev, description: e.target.value }))}
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              onClick={() => void handleUpdateProcedure()}
                              disabled={updatingProcedure || deletingProcedure}
                              variant="outline"
                            >
                              {updatingProcedure ? 'Salvando...' : 'Salvar edição'}
                            </Button>
                            <Button
                              type="button"
                              onClick={() => void handleDeleteProcedure()}
                              disabled={deletingProcedure}
                              variant="destructive"
                            >
                              {deletingProcedure ? 'Excluindo...' : 'Excluir procedimento'}
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ) : isAwaitingAssignment || adminTab === 'campos' ? (
                  <div className="space-y-6">
                    <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                      <p className="text-sm font-medium">Novo campo</p>
                      <p className="text-xs text-muted-foreground">
                        O campo é criado no procedimento e a configuração inicial é gerada somente para{' '}
                        <span className="font-medium">{currentProfileName}</span>.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                          placeholder="Label do campo"
                          value={newField.label}
                          onChange={(e) =>
                            setNewField((prev) => ({
                              ...prev,
                              label: e.target.value,
                              fieldKey: prev.fieldKey ? prev.fieldKey : slugify(e.target.value).replace(/-/g, '_'),
                            }))
                          }
                        />
                        <Input
                          placeholder="field_key (ex: tipo_pele)"
                          value={newField.fieldKey}
                          onChange={(e) =>
                            setNewField((prev) => ({
                              ...prev,
                              fieldKey: e.target.value
                                .normalize('NFD')
                                .replace(/[\u0300-\u036f]/g, '')
                                .toLowerCase()
                                .replace(/[^a-z0-9_]+/g, '_')
                                .replace(/^_+|_+$/g, ''),
                            }))
                          }
                        />
                        <Select
                          value={newField.fieldType}
                          onValueChange={(v) =>
                            setNewField((prev) => ({ ...prev, fieldType: v as (typeof FIELD_TYPES)[number] }))
                          }
                        >
                          <SelectTrigger className="rounded-xl h-10">
                            <SelectValue placeholder="Tipo de campo" />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Opções (select), separadas por vírgula"
                          value={newField.optionsCsv}
                          disabled={newField.fieldType !== 'select'}
                          onChange={(e) => setNewField((prev) => ({ ...prev, optionsCsv: e.target.value }))}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={() => void handleCreateField()}
                        disabled={creatingField}
                        className="w-full md:w-auto"
                      >
                        {creatingField ? 'Criando...' : 'Criar campo e gerar SQL'}
                      </Button>
                    </div>

                    <div className="space-y-3 rounded-xl border p-4">
                      <p className="text-sm font-medium">Editar campo existente</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Select value={editingFieldId} onValueChange={setEditingFieldId} disabled={fields.length === 0}>
                          <SelectTrigger className="rounded-xl h-10">
                            <SelectValue placeholder="Selecione um campo" />
                          </SelectTrigger>
                          <SelectContent>
                            {fields.map((f) => (
                              <SelectItem key={f.id} value={f.id}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Label"
                          value={editField.label}
                          onChange={(e) => setEditField((prev) => ({ ...prev, label: e.target.value }))}
                          disabled={!editingFieldId}
                        />
                        <Input
                          placeholder="field_key"
                          value={editField.fieldKey}
                          onChange={(e) =>
                            setEditField((prev) => ({
                              ...prev,
                              fieldKey: e.target.value
                                .normalize('NFD')
                                .replace(/[\u0300-\u036f]/g, '')
                                .toLowerCase()
                                .replace(/[^a-z0-9_]+/g, '_')
                                .replace(/^_+|_+$/g, ''),
                            }))
                          }
                          disabled={!editingFieldId}
                        />
                        <Select
                          value={editField.fieldType}
                          onValueChange={(v) =>
                            setEditField((prev) => ({ ...prev, fieldType: v as (typeof FIELD_TYPES)[number] }))
                          }
                          disabled={!editingFieldId}
                        >
                          <SelectTrigger className="rounded-xl h-10">
                            <SelectValue placeholder="Tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Opções (select)"
                          value={editField.optionsCsv}
                          disabled={!editingFieldId || editField.fieldType !== 'select'}
                          onChange={(e) => setEditField((prev) => ({ ...prev, optionsCsv: e.target.value }))}
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={() => void handleUpdateField()}
                        disabled={updatingField || !editingFieldId}
                        variant="outline"
                      >
                        {updatingField ? 'Salvando...' : 'Salvar edição do campo'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Use os botões acima para editar o procedimento ou adicionar campos.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Campos do procedimento</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure visibilidade e obrigatoriedade para{' '}
                  <span className="font-medium text-foreground">{currentProfileName}</span>.
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Carregando...</span>
                  </div>
                ) : !hasFields ? (
                  <p className="text-muted-foreground py-6 text-sm">
                    Nenhum campo ainda. Use &quot;Criar novos campos&quot; para adicionar.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Arraste para ordenar. Salve para gerar o SQL.</p>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        placeholder="Buscar campo"
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
                              <p className="font-medium text-sm truncate">{f.label}</p>
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
                                      return {
                                        ...x,
                                        is_active: nextActive,
                                        is_required: nextActive ? x.is_required : false,
                                      };
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
                              />
                              <span className="text-xs text-muted-foreground">Obrigatório</span>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setAdminTab('campos');
                                setEditingFieldId(f.id);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              onClick={() => void handleDeleteField(f.id)}
                              disabled={deletingFieldId === f.id}
                            >
                              {deletingFieldId === f.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-xl border p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Fotos da sessão</p>
                        <p className="text-xs text-muted-foreground">Card geral da tela de consulta.</p>
                      </div>
                      <Switch checked={showSessionPhotos} onCheckedChange={(v) => setShowSessionPhotos(v === true)} />
                    </div>
                    <div className="rounded-xl border p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Galeria Antes e Depois</p>
                        <p className="text-xs text-muted-foreground">
                          Card de upload e pares editáveis dentro de cada procedimento.
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
                          Card de prazo e agendamento da próxima avaliação.
                        </p>
                      </div>
                      <Switch
                        checked={showNextEvaluationSection}
                        onCheckedChange={(v) => setShowNextEvaluationSection(v === true)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="xl:sticky xl:top-20">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" aria-hidden />
                  Prévia da tela
                </CardTitle>
                <p className="text-sm text-muted-foreground">Atualiza em tempo real conforme você configura os campos.</p>
              </CardHeader>
              <CardContent className="pt-2">
                <ProcedureFieldsScreenPreview
                  procedureName={currentProcedureName}
                  procedureSlug={currentProcedureSlug}
                  professionalId={professionalId}
                  fields={fields}
                  showSessionPhotos={showSessionPhotos}
                  showBeforeAfterGallery={showBeforeAfterGallery}
                  showNextEvaluationSection={showNextEvaluationSection}
                />
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      <ProcedureSqlPanel sql={generatedSql} onClear={() => setGeneratedSql('')} />
    </div>
  );
}

export default AdminProcedureEditorPage;
