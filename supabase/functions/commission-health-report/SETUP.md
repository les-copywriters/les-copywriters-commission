# Commission Health Report Function

This function generates an admin-only quality report and can optionally push it to Slack.

## Deploy

Run from `les-copywriters-commission`:

```bash
npx supabase functions deploy commission-health-report --project-ref YOUR_PROJECT_REF
```

## Optional Slack integration

Set your incoming webhook URL:

```bash
npx supabase secrets set SLACK_WEBHOOK_URL="https://hooks.slack.com/services/xxx/yyy/zzz" --project-ref YOUR_PROJECT_REF
```

## Usage

- Called from Admin page via `Run health report`.
- Sends Slack notification only when requested by the caller and when `SLACK_WEBHOOK_URL` exists.

## Report includes

- Refund count for current month
- Failed payments count for current week
- Discrepancy counts:
  - missing JotForm submission ID
  - missing client email
  - invalid amount
  - closer/setter profile mismatches
  - incomplete installment fields
