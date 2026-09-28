import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  agendamentosPendentesNoMes,
  buildMonthRange,
  fetchBotoxGroups,
  countAgendamentosPendentesProgramaBotox,
  fetchPagamentos,
  fetchProgramasBotox,
  fetchSessoes,
  formatMonthLabel,
  formatMonthLabelCompact,
  inserirPagamento,
  inserirSessao,
  mesesAnterioresTodosPagos,
  monthKeyFromIso,
  programaBotoxAgendaNote,
  PROGRAMA_BOTOX_AGENDA_PREFIX,
  saldoSessoesRestantes,
  resumoFinanceiroPrograma,
  totalPagoNoMes,
  type PagamentoRow,
  type BotoxGroupRow,
  type ProgramaBotoxAgendaAppointmentRow,
  type ProgramaBotoxRow,
  sessoesListaNoMes,
  sessoesNoMes,
  type SessaoRow,
} from '@/lib/programaBotox';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { AgendaDaySlotsContent } from '@/components/AgendaDaySlotsContent';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/utils';
import { SignaturePad } from '@/components/SignaturePad';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, VisuallyHidden } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Calendar,
  CalendarRange,
  ChevronRight,
  CircleHelp,
  DollarSign,
  Info,
  Loader2,
  Pencil,
  Plus,
  Scissors,
  Stethoscope,
  Trash2,
  Users,
} from 'lucide-react';
import { ProgramaBotoxManagePatientsDialog } from '@/components/programa-botox/ProgramaBotoxManagePatientsDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usePatients } from '@/hooks/usePatients';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fetchProfessionalUiSettings } from '@/services/api/dynamicProcedureFieldSettingsApi';

type PayModalState =
  | { open: false }
  | { open: true; programa: ProgramaBotoxRow; mesKey: string };

type SessaoModalState =
  | { open: false }
  | { open: true; programa: ProgramaBotoxRow; mesKey: string };

type AddModalState =
  | { open: false }
  | { open: true };

type NewGroupModalState =
  | { open: false }
  | { open: true };

type BotoxContractTermRow = { id: string };

function formatBRL(value: number): string {
  try {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  } catch {
    return `R$ ${value.toFixed(2)}`;
  }
}

/** Ex.: R$ 0,00 / R$ 1.950,00 (pago / total do período). */
function formatPagoTotal(pago: number, totalEsperado: number): string {
  return `${formatBRL(pago)} / ${formatBRL(totalEsperado)}`;
}

/** Nome curto para cabeçalho da planilha (primeiro + último). */
function shortPatientName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return fullName.trim();
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function ValorFinanceiroInfoButton({
  pago,
  restante,
  totalEsperado,
  patientName,
}: {
  pago: number;
  restante: number;
  totalEsperado: number;
  patientName?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-6 w-6 shrink-0 xl:hidden"
          title="Ver detalhes do valor"
          aria-label="Ver detalhes do valor"
        >
          <Info className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 z-[1400]" align="center" side="top">
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-foreground leading-tight">
            {patientName ? `Valor — ${patientName}` : 'Resumo financeiro'}
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Pago</span>
              <span className="font-semibold tabular-nums">{formatBRL(pago)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Restante</span>
              <span className="font-semibold tabular-nums">{formatBRL(restante)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border pt-1.5">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold tabular-nums">{formatBRL(totalEsperado)}</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function textoConcluidaSessao(isoData: string): { dia: string; hora: string } {
  const d = new Date(isoData);
  return {
    dia: format(d, 'dd/MM/yyyy', { locale: ptBR }),
    hora: format(d, 'HH:mm', { locale: ptBR }),
  };
}

function localDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildContratoGrupoClubeBotoxText(params: {
  clinicName: string;
  profissionalCoren: string;
  patientName: string;
  patientCpf: string;
  patientAddress: string;
  patientCity: string;
  dueDay: number;
  totalSessoes: number;
}) {
  const today = new Date();
  const dataDia = format(today, 'dd/MM/yyyy', { locale: ptBR });
  const ano = String(today.getFullYear());
  return `CONTRATO DE GRUPO CLUBE DO BOTOX
IDENTIFICAÇÃO DAS PARTES CONTRATANTES
ADMINISTRADORA: ${params.clinicName}, com sede na Rua 15 de novembro nº 1626, bairro Centro, Cidade São Joaquim da Barra, Cep 14.600-00, no Estado São Paulo, inscrita no CPF 369.916.318-09, Enfermeira Esteta ${params.profissionalCoren}.

CONSORCIADO: ${params.patientName}, C.P.F. nº ${params.patientCpf}, residente e domiciliado no endereço ${params.patientAddress}, Cidade ${params.patientCity}.

As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Grupo do Clube do Botox, que se regerá pelas cláusulas seguintes e pelas condições descritas no presente.

DO OBJETO DO CONTRATO
Cláusula 1ª. O presente contrato tem como objeto um consórcio para aquisição do procedimento de toxina botulínica com a quantidade de 50 unidades que serão realizadas duas vezes no ano, que será financiado pela soma dos subsídios pagos mensalmente por cada CONSORCIADO, destinado à formação de um fundo comum, gerenciado pela empresa ADMINISTRADORA. Sendo que deste fundo comum sairão os recursos para a atribuição individual dos procedimentos consorciados, através de sorteios a serem definidos neste instrumento particular. Este instrumento particular se fará mediante assinatura deste contrato de adesão.

DOS DIREITOS E DAS OBRIGAÇÕES DA ADMINISTRADORA
Cláusula 2ª. Ao assinar o presente contrato, o CONSORCIADO faz da empresa ADMINISTRADORA sua representante para:
a) Constituir o grupo de consórcio definido na proposta de adesão ao contrato;
b) O CONSORCIADO deverá comparecer as consultas para realização do procedimento e caso não possa ir no dia, deverá avisar com antecedência.
c) Administrar e representar o grupo em qualquer situação inclusive judicialmente e em repartições públicas, assumindo qualquer dos polos passivos ou ativos;
d) Assinar todos documentos inerentes ao exercício da atividade de gerenciar este grupo de consórcio;

Cláusula 3ª. Não é permitido à empresa ADMINISTRADORA dar prêmios em compensação a prestação vencida e nem trocar o procedimento por dinheiro.
Cláusula 4ª. Cabe à empresa ADMINISTRADORA a responsabilidade de representar e defender os direitos e interesses das partes envolvidas no presente contrato, além de nomear mandatários para ajudá-la na consecução de suas atividades.

DOS DIREITOS E DAS OBRIGAÇÕES DO CONSORCIADO
Cláusula 5ª. Terá o CONSORCIADO o direito de repassar o presente contrato a terceiros desde que esteja com todas as mensalidades já vencidas devidamente quitadas.
Parágrafo único. Esta transferência se fará através de anotação no verso deste instrumento e mediante consentimento expresso da empresa ADMINISTRADORA.

Cláusula 6ª. Em caso de desistência ou afastamento de um dos Consorciados, aquele que entrar na vaga será responsável pelo:
a) Pagamento das mensalidades futuras e ainda não vencidas da mesma forma que os outros integrantes;
b) Pagamento das mensalidades atrasadas e as já quitadas, no valor referente ao dia do pagamento, que poderá ser feito em parcelas ou à vista;

Cláusula 7ª. O CONSORCIADO desistente deste grupo não terá direito a devolução do valor e nem da realização da próxima sessão de Botox.

DO PAGAMENTO
Cláusula 8ª. O pagamento das mensalidades terá vencimento no dia ${params.dueDay} de cada mês, com valor de R$ 150,00 durante 12 meses com totalidade de R$ 1.800.
Parágrafo único. Caso o vencimento seja em dia em que não possua o CONSORCIADO condições de efetivar o pagamento fica prorrogado o prazo até o primeiro dia útil após a real data de vencimento.

Cláusula 9ª. Para fins de garantia de formação deste grupo de consórcio, a empresa ADMINISTRADORA poderá cobrar, no momento da assinatura e, consequentemente, a adesão a este grupo de consórcio. Caso o grupo não se forme, será devolvida ao CONSORCIADO a taxa paga sem quaisquer juros ou correções, se o grupo for constituído será o valor inicialmente pago debitado na taxa de administração.

DAS CONDIÇÕES
Cláusula 10ª. Caso ocorram situações de ordem legal não tratadas pelo presente instrumento, e havendo a necessidade de alguma mudança em cláusulas contratuais, tais alterações somente terão validade após apreciação e aprovação pelo Ministério Público. Sendo, porém, questões administrativas, serão resolvidas pela empresa ADMINISTRADORA vinculada a apreciação posterior, ou seja, submetida a aprovação da assembleia geral.

Cláusula 11ª. O grupo de consórcio não será dissolvido se houver perda de um participante, seja por desistência voluntária ou por afastamento, neste caso poderá a empresa ADMINISTRADORA substituí-lo por um novo Consorciado, não comprometendo a duração deste contrato.

DO PRAZO
Cláusula 12ª. O presente contrato terá o período de duração de 12 meses.
Parágrafo primeiro. Ocorrendo um desfalque superior à metade de integrantes deste grupo de consórcio, devido à saída voluntária ou casos previamente justificados de afastamento, e não acontecendo a adesão de outros novos Consorciados em lugar, se fará a liquidação deste contrato.

DA MULTA
Cláusula 13ª. Decorrido o prazo de 5 dias após o vencimento e o CONSORCIADO não efetuar o pagamento, incorrerá em mora e ficará em débito com multa de 10% sobre o valor da mensalidade. Ocorrerá vencimento antecipado das demais mensalidades caso o pagamento de qualquer mensalidade atrase mais de 30 (trinta) dias.

Por estarem assim justos e contratados, firmam o presente instrumento, em duas vias de igual teor.

Data ${dataDia} e ano ${ano}.

Quantidade de sessões contratada no programa: ${params.totalSessoes}.

Assinatura do profissional: ______________________________________
Nome e assinatura do paciente: ______________________________________`;
}

export function ProgramaBotoxTabela() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const professionalId = profile?.id ?? null;
  const { patients, futureClientPatientIds, isPageLoading: patientsLoading } = usePatients(professionalId ?? undefined);

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<BotoxGroupRow[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [programas, setProgramas] = useState<ProgramaBotoxRow[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoRow[]>([]);
  const [sessoes, setSessoes] = useState<SessaoRow[]>([]);
  const [pbAgendaAppts, setPbAgendaAppts] = useState<ProgramaBotoxAgendaAppointmentRow[]>([]);

  const [payModal, setPayModal] = useState<PayModalState>({ open: false });
  const [payValor, setPayValor] = useState<string>('');
  const [savingPay, setSavingPay] = useState(false);
  const [savingSessao, setSavingSessao] = useState<string | null>(null);

  const [sessaoModal, setSessaoModal] = useState<SessaoModalState>({ open: false });
  const [sessaoDate, setSessaoDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [savingSessaoModal, setSavingSessaoModal] = useState(false);

  const [agendarOpen, setAgendarOpen] = useState(false);
  const [agendarPrograma, setAgendarPrograma] = useState<ProgramaBotoxRow | null>(null);
  const [agendarDateStr, setAgendarDateStr] = useState<string>(() => localDateYmd(new Date()));
  const [agendarDayAppts, setAgendarDayAppts] = useState<Array<{ appointment_date: string; start_time: string }>>([]);
  const [loadingAgendarDay, setLoadingAgendarDay] = useState(false);
  const [confirmAgendarSlot, setConfirmAgendarSlot] = useState<string | null>(null);
  const [savingAgendarAppt, setSavingAgendarAppt] = useState(false);

  const [addModal, setAddModal] = useState<AddModalState>({ open: false });
  const [managePatientsOpen, setManagePatientsOpen] = useState(false);
  const [newGroupModal, setNewGroupModal] = useState<NewGroupModalState>({ open: false });
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupStart, setNewGroupStart] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [newGroupEnd, setNewGroupEnd] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [savingNewGroup, setSavingNewGroup] = useState(false);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<{
    id: string;
    title: string;
    totalPacientes: number;
  } | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [addSearch, setAddSearch] = useState('');
  const [addSelectedPatientId, setAddSelectedPatientId] = useState<string | null>(null);
  const [addDiaVencimento, setAddDiaVencimento] = useState<number | ''>(10); // dia preferido para pagamento (1-31)
  const [addTotalSessoes, setAddTotalSessoes] = useState<2 | 3>(2);
  const [savingAdd, setSavingAdd] = useState(false);
  const [loadingAddSuggestion, setLoadingAddSuggestion] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [contractPatientSignature, setContractPatientSignature] = useState<string | null>(null);

  const [tableFilter, setTableFilter] = useState('');
  const [mobileOpenIds, setMobileOpenIds] = useState<Record<string, boolean>>({});
  const [planilhaMode, setPlanilhaMode] = useState(false);
  const planilhaBodyScrollRef = useRef<HTMLDivElement>(null);
  const planilhaFooterScrollRef = useRef<HTMLDivElement>(null);
  const planilhaScrollSyncLock = useRef(false);

  const syncPlanilhaFooterScroll = useCallback(() => {
    if (planilhaScrollSyncLock.current) return;
    const body = planilhaBodyScrollRef.current;
    const footer = planilhaFooterScrollRef.current;
    if (!body || !footer) return;
    planilhaScrollSyncLock.current = true;
    footer.scrollLeft = body.scrollLeft;
    requestAnimationFrame(() => {
      planilhaScrollSyncLock.current = false;
    });
  }, []);

  const syncPlanilhaBodyScroll = useCallback(() => {
    if (planilhaScrollSyncLock.current) return;
    const body = planilhaBodyScrollRef.current;
    const footer = planilhaFooterScrollRef.current;
    if (!body || !footer) return;
    planilhaScrollSyncLock.current = true;
    body.scrollLeft = footer.scrollLeft;
    requestAnimationFrame(() => {
      planilhaScrollSyncLock.current = false;
    });
  }, []);

  const diasVencimentoOptions = [1, 5, 10, 15, 20, 25, 30];

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!professionalId) return;
    if (!opts?.silent) setLoading(true);
    try {
      const [groupRows, progs] = await Promise.all([
        fetchBotoxGroups(professionalId),
        fetchProgramasBotox(professionalId),
      ]);
      const ids = progs.map((p) => p.id);
      const [pags, sess, apRes] = await Promise.all([
        fetchPagamentos(ids),
        fetchSessoes(ids),
        supabase
          .from('appointments')
          .select('id, patient_id, appointment_date, start_time, notes')
          .eq('professional_id', professionalId)
          .like('notes', `${PROGRAMA_BOTOX_AGENDA_PREFIX}%`),
      ]);
      setGroups(groupRows);
      setSelectedGroupId((prev) => {
        if (!prev) return '';
        if (groupRows.some((g) => g.id === prev)) return prev;
        return '';
      });
      setProgramas(progs);
      setPagamentos(pags);
      setSessoes(sess);
      if (!apRes.error) {
        setPbAgendaAppts((apRes.data ?? []) as ProgramaBotoxAgendaAppointmentRow[]);
      }
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? 'Erro ao carregar Programa de Botox.';
      toast.error(msg);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [professionalId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime (opcional): ao inserir/alterar pagamentos/sessoes/programas, refaz fetch.
  useEffect(() => {
    if (!professionalId) return;
    const channel = supabase
      .channel(`programa-botox-${professionalId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'botox_groups' }, () => refresh({ silent: true }))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'programas_botox' }, () => refresh({ silent: true }))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos' }, () => refresh({ silent: true }))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sessoes' }, () => refresh({ silent: true }))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => refresh({ silent: true }))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [professionalId, refresh]);

  useEffect(() => {
    if (!professionalId) return;
    let cancelled = false;
    void (async () => {
      try {
        const ui = await fetchProfessionalUiSettings({ professionalId });
        if (!cancelled) setPlanilhaMode(ui.programa_botox_view_mode === 'planilha');
      } catch {
        if (!cancelled) setPlanilhaMode(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [professionalId]);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );
  const monthKeys = useMemo(() => {
    if (selectedGroup) {
      const startKey = selectedGroup.period_start.slice(0, 7);
      const endKey = selectedGroup.period_end.slice(0, 7);
      return buildMonthRange(startKey, endKey);
    }
    const currentYear = new Date().getFullYear();
    return buildMonthRange(`${currentYear}-01`, `${currentYear}-12`);
  }, [selectedGroup]);
  const currentMesKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const agendarMonthBounds = useMemo(() => {
    const [y, m] = currentMesKey.split('-').map(Number);
    const pad = (n: number) => String(n).padStart(2, '0');
    const min = `${y}-${pad(m)}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const max = `${y}-${pad(m)}-${pad(lastDay)}`;
    return { min, max };
  }, [currentMesKey]);

  const filteredProgramas = useMemo(() => {
    const q = tableFilter.trim().toLowerCase();
    const source = programas.filter(
      (p) => p.status === 'ativo' && (!selectedGroupId || p.group_id === selectedGroupId)
    );
    if (!q) return source;
    return source.filter((p) => (p.patients?.full_name ?? '').toLowerCase().includes(q));
  }, [programas, tableFilter, selectedGroupId]);

  const groupCards = useMemo(() => {
    return groups.map((g) => {
      const programasGroup = programas.filter((p) => p.group_id === g.id && p.status === 'ativo');
      const totalPacientes = programasGroup.length;
      const title =
        g.name?.trim() ||
        `${format(parseLocalDate(g.period_start), 'dd/MM/yyyy', { locale: ptBR })} - ${format(parseLocalDate(g.period_end), 'dd/MM/yyyy', { locale: ptBR })}`;
      const subtitle = `${format(parseLocalDate(g.period_start), 'dd/MM/yyyy', { locale: ptBR })} até ${format(parseLocalDate(g.period_end), 'dd/MM/yyyy', { locale: ptBR })}`;
      return { group: g, title, subtitle, totalPacientes };
    });
  }, [groups, programas]);

  const toggleMobileOpen = useCallback((id: string) => {
    setMobileOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  useEffect(() => {
    if (!agendarOpen || !professionalId || !agendarDateStr) return;
    let cancelled = false;
    setLoadingAgendarDay(true);
    void (async () => {
      try {
        const { data } = await supabase
          .from('appointments')
          .select('appointment_date, start_time')
          .eq('professional_id', professionalId)
          .eq('appointment_date', agendarDateStr);
        if (!cancelled) {
          setAgendarDayAppts((data as Array<{ appointment_date: string; start_time: string }>) ?? []);
        }
      } finally {
        if (!cancelled) setLoadingAgendarDay(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agendarOpen, agendarDateStr, professionalId]);

  const openAgendarProcedimento = useCallback((p: ProgramaBotoxRow) => {
    setAgendarPrograma(p);
    setAgendarDateStr(localDateYmd(new Date()));
    setConfirmAgendarSlot(null);
    setAgendarOpen(true);
  }, []);

  const handleConfirmAgendarAppointment = useCallback(async () => {
    if (!professionalId || !agendarPrograma || !confirmAgendarSlot || !agendarDateStr) return;
    const timeStr =
      confirmAgendarSlot.length === 5 ? `${confirmAgendarSlot}:00` : `${confirmAgendarSlot.slice(0, 5)}:00`;
    setSavingAgendarAppt(true);
    const note = programaBotoxAgendaNote(agendarPrograma.id);
    const { data: insertedAppt, error } = await supabase
      .from('appointments')
      .insert({
        professional_id: professionalId,
        patient_id: agendarPrograma.paciente_id,
        appointment_date: agendarDateStr,
        start_time: timeStr,
        notes: note,
      })
      .select('id, patient_id, appointment_date, start_time, notes')
      .single();
    setSavingAgendarAppt(false);
    if (error) {
      const code = (error as { code?: string }).code;
      if (code === '23505') toast.error('Este horário já está ocupado.');
      else toast.error('Erro ao agendar.');
      return;
    }
    if (insertedAppt) {
      setPbAgendaAppts((prev) => [...prev, insertedAppt as ProgramaBotoxAgendaAppointmentRow]);
    }
    await supabase
      .from('botox_reapplication_reminders')
      .update({ notified_at: new Date().toISOString() })
      .eq('patient_id', agendarPrograma.paciente_id)
      .eq('professional_id', professionalId)
      .is('notified_at', null);
    await queryClient.invalidateQueries({ queryKey: queryKeys.notifications(professionalId) });
    toast.success('Consulta agendada na agenda.');
    setAgendarOpen(false);
    setAgendarPrograma(null);
    setConfirmAgendarSlot(null);
  }, [professionalId, agendarPrograma, confirmAgendarSlot, agendarDateStr, queryClient]);

  const openPayModal = useCallback((programa: ProgramaBotoxRow, mesKey: string) => {
    setPayValor('');
    setPayModal({ open: true, programa, mesKey });
  }, []);

  const openSessaoModal = useCallback((programa: ProgramaBotoxRow, mesKey: string) => {
    setSessaoDate(new Date().toISOString().slice(0, 10));
    setSessaoModal({ open: true, programa, mesKey });
  }, []);

  const submitPagamento = useCallback(async () => {
    if (!payModal.open) return;
    const valor = Number(String(payValor).replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }
    setSavingPay(true);
    try {
      const row = await inserirPagamento({ programaId: payModal.programa.id, valor, mesReferencia: payModal.mesKey });
      setPagamentos((prev) => {
        const next = [...prev, row];
        next.sort((a, b) => new Date(a.data_pagamento).getTime() - new Date(b.data_pagamento).getTime());
        return next;
      });
      toast.success('Pagamento registrado no mês.');
      setPayModal({ open: false });
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? 'Erro ao registrar pagamento.';
      toast.error(msg);
    } finally {
      setSavingPay(false);
    }
  }, [payModal, payValor, refresh]);

  const realizarSessao = useCallback(
    async (programa: ProgramaBotoxRow, mesKey: string, dateISO?: string) => {
      if (programa.sessoes_realizadas >= programa.total_sessoes) {
        toast.error(`Limite de sessões atingido (${programa.total_sessoes}/${programa.total_sessoes}).`);
        return;
      }
      setSavingSessao(programa.id);
      try {
        const data = dateISO ? new Date(`${dateISO}T12:00:00`) : undefined;
        const row = await inserirSessao({ programaId: programa.id, mesReferencia: mesKey, data });
        setSessoes((prev) => {
          const next = [...prev, row];
          next.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
          return next;
        });
        // Atualiza localmente para a linha "Direito de sessão" subtrair na hora.
        setProgramas((prev) =>
          prev.map((p) =>
            p.id === programa.id
              ? { ...p, sessoes_realizadas: Math.min(Number(p.total_sessoes ?? 0), Number(p.sessoes_realizadas ?? 0) + 1) }
              : p
          )
        );
        toast.success('Procedimento registrado no mês.');
      } catch (e: unknown) {
        const msg = (e as { message?: string })?.message ?? 'Erro ao registrar sessão.';
        toast.error(msg);
      } finally {
        setSavingSessao(null);
      }
    },
    [refresh]
  );

  const submitSessao = useCallback(async () => {
    if (!sessaoModal.open) return;
    if (!sessaoDate) {
      toast.error('Informe uma data válida.');
      return;
    }
    setSavingSessaoModal(true);
    try {
      await realizarSessao(sessaoModal.programa, sessaoModal.mesKey, sessaoDate);
      setSessaoModal({ open: false });
    } finally {
      setSavingSessaoModal(false);
    }
  }, [sessaoModal, sessaoDate, realizarSessao]);

  const activePatientIds = useMemo(() => {
    return new Set(
      programas
        .filter((p) => p.status === 'ativo' && (!selectedGroupId || p.group_id === selectedGroupId))
        .map((p) => p.paciente_id)
    );
  }, [programas, selectedGroupId]);

  const eligiblePatients = useMemo(() => {
    const q = addSearch.trim().toLowerCase();
    return (patients ?? [])
      .filter((p: { id: string; full_name: string }) => !activePatientIds.has(p.id))
      // Excluir "apenas avaliação" (leads / pré-cadastro): registration_completed_at null + possui procedimento de avaliação
      .filter((p: { id: string; registration_completed_at?: string | null }) => {
        const isFutureClient = p.registration_completed_at == null && (futureClientPatientIds ?? []).includes(p.id);
        return !isFutureClient;
      })
      .filter((p: { full_name: string }) => (q ? p.full_name.toLowerCase().includes(q) : true))
      .slice(0, 50);
  }, [patients, activePatientIds, addSearch, futureClientPatientIds]);

  const selectedAddPatient = useMemo(() => {
    if (!addSelectedPatientId) return null;
    return (
      (patients ?? []).find((p: { id: string }) => p.id === addSelectedPatientId) as
        | {
            id: string;
            full_name: string;
            phone?: string | null;
            cpf?: string | null;
            address?: string | null;
            city?: string | null;
          }
        | undefined
    ) ?? null;
  }, [patients, addSelectedPatientId]);

  const contractText = useMemo(() => {
    if (!selectedAddPatient) return '';
    const professionalCoren = [profile?.professional_registry_body, profile?.professional_registry_number]
      .filter(Boolean)
      .join(' ');
    return buildContratoGrupoClubeBotoxText({
      clinicName: profile?.full_name?.trim() || 'Clínica',
      profissionalCoren: professionalCoren || 'COREN não informado',
      patientName: selectedAddPatient.full_name || 'Paciente',
      patientCpf: selectedAddPatient.cpf || 'não informado',
      patientAddress: selectedAddPatient.address || 'não informado',
      patientCity: selectedAddPatient.city || 'não informada',
      dueDay: Number(addDiaVencimento || 10),
      totalSessoes: addTotalSessoes,
    });
  }, [selectedAddPatient, addDiaVencimento, addTotalSessoes, profile?.full_name, profile?.professional_registry_body, profile?.professional_registry_number]);

  const openNewGroupModal = useCallback(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    setNewGroupName('');
    setNewGroupStart(start.toISOString().slice(0, 10));
    setNewGroupEnd(end.toISOString().slice(0, 10));
    setNewGroupModal({ open: true });
  }, []);

  const submitNewGroup = useCallback(async () => {
    if (!professionalId) return;
    if (!newGroupStart || !newGroupEnd) {
      toast.error('Informe data inicial e final do grupo.');
      return;
    }
    if (newGroupStart > newGroupEnd) {
      toast.error('A data final deve ser maior ou igual à inicial.');
      return;
    }
    setSavingNewGroup(true);
    try {
      const payload = {
        professional_id: professionalId,
        name: newGroupName.trim() || null,
        period_start: newGroupStart,
        period_end: newGroupEnd,
      };
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from('botox_groups')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      if (data?.id) setSelectedGroupId(data.id);
      toast.success('Grupo criado com sucesso.');
      setNewGroupModal({ open: false });
      await refresh();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? 'Erro ao criar grupo.';
      toast.error(msg);
    } finally {
      setSavingNewGroup(false);
    }
  }, [professionalId, newGroupName, newGroupStart, newGroupEnd, refresh]);

  const requestDeleteGroup = useCallback((group: BotoxGroupRow, title: string, totalPacientes: number) => {
    setDeleteGroupTarget({ id: group.id, title, totalPacientes });
  }, []);

  const confirmDeleteGroup = useCallback(async () => {
    if (!professionalId || !deleteGroupTarget) return;
    setDeletingGroupId(deleteGroupTarget.id);
    try {
      const { error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message?: string } | null }> }).rpc(
        'delete_botox_group_by_id',
        { p_group_id: deleteGroupTarget.id }
      );
      if (error) throw error;

      if (selectedGroupId === deleteGroupTarget.id) setSelectedGroupId('');
      toast.success(
        deleteGroupTarget.totalPacientes > 0
          ? 'Grupo e pacientes vinculados foram apagados.'
          : 'Grupo apagado.'
      );
      setDeleteGroupTarget(null);
      await refresh();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? 'Erro ao apagar grupo.';
      toast.error(msg);
    } finally {
      setDeletingGroupId(null);
    }
  }, [professionalId, deleteGroupTarget, selectedGroupId, refresh]);

  useEffect(() => {
    if (!addModal.open || !professionalId || !addSelectedPatientId) return;
    let cancelled = false;
    setLoadingAddSuggestion(true);
    void (async () => {
      const { data } = await (supabase as unknown as { from: (t: string) => any })
        .from('programas_botox')
        .select('dia_vencimento, total_sessoes')
        .eq('professional_id', professionalId)
        .eq('paciente_id', addSelectedPatientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      const row = (data ?? null) as { dia_vencimento?: number | null; total_sessoes?: number | null } | null;
      if (row?.dia_vencimento && row.dia_vencimento >= 1 && row.dia_vencimento <= 31) {
        setAddDiaVencimento(row.dia_vencimento);
      }
      if (row?.total_sessoes === 2 || row?.total_sessoes === 3) {
        setAddTotalSessoes(row.total_sessoes);
      }
      setLoadingAddSuggestion(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [addModal.open, professionalId, addSelectedPatientId]);

  const submitAdd = useCallback(async () => {
    if (!professionalId) return;
    if (!selectedGroupId) {
      toast.error('Selecione um grupo.');
      return;
    }
    if (!addSelectedPatientId) {
      toast.error('Selecione um paciente.');
      return;
    }
    if (!contractPatientSignature) {
      setContractOpen(true);
      return;
    }
    setSavingAdd(true);
    try {
      const diaVen = addDiaVencimento === '' ? null : Number(addDiaVencimento);
      const payload = {
        professional_id: professionalId,
        paciente_id: addSelectedPatientId,
        group_id: selectedGroupId,
        data_inicio: selectedGroup?.period_start ?? new Date().toISOString().slice(0, 10),
        status: 'ativo',
        total_sessoes: addTotalSessoes,
        valor_mensalidade: 150,
        ...(diaVen != null && diaVen >= 1 && diaVen <= 31 ? { dia_vencimento: diaVen } : {}),
      };
      // Tipagem do Supabase client pode não incluir esta tabela no schema gerado.
      const { error } = await (supabase as unknown as { from: (t: string) => any })
        .from('programas_botox')
        .insert(payload);
      if (error) {
        const msg = error.message?.includes('programas_botox_unique_active_per_patient')
          ? 'Este paciente já possui um programa ativo neste grupo.'
          : (error.message || 'Erro ao adicionar paciente ao programa.');
        throw new Error(msg);
      }
      const { data: term } = await supabase
        .from('terms')
        .select('id')
        .eq('slug', 'contrato-grupo-clube-botox')
        .eq('active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      const termRow = (term ?? null) as BotoxContractTermRow | null;
      if (termRow?.id) {
        const { error: signError } = await supabase.from('term_signatures').insert({
          patient_id: addSelectedPatientId,
          term_id: termRow.id,
          signature_data: contractPatientSignature,
          professional_signature_data: profile?.default_signature_data ?? null,
        });
        if (signError) throw signError;
      } else {
        throw new Error('Termo de contrato não encontrado. Rode as migrations para "contrato-grupo-clube-botox".');
      }
      toast.success('Paciente adicionado ao programa.');
      setAddModal({ open: false });
      setContractOpen(false);
      setContractPatientSignature(null);
      await refresh();
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? 'Erro ao adicionar paciente ao programa.';
      toast.error(msg);
    } finally {
      setSavingAdd(false);
    }
  }, [professionalId, selectedGroupId, selectedGroup?.period_start, addSelectedPatientId, refresh, addDiaVencimento, addTotalSessoes, contractPatientSignature, profile?.default_signature_data]);

  if (!professionalId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Programa de Botox</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Faça login para acessar.</p>
        </CardContent>
      </Card>
    );
  }

  // Inclui iPad (até xl): trava altura da página e evita scroll externo
  const planilhaFillViewport = planilhaMode && !!selectedGroup;

  return (
    <div
      className={cn(
        'min-w-0',
        planilhaFillViewport
          ? 'flex flex-col max-xl:h-[calc(100dvh-var(--app-header-height)-env(safe-area-inset-top)-var(--mobile-bottom-nav-height)-var(--mobile-bottom-safe-gap)-env(safe-area-inset-bottom)-1.5rem)] max-xl:overflow-hidden xl:h-auto xl:space-y-4'
          : 'space-y-4'
      )}
    >
      <Card
        className={cn(
          'min-w-0',
          // overflow-hidden no card corta a borda da planilha no mobile/iPad
          planilhaFillViewport ? 'max-xl:flex max-xl:flex-col max-xl:flex-1 max-xl:min-h-0 max-xl:overflow-hidden' : 'overflow-hidden'
        )}
      >
        <CardHeader className="pb-2 space-y-3 lg:space-y-0 shrink-0">
          <div className="flex flex-col gap-3 min-w-0 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              {selectedGroup ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 mt-0.5"
                  onClick={() => setSelectedGroupId('')}
                  title="Voltar aos grupos"
                  aria-label="Voltar aos grupos"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              ) : null}
              <div className="min-w-0">
                <CardTitle className="text-base lg:text-xl break-words pr-1">Programa de Botox</CardTitle>
                <p className="text-xs lg:text-sm text-muted-foreground mt-1 break-words">
                  Controle por grupos de período, mensalidades e liberação de sessões.
                </p>
              </div>
            </div>
            <div
              className={cn(
                'flex min-w-0 w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:max-w-full lg:shrink-0'
              )}
            >
              {selectedGroup ? (
                <>
                  <Input
                    value={tableFilter}
                    onChange={(e) => setTableFilter(e.target.value)}
                    placeholder="Buscar paciente…"
                    className="h-10 min-w-0 w-full flex-1 basis-0 sm:min-w-[12rem] lg:flex-initial lg:w-[min(100%,240px)] xl:w-[280px]"
                    aria-label="Buscar paciente"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                    title="Apagar grupo"
                    aria-label="Apagar grupo"
                    disabled={deletingGroupId === selectedGroup.id}
                    onClick={() =>
                      requestDeleteGroup(
                        selectedGroup,
                        selectedGroup.name?.trim() ||
                          `${format(parseLocalDate(selectedGroup.period_start), 'dd/MM/yyyy', { locale: ptBR })} até ${format(parseLocalDate(selectedGroup.period_end), 'dd/MM/yyyy', { locale: ptBR })}`,
                        programas.filter((p) => p.group_id === selectedGroup.id && p.status === 'ativo').length
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (!selectedGroupId) {
                        toast.error('Selecione um grupo para editar os pacientes.');
                        return;
                      }
                      setManagePatientsOpen(true);
                    }}
                    disabled={patientsLoading}
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    title="Editar pacientes do programa"
                    aria-label="Editar pacientes do programa"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      if (!selectedGroupId) {
                        toast.error('Crie ou selecione um grupo antes de adicionar pacientes.');
                        return;
                      }
                      setAddSearch('');
                      setAddSelectedPatientId(null);
                      setAddDiaVencimento(10);
                      setAddTotalSessoes(2);
                      setContractPatientSignature(null);
                      setContractOpen(false);
                      setAddModal({ open: true });
                    }}
                    disabled={patientsLoading}
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    title="Adicionar paciente"
                    aria-label="Adicionar paciente"
                  >
                    <Plus className="h-5 w-5" strokeWidth={2.5} />
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={openNewGroupModal}
                  className="h-10 w-full lg:w-auto shrink-0"
                  title="Criar novo grupo"
                >
                  <CalendarRange className="h-4 w-4 mr-2 shrink-0" />
                  Novo Grupo
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent
          className={cn(
            planilhaFillViewport && 'max-xl:flex max-xl:flex-col max-xl:flex-1 max-xl:min-h-0 max-xl:overflow-hidden'
          )}
        >
          {loading ? (
            <p className="text-sm text-muted-foreground py-6">Carregando…</p>
          ) : groups.length === 0 ? (
            <div className="py-6 space-y-3 max-w-full">
              <p className="text-sm text-muted-foreground break-words">Nenhum grupo criado ainda.</p>
              <Button type="button" variant="outline" onClick={openNewGroupModal} className="w-full lg:w-auto">
                <CalendarRange className="h-4 w-4 mr-2 shrink-0" />
                Criar primeiro grupo
              </Button>
            </div>
          ) : !selectedGroup ? (
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groupCards.map(({ group, title, subtitle, totalPacientes }) => (
                <Card
                  key={group.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Abrir grupo: ${title}`}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border-border/60 bg-card text-left',
                    'shadow-sm transition-all duration-200',
                    'cursor-pointer',
                    'hover:border-primary/30 hover:shadow-md hover:bg-accent/25',
                    'active:scale-[0.99] active:shadow-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                  )}
                  onClick={() => setSelectedGroupId(group.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedGroupId(group.id);
                    }
                  }}
                >
                  <div
                    className="h-1.5 w-full bg-gradient-to-r from-primary/80 via-primary/50 to-primary/25"
                    aria-hidden
                  />
                  <CardHeader className="space-y-3 pb-0 pt-4 min-w-0 sm:pt-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/90">
                          Grupo
                        </p>
                        <CardTitle className="mt-1 text-lg font-semibold leading-snug tracking-tight break-words sm:text-xl">
                          {title}
                        </CardTitle>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Apagar grupo"
                          aria-label={`Apagar grupo ${title}`}
                          disabled={deletingGroupId === group.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            requestDeleteGroup(group, title, totalPacientes);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-muted/40 text-muted-foreground transition-colors group-hover:border-primary/25 group-hover:bg-primary/10 group-hover:text-primary">
                          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-2 rounded-xl bg-muted/70 px-3 py-2 text-xs text-muted-foreground ring-1 ring-border/40">
                        <CalendarRange className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden />
                        <span className="break-words leading-snug">{subtitle}</span>
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4 pt-4">
                    <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-gradient-to-br from-muted/40 to-muted/20 px-4 py-3 shadow-inner">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-sm ring-1 ring-primary/10"
                        aria-hidden
                      >
                        <Users className="h-6 w-6" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xl font-bold tabular-nums leading-none tracking-tight text-foreground">
                          {totalPacientes}
                        </p>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {totalPacientes === 1 ? 'paciente no grupo' : 'pacientes no grupo'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : programas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">Nenhum paciente no grupo ainda.</p>
          ) : filteredProgramas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">Nenhum paciente encontrado para o filtro.</p>
          ) : (
            <div
              className={cn(
                'space-y-3 min-w-0',
                planilhaFillViewport &&
                  'max-xl:flex max-xl:flex-col max-xl:flex-1 max-xl:min-h-0 max-xl:overflow-hidden max-xl:space-y-2'
              )}
            >
              <div className="flex items-center justify-end shrink-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      title="Como usar"
                      aria-label="Como usar a planilha do Programa de Botox"
                    >
                      <CircleHelp className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-4 z-[1400]" align="end" side="bottom">
                    <p className="text-sm font-semibold text-foreground mb-2">Como usar</p>
                    <div className="text-xs text-muted-foreground leading-relaxed space-y-2">
                      <p>
                        Ações: <b className="text-foreground">Pagar</b>. Com todos os meses anteriores pagos, no mês
                        atual aparece <b className="text-foreground">Agendar</b> (abre a agenda); caso contrário,{' '}
                        <b className="text-foreground">Fazer</b> marca a sessão no mês.
                      </p>
                      <p>
                        Cobranças automáticas ficam em <b className="text-foreground">Configurações → WhatsApp</b>.
                      </p>
                      <p>
                        Agendamentos pendentes aparecem em violeta, mostram data/hora e reduzem o saldo em{' '}
                        <b className="text-foreground">Direito de sessão</b> até você registrar a sessão naquele mês.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Mobile/tablet: cards (modo padrão). Planilha usa a tabela compacta abaixo. */}
              {!planilhaMode && <div className="lg:hidden space-y-3 min-w-0">
                {filteredProgramas.map((p) => {
                  const nome = p.patients?.full_name ?? 'Paciente';
                  const total = Number(p.total_sessoes ?? 0);
                  const realizadas = Number(p.sessoes_realizadas ?? 0);
                  const pendentesAgendaPb = countAgendamentosPendentesProgramaBotox(pbAgendaAppts, sessoes, p.id);
                  const restantes = saldoSessoesRestantes(total, realizadas, pendentesAgendaPb);
                  const { pago, restante: restanteValor, totalEsperado } = resumoFinanceiroPrograma({
                    pagamentos,
                    programaId: p.id,
                    monthCount: monthKeys.length,
                    valorMensalidade: p.valor_mensalidade,
                  });
                  const open = !!mobileOpenIds[p.id];

                  // Resumo do ano corrente
                  const pendentes = monthKeys.filter((mesKey) => totalPagoNoMes(pagamentos, p.id, mesKey) === 0).length;
                  const pagosAno = monthKeys.length - pendentes;

                  return (
                    <Card key={p.id} className="overflow-hidden">
                      <CardHeader className="py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <CardTitle className="text-base min-w-0 break-words pr-1" title={nome}>
                              {nome}
                            </CardTitle>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span
                                className="font-medium text-foreground"
                                title={`Pago ${formatBRL(pago)} · Restante ${formatBRL(restanteValor)} · Total ${formatBRL(totalEsperado)}`}
                              >
                                {formatPagoTotal(pago, totalEsperado)}
                              </span>
                              <ValorFinanceiroInfoButton
                                pago={pago}
                                restante={restanteValor}
                                totalEsperado={totalEsperado}
                                patientName={nome}
                              />
                              <span>•</span>
                              <span>
                                Sessões: <span className="font-medium text-foreground">{restantes}/{total}</span>
                              </span>
                              <span>•</span>
                              <span>
                                Pagos: <span className="font-medium text-foreground">{pagosAno}</span> / {monthKeys.length}
                              </span>
                            </div>
                          </div>

                          <Collapsible open={open} onOpenChange={() => toggleMobileOpen(p.id)}>
                            <CollapsibleTrigger asChild>
                              <Button type="button" variant="outline" size="sm" className="shrink-0">
                                {open ? 'Fechar' : 'Ver meses'}
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent />
                          </Collapsible>
                        </div>
                      </CardHeader>

                      <Collapsible open={open} onOpenChange={() => toggleMobileOpen(p.id)}>
                        <CollapsibleContent>
                          <CardContent className="pt-0 pb-3 space-y-2">
                            {monthKeys.map((mesKey) => {
                              const valorMes = totalPagoNoMes(pagamentos, p.id, mesKey);
                              const sessoesMes = sessoesNoMes(sessoes, p.id, mesKey);
                              const procedimentoFeito = sessoesMes > 0;
                              const pendentesAgendaPb = countAgendamentosPendentesProgramaBotox(pbAgendaAppts, sessoes, p.id);
                              const podeRealizar = p.sessoes_realizadas + pendentesAgendaPb < p.total_sessoes;
                              const agPendMes = agendamentosPendentesNoMes(pbAgendaAppts, sessoes, p.id, mesKey);
                              const pago = valorMes > 0;
                              const isMesVigente = mesKey === currentMesKey;
                              const usarAgendar = mesesAnterioresTodosPagos(
                                monthKeys,
                                mesKey,
                                pagamentos,
                                p.id,
                                monthKeyFromIso(p.data_inicio)
                              );

                              return (
                                <div
                                  key={`${p.id}-${mesKey}`}
                                  className={cn(
                                    'rounded-xl border p-3',
                                    pago
                                      ? 'border-emerald-400/70 bg-emerald-100/90 dark:border-emerald-600 dark:bg-emerald-950/45'
                                      : 'border-border',
                                    procedimentoFeito && 'ring-1 ring-blue-300 ring-inset',
                                    agPendMes.length > 0 && !procedimentoFeito && 'ring-1 ring-violet-300 ring-inset'
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <div
                                        className={cn(
                                          'text-sm font-semibold',
                                          pago && 'text-emerald-800 dark:text-emerald-300'
                                        )}
                                      >
                                        {formatMonthLabel(mesKey)}
                                      </div>
                                      <div className="mt-0.5 text-xs text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-0.5">
                                        {pago ? (
                                          <span className="text-emerald-800 dark:text-emerald-300 font-medium">
                                            Pago: {formatBRL(valorMes)}
                                          </span>
                                        ) : (
                                          <span className="text-amber-800 font-medium">Pendente</span>
                                        )}
                                        {procedimentoFeito &&
                                          sessoesListaNoMes(sessoes, p.id, mesKey).map((s) => {
                                            const { dia, hora } = textoConcluidaSessao(s.data);
                                            return (
                                              <span key={s.id} className="text-blue-700 font-medium">
                                                • Concluída {dia} e {hora}
                                              </span>
                                            );
                                          })}
                                        {agPendMes.map((a) => (
                                          <span key={a.id} className="text-violet-800 font-medium">
                                            • Agend.:{' '}
                                            {format(parseLocalDate(a.appointment_date), 'dd/MM/yy', { locale: ptBR })}{' '}
                                            {String(a.start_time ?? '').slice(0, 5)}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  {pago ? (
                                    isMesVigente ? (
                                      <div className="mt-3 grid gap-2 grid-cols-1">
                                        {usarAgendar ? (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="h-10"
                                            disabled={!podeRealizar || procedimentoFeito}
                                            onClick={() => openAgendarProcedimento(p)}
                                            title="Agendar procedimento na agenda"
                                          >
                                            <Calendar className="h-4 w-4 mr-2" aria-hidden />
                                            Agendar
                                          </Button>
                                        ) : (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="h-10"
                                            disabled={!podeRealizar || procedimentoFeito}
                                            onClick={() => openSessaoModal(p, mesKey)}
                                            title="Realizar procedimento"
                                          >
                                            <Scissors className="h-4 w-4 mr-2" aria-hidden />
                                            Fazer
                                          </Button>
                                        )}
                                      </div>
                                    ) : null
                                  ) : (
                                    <div className={cn('mt-3 grid gap-2', isMesVigente ? 'grid-cols-2' : 'grid-cols-1')}>
                                      <Button
                                        type="button"
                                        variant="default"
                                        className="h-10"
                                        onClick={() => openPayModal(p, mesKey)}
                                        title="Registrar pagamento"
                                      >
                                        <DollarSign className="h-4 w-4 mr-2" aria-hidden />
                                        Pagar
                                      </Button>
                                      {isMesVigente &&
                                        (usarAgendar ? (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="h-10"
                                            disabled={!podeRealizar || procedimentoFeito}
                                            onClick={() => openAgendarProcedimento(p)}
                                            title="Agendar procedimento na agenda"
                                          >
                                            <Calendar className="h-4 w-4 mr-2" aria-hidden />
                                            Agendar
                                          </Button>
                                        ) : (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            className="h-10"
                                            disabled={!podeRealizar || procedimentoFeito}
                                            onClick={() => openSessaoModal(p, mesKey)}
                                            title="Realizar procedimento"
                                          >
                                            <Scissors className="h-4 w-4 mr-2" aria-hidden />
                                            Fazer
                                          </Button>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </CardContent>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  );
                })}
              </div>}

              {/* Planilha: miolo com scroll; Valor/Sessões fora do scroll vertical (iPad/Safari) */}
              {planilhaMode && (
                <p className="xl:hidden shrink-0 text-[11px] text-muted-foreground px-0.5">
                  Nomes, <b>Mês</b>, <b>Valor</b> e <b>Sessões</b> ficam fixos — role só os meses.
                </p>
              )}
              <div
                className={cn(
                  // margem/borda visíveis: evita -mx e overflow do card “comerem” o frame
                  'relative flex flex-col rounded-lg border border-border bg-background shadow-sm overflow-hidden',
                  planilhaMode
                    ? 'max-xl:flex-1 max-xl:min-h-0 xl:max-h-[min(75vh,820px)] xl:min-h-[420px]'
                    : 'hidden lg:flex max-h-[min(75vh,820px)]'
                )}
              >
                <div
                  ref={planilhaBodyScrollRef}
                  onScroll={syncPlanilhaFooterScroll}
                  className="min-h-0 flex-1 overflow-auto overscroll-contain touch-pan-x touch-pan-y [scrollbar-gutter:stable]"
                >
                {/* p-px evita o overflow cortar a borda direita das células */}
                <div className="w-max min-w-full box-border p-px">
                {/* table nativa + border-separate: sticky confiável (header + coluna Mês) */}
                <table
                  className={cn(
                    'caption-bottom text-sm border-separate border-spacing-0',
                    planilhaMode ? 'w-max min-w-full table-auto' : 'w-full min-w-[640px] table-fixed'
                  )}
                >
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead
                        className={cn(
                          // canto: fixo no topo e à esquerda (acima de tudo)
                          'sticky top-0 left-0 z-40 border border-border bg-muted whitespace-nowrap',
                          'h-8 py-1 align-middle text-[10px] font-semibold leading-tight text-muted-foreground sm:h-9',
                          'shadow-[2px_0_0_0_hsl(var(--border)),0_2px_0_0_hsl(var(--border))]',
                          planilhaMode
                            ? 'w-[56px] min-w-[56px] max-w-[56px] px-1.5 text-center'
                            : 'w-[64px] min-w-[64px] max-w-[64px] px-1.5 sm:px-1.5 text-left'
                        )}
                      >
                        Mês
                      </TableHead>
                      {filteredProgramas.map((p) => {
                        const fullName = p.patients?.full_name ?? 'Paciente';
                        const label = planilhaMode ? shortPatientName(fullName) : fullName;
                        return (
                          <TableHead
                            key={p.id}
                            className={cn(
                              // nomes: fixos no topo
                              'sticky top-0 z-30 border border-border bg-muted px-1.5 py-1.5 align-middle',
                              'shadow-[0_2px_0_0_hsl(var(--border))]',
                              planilhaMode
                                ? 'w-[108px] min-w-[108px] max-w-[120px]'
                                : 'w-[80px] min-w-[80px]'
                            )}
                          >
                            <div
                              className={cn(
                                'font-semibold text-foreground text-center',
                                planilhaMode
                                  ? 'text-[11px] leading-tight line-clamp-2 whitespace-normal break-words'
                                  : 'text-xs truncate'
                              )}
                              title={fullName}
                            >
                              {label}
                            </div>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthKeys.map((mesKey) => (
                      <TableRow key={mesKey} className="hover:bg-transparent">
                        <TableCell
                          className={cn(
                            // meses: fixos à esquerda (abaixo do cabeçalho)
                            'sticky left-0 z-20 border border-border bg-background whitespace-nowrap',
                            'shadow-[2px_0_0_0_hsl(var(--border))]',
                            planilhaMode
                              ? 'w-[56px] min-w-[56px] max-w-[56px] px-1.5 py-1 sm:px-1.5 sm:py-1 text-[10px] leading-tight font-medium text-center'
                              : 'p-1.5 text-[10px] leading-tight sm:p-2 font-medium'
                          )}
                          title={formatMonthLabel(mesKey)}
                        >
                          <span className={cn(planilhaMode ? 'xl:hidden' : 'hidden')}>
                            {formatMonthLabelCompact(mesKey)}
                          </span>
                          <span className={cn(planilhaMode ? 'hidden xl:inline' : 'inline')}>
                            {formatMonthLabel(mesKey)}
                          </span>
                        </TableCell>
                        {filteredProgramas.map((p) => {
                          const valorMes = totalPagoNoMes(pagamentos, p.id, mesKey);
                          const sessoesMes = sessoesNoMes(sessoes, p.id, mesKey);
                          const procedimentoFeito = sessoesMes > 0;
                          const pendentesAgendaPb = countAgendamentosPendentesProgramaBotox(pbAgendaAppts, sessoes, p.id);
                          const podeRealizar = p.sessoes_realizadas + pendentesAgendaPb < p.total_sessoes;
                          const agPendMes = agendamentosPendentesNoMes(pbAgendaAppts, sessoes, p.id, mesKey);
                          const isMesVigente = mesKey === currentMesKey;
                          const usarAgendar = mesesAnterioresTodosPagos(
                            monthKeys,
                            mesKey,
                            pagamentos,
                            p.id,
                            monthKeyFromIso(p.data_inicio)
                          );
                          return (
                            <TableCell
                              key={`${mesKey}-${p.id}`}
                              className={cn(
                                'relative z-0 border align-middle',
                                planilhaMode ? 'p-1 sm:p-1' : 'p-2 sm:p-2',
                                valorMes > 0
                                  ? 'border-emerald-400/60 bg-emerald-100/90 dark:border-emerald-600 dark:bg-emerald-950/45'
                                  : 'border-border bg-background',
                                procedimentoFeito && 'ring-1 ring-blue-300 ring-inset',
                                agPendMes.length > 0 && !procedimentoFeito && 'ring-1 ring-violet-300 ring-inset'
                              )}
                            >
                              <div
                                className={cn(
                                  'flex flex-col items-center justify-center gap-0.5',
                                  planilhaMode ? 'min-h-[40px]' : 'min-h-[56px] gap-2'
                                )}
                              >
                                <div className="flex items-center justify-center gap-0.5 flex-wrap">
                                  {valorMes === 0 && (
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="outline"
                                      className={cn('h-8 w-8', planilhaMode && 'h-6 w-6')}
                                      title="Pago"
                                      aria-label="Pago"
                                      onClick={() => openPayModal(p, mesKey)}
                                    >
                                      <DollarSign className={cn('h-4 w-4', planilhaMode && 'h-3 w-3')} />
                                    </Button>
                                  )}
                                  {isMesVigente && !procedimentoFeito && (
                                    usarAgendar ? (
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="outline"
                                        className={cn('h-8 w-8', planilhaMode && 'h-6 w-6')}
                                        title="Agendar procedimento na agenda"
                                        aria-label="Agendar procedimento"
                                        disabled={!podeRealizar}
                                        onClick={() => openAgendarProcedimento(p)}
                                      >
                                        <Calendar className={cn('h-4 w-4', planilhaMode && 'h-3 w-3')} />
                                      </Button>
                                    ) : (
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="outline"
                                        className={cn('h-8 w-8', planilhaMode && 'h-6 w-6')}
                                        title="Realizar procedimento"
                                        aria-label="Realizar procedimento"
                                        disabled={!podeRealizar}
                                        onClick={() => openSessaoModal(p, mesKey)}
                                      >
                                        {savingSessao === p.id ? '…' : <Scissors className={cn('h-4 w-4', planilhaMode && 'h-3 w-3')} />}
                                      </Button>
                                    )
                                  )}
                                </div>
                                {valorMes > 0 && (
                                  <div
                                    className={cn(
                                      'font-semibold text-center text-emerald-800 dark:text-emerald-300 leading-tight',
                                      planilhaMode ? 'text-[9px] px-0.5' : 'text-[11px]'
                                    )}
                                  >
                                    {planilhaMode ? formatBRL(valorMes) : `Valor: ${formatBRL(valorMes)}`}
                                  </div>
                                )}
                                {procedimentoFeito &&
                                  sessoesListaNoMes(sessoes, p.id, mesKey).map((s) => {
                                    const { dia, hora } = textoConcluidaSessao(s.data);
                                    return (
                                      <span
                                        key={s.id}
                                        className={cn(
                                          'text-blue-700 text-center font-medium leading-tight block px-0.5',
                                          planilhaMode ? 'text-[9px]' : 'text-[10px]'
                                        )}
                                      >
                                        {planilhaMode ? `${dia.slice(0, 5)} ${hora}` : `Concluída ${dia} e ${hora}`}
                                      </span>
                                    );
                                  })}
                                {agPendMes.map((a) => (
                                  <span
                                    key={a.id}
                                    className={cn(
                                      'text-violet-800 text-center font-medium leading-tight px-0.5',
                                      planilhaMode ? 'text-[9px]' : 'text-[10px]'
                                    )}
                                  >
                                    {planilhaMode ? (
                                      <>
                                        {format(parseLocalDate(a.appointment_date), 'dd/MM', { locale: ptBR })}{' '}
                                        {String(a.start_time ?? '').slice(0, 5)}
                                      </>
                                    ) : (
                                      <>
                                        Agend.: {format(parseLocalDate(a.appointment_date), 'dd/MM', { locale: ptBR })}{' '}
                                        {String(a.start_time ?? '').slice(0, 5)}
                                      </>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </table>
                </div>
                </div>

                {/* Rodapé fora do scroll vertical — reserva a mesma gutter do scrollbar do miolo */}
                <div
                  ref={planilhaFooterScrollRef}
                  onScroll={syncPlanilhaBodyScroll}
                  className={cn(
                    'shrink-0 overflow-x-auto overflow-y-scroll overscroll-x-contain border-t border-border bg-muted',
                    '[scrollbar-gutter:stable] [scrollbar-width:none] [-ms-overflow-style:none]',
                    '[&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0'
                  )}
                >
                  <div className="w-max min-w-full box-border p-px">
                  <table
                    className={cn(
                      'caption-bottom text-sm border-separate border-spacing-0',
                      planilhaMode ? 'w-max min-w-full table-auto' : 'w-full min-w-[640px] table-fixed'
                    )}
                  >
                    <tbody>
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          className={cn(
                            'sticky left-0 z-20 font-semibold border border-border bg-muted whitespace-nowrap',
                            'shadow-[2px_0_0_0_hsl(var(--border))] h-9 px-1.5 py-1 sm:px-1.5 sm:py-1 text-[10px] leading-tight',
                            planilhaMode
                              ? 'w-[56px] min-w-[56px] max-w-[56px] text-center'
                              : 'w-[64px] min-w-[64px] max-w-[64px]'
                          )}
                          title="Pago / Total"
                        >
                          Valor
                        </TableCell>
                        {filteredProgramas.map((p) => {
                          const { pago, restante, totalEsperado } = resumoFinanceiroPrograma({
                            pagamentos,
                            programaId: p.id,
                            monthCount: monthKeys.length,
                            valorMensalidade: p.valor_mensalidade,
                          });
                          const label = formatPagoTotal(pago, totalEsperado);
                          const nome = p.patients?.full_name ?? 'Paciente';
                          return (
                            <TableCell
                              key={`total-${p.id}`}
                              className={cn(
                                'border border-border bg-muted text-[10px] sm:text-xs font-semibold text-center h-9 p-1 sm:p-1',
                                planilhaMode
                                  ? 'w-[108px] min-w-[108px] max-w-[120px]'
                                  : 'w-[80px] min-w-[80px]'
                              )}
                              title={`Pago ${formatBRL(pago)} · Restante ${formatBRL(restante)} · Total ${formatBRL(totalEsperado)}`}
                            >
                              <div className="flex items-center justify-center gap-1 flex-wrap">
                                {planilhaMode ? (
                                  <>
                                    <span className="leading-tight max-sm:hidden whitespace-nowrap">{label}</span>
                                    <span className="leading-tight sm:hidden">{formatBRL(pago)}</span>
                                  </>
                                ) : (
                                  <span className="leading-tight whitespace-nowrap">{label}</span>
                                )}
                                <ValorFinanceiroInfoButton
                                  pago={pago}
                                  restante={restante}
                                  totalEsperado={totalEsperado}
                                  patientName={nome}
                                />
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>

                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          className={cn(
                            'sticky left-0 z-20 font-semibold border border-border bg-muted',
                            'shadow-[2px_0_0_0_hsl(var(--border))] h-8 px-1.5 py-1 sm:px-1.5 sm:py-1 text-[9px] leading-tight whitespace-normal [word-break:break-word]',
                            planilhaMode
                              ? 'w-[56px] min-w-[56px] max-w-[56px] text-center'
                              : 'w-[64px] min-w-[64px] max-w-[64px]'
                          )}
                          title="Direito de sessão"
                        >
                          {planilhaMode ? (
                            <>
                              <span className="xl:hidden">Sessões</span>
                              <span className="hidden xl:inline">Direito de sessão</span>
                            </>
                          ) : (
                            'Direito de sessão'
                          )}
                        </TableCell>
                        {filteredProgramas.map((p) => {
                          const total = Number(p.total_sessoes ?? 0);
                          const realizadas = Number(p.sessoes_realizadas ?? 0);
                          const pendentesAgendaPb = countAgendamentosPendentesProgramaBotox(pbAgendaAppts, sessoes, p.id);
                          const restantes = saldoSessoesRestantes(total, realizadas, pendentesAgendaPb);
                          return (
                            <TableCell
                              key={`direito-${p.id}`}
                              className={cn(
                                'border border-border bg-muted text-xs font-semibold text-center h-8 p-1 sm:p-1',
                                planilhaMode
                                  ? 'w-[108px] min-w-[108px] max-w-[120px]'
                                  : 'w-[80px] min-w-[80px]',
                                restantes === 0 ? 'text-muted-foreground' : 'text-foreground'
                              )}
                              title={
                                pendentesAgendaPb > 0
                                  ? `${restantes}/${total} (${pendentesAgendaPb} agend.)`
                                  : `${restantes}/${total}`
                              }
                            >
                              {restantes}/{total}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteGroupTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deletingGroupId) setDeleteGroupTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar este grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              O grupo <span className="font-medium text-foreground">{deleteGroupTarget?.title}</span> será removido
              permanentemente.
              {(deleteGroupTarget?.totalPacientes ?? 0) > 0 ? (
                <>
                  {' '}
                  Este grupo tem{' '}
                  <span className="font-medium text-foreground">
                    {deleteGroupTarget?.totalPacientes}{' '}
                    {deleteGroupTarget?.totalPacientes === 1 ? 'paciente' : 'pacientes'}
                  </span>
                  : os programas, pagamentos e sessões vinculados também serão apagados.
                </>
              ) : null}{' '}
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingGroupId)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(deletingGroupId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteGroup();
              }}
            >
              {deletingGroupId ? 'Apagando...' : 'Apagar grupo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={newGroupModal.open}
        onOpenChange={(open) => setNewGroupModal(open ? newGroupModal : { open: false })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Grupo</DialogTitle>
            <DialogDescription>Defina o período e organize pacientes dentro deste grupo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="pb-group-name">Nome do grupo (opcional)</Label>
              <Input
                id="pb-group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Ex.: Grupo 2025/2026"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="pb-group-start">Início</Label>
                <Input id="pb-group-start" type="date" value={newGroupStart} onChange={(e) => setNewGroupStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pb-group-end">Fim</Label>
                <Input id="pb-group-end" type="date" value={newGroupEnd} onChange={(e) => setNewGroupEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setNewGroupModal({ open: false })}>
              Cancelar
            </Button>
            <Button type="button" onClick={submitNewGroup} disabled={savingNewGroup}>
              {savingNewGroup ? 'Criando…' : 'Criar grupo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={payModal.open}
        onOpenChange={(open) => setPayModal(open ? payModal : { open: false })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              {payModal.open ? (
                <>
                  Paciente: <b>{payModal.programa.patients?.full_name ?? 'Paciente'}</b> • Mês:{' '}
                  <b>{formatMonthLabel(payModal.mesKey)}</b>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="valor">Valor (R$)</Label>
            <Input
              id="valor"
              inputMode="decimal"
              placeholder="Ex: 150,00"
              value={payValor}
              onChange={(e) => setPayValor(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setPayModal({ open: false })}>
              Cancelar
            </Button>
            <Button type="button" onClick={submitPagamento} disabled={savingPay}>
              {savingPay ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sessaoModal.open} onOpenChange={(open) => setSessaoModal(open ? sessaoModal : { open: false })}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <VisuallyHidden>
            <DialogHeader>
              <DialogTitle>Nova sessão do Programa de Botox</DialogTitle>
              <DialogDescription>
                Preencha os dados da sessão e salve para registrar o procedimento no mês selecionado.
              </DialogDescription>
            </DialogHeader>
          </VisuallyHidden>
          <Card className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <CardHeader className="sm:p-4 p-3 md:p-6 flex flex-row items-center justify-between space-y-0 gap-3 rounded-t-lg">
              <div className="flex flex-col space-y-1.5 text-left">
                <CardTitle className="sm:text-xl font-semibold tracking-tight text-sm md:text-base flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 md:w-5 md:h-5 text-primary shrink-0" aria-hidden />
                  Nova sessão
                </CardTitle>
                <p className="sm:text-sm text-muted-foreground text-xs">
                  Preencha os dados desta sessão. Inclua fotos antes/depois quando aplicável.
                </p>
              </div>
            </CardHeader>

            <CardContent className="sm:p-4 space-y-4 p-3 md:p-6 pt-0">
              <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                <div className="p-3 sm:p-4 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data da sessão</Label>
                      <Input type="date" value={sessaoDate} onChange={(e) => setSessaoDate(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSessaoModal({ open: false })}
                  disabled={savingSessaoModal}
                >
                  Cancelar
                </Button>
                <Button type="button" onClick={submitSessao} disabled={savingSessaoModal}>
                  {savingSessaoModal ? 'Salvando…' : 'Salvar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>

      <ProgramaBotoxManagePatientsDialog
        open={managePatientsOpen}
        onOpenChange={setManagePatientsOpen}
        group={selectedGroup}
        programas={programas}
        onChanged={() => refresh({ silent: true })}
        onRequestAddPatient={() => {
          if (!selectedGroupId) {
            toast.error('Crie ou selecione um grupo antes de adicionar pacientes.');
            return;
          }
          setAddSearch('');
          setAddSelectedPatientId(null);
          setAddDiaVencimento(10);
          setAddTotalSessoes(2);
          setContractPatientSignature(null);
          setContractOpen(false);
          setAddModal({ open: true });
        }}
      />

      <Dialog
        open={addModal.open}
        onOpenChange={(open) => setAddModal(open ? addModal : { open: false })}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar paciente ao programa</DialogTitle>
            <DialogDescription>
              Selecione um paciente para o grupo atual.
            </DialogDescription>
          </DialogHeader>

          {selectedGroup ? (
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                Grupo:{' '}
                {selectedGroup.name?.trim() ||
                  `${format(parseLocalDate(selectedGroup.period_start), 'dd/MM/yyyy', { locale: ptBR })} até ${format(parseLocalDate(selectedGroup.period_end), 'dd/MM/yyyy', { locale: ptBR })}`}
              </p>
              <p>
                Período: {format(parseLocalDate(selectedGroup.period_start), 'dd/MM/yyyy', { locale: ptBR })} até{' '}
                {format(parseLocalDate(selectedGroup.period_end), 'dd/MM/yyyy', { locale: ptBR })}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pb-search">Buscar paciente</Label>
              <Input
                id="pb-search"
                placeholder="Digite o nome"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Selecione</Label>
            <div className="max-h-[280px] overflow-auto rounded-xl border border-border">
              {eligiblePatients.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">
                  {patientsLoading ? 'Carregando pacientes…' : 'Nenhum paciente disponível para adicionar.'}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {eligiblePatients.map((p: { id: string; full_name: string; phone?: string | null }) => {
                    const selected = addSelectedPatientId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setAddSelectedPatientId(p.id)}
                        className={cn(
                          'w-full text-left p-3 transition-colors',
                          selected ? 'bg-primary/10' : 'hover:bg-muted/50'
                        )}
                      >
                        <div className="font-medium text-sm text-foreground">{p.full_name}</div>
                        <div className="text-xs text-muted-foreground">{p.phone ?? '—'}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {addSelectedPatientId && (
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
              <Label className="text-sm font-medium">Melhor data de pagamento</Label>
              <p className="text-xs text-muted-foreground">
                Dia do mês em que o paciente costuma pagar (ex.: Dia 5, Dia 10).
              </p>
              <div className="flex flex-wrap gap-2">
                {diasVencimentoOptions.map((dia) => (
                  <Button
                    key={dia}
                    type="button"
                    size="sm"
                    variant={addDiaVencimento === dia ? 'default' : 'outline'}
                    onClick={() => setAddDiaVencimento(dia)}
                  >
                    Dia {dia}
                  </Button>
                ))}
              </div>
              {loadingAddSuggestion ? (
                <p className="text-[11px] text-muted-foreground">Buscando sugestão com base no histórico…</p>
              ) : null}
            </div>
          )}

          {addSelectedPatientId && (
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
              <Label className="text-sm font-medium">Quantidade de sessões</Label>
              <p className="text-xs text-muted-foreground">
                Selecione 2 ou 3 sessões para este paciente.
              </p>
              <div className="flex flex-wrap gap-2">
                {[2, 3].map((q) => (
                  <Button
                    key={q}
                    type="button"
                    size="sm"
                    variant={addTotalSessoes === q ? 'default' : 'outline'}
                    onClick={() => setAddTotalSessoes(q as 2 | 3)}
                  >
                    {q} sessões
                  </Button>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setAddModal({ open: false })}>
              Cancelar
            </Button>
            <Button type="button" onClick={submitAdd} disabled={savingAdd || !addSelectedPatientId}>
              {savingAdd ? 'Adicionando…' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={contractOpen}
        onOpenChange={(open) => {
          setContractOpen(open);
          if (!open) setContractPatientSignature(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assinatura do contrato - Clube do Botox</DialogTitle>
            <DialogDescription>
              Revise o contrato preenchido com os dados do paciente e colete a assinatura para concluir o cadastro.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border p-4 text-sm whitespace-pre-wrap max-h-[45vh] overflow-auto">
            {contractText}
          </div>
          {profile?.default_signature_data ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Assinatura do profissional</Label>
              <img
                src={profile.default_signature_data}
                alt="Assinatura do profissional"
                className="max-h-[120px] w-auto border rounded-lg bg-muted/30"
              />
            </div>
          ) : (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
              Assinatura padrão do profissional não cadastrada. Cadastre em Configurações para aparecer no contrato.
            </p>
          )}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Assinatura do paciente</Label>
            {contractPatientSignature ? (
              <div className="space-y-2">
                <img
                  src={contractPatientSignature}
                  alt="Assinatura do paciente"
                  className="max-h-[140px] w-auto border rounded-lg bg-muted/30"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setContractPatientSignature(null)}>
                  Refazer assinatura
                </Button>
              </div>
            ) : (
              <SignaturePad onSave={(dataUrl) => setContractPatientSignature(dataUrl)} height={160} className="pt-0" />
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setContractOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={submitAdd}
              disabled={savingAdd || !contractPatientSignature}
            >
              {savingAdd ? 'Finalizando…' : 'Confirmar e adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={agendarOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAgendarOpen(false);
            setAgendarPrograma(null);
            setConfirmAgendarSlot(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agendar procedimento</DialogTitle>
            <DialogDescription>
              {agendarPrograma ? (
                <>
                  {agendarPrograma.patients?.full_name ?? 'Paciente'} · {formatMonthLabel(currentMesKey)}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pb-agendar-data">Dia no mês vigente</Label>
              <Input
                id="pb-agendar-data"
                type="date"
                min={agendarMonthBounds.min}
                max={agendarMonthBounds.max}
                value={agendarDateStr}
                onChange={(e) => {
                  setAgendarDateStr(e.target.value);
                  setConfirmAgendarSlot(null);
                }}
              />
            </div>
            {agendarDateStr ? (
              <p className="text-xs text-muted-foreground">
                {format(parseLocalDate(agendarDateStr), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
            ) : null}
            {loadingAgendarDay ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : profile ? (
              <AgendaDaySlotsContent
                targetDate={parseLocalDate(agendarDateStr)}
                profile={profile}
                agendaDayAppointments={agendarDayAppts}
                confirmSlotTime={confirmAgendarSlot}
                onSelectSlot={setConfirmAgendarSlot}
                onConfirm={handleConfirmAgendarAppointment}
                onCancelConfirm={() => setConfirmAgendarSlot(null)}
                saving={savingAgendarAppt}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Carregando perfil…</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

