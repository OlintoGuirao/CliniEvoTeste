import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
import { Stethoscope, ChevronRight, Plus, Flag, Play, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type SessionProgress = {
  percent: number;
  showPercentLabel: boolean;
};

function computeSessionProgress(
  sessionCount: number,
  totalSessionsPlanned: number | null | undefined,
  isFinished: boolean
): SessionProgress {
  if (isFinished) {
    return { percent: 100, showPercentLabel: totalSessionsPlanned != null && totalSessionsPlanned > 0 };
  }

  if (sessionCount <= 0) {
    return { percent: 0, showPercentLabel: false };
  }

  const hasPlanned = totalSessionsPlanned != null && totalSessionsPlanned > 0;
  const raw = hasPlanned
    ? Math.round((sessionCount / totalSessionsPlanned) * 100)
    : sessionCount * 10;

  return {
    percent: Math.min(99, raw),
    showPercentLabel: hasPlanned,
  };
}

export interface ActiveProcedureCardProps {
  id: string;
  procedureName: string;
  procedureSlug: string | null;
  status: string;
  dataInicio: string;
  lastSessionDate: string | null;
  sessionCount: number;
  totalSessionsPlanned?: number | null;
  formatDate: (isoDate: string) => string;
  consultationUrl: string;
  hideNewSessionButton?: boolean;
  onStatusChanged?: () => void;
}

export function ActiveProcedureCard({
  id,
  procedureName,
  procedureSlug,
  status,
  dataInicio,
  lastSessionDate,
  sessionCount,
  totalSessionsPlanned,
  formatDate,
  consultationUrl,
  hideNewSessionButton = false,
  onStatusChanged,
}: ActiveProcedureCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const isActive = status === 'em_andamento';
  const isFinished = status === 'finalizado';
  const canToggleStatus = isActive || isFinished;

  const sessionProgress = computeSessionProgress(sessionCount, totalSessionsPlanned, isFinished);
  const showProgressBar = isFinished || sessionCount > 0;

  const detailUrl = procedureSlug ? `/procedures/${procedureSlug}/${id}` : null;

  async function handleConfirmToggle() {
    const nextStatus = isActive ? 'finalizado' : 'em_andamento';
    setSaving(true);
    try {
      const { error } = await supabase
        .from('procedure_instances')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success(
        nextStatus === 'finalizado'
          ? `"${procedureName}" encerrado.`
          : `"${procedureName}" reiniciado.`
      );
      setConfirmOpen(false);
      onStatusChanged?.();
    } catch {
      toast.error('Não foi possível atualizar o procedimento. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card className="border-border/60 transition-shadow hover:shadow-md">
        <CardContent className="p-3 md:p-4 lg:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
            <div className="min-w-0 flex-1 w-full">
              <div className="flex items-center gap-2 md:gap-3">
                <div
                  className={cn(
                    'flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-lg',
                    isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Stethoscope className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm md:text-base font-semibold text-foreground break-words line-clamp-2">
                    {procedureName}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Início: {formatDate(dataInicio)}
                    {lastSessionDate && <> · Última sessão: {lastSessionDate}</>}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1 gap-2">
                  <span className="min-w-0">
                    {sessionCount}{' '}
                    {sessionCount === 1 ? 'sessão realizada' : 'sessões realizadas'}
                    {totalSessionsPlanned != null && totalSessionsPlanned > 0 && (
                      <> / {totalSessionsPlanned} planejada{totalSessionsPlanned !== 1 ? 's' : ''}</>
                    )}
                  </span>
                  {sessionProgress.showPercentLabel ? (
                    <span className="shrink-0">{sessionProgress.percent}%</span>
                  ) : null}
                </div>
                {showProgressBar ? (
                  <Progress value={sessionProgress.percent} className="h-2" />
                ) : null}
              </div>
              <div className="mt-3">
                <span
                  className={cn(
                    'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                    isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {isActive ? 'Em andamento' : isFinished ? 'Finalizado' : status}
                </span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full lg:w-auto lg:max-w-[min(100%,22rem)] lg:shrink-0">
              {canToggleStatus ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-xl text-muted-foreground min-h-[44px] touch-manipulation w-full sm:flex-1 lg:w-auto lg:flex-none"
                  onClick={() => setConfirmOpen(true)}
                  disabled={saving}
                >
                  {isActive ? <Flag className="h-4 w-4 shrink-0" /> : <Play className="h-4 w-4 shrink-0" />}
                  {isActive ? 'Encerrar procedimento' : 'Iniciar procedimento'}
                </Button>
              ) : null}
              {detailUrl ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl min-h-[44px] touch-manipulation w-full sm:flex-1 lg:w-auto lg:flex-none"
                  asChild
                >
                  <Link to={detailUrl}>
                    Ver evolução
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
              {!hideNewSessionButton && isActive ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5 rounded-xl min-h-[44px] touch-manipulation w-full sm:flex-1 lg:w-auto lg:flex-none"
                  asChild
                >
                  <Link to={consultationUrl}>
                    <Plus className="h-4 w-4" />
                    Nova sessão
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !saving && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isActive ? 'Confirmação de encerramento' : 'Reiniciar procedimento?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {isActive ? (
                  <>
                    <p>
                      Tem certeza que deseja encerrar{' '}
                      <strong className="text-foreground">{procedureName}</strong>?
                    </p>
                    <p>
                      O procedimento passará para <strong className="text-foreground">finalizado</strong>. Você
                      poderá reiniciá-lo a qualquer momento.
                    </p>
                  </>
                ) : (
                  <p>
                    <strong className="text-foreground">{procedureName}</strong> voltará para{' '}
                    <strong className="text-foreground">em andamento</strong> e poderá receber novas sessões.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={isActive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmToggle();
              }}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : isActive ? (
                'Confirmar encerramento'
              ) : (
                'Iniciar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
