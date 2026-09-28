import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RecebimentoComNomes, RecebimentoStatus } from '@/types/faturamento';
import { FORMA_PAGAMENTO_LABEL, STATUS_LABEL } from '@/types/faturamento';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

const statusClass: Record<RecebimentoStatus, string> = {
  pago: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  pendente: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  parcial: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

interface ListaRecebimentosProps {
  list: RecebimentoComNomes[];
  isLoading?: boolean;
  className?: string;
}

export function ListaRecebimentos({ list, isLoading, className }: ListaRecebimentosProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="text-sm md:text-base">Recebimentos do período</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 md:h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="p-3 md:p-6">
        <CardTitle className="text-sm md:text-base">Recebimentos do período</CardTitle>
        <CardDescription className="text-xs">
          Ordenado por data (mais recente primeiro)
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 md:p-6 pt-0">
        {list.length === 0 ? (
          <p className="text-xs md:text-sm text-muted-foreground py-6 md:py-8 text-center">
            Nenhum recebimento no período selecionado.
          </p>
        ) : (
          <ul className="space-y-2 md:space-y-3">
            {list.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 md:p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm md:text-base font-medium text-foreground break-words line-clamp-2">
                    {r.procedimento_nome ?? '—'}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground break-words line-clamp-1">
                    {r.cliente_nome ?? '—'}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{FORMA_PAGAMENTO_LABEL[r.forma_pagamento]}</span>
                    <span>
                      {format(parseISO(r.data), "d 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                      statusClass[r.status]
                    )}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                  <span className="font-semibold text-foreground whitespace-nowrap">
                    {formatCurrency(r.valor_total)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
