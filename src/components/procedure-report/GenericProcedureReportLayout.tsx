import type { ReactNode } from 'react';
import { CalendarDays, Camera, ClipboardList, UserRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SessionMedia } from '@/lib/procedurePublicReport';

type SessionRow = {
  key: string;
  label: string;
  value: string;
};

type SessionCard = {
  id: string;
  date: string;
  observacoes: string | null;
  rows: SessionRow[];
  media: SessionMedia;
};

type Props = {
  primary: string;
  procedureName: string;
  patientName: string;
  patientSexLabel: string;
  patientAge: number | null;
  treatmentStartDate: string;
  lastEvalDate: string;
  sessions: SessionCard[];
  notice?: ReactNode;
};

const cardBase =
  'w-full min-w-0 rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_2px_4px_rgba(0,0,0,0.05)] sm:p-6';

function PhotoGrid(props: { title: string; urls: string[] }) {
  const { title, urls } = props;
  if (urls.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#4A4A4A]">{title}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {urls.map((url) => (
          <div key={url} className="overflow-hidden rounded-xl border border-black/10 bg-muted/20">
            <img src={url} alt="" className="aspect-square h-full w-full object-cover" loading="lazy" decoding="async" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GenericProcedureReportLayout(props: Props) {
  const {
    primary,
    procedureName,
    patientName,
    patientSexLabel,
    patientAge,
    treatmentStartDate,
    lastEvalDate,
    sessions,
    notice,
  } = props;

  return (
    <div
      className="relative min-h-screen w-full max-w-[100vw] min-w-0 overflow-x-hidden bg-[#F8F8FA] pb-10 font-sans antialiased"
      style={{ color: '#3F3F46' }}
    >
      <div className="mx-auto w-full min-w-0 max-w-5xl px-3 py-5 sm:px-4 sm:py-7 md:px-8">
        <header className="mb-6 text-center sm:mb-8">
          <h1 className="text-balance break-words text-xl font-bold tracking-tight text-[#2d2d2d] sm:text-2xl md:text-3xl">
            {patientName || 'Paciente'} — Relatório de Evolução
          </h1>
          <p className="mt-2 text-base text-[#5a5a5a] sm:text-lg">{procedureName || 'Procedimento'}</p>
          {notice}
        </header>

        <section className={cardBase}>
          <h2 className="mb-4 flex items-center justify-center gap-2 text-lg font-semibold sm:text-xl" style={{ color: primary }}>
            <UserRound className="h-5 w-5 shrink-0" aria-hidden />
            Dados do paciente
          </h2>
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 sm:gap-4 sm:text-base">
            <p className="min-w-0 break-words">
              <span className="font-semibold" style={{ color: primary }}>
                Nome:
              </span>{' '}
              {patientName || '—'}
            </p>
            <p>
              <span className="font-semibold" style={{ color: primary }}>
                Gênero:
              </span>{' '}
              {patientSexLabel}
            </p>
            <p>
              <span className="font-semibold" style={{ color: primary }}>
                Idade:
              </span>{' '}
              {patientAge != null ? `${patientAge} anos` : '—'}
            </p>
            <p>
              <span className="font-semibold" style={{ color: primary }}>
                Início do tratamento:
              </span>{' '}
              {treatmentStartDate}
            </p>
            <p className="sm:col-span-2">
              <span className="font-semibold" style={{ color: primary }}>
                Última avaliação:
              </span>{' '}
              {lastEvalDate}
            </p>
          </div>
        </section>

        <section className="mt-4 space-y-4 sm:mt-6 sm:space-y-5">
          {sessions.length === 0 ? (
            <Card className={cardBase}>
              <CardContent className="p-0 text-center text-sm text-muted-foreground">Nenhuma sessão registrada para este procedimento.</CardContent>
            </Card>
          ) : (
            sessions.map((session, idx) => {
              const media = session.media;
              return (
                <Card key={session.id} className={cardBase}>
                  <CardHeader className="p-0 pb-3">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
                      <CalendarDays className="h-4 w-4 shrink-0" style={{ color: primary }} aria-hidden />
                      Sessão {sessions.length - idx} • {session.date}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-0">
                    {session.rows.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {session.rows.map((row) => (
                          <div key={`${session.id}-${row.key}`} className="rounded-xl border border-black/10 bg-muted/10 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</p>
                            <p className="mt-0.5 text-sm font-medium text-[#2d2d2d] sm:text-[15px]">{row.value}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sem campos preenchidos nesta sessão.</p>
                    )}

                    {session.observacoes?.trim() ? (
                      <div className="rounded-xl border border-black/10 bg-muted/10 p-3">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                          Observações
                        </p>
                        <p className="text-sm leading-relaxed">{session.observacoes}</p>
                      </div>
                    ) : null}

                    {media.beforeAfterPairs.length > 0 || media.standaloneBefore.length > 0 || media.standaloneAfter.length > 0 || media.otherImages.length > 0 ? (
                      <div className="space-y-3 rounded-xl border border-black/10 bg-white/70 p-3 sm:p-4">
                        <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: primary }}>
                          <Camera className="h-4 w-4" aria-hidden />
                          Registro fotográfico
                        </p>

                        {media.beforeAfterPairs.map((pair) => (
                          <div key={`${session.id}-${pair.key}`} className="space-y-2 rounded-xl border border-black/10 bg-muted/10 p-2.5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{pair.label}</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="overflow-hidden rounded-lg border border-black/10">
                                <p className="border-b px-2 py-1 text-center text-[11px] font-medium text-muted-foreground">Antes</p>
                                <img src={pair.beforeUrl} alt="" className="aspect-square h-full w-full object-cover" loading="lazy" decoding="async" />
                              </div>
                              <div className="overflow-hidden rounded-lg border border-black/10">
                                <p className="border-b px-2 py-1 text-center text-[11px] font-medium text-muted-foreground">Depois</p>
                                <img src={pair.afterUrl} alt="" className="aspect-square h-full w-full object-cover" loading="lazy" decoding="async" />
                              </div>
                            </div>
                          </div>
                        ))}

                        <PhotoGrid title="Antes" urls={media.standaloneBefore.map((p) => p.file_url)} />
                        <PhotoGrid title="Depois" urls={media.standaloneAfter.map((p) => p.file_url)} />
                        <PhotoGrid title="Outras imagens" urls={media.otherImages.map((p) => p.file_url)} />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
