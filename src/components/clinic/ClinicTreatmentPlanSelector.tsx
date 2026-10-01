import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export type ClinicTreatmentPlanSelectedItem = {
  id: string;
  treatmentPlanId: string;
  treatmentPlanName: string;
  procedureId: string | null;
  procedureName: string;
};

type PlanRow = {
  id: string;
  name: string;
  status: string;
};

type ItemRow = {
  id: string;
  treatment_plan_id: string;
  procedure_id: string | null;
  procedure_name: string;
  status: string;
};

type ClinicTreatmentPlanSelectorProps = {
  patientId: string | null | undefined;
  enabled: boolean;
  selectedItemIds: string[];
  onSelectionChange: (items: ClinicTreatmentPlanSelectedItem[]) => void;
  className?: string;
};

const SOLD_PLAN_STATUSES = ['authorized', 'negotiating'] as const;

export function ClinicTreatmentPlanSelector({
  patientId,
  enabled,
  selectedItemIds,
  onSelectionChange,
  className,
}: ClinicTreatmentPlanSelectorProps) {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);

  useEffect(() => {
    if (!enabled || !patientId) {
      setPlans([]);
      setItems([]);
      onSelectionChange([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        // dental_* ainda não está no Database tipado do supabase-js gerado
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any;
        const { data: planRows, error: planError } = await db
          .from('dental_treatment_plans')
          .select('id, name, status')
          .eq('patient_id', patientId)
          .in('status', [...SOLD_PLAN_STATUSES])
          .order('created_at', { ascending: false });
        if (planError) throw planError;

        const loadedPlans = (planRows ?? []) as PlanRow[];
        const planIds = loadedPlans.map((p) => p.id);
        let loadedItems: ItemRow[] = [];

        if (planIds.length > 0) {
          const { data: itemRows, error: itemError } = await db
            .from('dental_plan_items')
            .select('id, treatment_plan_id, procedure_id, procedure_name, status, sort_order')
            .in('treatment_plan_id', planIds)
            .neq('status', 'rejected')
            .order('sort_order', { ascending: true });
          if (itemError) throw itemError;
          loadedItems = (itemRows ?? []) as ItemRow[];
        }

        if (cancelled) return;
        setPlans(loadedPlans);
        setItems(loadedItems);
        onSelectionChange([]);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setPlans([]);
          setItems([]);
          onSelectionChange([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- limpar seleção só quando paciente/enable muda
  }, [patientId, enabled]);

  const itemsByPlan = useMemo(() => {
    const map = new Map<string, ItemRow[]>();
    for (const item of items) {
      const list = map.get(item.treatment_plan_id) ?? [];
      list.push(item);
      map.set(item.treatment_plan_id, list);
    }
    return map;
  }, [items]);

  const selectedSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);

  function emitSelection(nextIds: Set<string>) {
    const selected = items
      .filter((item) => nextIds.has(item.id))
      .map((item) => {
        const plan = plans.find((p) => p.id === item.treatment_plan_id);
        return {
          id: item.id,
          treatmentPlanId: item.treatment_plan_id,
          treatmentPlanName: plan?.name ?? 'Plano',
          procedureId: item.procedure_id,
          procedureName: item.procedure_name,
        } satisfies ClinicTreatmentPlanSelectedItem;
      });
    onSelectionChange(selected);
  }

  function toggleItem(itemId: string, checked: boolean) {
    const next = new Set(selectedSet);
    if (checked) next.add(itemId);
    else next.delete(itemId);
    emitSelection(next);
  }

  if (!enabled || !patientId) return null;

  return (
    <div className={cn('space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3', className)}>
      <div>
        <Label className="text-sm font-medium">Planos de tratamento vendidos</Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Selecione os procedimentos do plano aceito para este atendimento.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando planos...
        </div>
      ) : plans.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Nenhum plano de tratamento aceito/vendido para este paciente.
        </p>
      ) : (
        <ul className="space-y-4">
          {plans.map((plan) => {
            const planItems = itemsByPlan.get(plan.id) ?? [];
            return (
              <li key={plan.id} className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                {planItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem procedimentos vinculados.</p>
                ) : (
                  <ul className="space-y-2">
                    {planItems.map((item) => {
                      const checked = selectedSet.has(item.id);
                      return (
                        <li
                          key={item.id}
                          className="flex items-start gap-3 rounded-md border border-border/60 bg-background px-3 py-2"
                        >
                          <Checkbox
                            id={`clinic-plan-item-${item.id}`}
                            checked={checked}
                            onCheckedChange={(value) => toggleItem(item.id, value === true)}
                          />
                          <label
                            htmlFor={`clinic-plan-item-${item.id}`}
                            className="cursor-pointer text-sm leading-snug"
                          >
                            {item.procedure_name}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
