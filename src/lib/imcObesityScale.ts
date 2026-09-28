/**
 * Escala visual de 8 níveis (referência: abaixo → normal → sobrepeso em 3 faixas → obesidade I–III).
 * Limites alinhados ao padrão WHO / classificação usual em pt-BR.
 */
export const IMC_OBESITY_SCALE_LABELS = [
  'Abaixo',
  'Normal',
  'Acima 1',
  'Acima 2',
  'Acima 3',
  'Alto 1',
  'Alto 2',
  'Alto 3',
] as const;

export type ImcObesityScaleIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Retorna o índice 0–7 da escala para um IMC válido. */
export function imcToObesityScaleIndex(imc: number): ImcObesityScaleIndex {
  if (imc < 18.5) return 0;
  if (imc < 25) return 1;
  if (imc < 26.6666666667) return 2;
  if (imc < 28.3333333333) return 3;
  if (imc < 30) return 4;
  if (imc < 35) return 5;
  if (imc < 40) return 6;
  return 7;
}
