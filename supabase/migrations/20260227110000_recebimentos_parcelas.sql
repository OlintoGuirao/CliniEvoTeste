-- Parcelas no cartão: número de parcelas quando forma_pagamento = 'cartao'
ALTER TABLE public.recebimentos
  ADD COLUMN IF NOT EXISTS parcelas INTEGER NULL CHECK (parcelas IS NULL OR (parcelas >= 1 AND parcelas <= 12));

COMMENT ON COLUMN public.recebimentos.parcelas IS 'Número de parcelas (1-12) quando forma_pagamento = cartao; NULL para dinheiro/PIX.';
