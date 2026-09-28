/** Escapa strings para literais SQL. */
function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

function sqlString(value: string): string {
  return `'${sqlEscape(value)}'`;
}

function sqlUuid(value: string): string {
  return `'${value}'::uuid`;
}

function sqlJsonArray(values: string[]): string {
  return `${sqlString(JSON.stringify(values))}::jsonb`;
}

function headerComment(title: string, lines: string[]): string {
  const body = lines.map((l) => `-- ${l}`).join('\n');
  return `-- =============================================================================\n-- ${title}\n${body}\n-- =============================================================================\n`;
}

/** SQL para criar procedimento global + permissões por perfil. */
export function generateCreateProcedureSql(params: {
  name: string;
  slug: string;
  category: string;
  description?: string;
  profileIds: string[];
  profileLabels?: Record<string, string>;
}): string {
  const slug = params.slug.trim().toLowerCase();
  const desc = params.description?.trim() ? sqlString(params.description.trim()) : 'NULL';

  const permissionBlocks =
    params.profileIds.length === 0
      ? ''
      : `\n${headerComment('Permissões — visibilidade no menu por profissional', [
          ...params.profileIds.map((id) => {
            const label = params.profileLabels?.[id] ?? id;
            return `Profissional: ${label}`;
          }),
        ])}
INSERT INTO public.profile_procedure_permissions (profile_id, procedure_id, visible)
SELECT v.profile_id, p.id, true
FROM public.procedures p
CROSS JOIN (VALUES
${params.profileIds.map((id) => `  (${sqlUuid(id)})`).join(',\n')}
) AS v(profile_id)
WHERE p.slug = ${sqlString(slug)} AND p.is_global = true AND p.created_by IS NULL
ON CONFLICT (profile_id, procedure_id) DO UPDATE SET visible = EXCLUDED.visible;
`;

  return `${headerComment(`Novo procedimento: ${params.name}`, [
    `Slug: ${slug}`,
    `Categoria: ${params.category}`,
  ])}
INSERT INTO public.procedures (is_global, created_by, category, name, description, slug, is_active)
SELECT true, NULL::uuid, ${sqlString(params.category.trim())}, ${sqlString(params.name.trim())}, ${desc}, ${sqlString(slug)}, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.procedures p
  WHERE p.slug = ${sqlString(slug)} AND p.is_global = true AND p.created_by IS NULL
);
${permissionBlocks}`;
}

/** SQL para inserir campo global + configuração somente para um profissional. */
export function generateCreateFieldSql(params: {
  procedureSlug: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  options: string[];
  sortOrder: number;
  professionalId: string;
  professionalLabel?: string;
  isActive?: boolean;
  isRequired?: boolean;
}): string {
  const slug = params.procedureSlug.trim().toLowerCase();
  const optionsSql = sqlJsonArray(params.options);
  const profLabel = params.professionalLabel ?? params.professionalId;

  return `${headerComment(`Novo campo: ${params.label}`, [
    `Procedimento (slug): ${slug}`,
    `field_key: ${params.fieldKey}`,
    `Somente configuração para: ${profLabel}`,
  ])}
INSERT INTO public.procedure_fields (procedure_id, field_key, label, field_type, options, sort_order)
SELECT p.id, ${sqlString(params.fieldKey)}, ${sqlString(params.label)}, ${sqlString(params.fieldType)}, ${optionsSql}, ${params.sortOrder}
FROM public.procedures p
WHERE p.slug = ${sqlString(slug)} AND p.is_global = true AND p.created_by IS NULL
ON CONFLICT (procedure_id, field_key) DO NOTHING;

INSERT INTO public.professional_procedure_field_settings
  (professional_id, procedure_id, procedure_field_id, is_active, is_required, sort_order)
SELECT
  ${sqlUuid(params.professionalId)},
  p.id,
  f.id,
  ${params.isActive !== false},
  ${params.isRequired === true},
  ${params.sortOrder}
FROM public.procedures p
JOIN public.procedure_fields f ON f.procedure_id = p.id AND f.field_key = ${sqlString(params.fieldKey)}
WHERE p.slug = ${sqlString(slug)} AND p.is_global = true AND p.created_by IS NULL
ON CONFLICT (professional_id, procedure_field_id) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  is_required = EXCLUDED.is_required,
  sort_order = EXCLUDED.sort_order;
`;
}

/** SQL para salvar visibilidade/obrigatoriedade/ordem dos campos de um profissional. */
export function generateFieldSettingsSql(params: {
  procedureSlug: string;
  professionalId: string;
  professionalLabel?: string;
  fields: Array<{
    fieldKey: string;
    isActive: boolean;
    isRequired: boolean;
    sortOrder: number;
  }>;
}): string {
  if (params.fields.length === 0) return '';

  const slug = params.procedureSlug.trim().toLowerCase();
  const profLabel = params.professionalLabel ?? params.professionalId;

  const values = params.fields
    .map(
      (f) =>
        `  (${sqlString(f.fieldKey)}, ${f.isActive}, ${f.isRequired && f.isActive}, ${f.sortOrder})`
    )
    .join(',\n');

  return `${headerComment(`Configuração de campos — ${profLabel}`, [
    `Procedimento (slug): ${slug}`,
    'Aplica somente para o profissional indicado.',
  ])}
INSERT INTO public.professional_procedure_field_settings
  (professional_id, procedure_id, procedure_field_id, is_active, is_required, sort_order)
SELECT
  ${sqlUuid(params.professionalId)},
  p.id,
  f.id,
  v.is_active,
  v.is_required,
  v.sort_order
FROM public.procedures p
JOIN public.procedure_fields f ON f.procedure_id = p.id
JOIN (VALUES
${values}
) AS v(field_key, is_active, is_required, sort_order) ON v.field_key = f.field_key
WHERE p.slug = ${sqlString(slug)} AND p.is_global = true AND p.created_by IS NULL
ON CONFLICT (professional_id, procedure_field_id) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  is_required = EXCLUDED.is_required,
  sort_order = EXCLUDED.sort_order;
`;
}

/** SQL para atribuir visibilidade do procedimento a profissionais. */
export function generateProcedurePermissionsSql(params: {
  procedureSlug: string;
  profileIds: string[];
  profileLabels?: Record<string, string>;
}): string {
  if (params.profileIds.length === 0) return '';

  const slug = params.procedureSlug.trim().toLowerCase();

  return `${headerComment('Permissões — visibilidade no menu por profissional', [
    `Procedimento (slug): ${slug}`,
    ...params.profileIds.map((id) => {
      const label = params.profileLabels?.[id] ?? id;
      return `Profissional: ${label}`;
    }),
  ])}
INSERT INTO public.profile_procedure_permissions (profile_id, procedure_id, visible)
SELECT v.profile_id, p.id, true
FROM public.procedures p
CROSS JOIN (VALUES
${params.profileIds.map((id) => `  (${sqlUuid(id)})`).join(',\n')}
) AS v(profile_id)
WHERE p.slug = ${sqlString(slug)} AND p.is_global = true AND p.created_by IS NULL
ON CONFLICT (profile_id, procedure_id) DO UPDATE SET visible = EXCLUDED.visible;
`;
}

/** Junta blocos SQL com linha em branco entre eles. */
export function combineSqlBlocks(blocks: string[]): string {
  return blocks.filter((b) => b.trim().length > 0).join('\n\n');
}
