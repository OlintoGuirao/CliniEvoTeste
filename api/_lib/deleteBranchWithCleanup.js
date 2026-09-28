/**
 * Exclui filial da clínica e remove logins de atendentes vinculados à unidade.
 */

export async function deleteBranchWithCleanup(admin, organizationId, branchId) {
  const id = String(branchId || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new Error('ID da filial inválido.');
  }

  const { data: branch, error: findErr } = await admin
    .from('organization_branches')
    .select('id, name, organization_id')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message);
  if (!branch) throw new Error('Filial não encontrada.');

  const { count, error: countErr } = await admin
    .from('organization_branches')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  if (countErr) throw new Error(countErr.message);
  const isLastBranch = (count ?? 0) <= 1;

  const { data: members, error: memErr } = await admin
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', organizationId)
    .eq('branch_id', id);

  if (memErr) throw new Error(memErr.message);

  const professionals = (members ?? []).filter((m) => m.role === 'professional');
  if (professionals.length > 0) {
    throw new Error(
      'Esta filial ainda tem profissionais vinculados. Remova-os em Equipe antes de excluir.'
    );
  }

  for (const member of members ?? []) {
    if (member.role !== 'attendant') continue;

    const { error: memberDelErr } = await admin
      .from('organization_members')
      .delete()
      .eq('organization_id', organizationId)
      .eq('user_id', member.user_id);

    if (memberDelErr) throw new Error(memberDelErr.message);

    const { error: authDelErr } = await admin.auth.admin.deleteUser(member.user_id);
    if (authDelErr) {
      throw new Error(
        authDelErr?.message || 'Não foi possível remover o login da filial.'
      );
    }
  }

  const { error: delErr } = await admin
    .from('organization_branches')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId);

  if (delErr) throw new Error(delErr.message);

  if (isLastBranch) {
    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .maybeSingle();
    if (orgErr) throw new Error(orgErr.message);

    const matrizName = String(org?.name || '').trim() || 'Matriz';
    const { error: recreateErr } = await admin.rpc('create_organization_branch', {
      p_organization_id: organizationId,
      p_name: matrizName,
      p_address: null,
      p_phone: null,
    });
    if (recreateErr) throw new Error(recreateErr.message);
  }

  return { ok: true, deleted_branch_id: id, name: branch.name, recreated_matriz: isLastBranch };
}
