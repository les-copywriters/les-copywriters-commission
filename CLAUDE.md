# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on port 8080
npm run build        # Production build (Vite)
npm run lint         # ESLint
npm run test         # Run all tests once (Vitest + jsdom)
npm run test:watch   # Vitest in watch mode
```

Run a single test file:
```bash
npx vitest run src/hooks/useRefunds.test.tsx
```

The app is deployed on Vercel. `vercel.json` rewrites all routes to `index.html` for SPA routing.

Edge functions live under `supabase/functions/` and run on Deno. Deploy them with the Supabase CLI (`supabase functions deploy <name>`). They share utility code via `supabase/functions/_shared/setterDashboard.ts`.

Environment variables required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Architecture

### Stack
React 18 + TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix), TanStack Query v5, React Router v6, Supabase (auth + Postgres + edge functions), Recharts, Sonner toasts.

### Roles
Three roles exist: `admin`, `closer`, `setter`. Role is stored in the `profiles` table and loaded into `AuthContext` on login. All role gating is done in the frontend via `user.role` from `useAuth()`. There is no RLS-level role enforcement visible in the frontend — the app trusts the profile row.

Navigation visibility is defined in `src/components/AppSidebar.tsx`:
- Setter Dashboard: `admin | setter`
- Calls + Assistant: `admin | closer`
- Admin Hub items (Admin, Team, Team Manage, Coaching): `admin` only

### Data flow
- **JotForm → Supabase**: `sync-jotform` edge function polls the JotForm API and upserts into `sales`. Commission is calculated server-side using the same rates as the frontend constants.
- **Aircall → Supabase**: `sync-setter-dashboard` edge function with `source: "aircall"` fetches calls, upserts into `setter_call_records` and `setter_call_metrics_daily`, keyed by `aircall_user_id` from `setter_integration_mappings`.
- **iClosed → Supabase**: same edge function with `source: "iclosed"`, upserts into `setter_funnel_metrics_daily`, keyed by `iclosed_user_id`.
- **Frontend reads**: TanStack Query hooks in `src/hooks/` query Supabase directly. Default `staleTime` is 60 s, `gcTime` 10 min.

### Commission & bonus rates
Single source of truth: `src/lib/commissionRates.ts`.
- Closer: 8.8% of HT amount
- Setter: 1.0% of HT amount
- PIF bonus: €50/sale (monthly, closers only)
- Volume bonus: tier-based, configured via `bonus_tiers` table, calculated in `src/lib/bonusCalculation.ts`

### i18n
Two locales: `fr` (default) and `en`. All translation keys live in `src/i18n/locales/fr.ts` and `en.ts`. Access via `const { t } = useLanguage()`. Always add keys to both files when adding UI text.

### Setter integration mappings
Each setter has a row in `setter_integration_mappings` with their `aircall_user_id` and `iclosed_user_id`. Without these IDs, sync silently skips that setter. Setters configure their own IDs in Settings → API Keys tab. The `aircall-lookup` and `iclosed-lookup` edge functions provide auto-match by email to help them fill these in.

### Edge function auth
Edge functions authenticate callers via the Supabase JWT (from the `Authorization` header) and look up their `role` from `profiles`. Some functions also accept a `X-Cron-Secret` header for scheduled calls. The `validate_only` mode of `sync-setter-dashboard` is admin-only.

### Key files
- `src/lib/database.types.ts` — full Supabase schema types (auto-generated; do not edit by hand)
- `src/lib/setterDashboard.ts` — pure date/metric computation helpers (tested in `setterDashboard.test.ts`)
- `supabase/functions/_shared/setterDashboard.ts` — Aircall + iClosed sync engine, shared by all setter-related edge functions
- `src/context/AuthContext.tsx` — session init, profile load, `user` + `session` exposed app-wide
- `src/i18n/LanguageContext.tsx` — locale state + `t()` helper

### Global settings
Admin-only key-value store in the `global_settings` table. Keys used at runtime: `aircall_api_id`, `aircall_api_token`, `iclosed_api_key`, `iclosed_api_base_url`. Edge functions fall back to Deno env vars if the DB row is missing. Managed via `GlobalIntegrationSettings` component (rendered only for `admin` in Settings → API Keys).
