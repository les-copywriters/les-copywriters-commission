# JotForm Webhook — Setup Checklist

## Status: FIELD MAP CONFIGURED ✓ — Deploy pending

Form: https://form.jotform.com/241032303097344

---

## Field Mapping (verified 2025-04-07)

| Form field | Unique Name | Notes |
|---|---|---|
| Nom / Prénom | `fullName3` | Object `{ first, last }` — handled automatically |
| E-mail | `email6` | |
| Produit | `produit` | Copy Mastery, Coffre-Fort, Liberty IA, Scaling Circle |
| Montant facturé maintenant | `montantFacture` | Used as fallback if total price is missing |
| Prix de vente total | `prixDe` | Primary amount used for commission calculation |
| Plateforme utilisée | `plateformeUtilisee` | Whop, Stripe, Hotmart, WISE, Autre |
| Type de paiement | `typeDe42` | SeQura treated as installments; all others as PIF |
| Closé par | `typeDe36` | Must match a `closer` profile name exactly |
| Setter lié | `setterLie` | "Aucun" = no setter (setter_commission set to 0) |

**No date field on the form** — sale date defaults to the submission date (today).  
**No tax fields on the form** — amounts are treated as HT (ex-tax) directly.

---

## Step 1 — Deploy the Edge Function

Run this from the `les-copywriters-commission` directory:

```bash
npx supabase functions deploy jotform-webhook --project-ref YOUR_PROJECT_REF
```

Replace `YOUR_PROJECT_REF` with your Supabase project ref (Settings → General).

Optional but recommended security hardening:

```bash
npx supabase secrets set JOTFORM_WEBHOOK_SECRET="your-long-random-secret" --project-ref YOUR_PROJECT_REF
```

If `JOTFORM_WEBHOOK_SECRET` is set, the webhook requires header `x-webhook-secret` to match.

---

## Step 2 — Add the Webhook URL in JotForm

1. Open the form in JotForm
2. Go to **Settings → Integrations → WebHooks**
3. Add this URL:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/jotform-webhook
   ```
4. Save

If you enabled `JOTFORM_WEBHOOK_SECRET`, configure your webhook sender to include:

`x-webhook-secret: your-long-random-secret`

---

## Step 3 — Ensure profiles exist for all team members

The webhook looks up closer/setter by `name` in the `profiles` table.  
Make sure these names match exactly (including accents):

**Closers:** Yoann, Rachid, Jean-Rémy  
**Setters:** Céline, Jessica, Philippe, Andy

If a submission arrives with a name not in `profiles`, it is rejected with HTTP 422
and a message like `Closer not found in profiles: "..."`.

---

## Step 4 — Test

1. Submit a test entry in JotForm
2. Open Supabase → Table Editor → `sales`
3. Confirm a new row was created with:
   - Correct `client_name`, `product`, closer and setter IDs
   - `amount` = HT (the value from "Prix de vente total")
   - `closer_commission` = 8.8% of amount
   - `setter_commission` = 1% of amount (or 0 if setter was "Aucun")
   - `jotform_submission_id` filled (prevents duplicates on retry)

---

## Commission Logic

- Amounts on the form are treated as HT (ex-tax) — no tax fields exist
- **Closer commission**: `amount × 8.8%`
- **Setter commission**: `amount × 1%` (0 if "Aucun" selected)
- SeQura payment type is recorded as `payment_type = "installments"`
