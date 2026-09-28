import { useCallback, useMemo, type RefObject } from 'react';
import { cn } from '@/lib/utils';

export type WhatsappPlaceholderChipItem =
  | string
  | {
      token: string;
      /** Texto do botão. Se omitido, usa rótulo amigável ou o próprio token. */
      label?: string;
    };

/** Rótulos amigáveis (o valor inserido continua sendo {{token}}). */
const PLACEHOLDER_CHIP_LABELS: Record<string, string> = {
  nome: 'Nome do cliente',
  primeiro_nome: 'Primeiro nome',
  nome_completo: 'Nome completo',
  assunto: 'Assunto do agendamento',
  assunto_prep: 'Assunto (lembrar)',
  agendado: 'Agendado / agendada',
  dia: 'Dia da semana',
  data: 'Data',
  quando: 'Horário formatado (às …)',
  horario: 'Horário',
  hora: 'Hora de início',
  hora_fim: 'Hora de término',
  profissional: 'Nome do profissional',
  procedimento: 'Nome do procedimento',
  procedimento_part: 'Trecho do procedimento',
  consulta: 'Consulta ou atendimento',
  dia_semana: 'Dia da semana',
  confirmacao_presenca: 'Bloco de confirmação',
  nome_salao: 'Nome do salão',
  clinica: 'Nome da clínica / salão',
  url: 'Link',
  valor: 'Valor',
  referencia: 'Referência da cobrança',
  descricao: 'Descrição',
  fotos_intro: 'Introdução das fotos',
  data_part: 'Trecho com a data',
};

function humanizeToken(token: string): string {
  return token.replace(/_/g, ' ');
}

function chipLabelForToken(token: string, explicit?: string): string {
  if (explicit?.trim()) return explicit.trim();
  return PLACEHOLDER_CHIP_LABELS[token] || humanizeToken(token);
}

export function parseWhatsappPlaceholderTokens(raw: string | string[]): string[] {
  if (Array.isArray(raw)) {
    return raw.map((t) => t.replace(/^\{\{|\}\}$/g, '').trim()).filter(Boolean);
  }
  const matches = raw.match(/\{\{\s*[a-z0-9_]+\s*\}\}/gi) ?? [];
  return matches.map((m) => m.replace(/^\{\{\s*|\s*\}\}$/g, ''));
}

function normalizePlaceholderItems(
  placeholders: string | WhatsappPlaceholderChipItem[]
): Array<{ token: string; label: string }> {
  if (typeof placeholders === 'string') {
    return parseWhatsappPlaceholderTokens(placeholders).map((token) => ({
      token,
      label: chipLabelForToken(token),
    }));
  }
  return placeholders
    .map((item) => {
      if (typeof item === 'string') {
        const token = item.replace(/^\{\{|\}\}$/g, '').trim();
        return token ? { token, label: chipLabelForToken(token) } : null;
      }
      const token = String(item.token || '')
        .replace(/^\{\{|\}\}$/g, '')
        .trim();
      if (!token) return null;
      return {
        token,
        label: chipLabelForToken(token, item.label),
      };
    })
    .filter(Boolean) as Array<{ token: string; label: string }>;
}

export function insertWhatsappPlaceholder(
  value: string,
  token: string,
  selectionStart: number,
  selectionEnd: number
): { next: string; caret: number } {
  const placeholder = token.startsWith('{{') ? token : `{{${token}}}`;
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  const next = value.slice(0, start) + placeholder + value.slice(end);
  return { next, caret: start + placeholder.length };
}

/** Chip exibido ao lado de {{consulta}} em contas salão. */
export const SALON_NOME_PLACEHOLDER_CHIP: WhatsappPlaceholderChipItem = {
  token: 'nome_salao',
  label: 'Nome do salão',
};

export function withSalonNomePlaceholder(
  placeholders: WhatsappPlaceholderChipItem[],
  isSalon: boolean
): WhatsappPlaceholderChipItem[] {
  if (!isSalon) return placeholders;

  const tokenOf = (item: WhatsappPlaceholderChipItem) =>
    (typeof item === 'string' ? item : item.token).replace(/^\{\{|\}\}$/g, '').trim();

  if (placeholders.some((item) => tokenOf(item) === 'nome_salao')) {
    return placeholders;
  }

  const out: WhatsappPlaceholderChipItem[] = [];
  let inserted = false;
  for (const item of placeholders) {
    out.push(item);
    if (tokenOf(item) === 'consulta') {
      out.push(SALON_NOME_PLACEHOLDER_CHIP);
      inserted = true;
    }
  }
  return inserted ? out : placeholders;
}

function insertSalonNomeIntoNormalized(
  items: Array<{ token: string; label: string }>,
  enabled: boolean
): Array<{ token: string; label: string }> {
  if (!enabled) return items;
  if (items.some((item) => item.token === 'nome_salao')) return items;
  const out: Array<{ token: string; label: string }> = [];
  let inserted = false;
  for (const item of items) {
    out.push(item);
    if (item.token === 'consulta') {
      out.push({
        token: 'nome_salao',
        label: chipLabelForToken('nome_salao'),
      });
      inserted = true;
    }
  }
  return inserted ? out : items;
}

type WhatsappPlaceholderChipsProps = {
  placeholders: string | WhatsappPlaceholderChipItem[];
  value: string;
  onChange: (next: string) => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  /** Se definido, usa este inserter (ex.: editor Visual) em vez do textarea. */
  insertRef?: RefObject<((token: string) => void) | null>;
  disabled?: boolean;
  className?: string;
  hint?: string;
  /** Conta salão: insere o chip “Nome do salão” logo após consulta. */
  showSalonNomePlaceholder?: boolean;
};

export function WhatsappPlaceholderChips({
  placeholders,
  value,
  onChange,
  textareaRef,
  insertRef,
  disabled,
  className,
  hint,
  showSalonNomePlaceholder = false,
}: WhatsappPlaceholderChipsProps) {
  const items = useMemo(
    () =>
      insertSalonNomeIntoNormalized(
        normalizePlaceholderItems(placeholders),
        showSalonNomePlaceholder
      ),
    [placeholders, showSalonNomePlaceholder]
  );

  const handleInsert = useCallback(
    (token: string) => {
      if (disabled) return;
      if (insertRef?.current) {
        insertRef.current(token);
        return;
      }
      const el = textareaRef?.current;
      const start = el?.selectionStart ?? value.length;
      const end = el?.selectionEnd ?? value.length;
      const { next, caret } = insertWhatsappPlaceholder(value, token, start, end);
      onChange(next);
      requestAnimationFrame(() => {
        const target = textareaRef?.current;
        if (!target) return;
        target.focus();
        target.setSelectionRange(caret, caret);
      });
    },
    [disabled, insertRef, onChange, textareaRef, value]
  );

  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        'rounded-xl border border-border/70 bg-muted/25 px-3 py-2.5 space-y-2',
        className
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-xs font-medium text-foreground/80">Variáveis da mensagem</p>
        <p className="text-[11px] text-muted-foreground">
          {hint?.trim() || 'Clique para inserir na posição do cursor'}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <button
            key={item.token}
            type="button"
            disabled={disabled}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onClick={() => handleInsert(item.token)}
            className={cn(
              'inline-flex items-center rounded-lg border border-border/70',
              'bg-background px-2.5 py-1.5 text-left shadow-sm',
              'text-[12px] font-medium leading-snug text-foreground',
              'transition-colors hover:border-primary/40 hover:bg-primary/5',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:pointer-events-none disabled:opacity-50'
            )}
            title={`Inserir {{${item.token}}}`}
            aria-label={`Inserir ${item.label}`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
