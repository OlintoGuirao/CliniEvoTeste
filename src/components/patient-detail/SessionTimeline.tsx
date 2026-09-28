import { useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, Loader2, MessageCircle, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface SessionTimelineItem {
  id: string;
  session_date: string;
  observacoes: string | null;
  procedureNames: string[];
  photoUrls?: string[];
  /** Profissional que registrou o atendimento (salão). */
  professionalId?: string | null;
  /** Texto exibido no detalhe (ex.: salão sem metadados técnicos). */
  displayObservacoes?: string | null;
  valorLine?: string | null;
  procedureSlug?: string | null;
  procedureSessionId?: string | null;
  procedureInstanceId?: string | null;
  procedureSessionIds?: string[];
}

interface SessionTimelineProps {
  sessions: SessionTimelineItem[];
  formatDate: (isoDate: string) => string;
  emptyMessage?: string;
  className?: string;
  /** Exibe só a sessão mais recente; controle externo via showFullTimeline. */
  collapseToLatest?: boolean;
  showFullTimeline?: boolean;
  onSessionClick?: (session: SessionTimelineItem) => void;
  onDeleteSession?: (session: SessionTimelineItem) => void | Promise<void>;
  deletingSessionId?: string | null;
  onSendPhotosWhatsApp?: (session: SessionTimelineItem) => void | Promise<void>;
  sendingPhotosSessionId?: string | null;
  /** Salão: editar valor lançado no faturamento. */
  onEditValor?: (session: SessionTimelineItem) => void;
  /** Salão: detalhe só com foto, procedimento e valor pago. */
  variant?: 'clinical' | 'salon';
}

function SalonDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

type SessionTimelineCollapseButtonProps = {
  sessionCount: number;
  showFullTimeline: boolean;
  onToggle: () => void;
};

/** Recriação vetorial do HistoricoCompleto.png — nítida em qualquer tamanho. */
function HistoricoCompletoIcon() {
  const size = 22;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      width={size}
      height={size}
      style={{ width: size, height: size, minWidth: size, minHeight: size, flexShrink: 0 }}
    >
      {/* pasta de trás */}
      <path d="M9 3.5h7.5a2 2 0 0 1 2 2V19" opacity="0.4" />
      {/* pasta da frente (com aba) */}
      <path d="M4.5 7.2V5.8A1.3 1.3 0 0 1 5.8 4.5h3.6l1.3 1.5h7a1.3 1.3 0 0 1 1.3 1.3v11.4a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V7.2z" />
      {/* cruz médica */}
      <path d="M12 8.2v3.6M10.2 10h3.6" />
      {/* gráfico de evolução */}
      <path d="M8.2 16.8 10.6 14.2 12.4 15.6 15.8 12" />
      <path d="M14.2 12h1.8v1.8" />
    </svg>
  );
}

export function SessionTimelineCollapseButton({
  sessionCount,
  showFullTimeline,
  onToggle,
}: SessionTimelineCollapseButtonProps) {
  if (sessionCount <= 1) return null;

  const collapsedLabel = 'Histórico completo';
  const expandedLabel = 'Recolher histórico';

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'h-8 min-w-0 shrink-0 rounded-lg shadow-sm',
        'border-border/50 bg-background/80 px-2 sm:px-2.5',
        'text-sm font-medium text-muted-foreground',
        'hover:bg-muted/50 hover:border-border hover:text-muted-foreground',
        'gap-1.5'
      )}
      onClick={onToggle}
      aria-expanded={showFullTimeline}
      aria-label={showFullTimeline ? expandedLabel : collapsedLabel}
      title={showFullTimeline ? expandedLabel : collapsedLabel}
    >
      <HistoricoCompletoIcon />

      <span className="min-w-0 truncate text-left">{showFullTimeline ? expandedLabel : collapsedLabel}</span>

      {showFullTimeline ? (
        <ChevronUp className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
      ) : (
        <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
      )}
    </Button>
  );
}

export function SessionTimeline({
  sessions,
  formatDate,
  emptyMessage = 'Nenhuma sessão registrada',
  className,
  collapseToLatest = false,
  showFullTimeline = false,
  onSessionClick,
  onDeleteSession,
  deletingSessionId = null,
  onSendPhotosWhatsApp,
  sendingPhotosSessionId = null,
  onEditValor,
  variant = 'clinical',
}: SessionTimelineProps) {
  const isSalon = variant === 'salon';
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const canCollapseTimeline = collapseToLatest && sessions.length > 1;
  const visibleSessions =
    canCollapseTimeline && !showFullTimeline ? sessions.slice(0, 1) : sessions;

  if (sessions.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-border bg-muted/20 text-center',
          className
        )}
      >
        <Calendar className="w-10 h-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <div
        className="absolute left-[15px] sm:left-5 top-6 bottom-6 w-px bg-border"
        aria-hidden
      />
      <ul className="space-y-0">
        {visibleSessions.map((session, index) => {
          const isExpanded = expandedId === session.id;
          const canNavigateToEdit = Boolean(
            onSessionClick && session.procedureSlug && session.procedureSessionId && session.procedureInstanceId
          );
          const hasSalonDetails =
            (session.photoUrls?.length ?? 0) > 0 ||
            session.procedureNames.length > 0 ||
            (session.valorLine?.trim()?.length ?? 0) > 0;
          const hasClinicalDetails =
            (session.displayObservacoes?.trim()?.length ?? 0) > 0 ||
            (session.observacoes?.trim()?.length ?? 0) > 0 ||
            (session.valorLine?.trim()?.length ?? 0) > 0 ||
            (session.photoUrls?.length ?? 0) > 0 ||
            session.procedureNames.length > 0;
          const hasDetails = isSalon ? hasSalonDetails : hasClinicalDetails;
          const isDeleting = deletingSessionId === session.id;
          const isSendingPhotos = sendingPhotosSessionId === session.id;
          const canSendPhotosWhatsApp =
            isSalon &&
            (session.photoUrls?.length ?? 0) > 0 &&
            Boolean(onSendPhotosWhatsApp);
          const isLastVisible = index === visibleSessions.length - 1;

          return (
            <li key={session.id} className="relative flex gap-4 sm:gap-5">
              <div
                className={cn(
                  'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-card text-primary',
                  index === 0 ? 'border-primary' : 'border-border'
                )}
              >
                <Calendar className="h-4 w-4" />
              </div>
              <div className={cn('flex-1 min-w-0', isLastVisible && !showFullTimeline ? 'pb-0' : 'pb-6')}>
                <div
                  className={cn(
                    'rounded-lg border border-border bg-card p-4 transition-colors',
                    (hasDetails || canNavigateToEdit) && 'hover:bg-muted/30',
                    isDeleting && 'opacity-60'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => {
                        if (canNavigateToEdit && onSessionClick) {
                          onSessionClick(session);
                          return;
                        }
                        if (hasDetails) setExpandedId(isExpanded ? null : session.id);
                      }}
                      className={cn(
                        'flex-1 min-w-0 text-left',
                        (hasDetails || canNavigateToEdit) && 'cursor-pointer',
                        !hasDetails && !canNavigateToEdit && 'cursor-default'
                      )}
                    >
                      <time className="font-semibold text-foreground block">
                        {formatDate(session.session_date)}
                      </time>
                      {!isSalon && session.procedureNames.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {session.procedureNames.join(' · ')}
                        </p>
                      )}
                      {isSalon && !isExpanded && session.procedureNames.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {session.procedureNames.join(' · ')}
                        </p>
                      )}
                      {isSalon && !isExpanded && session.valorLine ? (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Valor pago:{' '}
                          <span className="font-medium text-foreground">{session.valorLine}</span>
                        </p>
                      ) : null}
                      {!isExpanded && (session.photoUrls?.length ?? 0) > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {session.photoUrls!.slice(0, 4).map((url, photoIndex) => (
                            <span
                              key={`${url}-${photoIndex}`}
                              className="block h-12 w-12 rounded-md border border-input overflow-hidden bg-muted/30"
                            >
                              <img
                                src={url}
                                alt=""
                                className="h-full w-full object-cover"
                                decoding="async"
                                loading="lazy"
                              />
                            </span>
                          ))}
                          {session.photoUrls!.length > 4 ? (
                            <span className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-border text-[10px] font-medium text-muted-foreground">
                              +{session.photoUrls!.length - 4}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </button>

                    {isSalon && onEditValor && session.valorLine ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 -mr-1 -mt-0.5 rounded-lg text-muted-foreground hover:bg-muted"
                        title="Editar lançamento"
                        disabled={isDeleting}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditValor(session);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : null}

                    {canSendPhotosWhatsApp ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 -mr-1 -mt-0.5 rounded-lg text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600"
                        title="Enviar fotos por WhatsApp"
                        disabled={isDeleting || isSendingPhotos}
                        onClick={async (e) => {
                          e.stopPropagation();
                          await onSendPhotosWhatsApp?.(session);
                        }}
                      >
                        {isSendingPhotos ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MessageCircle className="h-4 w-4" />
                        )}
                      </Button>
                    ) : null}

                    {onDeleteSession ? (
                      <AlertDialog
                        open={confirmDeleteId === session.id}
                        onOpenChange={(open) => {
                          if (!open) setConfirmDeleteId(null);
                        }}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 -mr-1 -mt-0.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Apagar sessão"
                          disabled={isDeleting}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(session.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Apagar esta sessão?</AlertDialogTitle>
                            <AlertDialogDescription>
                              A sessão de{' '}
                              <span className="font-medium text-foreground">
                                {formatDate(session.session_date)}
                              </span>
                              {session.procedureNames.length > 0
                                ? ` (${session.procedureNames.join(' · ')})`
                                : ''}{' '}
                              será removida da timeline e do histórico. Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              disabled={isDeleting}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={async (e) => {
                                e.preventDefault();
                                setConfirmDeleteId(null);
                                await onDeleteSession(session);
                              }}
                            >
                              {isDeleting ? 'Apagando...' : 'Apagar'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : null}
                  </div>

                  {isExpanded && !canNavigateToEdit && (
                    <div className="mt-3 pt-3 border-t border-border/60 space-y-3">
                      {isSalon ? (
                        <>
                          {(session.photoUrls?.length ?? 0) > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {session.photoUrls!.map((url, photoIndex) => (
                                <a
                                  key={`${url}-${photoIndex}`}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block rounded-lg border border-input overflow-hidden bg-muted/20 hover:opacity-90 transition-opacity aspect-square"
                                >
                                  <img
                                    src={url}
                                    alt={`Foto do atendimento ${photoIndex + 1}`}
                                    className="w-full h-full object-cover"
                                    decoding="async"
                                    loading="lazy"
                                  />
                                </a>
                              ))}
                            </div>
                          ) : null}
                          {session.procedureNames.length > 0 ? (
                            <SalonDetailRow
                              label="Procedimento"
                              value={session.procedureNames.join(' · ')}
                            />
                          ) : null}
                          {session.valorLine ? (
                            <div className="flex items-start justify-between gap-2">
                              <SalonDetailRow label="Valor pago" value={session.valorLine} />
                              {onEditValor ? (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 shrink-0"
                                  title="Editar lançamento"
                                  disabled={isDeleting}
                                  onClick={() => onEditValor(session)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {(session.photoUrls?.length ?? 0) > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {session.photoUrls!.map((url, photoIndex) => (
                                <a
                                  key={`${url}-${photoIndex}`}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block rounded-lg border border-input overflow-hidden bg-muted/20 hover:opacity-90 transition-opacity aspect-square"
                                >
                                  <img
                                    src={url}
                                    alt={`Foto do atendimento ${photoIndex + 1}`}
                                    className="w-full h-full object-cover"
                                    decoding="async"
                                    loading="lazy"
                                  />
                                </a>
                              ))}
                            </div>
                          ) : null}
                          {session.valorLine ? (
                            <p className="text-sm text-muted-foreground">
                              Valor:{' '}
                              <span className="font-medium text-foreground">{session.valorLine}</span>
                            </p>
                          ) : null}
                          {(session.displayObservacoes ?? session.observacoes)?.trim() ? (
                            <p className="text-sm text-foreground whitespace-pre-wrap">
                              {session.displayObservacoes ?? session.observacoes}
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
