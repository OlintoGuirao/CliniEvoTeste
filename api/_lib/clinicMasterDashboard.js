/**
 * Agregação de dados do dashboard Master da Clínica (service role, após requireClinicOwner).
 */

import {
  buildTopTreatments,
  computeComparison,
  computeConversionRate,
  computeTicketMedio,
  formatMonthLabel,
  monthEvolutionKeys,
  previousPeriod,
} from './clinicMasterDashboardMetrics.js';

function parseFilters(url) {
  const sp = url.searchParams;
  const dataInicio = sp.get('dataInicio');
  const dataFim = sp.get('dataFim');
  if (!dataInicio || !dataFim) {
    return { error: 'Parâmetros dataInicio e dataFim são obrigatórios.', status: 400 };
  }
  return {
    filters: {
      dataInicio,
      dataFim,
      branchId: sp.get('branchId') || null,
      professionalId: sp.get('professionalId') || null,
      procedureId: sp.get('procedureId') || null,
      status: sp.get('status') || null,
    },
  };
}

function ymdToday() {
  return new Date().toISOString().slice(0, 10);
}

function sum(arr, fn) {
  return arr.reduce((acc, item) => acc + fn(item), 0);
}

function filterByBranch(items, branchId, profBranchMap, getProfId, getBranchId) {
  if (!branchId) return items;
  return items.filter((item) => {
    const direct = getBranchId(item);
    if (direct) return direct === branchId;
    const profId = getProfId(item);
    return profBranchMap.get(profId) === branchId;
  });
}

async function loadTeam(admin, organizationId) {
  const { data, error } = await admin
    .from('organization_members')
    .select('user_id, branch_id, role, profiles(full_name)')
    .eq('organization_id', organizationId);
  if (error) throw new Error(error.message);
  const members = data ?? [];
  const profBranchMap = new Map(members.map((m) => [String(m.user_id), m.branch_id ? String(m.branch_id) : null]));
  const profNameMap = new Map(
    members.map((m) => {
      const p = m.profiles;
      const row = Array.isArray(p) ? p[0] : p;
      return [String(m.user_id), String(row?.full_name || 'Profissional')];
    })
  );
  return { members, profBranchMap, profNameMap, teamUserIds: members.map((m) => String(m.user_id)) };
}

async function loadAvaliacaoProcedureId(admin) {
  const { data } = await admin.from('procedures').select('id').eq('slug', 'avaliacao').maybeSingle();
  return data?.id ? String(data.id) : null;
}

async function fetchAppointments(admin, teamIds, dataInicio, dataFim) {
  if (!teamIds.length) return [];
  const { data, error } = await admin
    .from('appointments')
    .select('id, professional_id, appointment_date, patient_id, patients(full_name)')
    .in('professional_id', teamIds)
    .gte('appointment_date', dataInicio)
    .lte('appointment_date', dataFim);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchEvaluations(admin, avaliacaoId, teamIds, dataInicio, dataFim) {
  if (!avaliacaoId || !teamIds.length) return [];
  const { data, error } = await admin
    .from('procedure_instances')
    .select('id, professional_id, patient_id, data_inicio, status, created_at, patients(full_name)')
    .eq('procedure_id', avaliacaoId)
    .in('professional_id', teamIds)
    .gte('created_at', `${dataInicio}T00:00:00`)
    .lte('created_at', `${dataFim}T23:59:59.999`);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchBudgetQuotes(admin, teamIds, dataInicio, dataFim) {
  if (!teamIds.length) return [];
  const { data, error } = await admin
    .from('budget_quotes')
    .select('id, professional_id, patient_id, status, updated_at, created_at, patients(full_name)')
    .in('professional_id', teamIds)
    .gte('updated_at', `${dataInicio}T00:00:00`)
    .lte('updated_at', `${dataFim}T23:59:59.999`);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchRecebimentos(admin, teamIds, dataInicio, dataFim, filters) {
  if (!teamIds.length) return [];
  let q = admin
    .from('recebimentos')
    .select(
      'id, profissional_id, procedimento_id, valor_total, valor_recebido, status, data, branch_id, patients(full_name), procedures(name)'
    )
    .in('profissional_id', teamIds)
    .gte('data', `${dataInicio}T00:00:00`)
    .lte('data', `${dataFim}T23:59:59.999`);

  if (filters.branchId) q = q.eq('branch_id', filters.branchId);
  if (filters.procedureId) q = q.eq('procedimento_id', filters.procedureId);
  if (filters.status) q = q.eq('status', filters.status);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchInsumos(admin, teamIds, dataInicio, dataFim, branchId) {
  if (!teamIds.length) return [];
  let q = admin
    .from('insumo_entradas_nf')
    .select('id, professional_id, branch_id, valor_total, data_compra, descricao')
    .in('professional_id', teamIds)
    .gte('data_compra', dataInicio)
    .lte('data_compra', dataFim);
  if (branchId) q = q.eq('branch_id', branchId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchBotoxPayments(admin, teamIds, dataInicio, dataFim) {
  if (!teamIds.length) return [];
  const { data: programs, error: pErr } = await admin
    .from('programas_botox')
    .select('id, professional_id')
    .in('professional_id', teamIds);
  if (pErr) throw new Error(pErr.message);
  const ids = (programs ?? []).map((p) => p.id);
  if (!ids.length) return [];
  const { data, error } = await admin
    .from('pagamentos')
    .select('id, programa_id, valor, data_pagamento')
    .in('programa_id', ids)
    .gte('data_pagamento', `${dataInicio}T00:00:00`)
    .lte('data_pagamento', `${dataFim}T23:59:59.999`);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function countClosings(budgetQuotes, recebimentos) {
  const accepted = budgetQuotes.filter((q) => q.status === 'accepted').length;
  const paidReceb = recebimentos.filter((r) => r.status === 'pago').length;
  return accepted + paidReceb;
}

function revenueTotal(recebimentos, botoxPayments) {
  const fromRec = sum(recebimentos, (r) => Number(r.valor_total ?? 0));
  const fromBotox = sum(botoxPayments, (p) => Number(p.valor ?? 0));
  return fromRec + fromBotox;
}

function expensesTotal(insumos) {
  return sum(insumos, (r) => Number(r.valor_total ?? 0));
}

function buildTreatmentMap(recebimentos) {
  const map = new Map();
  for (const r of recebimentos) {
    const proc = r.procedures;
    const procRow = Array.isArray(proc) ? proc[0] : proc;
    const id = r.procedimento_id ? String(r.procedimento_id) : null;
    const name = procRow?.name || 'Outros';
    const key = id || name;
    const prev = map.get(key) || { procedureId: id, name, value: 0, quantity: 0 };
    prev.value += Number(r.valor_total ?? 0);
    prev.quantity += 1;
    map.set(key, prev);
  }
  return [...map.values()];
}

function buildSalesByStatus(recebimentos, budgetQuotes) {
  const statusLabels = {
    pago: 'Pago',
    pendente: 'Pendente',
    parcial: 'Parcial',
    open: 'Orçamento aberto',
    accepted: 'Orçamento aceito',
    rejected: 'Orçamento recusado',
  };
  const map = new Map();
  for (const r of recebimentos) {
    const st = String(r.status || 'pendente');
    const prev = map.get(st) || { status: st, label: statusLabels[st] || st, value: 0, amount: 0 };
    prev.value += 1;
    prev.amount += Number(r.valor_total ?? 0);
    map.set(st, prev);
  }
  for (const q of budgetQuotes) {
    const st = String(q.status || 'open');
    const prev = map.get(st) || { status: st, label: statusLabels[st] || st, value: 0, amount: 0 };
    prev.value += 1;
    map.set(st, prev);
  }
  return [...map.values()];
}

function buildBranchMetrics(branches, profBranchMap, appointments, evaluations, budgetQuotes, recebimentos, insumos, botoxByProf) {
  const branchBotox = new Map();
  for (const [profId, amount] of botoxByProf) {
    const bId = profBranchMap.get(profId);
    if (!bId) continue;
    branchBotox.set(bId, (branchBotox.get(bId) || 0) + amount);
  }

  return branches.map((branch) => {
    const branchId = String(branch.id);
    const appts = appointments.filter((a) => profBranchMap.get(String(a.professional_id)) === branchId);
    const evals = evaluations.filter((e) => profBranchMap.get(String(e.professional_id)) === branchId);
    const quotes = budgetQuotes.filter((q) => profBranchMap.get(String(q.professional_id)) === branchId);
    const recs = recebimentos.filter((r) => String(r.branch_id || '') === branchId || (!r.branch_id && profBranchMap.get(String(r.profissional_id)) === branchId));
    const exp = insumos.filter((i) => String(i.branch_id || '') === branchId || (!i.branch_id && profBranchMap.get(String(i.professional_id)) === branchId));
    const closings = countClosings(quotes, recs);
    const revenue = revenueTotal(recs, []) + (branchBotox.get(branchId) || 0);
    const expenses = expensesTotal(exp);
    const conv = computeConversionRate(closings, evals.length);
    return {
      branchId,
      branchName: String(branch.name),
      appointments: appts.length,
      evaluations: evals.length,
      closings,
      revenue,
      expenses,
      conversionPercent: conv.ratePercent,
      ticketMedio: computeTicketMedio(revenue, closings),
    };
  });
}

function buildInsights(kpis, conversion, branchRanking, goalProgress) {
  const insights = [];
  const top = branchRanking[0];
  if (top && branchRanking.length > 1) {
    insights.push({
      id: 'top-branch',
      type: 'success',
      title: `Melhor desempenho: ${top.branchName}`,
      description: `Faturamento de ${top.revenue.toFixed(2)} no período, com ${top.closings} fechamento(s).`,
    });
  }
  if (conversion.ratePercent != null && conversion.ratePercent < 20 && conversion.denominator >= 3) {
    insights.push({
      id: 'low-conversion',
      type: 'warning',
      title: 'Conversão abaixo do ideal',
      description: `Taxa de ${conversion.ratePercent.toFixed(1)}% entre avaliações e fechamentos. Revise follow-up da equipe.`,
    });
  }
  if (kpis.expenses.comparison.trend === 'up' && (kpis.expenses.comparison.deltaPercent ?? 0) > 15) {
    insights.push({
      id: 'expenses-up',
      type: 'warning',
      title: 'Despesas em alta',
      description: 'Gastos com insumos aumentaram em relação ao período anterior.',
    });
  }
  if (kpis.revenue.comparison.trend === 'down' && (kpis.revenue.comparison.deltaPercent ?? 0) < -10) {
    insights.push({
      id: 'revenue-down',
      type: 'opportunity',
      title: 'Queda de faturamento',
      description: 'Analise tratamentos e desempenho por unidade para recuperar vendas.',
    });
  }
  if (!goalProgress.hasGoal) {
    insights.push({
      id: 'no-goal',
      type: 'info',
      title: 'Metas não configuradas',
      description: 'Cadastre metas de vendas quando a funcionalidade estiver disponível para acompanhar o realizado.',
    });
  }
  return insights;
}

function mapDetailRows(kind, items, profNameMap, branchNameMap, profBranchMap) {
  return items.slice(0, 200).map((item) => {
    const patient = item.patients;
    const patientRow = Array.isArray(patient) ? patient[0] : patient;
    const profId = String(item.professional_id || item.profissional_id || '');
    const branchId = item.branch_id || profBranchMap.get(profId);
    if (kind === 'revenue') {
      const proc = item.procedures;
      const procRow = Array.isArray(proc) ? proc[0] : proc;
      return {
        id: String(item.id),
        date: String(item.data).slice(0, 10),
        label: patientRow?.full_name || 'Cliente',
        secondary: procRow?.name || 'Procedimento',
        amount: Number(item.valor_total ?? 0),
        status: item.status,
        branchName: branchId ? branchNameMap.get(String(branchId)) || null : null,
        professionalName: profNameMap.get(profId) || null,
      };
    }
    if (kind === 'expenses') {
      return {
        id: String(item.id),
        date: String(item.data_compra).slice(0, 10),
        label: item.descricao || 'Despesa',
        amount: Number(item.valor_total ?? 0),
        branchName: branchId ? branchNameMap.get(String(branchId)) || null : null,
        professionalName: profNameMap.get(profId) || null,
      };
    }
    if (kind === 'closings') {
      return {
        id: String(item.id),
        date: String(item.updated_at || item.data || item.created_at).slice(0, 10),
        label: patientRow?.full_name || 'Cliente',
        status: item.status,
        professionalName: profNameMap.get(profId) || null,
      };
    }
    const date = item.appointment_date || item.data_inicio || item.created_at;
    return {
      id: String(item.id),
      date: String(date).slice(0, 10),
      label: patientRow?.full_name || 'Paciente',
      status: item.status,
      professionalName: profNameMap.get(profId) || null,
    };
  });
}

async function aggregatePeriod(admin, ctx, filters, teamIds, profBranchMap, profNameMap, avaliacaoId, branches) {
  const { dataInicio, dataFim } = filters;
  let activeTeam = teamIds;
  if (filters.professionalId) {
    if (!teamIds.includes(filters.professionalId)) {
      return null;
    }
    activeTeam = [filters.professionalId];
  }

  const [appointments, evaluations, budgetQuotes, recebimentos, insumos, botoxPayments] = await Promise.all([
    fetchAppointments(admin, activeTeam, dataInicio, dataFim),
    fetchEvaluations(admin, avaliacaoId, activeTeam, dataInicio, dataFim),
    fetchBudgetQuotes(admin, activeTeam, dataInicio, dataFim),
    fetchRecebimentos(admin, activeTeam, dataInicio, dataFim, filters),
    fetchInsumos(admin, activeTeam, dataInicio, dataFim, filters.branchId),
    fetchBotoxPayments(admin, activeTeam, dataInicio, dataFim),
  ]);

  const apptsFiltered = filterByBranch(
    appointments,
    filters.branchId,
    profBranchMap,
    (a) => String(a.professional_id),
    () => null
  );
  const evalsFiltered = filterByBranch(
    evaluations,
    filters.branchId,
    profBranchMap,
    (e) => String(e.professional_id),
    () => null
  );
  const quotesFiltered = filterByBranch(
    budgetQuotes,
    filters.branchId,
    profBranchMap,
    (q) => String(q.professional_id),
    () => null
  );

  const today = ymdToday();
  const apptsToday = apptsFiltered.filter((a) => a.appointment_date === today).length;

  const closings = countClosings(quotesFiltered, recebimentos);
  const revenue = revenueTotal(recebimentos, botoxPayments);
  const expenses = expensesTotal(insumos);
  const ticket = computeTicketMedio(revenue, closings) ?? 0;
  const conv = computeConversionRate(closings, evalsFiltered.length);

  const treatmentRows = buildTreatmentMap(recebimentos);
  const topTreatments = buildTopTreatments(treatmentRows, 5);
  const topTreatment = topTreatments[0] || null;

  const monthKeys = monthEvolutionKeys(dataInicio, dataFim);
  const salesEvolution = monthKeys.map((key) => {
    const monthRec = recebimentos.filter((r) => String(r.data).slice(0, 7) === key);
    const monthBotox = botoxPayments.filter((p) => String(p.data_pagamento).slice(0, 7) === key);
    const value = revenueTotal(monthRec, monthBotox);
    return { key, label: formatMonthLabel(key), value };
  });

  const salesByStatus = buildSalesByStatus(recebimentos, quotesFiltered);

  const botoxByProf = new Map();
  for (const p of botoxPayments) {
    /* programa lookup skipped — revenue already in total */
  }

  const branchComparison = buildBranchMetrics(
    branches,
    profBranchMap,
    apptsFiltered,
    evalsFiltered,
    quotesFiltered,
    recebimentos,
    insumos,
    botoxByProf
  );
  const branchRanking = [...branchComparison].sort((a, b) => b.revenue - a.revenue);

  return {
    counts: {
      appointments: apptsFiltered.length,
      appointmentsToday: apptsToday,
      evaluations: evalsFiltered.length,
      closings,
      revenue,
      expenses,
      ticketMedio: ticket,
    },
    conversion: conv,
    topTreatment,
    topTreatments,
    salesEvolution,
    salesByStatus,
    branchComparison,
    branchRanking,
    raw: { apptsFiltered, evalsFiltered, quotesFiltered, recebimentos, insumos },
  };
}

export async function buildClinicMasterDashboard(ctx, request) {
  const parsed = parseFilters(new URL(request.url));
  if (parsed.error) return { error: parsed.error, status: parsed.status };

  const { admin, organizationId, organization, ownerUserId } = ctx;
  const filters = parsed.filters;

  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', ownerUserId)
    .maybeSingle();

  const { data: branchesRaw, error: bErr } = await admin
    .from('organization_branches')
    .select('id, name, is_active')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (bErr) throw new Error(bErr.message);
  const branches = (branchesRaw ?? []).map((b) => ({ id: String(b.id), name: String(b.name) }));

  const { teamUserIds, profBranchMap, profNameMap } = await loadTeam(admin, organizationId);
  const avaliacaoId = await loadAvaliacaoProcedureId(admin);

  const branchNameMap = new Map(branches.map((b) => [b.id, b.name]));

  const current = await aggregatePeriod(
    admin,
    ctx,
    filters,
    teamUserIds,
    profBranchMap,
    profNameMap,
    avaliacaoId,
    branches
  );
  if (!current) {
    return { error: 'Profissional não pertence à clínica.', status: 403 };
  }

  const prevRange = previousPeriod(filters.dataInicio, filters.dataFim);
  const previous = await aggregatePeriod(
    admin,
    ctx,
    { ...filters, ...prevRange },
    teamUserIds,
    profBranchMap,
    profNameMap,
    avaliacaoId,
    branches
  );

  const c = current.counts;
  const p = previous?.counts || {
    appointments: 0,
    evaluations: 0,
    closings: 0,
    revenue: 0,
    expenses: 0,
    ticketMedio: 0,
  };

  const kpis = {
    appointments: {
      total: c.appointments,
      today: c.appointmentsToday,
      comparison: computeComparison(c.appointments, p.appointments),
    },
    evaluations: {
      total: c.evaluations,
      comparison: computeComparison(c.evaluations, p.evaluations),
    },
    closings: {
      total: c.closings,
      comparison: computeComparison(c.closings, p.closings),
    },
    revenue: {
      total: c.revenue,
      comparison: computeComparison(c.revenue, p.revenue),
    },
    expenses: {
      total: c.expenses,
      comparison: computeComparison(c.expenses, p.expenses),
    },
    ticketMedio: {
      total: c.ticketMedio,
      comparison: computeComparison(c.ticketMedio, p.ticketMedio),
    },
  };

  const goalProgress = { hasGoal: false, target: null, achieved: c.revenue, percent: null };

  const insights = buildInsights(kpis, current.conversion, current.branchRanking, goalProgress);

  const closingsDetail = [
    ...current.raw.quotesFiltered.filter((q) => q.status === 'accepted'),
    ...current.raw.recebimentos.filter((r) => r.status === 'pago'),
  ];

  return {
    organization: { id: organizationId, name: organization.name },
    user: { id: ownerUserId, name: String(ownerProfile?.full_name || 'Master') },
    branches,
    filters,
    kpis,
    conversion: {
      ...current.conversion,
      formula: 'Fechamentos ÷ Avaliações × 100 (fechamentos = orçamentos aceitos + recebimentos pagos)',
    },
    topTreatment: current.topTreatment,
    topTreatments: current.topTreatments,
    salesEvolution: current.salesEvolution,
    salesByStatus: current.salesByStatus,
    branchComparison: current.branchComparison,
    branchRanking: current.branchRanking,
    goalProgress,
    insights,
    details: {
      appointments: mapDetailRows('appointments', current.raw.apptsFiltered, profNameMap, branchNameMap, profBranchMap),
      evaluations: mapDetailRows('evaluations', current.raw.evalsFiltered, profNameMap, branchNameMap, profBranchMap),
      closings: mapDetailRows('closings', closingsDetail, profNameMap, branchNameMap, profBranchMap),
      revenue: mapDetailRows('revenue', current.raw.recebimentos, profNameMap, branchNameMap, profBranchMap),
      expenses: mapDetailRows('expenses', current.raw.insumos, profNameMap, branchNameMap, profBranchMap),
    },
    generatedAt: new Date().toISOString(),
  };
}
