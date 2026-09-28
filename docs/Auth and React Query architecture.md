# Arquitetura Auth + React Query (padrão produção)

## 1. Estado de auth discriminado (sem estados inválidos)

```ts
type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; session: Session; user: User };
```

- **loading:** hidratação inicial ou transição; não há `user` nem `profile`.
- **unauthenticated:** sem sessão; layout autenticado não renderiza.
- **authenticated:** `session` e `user` definidos; perfil fica no React Query (não no estado de auth).

Evita combinações inválidas como `loading=false`, `user` definido e `profile=null`.

---

## 2. Fluxo de inicialização (um único commit)

1. **Mount:** `authState = { status: 'loading' }`.
2. **getSession()** (e depois **onAuthStateChange**):
   - Sem sessão → `setState({ status: 'unauthenticated' })`.
   - Com sessão → `getProfile(userId)` → `queryClient.setQueryData(profileKey(userId), profile)` → `setState({ status: 'authenticated', session, user })`.
3. O layout autenticado só é mostrado quando o estado é `authenticated` **e** o perfil já está no cache (setQueryData antes do setState).

Assim, um único `setState` por transição e primeiro paint já com perfil disponível.

---

## 3. AuthProvider: o que expõe

- **Estado:** apenas `AuthState` (loading | unauthenticated | authenticated com `session` e `user`).
- **Profile:** não fica no contexto; fica no React Query.
- **Ações:** signIn, signOut, updateProfile, etc., estáveis (useMemo), que usam `queryClient.invalidateQueries(profileKey(userId))` ou `removeQueries` no logout.

O provider não faz múltiplos setState (session, user, profile, loading); há um único estado `AuthState`.

---

## 4. Integração Auth + React Query

### 4.1 Onde cada coisa vive

| Dado        | Onde vive              | Acesso                         |
|------------|------------------------|---------------------------------|
| session, user | AuthContext (AuthState) | useAuthState() / useAuth()     |
| profile    | React Query (cache)    | useProfile(userId) / useAuth() |

### 4.2 useQuery (profile)

- **useProfile(userId):** `useQuery(profileKey(userId), getProfile, { enabled: !!userId })`.
- Usado por **useAuth()** para expor `profile` quando `status === 'authenticated'`.
- Queries que dependem de perfil usam `enabled: !!user?.id` ou `enabled: !!profile?.id` (ex.: notificações, menu procedures).

### 4.3 setQueryData (hidratação sem flash)

- No **AuthProvider**, antes de `setState({ status: 'authenticated', ... })`:
  - `getProfile(session.user.id)` → `queryClient.setQueryData(profileKey(session.user.id), profile)`.
- Assim, no primeiro render após `authenticated`, `useProfile(user.id)` já lê do cache e o layout não pinta sem perfil.

### 4.4 invalidateQueries (após mutações)

- Após **updateProfile**, **updateAvatar**, **updateTheme**, etc.:
  - `queryClient.invalidateQueries({ queryKey: profileKey(user.id) })`.
- O React Query refaz a query e os componentes que usam `useProfile` ou `useAuth()` atualizam.

### 4.5 removeQueries (logout)

- No **signOut:** `queryClient.removeQueries({ queryKey: profileKey(userId) })` antes de `setState({ status: 'unauthenticated' })`.
- Evita reutilizar perfil de outro usuário em login seguinte.

### 4.6 prefetchQuery

- Para rotas ou fluxos que dependem de perfil, pode-se usar `queryClient.prefetchQuery(profileKey(userId), getProfile)` quando já se tem `userId` (ex.: após login em outro fluxo). No fluxo principal, o próprio AuthProvider já hidrata o perfil com setQueryData.

---

## 5. useAuth() e gate no layout

- **useAuth()** = useAuthState() + useAuthActions() + **useProfile(userId)** quando `status === 'authenticated'`.
- Retorna `{ user, session, profile, loading, signIn, signOut, updateProfile, ... }` para compatibilidade com o resto do app.
- **AppLayout (gate):**
  - `loading` → `<AppLoader />`
  - `!user` → `<Navigate to="/auth" />`
  - `!profile` → `<AppLoader message="Carregando perfil..." />` (rede de segurança; em teoria o cache já está preenchido)
  - Caso contrário → layout com Header/Sidebar/Outlet.

Com isso, o layout autenticado não renderiza sem perfil e o primeiro paint já tem os dados necessários.

---

## 6. Decisões e otimizações

- **Um único estado (AuthState):** um único `setState` por transição; menos re-renders e sem estados intermediários inconsistentes.
- **Profile só no React Query:** cache compartilhado, invalidação e revalidação centralizadas; AuthProvider fica só com sessão/usuário.
- **setQueryData antes de authenticated:** elimina flash de “usuário sem perfil” no header/layout.
- **Ações em useMemo:** referência estável; quem só usa ações não re-renderiza quando o estado de auth muda.
- **stateRef para ações:** signOut e mutações leem o `user` atual sem depender de closure, evitando estado desatualizado.
- **Profile em types/auth.ts:** tipo único para AuthContext e api/profiles, sem dependência circular.

---

## 7. Estrutura de árvore (conceitual)

```
App
 ├── QueryProvider
 ├── AuthProvider (usa useQueryClient; setQueryData + setState)
 │
 └── Router
       └── BlockedUserGuard (useAuth → user, profile, loading)
             └── AppLayout (useAuth → user, profile, loading; gate)
                   └── AppHeader / AppSidebar / Outlet (useAuth → profile do cache)
```

O AuthProvider continua dentro do QueryProvider para poder usar `queryClient.setQueryData` / `invalidateQueries` / `removeQueries`.

---

## 8. Resumo

- **Auth:** estado discriminado (loading | unauthenticated | authenticated); um commit por transição; profile fora do estado.
- **Profile:** React Query (getProfile, profileKey); hidratação via setQueryData; atualização via invalidateQueries; limpeza no logout com removeQueries.
- **useAuth():** expõe estado + ações + profile (do cache), mantendo a API atual do app.
- **Layout:** gate em AppLayout (loading / !user / !profile) garante que a UI autenticada nunca pinta sem perfil e evita flash.
