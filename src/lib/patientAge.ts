import { parseLocalDate } from '@/lib/utils';

/**
 * Retorna true se a data de nascimento indica menos de 18 anos completos
 * na data de referência (padrão: hoje).
 */
export function isPatientMinor(
  dateOfBirth: string | Date | null | undefined,
  today: Date = new Date()
): boolean {
  if (!dateOfBirth) return false;

  const birth =
    dateOfBirth instanceof Date
      ? new Date(dateOfBirth.getFullYear(), dateOfBirth.getMonth(), dateOfBirth.getDate())
      : parseLocalDate(String(dateOfBirth).slice(0, 10));

  if (Number.isNaN(birth.getTime())) return false;

  const ref = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 && age < 18;
}
