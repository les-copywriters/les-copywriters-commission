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

/** Group a closer's sales by YYYY-MM, return sorted latest-first. */
export function monthlyBonusBreakdown(sales: Sale[], tiers: BonusTier[]): MonthlyBonus[] {
  const map = new Map<string, Sale[]>();
  for (const s of sales) {
    const month = s.date.slice(0, 7);
    (map.get(month) ?? map.set(month, []).get(month)!).push(s);
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
