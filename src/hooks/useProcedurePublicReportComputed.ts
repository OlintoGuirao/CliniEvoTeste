import { useMemo } from 'react';
import { differenceInYears } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';
import {
  type ProcedurePublicReportField,
  type ProcedurePublicReportPhoto,
  type ProcedurePublicReportSession,
  type FieldDisplayRow,
  type SessionMedia,
  buildSessionDisplayRows,
  buildSessionMedia,
  formatSessionDate,
} from '@/lib/procedurePublicReport';

type PatientSex = Database['public']['Enums']['patient_sex'] | null;

type SessionComputed = {
  id: string;
  date: string;
  observacoes: string | null;
  rows: FieldDisplayRow[];
  media: SessionMedia;
};

function sexLabel(sex: PatientSex): string {
  if (sex === 'male') return 'Masculino';
  if (sex === 'female') return 'Feminino';
  if (sex === 'other') return 'Outro';
  return '—';
}

export function useProcedurePublicReportComputed(args: {
  fields: ProcedurePublicReportField[];
  sessions: ProcedurePublicReportSession[];
  photos: ProcedurePublicReportPhoto[];
  patientDob: string | null;
  patientSex: PatientSex;
}) {
  const { fields, sessions, photos, patientDob, patientSex } = args;

  const orderedSessions = useMemo(
    () =>
      sessions
        .slice()
        .sort((a, b) => String(b.session_date ?? '').localeCompare(String(a.session_date ?? ''))),
    [sessions]
  );

  const latestSession = orderedSessions[0] ?? null;

  const patientAge =
    patientDob != null && /^\d{4}-\d{2}-\d{2}/.test(patientDob)
      ? differenceInYears(new Date(), parseLocalDate(patientDob.slice(0, 10)))
      : null;

  const lastEvalDate = latestSession ? formatSessionDate(latestSession.session_date) : '—';

  const sessionsComputed: SessionComputed[] = useMemo(
    () =>
      orderedSessions.map((session) => ({
        id: session.id,
        date: formatSessionDate(session.session_date),
        observacoes: session.observacoes ?? null,
        rows: buildSessionDisplayRows({ fields, session }),
        media: buildSessionMedia({
          photos,
          sessionId: session.id,
          fields,
          sessionData: (session.data as Record<string, unknown> | null) ?? null,
        }),
      })),
    [orderedSessions, fields, photos]
  );

  return {
    sessionsComputed,
    latestSession,
    patientAge,
    patientSexLabel: sexLabel(patientSex),
    lastEvalDate,
  };
}
