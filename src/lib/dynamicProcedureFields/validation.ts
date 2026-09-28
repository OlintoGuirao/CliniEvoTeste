import type { Database } from '@/integrations/supabase/types';

export type ProcedureFieldRow = Database['public']['Tables']['procedure_fields']['Row'];

export type FieldWithConfig = ProcedureFieldRow & {
  isRequired?: boolean;
};

export type ValidationErrors = Record<string, string>;

export type ValidateContext = {
  /**
   * Usado como fallback para campos do tipo `date`
   * (o formulário tende a usar a sessão como default visual).
   */
  sessionDate?: string;
};

function isNonEmptyString(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

function isValidDateString(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  // Aceita `YYYY-MM-DD` e também strings com HH:mm:ss (usamos slice em quem renderiza)
  return v.trim().length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(v.trim());
}

function isRequiredValuePresent(field: ProcedureFieldRow, value: unknown, ctx: ValidateContext): boolean {
  switch (field.field_type) {
    case 'text':
      return isNonEmptyString(value);
    case 'number': {
      if (value === null || value === undefined) return false;
      return typeof value === 'number' && Number.isFinite(value);
    }
    case 'select':
      return isNonEmptyString(value);
    case 'select_multi':
      return Array.isArray(value) && value.length > 0;
    case 'boolean':
      // Em boolean, "obrigatório" normalmente significa que precisa estar marcado.
      return value === true;
    case 'date': {
      const effective = typeof value === 'string' ? value : ctx.sessionDate ?? '';
      return isValidDateString(effective);
    }
    case 'image':
      return isNonEmptyString(value);
    default:
      return isNonEmptyString(value);
  }
}

/**
 * Valida apenas campos onde `isRequired === true`.
 * Retorna erros por field_key (para exibir mensagem ao usuário).
 */
export function validateRequiredProcedureFields(
  fields: FieldWithConfig[],
  valuesByKey: Record<string, unknown>,
  ctx: ValidateContext
): { valid: boolean; errors: ValidationErrors } {
  const errors: ValidationErrors = {};

  for (const field of fields) {
    if (!field.isRequired) continue;

    const key = field.field_key;
    const value = valuesByKey?.[key];

    if (!isRequiredValuePresent(field, value, ctx)) {
      errors[key] = `Campo obrigatório: ${field.label}`;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

