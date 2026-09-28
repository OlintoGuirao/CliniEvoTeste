import { supabase } from '@/integrations/supabase/client';
import type { PixKeyType, PixSettings } from '@/lib/cobrancaPix';

export async function fetchPixSettings(professionalId: string): Promise<PixSettings> {
  const { data, error } = await supabase
    .from('profiles')
    .select('pix_key, pix_key_type, pix_receiver_name')
    .eq('id', professionalId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    pix_key: (data?.pix_key as string | null) ?? null,
    pix_key_type: (data?.pix_key_type as PixKeyType | null) ?? null,
    pix_receiver_name: (data?.pix_receiver_name as string | null) ?? null,
  };
}

export async function savePixSettings(params: {
  professionalId: string;
  pixKey: string;
  pixKeyType: PixKeyType;
  receiverName: string;
}): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      pix_key: params.pixKey,
      pix_key_type: params.pixKeyType,
      pix_receiver_name: params.receiverName,
    })
    .eq('id', params.professionalId);

  if (error) throw new Error(error.message);
}

export async function removePixSettings(professionalId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      pix_key: null,
      pix_key_type: null,
      pix_receiver_name: null,
    })
    .eq('id', professionalId);

  if (error) throw new Error(error.message);
}
