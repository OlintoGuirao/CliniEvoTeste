import { useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useClinicMaster } from '@/hooks/use-clinic-master';
import {
  deactivateClinicProcedure,
  fetchClinicProceduresAdmin,
  upsertClinicProcedure,
  type ClinicProcedureCatalogItem,
  type OrganizationProcedureRow,
} from '@/services/api/clinicProceduresApi';
import { fetchClinicBranchesAdmin } from '@/services/api/clinicBranchesApi';
import { specialtyLabel } from '@/lib/procedureSpecialty';
import {
  CLINIC_PRICE_TIER_FIELDS,
  CLINIC_PRICE_TIER_LABELS,
  EMPTY_CLINIC_PRICE_FIELDS,
  normalizeClinicPriceFields,
  type ClinicPriceFieldsInput,
} from '@/lib/clinicPriceTiers';
import {
  matchClinicProcedurePrices,
  parseClinicProcedurePriceSheet,
  type ClinicPriceImportMatch,
  type ClinicPriceSheetRow,
} from '@/lib/clinicProcedurePriceImport';
import { ClinicProcedurePriceTable } from '@/components/clinic/ClinicProcedurePriceTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Building2, FileSpreadsheet, Loader2, Pencil, Plus, Stethoscope, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type PriceDraft = ClinicPriceFieldsInput & {
  procedure_id: string;
  use_branch_prices: boolean;
  branch_prices: Record<string, ClinicPriceFieldsInput>;
};

const PRICE_FIELD_KEYS = Object.values(CLINIC_PRICE_TIER_FIELDS);

function emptyDraft(): PriceDraft {
  return {
    procedure_id: '',
    ...EMPTY_CLINIC_PRICE_FIELDS,
    use_branch_prices: false,
    branch_prices: {},
  };
}

function parseMoney(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let normalized = trimmed.replace(/[^\d,.-]/g, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function moneyToInput(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '';
  return String(value).replace('.', ',');
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pricesFromRow(
  row: Pick<OrganizationProcedureRow, (typeof PRICE_FIELD_KEYS)[number]>
): ClinicPriceFieldsInput {
  return {
    price_oficial: moneyToInput(row.price_oficial),
    price_particular: moneyToInput(row.price_particular),
    price_parcerias: moneyToInput(row.price_parcerias),
    price_funcionarios: moneyToInput(row.price_funcionarios),
    price_convenio: moneyToInput(row.price_convenio),
  };
}

function parsePricesFromFields(fields: ClinicPriceFieldsInput) {
  const normalized = normalizeClinicPriceFields(fields);
  return {
    price_oficial: parseMoney(normalized.price_oficial),
    price_parcerias: parseMoney(normalized.price_parcerias),
    price_funcionarios: parseMoney(normalized.price_funcionarios),
    price_particular: parseMoney(normalized.price_particular),
    price_convenio: parseMoney(normalized.price_convenio),
  };
}

function draftFromRow(row: OrganizationProcedureRow, branchIds: string[]): PriceDraft {
  const branch_prices: Record<string, ClinicPriceFieldsInput> = {};
  const defaults = pricesFromRow(row);
  for (const id of branchIds) {
    branch_prices[id] = { ...defaults };
  }
  for (const bp of row.branch_prices ?? []) {
    branch_prices[bp.branch_id] = normalizeClinicPriceFields(pricesFromRow(bp));
  }
  return {
    procedure_id: row.procedure_id,
    ...defaults,
    use_branch_prices: (row.branch_prices?.length ?? 0) > 0,
    branch_prices,
  };
}

export default function SettingsClinicProcedures() {
  const { isMaster, isClinicAccount, isLoading: masterLoading } = useClinicMaster();
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['clinic-procedures-admin'],
    enabled: Boolean(isMaster),
    queryFn: fetchClinicProceduresAdmin,
  });

  const branchesQuery = useQuery({
    queryKey: ['clinic-branches-admin'],
    enabled: Boolean(isMaster),
    queryFn: fetchClinicBranchesAdmin,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PriceDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importParsing, setImportParsing] = useState(false);
  const [importSaving, setImportSaving] = useState(false);
  const [importMatched, setImportMatched] = useState<
    ClinicPriceImportMatch<ClinicProcedureCatalogItem>[]
  >([]);
  const [importMissing, setImportMissing] = useState<ClinicPriceSheetRow[]>([]);
  const importFileRef = useRef<HTMLInputElement>(null);

  const catalog = listQuery.data?.catalog ?? [];
  const branches = useMemo(
    () => (branchesQuery.data ?? []).filter((b) => b.is_active),
    [branchesQuery.data]
  );
  const branchIds = useMemo(() => branches.map((b) => b.id), [branches]);

  const orgRows = useMemo(
    () => (listQuery.data?.organization_procedures ?? []).filter((r) => r.is_active),
    [listQuery.data?.organization_procedures]
  );

  const activeProcedureIds = useMemo(
    () => new Set(orgRows.map((r) => r.procedure_id)),
    [orgRows]
  );

  const availableCatalog = useMemo(
    () => catalog.filter((p) => !activeProcedureIds.has(p.id) || p.id === draft.procedure_id),
    [catalog, activeProcedureIds, draft.procedure_id]
  );

  const selectedCatalogItem: ClinicProcedureCatalogItem | undefined = useMemo(
    () => catalog.find((p) => p.id === draft.procedure_id),
    [catalog, draft.procedure_id]
  );

  if (!masterLoading && (!isClinicAccount || !isMaster)) {
    return <Navigate to="/settings" replace />;
  }

  const seedBranchPricesFromDefault = (base: ClinicPriceFieldsInput): Record<string, ClinicPriceFieldsInput> => {
    const next: Record<string, ClinicPriceFieldsInput> = {};
    for (const id of branchIds) {
      next[id] = { ...base };
    }
    return next;
  };

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setDialogOpen(true);
  };

  const openEdit = (row: OrganizationProcedureRow) => {
    setEditingId(row.procedure_id);
    setDraft(draftFromRow(row, branchIds));
    setDialogOpen(true);
  };

  const setUseBranchPrices = (enabled: boolean) => {
    setDraft((d) => ({
      ...d,
      use_branch_prices: enabled,
      branch_prices: enabled
        ? Object.keys(d.branch_prices).length
          ? d.branch_prices
          : seedBranchPricesFromDefault({
              price_oficial: d.price_oficial,
              price_particular: d.price_particular,
              price_parcerias: d.price_parcerias,
              price_funcionarios: d.price_funcionarios,
              price_convenio: d.price_convenio,
            })
        : d.branch_prices,
    }));
  };

  const handleSave = async () => {
    if (!draft.procedure_id) {
      toast.error('Selecione o procedimento.');
      return;
    }
    if (draft.use_branch_prices && branches.length === 0) {
      toast.error('Cadastre ao menos uma filial para vincular preços por unidade.');
      return;
    }
    setSaving(true);
    try {
      const defaultPrices = parsePricesFromFields(draft);
      await upsertClinicProcedure({
        procedure_id: draft.procedure_id,
        is_active: true,
        ...defaultPrices,
        use_branch_prices: draft.use_branch_prices,
        branch_prices: draft.use_branch_prices
          ? branches.map((b) => {
              const prices = draft.branch_prices[b.id] ?? EMPTY_CLINIC_PRICE_FIELDS;
              return {
                branch_id: b.id,
                ...parsePricesFromFields(prices),
              };
            })
          : [],
      });
      toast.success(editingId ? 'Preços atualizados.' : 'Procedimento adicionado à clínica.');
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['clinic-procedures-admin'] });
      await queryClient.invalidateQueries({ queryKey: ['organization-procedure-prices'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (procedureId: string) => {
    setDeactivatingId(procedureId);
    try {
      await deactivateClinicProcedure(procedureId);
      toast.success('Procedimento removido da precificação da clínica.');
      await queryClient.invalidateQueries({ queryKey: ['clinic-procedures-admin'] });
      await queryClient.invalidateQueries({ queryKey: ['organization-procedure-prices'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao desativar');
    } finally {
      setDeactivatingId(null);
    }
  };

  const resetImportState = () => {
    setImportMatched([]);
    setImportMissing([]);
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const openImport = () => {
    resetImportState();
    setImportOpen(true);
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    setImportParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const rows = parseClinicProcedurePriceSheet(buffer);
      if (rows.length === 0) {
        toast.error('Nenhuma linha com nome e preço válida na planilha.');
        resetImportState();
        return;
      }
      const { matched, missing } = matchClinicProcedurePrices(rows, catalog);
      setImportMatched(matched);
      setImportMissing(missing);
      if (matched.length === 0) {
        toast.message('Nenhum procedimento da planilha bateu com o catálogo.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao ler a planilha.');
      resetImportState();
    } finally {
      setImportParsing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (importMatched.length === 0) {
      toast.error('Não há procedimentos reconhecidos para importar.');
      return;
    }
    setImportSaving(true);
    try {
      let ok = 0;
      for (const row of importMatched) {
        const existing = orgRows.find((r) => r.procedure_id === row.procedure.id);
        await upsertClinicProcedure({
          procedure_id: row.procedure.id,
          is_active: true,
          price_oficial: row.price,
          price_particular: row.price,
          price_parcerias: existing?.price_parcerias ?? null,
          price_funcionarios: existing?.price_funcionarios ?? null,
          price_convenio: existing?.price_convenio ?? null,
          use_branch_prices: (existing?.branch_prices?.length ?? 0) > 0,
          branch_prices: (existing?.branch_prices ?? []).map((bp) => ({
            branch_id: bp.branch_id,
            price_oficial: bp.price_oficial,
            price_particular: bp.price_particular,
            price_parcerias: bp.price_parcerias,
            price_funcionarios: bp.price_funcionarios,
            price_convenio: bp.price_convenio,
          })),
        });
        ok += 1;
      }
      toast.success(
        `${ok} preço${ok === 1 ? '' : 's'} importado${ok === 1 ? '' : 's'}${
          importMissing.length
            ? ` · ${importMissing.length} sem cadastro no catálogo`
            : ''
        }.`
      );
      setImportOpen(false);
      resetImportState();
      await queryClient.invalidateQueries({ queryKey: ['clinic-procedures-admin'] });
      await queryClient.invalidateQueries({ queryKey: ['organization-procedure-prices'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao importar preços.');
    } finally {
      setImportSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-primary" />
            Procedimentos e preços
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Defina o preço padrão da clínica e, se precisar, valores diferentes por filial.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center shrink-0">
          <Button type="button" variant="outline" className="gap-2" onClick={openImport}>
            <FileSpreadsheet className="h-4 w-4" />
            Importar preços da planilha
          </Button>
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Adicionar procedimento
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Procedimentos da clínica</CardTitle>
          <CardDescription>
            A especialidade vem do tipo. Preços padrão valem para todas as unidades, salvo override
            por filial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading || masterLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </div>
          ) : listQuery.isError ? (
            <p className="text-sm text-destructive py-4">
              {listQuery.error instanceof Error
                ? listQuery.error.message
                : 'Erro ao carregar procedimentos.'}
            </p>
          ) : orgRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum procedimento precificado ainda. Clique em Adicionar procedimento.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Procedimento</TableHead>
                    <TableHead>Especialidade</TableHead>
                    <TableHead>Escopo</TableHead>
                    <TableHead className="text-right">{CLINIC_PRICE_TIER_LABELS.particular}</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgRows.map((row) => {
                    const hasBranch = (row.branch_prices?.length ?? 0) > 0;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          {row.procedure?.name ?? row.procedure_id}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {specialtyLabel(row.procedure?.specialty)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {hasBranch ? (
                            <Badge variant="outline" className="gap-1 font-normal">
                              <Building2 className="h-3 w-3" />
                              {row.branch_prices!.length} filial
                              {row.branch_prices!.length === 1 ? '' : 'is'}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Todas as filiais</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(row.price_particular)}
                          <span className="block text-[10px] text-muted-foreground font-normal">
                            padrão
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(row)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              disabled={deactivatingId === row.procedure_id}
                              onClick={() => void handleDeactivate(row.procedure_id)}
                            >
                              {deactivatingId === row.procedure_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[min(92dvh,820px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 space-y-1 border-b px-4 pb-3 pt-4 pr-12 text-left sm:px-5 sm:pt-5">
            <DialogTitle>
              {editingId ? 'Editar preços' : 'Adicionar procedimento'}
            </DialogTitle>
            <DialogDescription>
              Preço padrão da clínica e, opcionalmente, valores por filial.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="space-y-1.5">
              <Label>Procedimento *</Label>
              <Select
                value={draft.procedure_id || undefined}
                disabled={Boolean(editingId)}
                onValueChange={(v) => setDraft((d) => ({ ...d, procedure_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione no catálogo" />
                </SelectTrigger>
                <SelectContent>
                  {(editingId ? catalog : availableCatalog).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Especialidade</Label>
              <Input
                readOnly
                value={
                  selectedCatalogItem
                    ? specialtyLabel(selectedCatalogItem.specialty)
                    : '—'
                }
                className="bg-muted/40"
              />
            </div>

            <div className="flex items-start gap-3 rounded-xl border bg-muted/20 px-3 py-2.5">
              <Switch
                id="use-branch-prices"
                checked={draft.use_branch_prices}
                onCheckedChange={setUseBranchPrices}
                disabled={branches.length === 0}
              />
              <Label htmlFor="use-branch-prices" className="cursor-pointer font-normal leading-snug">
                Vincular valores por filial
                <span className="block text-xs text-muted-foreground">
                  {branches.length === 0
                    ? 'Cadastre filiais em Configurações → Filiais para habilitar.'
                    : 'Cada unidade pode ter preços próprios. O padrão abaixo continua como fallback.'}
                </span>
              </Label>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tabela de preços — padrão (todas as filiais)
              </h4>
              <ClinicProcedurePriceTable
                idPrefix="default"
                values={draft}
                onChange={(key, value) => setDraft((d) => ({ ...d, [key]: value }))}
              />
            </div>

            {draft.use_branch_prices && branches.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tabela por filial
                </h4>
                <Accordion type="multiple" className="rounded-xl border px-2">
                  {branches.map((branch) => {
                    const values = normalizeClinicPriceFields(
                      draft.branch_prices[branch.id] ?? EMPTY_CLINIC_PRICE_FIELDS
                    );
                    return (
                      <AccordionItem key={branch.id} value={branch.id} className="border-b-0">
                        <AccordionTrigger className="py-3 text-sm hover:no-underline">
                          <span className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            {branch.name}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <ClinicProcedurePriceTable
                            idPrefix={`branch-${branch.id}`}
                            values={values}
                            onChange={(key, value) =>
                              setDraft((d) => ({
                                ...d,
                                branch_prices: {
                                  ...d.branch_prices,
                                  [branch.id]: normalizeClinicPriceFields({
                                    ...(d.branch_prices[branch.id] ?? EMPTY_CLINIC_PRICE_FIELDS),
                                    [key]: value,
                                  }),
                                },
                              }))
                            }
                          />
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 flex justify-end gap-2 border-t px-4 py-3 sm:px-5">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) resetImportState();
        }}
      >
        <DialogContent className="flex max-h-[min(92dvh,820px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 space-y-1 border-b px-4 pb-3 pt-4 pr-12 text-left sm:px-5 sm:pt-5">
            <DialogTitle>Importar preços da planilha</DialogTitle>
            <DialogDescription>
              Lê o nome do procedimento e o valor (ex.: Nome do Tratamento + Preço Atualizado). Os
              preços vão para Oficial e Particular.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="space-y-1.5">
              <Label htmlFor="clinic-price-sheet">Arquivo Excel (.xlsx)</Label>
              <Input
                id="clinic-price-sheet"
                ref={importFileRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={importParsing || importSaving}
                onChange={(e) => void handleImportFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {importParsing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Lendo planilha…
              </div>
            ) : null}

            {importMatched.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Serão importados ({importMatched.length})
                </h4>
                <div className="max-h-48 overflow-y-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Procedimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importMatched.map((row) => (
                        <TableRow key={`${row.procedure.id}-${row.rowNumber}`}>
                          <TableCell className="font-medium">{row.procedure.name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(row.price)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 space-y-3 border-t px-4 py-3 sm:px-5">
            {importMissing.length > 0 ? (
              <Alert variant="destructive" className="py-3">
                <AlertTitle className="text-sm">
                  {importMissing.length} procedimento
                  {importMissing.length === 1 ? '' : 's'} sem cadastro no catálogo
                </AlertTitle>
                <AlertDescription className="text-xs">
                  <ul className="mt-1.5 max-h-28 list-disc space-y-0.5 overflow-y-auto pl-4">
                    {importMissing.map((row) => (
                      <li key={`${row.rowNumber}-${row.name}`}>
                        {row.name}{' '}
                        <span className="text-muted-foreground">
                          ({formatMoney(row.price)} · linha {row.rowNumber})
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-muted-foreground">
                    Você ainda pode importar os valores dos procedimentos reconhecidos abaixo.
                  </p>
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={importSaving}
                onClick={() => {
                  setImportOpen(false);
                  resetImportState();
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={importSaving || importMatched.length === 0}
                onClick={() => void handleConfirmImport()}
              >
                {importSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Importar {importMatched.length > 0 ? `(${importMatched.length})` : 'valores'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
