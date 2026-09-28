/**
 * Remove dependências com ON DELETE RESTRICT / vínculos de org
 * antes de apagar o usuário no Auth (cascata do profile).
 */

export async function deleteUserWithCleanup(admin, userId) {
  const id = String(userId || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new Error('ID de usuário inválido.');
  }

  // recebimentos.profissional_id e recebimentos.cliente_id são ON DELETE RESTRICT
  const { data: patientRows, error: patientsErr } = await admin
    .from('patients')
    .select('id')
    .eq('professional_id', id);
  if (patientsErr && !/column|does not exist/i.test(patientsErr.message || '')) {
    throw new Error(patientsErr.message);
  }
  const patientIds = (patientRows || []).map((p) => p.id).filter(Boolean);

  if (patientIds.length) {
    const { error: recByClientErr } = await admin
      .from('recebimentos')
      .delete()
      .in('cliente_id', patientIds);
    if (recByClientErr && !/policy|permission|RLS/i.test(recByClientErr.message || '')) {
      // service role deve passar; se falhar, reporta
      throw new Error(
        `Não foi possível remover recebimentos do cliente: ${recByClientErr.message}`
      );
    }
  }

  const { error: recByProErr } = await admin.from('recebimentos').delete().eq('profissional_id', id);
  if (recByProErr) {
    throw new Error(`Não foi possível remover recebimentos do profissional: ${recByProErr.message}`);
  }

  // Agenda recorrente de salão referencia salon_procedures com RESTRICT — limpa antes
  await admin.from('salon_patient_recurring_schedules').delete().eq('professional_id', id);

  // Vínculos de organização
  const { data: memberships } = await admin
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', id);

  const orgIds = [...new Set((memberships || []).map((m) => m.organization_id).filter(Boolean))];

  await admin.from('organization_members').delete().eq('user_id', id);

  // Solta profiles.organization_id para não travar exclusão da org
  await admin.from('profiles').update({ organization_id: null }).eq('id', id);

  for (const orgId of orgIds) {
    const { count } = await admin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId);

    if ((count ?? 0) === 0) {
      // Filiais / settings caem em CASCADE da organization
      await admin.from('organizations').delete().eq('id', orgId);
    }
  }

  const { error: authDelErr } = await admin.auth.admin.deleteUser(id);
  if (authDelErr) {
    throw new Error(authDelErr.message || 'Erro ao excluir usuário no Auth.');
  }

  return { ok: true, user_id: id };
}
