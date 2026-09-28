import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, CheckCircle2, Clock, Stethoscope } from 'lucide-react';
import type { FaturamentoResumo } from '@/types/faturamento';
import { cn } from '@/lib/utils';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

interface ResumoCardsProps {
  resumo: FaturamentoResumo;
  className?: string;
}

export function ResumoCards({ resumo, className }: ResumoCardsProps) {
  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4', className)}>
      <Card>
        <CardHeader className="pb-1 md:pb-2 p-2 md:p-6">
          <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 md:w-4 md:h-4" />
            Faturamento total
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-2 md:px-6 md:pb-6 pt-0">
          <p className="text-sm md:text-2xl font-bold text-foreground">
            {formatCurrency(resumo.faturamentoTotal)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-1 md:pb-2 p-2 md:p-6">
          <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-600" />
            Total recebido
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-2 md:px-6 md:pb-6 pt-0">
          <p className="text-sm md:text-2xl font-bold text-green-700 dark:text-green-400">
            {formatCurrency(resumo.totalRecebido)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-1 md:pb-2 p-2 md:p-6">
          <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-600" />
            Total a receber
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-2 md:px-6 md:pb-6 pt-0">
          <p className="text-sm md:text-2xl font-bold text-amber-700 dark:text-amber-400">
            {formatCurrency(resumo.totalAReceber)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-1 md:pb-2 p-2 md:p-6">
          <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Stethoscope className="w-3.5 h-3.5 md:w-4 md:h-4" />
            Atendimentos
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-2 md:px-6 md:pb-6 pt-0">
          <p className="text-sm md:text-2xl font-bold text-foreground">
            {resumo.quantidadeAtendimentos}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
