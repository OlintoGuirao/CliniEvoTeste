/**
 * Remove membro da clínica e apaga o login (sem acesso algum).
 * Master (owner) não pode ser removido por esta função.
 */

export async function removeClinicMemberWithCleanup(admin, organizationId, userId, ownerUserId) {
  const id = String(userId || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new Error('ID de usuário inválido.');
  }
  if (id === ownerUserId) {
    throw new Error('Você não pode remover a si mesmo (Master).');
  }

  const { data: membership, error: mErr } = await admin
    .from('organization_members')
    .select('id, role')
    .eq('organization_id', organizationId)
    .eq('user_id', id)
    .maybeSingle();

  if (mErr) throw new Error(mErr.message);
  if (!membership) throw new Error('Membro não encontrado nesta clínica.');
  if (membership.role === 'owner') {
    throw new Error('Não é possível remover o Master da clínica.');
  }

  const { error: delMemErr } = await admin
    .from('organization_members')
    .delete()
    .eq('organization_id', organizationId)
    .eq('user_id', id);

  if (delMemErr) throw new Error(delMemErr.message);

  // Remove org solo órfã, se existir (legado do fluxo antigo que convertia em profissional único)
  const { data: leftoverOrgs } = await admin
    .from('organization_members')
    .select('organization_id, organizations!inner(id, type)')
    .eq('user_id', id);

  for (const row of leftoverOrgs || []) {
    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    if (org?.type !== 'solo') continue;
    await admin.from('organization_members').delete().eq('user_id', id).eq('organization_id', org.id);
    await admin.from('organizations').delete().eq('id', org.id);
  }

  const { error: authDelErr } = await admin.auth.admin.deleteUser(id);
  if (authDelErr) {
    throw new Error(authDelErr.message || 'Não foi possível excluir o login do membro.');
  }

  return { ok: true, user_id: id };
}
