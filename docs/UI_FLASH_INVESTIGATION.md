# Investigação: Flash visual no primeiro render (React + TypeScript)

## 1. Resumo do problema

Ao fazer login ou entrar em uma tela pela primeira vez, ocorre um **flash** (render incorreto por um momento) antes da UI estabilizar.

---

## 2. Fluxo identificado

```
Render inicial (AuthProvider: loading=true, user=null, profile=null)
    ↓
AppLayout: loading=true → mostra <AppLoader />
    ↓
useEffect no AuthProvider: getSession() resolve
    ↓
setSession, setUser, setLoading(false) — fetchProfile() disparado mas NÃO aguardado
    ↓
AppLayout re-render: loading=false, user set, profile ainda null
    ↓
Render do layout completo: AppHeader + Outlet com profile=null  ← PRIMEIRO PAINT COM ESTADO INVÁLIDO
    ↓
AppHeader pinta: "Usuário", avatar fallback "U", "CliniEvo", menu vazio
    ↓
fetchProfile() resolve → setProfile(data)
    ↓
Re-render: AppHeader com profile preenchido  ← FLASH (mudança visível)
```

---

## 3. Componentes com estado inicial inválido / que causam re-render

### 3.1 AuthProvider (`src/contexts/AuthContext.tsx`)

| Estado       | Primeiro render | Depois                         | Causa do 2º render   |
|-------------|----------------|--------------------------------|----------------------|
| `user`      | `null`         | `User` após getSession()       | setUser()            |
| `session`   | `null`         | `Session \| null`              | setSession()         |
| `profile`   | `null`         | `Profile` após fetchProfile()  | setProfile() (async) |
| `loading`   | `true`         | `false` após getSession()      | setLoading(false)    |

**Problema:** `loading` passa a `false` assim que `getSession()` resolve, **sem esperar** `fetchProfile()`. O layout (e o Header) renderizam com `profile === null`.

---

### 3.2 AppLayout (`src/components/layout/AppLayout.tsx`)

| Dado        | Primeiro render (após auth ready) | O que muda depois      |
|------------|-----------------------------------|------------------------|
| `user`     | definido                           | —                      |
| `loading`  | false                              | —                      |
| **profile**| **null** (Header já montado)       | **setProfile** no Auth |

O AppLayout só verifica `loading` e `user`. Não espera `profile`. Por isso o Header monta com `profile === null` e depois re-renderiza quando o profile chega.

---

### 3.3 AppHeader (`src/components/layout/AppHeader.tsx`)

| Uso no primeiro paint   | Valor com profile=null   | Depois (profile preenchido) |
|-------------------------|---------------------------|-----------------------------|
| `profile?.full_name`    | undefined → "Usuário"     | Nome real                   |
| `profile?.avatar_url`  | undefined → fallback "U"  | Foto                        |
| `profile?.app_name`    | undefined → "CliniEvo"    | Nome do app                 |
| `profile?.app_logo_url`| undefined → ícone Sparkles| Logo                        |
| `menuProcedures` (useQuery) | `[]` (enabled: !!profile?.id) | Lista quando profile.id existe |
| `useNotifications()`   | items vazios / clearedAt 0 | useEffect lê localStorage; query preenche |

**Conclusão:** O componente que gera o flash visível é o **AppHeader**, porque ele depende de `profile` e de dados assíncronos (menu, notificações) que só ficam disponíveis após o primeiro paint.

---

### 3.4 useNotifications (`src/hooks/use-notifications.ts`)

| Estado     | Primeiro render | Depois                          |
|-----------|-----------------|----------------------------------|
| `clearedAt` | `0` (useState) | valor do localStorage (useEffect) |
| `data` (useQuery) | `[]` ou loading | dados após fetch/hidratação     |

Gera um re-render quando `clearedAt` é atualizado pelo useEffect e quando a query retorna dados. O flash principal, porém, vem do **profile** no Header.

---

### 3.5 ThemeSync (`src/App.tsx`)

- `profile?.theme` e `profile?.theme_palette` podem ser `undefined` no primeiro render.
- useEffects aplicam tema após o paint. O `index.html` já aplica tema via script, então o impacto de tema no flash é menor que o do profile/Header.

---

## 4. Ordem de renders e origem do flash

1. **Primeiro:** Router + AuthProvider com `loading=true` → AppLayout mostra `<AppLoader />`.
2. **Segundo:** getSession() resolve → `loading=false`, `user` set, `profile` ainda null → AppLayout renderiza Header + Outlet.
3. **Terceiro (flash):** AppHeader usa `profile === null` → exibe "Usuário", fallback de avatar, "CliniEvo".
4. **Quarto:** fetchProfile() resolve → setProfile → AppHeader re-renderiza com nome, avatar e branding corretos.

O **flash** é a transição do terceiro para o quarto render (Header “genérico” → Header com dados do perfil).

---

## 5. Solução aplicada

### 5.1 Loading gate no AuthProvider

- **Regra:** Só definir `loading = false` quando:
  - não houver sessão, ou
  - houver sessão **e** o perfil já tiver sido carregado (aguardar `fetchProfile()`).
- Assim, o primeiro paint do layout autenticado já ocorre com `profile` preenchido e o Header não pinta estado intermediário.

### 5.2 Ajustes no código

- Em `getSession().then()`: se existir `session?.user`, **await fetchProfile(session.user.id)** antes de `setLoading(false)`.
- Em `onAuthStateChange`: se existir `session?.user`, chamar `fetchProfile(session.user.id)` e só chamar `setLoading(false)` no `.finally()` do promise; se não houver sessão, `setProfile(null)` e `setLoading(false)`.

Com isso, evita-se o primeiro paint do AppHeader com `profile === null`, eliminando o flash principal.

---

## 6. Outras recomendações (opcionais)

- **useNotifications:** Inicializar `clearedAt` com um valor lido de forma síncrona (ex.: função que lê `localStorage` fora do useState) para evitar um re-render extra apenas por causa de `clearedAt`.
- **next-themes:** Manter o script no `index.html` e, se ainda houver flash de tema, considerar `suppressHydrationWarning` ou não renderizar partes sensíveis ao tema até `resolvedTheme` estar definido.
- **React Query:** Persistência e hidratação já estão em uso; o loading gate do auth reduz o impacto de queries que dependem de `profile?.id` (ex.: menu, notificações) no primeiro paint do Header.

---

## 7. Conclusão

- **Causa raiz do flash:** Layout (e em especial o **AppHeader**) ser exibido com `loading=false` e `user` definido, mas **profile ainda null**, porque `loading` era setado ao resolver `getSession()` sem esperar `fetchProfile()`.
- **Correção:** Tratar auth como “pronto” só quando não houver sessão ou quando sessão + perfil estiverem carregados, implementado via **loading gate** no `AuthProvider` (await / .finally em torno de `fetchProfile` antes de `setLoading(false)`).
