-- Promoções enviadas em massa via WhatsApp (Secretária)
CREATE TABLE IF NOT EXISTS public.whatsapp_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('text', 'text_image', 'image', 'video')),
  message_text TEXT,
  media_url TEXT,
  media_storage_path TEXT,
  media_mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('sending', 'completed', 'failed')),
  total_recipients INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_promotions_professional_created
  ON public.whatsapp_promotions (professional_id, created_at DESC);

COMMENT ON TABLE public.whatsapp_promotions IS
  'Histórico de promoções disparadas para pacientes via WhatsApp';

ALTER TABLE public.whatsapp_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profissional vê suas promoções WhatsApp" ON public.whatsapp_promotions;
CREATE POLICY "Profissional vê suas promoções WhatsApp"
  ON public.whatsapp_promotions FOR SELECT
  TO authenticated
  USING (professional_id = auth.uid());

DROP POLICY IF EXISTS "Profissional insere suas promoções WhatsApp" ON public.whatsapp_promotions;
CREATE POLICY "Profissional insere suas promoções WhatsApp"
  ON public.whatsapp_promotions FOR INSERT
  TO authenticated
  WITH CHECK (professional_id = auth.uid());

-- Bucket público para mídia das promoções (Evolution API precisa de URL acessível)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-promotions',
  'whatsapp-promotions',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users upload whatsapp promotion media" ON storage.objects;
CREATE POLICY "Users upload whatsapp promotion media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'whatsapp-promotions'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users update whatsapp promotion media" ON storage.objects;
CREATE POLICY "Users update whatsapp promotion media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'whatsapp-promotions'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users delete whatsapp promotion media" ON storage.objects;
CREATE POLICY "Users delete whatsapp promotion media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'whatsapp-promotions'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Public read whatsapp promotion media" ON storage.objects;
CREATE POLICY "Public read whatsapp promotion media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'whatsapp-promotions');
