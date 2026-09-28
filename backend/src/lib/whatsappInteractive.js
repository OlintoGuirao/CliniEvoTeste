const { formatDateBRFromYmd, formatDateWithWeekdayBR } = require('../utils/time');

const ROW_TO_COMMAND = {
  menu_agendar: '1',
  menu_consultas: '2',
  menu_reagendar: '3',
  menu_cancelar: '4',
  menu_profissional: '5',
  menu_promocoes: '6',
  menu_faq: '7',
  menu_tratamentos: '8',
  menu_sair: '0',
  guest_servicos: '1',
  guest_promocoes: '2',
  guest_faq: '3',
  guest_profissional: '4',
  guest_agendar: '5',
  guest_sair: '0',
};

function formatTimeBR(timeStr) {
  return String(timeStr || '').slice(0, 5);
}

/** Converte rowId da lista Evolution → comando numérico/texto do fluxo. */
function normalizeListRowId(rowId) {
  const id = String(rowId || '').trim();
  if (!id) return '';
  if (ROW_TO_COMMAND[id]) return ROW_TO_COMMAND[id];
  const procMatch = id.match(/^proc_(\d+)$/i);
  if (procMatch) return procMatch[1];
  const dateMatch = id.match(/^date_(\d+)$/i);
  if (dateMatch) return dateMatch[1];
  const timeMatch = id.match(/^time_(\d+)$/i);
  if (timeMatch) return timeMatch[1];
  const cancelMatch = id.match(/^cancel_(\d+)$/i);
  if (cancelMatch) return cancelMatch[1];
  const rescheduleMatch = id.match(/^reschedule_(\d+)$/i);
  if (rescheduleMatch) return rescheduleMatch[1];
  const slotMatch = id.match(/^slot_(\d+)$/i);
  if (slotMatch) return slotMatch[1];
  const promoMatch = id.match(/^promo_(\d+)$/i);
  if (promoMatch) return promoMatch[1];
  const faqMatch = id.match(/^faq_(\d+)$/i);
  if (faqMatch) return faqMatch[1];
  const treatmentMatch = id.match(/^treatment_(\d+)$/i);
  if (treatmentMatch) return treatmentMatch[1];
  return id;
}

function buildWelcomeMenuList({
  greetingLine,
  footerText = 'Atendimento virtual CliniEvo',
  includePromotions = false,
}) {
  const description = String(greetingLine || 'Olá! 👋\n\nExplore nossos serviços.').trim();
  const rows = [
    { title: 'Conhecer serviços', description: 'Procedimentos e especialidades', rowId: 'guest_servicos' },
  ];
  if (includePromotions) {
    rows.push({ title: 'Ver promoções', description: 'Ofertas da clínica', rowId: 'guest_promocoes' });
  }
  rows.push(
    { title: 'Dúvidas frequentes', description: 'Perguntas e respostas', rowId: 'guest_faq' },
    { title: 'Falar com o profissional', description: 'Atendimento humano', rowId: 'guest_profissional' },
    { title: 'Agendar consulta', description: 'Cadastro rápido para agendar', rowId: 'guest_agendar' },
    { title: 'Sair', description: 'Encerrar atendimento', rowId: 'guest_sair' }
  );

  return {
    type: 'list',
    listOnly: true,
    payload: {
      title: 'Boas-vindas',
      description,
      buttonText: 'Ver opções',
      footerText,
      sections: [{ title: 'Menu', rows }],
    },
  };
}

function buildMainMenuList({
  greetingLine,
  footerText = 'Atendimento virtual CliniEvo',
  includePromotions = false,
  includeFaq = false,
  includeTreatments = false,
}) {
  const description = String(greetingLine || 'Olá! 😊\n\nComo posso ajudar hoje?').trim();
  const rows = [
    {
      title: 'Novo agendamento',
      description: 'Escolher procedimento e horário',
      rowId: 'menu_agendar',
    },
    {
      title: 'Minhas consultas',
      description: 'Consultas agendadas',
      rowId: 'menu_consultas',
    },
    {
      title: 'Reagendar consulta',
      description: 'Alterar data ou horário',
      rowId: 'menu_reagendar',
    },
    {
      title: 'Cancelar consulta',
      description: 'Cancelar um agendamento',
      rowId: 'menu_cancelar',
    },
    {
      title: 'Falar com o profissional',
      description: 'Atendimento humano',
      rowId: 'menu_profissional',
    },
  ];

  if (includePromotions) {
    rows.push({
      title: 'Ver promoções',
      description: 'Ofertas e campanhas da clínica',
      rowId: 'menu_promocoes',
    });
  }

  if (includeFaq) {
    rows.push({
      title: 'Dúvidas frequentes',
      description: 'Perguntas e respostas da clínica',
      rowId: 'menu_faq',
    });
  }

  if (includeTreatments) {
    rows.push({
      title: 'Meus tratamentos',
      description: 'Links de acompanhamento ativos',
      rowId: 'menu_tratamentos',
    });
  }

  rows.push({
    title: 'Sair',
    description: 'Encerrar atendimento',
    rowId: 'menu_sair',
  });

  return {
    type: 'list',
    listOnly: true,
    payload: {
      title: 'Atendimento',
      description,
      buttonText: 'Ver opções',
      footerText,
      sections: [
        {
          title: 'Escolha uma opção',
          rows,
        },
      ],
    },
  };
}

function chunkRows(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function buildProceduresList({ professionalName, procedures }) {
  const LIST_ROWS_MAX = 10;
  const chunks = chunkRows(procedures || [], LIST_ROWS_MAX);
  const sections = chunks.map((chunk, sectionIndex) => ({
    title: sectionIndex === 0 ? 'Procedimentos' : `Procedimentos (${sectionIndex + 1})`,
    rows: chunk.map((p) => ({
      title: p.name,
      description: p.category ? String(p.category) : 'Selecionar',
      rowId: `proc_${p.pickIndex}`,
    })),
  }));

  return {
    type: 'list',
    listOnly: true,
    payload: {
      title: 'Agendar consulta',
      description: `Qual procedimento deseja com ${professionalName}?`,
      buttonText: 'Ver procedimentos',
      footerText: 'Toque no procedimento desejado',
      sections: sections.length ? sections : [{ title: 'Procedimentos', rows: [] }],
    },
  };
}

function buildDatesList({ procedureName, dateOptions }) {
  const LIST_ROWS_MAX = 10;
  const items = dateOptions || [];
  const sections = chunkRows(items, LIST_ROWS_MAX).map((chunk, sectionIndex) => ({
    title: sectionIndex === 0 ? 'Escolha uma data' : `Datas (${sectionIndex + 1})`,
    rows: chunk.map((d) => ({
      title: formatDateWithWeekdayBR(d.appointmentDate),
      description: `${(d.times || []).length} horário(s) disponível(is)`,
      rowId: `date_${d.pickIndex}`,
    })),
  }));

  return {
    type: 'list',
    listOnly: true,
    payload: {
      title: procedureName || 'Agendar',
      description: 'Escolha uma data:',
      buttonText: 'Ver datas',
      footerText: 'Toque na data desejada',
      sections: sections.length ? sections : [{ title: 'Datas', rows: [] }],
    },
  };
}

function buildTimesList({ procedureName, appointmentDate, timeOptions }) {
  const LIST_ROWS_MAX = 10;
  const items = timeOptions || [];
  const sections = chunkRows(items, LIST_ROWS_MAX).map((chunk, sectionIndex) => ({
    title: sectionIndex === 0 ? 'Horários' : `Horários (${sectionIndex + 1})`,
    rows: chunk.map((t) => ({
      title: formatTimeBR(t.appointmentTime),
      description: 'Selecionar este horário',
      rowId: `time_${t.pickIndex}`,
    })),
  }));

  return {
    type: 'list',
    listOnly: true,
    payload: {
      title: procedureName || 'Horários',
      description: `Horários disponíveis para ${formatDateBRFromYmd(appointmentDate)}:`,
      buttonText: 'Ver horários',
      footerText: 'Toque no horário desejado',
      sections: sections.length ? sections : [{ title: 'Horários', rows: [] }],
    },
  };
}

function buildConsultasViewList({ upcoming }) {
  const LIST_ROWS_MAX = 10;
  const items = upcoming || [];
  const sections = chunkRows(items, LIST_ROWS_MAX).map((chunk, sectionIndex) => ({
    title: sectionIndex === 0 ? 'Suas consultas' : `Suas consultas (${sectionIndex + 1})`,
    rows: chunk.map((item) => ({
      title: `${item.procedureName} — ${formatDateBRFromYmd(item.appointment_date)} ${formatTimeBR(item.start_time)}`,
      description: 'Consulta agendada',
      rowId: `view_${item.id}`,
    })),
  }));

  return {
    type: 'list',
    listOnly: true,
    payload: {
      title: 'Minhas consultas',
      description: 'Suas consultas futuras',
      buttonText: 'Ver consultas',
      footerText: 'Para cancelar ou reagendar, use o menu principal',
      sections: sections.length ? sections : [{ title: 'Suas consultas', rows: [] }],
    },
  };
}

function buildCancelList({ upcoming }) {
  const LIST_ROWS_MAX = 10;
  const items = upcoming || [];
  const sections = chunkRows(items, LIST_ROWS_MAX).map((chunk, sectionIndex) => ({
    title: sectionIndex === 0 ? 'Cancelar consulta' : `Cancelar (${sectionIndex + 1})`,
    rows: chunk.map((item, idx) => {
      const globalIndex = sectionIndex * LIST_ROWS_MAX + idx + 1;
      return {
        title: `${item.procedureName} — ${formatDateBRFromYmd(item.appointment_date)} ${formatTimeBR(item.start_time)}`,
        description: 'Cancelar esta consulta',
        rowId: `cancel_${globalIndex}`,
      };
    }),
  }));

  return {
    type: 'list',
    listOnly: true,
    payload: {
      title: 'Cancelar consulta',
      description: 'Toque para cancelar uma consulta',
      buttonText: 'Ver consultas',
      footerText: 'Ação irreversível',
      sections: sections.length ? sections : [{ title: 'Suas consultas', rows: [] }],
    },
  };
}

function buildRescheduleList({ upcoming }) {
  const LIST_ROWS_MAX = 10;
  const items = upcoming || [];
  const sections = chunkRows(items, LIST_ROWS_MAX).map((chunk, sectionIndex) => ({
    title: sectionIndex === 0 ? 'Reagendar' : `Reagendar (${sectionIndex + 1})`,
    rows: chunk.map((item, idx) => {
      const globalIndex = sectionIndex * LIST_ROWS_MAX + idx + 1;
      return {
        title: `${item.procedureName} — ${formatDateBRFromYmd(item.appointment_date)} ${formatTimeBR(item.start_time)}`,
        description: 'Escolher nova data e horário',
        rowId: `reschedule_${globalIndex}`,
      };
    }),
  }));

  return {
    type: 'list',
    listOnly: true,
    payload: {
      title: 'Reagendar consulta',
      description: 'Escolha a consulta que deseja reagendar',
      buttonText: 'Ver consultas',
      footerText: 'Depois escolha nova data e horário',
      sections: sections.length ? sections : [{ title: 'Suas consultas', rows: [] }],
    },
  };
}

/** @deprecated mantido para compatibilidade */
function buildSlotsList({ professionalName, procedureName, slots }) {
  const byDate = new Map();
  for (const s of slots || []) {
    const date = s.appointmentDate;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(s);
  }
  const dateOptions = Array.from(byDate.entries()).map(([appointmentDate, daySlots], idx) => ({
    pickIndex: idx + 1,
    appointmentDate,
    times: daySlots,
  }));
  return buildDatesList({ procedureName, dateOptions });
}

/** @deprecated use buildConsultasViewList ou buildCancelList */
function buildConsultasList({ upcoming }) {
  return buildCancelList({ upcoming });
}

function buildPromotionsList({ promotions }) {
  const LIST_ROWS_MAX = 10;
  const items = promotions || [];
  const sections = chunkRows(items, LIST_ROWS_MAX).map((chunk, sectionIndex) => ({
    title: sectionIndex === 0 ? 'Promoções' : `Promoções (${sectionIndex + 1})`,
    rows: chunk.map((promo) => {
      const slots =
        promo.maxParticipants == null
          ? 'Agendamentos ilimitados'
          : `${Math.max(0, promo.maxParticipants - promo.claimedCount)} agendamento(s)`;
      return {
        title: promo.title,
        description: slots,
        rowId: `promo_${promo.pickIndex}`,
      };
    }),
  }));

  return {
    type: 'list',
    listOnly: true,
    payload: {
      title: 'Promoções',
      description: 'Toque para ver a promoção disponível',
      buttonText: 'Ver promoções',
      footerText: 'Limite vale para quem agendar primeiro',
      sections: sections.length ? sections : [{ title: 'Promoções', rows: [] }],
    },
  };
}

function buildTreatmentsList({ treatments }) {
  const LIST_ROWS_MAX = 10;
  const items = treatments || [];
  const sections = chunkRows(items, LIST_ROWS_MAX).map((chunk, sectionIndex) => ({
    title: sectionIndex === 0 ? 'Tratamentos ativos' : `Tratamentos (${sectionIndex + 1})`,
    rows: chunk.map((item) => ({
      title: item.procedureName,
      description: item.kind === 'botox' ? 'Programa ativo' : 'Ver relatório de acompanhamento',
      rowId: `treatment_${item.pickIndex}`,
    })),
  }));

  return {
    type: 'list',
    listOnly: true,
    payload: {
      title: 'Meus tratamentos',
      description: 'Escolha um tratamento para ver o link',
      buttonText: 'Ver tratamentos',
      footerText: 'Acompanhamento da clínica',
      sections: sections.length ? sections : [{ title: 'Tratamentos', rows: [] }],
    },
  };
}

function buildFaqList({ faqItems }) {
  const LIST_ROWS_MAX = 10;
  const items = faqItems || [];
  const sections = chunkRows(items, LIST_ROWS_MAX).map((chunk, sectionIndex) => ({
    title: sectionIndex === 0 ? 'Dúvidas frequentes' : `Dúvidas (${sectionIndex + 1})`,
    rows: chunk.map((item) => ({
      title: item.question,
      description: 'Toque para ver a resposta',
      rowId: `faq_${item.pickIndex}`,
    })),
  }));

  return {
    type: 'list',
    listOnly: true,
    payload: {
      title: 'Dúvidas frequentes',
      description: 'Escolha uma pergunta',
      buttonText: 'Ver perguntas',
      footerText: 'Respostas da clínica',
      sections: sections.length ? sections : [{ title: 'Dúvidas', rows: [] }],
    },
  };
}

module.exports = {
  buildWelcomeMenuList,
  buildMainMenuList,
  buildProceduresList,
  buildDatesList,
  buildTimesList,
  buildConsultasViewList,
  buildCancelList,
  buildRescheduleList,
  buildPromotionsList,
  buildTreatmentsList,
  buildFaqList,
  buildSlotsList,
  buildConsultasList,
  normalizeListRowId,
};
