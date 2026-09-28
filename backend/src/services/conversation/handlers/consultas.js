'use strict';

const {
  isSairCommand,
  parseIndexPick,
  clearState,
  upsertState,
  buildMenuResponse,
  sortConsultas,
  uniqueProcedureNames,
  renderConsultasListResponse,
  beginViewConsultas,
  fetchUpcomingAppointments,
  buildConsultaDetailMessage,
} = require('../core');

async function tryHandleViewAppointment({
  phone,
  profissionalId,
  professionalName,
  current,
  normalizedText,
}) {
  const viewMatch = normalizedText.match(/^view_([0-9a-f-]+)$/i);
  if (!viewMatch) return null;

  const appointmentId = viewMatch[1];
  const upcoming = current?.consultasShown || current?.consultasRaw || [];
  let item = upcoming.find((row) => String(row.id) === appointmentId);
  if (!item) {
    const all = await fetchUpcomingAppointments({ professionalId: profissionalId, phone });
    item = all.find((row) => String(row.id) === appointmentId);
  }
  if (item) {
    return {
      reply: buildConsultaDetailMessage(item, professionalName),
      stateStep: current?.step === 'consultas_list' ? 'consultas_list' : 0,
    };
  }
  return null;
}

async function consultas_browse({
  phone,
  profissionalId,
  text,
  professionalName,
  existingClient,
  current,
}) {
  if (isSairCommand(text)) {
    clearState(phone);
    return await buildMenuResponse({ client: existingClient, professionalName, profissionalId });
  }

  const pick = parseIndexPick(text);
  const raw = current.consultasRaw || [];

  if (pick === 1) {
    const upcoming = sortConsultas(raw, 'asc');
    upsertState(phone, { ...current, step: 'consultas_list', consultasShown: upcoming });
    return renderConsultasListResponse({
      upcoming,
      professionalName,
      extraIntro: 'Consultas ordenadas da mais próxima para a mais distante.',
    });
  }
  if (pick === 2) {
    const upcoming = sortConsultas(raw, 'desc');
    upsertState(phone, { ...current, step: 'consultas_list', consultasShown: upcoming });
    return renderConsultasListResponse({
      upcoming,
      professionalName,
      extraIntro: 'Consultas ordenadas da mais distante para a mais próxima.',
    });
  }
  if (pick === 3) {
    const procedures = uniqueProcedureNames(raw);
    if (!procedures.length) {
      return renderConsultasListResponse({ upcoming: raw, professionalName });
    }
    upsertState(phone, {
      ...current,
      step: 'consultas_procedure_filter',
      procedureOptions: procedures.map((name, idx) => ({ pickIndex: idx + 1, name })),
    });
    const preview = procedures.map((name, idx) => `*${idx + 1}* — ${name}`).join('\n');
    return {
      reply:
        `Escolha o procedimento:\n\n` +
        `${preview}\n\n` +
        `Responda com o *número* ou *0* para voltar.`,
      stateStep: 'consultas_procedure_filter',
    };
  }

  return {
    reply: 'Responda *1*, *2*, *3* ou *0* para voltar ao menu.',
  };
}

async function consultas_procedure_filter({ phone, profissionalId, text, professionalName, current }) {
  if (isSairCommand(text)) {
    return beginViewConsultas({ phone, profissionalId, professionalName });
  }

  const pick = parseIndexPick(text);
  if (!pick) {
    return { reply: 'Responda com o *número do procedimento* ou *0* para voltar.' };
  }

  const chosen = (current.procedureOptions || []).find((item) => item.pickIndex === pick);
  if (!chosen) {
    return { reply: 'Procedimento inválido. Escolha um número da lista ou *0* para voltar.' };
  }

  const upcoming = sortConsultas(
    (current.consultasRaw || []).filter((item) => item.procedureName === chosen.name),
    'asc'
  );
  upsertState(phone, { ...current, step: 'consultas_list', consultasShown: upcoming });
  return renderConsultasListResponse({
    upcoming,
    professionalName,
    extraIntro: `Consultas de *${chosen.name}*:`,
  });
}

async function consultas_list(ctx) {
  const { phone, profissionalId, text, professionalName, existingClient, current } = ctx;
  if (isSairCommand(text)) {
    clearState(phone);
    return await buildMenuResponse({ client: existingClient, professionalName, profissionalId });
  }

  const viewResult = await tryHandleViewAppointment(ctx);
  if (viewResult) return viewResult;

  return {
    reply: 'Não entendi. Digite *0* para voltar ao menu ou *oi* para recomeçar.',
    stateStep: current?.step ?? 0,
  };
}

module.exports = {
  consultas_browse,
  consultas_list,
  consultas_procedure_filter,
  tryHandleViewAppointment,
};
