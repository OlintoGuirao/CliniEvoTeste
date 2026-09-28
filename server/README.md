# API Admin CliniEvo

Servidor Express usado pelo painel de permissões de procedimentos por perfil.

## Configuração

1. Copie `.env.example` para `.env`.
2. Preencha:
   - `SUPABASE_URL`: URL do projeto Supabase
   - `SUPABASE_SERVICE_ROLE_KEY`: chave service role (Project Settings > API)
   - `SUPABASE_JWT_SECRET`: JWT Secret (Project Settings > API > JWT Secret)
   - `PORT`: porta (padrão 3001)
   - `ADMIN_EMAIL`: email do admin (padrão admin@clinievo.com.br)

## Execução

- `npm run server` – inicia o servidor
- `npm run server:dev` – inicia com reload ao alterar arquivos

O frontend (Vite) está configurado com proxy `/api` → `http://localhost:3001`. Em desenvolvimento, suba o servidor e o app com `npm run dev`.

## Rotas

- `GET /admin/procedure-permissions` – retorna profiles, procedures e permissions (requer Bearer JWT do admin).
- `POST /admin/procedure-permissions` – body `{ profileId, procedureId, visible }`, faz upsert (requer Bearer JWT do admin).

Apenas o usuário com email igual a `ADMIN_EMAIL` pode acessar essas rotas.
