-- Mapeia cada profissional para uma instância UltraMsg
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ultramsg_instance_id text;

-- Um instance_id não pode pertencer a dois profissionais
CREATE UNIQUE INDEX IF NOT EXISTS profiles_ultramsg_instance_id_unique
ON public.profiles (ultramsg_instance_id)
WHERE ultramsg_instance_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.ultramsg_instance_id IS
'ID da instância UltraMsg vinculada ao profissional para rotear mensagens do webhook.';
