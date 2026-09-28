import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from 'react';
import { Bold, Italic, Strikethrough, List, ListOrdered } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  htmlToWhatsappMarkdown,
  normalizeWhatsappMarkers,
  whatsappMarkdownToHtml,
  wrapWhatsappSelection,
} from '@/lib/whatsappFormatting';
import { insertWhatsappPlaceholder } from '@/components/settings/WhatsappPlaceholderChips';

type EditorMode = 'visual' | 'texto';

type WhatsappMessageEditorProps = {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  minHeightClassName?: string;
  /** Ref opcional para o textarea (modo Texto) — usado pelos chips de placeholder. */
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  /** Expõe inserção de placeholder (modo Visual ou Texto). */
  insertRef?: MutableRefObject<((token: string) => void) | null>;
};

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded border border-transparent text-foreground/80',
        'hover:bg-background hover:border-border',
        'disabled:pointer-events-none disabled:opacity-40',
        active && 'border-border bg-background shadow-sm'
      )}
    >
      {children}
    </button>
  );
}

function isEffectivelyEmptyHtml(html: string): boolean {
  const t = html
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, '')
    .replace(/<div>\s*<\/div>/gi, '')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
  return !t;
}

export function WhatsappMessageEditor({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  className,
  minHeightClassName = 'min-h-[140px]',
  textareaRef: externalTextareaRef,
  insertRef,
}: WhatsappMessageEditorProps) {
  const [mode, setMode] = useState<EditorMode>('visual');
  const visualRef = useRef<HTMLDivElement | null>(null);
  const internalTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = externalTextareaRef ?? internalTextareaRef;
  /** Evita reescrever o HTML no meio da digitação (só no modo Visual ativo). */
  const skipNextValueSync = useRef(false);

  const readVisualMarkdown = useCallback(() => {
    const el = visualRef.current;
    if (!el) return value;
    return normalizeWhatsappMarkers(htmlToWhatsappMarkdown(el.innerHTML));
  }, [value]);

  const writeVisualFromMarkdown = useCallback((markdown: string) => {
    const el = visualRef.current;
    if (!el) return;
    const html = markdown.trim() ? whatsappMarkdownToHtml(markdown) : '';
    if (el.innerHTML !== html) {
      el.innerHTML = html || '';
    }
  }, []);

  /** Sempre que entrar no Visual (ou o value mudar de fora), preenche o contenteditable. */
  useLayoutEffect(() => {
    if (mode !== 'visual') return;

    if (skipNextValueSync.current) {
      skipNextValueSync.current = false;
      const el = visualRef.current;
      // Se o editor acabou de montar vazio, nunca pular — era o bug Texto→Visual.
      if (el && !isEffectivelyEmptyHtml(el.innerHTML)) return;
    }

    writeVisualFromMarkdown(value);
  }, [mode, value, writeVisualFromMarkdown]);

  const emitFromVisual = useCallback(() => {
    const el = visualRef.current;
    if (!el) return;
    skipNextValueSync.current = true;
    onChange(normalizeWhatsappMarkers(htmlToWhatsappMarkdown(el.innerHTML)));
  }, [onChange]);

  const switchMode = (next: EditorMode) => {
    if (next === mode) return;
    if (mode === 'visual' && next === 'texto') {
      // Flush do Visual antes de desmontar o contenteditable
      const markdown = readVisualMarkdown();
      skipNextValueSync.current = false;
      onChange(markdown);
    }
    setMode(next);
  };

  useEffect(() => {
    if (!insertRef) return;
    insertRef.current = (token: string) => {
      if (disabled) return;
      if (mode === 'texto') {
        const el = textareaRef.current;
        const start = el?.selectionStart ?? value.length;
        const end = el?.selectionEnd ?? value.length;
        const { next, caret } = insertWhatsappPlaceholder(value, token, start, end);
        onChange(next);
        requestAnimationFrame(() => {
          const target = textareaRef.current;
          if (!target) return;
          target.focus();
          target.setSelectionRange(caret, caret);
        });
        return;
      }
      const el = visualRef.current;
      if (!el) {
        const { next } = insertWhatsappPlaceholder(value, token, value.length, value.length);
        onChange(next);
        return;
      }
      el.focus();
      const placeholderText = token.startsWith('{{') ? token : `{{${token}}}`;
      const ok = document.execCommand('insertText', false, placeholderText);
      if (!ok) {
        const { next } = insertWhatsappPlaceholder(value, token, value.length, value.length);
        onChange(next);
        return;
      }
      emitFromVisual();
    };
    return () => {
      insertRef.current = null;
    };
  }, [disabled, emitFromVisual, insertRef, mode, onChange, textareaRef, value]);

  const runVisualCommand = (
    command: 'bold' | 'italic' | 'strikeThrough' | 'insertUnorderedList' | 'insertOrderedList'
  ) => {
    if (disabled) return;
    const el = visualRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(command, false);
    emitFromVisual();
  };

  const runTextoWrap = (marker: '*' | '_' | '~') => {
    if (disabled) return;
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const { next, caretStart, caretEnd } = wrapWhatsappSelection(value, start, end, marker);
    onChange(normalizeWhatsappMarkers(next));
    requestAnimationFrame(() => {
      const target = textareaRef.current;
      if (!target) return;
      target.focus();
      target.setSelectionRange(caretStart, caretEnd);
    });
  };

  const onToolbar = (kind: 'bold' | 'italic' | 'strike' | 'ul' | 'ol') => {
    if (mode === 'visual') {
      if (kind === 'bold') runVisualCommand('bold');
      else if (kind === 'italic') runVisualCommand('italic');
      else if (kind === 'strike') runVisualCommand('strikeThrough');
      else if (kind === 'ul') runVisualCommand('insertUnorderedList');
      else runVisualCommand('insertOrderedList');
      return;
    }
    if (kind === 'bold') runTextoWrap('*');
    else if (kind === 'italic') runTextoWrap('_');
    else if (kind === 'strike') runTextoWrap('~');
  };

  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-background', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border/80 bg-muted/30 px-3 py-1.5">
        <p className="text-xs font-medium text-muted-foreground">Conteúdo</p>
        <div className="flex items-end gap-0">
          {(
            [
              { id: 'texto' as const, label: 'Texto' },
              { id: 'visual' as const, label: 'Visual' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              disabled={disabled}
              onClick={() => switchMode(tab.id)}
              className={cn(
                'rounded-t-md border border-b-0 px-3 py-1 text-xs font-medium transition-colors',
                mode === tab.id
                  ? 'border-border bg-background text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/70 bg-muted/40 px-1.5 py-1">
        <ToolbarButton
          label="Negrito (*texto*)"
          disabled={disabled}
          onClick={() => onToolbar('bold')}
        >
          <Bold className="h-3.5 w-3.5" strokeWidth={2.5} />
        </ToolbarButton>
        <ToolbarButton
          label="Itálico (_texto_)"
          disabled={disabled}
          onClick={() => onToolbar('italic')}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Riscado (~texto~)"
          disabled={disabled}
          onClick={() => onToolbar('strike')}
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <ToolbarButton
          label="Lista"
          disabled={disabled || mode === 'texto'}
          onClick={() => onToolbar('ul')}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Lista numerada"
          disabled={disabled || mode === 'texto'}
          onClick={() => onToolbar('ol')}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <p className="ml-auto hidden px-2 text-[10px] text-muted-foreground sm:block">
          WhatsApp: *negrito* _itálico_ ~riscado~
        </p>
      </div>

      {mode === 'visual' ? (
        <div className="relative">
          {!value.trim() && placeholder ? (
            <p className="pointer-events-none absolute left-3 top-2 z-0 whitespace-pre-wrap text-sm text-muted-foreground">
              {placeholder}
            </p>
          ) : null}
          <div
            id={id}
            ref={visualRef}
            role="textbox"
            aria-multiline="true"
            contentEditable={!disabled}
            suppressContentEditableWarning
            data-placeholder={placeholder}
            className={cn(
              'relative z-10 w-full bg-background px-3 py-2 text-sm outline-none',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
              minHeightClassName,
              disabled && 'cursor-not-allowed opacity-50'
            )}
            onInput={emitFromVisual}
            onBlur={emitFromVisual}
            onPaste={(e) => {
              e.preventDefault();
              const text = e.clipboardData.getData('text/plain');
              document.execCommand('insertText', false, text);
              emitFromVisual();
            }}
          />
        </div>
      ) : (
        <Textarea
          id={id}
          ref={textareaRef}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          rows={6}
          className={cn(
            'rounded-none border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
            minHeightClassName
          )}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onChange(normalizeWhatsappMarkers(value))}
        />
      )}
    </div>
  );
}
