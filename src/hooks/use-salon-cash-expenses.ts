import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addMonths, format, parseISO } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isSalonAccount } from '@/lib/accountType';
import { expenseOverlapsPeriod, normalizePaidInstallmentDates, sumExpenseAmountInPeriod } from '@/lib/fluxoCaixa';

export const SALON_CASH_EXPENSES_QUERY_KEY = 'salon-cash-expenses';

export type SalonCashExpenseKind = 'fixed' | 'variable';

export type SalonCashExpenseRow = {
  id: string;
  organization_id: string;
  created_by: string;
  expense_kind: SalonCashExpenseKind;
  title: string;
  amount: number;
  expense_date: string;
  installment_months: number;
  paid_installment_dates: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SalonCashExpenseInput = {
  expense_kind: SalonCashExpenseKind;
  title: string;
  amount: number;
  expense_date: string;
  installment_months: number;
  notes?: string | null;
};

function normalizeInstallmentMonths(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(120, n);
}

function mapRow(row: SalonCashExpenseRow): SalonCashExpenseRow {
  return {
    ...row,
    amount: Number(row.amount) || 0,
    installment_months: normalizeInstallmentMonths(row.installment_months),
    paid_installment_dates: normalizePaidInstallmentDates(row.paid_installment_dates),
  };
}

export function useSalonCashExpenses(filtros: { dataInicio: string; dataFim: string }) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id ?? null;
  const enabled =
    Boolean(profile?.id && organizationId && isSalonAccount(profile.account_type)) &&
    Boolean(filtros.dataInicio && filtros.dataFim);

  /** Busca despesas que possam sobrepor o período (início até 120 meses antes do fim). */
  const fetchFrom = useMemo(() => {
    try {
      return format(addMonths(parseISO(filtros.dataFim), -120), 'yyyy-MM-dd');
    } catch {
      return filtros.dataInicio;
    }
  }, [filtros.dataFim, filtros.dataInicio]);

  const query = useQuery({
    queryKey: [SALON_CASH_EXPENSES_QUERY_KEY, organizationId, filtros, fetchFrom],
    enabled,
    queryFn: async (): Promise<SalonCashExpenseRow[]> => {
      const { data, error } = await (supabase as any)
        .from('salon_cash_expenses')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('expense_date', fetchFrom)
        .lte('expense_date', filtros.dataFim)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as SalonCashExpenseRow[]).map(mapRow);
    },
  });

  const listInPeriod = useMemo(() => {
    const all = query.data ?? [];
    return all.filter((row) =>
      expenseOverlapsPeriod(row, filtros.dataInicio, filtros.dataFim)
    );
  }, [query.data, filtros.dataInicio, filtros.dataFim]);

  const fixed = listInPeriod.filter((r) => r.expense_kind === 'fixed');
  const variable = listInPeriod.filter((r) => r.expense_kind === 'variable');

  return {
    list: listInPeriod,
    fixed,
    variable,
    fixedTotal: fixed.reduce(
      (acc, r) => acc + sumExpenseAmountInPeriod(r, filtros.dataInicio, filtros.dataFim),
      0
    ),
    variableTotal: variable.reduce(
      (acc, r) => acc + sumExpenseAmountInPeriod(r, filtros.dataInicio, filtros.dataFim),
      0
    ),
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useSalonCashExpenseMutations() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const organizationId = profile?.organization_id ?? null;
  const userId = profile?.id ?? null;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: [SALON_CASH_EXPENSES_QUERY_KEY] });
  };

  const insert = useMutation({
    mutationFn: async (input: SalonCashExpenseInput) => {
      if (!organizationId || !userId) throw new Error('Organização do salão não encontrada.');
      const { data, error } = await (supabase as any)
        .from('salon_cash_expenses')
        .insert({
          organization_id: organizationId,
          created_by: userId,
          expense_kind: input.expense_kind,
          title: input.title.trim(),
          amount: input.amount,
          expense_date: input.expense_date,
          installment_months: normalizeInstallmentMonths(input.installment_months),
          notes: input.notes?.trim() || null,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: SalonCashExpenseInput & { id: string }) => {
      const { error } = await (supabase as any)
        .from('salon_cash_expenses')
        .update({
          expense_kind: input.expense_kind,
          title: input.title.trim(),
          amount: input.amount,
          expense_date: input.expense_date,
          installment_months: normalizeInstallmentMonths(input.installment_months),
          notes: input.notes?.trim() || null,
        })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('salon_cash_expenses').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const toggleInstallmentPaid = useMutation({
    mutationFn: async ({
      id,
      installmentDate,
      paidDates,
    }: {
      id: string;
      installmentDate: string;
      paidDates: string[];
    }) => {
      const set = new Set(normalizePaidInstallmentDates(paidDates));
      if (set.has(installmentDate)) set.delete(installmentDate);
      else set.add(installmentDate);
      const next = Array.from(set).sort();
      const { error } = await (supabase as any)
        .from('salon_cash_expenses')
        .update({ paid_installment_dates: next })
        .eq('id', id);
      if (error) throw new Error(error.message);
      return next;
    },
    onSuccess: invalidate,
  });

  return { insert, update, remove, toggleInstallmentPaid, organizationId, userId };
}
