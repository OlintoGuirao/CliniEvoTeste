export type AgendaOpenMode = 'dia' | 'semana' | 'mes';

const VALID_MODES: AgendaOpenMode[] = ['dia', 'semana', 'mes'];

/** Normaliza valor vindo do banco ou da URL. */
export function normalizeAgendaOpenMode(value: unknown): AgendaOpenMode {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw && VALID_MODES.includes(raw as AgendaOpenMode)) {
    return raw as AgendaOpenMode;
  }
  return 'dia';
}
