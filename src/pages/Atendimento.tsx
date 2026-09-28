import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { isAtendimentoModuleEnabled } from '@/lib/professionalModules';
import { isClinicOnlyAccount } from '@/lib/accountType';
import { fetchConversations, fetchMessages } from '@/services/api/atendimentoApi';
import { fetchProfessionalUiSettings } from '@/services/api/dynamicProcedureFieldSettingsApi';
import { fetchPatients } from '@/api/patients';
import { useClinicFrontDeskScope } from '@/hooks/use-clinic-front-desk-scope';
import { useClinicWhatsapp } from '@/hooks/use-clinic-whatsapp';
import { WhatsappConnectPanel } from '@/components/atendimento/WhatsappConnectPanel';
import { ClinicAtendimentoInbox } from '@/components/atendimento/ClinicAtendimentoInbox';
import type { AtendimentoLinkedPatient } from '@/lib/atendimentoClinic';

/**
 * Central de Atendimento WhatsApp — exclusivo para contas clínica.
 * Profissional único e salão não acessam esta rota.
 */
export default function Atendimento() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const {
    isFrontDeskStaff,
    scope: frontDeskScope,
    isLoading: frontDeskLoading,
    error: frontDeskError,
  } = useClinicFrontDeskScope();
  const moduleEnabled = isAtendimentoModuleEnabled(profile);
  const isClinicAccount = isClinicOnlyAccount(profile?.account_type);

  // Recepção: sempre o WhatsApp do master. Nunca cair no id da própria recepção.
  const whatsappProfessionalId = isFrontDeskStaff
    ? frontDeskScope?.whatsappProfessionalId || ''
    : profile?.id ?? '';
  const professionalName = profile?.full_name?.split(' ')[0] || 'Você';
  const scopeReady = !isFrontDeskStaff || (!frontDeskLoading && !!whatsappProfessionalId);

  const whatsapp = useClinicWhatsapp(
    isClinicAccount && scopeReady && whatsappProfessionalId
      ? whatsappProfessionalId
      : undefined
  );
  const whatsappReady = !isClinicAccount || whatsapp.connected;

  const [selectedId, setSelectedId] = useState<string | null>(
    () => searchParams.get('conversationId') || null
  );
  const [replyText, setReplyText] = useState(() => searchParams.get('draft') || '');
  const draftAppliedRef = useRef(false);

  const uiQuery = useQuery({
    queryKey: ['professional-ui-settings', whatsappProfessionalId],
    queryFn: () => fetchProfessionalUiSettings({ professionalId: whatsappProfessionalId }),
    enabled: isClinicAccount && moduleEnabled && scopeReady && !!whatsappProfessionalId,
  });
  const botName = uiQuery.data?.whatsapp_bot_name || 'Secretária Virtual';

  const convQuery = useQuery({
    queryKey: ['atendimento-conversations', whatsappProfessionalId],
    queryFn: () => fetchConversations(whatsappProfessionalId),
    enabled:
      isClinicAccount &&
      moduleEnabled &&
      scopeReady &&
      !!whatsappProfessionalId &&
      whatsappReady,
    refetchInterval: 10000,
  });

  const conversations = convQuery.data ?? [];
  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;

  const deepLinkPhone = searchParams.get('phone');
  const deepLinkName = searchParams.get('name');
  const activeConv =
    selectedConv ??
    (selectedId
      ? {
          id: selectedId,
          patient_phone: deepLinkPhone || '—',
          patient_name: deepLinkName,
          status: 'open' as const,
          opened_at: '',
          last_message_at: '',
          last_message_preview: null,
        }
      : null);

  const patientsQuery = useQuery({
    queryKey: ['atendimento-clinic-patients', profile?.id],
    queryFn: () => fetchPatients(profile!.id),
    enabled: isClinicAccount && moduleEnabled && !!profile?.id && whatsappReady,
  });

  const patients: AtendimentoLinkedPatient[] = useMemo(
    () =>
      (patientsQuery.data ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        phone: p.phone,
      })),
    [patientsQuery.data]
  );

  useEffect(() => {
    if (!whatsappReady || conversations.length === 0) return;
    const fromUrl = searchParams.get('conversationId');
    if (fromUrl && conversations.some((c) => c.id === fromUrl)) {
      setSelectedId(fromUrl);
      return;
    }
    if (deepLinkPhone) {
      const match = conversations.find((c) => c.patient_phone === deepLinkPhone);
      if (match) setSelectedId(match.id);
    }
  }, [whatsappReady, conversations, searchParams, deepLinkPhone]);

  useEffect(() => {
    const draft = searchParams.get('draft');
    if (draft && selectedId && !draftAppliedRef.current) {
      setReplyText(draft);
      draftAppliedRef.current = true;
    }
  }, [searchParams, selectedId]);

  const msgQuery = useQuery({
    queryKey: ['atendimento-messages', selectedId],
    queryFn: () => fetchMessages(selectedId!),
    enabled: isClinicAccount && moduleEnabled && !!selectedId && whatsappReady,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!selectedId && conversations.length > 0 && whatsappReady) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId, whatsappReady]);

  useEffect(() => {
    if (searchParams.get('conversationId') && whatsappReady) {
      void convQuery.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep link once on mount / connect
  }, [whatsappReady]);

  if (!isClinicAccount) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!moduleEnabled) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isFrontDeskStaff && frontDeskLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-sm text-muted-foreground">
        Carregando central de atendimento...
      </div>
    );
  }

  if (isFrontDeskStaff && !whatsappProfessionalId) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm font-medium">Não foi possível identificar o WhatsApp da clínica.</p>
        <p className="text-xs text-muted-foreground max-w-md">
          {frontDeskError ||
            'Confirme se a clínica tem um master (owner) ativo. Atualize a página e tente de novo.'}
        </p>
      </div>
    );
  }

  if (!whatsapp.connected) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col -m-3 sm:-m-3 md:-m-4 p-4">
        <WhatsappConnectPanel
          connected={whatsapp.connected}
          qr={whatsapp.qr}
          loadingQr={whatsapp.loadingQr}
          checking={whatsapp.checking}
          error={whatsapp.error}
          onConnect={() => void whatsapp.connect()}
          onRefresh={() => void whatsapp.refresh()}
          className="flex-1 min-h-[320px] justify-center"
        />
      </div>
    );
  }

  return (
    <ClinicAtendimentoInbox
      whatsappProfessionalId={whatsappProfessionalId}
      professionalName={professionalName}
      botName={botName}
      conversations={conversations}
      conversationsLoading={convQuery.isLoading}
      conversationsFetching={convQuery.isFetching}
      conversationsError={
        convQuery.error instanceof Error ? convQuery.error.message : null
      }
      onRefreshConversations={() => void convQuery.refetch()}
      selectedId={selectedId}
      onSelectConversation={setSelectedId}
      activeConv={activeConv}
      messages={msgQuery.data ?? []}
      messagesLoading={msgQuery.isLoading}
      patients={patients}
      replyText={replyText}
      onReplyTextChange={setReplyText}
    />
  );
}
