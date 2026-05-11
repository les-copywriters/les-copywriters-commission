import { Sale } from "@/types";
import { PIF_BONUS_PER_SALE } from "./commissionRates";

export type BonusTier = {
  id: string;
  minSales: number;
  bonusAmount: number;
};

export type MonthlyBonus = {
  month: string;           // "2024-03"
  validatedCount: number;  // total validated (not refunded, not impayé)
  pifCount: number;
  pifBonus: number;
  volumeTier: BonusTier | null;
  volumeBonus: number;
  total: number;
};

/** Compute the monthly bonus for a set of same-month sales. */
export function calculateMonthBonus(sales: Sale[], tiers: BonusTier[]): Omit<MonthlyBonus, "month"> {
  const validated = sales.filter(s => !s.refunded && !s.impaye);
  const pifCount   = validated.filter(s => s.paymentType === "pif").length;
  const pifBonus   = pifCount * PIF_BONUS_PER_SALE;

  const validatedCount = validated.length;
  const sortedTiers    = [...tiers].sort((a, b) => b.minSales - a.minSales);
  const volumeTier     = sortedTiers.find(t => validatedCount >= t.minSales) ?? null;
  const volumeBonus    = volumeTier?.bonusAmount ?? 0;

  return { validatedCount, pifCount, pifBonus, volumeTier, volumeBonus, total: pifBonus + volumeBonus };
}

/**
 * Group a closer's sales by YYYY-MM and compute per-month bonus.
 *
 * Refund timing rule (from owner):
 * - Same-month refund: sale is not counted at all in bonus (excluded).
 * - Later-month refund: the sale WAS valid at month-end, so it counts in
 *   its original month's bonus. The commission clawback appears in the
 *   refund month's payment — it does not retroactively remove the bonus.
 *
 * Pass the closer's refunds (with their date) so timing can be determined.
 * If refunds are omitted, falls back to the old behaviour (always exclude).
 */
export function monthlyBonusBreakdown(
  sales: Sale[],
  tiers: BonusTier[],
  refunds: { saleId: string; date: string }[] = [],
): MonthlyBonus[] {
  // Build a lookup of saleId → refund month ("YYYY-MM")
  const refundMonthBySaleId = new Map<string, string>();
  for (const r of refunds) {
    refundMonthBySaleId.set(r.saleId, r.date.slice(0, 7));
  }

  const map = new Map<string, Sale[]>();

  for (const s of sales) {
    const saleMonth = s.date.slice(0, 7);

    if (s.refunded) {
      const refundMonth = refundMonthBySaleId.get(s.id);

      if (!refundMonth || refundMonth === saleMonth) {
        // Same-month refund (or no refund date): exclude from bonus entirely.
        (map.get(saleMonth) ?? map.set(saleMonth, []).get(saleMonth)!).push(s);
      } else {
        // Later-month refund: sale was valid when the month closed.
        // Count it in its original month as if not refunded.
        (map.get(saleMonth) ?? map.set(saleMonth, []).get(saleMonth)!).push(
          { ...s, refunded: false },
        );
      }
    } else {
      (map.get(saleMonth) ?? map.set(saleMonth, []).get(saleMonth)!).push(s);
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, monthlySales]) => ({ month, ...calculateMonthBonus(monthlySales, tiers) }));
}

/** Format "2024-03" → "Mar 2024" / "Mars 2024" */
export function formatMonth(yearMonth: string, locale: string): string {
  const [year, month] = yearMonth.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { month: "short", year: "numeric" });
}
