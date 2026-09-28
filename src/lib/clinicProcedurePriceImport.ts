import * as XLSX from 'xlsx';
import { normalizeSearchText } from '@/lib/brazilianCities';

export type ClinicPriceSheetRow = {
  name: string;
  price: number;
  rowNumber: number;
};

export type ClinicPriceImportMatch<T extends { id: string; name: string }> = {
  sheetName: string;
  price: number;
  procedure: T;
  rowNumber: number;
};

function normalizeHeader(value: unknown): string {
  return normalizeSearchText(String(value ?? ''))
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function pickColumn(headers: string[], candidates: string[]): string | null {
  for (const c of candidates) {
    const found = headers.find((h) => h === c || h.includes(c));
    if (found) return found;
  }
  return null;
}

function parsePriceCell(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return Math.round(raw * 100) / 100;
  }
  const text = String(raw ?? '').trim();
  if (!text || text === '-' || /^gratuita$/i.test(text)) return null;
  let normalized = text.replace(/[^\d,.-]/g, '');
  if (!normalized) return null;
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

/** Lê Excel/CSV e extrai linhas com nome + preço. */
export function parseClinicProcedurePriceSheet(file: ArrayBuffer): ClinicPriceSheetRow[] {
  const wb = XLSX.read(file, { type: 'array' });
  const preferred =
    wb.SheetNames.find((n) => /atualizada|preco|preço|procedimento/i.test(n)) ?? wb.SheetNames[0];
  if (!preferred) return [];

  const sheet = wb.Sheets[preferred];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]!).map(normalizeHeader);
  const headerByNorm = new Map(
    Object.keys(rows[0]!).map((raw) => [normalizeHeader(raw), raw] as const)
  );

  const nameKeyNorm = pickColumn(headers, [
    'nome_do_tratamento',
    'nome_tratamento',
    'procedimento',
    'nome',
    'tratamento',
  ]);
  const priceKeyNorm = pickColumn(headers, [
    'preco_atualizado',
    'preco_oficial',
    'preco',
    'valor',
    'price',
  ]);

  if (!nameKeyNorm || !priceKeyNorm) {
    throw new Error(
      'Planilha precisa de colunas de nome (ex.: Nome do Tratamento) e preço (ex.: Preço Atualizado).'
    );
  }

  const nameKey = headerByNorm.get(nameKeyNorm)!;
  const priceKey = headerByNorm.get(priceKeyNorm)!;

  const out: ClinicPriceSheetRow[] = [];
  rows.forEach((row, idx) => {
    const name = String(row[nameKey] ?? '').trim();
    const price = parsePriceCell(row[priceKey]);
    if (!name || price == null) return;
    out.push({ name, price, rowNumber: idx + 2 });
  });
  return out;
}

export function matchClinicProcedurePrices<T extends { id: string; name: string }>(
  sheetRows: ClinicPriceSheetRow[],
  catalog: T[]
): {
  matched: ClinicPriceImportMatch<T>[];
  missing: ClinicPriceSheetRow[];
} {
  const byName = new Map<string, T>();
  for (const p of catalog) {
    const key = normalizeSearchText(p.name.trim());
    if (key && !byName.has(key)) byName.set(key, p);
  }

  const matched: ClinicPriceImportMatch<T>[] = [];
  const missing: ClinicPriceSheetRow[] = [];

  for (const row of sheetRows) {
    const key = normalizeSearchText(row.name);
    const procedure = byName.get(key);
    if (!procedure) {
      missing.push(row);
      continue;
    }
    // Último preço da planilha vence se houver duplicata de nome
    const existingIdx = matched.findIndex((m) => m.procedure.id === procedure.id);
    if (existingIdx >= 0) {
      matched[existingIdx] = {
        sheetName: row.name,
        price: row.price,
        procedure,
        rowNumber: row.rowNumber,
      };
    } else {
      matched.push({
        sheetName: row.name,
        price: row.price,
        procedure,
        rowNumber: row.rowNumber,
      });
    }
  }

  return { matched, missing };
}
