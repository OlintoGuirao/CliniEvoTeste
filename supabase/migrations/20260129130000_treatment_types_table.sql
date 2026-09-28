-- Tabela de tipos de tratamento (cada profissional tem sua lista)
CREATE TABLE public.treatment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_treatment_types_professional_id ON public.treatment_types(professional_id);

ALTER TABLE public.treatment_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professionals can manage their own treatment types"
  ON public.treatment_types FOR ALL
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

-- Substituir enum por FK: adicionar coluna e remover a antiga
ALTER TABLE public.patients
  ADD COLUMN treatment_type_id UUID REFERENCES public.treatment_types(id) ON DELETE SET NULL;

-- Remover coluna antiga (enum) se existir
ALTER TABLE public.patients DROP COLUMN IF EXISTS treatment_type;

-- Remover tipo enum se existir (opcional, para limpar)
DROP TYPE IF EXISTS public.patient_treatment_type;
