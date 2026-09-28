import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  ExternalLink,
  MoreHorizontal,
  UserPlus,
  UserRound,
  Unlink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatPhoneDisplay } from '@/lib/phone';
import { supabase } from '@/integrations/supabase/client';
import type { Conversation } from '@/services/api/atendimentoApi';
import {
  conversationQueueStatus,
  type AtendimentoLinkedPatient,
} from '@/lib/atendimentoClinic';
import { AtendimentoLinkPatientDialog } from '@/components/atendimento/AtendimentoLinkPatientDialog';

type Props = {
  conversation: Conversation | null;
  linkedPatient: AtendimentoLinkedPatient | null;
  patients: AtendimentoLinkedPatient[];
  linking: boolean;
  onLink: (patient: AtendimentoLinkedPatient) => void;
  onUnlink: () => void;
  /** Painel embutido (mobile) em vez da coluna lateral. */
  inline?: boolean;
  className?: string;
};

export function AtendimentoContextPanel({
  conversation,
  linkedPatient,
  patients,
  linking,
  onLink,
  onUnlink,
  inline = false,
  className,
}: Props) {
  const [linkOpen, setLinkOpen] = useState(false);

  const queue = conversation ? conversationQueueStatus(conversation) : null;
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd');

  const appointmentsQuery = useQuery({
    queryKey: ['atendimento-patient-appointments', linkedPatient?.id],
    enabled: !!linkedPatient?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, appointment_date, start_time, full_name, notes')
        .eq('patient_id', linkedPatient!.id)
        .gte('appointment_date', today)
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });

  const upcoming = appointmentsQuery.data ?? [];

  const statusBadges = useMemo(() => {
    if (!conversation) return [];
    return [
      {
        key: 'status',
        label: conversation.status === 'open' ? 'Status: Aberto' : 'Status: Encerrado',
      },
      {
        key: 'queue',
        label:
          queue === 'waiting_you' ? 'Fila: Aguardando você' : 'Fila: Aguardando cliente',
      },
      {
        key: 'contact',
        label: conversation.patient_id
          ? 'Contato: Cliente vinculado'
          : linkedPatient
            ? 'Contato: Sugestão por telefone'
            : 'Contato: Não vinculado',
      },
    ];
  }, [conversation, linkedPatient, queue]);

  const shellClass = cn(
    'flex flex-col bg-card overflow-hidden',
    inline ? 'w-full border-0' : 'hidden xl:flex w-[320px] shrink-0 border-l',
    className
  );

  if (!conversation) {
    return (
      <aside className={shellClass}>
        <div className="px-4 py-3 border-b">
          <p className="text-sm font-semibold">Contexto do atendimento</p>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
          Selecione uma conversa para ver o contexto.
        </div>
      </aside>
    );
  }

  return (
    <>
      <aside className={shellClass}>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
          <p className="text-sm font-semibold">Contexto do atendimento</p>
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {statusBadges.map((b) => (
              <Badge
                key={b.key}
                variant="secondary"
                className="text-[10px] font-medium px-2 py-0.5"
              >
                {b.label}
              </Badge>
            ))}
          </div>

          <section className="rounded-xl border bg-background/60 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              Cliente
            </div>
            {linkedPatient ? (
              <>
                <p className="text-sm font-semibold">{linkedPatient.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatPhoneDisplay(linkedPatient.phone || conversation.patient_phone) ||
                    conversation.patient_phone}
                </p>
                {!conversation.patient_id ? (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    Sugestão pelo telefone — confirme o vínculo.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                    <Link to={`/patients/${linkedPatient.id}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      Ver ficha
                    </Link>
                  </Button>
                  {!conversation.patient_id ? (
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      disabled={linking}
                      onClick={() => onLink(linkedPatient)}
                    >
                      Confirmar vínculo
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-muted-foreground"
                      disabled={linking}
                      onClick={onUnlink}
                    >
                      <Unlink className="h-3.5 w-3.5 mr-1" />
                      Desvincular
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">Cliente não vinculado</p>
                <p className="text-xs text-muted-foreground">
                  Telefone:{' '}
                  {formatPhoneDisplay(conversation.patient_phone) || conversation.patient_phone}
                </p>
                <Button
                  size="sm"
                  className="h-8 text-xs w-full"
                  onClick={() => setLinkOpen(true)}
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                  Vincular cliente
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 text-xs w-full">
                  <Link to="/patients/new">Cadastrar paciente</Link>
                </Button>
              </>
            )}
            {linkedPatient ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs w-full"
                onClick={() => setLinkOpen(true)}
              >
                Trocar vínculo
              </Button>
            ) : null}
          </section>

          <section className="rounded-xl border bg-background/60 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Pendências e agenda
            </div>
            {!linkedPatient ? (
              <p className="text-xs text-muted-foreground">Vincule o cliente para ver a agenda.</p>
            ) : appointmentsQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">Carregando...</p>
            ) : upcoming.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma consulta futura.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((apt) => (
                  <li key={apt.id} className="rounded-lg border px-2.5 py-2 text-xs">
                    <p className="font-medium">
                      {format(parseISO(apt.appointment_date), "dd/MM/yyyy", { locale: ptBR })}{' '}
                      · {(apt.start_time || '').slice(0, 5)}
                    </p>
                    {apt.notes ? (
                      <p className="text-muted-foreground line-clamp-2 mt-0.5">{apt.notes}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <Button asChild size="sm" variant="outline" className="h-8 text-xs w-full">
              <Link to="/agenda">Abrir agenda</Link>
            </Button>
          </section>
        </div>
      </aside>

      <AtendimentoLinkPatientDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        patients={patients}
        phoneHint={conversation.patient_phone}
        linking={linking}
        onSelect={(patient) => {
          onLink(patient);
          setLinkOpen(false);
        }}
      />
    </>
  );
}
