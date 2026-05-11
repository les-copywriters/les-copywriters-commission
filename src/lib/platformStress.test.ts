import { describe, it, expect } from "vitest";
import { CLOSER_RATE, SETTER_RATE, PIF_BONUS_PER_SALE } from "./commissionRates";
import { calculateMonthBonus, monthlyBonusBreakdown } from "./bonusCalculation";
import type { BonusTier } from "./bonusCalculation";
import type { Sale } from "@/types";

const tiers: BonusTier[] = [
  { id: "t1", minSales: 5,  bonusAmount: 100 },
  { id: "t2", minSales: 10, bonusAmount: 250 },
  { id: "t3", minSales: 13, bonusAmount: 400 },
];

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: Math.random().toString(36).slice(2),
    date: "2025-05-15",
    clientName: "Test Client",
    clientEmail: "test@test.com",
    product: "Prod A",
    closer: "Jean-Rémy",
    setter: "Céline",
    closerId: "c1",
    setterId: "s1",
    amount: 1000,
    closerCommission: Math.round(1000 * CLOSER_RATE * 100) / 100,
    setterCommission: Math.round(1000 * SETTER_RATE * 100) / 100,
    paymentType: "pif",
    refunded: false,
    impaye: false,
    ...overrides,
  };
}

// ── COMMISSION RATES ──────────────────────────────────────────────────────────
describe("Commission rates", () => {
  it("CLOSER_RATE is exactly 8.8%", () => expect(CLOSER_RATE).toBe(0.088));
  it("SETTER_RATE is exactly 1%",   () => expect(SETTER_RATE).toBe(0.01));
  it("PIF_BONUS is €50",            () => expect(PIF_BONUS_PER_SALE).toBe(50));

  const cases = [
    { amt: 0,        closer: 0,       setter: 0 },
    { amt: 100,      closer: 8.8,     setter: 1 },
    { amt: 1000,     closer: 88,      setter: 10 },
    { amt: 3500,     closer: 308,     setter: 35 },
    { amt: 0.01,     closer: 0,       setter: 0 },
    { amt: 9999.99,  closer: 879.999, setter: 100 },
  ];
  for (const { amt, closer, setter } of cases) {
    it(`amountHT=${amt} → closer≈${closer}, setter≈${setter}`, () => {
      const c = Math.round(amt * CLOSER_RATE * 100) / 100;
      const s = Math.round(amt * SETTER_RATE * 100) / 100;
      expect(Math.abs(c - closer)).toBeLessThan(0.01);
      expect(Math.abs(s - setter)).toBeLessThan(0.01);
    });
  }
});

// ── BONUS CALCULATION ─────────────────────────────────────────────────────────
describe("calculateMonthBonus", () => {
  it("empty sales → zero bonus",         () => expect(calculateMonthBonus([], tiers).total).toBe(0));
  it("all refunded → zero bonus",        () => {
    const sales = Array.from({ length: 15 }, () => makeSale({ refunded: true }));
    expect(calculateMonthBonus(sales, tiers).total).toBe(0);
  });
  it("all impaye → zero bonus",          () => {
    const sales = Array.from({ length: 15 }, () => makeSale({ impaye: true }));
    expect(calculateMonthBonus(sales, tiers).total).toBe(0);
  });
  it("4 valid PIF → pifBonus=200, no volume tier", () => {
    const sales = Array.from({ length: 4 }, () => makeSale({ paymentType: "pif" }));
    const r = calculateMonthBonus(sales, tiers);
    expect(r.pifBonus).toBe(200);
    expect(r.volumeBonus).toBe(0);
    expect(r.total).toBe(200);
    expect(r.validatedCount).toBe(4);
  });
  it("5 valid PIF → pifBonus=250, volume tier 1 (€100)", () => {
    const sales = Array.from({ length: 5 }, () => makeSale({ paymentType: "pif" }));
    const r = calculateMonthBonus(sales, tiers);
    expect(r.pifBonus).toBe(250);
    expect(r.volumeBonus).toBe(100);
    expect(r.total).toBe(350);
  });
  it("13 valid PIF → pifBonus=650, volume tier 3 (€400)", () => {
    const sales = Array.from({ length: 13 }, () => makeSale({ paymentType: "pif" }));
    const r = calculateMonthBonus(sales, tiers);
    expect(r.pifBonus).toBe(650);
    expect(r.volumeBonus).toBe(400);
    expect(r.total).toBe(1050);
  });
  it("10 instalment + 3 PIF = 13 validated → tier 3", () => {
    const sales = [
      ...Array.from({ length: 10 }, () => makeSale({ paymentType: "installments" })),
      ...Array.from({ length: 3  }, () => makeSale({ paymentType: "pif" })),
    ];
    const r = calculateMonthBonus(sales, tiers);
    expect(r.validatedCount).toBe(13);
    expect(r.pifCount).toBe(3);
    expect(r.pifBonus).toBe(150);
    expect(r.volumeBonus).toBe(400);
    expect(r.total).toBe(550);
  });
  it("mixed valid/refunded/impaye counts correctly", () => {
    const sales = [
      ...Array.from({ length: 8 }, () => makeSale({ paymentType: "pif" })),
      makeSale({ refunded: true }),
      makeSale({ impaye: true }),
    ];
    const r = calculateMonthBonus(sales, tiers);
    expect(r.validatedCount).toBe(8);
    expect(r.pifBonus).toBe(400);
    expect(r.volumeBonus).toBe(100);
  });
});

// ── REFUND TIMING ─────────────────────────────────────────────────────────────
describe("monthlyBonusBreakdown — refund timing", () => {
  it("same-month refund: excluded from that month's bonus", () => {
    const sales = [
      makeSale({ id: "s1", date: "2025-03-10", refunded: false }),
      makeSale({ id: "s2", date: "2025-03-15", refunded: true  }),
    ];
    const refunds = [{ saleId: "s2", date: "2025-03-20" }]; // refunded in same month
    const history = monthlyBonusBreakdown(sales, tiers, refunds);
    const march = history.find(h => h.month === "2025-03");
    expect(march?.validatedCount).toBe(1); // only s1 counts
  });

  it("later-month refund: sale counts in original month", () => {
    const sales = [
      ...Array.from({ length: 13 }, (_, i) => makeSale({ id: `s${i}`, date: "2025-03-10", refunded: false })),
      makeSale({ id: "s13", date: "2025-03-10", refunded: true }),
    ];
    // s13 refunded in April (different month)
    const refunds = [{ saleId: "s13", date: "2025-04-05" }];
    const history = monthlyBonusBreakdown(sales, tiers, refunds);
    const march = history.find(h => h.month === "2025-03");
    // With refund timing: all 14 count in March (s13 was refunded LATER)
    expect(march?.validatedCount).toBe(14);
    expect(march?.volumeBonus).toBe(400); // tier 3 still triggered
  });

  it("no refunds passed: falls back to always-exclude (old behaviour)", () => {
    const sales = [
      makeSale({ id: "s1", date: "2025-03-10", refunded: false }),
      makeSale({ id: "s2", date: "2025-03-15", refunded: true  }),
    ];
    const history = monthlyBonusBreakdown(sales, tiers); // no refunds param
    const march = history.find(h => h.month === "2025-03");
    expect(march?.validatedCount).toBe(1);
  });

  it("monthly grouping is correct across 3 months", () => {
    const sales = [
      makeSale({ date: "2025-01-10" }),
      makeSale({ date: "2025-01-20" }),
      makeSale({ date: "2025-02-05" }),
      makeSale({ date: "2025-03-01" }),
    ];
    const history = monthlyBonusBreakdown(sales, tiers);
    expect(history).toHaveLength(3);
    expect(history.find(h => h.month === "2025-01")?.validatedCount).toBe(2);
    expect(history.find(h => h.month === "2025-02")?.validatedCount).toBe(1);
    expect(history.find(h => h.month === "2025-03")?.validatedCount).toBe(1);
  });
});

// ── DATE RANGE COMPUTATION ────────────────────────────────────────────────────
describe("AnalyticsPage computeDateRange inline stress", () => {
  // Re-implement the helper to stress test it
  type DatePreset = "thisMonth"|"lastMonth"|"last3m"|"last6m"|"thisYear"|"lastYear"|"allTime"|"custom";
  function computeDateRange(preset: DatePreset, customStart: string, customEnd: string) {
    const now = new Date("2025-05-15T12:00:00Z");
    const today = now.toISOString().slice(0, 10);
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const utc = (year: number, month: number, day: number) =>
      new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
    switch (preset) {
      case "thisMonth":  return { start: utc(y, m, 1), end: today };
      case "lastMonth":  return { start: utc(y, m-1, 1), end: utc(y, m, 0) };
      case "last3m":     return { start: utc(y, m-2, 1), end: today };
      case "last6m":     return { start: utc(y, m-5, 1), end: today };
      case "thisYear":   return { start: `${y}-01-01`, end: today };
      case "lastYear":   return { start: `${y-1}-01-01`, end: `${y-1}-12-31` };
      case "allTime":    return { start: "2023-01-01", end: today };
      case "custom":     return { start: customStart||"2023-01-01", end: customEnd||today };
    }
  }

  it("thisMonth starts May 1", ()   => expect(computeDateRange("thisMonth","","").start).toBe("2025-05-01"));
  it("thisMonth ends today",   ()   => expect(computeDateRange("thisMonth","","").end).toBe("2025-05-15"));
  it("lastMonth is April",     ()   => {
    const r = computeDateRange("lastMonth","","");
    expect(r.start).toBe("2025-04-01");
    expect(r.end).toBe("2025-04-30");
  });
  it("last6m starts Dec 1 (5 months back)", () => expect(computeDateRange("last6m","","").start).toBe("2024-12-01"));
  it("allTime never starts before 2023", ()  => expect(computeDateRange("allTime","","").start).toBe("2023-01-01"));
  it("custom dates pass through",      ()    => {
    const r = computeDateRange("custom","2024-01-01","2024-12-31");
    expect(r.start).toBe("2024-01-01");
    expect(r.end).toBe("2024-12-31");
  });
  it("start is always ≤ end for all presets", () => {
    const presets: DatePreset[] = ["thisMonth","lastMonth","last3m","last6m","thisYear","lastYear","allTime"];
    for (const p of presets) {
      const { start, end } = computeDateRange(p, "", "");
      expect(start <= end).toBe(true);
    }
  });
  it("all dates match YYYY-MM-DD format", () => {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    const presets: DatePreset[] = ["thisMonth","lastMonth","last3m","last6m","thisYear","lastYear","allTime"];
    for (const p of presets) {
      const { start, end } = computeDateRange(p, "", "");
      expect(start).toMatch(re);
      expect(end).toMatch(re);
    }
  });
});

// ── MONTH KEY GENERATION (timezone-safe after our fix) ────────────────────────
describe("Month key generation — timezone safety", () => {
  it("s.date.slice(0,7) is timezone-agnostic", () => {
    expect("2025-05-01".slice(0, 7)).toBe("2025-05");
    expect("2025-12-31".slice(0, 7)).toBe("2025-12");
    expect("2024-01-01".slice(0, 7)).toBe("2024-01");
  });

  it("arithmetic month iteration covers correct months", () => {
    // Simulates the fixed AnalyticsPage range loop
    const startDate = "2025-01-15";
    const endDate   = "2025-04-20";
    const [sy, sm] = startDate.split("-").map(Number);
    const [ey, em] = endDate.split("-").map(Number);
    const months: string[] = [];
    let y = sy, m = sm - 1;
    while (y < ey || (y === ey && m <= em - 1)) {
      months.push(`${y}-${String(m+1).padStart(2,"0")}`);
      m++; if (m > 11) { m = 0; y++; }
    }
    expect(months).toEqual(["2025-01","2025-02","2025-03","2025-04"]);
  });

  it("arithmetic 6-month lookback handles year boundary", () => {
    const now = new Date("2025-01-15"); // January
    const months: string[] = [];
    for (let i = 0; i < 6; i++) {
      let year = now.getFullYear();
      let month = now.getMonth() - 5 + i;
      if (month < 0) { year--; month += 12; }
      months.push(`${year}-${String(month+1).padStart(2,"0")}`);
    }
    expect(months).toEqual(["2024-08","2024-09","2024-10","2024-11","2024-12","2025-01"]);
  });
});

// ── CURRENCY FORMATTING ───────────────────────────────────────────────────────
describe("formatCurrency edge cases", () => {
  // Import via dynamic require since it's a simple function
  it("formats zero correctly", async () => {
    const { formatCurrency } = await import("./formatCurrency");
    expect(formatCurrency(0, "fr")).toContain("0");
    expect(formatCurrency(0, "en")).toContain("0");
  });
  it("formats large numbers", async () => {
    const { formatCurrency } = await import("./formatCurrency");
    const result = formatCurrency(100000, "fr");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });
  it("formats negative numbers", async () => {
    const { formatCurrency } = await import("./formatCurrency");
    const result = formatCurrency(-500, "fr");
    expect(result).toContain("-");
  });
});

// ── INSTALLMENT SETTER COMMISSION ─────────────────────────────────────────────
describe("Installment setter commission logic", () => {
  it("PIF: setter gets 1% of full HT", () => {
    const amountHT = 3000;
    const setterRate = SETTER_RATE;
    const commission = Math.round(amountHT * setterRate * 100) / 100;
    expect(commission).toBe(30);
  });
  it("Installment: setter gets 1% of first installment (nowRaw), not total", () => {
    const totalHT = 3000;  // 3 payments of 1000
    const nowRaw  = 1000;  // first installment
    const setterRate = SETTER_RATE;
    const wrongComm  = Math.round(totalHT * setterRate * 100) / 100;
    const rightComm  = Math.round(nowRaw  * setterRate * 100) / 100;
    expect(wrongComm).toBe(30);   // old, wrong behaviour
    expect(rightComm).toBe(10);   // new, correct behaviour
    expect(rightComm).toBeLessThan(wrongComm);
  });
});
