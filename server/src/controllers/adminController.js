import * as permissionService from '../services/permissionService.js';

/**
 * POST /admin/users
 * Body: { email, password, full_name }
 * Cria usuário via Auth Admin (não faz login no novo usuário).
 */
export async function createUser(req, res) {
  try {
    const { email, password, full_name, account_type, organization_name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
    }
    const accountType =
      account_type === 'clinic' ? 'clinic' : account_type === 'salon' ? 'salon' : 'solo';
    const data = await permissionService.createUser({
      email: String(email).trim(),
      password: String(password),
      full_name: full_name ? String(full_name).trim() : null,
      account_type: accountType,
      organization_name: organization_name ? String(organization_name).trim() : null,
    });
    res.status(201).json(data);
  } catch (err) {
    console.error('createUser:', err);
    if (err.message?.includes('already') || err.message?.includes('registered')) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    }
    res.status(500).json({ error: err.message || 'Erro ao criar perfil' });
  }
}

/**
 * POST /admin/set-password
 * Body: { user_id, password }
 * Redefine senha manualmente (sem e-mail).
 */
export async function setPassword(req, res) {
  try {
    const { user_id, password } = req.body;
    if (!user_id || !password) {
      return res.status(400).json({ error: 'user_id e password são obrigatórios' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 8 caracteres' });
    }
    const data = await permissionService.setUserPassword({
      userId: String(user_id).trim(),
      password: String(password),
    });
    res.json({ ok: true, user_id: String(user_id).trim(), data });
  } catch (err) {
    console.error('setPassword:', err);
    res.status(500).json({ error: err.message || 'Erro ao atualizar senha' });
  }
}

/**
 * GET /admin/procedure-permissions
 * Retorna profiles, procedures e permissions.
 */
export async function getProcedurePermissions(req, res) {
  try {
    const data = await permissionService.getProfilesProceduresPermissions();
    res.json(data);
  } catch (err) {
    console.error('getProcedurePermissions:', err);
    res.status(500).json({ error: err.message || 'Erro ao carregar permissões' });
  }
}

/**
 * POST /admin/procedure-permissions
 * Body: { profileId, procedureId, visible }
 * Faz upsert da permissão.
 */
export async function postProcedurePermission(req, res) {
  try {
    const { profileId, procedureId, visible } = req.body;
    if (!profileId || !procedureId) {
      return res.status(400).json({ error: 'profileId e procedureId são obrigatórios' });
    }
    const row = await permissionService.upsertPermission({
      profileId,
      procedureId,
      visible: visible === true,
    });
    res.json(row);
  } catch (err) {
    console.error('postProcedurePermission:', err);
    res.status(500).json({ error: err.message || 'Erro ao salvar permissão' });
  }
}
