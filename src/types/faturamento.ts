/** Status do recebimento */
export type RecebimentoStatus = 'pago' | 'pendente' | 'parcial';

/** Forma de pagamento */
export type FormaPagamento = 'dinheiro' | 'cartao' | 'pix';

export interface Recebimento {
  id: string;
  cliente_id: string;
  profissional_id: string;
  procedimento_id: string | null;
  salon_procedure_id?: string | null;
  valor_total: number;
  valor_recebido: number;
  forma_pagamento: FormaPagamento;
  parcelas?: number | null;
  status: RecebimentoStatus;
  data: string;
  created_at: string;
}

/** Recebimento com nomes expandidos (joins) */
export interface RecebimentoComNomes extends Recebimento {
  cliente_nome?: string | null;
  procedimento_nome?: string | null;
}

export interface FaturamentoFiltros {
  dataInicio: string;
  dataFim: string;
  profissionalId?: string | null;
  procedimentoId?: string | null;
  formaPagamento?: FormaPagamento | null;
  status?: RecebimentoStatus | null;
}

export interface FaturamentoResumo {
  faturamentoTotal: number;
  totalRecebido: number;
  totalAReceber: number;
  quantidadeAtendimentos: number;
}

export const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'PIX',
};

export const STATUS_LABEL: Record<RecebimentoStatus, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  parcial: 'Parcial',
};
