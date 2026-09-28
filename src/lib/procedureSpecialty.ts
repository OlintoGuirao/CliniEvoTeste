export const PROCEDURE_SPECIALTIES = [
  'estetico',
  'corporal',
  'injetaveis',
  'tecnologia',
  'bem_estar',
  'avaliacao',
  'outros',
] as const;

export type ProcedureSpecialty = (typeof PROCEDURE_SPECIALTIES)[number];

export const PROCEDURE_SPECIALTY_LABELS: Record<ProcedureSpecialty, string> = {
  estetico: 'Procedimento estético',
  corporal: 'Estética corporal',
  injetaveis: 'Injetáveis',
  tecnologia: 'Tecnologias',
  bem_estar: 'Bem-estar',
  avaliacao: 'Avaliação',
  outros: 'Outros',
};

export function isProcedureSpecialty(value: unknown): value is ProcedureSpecialty {
  return typeof value === 'string' && (PROCEDURE_SPECIALTIES as readonly string[]).includes(value);
}

export function specialtyLabel(value: string | null | undefined): string {
  if (isProcedureSpecialty(value)) return PROCEDURE_SPECIALTY_LABELS[value];
  return value?.trim() || '—';
}
