# Deep Performance Audit — CliniEvo Dashboard

**Stack:** React 18, Vite 5, React Router 6, TanStack React Query 5, Supabase, next-themes, TailwindCSS.  
**Scope:** Bundle, data layer, rendering, context, loaders, Core Web Vitals.

---

## Executive Summary

| Area | Status | Critical issues |
|------|--------|-----------------|
| **Bundle / code splitting** | ⚠️ | Patients page in main bundle; no manual chunks; prefetch/route mismatch for `/patients` |
| **Provider tree** | ✅ | Order correct; no redundant providers |
| **React Query** | ⚠️ | Faturamento uses inline key; hover prefetch for `/dashboard` does not prefetch `dashboardKey` |
| **Route loaders** | ⚠️ | Only 3 routes have loaders; Agenda appointments fetched on mount; many routes data-on-mount |
| **Context** | ⚠️ | AuthContext global and heavy; any profile/theme change re-renders all consumers |
| **Memoization** | ✅ | PatientCard, StatCard, sidebar callbacks memoized; virtualization at 80+ patients |
| **Theme / FOUC** | ✅ | Inline script in `index.html`; persistence; PageSkeleton fallback |

---

## 1. Bundle & Code Splitting

### 1.1 Lazy routes

- **`src/routes/index.tsx` (lines 17–39):** All page routes use `lazy(() => import('@/pages/...'))` **except** `Patients`.
- **Patients** is a **static import** (line 7): `import Patients from '@/pages/Patients'`. So the Patients page is part of the **main bundle**, increasing initial load.

### 1.2 Chunk prefetch vs route

- **`src/routes/chunkPrefetch.ts`:** Maps `/patients` to `() => import('@/pages/Patients')`.
- The router uses the statically imported `Patients` component, so that prefetch loads a **separate** chunk that the route does not use. Either make the route lazy and use that chunk, or remove `/patients` from `routeChunkPrefetch` to avoid redundant load.

### 1.3 Vite config

- **`vite.config.ts`:** No `build.rollupOptions.output.manualChunks`. Vendor (react, react-dom, react-query, recharts, jspdf, etc.) is not explicitly split; only dynamic `import()` creates extra chunks.
- **Heavy deps:** `recharts` and `jspdf` are used only inside lazy pages (`ProcedureInstanceDetailPage`, `AdminDashboardPage`, `evolutionPdf`), so they stay in lazy chunks. Main bundle size is still driven by Patients and shared code.

### 1.4 Build output (reference)

- Previous build reported chunks &gt; 500 KB: `ProcedureInstanceDetailPage`, `generateCategoricalChart`, `index` (main). Consider `manualChunks` for `react`, `react-dom`, `@tanstack/react-query`, and optionally a `recharts` chunk shared by admin and procedure pages.

**Recommendations:**

1. Use `lazy(() => import('@/pages/Patients'))` and remove the static import so Patients is code-split and prefetch is consistent.
2. Add `manualChunks` in `vite.config.ts` for `react`, `react-dom`, and `@tanstack/react-query` to improve cache reuse and parallel loading.
3. Optionally raise `build.rollupOptions.output.chunkSizeWarningLimit` only if chunks are intentionally large after splitting.

---

## 2. Provider Tree

**Order (outer → inner):**

1. `QueryProvider` (React Query + optional persist)
2. `TooltipProvider`
3. `ThemeProvider` (next-themes)
4. `Toaster` + `Sonner`
5. `AuthProvider`
6. `ThemeSync`
7. `Suspense` → `RouterProvider`
8. Inside protected routes: `RealtimeProvider` → `CurrentPatientProvider` → `SidebarProvider` → `Suspense` (PageSkeleton) → `Outlet`

**Assessment:** Order is correct (data → theme → auth → router → layout). No duplicate or obviously redundant providers. `ThemeSync` and layout depend on auth; that’s expected.

---

## 3. React Query

### 3.1 Config (`src/core/queryClient.ts`)

- `staleTime: 30_000`, `gcTime: 300_000`, `refetchOnWindowFocus: false`, `retry: 1`, `suspense: false`. Appropriate for a dashboard.

### 3.2 Persistence (`src/core/providers/QueryProvider.tsx`)

- `PersistQueryClientProvider` + `createSyncStoragePersister` (localStorage, key `clienievo_react_query_cache`, `maxAge: 1h`). Restores cache on reload for instant data.

### 3.3 Query key consistency

- **Central keys:** `src/api/queryKeys.ts` defines `QUERY_KEYS` and helpers (`patientsListKey`, `dashboardKey`, `proceduresForFaturamentoKey`, etc.).
- **Faturamento.tsx (line 48):** Uses `queryKey: ['procedures-for-faturamento', profile?.id]` instead of `proceduresForFaturamentoKey(profile?.id)`. Functionally equivalent but breaks single source of truth and can drift if the helper changes.

### 3.4 Prefetch on hover (`src/routes/loaders/prefetchRoute.ts`)

- For `/dashboard`, `/patients`, `/agenda`: prefetches only **`patientsListKey(userId)`**.
- **Gap:** For `/dashboard`, **`dashboardKey(userId)`** is not prefetched on hover, so the first visit to Dashboard after hover can still wait on dashboard data.

**Recommendations:**

1. In `Faturamento.tsx`, use `queryKey: proceduresForFaturamentoKey(profile?.id ?? '')` (and only when `profile?.id` is defined).
2. In `prefetchRoute`, when `path === '/dashboard'`, also call `queryClient.prefetchQuery({ queryKey: dashboardKey(userId), queryFn: () => fetchDashboardData(userId) })` (with `fetchDashboardData` from `@/api/dashboard`).

---

## 4. Route Loaders & Data-on-Mount

### 4.1 Loaders today

| Route | Loader | Prefetches |
|-------|--------|------------|
| `/dashboard` | `dashboardLoader` | `patientsListKey`, `dashboardKey` |
| `/patients` | `patientsLoader` | `patientsListKey` |
| `/agenda` | `agendaLoader` | `patientsListKey` |

### 4.2 Prefetch on hover

- Same three routes trigger prefetch; only **patients** list is prefetched for all three. Dashboard-specific data is not prefetched on hover (see §3.4).

### 4.3 Routes without loaders (data on mount)

- **Agenda:** Uses `useAppointments` (and `usePatients`); appointments are fetched when the page mounts, not by a loader.
- **Others:** `/patients/new`, `/patients/:id/*`, `/consultation/*`, `/faturamento`, `/settings/*`, `/procedures/*` — all fetch their data in components (useQuery/useEffect). First paint often shows loading state.

**Recommendations:**

1. Add dashboard data prefetch on hover (see §3.4).
2. Consider an `agendaLoader` that prefetches `appointmentsKey(professionalId, weekStart, weekEnd)` for the current week so Agenda can render with cache.
3. For other routes, keep data-on-mount unless you want to add more loaders for critical paths (e.g. consultation, procedure instance).

---

## 5. Context & Re-renders

### 5.1 AuthContext (`src/contexts/AuthContext.tsx`)

- **Scope:** Wraps the whole app (inside ThemeProvider).
- **Value:** `{ user, session, profile, loading, signIn, signOut, updateProfile, ... }`. Any change (e.g. `profile`, `loading`) triggers re-renders in every component that calls `useAuth()` (layout, sidebar, header, many pages).
- **Impact:** High. Profile updates (e.g. theme) or loading transitions re-render a large subtree.

### 5.2 Other contexts

- **CurrentPatientContext:** Scoped under `AppLayout`; only `patientId` + setter; lower impact.
- **SidebarProvider, Form, Chart, etc.:** Local to their UI trees; acceptable.

**Recommendations:**

1. Split AuthContext into e.g. `AuthStateContext` (user, session, profile, loading) and `AuthActionsContext` (signIn, signOut, updateProfile) so that only state changes re-render state consumers; action consumers can stay in a separate subtree.
2. Or keep a single context but ensure `profile` and other objects are stable (e.g. same reference when only theme is updated server-side) if possible from Supabase.
3. Use `useMounted()` in theme-dependent components that read from context to avoid hydration mismatch; already available in `src/hooks/useMounted.ts`.

---

## 6. Memoization & Lists

### 6.1 Memoization in use

- **React.memo:** PatientCard, StatCard, and several UI primitives (chart, carousel, sidebar internals).
- **useCallback:** `closeMobileSidebar`, `handleToggleActive`, `handleRemoveClick`, `goToPatient`, and others in Patients, Agenda, AdminProcedurePermissionsPage, etc.
- **useMemo:** `filteredPatients`, `statCards`, `timeSlots`, `workingDays`, and similar in Dashboard, Patients, Agenda.

### 6.2 Virtualization

- **Patients page:** Uses `VirtualizedPatientList` when `filteredPatients.length >= 80`; otherwise a grid. Reduces DOM and re-renders for large lists.

### 6.3 Tables / heavy lists

- **Admin users table:** Pagination (10/25/50) limits rendered rows; no virtualization. Acceptable unless rows become very heavy or count grows to hundreds.
- **Agenda:** Week view with a bounded number of slots; no need for virtualization for typical use.

**Recommendations:**

1. Keep PatientCard and list callbacks memoized; avoid inline functions in map (e.g. keep `onNavigate={goToPatient}`).
2. If Admin users table grows (e.g. 100+ rows), consider `@tanstack/react-virtual` for the table body.

---

## 7. Theme, FOUC & Layout Stability

- **Theme script:** `index.html` runs before React; reads `theme`, `clienievo_theme_palette`, `clienievo_accent_color`; sets `:root` and `dark` class. Reduces FOUC.
- **ThemeProvider:** `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`.
- **Persistence:** Theme and palette/accent persisted to localStorage on profile load; next load uses script again.
- **Suspense fallback:** AppLayout uses `PageSkeleton` instead of a full-page spinner, keeping header/sidebar and avoiding layout jump.

No further critical recommendations in this area.

---

## 8. Core Web Vitals (CWV) — Notes

- **LCP:** Affected by main bundle size (Patients in main bundle) and any blocking resources. Theme script and skeleton help first paint; reducing main bundle and adding manual chunks should help LCP.
- **INP/FID:** AuthContext-driven re-renders can increase input delay if many components re-render on interaction. Splitting or stabilizing context (see §5) helps.
- **CLS:** Layout is stable (skeleton, no full-page spinner swap). Images (avatars, procedure photos) should use dimensions or `aspect-ratio` to avoid layout shift; not audited in this pass.

---

## 9. Action Checklist

| Priority | Action |
|----------|--------|
| High | Make Patients route lazy and use `lazy(() => import('@/pages/Patients'))` so prefetch and route use the same chunk. |
| High | In `prefetchRoute`, for `path === '/dashboard'` prefetch `dashboardKey(userId)` with `fetchDashboardData`. |
| Medium | Use `proceduresForFaturamentoKey(profile?.id ?? '')` in Faturamento.tsx. |
| Medium | Add Vite `manualChunks` for react, react-dom, @tanstack/react-query. |
| Medium | Consider splitting AuthContext (state vs actions) or stabilizing profile reference to reduce re-renders. |
| Low | Consider agendaLoader prefetching appointments for the current week. |
| Low | If admin user list grows, add virtualization to the table body. |

---

## 10. Files Reference

| Concern | File(s) |
|--------|--------|
| Router & lazy | `src/routes/index.tsx` |
| Chunk prefetch | `src/routes/chunkPrefetch.ts` |
| Data prefetch | `src/routes/loaders/prefetchRoute.ts`, `dashboardLoader.ts`, `patientsLoader.ts`, `agendaLoader.ts` |
| React Query | `src/core/queryClient.ts`, `src/core/providers/QueryProvider.tsx`, `src/api/queryKeys.ts` |
| Auth context | `src/contexts/AuthContext.tsx` |
| Theme | `index.html` (inline script), `src/App.tsx` (ThemeSync, ThemeProvider) |
| Layout / skeleton | `src/components/layout/AppLayout.tsx`, `src/components/layout/PageSkeleton.tsx` |
| Patients list | `src/pages/Patients.tsx`, `src/components/patients/VirtualizedPatientList.tsx` |
| Faturamento key | `src/pages/Faturamento.tsx` (line 48) |
| Build | `vite.config.ts` |
