import { Link, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Plus, Trash2, Save, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchPatients, PATIENTS_QUERY_KEY } from '@/api/patients';
import { getProceduresForProfile } from '@/lib/proceduresForProfile';
import {
  createBudgetQuote,
  fetchBudgetQuote,
  updateBudgetQuote,
  getLinesFromRow,
} from '@/services/api/budgetQuotesApi';
import {
  emptyLine,
  formatBrl,
  grandTotal,
  lineTotal,
  normalizeLinesForSave,
  parseTreatmentTimeUnit,
  type BudgetQuoteLine,
  type BudgetTreatmentTimeUnit,
} from '@/lib/budgetQuote';
import {
  CLINIC_PRICE_TIERS,
  CLINIC_PRICE_TIER_LABELS,
  DEFAULT_CLINIC_PRICE_TIER,
  type ClinicPriceTier,
} from '@/lib/clinicPriceTiers';
import { useOrganizationProcedurePrices } from '@/hooks/use-organization-procedure-prices';
import { toast } from 'sonner';
import { useCallback, useEffect, useMemo, useState } from 'react';

const MODULE_KEY = 'orcamento';
const TREATMENT_UNIT_OPTIONS: Array<{ value: BudgetTreatmentTimeUnit; label: string }> = [
  { value: 'meses', label: 'Meses' },
  { value: 'sessoes', label: 'Sessões' },
];

export default function OrcamentoEditorPage() {
  const { budgetId: budgetIdParam } = useParams<{ budgetId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const professionalId = profile?.id ?? '';
  const queryClient = useQueryClient();
  const disabled = (profile as { disabled_modules?: string[] | null } | null)?.disabled_modules;
  const isBlocked = Array.isArray(disabled) && disabled.includes(MODULE_KEY);

  const isNew = location.pathname.endsWith('/orcamento/novo');
  const budgetId = isNew ? undefined : budgetIdParam;

  const [patientId, setPatientId] = useState('');
  const [title, setTitle] = useState('');
  const [treatmentTime, setTreatmentTime] = useState('');
  const [treatmentTimeUnit, setTreatmentTimeUnit] = useState<BudgetTreatmentTimeUnit | ''>('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<BudgetQuoteLine[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  const { data: patients = [] } = useQuery({
    queryKey: [PATIENTS_QUERY_KEY, professionalId],
    queryFn: () => fetchPatients(professionalId),
    enabled: !!professionalId,
  });

  const { data: procedures = [] } = useQuery({
    queryKey: ['procedures-for-profile', professionalId],
    queryFn: () => getProceduresForProfile(professionalId),
    enabled: !!professionalId,
  });

  const { isClinicAccount, getPrice } = useOrganizationProcedurePrices();

  const { data: existing, isLoading } = useQuery({
    queryKey: ['budget-quote', budgetId],
    queryFn: () => fetchBudgetQuote(budgetId!),
    enabled: !!budgetId && !isNew,
  });

  useEffect(() => {
    if (!existing || isNew) return;
    setPatientId(existing.patient_id);
    setTitle(existing.title ?? '');
    setTreatmentTime(
      existing.treatment_time != null && Number.isFinite(existing.treatment_time)
        ? String(existing.treatment_time)
        : ''
    );
    setTreatmentTimeUnit(parseTreatmentTimeUnit(existing.treatment_time_unit) ?? '');
    setNotes(existing.notes ?? '');
    const loaded = getLinesFromRow(existing);
    setLines(loaded.length > 0 ? loaded : [emptyLine()]);
  }, [existing, isNew]);

  const procedureOptions = useMemo(
    () => [...procedures].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR')),
    [procedures]
  );

  const totalGeral = useMemo(() => grandTotal(lines), [lines]);

  const updateLine = useCallback((index: number, patch: Partial<BudgetQuoteLine>) => {
    setLines((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }, []);

  const addRow = useCallback(() => {
    setLines((prev) => [...prev, emptyLine()]);
  }, []);

  const removeRow = useCallback((index: number) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const onProcedureChange = useCallback(
    (index: number, procId: string) => {
      const proc = procedureOptions.find((p) => p.id === procId);
      const tier: ClinicPriceTier = DEFAULT_CLINIC_PRICE_TIER;
      const suggested = isClinicAccount ? getPrice(procId, tier) : null;
      updateLine(index, {
        procedure_id: procId,
        procedure_name: proc?.name ?? '',
        ...(isClinicAccount
          ? {
              price_tier: tier,
              unit_price: suggested != null ? suggested : 0,
            }
          : {}),
      });
    },
    [procedureOptions, updateLine, isClinicAccount, getPrice]
  );

  const onPriceTierChange = useCallback(
    (index: number, tier: ClinicPriceTier) => {
      const line = lines[index];
      if (!line?.procedure_id) {
        updateLine(index, { price_tier: tier });
        return;
      }
      const suggested = getPrice(line.procedure_id, tier);
      updateLine(index, {
        price_tier: tier,
        ...(suggested != null ? { unit_price: suggested } : {}),
      });
    },
    [lines, getPrice, updateLine]
  );

  const save = useCallback(async () => {
    if (!professionalId) return;
    if (!patientId) {
      toast.error('Selecione o paciente.');
      return;
    }
    if (!title.trim()) {
      toast.error('Informe o título do orçamento.');
      return;
    }
    const treatmentMinutes = Number(treatmentTime);
    if (!Number.isInteger(treatmentMinutes) || treatmentMinutes < 1) {
      toast.error('Informe o tempo de tratamento (número inteiro).');
      return;
    }
    if (treatmentTimeUnit !== 'meses' && treatmentTimeUnit !== 'sessoes') {
      toast.error('Selecione a unidade: meses ou sessões.');
      return;
    }
    if (!notes.trim()) {
      toast.error('Informe as observações.');
      return;
    }
    const normalized = normalizeLinesForSave(lines);
    if (normalized.length === 0) {
      toast.error('Inclua ao menos um procedimento com quantidade e valor.');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const row = await createBudgetQuote({
          professionalId,
          patientId,
          title: title.trim(),
          notes: notes.trim(),
          treatmentTime: treatmentMinutes,
          treatmentTimeUnit,
          lines: normalized,
        });
        toast.success('Orçamento salvo.');
        await queryClient.invalidateQueries({ queryKey: ['budget-quotes', professionalId] });
        navigate(`/orcamento/${row.id}`, { replace: true });
      } else if (budgetId) {
        await updateBudgetQuote({
          id: budgetId,
          patientId,
          title: title.trim(),
          notes: notes.trim(),
          treatmentTime: treatmentMinutes,
          treatmentTimeUnit,
          lines: normalized,
        });
        toast.success('Alterações salvas.');
        await queryClient.invalidateQueries({ queryKey: ['budget-quotes', professionalId] });
        await queryClient.invalidateQueries({ queryKey: ['budget-quote', budgetId] });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }, [
    professionalId,
    patientId,
    lines,
    title,
    notes,
    treatmentTime,
    treatmentTimeUnit,
    isNew,
    budgetId,
    navigate,
    queryClient,
  ]);

  if (isBlocked) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!isNew && isLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        Carregando…
      </div>
    );
  }

  if (!isNew && !isLoading && !existing) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Orçamento não encontrado.</p>
        <Button variant="link" asChild>
          <Link to="/orcamento">Voltar à lista</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in max-w-5xl mx-auto w-full">
      <PageBreadcrumb
        segments={[
          { label: 'Início', path: '/dashboard' },
          { label: 'Orçamentos', path: '/orcamento' },
          { label: isNew ? 'Novo' : 'Editar' },
        ]}
        className="mb-1 hidden md:block"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="rounded-xl -ml-2" asChild>
          <Link to="/orcamento">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Lista
          </Link>
        </Button>
      </div>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl">{isNew ? 'Novo orçamento' : 'Editar orçamento'}</CardTitle>
          <CardDescription>
            Título, tempo de tratamento, observações e ao menos um procedimento com valor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bq-patient">Paciente</Label>
              <Select value={patientId || undefined} onValueChange={setPatientId}>
                <SelectTrigger id="bq-patient" className="rounded-xl h-11">
                  <SelectValue placeholder="Selecione o paciente" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bq-title">Título</Label>
              <Input
                id="bq-title"
                className="rounded-xl"
                placeholder="Ex.: Orçamento facial"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                aria-required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bq-treatment-time">Tempo de tratamento</Label>
              <Input
                id="bq-treatment-time"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                className="rounded-xl"
                placeholder="Ex.: 3"
                value={treatmentTime}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setTreatmentTime('');
                    return;
                  }
                  if (/^\d+$/.test(raw)) setTreatmentTime(raw);
                }}
                required
                aria-required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bq-treatment-unit">Unidade</Label>
              <Select
                value={treatmentTimeUnit || undefined}
                onValueChange={(v) => setTreatmentTimeUnit(v as BudgetTreatmentTimeUnit)}
              >
                <SelectTrigger id="bq-treatment-unit" className="rounded-xl h-11">
                  <SelectValue placeholder="Meses ou sessões" />
                </SelectTrigger>
                <SelectContent>
                  {TREATMENT_UNIT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bq-notes">Observações</Label>
              <Textarea
                id="bq-notes"
                className="rounded-xl min-h-[72px] resize-y"
                placeholder="Notas visíveis no link enviado ao paciente…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                required
                aria-required
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left font-semibold uppercase tracking-wide text-xs px-3 py-3 w-[36%]">
                      Procedimento
                    </th>
                    {isClinicAccount ? (
                      <th className="text-left font-semibold uppercase tracking-wide text-xs px-2 py-3 w-[16%]">
                        Tipo preço
                      </th>
                    ) : null}
                    <th className="text-right font-semibold uppercase tracking-wide text-xs px-2 py-3 w-[12%]">
                      Qtd.
                    </th>
                    <th className="text-right font-semibold uppercase tracking-wide text-xs px-2 py-3 w-[18%]">
                      Valor unit.
                    </th>
                    <th
                      className="text-right font-semibold uppercase tracking-wide text-xs px-3 py-3 w-[18%] text-primary-foreground bg-primary"
                      colSpan={1}
                    >
                      Total
                    </th>
                    <th className="w-10 px-1" aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={index} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                      <td className="p-2 align-middle">
                        <Select
                          value={line.procedure_id || undefined}
                          onValueChange={(v) => onProcedureChange(index, v)}
                        >
                          <SelectTrigger className="rounded-lg h-10 w-full border-transparent bg-transparent hover:bg-background">
                            <SelectValue placeholder="Selecione…" />
                          </SelectTrigger>
                          <SelectContent>
                            {procedureOptions.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      {isClinicAccount ? (
                        <td className="p-2 align-middle">
                          <Select
                            value={line.price_tier || DEFAULT_CLINIC_PRICE_TIER}
                            onValueChange={(v) => onPriceTierChange(index, v as ClinicPriceTier)}
                            disabled={!line.procedure_id}
                          >
                            <SelectTrigger className="rounded-lg h-10 w-full">
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
                        </td>
                      ) : null}
                      <td className="p-2 align-middle">
                        <Input
                          type="number"
                          min={0.01}
                          step="any"
                          className="rounded-lg h-10 text-right tabular-nums"
                          value={line.quantity}
                          onChange={(e) => updateLine(index, { quantity: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="p-2 align-middle">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="rounded-lg h-10 text-right tabular-nums"
                          value={line.unit_price}
                          onChange={(e) => updateLine(index, { unit_price: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="p-2 align-middle text-right font-semibold tabular-nums text-primary bg-primary/5">
                        {formatBrl(lineTotal(line))}
                      </td>
                      <td className="p-1 align-middle">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground"
                          onClick={() => removeRow(index)}
                          disabled={lines.length <= 1}
                          aria-label="Remover linha"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-border p-3 sm:flex-row sm:items-center sm:justify-between bg-muted/30">
              <Button type="button" variant="outline" size="sm" className="rounded-xl w-fit" onClick={addRow}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar procedimento
              </Button>
              <div className="flex items-center justify-between gap-4 rounded-xl bg-primary px-4 py-3 text-primary-foreground sm:min-w-[240px]">
                <span className="text-sm font-medium uppercase tracking-wide">Total geral</span>
                <span className="text-lg font-bold tabular-nums">{formatBrl(totalGeral)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" className="rounded-xl" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
            {!isNew && budgetId && (
              <Button type="button" variant="secondary" className="rounded-xl" asChild>
                <Link to={`/orcamento/enviar/${budgetId}`}>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar ao paciente
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
