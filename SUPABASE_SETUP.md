# Como vincular o projeto ao seu Supabase

Siga estes passos para conectar o **aura-progress** ao seu projeto no Supabase.

---

## 1. Criar ou usar um projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e faça login.
2. Se ainda não tiver um projeto:
   - Clique em **New project**.
   - Escolha sua organização, nome do projeto e senha do banco.
   - Aguarde a criação (alguns minutos).
3. Abra o projeto que vai usar (novo ou existente).

---

## 2. Pegar a URL e a chave (API)

1. No menu lateral, vá em **Project Settings** (ícone de engrenagem).
2. Clique em **API**.
3. Copie:
   - **Project URL** → será o valor de `VITE_SUPABASE_URL`
   - **anon public** (em Project API keys) → será o valor de `VITE_SUPABASE_PUBLISHABLE_KEY`

Não use a chave `service_role` no front-end; use apenas a **anon public**.

---

## 3. Configurar o `.env` no projeto

1. Na raiz do projeto (`aura-progress`), abra ou crie o arquivo **`.env`**.
2. Adicione ou ajuste estas linhas (trocando pelos valores que você copiou):

```env
VITE_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. Salve o arquivo.  
   (Você pode usar o `.env.example` como referência; ele já está no `.gitignore`, então o `.env` não será commitado.)

---

## 4. Criar as tabelas no banco (migrations)

O schema do app (tabelas, RLS, funções, storage) está nas migrations em `supabase/migrations/`. Você pode aplicar de dois jeitos:

### Opção A – Pelo Dashboard do Supabase (mais simples)

1. No Supabase, vá em **SQL Editor**.
2. Abra o arquivo **`supabase/migrations/20260129102200_7970b160-1990-4522-ba7f-8923bb9d98d4.sql`** no seu editor de código.
3. Copie **todo** o conteúdo e cole no SQL Editor.
4. Clique em **Run** e confira se não há erros.
5. Depois abra **`supabase/migrations/20260129102216_a2676bce-43a0-4181-8c28-eef66ec63657.sql`**, copie todo o conteúdo, cole no SQL Editor e rode também.

### Opção B – Usando Supabase CLI

1. Instale a CLI: [Supabase CLI](https://supabase.com/docs/guides/cli).
2. No terminal, na pasta do projeto:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_ID
```

(O **Project ID** está na URL do projeto, por exemplo em `https://abcdefghij.supabase.co` o ID é `abcdefghij`.)

3. Aplique as migrations:

```bash
npx supabase db push
```

---

## 5. Conferir se deu certo

1. Reinicie o servidor do app (por exemplo `npm run dev`).
2. Acesse a tela de login e crie uma conta ou faça login.
3. Se a autenticação e o carregamento da página funcionarem, o projeto está vinculado ao seu Supabase.

---

## Resumo

| O que fazer | Onde |
|-------------|------|
| URL do projeto | Supabase → Project Settings → API → **Project URL** |
| Chave pública (anon) | Supabase → Project Settings → API → **anon public** |
| Colocar no projeto | Arquivo **`.env`** na raiz com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Criar tabelas | SQL Editor (colar os 2 arquivos de migration) ou `npx supabase db push` |

Se algo falhar, confira se não há espaço ou aspas a mais no `.env` e se a chave usada é realmente a **anon public**.

---

## 6. Autenticação: login não funciona / “Email not confirmed”

Por padrão o Supabase pode exigir **confirmação de e-mail**. O usuário só consegue entrar depois de clicar no link que chegou no e-mail.

**Para desenvolvimento (login imediato sem confirmar e-mail):**

1. No Supabase, vá em **Authentication** → **Providers** → **Email**.
2. Desative **Confirm email** (toggle off).
3. Salve. Novos cadastros poderão fazer login logo após criar a conta.

**Se “Confirm email” estiver ativo:** o usuário precisa abrir o e-mail enviado pelo Supabase e clicar no link antes de conseguir entrar. Verifique também a pasta de spam.
