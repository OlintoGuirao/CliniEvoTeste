/**
 * Cria filial + login (atendente) vinculado à unidade.
 */

function formatBranchError(message) {
  const msg = String(message || '');
  if (msg.includes('organization_branches_org_name_unique') || msg.includes('duplicate key')) {
    return 'Já existe uma filial com este nome nesta clínica. Escolha outro nome.';
  }
  if (msg.includes('already') || msg.includes('registered')) {
    return 'Este e-mail já está cadastrado.';
  }
  return msg || 'Não foi possível criar a filial.';
}

async function waitForProfile(admin, userId) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data: profileRow } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (profileRow?.id) return;
    await new Promise((r) => setTimeout(r, 150));
  }
}

async function attachBranchLogin(admin, organizationId, branchId, login, orgType = 'clinic') {
  const { data, error } = await admin.auth.admin.createUser({
    email: login.email,
    password: login.password,
    email_confirm: true,
    user_metadata: { full_name: login.full_name },
  });

  if (error) {
    const msg = error.message || 'Erro ao criar login da filial';
    throw new Error(formatBranchError(msg));
  }

  const userId = data?.user?.id;
  if (!userId) throw new Error('Login criado sem ID.');

  await waitForProfile(admin, userId);
  await admin.from('organization_members').delete().eq('user_id', userId);

  const { error: addErr } = await admin.rpc('add_clinic_member', {
    p_organization_id: organizationId,
    p_user_id: userId,
    p_branch_id: branchId,
    p_role: 'attendant',
  });

  if (addErr) {
    const { error: legacyErr } = await admin.rpc('add_clinic_professional', {
      p_organization_id: organizationId,
      p_user_id: userId,
      p_branch_id: branchId,
    });
    if (legacyErr) {
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      throw new Error(formatBranchError(addErr.message || legacyErr.message));
    }
  }

  const accountType = orgType === 'salon' ? 'salon' : 'clinic';
  await admin
    .from('profiles')
    .update({ full_name: login.full_name, account_type: accountType })
    .eq('id', userId);

  return { user_id: userId, email: login.email };
}

export async function createBranchWithLogin(
  admin,
  organizationId,
  { name, address, phone, login_full_name, login_email, login_password, accent_color }
) {
  const trimmedName = String(name || '').trim();
  if (trimmedName.length < 2) throw new Error('Nome da filial é obrigatório.');

  const login = {
    full_name: String(login_full_name || '').trim(),
    email: String(login_email || '').trim(),
    password: String(login_password || ''),
  };
  if (login.full_name.length < 2) throw new Error('Nome do responsável é obrigatório.');
  if (!login.email) throw new Error('E-mail do login é obrigatório.');
  if (login.password.length < 8) throw new Error('Senha deve ter no mínimo 8 caracteres.');

  const { data: existing } = await admin
    .from('organization_branches')
    .select('id, name')
    .eq('organization_id', organizationId)
    .ilike('name', trimmedName)
    .maybeSingle();

  if (existing?.id) {
    throw new Error('Já existe uma filial com este nome nesta clínica. Escolha outro nome.');
  }

  const { data: branchId, error: branchErr } = await admin.rpc('create_organization_branch', {
    p_organization_id: organizationId,
    p_name: trimmedName,
    p_address: address ? String(address).trim() : null,
    p_phone: phone ? String(phone).trim() : null,
  });

  if (branchErr) throw new Error(formatBranchError(branchErr.message));

  const { data: orgRow } = await admin
    .from('organizations')
    .select('type')
    .eq('id', organizationId)
    .maybeSingle();
  const orgType = orgRow?.type === 'salon' ? 'salon' : 'clinic';

  try {
    const loginResult = await attachBranchLogin(admin, organizationId, branchId, login, orgType);
    const brandingPatch = {};
    if (accent_color && /^#[0-9A-Fa-f]{6}$/.test(String(accent_color))) {
      brandingPatch.accent_color = String(accent_color);
    }
    if (Object.keys(brandingPatch).length > 0) {
      await admin.from('organization_branches').update(brandingPatch).eq('id', branchId);
    }
    const { data: branch, error: fetchErr } = await admin
      .from('organization_branches')
      .select('*')
      .eq('id', branchId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    return { branch, login: loginResult };
  } catch (err) {
    await admin.from('organization_branches').delete().eq('id', branchId);
    throw err;
  }
}

export { formatBranchError };
