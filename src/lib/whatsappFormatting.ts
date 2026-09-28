/**
 * Formatação de texto do WhatsApp (não é HTML).
 * Negrito: *texto*  |  Itálico: _texto_  |  Riscado: ~texto~
 * Espaços colados aos marcadores quebram o efeito no app.
 */

const PLACEHOLDER_TOKEN = '\uE000';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function protectPlaceholders(text: string): { text: string; slots: string[] } {
  const slots: string[] = [];
  const next = text.replace(/\{\{\s*[a-z0-9_]+\s*\}\}/gi, (m) => {
    const i = slots.length;
    slots.push(m);
    return `${PLACEHOLDER_TOKEN}${i}${PLACEHOLDER_TOKEN}`;
  });
  return { text: next, slots };
}

function restorePlaceholders(text: string, slots: string[]): string {
  return text.replace(
    new RegExp(`${PLACEHOLDER_TOKEN}(\\d+)${PLACEHOLDER_TOKEN}`, 'g'),
    (_m, i) => slots[Number(i)] ?? ''
  );
}

/** Remove * _ ~ de valores “atômicos” para não quebrar negrito do template (*…{{horario}}…*). */
const PLAIN_PLACEHOLDER_KEYS = new Set([
  'nome',
  'primeiro_nome',
  'nome_completo',
  'profissional',
  'clinica',
  'nome_salao',
  'consulta',
  'procedimento',
  'dia',
  'data',
  'horario',
  'hora',
  'hora_fim',
  'url',
  'valor',
  'descricao',
  'agendado',
]);

export function stripWhatsappMarkers(value: string): string {
  return String(value || '').replace(/[*_~]/g, '');
}

/**
 * Se um trecho *...* (ou _…_ / ~…~) contém marcadores internos, remove os internos
 * para o WhatsApp exibir o negrito/itálico/riscado corretamente.
 */
export function collapseNestedWhatsappMarkers(text: string): string {
  let s = String(text || '');
  const collapseOne = (marker: '*' | '_' | '~') => {
    const esc = marker === '*' ? '\\*' : `\\${marker}`;
    const re = new RegExp(`${esc}([^${marker}\\n]*(?:${esc}[^${marker}\\n]*)+)${esc}`, 'g');
    return s.replace(re, (full) => {
      const inner = full.slice(1, -1).split(marker).join('');
      return `${marker}${inner.trim()}${marker}`;
    });
  };
  for (let i = 0; i < 6; i += 1) {
    const prev = s;
    s = collapseOne('*');
    s = collapseOne('_');
    s = collapseOne('~');
    // Asteriscos órfãos grudados em pares já fechados (*texto**)
    s = s.replace(/(\*[^*\n]+\*)\*+/g, '$1');
    s = s.replace(/\*+(\*[^*\n]+\*)/g, '$1');
    if (s === prev) break;
  }
  return s;
}

export function isPlainWhatsappPlaceholderKey(key: string): boolean {
  return PLAIN_PLACEHOLDER_KEYS.has(String(key || '').toLowerCase());
}

/** Markdown WhatsApp → HTML visual (somente strong/em/s + <br>). */
export function whatsappMarkdownToHtml(markdown: string): string {
  const collapsed = collapseNestedWhatsappMarkers(normalizeWhatsappMarkers(markdown));
  const { text, slots } = protectPlaceholders(collapsed);
  let s = escapeHtml(text);
  // Negrito / itálico / riscado sem espaços nas bordas do conteúdo
  s = s.replace(/\*([^*\n]+?)\*/g, (_m, inner: string) => {
    const t = String(inner);
    if (/^\s|\s$/.test(t)) return `*${t}*`;
    return `<strong>${t}</strong>`;
  });
  s = s.replace(/_([^_\n]+?)_/g, (_m, inner: string) => {
    const t = String(inner);
    if (/^\s|\s$/.test(t)) return `_${t}_`;
    return `<em>${t}</em>`;
  });
  s = s.replace(/~([^~\n]+?)~/g, (_m, inner: string) => {
    const t = String(inner);
    if (/^\s|\s$/.test(t)) return `~${t}~`;
    return `<s>${t}</s>`;
  });
  s = s.replace(/\n/g, '<br>');
  return restorePlaceholders(s, slots.map(escapeHtml));
}

function wrapMarker(inner: string, marker: '*' | '_' | '~'): string {
  const trimmed = inner.replace(/^\s+|\s+$/g, '');
  if (!trimmed) return inner;
  const lead = inner.match(/^\s*/)?.[0] ?? '';
  const trail = inner.match(/\s*$/)?.[0] ?? '';
  return `${lead}${marker}${trimmed}${marker}${trail}`;
}

/** HTML do contenteditable → markdown WhatsApp. */
export function htmlToWhatsappMarkdown(html: string): string {
  const root = document.createElement('div');
  root.innerHTML = html;

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const children = Array.from(el.childNodes).map(walk).join('');

    if (tag === 'br') return '\n';
    if (tag === 'div' || tag === 'p') {
      const body = children.replace(/\n$/, '');
      return body ? `${body}\n` : '\n';
    }
    if (tag === 'li') {
      const body = children.replace(/\n+/g, ' ').trim();
      return body ? `• ${body}\n` : '';
    }
    if (tag === 'ul' || tag === 'ol') {
      return children.endsWith('\n') ? children : `${children}\n`;
    }
    if (tag === 'strong' || tag === 'b') return wrapMarker(children, '*');
    if (tag === 'em' || tag === 'i') return wrapMarker(children, '_');
    if (tag === 's' || tag === 'strike' || tag === 'del') return wrapMarker(children, '~');
    if (tag === 'u') return children; // WhatsApp não tem sublinhado
    return children;
  };

  let out = Array.from(root.childNodes).map(walk).join('');
  out = out.replace(/\u00a0/g, ' ');
  // Evita múltiplas quebras no fim
  out = out.replace(/\n{3,}/g, '\n\n').replace(/\n$/, '');
  return normalizeWhatsappMarkers(out);
}

/** Corrige * texto * → *texto* (espaços que quebram o negrito no WhatsApp). */
export function normalizeWhatsappMarkers(text: string): string {
  const { text: protectedText, slots } = protectPlaceholders(text);
  let s = protectedText;
  s = s.replace(/\*\s*([^*\n]+?)\s*\*/g, (_m, inner: string) => `*${String(inner).trim()}*`);
  s = s.replace(/_\s*([^_\n]+?)\s*_/g, (_m, inner: string) => `_${String(inner).trim()}_`);
  s = s.replace(/~\s*([^~\n]+?)\s*~/g, (_m, inner: string) => `~${String(inner).trim()}~`);
  return restorePlaceholders(s, slots);
}

export function wrapWhatsappSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  marker: '*' | '_' | '~'
): { next: string; caretStart: number; caretEnd: number } {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  const selected = value.slice(start, end);
  const trimmed = selected.trim();
  if (!trimmed) {
    const insert = `${marker}${marker}`;
    const next = value.slice(0, start) + insert + value.slice(end);
    return { next, caretStart: start + 1, caretEnd: start + 1 };
  }
  const lead = selected.match(/^\s*/)?.[0] ?? '';
  const trail = selected.match(/\s*$/)?.[0] ?? '';
  const wrapped = `${lead}${marker}${trimmed}${marker}${trail}`;
  const next = value.slice(0, start) + wrapped + value.slice(end);
  const innerStart = start + lead.length + 1;
  const innerEnd = innerStart + trimmed.length;
  return { next, caretStart: innerStart, caretEnd: innerEnd };
}
