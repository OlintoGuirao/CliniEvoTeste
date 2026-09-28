import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { HelpCircle, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchWhatsappBotFaqItems, replaceWhatsappBotFaqItems } from '@/lib/whatsappBotFaq';

type FaqDraft = {
  question: string;
  answer: string;
};

function emptyItem(): FaqDraft {
  return { question: '', answer: '' };
}

export function WhatsappFaqSection() {
  const { profile } = useAuth();
  const [items, setItems] = useState<FaqDraft[]>([emptyItem()]);
  const [savedItems, setSavedItems] = useState<FaqDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadItems = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const rows = await fetchWhatsappBotFaqItems(profile.id);
      const mapped = rows.map((row) => ({
        question: row.question,
        answer: row.answer,
      }));
      const next = mapped.length ? mapped : [emptyItem()];
      setItems(next);
      setSavedItems(mapped);
    } catch {
      setItems([emptyItem()]);
      setSavedItems([]);
      toast.error('Não foi possível carregar as dúvidas frequentes.');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const normalizeDrafts = (list: FaqDraft[]) =>
    list
      .map((item) => ({
        question: item.question.trim(),
        answer: item.answer.trim(),
      }))
      .filter((item) => item.question || item.answer);

  const dirty = JSON.stringify(normalizeDrafts(items)) !== JSON.stringify(savedItems);

  const updateItem = (index: number, patch: Partial<FaqDraft>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, emptyItem()]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [emptyItem()];
    });
  };

  const handleSave = async () => {
    if (!profile?.id) return;
    const valid = items
      .map((item) => ({
        question: item.question.trim(),
        answer: item.answer.trim(),
      }))
      .filter((item) => item.question && item.answer);

    setSaving(true);
    try {
      await replaceWhatsappBotFaqItems(profile.id, valid);
      const next = valid.length ? valid : [];
      setSavedItems(next);
      setItems(next.length ? next : [emptyItem()]);
      toast.success(
        valid.length
          ? 'Dúvidas frequentes salvas. A opção 7 aparecerá no menu do bot.'
          : 'Dúvidas removidas. A opção de FAQ sairá do menu do bot.'
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar dúvidas frequentes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <HelpCircle className="h-5 w-5" />
          Dúvidas frequentes do bot
        </CardTitle>
        <CardDescription>
          Cadastre perguntas e respostas que aparecem na opção &quot;Dúvidas frequentes&quot; do menu da
          Secretária WhatsApp. Cada profissional define as suas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <>
            {items.map((item, index) => (
              <div key={index} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-medium">Pergunta {index + 1}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeItem(index)}
                    aria-label={`Remover pergunta ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  value={item.question}
                  onChange={(e) => updateItem(index, { question: e.target.value })}
                  placeholder="Ex: Como me preparar para o procedimento?"
                  maxLength={200}
                />
                <div className="space-y-2">
                  <Label className="text-sm">Resposta</Label>
                  <Textarea
                    value={item.answer}
                    onChange={(e) => updateItem(index, { answer: e.target.value })}
                    placeholder="Resposta que o paciente verá no WhatsApp"
                    rows={4}
                    maxLength={2000}
                  />
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar pergunta
              </Button>
              <Button type="button" size="sm" disabled={saving || !dirty} onClick={() => void handleSave()}>
                {saving ? 'Salvando...' : 'Salvar dúvidas'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
