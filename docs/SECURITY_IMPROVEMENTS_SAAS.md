# Melhorias de Segurança SaaS — CliniEvo

Implementações aplicadas para produção (rate limit, brute force, auditoria, validação, headers, slug).

---

## 1. Rate limit (API)

- **Arquivo:** `api/lib/rateLimit.js`
- **Comportamento:**
  - **global:** 100 req/min/IP
  - **admin:** 30 req/min/IP
  - **auth:** 30 req/min/IP
  - **email:** 5 req/hora/IP (recovery)
  - **chatbot:** 60 req/min/IP
- **Store:** Upstash Redis (REST) quando configurado; senão memória no isolate.
- **Resposta 429:** headers `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After`.
- **Backend Express (`backend/src/middleware/rateLimit.js`):** 100 req/min/IP (webhook WhatsApp: 300/min).

**Configuração (recomendado em produção):** criar banco no [Upstash](https://console.upstash.com) e definir `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` na Vercel.

---

## 2. Proteção contra brute force (login)

- **Endpoint:** `POST /api/auth/log-attempt` — body: `{ success: boolean }` ou `{ checkOnly: true }`.
- **Comportamento:**
  - Rate limit auth: 30 req/min por IP.
  - **5 falhas em 15 minutos** no mesmo IP → **429** até expirar a janela.
  - Sucesso limpa o contador do IP.
  - `checkOnly` permite o frontend bloquear *antes* de chamar o Supabase Auth.
- **Frontend:** `AuthContext.signIn` faz check prévio + registra falha/sucesso (respeitando 429).
- **Nota:** ataques diretos ao endpoint Auth do Supabase ainda devem ser limitados no painel Supabase (Auth → Rate Limits).

Depende de Redis em multi-instance; sem Redis o lockout vale por isolate.

---

## 3. Validação de entrada (Zod)

- **Arquivo:** `api/lib/schemas.js`
- **Schemas:**
  - `adminCreateUserSchema`: email (obrigatório, formato, max 255), password (8–512), full_name (opcional, max 200).
  - `authLogAttemptSchema`: `success` boolean **ou** `checkOnly: true`.
  - `auditSchema`: action, entity, entity_id opcional, details opcional.
- **Limite de payload:** 10 KB por requisição (evita payloads enormes).
- **Uso:** `parseBody(request, schema)` consome o body, valida com Zod e retorna `{ data }` ou `{ error, status }`. Usado em `api/admin/users.js`, `api/auth/log-attempt.js` e `api/audit.js`.

---

## 4. Admin apenas por variável de ambiente

- **Variável:** `ADMIN_EMAIL` (obrigatória em produção para `POST /api/admin/users`).
- **Comportamento:** Se `ADMIN_EMAIL` não estiver definida, a API retorna **500** com mensagem clara. Nenhum fallback hardcoded.
- **Documentação:** `.env.example` descreve a variável e avisa para não expor service role no frontend.

---

## 5. Links públicos (slug de PDF)

- **Antes:** 6 caracteres, alfabeto 32.
- **Agora:** **10 caracteres**, mesmo alfabeto (`abcdefghjkmnpqrstuvwxyz23456789`), maior entropia e mais difícil enumeração.
- **Arquivo:** `src/pages/ProcedureInstanceDetailPage.tsx` (geração do slug antes do insert em `evolution_pdf_links`).

---

## 6. Headers de segurança

Configurados em `vercel.json`:

| Header | Valor |
|--------|--------|
| X-Frame-Options | SAMEORIGIN |
| X-Content-Type-Options | nosniff |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | camera=(), microphone=(), geolocation=() |
| Content-Security-Policy | default-src 'self'; script-src/style-src/connect-src/img-src etc. |
| **Strict-Transport-Security** | max-age=31536000; includeSubDomains; preload |

HSTS reforça uso de HTTPS e reduz risco de downgrade.

---

## 7. XSS e conteúdo do usuário

- **Revisão:** O único uso de `dangerouslySetInnerHTML` está em `src/components/ui/chart.tsx`, com conteúdo **estático** (tema/cores), não controlado pelo usuário.
- **Recomendação:** Se no futuro houver renderização de HTML vindo do usuário (ex.: observações, termos), usar **DOMPurify** (ou equivalente) antes de injetar no DOM. Exemplo: `import DOMPurify from 'dompurify'; __html: DOMPurify.sanitize(userContent)`.

Nenhuma alteração de código foi feita para XSS além desta recomendação.

---

## 8. Auditoria (audit_logs)

- **Tabela:** `supabase/migrations/20260309100000_audit_logs.sql`
  - Campos: `id`, `user_id`, `action`, `entity`, `entity_id`, `ip`, `user_agent`, `details`, `created_at`.
  - RLS: usuário lê apenas seus próprios registros; admin lê todos. Inserção apenas via **service role** (APIs serverless).
- **Inserção:**
  - **Login:** `api/auth/log-attempt.js` → action `login_success` ou `login_failure`, entity `auth`.
  - **Criação de usuário (admin):** `api/admin/users.js` → action `user_created`, entity `user`, details com email e admin.
  - **PDF gerado:** frontend chama `POST /api/audit` com Bearer token → action `pdf_generated`, entity `procedure_instance`, entity_id = instanceId.
- **Endpoint de auditoria:** `POST /api/audit` — requer Authorization Bearer; body: `{ action, entity, entity_id?, details? }`. Rate limited. Use para registrar outras ações sensíveis (ex.: exclusões) a partir do frontend.

---

## 9. Dependências

- Executar **`npm audit fix`** (e, se necessário, `npm audit fix --force` em ambiente de teste para correções breaking).
- Manter React Router e demais dependências atualizadas conforme avisos de segurança.

---

## 10. Melhorias de arquitetura (multi-tenant + Supabase/RLS)

- **RLS:** Manter uma política por tabela sensível; sempre filtrar por `auth.uid()` ou por role (ex.: admin por e-mail) e evitar `USING (true)` em tabelas com dados sensíveis.
- **Service role:** Usar apenas em serverless (APIs); nunca em variáveis `VITE_*` ou no bundle do cliente.
- **Admin:** Manter `ADMIN_EMAIL` somente em env; considerar no futuro uma tabela `admin_emails` ou role no Supabase para múltiplos admins sem redeploy.
- **Auditoria:** Revisar periodicamente `audit_logs` e integrar com alertas (ex.: muitas falhas de login, criação de usuários em massa).
- **Rate limit:** Com Upstash, considerar limites diferentes por rota (ex.: mais restritivo em `/api/admin/users`, mais folgado em `/api/audit`).
- **Sessão:** Avaliar migrar tokens para cookies **httpOnly** no futuro para reduzir superfície de XSS sobre o token.

---

## Resumo dos arquivos criados/alterados

| Arquivo | Alteração |
|---------|-----------|
| `api/lib/rateLimit.js` | Novo — rate limit por IP (Upstash) |
| `api/lib/auditLog.js` | Novo — inserção em audit_logs |
| `api/lib/schemas.js` | Novo — Zod + parseBody |
| `api/admin/users.js` | Rate limit, Zod, audit log, ADMIN_EMAIL obrigatório |
| `api/auth/log-attempt.js` | Novo — log de login + brute force |
| `api/audit.js` | Novo — POST /api/audit para o frontend |
| `supabase/migrations/20260309100000_audit_logs.sql` | Novo — tabela audit_logs |
| `vercel.json` | Header Strict-Transport-Security |
| `src/contexts/AuthContext.tsx` | Chamada a /api/auth/log-attempt após login |
| `src/pages/ProcedureInstanceDetailPage.tsx` | Slug 10 chars, chamada a /api/audit após PDF |
| `.env.example` | Upstash, ADMIN_EMAIL e orientações de segredos |
