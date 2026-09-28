export const DEFAULT_LUNCH_BREAK_LABEL = 'Almoço';

export type LunchBreak = {
  start: string;
  end: string;
  description?: string;
};

export type LunchBreakProfile = {
  lunch_breaks?: unknown;
  lunch_start_time?: string | null;
  lunch_end_time?: string | null;
};

export function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export function normalizeTimeInput(value: string | null | undefined): string {
  const minutes = timeToMinutes(value);
  if (minutes == null) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function parseLunchBreakRow(row: unknown): LunchBreak | null {
  if (!row || typeof row !== 'object') return null;
  const start = normalizeTimeInput((row as { start?: string | null }).start);
  const end = normalizeTimeInput((row as { end?: string | null }).end);
  if (!start || !end) return null;
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  if (startMin == null || endMin == null || endMin <= startMin) return null;
  const rawDescription = (row as { description?: string | null }).description;
  const description =
    typeof rawDescription === 'string' && rawDescription.trim()
      ? rawDescription.trim()
      : undefined;
  return { start, end, ...(description ? { description } : {}) };
}

export function getLunchBreaksFromProfile(profile: LunchBreakProfile | null | undefined): LunchBreak[] {
  if (!profile) return [];

  if (Array.isArray(profile.lunch_breaks)) {
    const parsed = profile.lunch_breaks
      .map((row) => parseLunchBreakRow(row))
      .filter((row): row is LunchBreak => row != null);
    if (parsed.length > 0) return parsed;
  }

  const start = normalizeTimeInput(profile.lunch_start_time);
  const end = normalizeTimeInput(profile.lunch_end_time);
  if (!start || !end) return [];
  return parseLunchBreakRow({ start, end }) ? [{ start, end }] : [];
}

export function getLunchBreakForTime(time: string, breaks: LunchBreak[]): LunchBreak | null {
  const minutes = timeToMinutes(time);
  if (minutes == null) return null;
  return (
    breaks.find((item) => {
      const start = timeToMinutes(item.start);
      const end = timeToMinutes(item.end);
      if (start == null || end == null || end <= start) return false;
      return minutes >= start && minutes < end;
    }) ?? null
  );
}

export function isTimeInLunchBreaks(time: string, breaks: LunchBreak[]): boolean {
  return getLunchBreakForTime(time, breaks) != null;
}

export function getLunchBreakLabelForTime(time: string, breaks: LunchBreak[]): string {
  const match = getLunchBreakForTime(time, breaks);
  const label = match?.description?.trim();
  return label || DEFAULT_LUNCH_BREAK_LABEL;
}

export function prepareLunchBreaksForSave(breaks: LunchBreak[]): {
  lunch_breaks: LunchBreak[] | null;
  lunch_start_time: string | null;
  lunch_end_time: string | null;
} {
  const valid = breaks
    .map((item) => {
      const parsed = parseLunchBreakRow({
        start: item.start,
        end: item.end,
        description: item.description,
      });
      if (!parsed) return null;
      return parsed;
    })
    .filter((item): item is LunchBreak => item != null);

  return {
    lunch_breaks: valid.length > 0 ? valid : null,
    lunch_start_time: valid[0]?.start ?? null,
    lunch_end_time: valid[0]?.end ?? null,
  };
}

export function createEmptyLunchBreak(): LunchBreak {
  return { start: '', end: '', description: DEFAULT_LUNCH_BREAK_LABEL };
}

export function createLunchBreakDraft(): LunchBreak {
  return { start: '12:00', end: '13:00', description: DEFAULT_LUNCH_BREAK_LABEL };
}
