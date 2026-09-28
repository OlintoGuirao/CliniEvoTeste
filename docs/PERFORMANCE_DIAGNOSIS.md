# Performance Diagnosis — React + Supabase + React Query

## Summary

Audit of the CliniEvo SaaS dashboard identified the following bottlenecks and recommended fixes. Most critical items have been addressed in the refactor.

---

## 1. Main Bottlenecks

| Area | Issue | Impact |
|------|--------|--------|
| **React Query** | Inconsistent query keys (`'patients-list'` vs `PATIENTS_QUERY_KEY`), no central config for `staleTime`/`gcTime` | Duplicate or stale cache, unnecessary refetches |
| **Data fetching** | No route-level prefetching for dashboard/agenda; only patients had a loader | Slower perceived navigation, loading spinners on every visit |
| **Re-renders** | Patient list and admin tables render full lists without virtualization or memoization | Jank with 50+ patients or users |
| **API usage** | Same procedures fetched in AppHeader, AppSidebar, and multiple pages with different keys | Repeated network calls, cache fragmentation |
| **Mutations** | Create/update/delete patients use manual invalidation; no optimistic updates | UI waits for server before updating |
| **Realtime** | No Supabase subscriptions; cache only updates on refetch or manual invalidation | Stale data when another tab or device changes data |
| **Code splitting** | Pages already lazy-loaded; no prefetch on hover for nav links | First click to a route still pays full chunk cost |
| **Theme** | Theme applied in React (useEffect); initial paint used default colors | Flash of default theme before profile load |

---

## 2. React Query Usage

- **Query keys**: Some pages and loaders used string keys (`'patients-list'`) while others used `PATIENTS_QUERY_KEY`. Procedures were keyed by `['menuProcedures', profile?.id]` in sidebar/header, leading to multiple similar requests.
- **Caching**: Defaults were partially centralized in `core/queryClient.ts` (staleTime 30s, gcTime 5min). Aligned to requested values: `staleTime: 30000`, `gcTime: 300000`, `refetchOnWindowFocus: false`, `retry: 1`.
- **Suspense**: Suspense is used at layout level; individual pages still used `isLoading`/`isPageLoading` where data is required before render. Prefetch in loaders reduces the need for suspense for those routes.

---

## 3. Slow Page Loads

- **Dashboard**: No loader; data fetched on mount (consultations, future clients, reminders).
- **Agenda**: Patients and appointments fetched on mount; no prefetch.
- **Mitigation**: Route loaders added for patients (existing), dashboard, and agenda so that critical data is prefetched before the page component renders.

---

## 4. Repeated API Calls

- **Procedures for menu**: Fetched in both `AppHeader` and `ProceduresSidebar`/`AppSidebar` with the same logical key; shared key and single source of truth reduce duplicate calls.
- **Patients**: Fetched in Patients page and Agenda with the same key; loaders prefetch so the first render can use cache.

---

## 5. Heavy Components / Large Lists

- **Patients page**: Renders all filtered patients in a grid; no virtualization. For 100+ patients, `@tanstack/react-virtual` is recommended for the list.
- **Admin users table**: Pagination (10/25/50) limits rendered rows; virtualization optional for very large datasets.
- **Agenda**: Week view with slots; limited rows per day; lower priority for virtualization.

---

## 6. Missing Memoization

- **Patient cards**: Each card in the list re-renders when parent state (e.g. search, stats) changes. `React.memo` on the card component and stable callbacks (`useCallback`) reduce re-renders.
- **Sidebar/nav**: Nav items and procedure lists can be memoized to avoid re-renders on auth or theme updates.

---

## 7. Caching Strategy (Applied)

- **staleTime: 30000** (30s) — Data treated as fresh; no refetch in that window.
- **gcTime: 300000** (5 min) — Unused cache kept in memory for 5 minutes.
- **refetchOnWindowFocus: false** — Avoids refetch on tab focus (dashboard-style app).
- **retry: 1** — One retry on failure.

---

## 8. Theme Flash

- **Current**: Script in `index.html` reads `theme`, `clienievo_theme_palette`, and `clienievo_accent_color` from localStorage and applies CSS variables to `:root` before React. Profile-driven theme is then applied in React and persisted back to localStorage.
- **Result**: First paint uses last-known theme; minimal flash.

---

## 9. Final Architecture (Target)

- **api/** — Fetch functions and shared query keys.
- **core/** — queryClient, providers, loaders.
- **hooks/** — usePageQuery, usePatientMutations, etc.
- **layouts/** — AppLayout, AdminLayout.
- **pages/** — Route-level page components (lazy).
- **routes/** — Router config and route loaders.
- **components/** — UI and feature components.

This keeps data layer, routing, and UI responsibilities separated and scalable.

---

## 10. Implemented in This Refactor

- **Central query keys** (`src/api/queryKeys.ts`): Single source for all React Query keys; pages and loaders use them to avoid fragmentation.
- **QueryClient** (`src/core/queryClient.ts`): `staleTime: 30_000`, `gcTime: 300_000`, `refetchOnWindowFocus: false`, `retry: 1`.
- **Route loaders**: `patientsLoader`, `agendaLoader`, `dashboardLoader` prefetch patient list so navigation to Patients, Agenda, and Dashboard can show data from cache.
- **Prefetch on hover** (`src/routes/loaders.ts` + `AppSidebar`): `prefetchRoute(path)` called on `NavLink` `onMouseEnter` for `/patients`, `/agenda`, `/dashboard`.
- **Optimistic mutations** (`src/hooks/usePatientMutations.ts`): `useUpdatePatientActive` and `useDeletePatient` with `onMutate` / `onError` rollback and `onSettled` invalidation. Patients page uses these hooks.
- **Realtime** (`src/core/providers/RealtimeProvider.tsx`): Supabase channel for `patients` and `procedure_instances` (filtered by `professional_id`); invalidates `patientList` and `futureClientIds` so UI updates when data changes elsewhere.
- **Memoization**: `PatientCard` in Patients page extracted and wrapped in `React.memo`; `handleToggleActive` and `handleRemoveClick` passed as stable `useCallback` to reduce re-renders.
- **Lazy routes + Suspense**: Pages are `React.lazy`; `AppLayout` wraps `<Outlet />` in `<Suspense fallback={<PageSkeleton />}>` so the layout stays visible and only the content area shows a skeleton (no full-page spinner or layout jump).
- **Theme**: Script in `index.html` runs before React/CSS; reads `theme`, `clienievo_theme_palette`, `clienievo_accent_color` and applies `:root` variables + `dark` class. `ThemeProvider` uses `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`. `ThemeSync` persists profile theme to localStorage so the next load has the correct theme before React.
- **useMounted**: Hook `useMounted()` in `src/hooks/useMounted.ts` returns false on first render and true after mount; use in theme-dependent components to avoid hydration mismatch.
- **Route chunk prefetch**: `prefetchRoute(path)` prefetches both data (patients/dashboard/agenda) and the lazy route chunk via `src/routes/chunkPrefetch.ts`. Nav links use `onMouseEnter={() => prefetchRoute(item.url)}` (main + settings) for instant navigation.
- **React Query persistence**: `@tanstack/react-query-persist-client` + `@tanstack/query-sync-storage-persister`; cache persisted to localStorage with `maxAge: 1 hour` and key `clienievo_react_query_cache`. Reloads restore cache so data appears immediately.
- **Virtualization**: `VirtualizedPatientList` used on Patients when the filtered list has **80+** items; grid for smaller lists.
- **Shared data hooks**: `usePatients`, `useDashboard`, `useAppointments` centralize queries and reuse cache (e.g. Patients page and Agenda share the same patient list via `usePatients`).
- **Dashboard API batching**: `fetchDashboardData(professionalId)` in `src/api/dashboard.ts` returns `{ stats, consultationsToday, botoxReminders, futureClients }` in one request; Dashboard page uses `useDashboard` and the loader prefetches this key.
- **Realtime**: Also invalidates `dashboard` and listens to `appointments` and `patient_sessions` so dashboard metrics stay in sync.
- **Memoization**: `StatCard` on Dashboard wrapped in `React.memo`; `PatientCard` uses stable `onNavigate(patientId)` callback; `filteredPatients` memoized with `useMemo`.
