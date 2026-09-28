import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bot,
  Check,
  ChevronRight,
  RefreshCw,
  Send,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatPhoneDisplay } from '@/lib/phone';
import {
  ATENDIMENTO_QUICK_REPLIES,
  conversationQueueStatus,
  countClinicConversationFilters,
  filterClinicConversations,
  resolveConversationPatient,
  type AtendimentoLinkedPatient,
  type AtendimentoQueueFilter,
} from '@/lib/atendimentoClinic';
import {
  closeConversation,
  linkConversationPatient,
  sendReply,
  syncConversations,
  type Conversation,
  type Message,
} from '@/services/api/atendimentoApi';
import { AtendimentoContextPanel } from '@/components/atendimento/AtendimentoContextPanel';

function formatTime(isoStr: string) {
  try {
    return format(parseISO(isoStr), 'HH:mm', { locale: ptBR });
  } catch {
    return '';
  }
}

function formatListTime(isoStr: string) {
  try {
    const d = parseISO(isoStr);
    const today = new Date();
    if (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    ) {
      return format(d, 'HH:mm');
    }
    return format(d, 'dd/MM', { locale: ptBR });
  } catch {
    return '';
  }
}

type Props = {
  whatsappProfessionalId: string;
  professionalName: string;
  botName: string;
  conversations: Conversation[];
  conversationsLoading: boolean;
  conversationsFetching: boolean;
  conversationsError?: string | null;
  onRefreshConversations: () => void;
  selectedId: string | null;
  onSelectConversation: (id: string | null) => void;
  activeConv: Conversation | null;
  messages: Message[];
  messagesLoading: boolean;
  patients: AtendimentoLinkedPatient[];
  replyText: string;
  onReplyTextChange: (value: string) => void;
};

const FILTER_PILLS: Array<{ id: AtendimentoQueueFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'waiting_you', label: 'Aguardando você' },
  { id: 'waiting_client', label: 'Aguardando cliente' },
  { id: 'no_patient', label: 'Sem cliente' },
];

export function ClinicAtendimentoInbox({
  whatsappProfessionalId,
  professionalName,
  botName,
  conversations,
  conversationsLoading,
  conversationsFetching,
  conversationsError,
  onRefreshConversations,
  selectedId,
  onSelectConversation,
  activeConv,
  messages,
  messagesLoading,
  patients,
  replyText,
  onReplyTextChange,
}: Props) {
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<AtendimentoQueueFilter>('all');
  const [search, setSearch] = useState('');
  const [syncedAt, setSyncedAt] = useState(() => new Date());
  const [mobileContextOpen, setMobileContextOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await syncConversations(whatsappProfessionalId);
      await queryClient.invalidateQueries({
        queryKey: ['atendimento-conversations', whatsappProfessionalId],
      });
      setSyncedAt(new Date());
      toast.success(
        result.found === 0
          ? 'Nenhum chat encontrado na Evolution'
          : `${result.imported} de ${result.found} conversa${result.found === 1 ? '' : 's'} sincronizada${result.imported === 1 ? '' : 's'}`
      );
      onRefreshConversations();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  const counts = useMemo(
    () => countClinicConversationFilters(conversations, patients),
    [conversations, patients]
  );

  const filteredConversations = useMemo(
    () =>
      filterClinicConversations({
        conversations,
        patients,
        filter,
        search,
      }),
    [conversations, patients, filter, search]
  );

  const linkedPatient = useMemo(
    () => resolveConversationPatient(activeConv, patients),
    [activeConv, patients]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setSyncedAt(new Date());
  }, [conversations]);

  const sendMutation = useMutation({
    mutationFn: () =>
      sendReply(selectedId!, {
        professionalId: whatsappProfessionalId,
        body: replyText.trim(),
        phone: activeConv!.patient_phone,
      }),
    onSuccess: () => {
      onReplyTextChange('');
      void queryClient.invalidateQueries({ queryKey: ['atendimento-messages', selectedId] });
      void queryClient.invalidateQueries({
        queryKey: ['atendimento-conversations', whatsappProfessionalId],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeMutation = useMutation({
    mutationFn: () => closeConversation(selectedId!, activeConv?.patient_phone),
    onSuccess: () => {
      toast.success('Conversa encerrada. O bot voltará a responder o paciente.');
      onSelectConversation(null);
      void queryClient.invalidateQueries({
        queryKey: ['atendimento-conversations', whatsappProfessionalId],
      });
    },
    onError: () => toast.error('Não foi possível encerrar a conversa.'),
  });

  const linkMutation = useMutation({
    mutationFn: (patient: AtendimentoLinkedPatient | null) =>
      linkConversationPatient(selectedId!, {
        patientId: patient?.id ?? null,
        patientName: patient?.full_name ?? null,
      }),
    onSuccess: () => {
      toast.success('Vínculo atualizado.');
      void queryClient.invalidateQueries({
        queryKey: ['atendimento-conversations', whatsappProfessionalId],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSend = () => {
    if (!replyText.trim() || !selectedId || !activeConv) return;
    sendMutation.mutate();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const waitingYouCount = counts.waiting_you;

  return (
    <div className="relative flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-muted/20 -m-3 sm:-m-3 md:-m-4">
      <header className="shrink-0 border-b bg-card px-4 py-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Atendimentos
            </h1>
            <p className="text-sm text-muted-foreground">
              Central de comunicação e acompanhamento ao vivo
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline text-xs text-muted-foreground">
              Atualizado {format(syncedAt, 'HH:mm:ss')}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              disabled={syncing || conversationsFetching}
              onClick={() => void handleSync()}
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', (syncing || conversationsFetching) && 'animate-spin')}
              />
              Sincronizar
            </Button>
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {FILTER_PILLS.map((pill) => {
            const active = filter === pill.id;
            const count = counts[pill.id];
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setFilter(pill.id)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                  active
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted'
                )}
              >
                {pill.label} ({count})
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={cn(
            'flex flex-col border-r bg-card',
            'w-full sm:w-[300px] lg:w-[320px] shrink-0',
            selectedId ? 'hidden sm:flex' : 'flex'
          )}
        >
          <div className="p-3 border-b space-y-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversa, cliente ou telefone"
              className="h-9 text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversationsLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : conversationsError ? (
              <div className="py-10 px-4 text-center text-sm text-destructive">
                Falha ao carregar conversas.
                <br />
                <span className="text-xs text-muted-foreground">{conversationsError}</span>
              </div>
                ) : filteredConversations.length === 0 ? (
              <div className="py-10 px-4 text-center text-sm text-muted-foreground">
                {conversations.length === 0
                  ? 'Nenhuma conversa ainda. Toque em Sincronizar para puxar os chats do WhatsApp.'
                  : 'Nenhuma conversa neste filtro.'}
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const linked = resolveConversationPatient(conv, patients);
                const queue = conversationQueueStatus(conv);
                const selected = selectedId === conv.id;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => onSelectConversation(conv.id)}
                    className={cn(
                      'w-full text-left px-3 py-3 border-b transition-colors',
                      selected ? 'bg-primary/8 border-l-2 border-l-primary' : 'hover:bg-muted/50'
                    )}
                  >
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground shrink-0">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate">
                            {linked?.full_name || conv.patient_name || conv.patient_phone}
                          </span>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {formatListTime(conv.last_message_at)}
                          </span>
                        </div>
                        {conv.last_message_preview ? (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {conv.last_message_preview}
                          </p>
                        ) : null}
                        <span
                          className={cn(
                            'inline-flex mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium',
                            queue === 'waiting_you'
                              ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                              : 'bg-sky-500/15 text-sky-800 dark:text-sky-300'
                          )}
                        >
                          {queue === 'waiting_you' ? 'Aguardando você' : 'Aguardando cliente'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main
          className={cn(
            'flex flex-col flex-1 overflow-hidden bg-background',
            !selectedId ? 'hidden sm:flex' : 'flex'
          )}
        >
          {!activeConv ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm px-6 text-center">
              Selecione uma conversa para começar o atendimento.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-card shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    className="sm:hidden text-muted-foreground"
                    onClick={() => onSelectConversation(null)}
                  >
                    ←
                  </button>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {linkedPatient?.full_name ||
                        activeConv.patient_name ||
                        activeConv.patient_phone}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatPhoneDisplay(activeConv.patient_phone) || activeConv.patient_phone}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'hidden sm:inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
                      conversationQueueStatus(activeConv) === 'waiting_you'
                        ? 'bg-emerald-500/15 text-emerald-800'
                        : 'bg-sky-500/15 text-sky-800'
                    )}
                  >
                    {conversationQueueStatus(activeConv) === 'waiting_you'
                      ? 'Aguardando você'
                      : 'Aguardando cliente'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="xl:hidden h-8 text-xs"
                    onClick={() => setMobileContextOpen((v) => !v)}
                  >
                    Contexto
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                    disabled={closeMutation.isPending}
                    onClick={() => closeMutation.mutate()}
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Encerrar
                  </Button>
                </div>
              </div>

              {mobileContextOpen ? (
                <div className="xl:hidden border-b bg-card max-h-[40%] overflow-y-auto">
                  <AtendimentoContextPanel
                    conversation={activeConv}
                    linkedPatient={linkedPatient}
                    patients={patients}
                    linking={linkMutation.isPending}
                    onLink={(p) => linkMutation.mutate(p)}
                    onUnlink={() => linkMutation.mutate(null)}
                    inline
                  />
                </div>
              ) : null}

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messagesLoading ? (
                  <div className="text-center text-sm text-muted-foreground">Carregando...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    Nenhuma mensagem ainda.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const sender =
                      msg.sender_type ||
                      (msg.direction === 'inbound' ? 'patient' : 'professional');
                    const isOutbound = sender === 'bot' || sender === 'professional';
                    const label =
                      sender === 'bot'
                        ? botName
                        : sender === 'professional'
                          ? professionalName
                          : linkedPatient?.full_name || activeConv.patient_name || 'Paciente';

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex flex-col gap-1',
                          isOutbound ? 'items-end' : 'items-start'
                        )}
                      >
                        <div
                          className={cn(
                            'flex items-center gap-1.5 px-1 text-[11px] font-medium',
                            sender === 'bot'
                              ? 'text-violet-700 dark:text-violet-300'
                              : sender === 'professional'
                                ? 'text-primary'
                                : 'text-muted-foreground'
                          )}
                        >
                          {sender === 'bot' && <Bot className="w-3 h-3" />}
                          {sender === 'professional' && <User className="w-3 h-3" />}
                          <span>{label}</span>
                        </div>
                        <div
                          className={cn(
                            'max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm',
                            sender === 'bot'
                              ? 'bg-violet-100 text-violet-950 dark:bg-violet-950/50 dark:text-violet-100 rounded-br-sm'
                              : sender === 'professional'
                                ? 'bg-primary text-primary-foreground rounded-br-sm'
                                : 'bg-muted text-foreground rounded-bl-sm'
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                          <p
                            className={cn(
                              'text-[10px] mt-1 text-right',
                              sender === 'professional'
                                ? 'text-primary-foreground/70'
                                : sender === 'bot'
                                  ? 'text-violet-800/60 dark:text-violet-200/60'
                                  : 'text-muted-foreground'
                            )}
                          >
                            {formatTime(msg.sent_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="shrink-0 border-t bg-card px-4 py-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    onValueChange={(id) => {
                      const item = ATENDIMENTO_QUICK_REPLIES.find((r) => r.id === id);
                      if (item) onReplyTextChange(item.body);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[180px] text-xs">
                      <SelectValue placeholder="Resposta rápida..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ATENDIMENTO_QUICK_REPLIES.map((r) => (
                        <SelectItem key={r.id} value={r.id} className="text-xs">
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Textarea
                    value={replyText}
                    onChange={(e) => onReplyTextChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite sua mensagem..."
                    className="min-h-[44px] max-h-40 resize-none text-sm"
                    rows={1}
                  />
                  <Button
                    size="icon"
                    className="shrink-0 h-11 w-11 rounded-full"
                    disabled={!replyText.trim() || sendMutation.isPending}
                    onClick={handleSend}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </main>

        <AtendimentoContextPanel
          conversation={activeConv}
          linkedPatient={linkedPatient}
          patients={patients}
          linking={linkMutation.isPending}
          onLink={(p) => linkMutation.mutate(p)}
          onUnlink={() => linkMutation.mutate(null)}
        />
      </div>

      {waitingYouCount > 0 ? (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md z-10">
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-600 text-white px-3 py-2 shadow-lg">
            <Check className="h-4 w-4 shrink-0 opacity-80" />
            <p className="text-sm flex-1 min-w-0">
              {waitingYouCount} atendimento{waitingYouCount === 1 ? '' : 's'} aguardando sua
              resposta
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs shrink-0"
              onClick={() => {
                setFilter('waiting_you');
                const first = conversations.find(
                  (c) => conversationQueueStatus(c) === 'waiting_you'
                );
                if (first) onSelectConversation(first.id);
              }}
            >
              Abrir
              <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
