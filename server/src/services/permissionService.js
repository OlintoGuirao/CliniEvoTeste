import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY são obrigatórios. ' +
    'Adicione no .env na raiz do projeto ou em server/.env. ' +
    'Service role key: Supabase Dashboard → Project Settings → API → service_role (secret).'
  );
}

/** Cliente Supabase com service role (bypass RLS) para uso no backend. */
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

/**
 * Retorna profiles, procedures e permissions para o painel admin.
 * @returns {{ profiles: Array, procedures: Array, permissions: Array }}
 */
export async function getProfilesProceduresPermissions() {
  const [profilesRes, proceduresRes, permissionsRes] = await Promise.all([
    supabase.from('profiles').select('id, email, full_name').order('full_name'),
    supabase.from('procedures').select('id, name, slug, category').eq('is_active', true).order('category').order('name'),
    supabase.from('profile_procedure_permissions').select('id, profile_id, procedure_id, visible'),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (proceduresRes.error) throw new Error(proceduresRes.error.message);
  if (permissionsRes.error) throw new Error(permissionsRes.error.message);

  return {
    profiles: profilesRes.data ?? [],
    procedures: proceduresRes.data ?? [],
    permissions: permissionsRes.data ?? [],
  };
}

/**
 * Upsert de uma permissão (profile_id, procedure_id, visible).
 * @param {{ profileId: string, procedureId: string, visible: boolean }} body
 */
export async function upsertPermission({ profileId, procedureId, visible }) {
  const { data, error } = await supabase
    .from('profile_procedure_permissions')
    .upsert(
      {
        profile_id: profileId,
        procedure_id: procedureId,
        visible: visible === true,
      },
      {
        onConflict: 'profile_id,procedure_id',
      }
    )
    .select('id, profile_id, procedure_id, visible')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Cria um novo usuário via Auth Admin API (não altera a sessão do cliente).
 * @param {{ email: string, password: string, full_name: string, account_type?: 'solo'|'clinic'|'salon', organization_name?: string|null }}
 */
export async function createUser({
  email,
  password,
  full_name,
  account_type = 'solo',
  organization_name = null,
}) {
  const accountType =
    account_type === 'clinic' ? 'clinic' : account_type === 'salon' ? 'salon' : 'solo';
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name || null, account_type: accountType },
  });
  if (error) throw new Error(error.message);

  const userId = data?.user?.id;
  if (userId) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { data: profileRow } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
      if (profileRow?.id) break;
      await new Promise((r) => setTimeout(r, 150));
    }

    const orgName =
      organization_name ||
      (accountType === 'clinic' || accountType === 'salon' ? full_name : null) ||
      full_name ||
      email;
    const { error: orgError } = await supabase.rpc('ensure_profile_organization', {
      p_user_id: userId,
      p_account_type: accountType,
      p_org_name: orgName,
    });
    if (orgError) {
      const { error: updError } = await supabase
        .from('profiles')
        .update({ account_type: accountType })
        .eq('id', userId);
      if (updError) {
        const hint =
          accountType === 'salon'
            ? ' Aplique as migrations do tipo salon no Supabase (20260830120000 e 20260830120100).'
            : '';
        throw new Error(
          (updError.message || orgError.message || 'Não foi possível definir o tipo de conta.') + hint
        );
      }
    }

    const { data: verify } = await supabase
      .from('profiles')
      .select('account_type')
      .eq('id', userId)
      .maybeSingle();
    if (verify && verify.account_type !== accountType) {
      throw new Error(
        accountType === 'salon'
          ? 'Tipo salon não gravou no banco. Aplique as migrations 20260830120000 e 20260830120100 no Supabase.'
          : `Tipo de conta esperado "${accountType}", mas ficou "${verify.account_type}".`
      );
    }
  }

  return { ...data, account_type: accountType };
}

/**
 * Define uma nova senha manualmente para um usuário (admin).
 * @param {{ userId: string, password: string }} body
 */
export async function setUserPassword({ userId, password }) {
  const { data, error } = await supabase.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(error.message);
  return data;
}
