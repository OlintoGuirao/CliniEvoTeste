# Auditoria de Segurança — CliniEvo SaaS

**Stack:** React (Vite), Node.js (Vercel serverless), Supabase (PostgreSQL), Vercel.  
**Data:** Março 2025.

---

## Resumo executivo

| Nível   | Quantidade |
|---------|------------|
| Crítico | 0         |
| Alto    | 3         |
| Médio   | 6         |
| Baixo   | 5         |

A aplicação usa Supabase com RLS de forma consistente, não expõe a service role key no frontend e protege rotas no cliente. Os pontos mais sensíveis são: **headers de segurança ausentes**, **validação de entrada na API serverless** e **admin definido por e-mail fixo**. Abaixo estão os achados e as correções aplicadas ou recomendadas.

---

## 1. Autenticação e autorização

### 1.1 Endpoints sem autenticação

- **Rotas públicas intencionais:** `/auth`, `/auth/signup`, `/conta-bloqueada`, `/r`, `/r/:slug`, `/ver-resumo/:slug`.
- **API:** `POST /api/admin/users` exige `Authorization: Bearer <token>` e valida o usuário via Supabase Auth; apenas o e-mail configurado como admin pode criar usuários.
- **Supabase:** O frontend usa apenas a chave **anon** (`VITE_SUPABASE_PUBLISHABLE_KEY`). A **service role** é usada somente em `api/admin/users.js` via `process.env.SUPABASE_SERVICE_ROLE_KEY` (nunca em variáveis `VITE_*`).

**Risco:** Baixo. Controle de acesso está coerente com o desenho atual.

### 1.2 Controle de acesso (Broken Access Control)

- **Frontend:** Rotas protegidas ficam sob `BlockedUserGuard` e `AppLayout`; usuários não autenticados são redirecionados.
- **Backend:** Supabase RLS garante que cada usuário acesse apenas seus próprios dados (por exemplo `professional_id = auth.uid()` em `patients`). O painel admin (profiles, permissions, stats) usa políticas que restringem por `auth.jwt() ->> 'email' = 'admin@clinievo.com.br'`.
- **IDOR:** Acesso a dados de outros usuários só é possível se o RLS falhar ou se um ID alheio for enviado; o RLS está ativo nas tabelas analisadas. O link público de PDF (`/r/:slug`) usa slug aleatório (6 caracteres de alfabeto 32) e política `SELECT ... USING (true)` apenas para leitura por slug; o risco é enumeração de slugs (mitigado pela entropia do slug).

**Risco:** Médio para o link de PDF (slug adivinhável em teoria); Baixo para o restante.

### 1.3 Validação de JWT e expiração

- O Supabase client usa `autoRefreshToken: true` e a sessão é validada no servidor em `/api/admin/users` via `GET ${SUPABASE_URL}/auth/v1/user` com o Bearer token.
- Expiração e refresh são tratados pelo Supabase (JWT padrão).

**Risco:** Baixo. Recomendação: manter tempo de sessão e refresh conforme política de segurança (ex.: 1h access, 7d refresh).

### 1.4 Token replay

- Não há mecanismo adicional anti-replay além do que o Supabase já oferece (expiração, uso de token único). Em cenários de alto risco, considerar curto tempo de vida do access token.

**Risco:** Baixo.

---

## 2. Segurança da API

### 2.1 SQL / NoSQL / Command Injection

- Não há SQL ou comandos de sistema montados a partir de entrada do usuário no código analisado. Supabase client usa queries parametrizadas.
- **Conclusão:** Sem indício de SQL/NoSQL/Command Injection.

### 2.2 Mass assignment

- `POST /api/admin/users` aceita apenas `email`, `password` e `full_name` (extração explícita no código). Não há passagem direta de `body` para o backend.
- **Correção recomendada:** Validar body com schema (ex.: Zod) e limitar tamanho de campos. **Aplicado** em `api/admin/users.js` com validação de tipos e tamanhos.

### 2.3 IDOR

- Ver item 1.2. Recursos são filtrados por `auth.uid()` ou por slug aleatório (PDF). Nenhum IDOR óbvio em endpoints de API.

### 2.4 Validação de entrada e schema

- **Problema:** O endpoint `POST /api/admin/users` não validava formato de e-mail, tamanho de senha nem tamanho de nome com schema (Zod/Joi).
- **Correção:** Validação explícita de tipos, formato de e-mail e limites de tamanho no serverless function (equivalente a schema rígido). Recomendação: manter Zod no backend se passar a usar Node com módulos compartilhados.

**Risco:** Médio → mitigado com validação aplicada.

---

## 3. Segurança do banco (Supabase)

### 3.1 RLS (Row Level Security)

- RLS está **habilitado** nas tabelas relevantes (profiles, patients, procedure_instances, evolution_pdf_links, storage, etc.).
- Políticas seguem o padrão “profissional vê apenas seus dados” (e.g. `professional_id = auth.uid()`) e “admin” apenas para o e-mail configurado.

**Risco:** Baixo.

### 3.2 Chaves de serviço

- **Service role** não é exposta no frontend. Usada apenas em `api/admin/users.js` via `process.env.SUPABASE_SERVICE_ROLE_KEY`.
- **Recomendação:** No Vercel, garantir que `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_URL` estejam apenas em Environment Variables (nunca em variáveis com prefixo `VITE_`).

**Risco:** Baixo, desde que a configuração de env seja feita corretamente.

---

## 4. Segredos e variáveis de ambiente

### 4.1 Segredos no código

- Nenhum segredo hardcoded. Uso de `import.meta.env.VITE_*` no frontend (apenas URL e chave anon) e `process.env` na API.
- **Problema:** `ADMIN_EMAIL` em `api/admin/users.js` tem fallback `'admin@clinievo.com.br'` no código. Quem faz deploy pode esquecer de definir `ADMIN_EMAIL` e depender de valor fixo.
- **Correção:** Usar apenas `process.env.ADMIN_EMAIL` na API e documentar em `.env.example` que esse valor é obrigatório em produção. Remover fallback hardcoded em produção (ou manter apenas para dev local, com aviso).

**Risco:** Médio (configuração incorreta pode ampliar superfície do admin). Mitigado ao exigir env e documentar.

**Ação pós-deploy:** Se você usava o admin padrão, defina na Vercel a variável `ADMIN_EMAIL=admin@clinievo.com.br` (ou o e-mail desejado) para que `POST /api/admin/users` continue funcionando.

### 4.2 .env.example

- **Correção:** Incluir `ADMIN_EMAIL` e `SUPABASE_SERVICE_ROLE_KEY` (apenas descrição, sem valor) no exemplo, deixando claro que não devem existir em `.env` commitado e que a service role nunca deve ser `VITE_*`.

**Risco:** Baixo.

---

## 5. Segurança do frontend

### 5.1 XSS

- Uso de `dangerouslySetInnerHTML` apenas em `chart.tsx`, com conteúdo estático (tema/cores), não controlado pelo usuário.
- Não foi encontrado uso de `DOMPurify` ou sanitização explícita; não há, porém, renderização de HTML a partir de dados do usuário nos pontos analisados.
- **Recomendação:** Para qualquer conteúdo rico vindo do backend (ex.: observações, termos), usar sanitização (ex.: DOMPurify) ou renderizar como texto.

**Risco:** Baixo no estado atual.

### 5.2 CSRF

- API serverless usa Bearer token (Authorization header). Requisições cross-site sem o token não obtêm acesso. Formulários críticos (ex.: criar usuário) usam fetch com token da sessão Supabase.
- **Recomendação:** Manter uso de token em header e não em query/cookie para ações sensíveis.

**Risco:** Baixo.

### 5.3 Armazenamento de token

- Supabase client usa `storage: localStorage` e `persistSession: true`. Tokens ficam no localStorage, vulnerável a XSS no mesmo origin.
- **Recomendação:** Para maior segurança, considerar migrar sessão para httpOnly cookies (ex.: com Supabase custom server ou BFF). Para o cenário atual (SPA + Supabase direto), a abordagem é comum e aceitável se XSS for contido.

**Risco:** Médio (depende do cenário de XSS).

---

## 6. Rate limit e proteção de API

### 6.1 Rate limiting

- Não há rate limiting aplicado em `/api/admin/users` nem em rotas de login (Supabase Auth).
- **Risco:** Alto para brute force em login; Médio para abuso de criação de usuários (apenas admin).

**Recomendações:**
- Configurar rate limit no Supabase (Auth) para tentativas de login por IP/e-mail.
- Para a Vercel Function `api/admin/users`, usar Vercel Edge Config ou middleware com rate limit por IP (ou por `Authorization`), por exemplo: máx. N requisições por minuto por IP.

### 6.2 Brute force no login

- Depende do Supabase (proteção no Auth). Habilitar/verificar no painel do Supabase: rate limit, captcha ou 2FA se disponíveis.

**Risco:** Alto se não houver limite no Supabase; mitigar via configuração do projeto Supabase.

---

## 7. Headers de segurança

### 7.1 Headers ausentes

- Não havia configuração de **Content-Security-Policy**, **X-Frame-Options**, **X-Content-Type-Options**, **Referrer-Policy** nem **Permissions-Policy**.
- **Correção:** Headers adicionados em `vercel.json` (ver seção “Correções aplicadas” abaixo).

**Risco:** Alto (XSS, clickjacking, MIME sniffing). Mitigado com headers aplicados.

---

## 8. Dependências

### 8.1 npm audit

- 15 vulnerabilidades reportadas (3 low, 5 moderate, 7 high), incluindo:
  - **React Router / @remix-run/router:** XSS via Open Redirect (GHSA-2w69-qvjg-hvjx).
  - **glob / minimatch / rollup / tar / esbuild / jsdom (dev):** ReDoS, path traversal, command injection, etc., em geral em ferramentas de build ou teste.

**Recomendações:**
- Rodar `npm audit fix` e, para o que exigir breaking change, avaliar `npm audit fix --force` em ambiente de dev/staging.
- Atualizar React Router quando sair versão que corrija o open redirect.
- Manter dependências de produção (React, Supabase, etc.) atualizadas.

**Risco:** Alto para o open redirect no router; Médio para as demais (muitas em dev/build).

---

## 9. Exposição de dados em logs

- Não foram encontrados `console.log` de tokens, senhas ou dados sensíveis no código de produção.
- **Recomendação:** Evitar logar corpo de requisições que contenham senha ou token; em erros, não expor stack ou detalhes internos ao cliente.

**Risco:** Baixo.

---

## 10. Arquitetura – melhorias sugeridas

1. **Admin por env:** Usar somente `ADMIN_EMAIL` (e, se possível, lista de admins ou role no Supabase) em produção, sem fallback hardcoded.
2. **Validação de entrada:** Manter validação com schema (Zod) em todos os endpoints serverless e rejeitar payloads malformados ou grandes.
3. **Rate limiting:** Implementar no Supabase Auth e na função `/api/admin/users`.
4. **CSP:** Revisar CSP após deploy (evitar quebrar recursos legítimos); considerar nonces para scripts inline se quiser remover `'unsafe-inline'`.
5. **Sessão:** Avaliar migração para cookies httpOnly para tokens no futuro, se o perfil de risco exigir.
6. **Auditoria:** Revisar políticas RLS ao adicionar novas tabelas; garantir que nenhuma tabela sensível fique com `USING (true)` sem necessidade.

---

## Correções aplicadas (resumo)

1. **Security headers** em `vercel.json`: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
2. **Validação no `POST /api/admin/users`:** formato de e-mail, tamanho mínimo de senha (8), tamanho máximo de nome e e-mail; rejeição de tipos inválidos.
3. **.env.example:** Documentação de `ADMIN_EMAIL` e variáveis de Supabase (sem valores reais); orientação para não expor service role no frontend.
4. **Admin email:** Uso de `process.env.ADMIN_EMAIL` na API com falha explícita se ausente em produção (ou aviso em dev), removendo dependência de valor fixo no código.

---

## Classificação final dos riscos

| # | Item                                      | Nível  | Status        |
|---|-------------------------------------------|--------|---------------|
| 1 | Headers de segurança ausentes             | Alto   | Corrigido     |
| 2 | Validação de entrada na API admin/users   | Médio  | Corrigido     |
| 3 | Admin email hardcoded                     | Médio  | Mitigado      |
| 4 | Rate limiting (login e API admin)         | Alto   | Recomendado   |
| 5 | Token em localStorage (XSS)               | Médio  | Recomendado   |
| 6 | React Router open redirect                | Alto   | npm audit fix |
| 7 | Outras dependências (ReDoS, etc.)         | Médio  | npm audit fix |
| 8 | Link público PDF (enumeração de slug)      | Médio  | Aceito        |
| 9 | CSP refinado (nonces)                     | Baixo  | Opcional      |
|10 | Logs sensíveis                            | Baixo  | Prevenção     |

Este documento deve ser revisitado após mudanças de stack, novos endpoints ou integrações.
