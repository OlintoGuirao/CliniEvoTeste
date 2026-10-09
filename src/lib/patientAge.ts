import { parseLocalDate } from '@/lib/utils';

/** Idade em anos completos; null se a data for inválida/ausente. */
export function getPatientAgeYears(
  dateOfBirth: string | Date | null | undefined,
  today: Date = new Date()
): number | null {
  if (!dateOfBirth) return null;

  const birth =
    dateOfBirth instanceof Date
      ? new Date(dateOfBirth.getFullYear(), dateOfBirth.getMonth(), dateOfBirth.getDate())
      : parseLocalDate(String(dateOfBirth).slice(0, 10));

  if (Number.isNaN(birth.getTime())) return null;

  const ref = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
    age -= 1;
  }
  if (age < 0) return null;
  return age;
}

/**
 * Retorna true se a data de nascimento indica menos de 18 anos completos
 * na data de referência (padrão: hoje).
 */
export function isPatientMinor(
  dateOfBirth: string | Date | null | undefined,
  today: Date = new Date()
): boolean {
  const age = getPatientAgeYears(dateOfBirth, today);
  return age != null && age < 18;
}

/** Odontograma pediátrico: dentição decídua por padrão até 12 anos. */
export function isPediatricDentalPatient(
  dateOfBirth: string | Date | null | undefined,
  today: Date = new Date()
): boolean {
  const age = getPatientAgeYears(dateOfBirth, today);
  return age != null && age < 13;
}
