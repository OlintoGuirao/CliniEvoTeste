import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  clinicAuthorizedProcedureUiStatusLabel,
  type ClinicAuthorizedProcedureUiStatus,
} from '@/lib/clinicAuthorizedProcedures';
import type { ClinicAuthorizedProcedureCard } from '@/services/api/clinicAuthorizedProceduresApi';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Stethoscope } from 'lucide-react';

function statusClass(status: ClinicAuthorizedProcedureUiStatus): string {
  switch (status) {
    case 'authorized':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'in_progress':
      return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200';
    case 'finished':
      return 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300';
    case 'cancelled':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
  }
}

type ClinicAuthorizedProcedureCardsProps = {
  cards: ClinicAuthorizedProcedureCard[];
  loading?: boolean;
  professionalNameById?: Record<string, string>;
  onSelect: (card: ClinicAuthorizedProcedureCard) => void;
  selectingPlanItemId?: string | null;
};

export function ClinicAuthorizedProcedureCards({
  cards,
  loading = false,
  professionalNameById = {},
  onSelect,
  selectingPlanItemId = null,
}: ClinicAuthorizedProcedureCardsProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando procedimentos autorizados…
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
        <Stethoscope className="mx-auto mb-3 h-8 w-8 text-muted-foreground/70" />
        <p className="text-sm font-medium text-foreground">
          Nenhum procedimento autorizado disponível
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          O paciente precisa ter um plano odontológico autorizado ou em negociação com itens
          elegíveis.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {cards.map((card) => {
        const disabled = card.uiStatus === 'cancelled' || card.uiStatus === 'finished';
        const selecting = selectingPlanItemId === card.planItemId;
        return (
          <Card
            key={card.planItemId}
            className={cn(
              'overflow-hidden border-border/80 shadow-sm',
              card.uiStatus === 'in_progress' && 'ring-1 ring-amber-300/60'
            )}
          >
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-4 pb-2">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base font-semibold leading-snug">
                  {card.procedureName}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{card.planName}</p>
              </div>
              <Badge
                variant="outline"
                className={cn('shrink-0 font-medium', statusClass(card.uiStatus))}
              >
                {clinicAuthorizedProcedureUiStatusLabel(card.uiStatus)}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-2">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-3">
                {card.locationLabel ? (
                  <div className="col-span-2 sm:col-span-3">
                    <dt className="text-muted-foreground">Dente / região</dt>
                    <dd className="font-medium text-foreground">{card.locationLabel}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-muted-foreground">Previsto</dt>
                  <dd className="font-medium">{card.quantity}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Realizado</dt>
                  <dd className="font-medium">{card.finishedCount}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Restante</dt>
                  <dd className="font-medium">{card.remainingCount}</dd>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <dt className="text-muted-foreground">Profissional responsável</dt>
                  <dd className="font-medium">
                    {professionalNameById[card.responsibleProfessionalId] ?? '—'}
                  </dd>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <dt className="text-muted-foreground">Último atendimento</dt>
                  <dd className="font-medium">
                    {card.lastSessionAt
                      ? format(parseISO(card.lastSessionAt), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })
                      : '—'}
                  </dd>
                </div>
              </dl>

              <Button
                type="button"
                className="w-full gap-2"
                disabled={disabled || selecting}
                onClick={() => onSelect(card)}
              >
                {selecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {card.openSessionId
                  ? 'Continuar atendimento'
                  : disabled
                    ? 'Indisponível'
                    : 'Iniciar atendimento'}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
