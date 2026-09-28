import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatMonthLabel } from '@/lib/budgetQuote';
import type { PagamentoParcelaOrcamento } from '@/hooks/use-faturamento';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface ListaParcelasOrcamentoProps {
  list: PagamentoParcelaOrcamento[];
  isLoading?: boolean;
  className?: string;
}

export function ListaParcelasOrcamento({ list, isLoading, className }: ListaParcelasOrcamentoProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="text-sm md:text-base">Parcelas de orçamento</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          <div className="space-y-3">
            {[1, 2].map((i) => (
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
        <CardTitle className="text-sm md:text-base">Parcelas de orçamento</CardTitle>
        <CardDescription className="text-xs">
          Parcelas marcadas como pagas no período selecionado
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 md:p-6 pt-0">
        {list.length === 0 ? (
          <p className="text-xs md:text-sm text-muted-foreground py-6 md:py-8 text-center">
            Nenhuma parcela de orçamento paga no período selecionado.
          </p>
        ) : (
          <ul className="space-y-2 md:space-y-3">
            {list.map((p) => (
              <li
                key={p.id}
                className={cn(
                  'flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 md:p-3 hover:bg-muted/30 transition-colors'
                )}
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm md:text-base font-medium text-foreground break-words line-clamp-2">
                    {p.orcamento_titulo ?? 'Orçamento'}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground break-words line-clamp-1">
                    {p.paciente_nome ?? '—'}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{formatMonthLabel(p.mes_referencia)}</span>
                    <span>
                      {format(parseISO(p.data_pagamento), "d 'de' MMM 'de' yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-foreground whitespace-nowrap">
                    {formatCurrency(p.valor)}
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
