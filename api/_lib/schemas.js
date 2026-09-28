/**
 * Schemas Zod para validação de entrada nas APIs.
 * Garante tipos, tamanhos e formatos; evita payloads excessivos.
 */

import { z } from 'zod';

const MAX_BODY_BYTES = 10 * 1024; // 10 KB

export const adminCreateUserSchema = z.object({
  email: z.string().min(1, 'E-mail é obrigatório').max(255).email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').max(512, 'Senha muito longa'),
  full_name: z.string().max(200).nullable().optional().transform((v) => v?.trim() || null),
  /** solo | clinic (Master clínica) | salon (Admin salão / cabeleireiro). Default solo. */
  account_type: z.enum(['solo', 'clinic', 'salon']).optional().default('solo'),
  /** Nome da clínica (opcional). Se omitido, usa full_name. */
  organization_name: z
    .string()
    .max(200)
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null),
});

export const adminPasswordResetSchema = z.object({
  email: z.string().min(1, 'E-mail é obrigatório').max(255).email('E-mail inválido'),
  redirect_to: z.string().max(2048).optional().nullable(),
});

export const adminSetPasswordSchema = z.object({
  user_id: z.string().min(1, 'Usuário é obrigatório').max(500),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').max(512, 'Senha muito longa'),
});

export const adminDeleteUserSchema = z.object({
  user_id: z.string().uuid('ID de usuário inválido'),
});

const agendaLabelColorSchema = z
  .string()
  .trim()
  .regex(/^#?[0-9A-Fa-f]{6}$/, 'Cor de etiqueta inválida')
  .nullable()
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null || v === '') return null;
    const hex = v.startsWith('#') ? v : `#${v}`;
    return hex.toLowerCase();
  });

export const clinicCreateProfessionalSchema = z.object({
  email: z.string().min(1, 'E-mail é obrigatório').max(255).email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').max(512, 'Senha muito longa'),
  full_name: z.string().min(2, 'Nome é obrigatório').max(200).transform((v) => v.trim()),
  branch_id: z.string().uuid('Filial inválida').nullable().optional(),
  role: z.enum(['professional', 'attendant']).optional().default('professional'),
  professional_registry_body: z.string().max(80).nullable().optional(),
  professional_registry_number: z.string().max(80).nullable().optional(),
  professional_specialty: z.string().max(200).nullable().optional(),
  staff_title: z.string().max(120).nullable().optional(),
  agenda_label_color: agendaLabelColorSchema,
});

export const clinicRemoveProfessionalSchema = z.object({
  user_id: z.string().uuid('ID de usuário inválido'),
});

export const clinicUpdateMemberSchema = z.object({
  user_id: z.string().uuid('ID de usuário inválido'),
  full_name: z.string().min(2, 'Nome é obrigatório').max(200).optional().transform((v) => v?.trim()),
  branch_id: z.string().uuid('Filial inválida').nullable().optional(),
  role: z.enum(['professional', 'attendant']).optional(),
  professional_registry_body: z.string().max(80).nullable().optional(),
  professional_registry_number: z.string().max(80).nullable().optional(),
  professional_specialty: z.string().max(200).nullable().optional(),
  staff_title: z.string().max(120).nullable().optional(),
  agenda_label_color: agendaLabelColorSchema,
  agenda_label_nickname: z.string().max(40).nullable().optional(),
  agenda_sort_order: z.number().int().min(0).max(999).optional(),
});

const optionalPrice = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100) / 100;
  });

export const clinicUpsertProcedureSchema = z.object({
  procedure_id: z.string().uuid('Procedimento inválido'),
  is_active: z.boolean().optional().default(true),
  price_oficial: optionalPrice,
  price_parcerias: optionalPrice,
  price_funcionarios: optionalPrice,
  price_particular: optionalPrice,
  price_convenio: optionalPrice,
  /** Se true, grava overrides por filial; se false/omitido, remove overrides. */
  use_branch_prices: z.boolean().optional().default(false),
  branch_prices: z
    .array(
      z.object({
        branch_id: z.string().uuid('Filial inválida'),
        price_oficial: optionalPrice,
        price_parcerias: optionalPrice,
        price_funcionarios: optionalPrice,
        price_particular: optionalPrice,
        price_convenio: optionalPrice,
      })
    )
    .optional()
    .default([]),
});

export const authLogAttemptSchema = z
  .object({
    success: z.boolean().optional(),
    checkOnly: z.boolean().optional(),
  })
  .refine((d) => d.checkOnly === true || typeof d.success === 'boolean', {
    message: 'Informe success (boolean) ou checkOnly: true',
  });

export const auditBodySchema = z.object({
  action: z.string().min(1).max(100),
  entity: z.string().min(1).max(100),
  entity_id: z.string().max(500).optional().nullable(),
  details: z.record(z.unknown()).optional().nullable(),
});

export function parseBody(request, schema) {
  return request.text().then((raw) => {
    if (raw.length > MAX_BODY_BYTES) {
      return { error: 'Payload muito grande', status: 413 };
    }
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      return { error: 'Corpo da requisição inválido', status: 400 };
    }
    const result = schema.safeParse(json);
    if (!result.success) {
      const first = result.error.flatten().fieldErrors;
      const msg = Object.values(first).flat().find(Boolean) || 'Dados inválidos';
      return { error: msg, status: 400 };
    }
    return { data: result.data };
  });
}
