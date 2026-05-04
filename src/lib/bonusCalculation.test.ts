import { describe, it, expect } from "vitest";
import { calculateMonthBonus, monthlyBonusBreakdown } from "./bonusCalculation";
import type { BonusTier } from "./bonusCalculation";
import type { Sale } from "@/types";

const tiers: BonusTier[] = [
  { id: "t1", minSales: 5,  bonusAmount: 200 },
  { id: "t2", minSales: 10, bonusAmount: 500 },
  { id: "t3", minSales: 15, bonusAmount: 1000 },
];

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "s1",
    date: "2026-04-15",
    clientName: "Test Client",
    clientEmail: "test@example.com",
    product: "Offer A",
    closer: "Jean",
    setter: null,
    closerId: "c1",
    setterId: null,
    amount: 1000,
    closerCommission: 88,
    setterCommission: 10,
    refunded: false,
    impaye: false,
    paymentType: "pif",
    ...overrides,
  };
}

// ─── calculateMonthBonus ──────────────────────────────────────────────────────

describe("calculateMonthBonus", () => {
  it("returns zeros for an empty month", () => {
    const result = calculateMonthBonus([], tiers);
    expect(result.validatedCount).toBe(0);
    expect(result.pifCount).toBe(0);
    expect(result.pifBonus).toBe(0);
    expect(result.volumeBonus).toBe(0);
    expect(result.total).toBe(0);
    expect(result.volumeTier).toBeNull();
  });

  it("excludes refunded sales from validated count", () => {
    const sales = [makeSale(), makeSale({ id: "s2", refunded: true })];
    const result = calculateMonthBonus(sales, tiers);
    expect(result.validatedCount).toBe(1);
  });

  it("excludes impayé sales from validated count", () => {
    const sales = [makeSale(), makeSale({ id: "s2", impaye: true })];
    const result = calculateMonthBonus(sales, tiers);
    expect(result.validatedCount).toBe(1);
  });

  it("counts PIF sales and applies €50 bonus per sale", () => {
    const sales = [makeSale(), makeSale({ id: "s2" }), makeSale({ id: "s3", paymentType: "installments" })];
    const result = calculateMonthBonus(sales, tiers);
    expect(result.pifCount).toBe(2);
    expect(result.pifBonus).toBe(100); // 2 × €50
  });

  it("applies the correct volume tier at boundary", () => {
    const sales = Array.from({ length: 5 }, (_, i) => makeSale({ id: `s${i}` }));
    const result = calculateMonthBonus(sales, tiers);
    expect(result.volumeTier?.id).toBe("t1");
    expect(result.volumeBonus).toBe(200);
  });

  it("applies the highest unlocked tier, not just the first", () => {
    const sales = Array.from({ length: 12 }, (_, i) => makeSale({ id: `s${i}` }));
    const result = calculateMonthBonus(sales, tiers);
    expect(result.volumeTier?.id).toBe("t2");
    expect(result.volumeBonus).toBe(500);
  });

  it("returns no volume tier below the lowest threshold", () => {
    const sales = Array.from({ length: 4 }, (_, i) => makeSale({ id: `s${i}` }));
    const result = calculateMonthBonus(sales, tiers);
    expect(result.volumeTier).toBeNull();
    expect(result.volumeBonus).toBe(0);
  });

  it("accumulates PIF bonus + volume bonus in total", () => {
    // 10 PIF sales at tier 2 → pifBonus=500, volumeBonus=500, total=1000
    const sales = Array.from({ length: 10 }, (_, i) => makeSale({ id: `s${i}` }));
    const result = calculateMonthBonus(sales, tiers);
    expect(result.pifBonus).toBe(500);
    expect(result.volumeBonus).toBe(500);
    expect(result.total).toBe(1000);
  });

  it("returns no bonus with empty tier list", () => {
    const sales = Array.from({ length: 20 }, (_, i) => makeSale({ id: `s${i}` }));
    const result = calculateMonthBonus(sales, []);
    expect(result.volumeTier).toBeNull();
    expect(result.volumeBonus).toBe(0);
  });
});

// ─── monthlyBonusBreakdown ────────────────────────────────────────────────────

describe("monthlyBonusBreakdown", () => {
  it("groups sales by calendar month", () => {
    const sales = [
      makeSale({ id: "s1", date: "2026-01-10" }),
      makeSale({ id: "s2", date: "2026-01-20" }),
      makeSale({ id: "s3", date: "2026-02-05" }),
    ];
    const result = monthlyBonusBreakdown(sales, tiers);
    expect(result).toHaveLength(2);
    const months = result.map(r => r.month);
    expect(months).toContain("2026-01");
    expect(months).toContain("2026-02");
  });

  it("returns months sorted latest-first", () => {
    const sales = [
      makeSale({ id: "s1", date: "2026-01-01" }),
      makeSale({ id: "s2", date: "2026-03-01" }),
      makeSale({ id: "s3", date: "2026-02-01" }),
    ];
    const result = monthlyBonusBreakdown(sales, tiers);
    expect(result[0].month).toBe("2026-03");
    expect(result[2].month).toBe("2026-01");
  });

  it("returns empty array for no sales", () => {
    expect(monthlyBonusBreakdown([], tiers)).toHaveLength(0);
  });

  it("each month entry has the correct validated count", () => {
    const sales = [
      makeSale({ id: "s1", date: "2026-01-10" }),
      makeSale({ id: "s2", date: "2026-01-20" }),
      makeSale({ id: "s3", date: "2026-01-25", refunded: true }), // should not count
    ];
    const result = monthlyBonusBreakdown(sales, tiers);
    const jan = result.find(r => r.month === "2026-01");
    expect(jan?.validatedCount).toBe(2);
  });

  it("applies tier correctly in monthly context", () => {
    // 10 sales in April → tier2 (500€ volume + 500€ PIF = 1000€)
    const sales = Array.from({ length: 10 }, (_, i) =>
      makeSale({ id: `s${i}`, date: "2026-04-15" })
    );
    const result = monthlyBonusBreakdown(sales, tiers);
    const april = result.find(r => r.month === "2026-04");
    expect(april?.volumeBonus).toBe(500);
    expect(april?.pifBonus).toBe(500); // 10 × €50
    expect(april?.total).toBe(1000);
  });

  it("a single sale triggers no volume tier but a PIF bonus", () => {
    const sales = [makeSale({ id: "s1", date: "2026-02-10" })];
    const result = monthlyBonusBreakdown(sales, tiers);
    const feb = result.find(r => r.month === "2026-02");
    expect(feb?.volumeTier).toBeNull();
    expect(feb?.pifBonus).toBe(50); // 1 × €50
    expect(feb?.total).toBe(50);
  });

  it("all refunded in a month → zero bonus", () => {
    const sales = Array.from({ length: 10 }, (_, i) =>
      makeSale({ id: `s${i}`, date: "2026-03-10", refunded: true })
    );
    const result = monthlyBonusBreakdown(sales, tiers);
    const march = result.find(r => r.month === "2026-03");
    expect(march?.total).toBe(0);
    expect(march?.volumeTier).toBeNull();
  });
});

// ── calculateMonthBonus edge cases ────────────────────────────────────────────

describe("calculateMonthBonus — additional edge cases", () => {
  it("installment sales count toward validated total for tier", () => {
    // Mix of PIF and installments — all count toward the volume tier
    const sales = [
      ...Array.from({ length: 5 }, (_, i) => ({ id: `pif${i}`, date: "2026-04-01", clientName: "C", clientEmail: "c@c.com", product: "P", closer: "J", setter: null, closerId: "c1", setterId: null, amount: 1000, closerCommission: 88, setterCommission: 10, refunded: false, impaye: false, paymentType: "pif" as const })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: `inst${i}`, date: "2026-04-01", clientName: "C", clientEmail: "c@c.com", product: "P", closer: "J", setter: null, closerId: "c1", setterId: null, amount: 1000, closerCommission: 88, setterCommission: 10, refunded: false, impaye: false, paymentType: "installments" as const })),
    ];
    const tiers2 = [{ id: "t1", minSales: 10, bonusAmount: 500 }];
    const result = calculateMonthBonus(sales, tiers2);
    expect(result.validatedCount).toBe(10);
    expect(result.volumeTier?.id).toBe("t1");
    expect(result.pifCount).toBe(5); // only PIF sales
    expect(result.pifBonus).toBe(250); // 5 × €50
  });

  it("exactly at tier boundary triggers tier", () => {
    const tiers2 = [{ id: "t1", minSales: 3, bonusAmount: 150 }];
    const sales = Array.from({ length: 3 }, (_, i) => ({ id: `s${i}`, date: "2026-04-01", clientName: "C", clientEmail: "c@c.com", product: "P", closer: "J", setter: null, closerId: "c1", setterId: null, amount: 1000, closerCommission: 88, setterCommission: 10, refunded: false, impaye: false, paymentType: "pif" as const }));
    const result = calculateMonthBonus(sales, tiers2);
    expect(result.volumeTier?.id).toBe("t1");
  });

  it("one below tier boundary does NOT trigger tier", () => {
    const tiers2 = [{ id: "t1", minSales: 3, bonusAmount: 150 }];
    const sales = Array.from({ length: 2 }, (_, i) => ({ id: `s${i}`, date: "2026-04-01", clientName: "C", clientEmail: "c@c.com", product: "P", closer: "J", setter: null, closerId: "c1", setterId: null, amount: 1000, closerCommission: 88, setterCommission: 10, refunded: false, impaye: false, paymentType: "pif" as const }));
    const result = calculateMonthBonus(sales, tiers2);
    expect(result.volumeTier).toBeNull();
  });
});
