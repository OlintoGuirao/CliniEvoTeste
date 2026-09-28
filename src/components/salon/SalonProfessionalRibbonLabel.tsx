import { cn } from '@/lib/utils';
import {
  DEFAULT_SALON_LABEL_COLOR,
  normalizeAgendaLabelColor,
  salonRibbonPalette,
} from '@/lib/salonTeamRoles';

type Props = {
  name: string;
  color?: string | null;
  density?: 'mobile' | 'desktop';
  className?: string;
  /** Nome completo no tooltip (ex.: quando name é apelido). */
  title?: string;
};

/**
 * Etiqueta compacta do profissional na agenda (fita simplificada, legível em células pequenas).
 */
export function SalonProfessionalRibbonLabel({
  name,
  color,
  density = 'mobile',
  className,
  title,
}: Props) {
  const hex = normalizeAgendaLabelColor(color) ?? DEFAULT_SALON_LABEL_COLOR;
  const palette = salonRibbonPalette(hex);
  const textSize = density === 'desktop' ? 'text-[9px] lg:text-[10px]' : 'text-[9px]';

  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-stretch overflow-hidden rounded-md',
        'ring-1 ring-black/[0.06] dark:ring-white/10',
        className
      )}
      title={title ? `Profissional: ${title}` : `Profissional: ${name}`}
      aria-label={title ? `Profissional: ${title}` : `Profissional: ${name}`}
    >
      {/* Faixa lateral — referência visual da cor */}
      <span
        className="w-[3px] shrink-0"
        style={{
          background: `linear-gradient(180deg, ${palette.light}, ${palette.base}, ${palette.dark})`,
        }}
        aria-hidden
      />

      {/* Corpo */}
      <span
        className={cn(
          'relative flex min-w-0 flex-1 items-center gap-1 py-[3px] pl-1.5 pr-2',
          textSize,
          'font-semibold leading-none tracking-tight'
        )}
        style={{
          color: palette.dark,
          backgroundColor: `${palette.base}12`,
        }}
      >
        <span
          className="size-1.5 shrink-0 rounded-full ring-1 ring-white/70 dark:ring-black/20"
          style={{ backgroundColor: palette.base }}
          aria-hidden
        />
        <span className="truncate">{name}</span>
      </span>

      {/* Ponta da fita (triângulo discreto) */}
      <span
        className="relative w-0 shrink-0 self-center"
        style={{
          borderTop: '7px solid transparent',
          borderBottom: '7px solid transparent',
          borderLeft: `5px solid ${palette.base}28`,
        }}
        aria-hidden
      />
    </span>
  );
}

/** Extrai todos os procedimentos salvos como "Procedimento: …" nas observações. */
export function parseAllSalonProceduresFromNotes(notes: string | null | undefined): string[] {
  if (!notes?.trim()) return [];
  const names: string[] = [];
  for (const line of notes.split(/\r?\n/)) {
    const match = line.trim().match(/^Procedimento:\s*(.+)$/i);
    const name = match?.[1]?.trim();
    if (name) names.push(name);
  }
  return names;
}

/** Extrai procedimento salvo como "Procedimento: …" nas observações. */
export function parseSalonProcedureFromNotes(notes: string | null | undefined): {
  procedure: string | null;
  rest: string | null;
} {
  const raw = notes?.trim();
  if (!raw) return { procedure: null, rest: null };

  const match = raw.match(/^Procedimento:\s*(.+?)(?:\n|$)/i);
  if (!match) return { procedure: null, rest: raw };

  const procedure = match[1]?.trim() || null;
  const rest = raw.replace(/^Procedimento:\s*.+?(?:\n|$)/i, '').trim() || null;
  return { procedure, rest };
}
