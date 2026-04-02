

## Plan: Add i18n (EN/FR) and Robustness Improvements

### 1. Internationalization (i18n) System

**Create `src/i18n/` with translation files and a React context:**

- `src/i18n/locales/fr.ts` — French translations (current hardcoded strings)
- `src/i18n/locales/en.ts` — English translations
- `src/i18n/LanguageContext.tsx` — Context providing `locale`, `setLocale`, and a `t(key)` helper function. Persists chosen language in `localStorage`.
- `src/i18n/index.ts` — Re-exports

**Add a language switcher** in the sidebar (bottom, above logout) — a simple EN/FR toggle button with flag icons or text labels.

**Update all pages and components** to use `t()` instead of hardcoded French strings:
- `DashboardPage` — KPI titles, chart labels, table headers, badge text, subtitles
- `SaleFormPage` — form labels, placeholders, button text, commission labels
- `RefundsPage` — tab labels, table headers, badge text
- `AdminPage` — table headers, dialog labels, button text, toast messages
- `LoginPage` — title, description, labels, button
- `AppSidebar` — nav labels, logout button
- `StatCard` — no changes needed (receives translated strings as props)

### 2. Robustness Improvements

- **Empty states**: Add "No data" messages when tables have no rows (sales, refunds, impayés, admin)
- **Form validation**: Add proper validation to `SaleFormPage` — required field checks, email format, positive amount — with inline error messages
- **Confirmation dialogs**: Add confirm dialog before deleting a sale in `AdminPage` and before toggling refund status
- **Loading states**: Add skeleton loaders to dashboard cards and tables (prep for API integration)
- **Error boundaries**: Add a top-level `ErrorBoundary` component wrapping routes
- **Toast feedback**: Ensure all user actions (sale create, refund toggle, commission edit, delete) show success/error toasts with translated messages
- **Responsive sidebar**: Make sidebar collapsible on mobile with a hamburger menu toggle

### Files to create
- `src/i18n/locales/en.ts`
- `src/i18n/locales/fr.ts`
- `src/i18n/LanguageContext.tsx`
- `src/i18n/index.ts`
- `src/components/ErrorBoundary.tsx`

### Files to modify
- `src/App.tsx` — wrap with `LanguageProvider`, add `ErrorBoundary`
- `src/components/AppSidebar.tsx` — language switcher, translated labels, mobile toggle
- `src/components/AppLayout.tsx` — mobile sidebar support
- `src/pages/DashboardPage.tsx` — use `t()`, empty states, skeletons
- `src/pages/SaleFormPage.tsx` — use `t()`, form validation
- `src/pages/RefundsPage.tsx` — use `t()`, empty states, confirm dialog
- `src/pages/AdminPage.tsx` — use `t()`, empty states, delete confirmation
- `src/pages/LoginPage.tsx` — use `t()`

