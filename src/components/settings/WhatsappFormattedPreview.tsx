import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { whatsappMarkdownToHtml } from '@/lib/whatsappFormatting';

/** Prévia fiel ao WhatsApp: negrito/itálico/riscado renderizados, sem asteriscos crus. */
export function WhatsappFormattedPreview({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const html = useMemo(() => whatsappMarkdownToHtml(text || ''), [text]);
  return (
    <div
      className={cn(
        'text-sm leading-relaxed break-words',
        '[&_strong]:font-semibold [&_b]:font-semibold',
        '[&_em]:italic [&_i]:italic',
        '[&_s]:line-through',
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
