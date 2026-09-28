import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converte string "YYYY-MM-DD" ou ISO com hora (vinda do banco) em Date na meia-noite LOCAL.
 * Evita o bug de fuso: new Date("2026-01-29") = UTC 00:00 → no Brasil vira dia 28.
 */
export function parseLocalDate(dateStr: string): Date {
  const s = dateStr.slice(0, 10); // "YYYY-MM-DD" mesmo se vier "2026-01-29T..."
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const LOWERCASE_CONNECTORS = new Set([
  'da',
  'de',
  'do',
  'das',
  'dos',
  'e',
]);

export function formatPersonName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .trim()
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .map((part, index) => {
      if (index > 0 && LOWERCASE_CONNECTORS.has(part)) return part;
      return part.charAt(0).toLocaleUpperCase('pt-BR') + part.slice(1);
    })
    .join(' ');
}
