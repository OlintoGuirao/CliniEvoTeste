import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function requireSalonOwner(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não informado. Faça login novamente.' });
  }
  const token = authHeader.slice(7).trim();
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Configuração do servidor inválida' });
  }

  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    const userData = await userRes.json().catch(() => ({}));
    if (!userRes.ok || !userData?.id) {
      return res.status(401).json({ error: 'Token expirado ou inválido. Faça login novamente.' });
    }

    const admin = getAdminClient();
    const { data: membership, error } = await admin
      .from('organization_members')
      .select('organization_id, role, organizations!inner(id, name, type)')
      .eq('user_id', userData.id)
      .eq('role', 'owner')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    const org = membership?.organizations;
    const orgRow = Array.isArray(org) ? org[0] : org;
    if (!membership?.organization_id || orgRow?.type !== 'salon') {
      return res.status(403).json({ error: 'Acesso restrito ao Admin do salão.' });
    }

    req.salon = {
      admin,
      ownerUserId: String(userData.id),
      organizationId: String(membership.organization_id),
      organization: {
        id: String(orgRow.id),
        name: String(orgRow.name || 'Salão'),
        type: 'salon',
      },
    };
    next();
  } catch (err) {
    console.error('requireSalonOwner:', err);
    return res.status(401).json({ error: 'Não autorizado.' });
  }
}

router.use(requireSalonOwner);

const SELECT =
  'id, organization_id, name, description, is_active, created_at, updated_at';

router.get('/procedures', async (req, res) => {
  try {
    const { admin, organizationId, organization } = req.salon;
    const { data, error } = await admin
      .from('salon_procedures')
      .select(SELECT)
      .eq('organization_id', organizationId)
      .order('name', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ organization, procedures: data || [] });
  } catch (err) {
    console.error('salon procedures list:', err);
    return res.status(500).json({ error: err.message || 'Erro ao listar procedimentos' });
  }
});

router.post('/procedures', async (req, res) => {
  try {
    const { admin, organizationId } = req.salon;
    const name = String(req.body?.name || '').trim();
    const description = req.body?.description != null ? String(req.body.description).trim() : null;
    if (name.length < 2) {
      return res.status(400).json({ error: 'Nome do procedimento é obrigatório (mín. 2 caracteres).' });
    }

    const { data, error } = await admin
      .from('salon_procedures')
      .insert({
        organization_id: organizationId,
        name,
        description: description || null,
        is_active: true,
      })
      .select(SELECT)
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ procedure: data });
  } catch (err) {
    console.error('salon procedures create:', err);
    return res.status(500).json({ error: err.message || 'Erro ao criar procedimento' });
  }
});

router.put('/procedures/:id', async (req, res) => {
  try {
    const { admin, organizationId } = req.salon;
    const id = String(req.params.id || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const payload = {};
    if (req.body?.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (name.length < 2) {
        return res.status(400).json({ error: 'Nome do procedimento é obrigatório (mín. 2 caracteres).' });
      }
      payload.name = name;
    }
    if (req.body?.description !== undefined) {
      const description = String(req.body.description || '').trim();
      payload.description = description || null;
    }
    if (req.body?.is_active !== undefined) {
      payload.is_active = Boolean(req.body.is_active);
    }
    if (!Object.keys(payload).length) {
      return res.status(400).json({ error: 'Nada para atualizar.' });
    }

    const { data, error } = await admin
      .from('salon_procedures')
      .update(payload)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select(SELECT)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Procedimento não encontrado.' });
    return res.json({ procedure: data });
  } catch (err) {
    console.error('salon procedures update:', err);
    return res.status(500).json({ error: err.message || 'Erro ao atualizar procedimento' });
  }
});

router.delete('/procedures/:id', async (req, res) => {
  try {
    const { admin, organizationId } = req.salon;
    const id = String(req.params.id || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return res.status(400).json({ error: 'ID inválido.' });
    }

    const { data, error } = await admin
      .from('salon_procedures')
      .update({ is_active: false })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select(SELECT)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Procedimento não encontrado.' });
    return res.json({ procedure: data });
  } catch (err) {
    console.error('salon procedures delete:', err);
    return res.status(500).json({ error: err.message || 'Erro ao remover procedimento' });
  }
});

export default router;
