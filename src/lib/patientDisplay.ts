export function formatPatientDisplayName(
  fullName: string,
  nickname?: string | null
): string {
  const name = fullName.trim();
  const nick = nickname?.trim();
  if (!name) return nick ?? '';
  if (!nick) return name;
  return `${name} (${nick})`;
}

export function patientMatchesSearch(
  patient: { full_name: string; nickname?: string | null; phone?: string | null },
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const phoneDigits = (patient.phone ?? '').replace(/\D/g, '');
  const queryDigits = q.replace(/\D/g, '');

  const haystacks = [
    patient.full_name,
    patient.nickname ?? '',
    formatPatientDisplayName(patient.full_name, patient.nickname),
    patient.phone ?? '',
  ].map((value) => value.toLowerCase());

  if (haystacks.some((value) => value.includes(q))) return true;
  if (queryDigits.length >= 2 && phoneDigits.includes(queryDigits)) return true;
  return false;
}
