import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Pencil, Save, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeAccountType } from '@/lib/accountType';
import { Button } from '@/components/ui/button';
import { AnamneseQuestionnaire } from '@/components/anamnese/AnamneseQuestionnaire';
import type { AnamneseData } from '@/components/anamnese/anamneseTypes';
import { PatientTabPanelSection } from './PatientDetailTabPanel';
import {
  buildPublicAnamneseUrl,
  ensurePatientAnamnesePublicSlug,
} from '@/services/api/patientAnamneseApi';
import { formatPhoneForWhatsApp } from '@/lib/evolutionPdf';
import { buildAnamneseWhatsAppMessage, openWhatsAppWithFallback } from '@/lib/reportShare';
import { loadWhatsappManualTemplates } from '@/lib/loadWhatsappManualTemplates';

export type { AnamneseData } from '@/components/anamnese/anamneseTypes';

type PatientAnamneseSectionProps = {
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  clinicName: string;
  anamneseComplete: boolean;
  onAnamneseUpdated?: () => void;
  onEditingChange?: (editing: boolean) => void;
};

export function PatientAnamneseSection({
  patientId,
  patientName,
  patientPhone,
  clinicName,
  anamneseComplete,
  onAnamneseUpdated,
  onEditingChange,
}: PatientAnamneseSectionProps) {
  const { profile } = useAuth();
  /** Reenvio de anamnese: somente profissional único (não clínica nem salão). */
  const isSoloAccount = normalizeAccountType(profile?.account_type) === 'solo';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [data, setData] = useState<AnamneseData>({});
  const [formData, setFormData] = useState<AnamneseData>({});
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);

  const isEditingRef = useRef(false);
  const onAnamneseUpdatedRef = useRef(onAnamneseUpdated);
  const hadSignatureRef = useRef(false);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    onAnamneseUpdatedRef.current = onAnamneseUpdated;
  }, [onAnamneseUpdated]);

  useEffect(() => {
    return () => {
      onEditingChange?.(false);
    };
  }, [onEditingChange]);

  const fetchAnamnese = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const { data: row } = await supabase
          .from('patient_anamnese')
          .select('data, signature_data, signed_at')
          .eq('patient_id', patientId)
          .maybeSingle();

        if (row) {
          const loaded = (row.data as AnamneseData) ?? {};
          const nextSignature = (row as { signature_data?: string }).signature_data ?? null;
          const nextSignedAt = (row as { signed_at?: string }).signed_at ?? null;
          const nowSigned = Boolean(nextSignedAt || nextSignature);
          const becameSigned = nowSigned && !hadSignatureRef.current;

          setData(loaded);
          if (!isEditingRef.current) setFormData(loaded);
          setSignatureData(nextSignature);
          setSignedAt(nextSignedAt);
          hadSignatureRef.current = nowSigned;

          if (opts?.silent && becameSigned) {
            toast.success('Anamnese assinada pelo paciente.');
            onAnamneseUpdatedRef.current?.();
          }
        } else {
          setData({});
          if (!isEditingRef.current) setFormData({});
          setSignatureData(null);
          setSignedAt(null);
          hadSignatureRef.current = false;
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [patientId]
  );

  useEffect(() => {
    hadSignatureRef.current = false;
    void fetchAnamnese();
  }, [fetchAnamnese]);

  useEffect(() => {
    if (!isEditing) {
      setFormData(data);
    }
  }, [data, isEditing]);

  // Realtime + foco: atualiza quando o paciente assina pelo link público
  useEffect(() => {
    const channel = supabase
      .channel(`patient-anamnese-${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patient_anamnese',
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          void fetchAnamnese({ silent: true });
        }
      )
      .subscribe();

    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') {
        void fetchAnamnese({ silent: true });
      }
    };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [patientId, fetchAnamnese]);

  // Enquanto aguarda assinatura, polling leve (funciona mesmo sem publication realtime)
  useEffect(() => {
    if (signedAt || signatureData || isEditing) return;
    const timer = window.setInterval(() => {
      void fetchAnamnese({ silent: true });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [signedAt, signatureData, isEditing, fetchAnamnese]);

  const update = (key: keyof AnamneseData, value: string | undefined) => {
    setFormData((prev) => ({ ...prev, [key]: value || undefined }));
  };

  function handleCancel() {
    setFormData(data);
    setIsEditing(false);
    onEditingChange?.(false);
  }

  async function persistAnamnese(payload: {
    data: AnamneseData;
    signature_data: string | null;
    signed_at: string | null;
  }) {
    const { error } = await supabase.from('patient_anamnese').upsert(
      {
        patient_id: patientId,
        data: payload.data,
        signature_data: payload.signature_data,
        signed_at: payload.signed_at,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'patient_id' }
    );
    if (error) throw error;
  }

  async function handleSaveSignature(dataUrl: string) {
    setSaving(true);
    try {
      const signedAtIso = new Date().toISOString();
      await persistAnamnese({
        data: formData,
        signature_data: dataUrl,
        signed_at: signedAtIso,
      });
      setData(formData);
      setSignatureData(dataUrl);
      setSignedAt(signedAtIso);
      hadSignatureRef.current = true;
      toast.success('Assinatura salva.');
      onAnamneseUpdated?.();
    } catch {
      toast.error('Erro ao salvar assinatura.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await persistAnamnese({
        data: formData,
        signature_data: signatureData,
        signed_at: signedAt,
      });
      setData(formData);
      toast.success('Anamnese salva com sucesso!');
      setIsEditing(false);
      onEditingChange?.(false);
      onAnamneseUpdated?.();
    } catch {
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSendToPatient() {
    const wa = formatPhoneForWhatsApp(patientPhone);
    if (!wa) {
      toast.error('Cadastre o telefone do paciente na ficha para enviar pelo WhatsApp.');
      return;
    }
    setSendingLink(true);
    try {
      const templates = await loadWhatsappManualTemplates(profile?.id);
      const entry = templates.anamnese_invite;
      if (!entry.enabled) {
        toast.message('Mensagem desativada em Mensagens padrão.');
        return;
      }
      const slug = await ensurePatientAnamnesePublicSlug(patientId);
      // Reenvio reabre a anamnese (limpa assinatura no banco) — sincroniza a UI
      setSignatureData(null);
      setSignedAt(null);
      hadSignatureRef.current = false;
      const url = buildPublicAnamneseUrl(slug);
      const message = buildAnamneseWhatsAppMessage({
        patientName,
        clinicName,
        anamneseUrl: url,
        template: entry.message,
      });
      openWhatsAppWithFallback({ phone: wa, text: message });
      toast.success('Abrindo o WhatsApp…');
      onAnamneseUpdated?.();
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : '';
      toast.error(
        msg.includes('not allowed')
          ? 'Sem permissão para gerar o link.'
          : 'Não foi possível gerar o link da anamnese.'
      );
    } finally {
      setSendingLink(false);
    }
  }

  const resendAnamneseButton =
    isSoloAccount ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 rounded-lg"
        onClick={() => void handleSendToPatient()}
        disabled={sendingLink || saving}
      >
        {sendingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        Reenviar anamnese
      </Button>
    ) : null;

  const headerAction = isEditing ? (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {resendAnamneseButton}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 rounded-lg text-muted-foreground"
        onClick={handleCancel}
        disabled={saving}
      >
        <X className="h-3.5 w-3.5" />
        Cancelar
      </Button>
      <Button
        type="button"
        size="sm"
        className="h-8 gap-1.5 rounded-lg"
        onClick={() => void handleSave()}
        disabled={saving}
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Salvar
      </Button>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {!anamneseComplete ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-lg"
          onClick={() => void handleSendToPatient()}
          disabled={sendingLink}
        >
          {sendingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Enviar para paciente
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 rounded-lg"
        onClick={() => {
          setFormData(data);
          setIsEditing(true);
          onEditingChange?.(true);
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
        Editar
      </Button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <PatientTabPanelSection
      title="Anamnese orofacial"
      action={headerAction}
      contentClassName="p-4 sm:p-5"
    >
      <AnamneseQuestionnaire
        data={formData}
        savedData={data}
        isEditing={isEditing}
        onUpdate={update}
        signatureData={signatureData}
        signedAt={signedAt}
        onSaveSignature={isEditing ? handleSaveSignature : undefined}
      />
    </PatientTabPanelSection>
  );
}
