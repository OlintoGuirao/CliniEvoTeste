const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@clinievo.com.br').trim();

/**
 * Valida o token chamando a API de Auth do Supabase (não precisa de JWT Secret).
 * Permite acesso apenas se o usuário autenticado for o admin.
 */
export async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não informado. Faça login novamente.' });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Token não informado. Faça login novamente.' });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl) {
    console.error('SUPABASE_URL ou VITE_SUPABASE_URL não configurado');
    return res.status(500).json({ error: 'Configuração do servidor inválida' });
  }
  if (!supabaseAnonKey) {
    console.error('VITE_SUPABASE_ANON_KEY ou VITE_SUPABASE_PUBLISHABLE_KEY não configurado');
    return res.status(500).json({ error: 'Configuração do servidor inválida' });
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.email) {
      if (response.status === 401 || data?.msg === 'Invalid Refresh Token' || data?.error === 'invalid_token') {
        return res.status(401).json({ error: 'Token expirado ou inválido. Faça login novamente.' });
      }
      return res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
    }

    const email = String(data.email).trim();
    if (email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Acesso restrito ao administrador' });
    }

    req.adminEmail = email;
    next();
  } catch (err) {
    console.error('requireAdmin:', err);
    return res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
  }
}
