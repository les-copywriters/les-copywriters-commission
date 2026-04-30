# Implementation Plan: Commission Dashboard Project

This document outlines the priority stack for finalizing and maintaining the Les Copywriters Commission Dashboard.

## 🚀 Immediate Priorities (Before Going Live)

### 1. Deploy Updated Edge Functions
The following Supabase Edge Functions have been modified and require redeployment to production:

- `sync-jotform`: Critical fix for refund/impaye status persistence during re-sync.
- `commission-health-report`: Updates to health monitoring logic.
- `deactivate-user`: Logic for user lifecycle management.

**Deployment Commands:**
```bash
supabase functions deploy sync-jotform
supabase functions deploy commission-health-report
supabase functions deploy deactivate-user
```
> [!IMPORTANT]
> The `sync-jotform` fix is the most critical. Until deployed, manual cron runs will overwrite refund flags in the database.

### 2. Create `set_refund_status` RPC
Implement an atomic database function to ensure `refunds` and `sales` tables remain synchronized.

**SQL Migration:**
```sql
create or replace function set_refund_status(p_refund_id uuid, p_status text)
returns void language plpgsql as $$
begin
  update refunds set status = p_status where id = p_refund_id;
  update sales set refunded = (p_status = 'approved')
    where id = (select sale_id from refunds where id = p_refund_id);
end;
$$;
```

### 3. Verify Cron Job Health
Ensure the data synchronization pipeline is active and reliable.
- Confirm the GitHub Actions workflow file exists.
- Verify `SETTER_DASHBOARD_CRON_SECRET` is configured in repository secrets.
- Check the "Last Run" timestamp in the `AutoSyncStatus` card (Settings page).

---

## 🛠️ Short-term (1–2 Weeks)

### 4. Row-Level Security (RLS) Implementation
Secure sensitive data at the database level to prevent unauthorized access via API/DevTools.

- **`sales`**: Users can only read rows where `closer_id` or `setter_id` matches their `auth.uid()`. Admins have full access.
- **`call_analyses`**: Restricted to the associated `closer_id` or Admins.
- **`profiles`**: Public read for names (dropdowns), but write access limited to Admins or the owner.

### 5. Commission Rate Validation
Prevent catastrophic data entry errors (e.g., entering `88` instead of `0.088`).
- Add logic in `GlobalIntegrationSettings` to warn/block if `closer_commission_rate` > 1.

### 6. Expand Financial Test Suite
Increase coverage for core commission logic to ensure reliability.
- `bonusCalculation.test.ts`: Tier boundaries, PIF accumulation, zero-sales months.
- `commissionRates.test.ts`: Ensure frontend constants align with `global_settings`.
- `useSales.test.ts`: Verify `mapSale` correctly processes all database columns.

---

## 📈 Medium-term (1 Month)

### 7. Automated Email Notifications
Implement notifications via Supabase (Resend/SendGrid integration) for:
- **Refund Approvals**: Notify closers of commission clawbacks.
- **Bonus Milestones**: Notify setters when they hit a new tier.
- **Sync Failures**: Alert admins after 3 consecutive JotForm sync failures.

### 8. Commission Override Audit Log
Track all manual changes to commission amounts for dispute resolution.

**New Table Structure:**
```sql
create table commission_audit_log (
  id uuid default gen_random_uuid(),
  sale_id uuid references sales,
  changed_by uuid references profiles,
  old_amount numeric, 
  new_amount numeric,
  changed_at timestamptz default now()
);
```

### 9. Dedicated Password Reset Page
Improve the user experience for password recovery.
- Create `/password-reset` (or similar) to handle Supabase `type: 'recovery'` tokens.
- Replace the current redirect-to-dashboard behavior with a dedicated "Set New Password" form.

---

## 📊 Summary Table

| Priority | Task | Rationale |
| :--- | :--- | :--- |
| **Now** | Deploy 3 Edge Functions | Refund bug is live in production |
| **Now** | `set_refund_status` RPC | Prevents refund/sale desync |
| **Now** | Verify Cron Job | Prevents stale data for all users |
| **1-2 Weeks** | RLS on Sales + Calls | Security: Prevents cross-user data leaks |
| **1-2 Weeks** | Rate Validation UI | Prevents 88x commission payout typos |
| **1-2 Weeks** | Expand Test Suite | Ensures financial logic stability |
| **1 Month** | Email Notifications | Reduces disputes and improves transparency |
| **1 Month** | Audit Log for Overrides | Required for accountability and disputes |
| **1 Month** | Password Reset Page | Fixes broken "Recovery" link UX |
