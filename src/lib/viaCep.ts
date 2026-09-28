export type ViaCepAddress = {
  zipCode: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

export function cepDigits(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, 8);
}

export function formatCepDisplay(value: string | null | undefined): string {
  const digits = cepDigits(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function isCompleteCep(value: string | null | undefined): boolean {
  return cepDigits(value).length === 8;
}

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
};

export async function lookupCep(
  cep: string,
  signal?: AbortSignal
): Promise<ViaCepAddress | null> {
  const digits = cepDigits(cep);
  if (digits.length !== 8) return null;

  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal });
  if (!response.ok) {
    throw new Error('cep_lookup_failed');
  }

  const data = (await response.json()) as ViaCepResponse;
  if (data?.erro) return null;

  const city = String(data.localidade ?? '').trim();
  const state = String(data.uf ?? '').trim();

  return {
    zipCode: digits,
    street: String(data.logradouro ?? '').trim(),
    neighborhood: String(data.bairro ?? '').trim(),
    city: city && state ? `${city} - ${state}` : city,
    state,
  };
}
