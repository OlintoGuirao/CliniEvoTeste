import { supabase } from '@/integrations/supabase/client';

export interface AnotacaoRow {
  id: string;
  professional_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const TABLE = 'professional_anotacoes';

export async function fetchAnotacoes(professionalId: string): Promise<AnotacaoRow[]> {
  const { data, error } = await (supabase as unknown as { from: (t: string) => any })
    .from(TABLE)
    .select('id, professional_id, title, content, created_at, updated_at')
    .eq('professional_id', professionalId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AnotacaoRow[];
}

export async function createAnotacao(params: {
  professionalId: string;
  title: string;
  content?: string;
}): Promise<AnotacaoRow> {
  const title = params.title.trim();
  if (!title) throw new Error('Título obrigatório');
  const { data, error } = await (supabase as unknown as { from: (t: string) => any })
    .from(TABLE)
    .insert({
      professional_id: params.professionalId,
      title,
      content: params.content?.trim() ?? '',
    })
    .select('id, professional_id, title, content, created_at, updated_at')
    .single();
  if (error) throw error;
  return data as AnotacaoRow;
}

export async function updateAnotacao(
  id: string,
  params: { title?: string; content?: string }
): Promise<AnotacaoRow> {
  const payload: Record<string, string> = {};
  if (params.title !== undefined) {
    const title = params.title.trim();
    if (!title) throw new Error('Título obrigatório');
    payload.title = title;
  }
  if (params.content !== undefined) payload.content = params.content;
  const { data, error } = await (supabase as unknown as { from: (t: string) => any })
    .from(TABLE)
    .update(payload)
    .eq('id', id)
    .select('id, professional_id, title, content, created_at, updated_at')
    .single();
  if (error) throw error;
  return data as AnotacaoRow;
}

export async function deleteAnotacao(id: string): Promise<void> {
  const { error } = await (supabase as unknown as { from: (t: string) => any })
    .from(TABLE)
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export function anotacaoContentPreview(content: string, maxLength = 80): string {
  const trimmed = content.trim();
  if (!trimmed) return 'Sem conteúdo ainda';
  const singleLine = trimmed.replace(/\s+/g, ' ');
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength).trimEnd()}…`;
}
