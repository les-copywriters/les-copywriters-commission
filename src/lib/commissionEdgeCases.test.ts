/**
 * Stress tests for commission arithmetic edge cases.
 * Covers rounding, floating-point traps, and boundary amounts.
 */
import { describe, it, expect } from "vitest";
import { CLOSER_RATE, SETTER_RATE, PIF_BONUS_PER_SALE } from "./commissionRates";

// Mirroring the exact calculation used in AddSaleDialog and the sync engine
function calcCommissions(amountTTC: number, taxAmount: number, hasSetterId: boolean) {
  const amountHT = Math.round((amountTTC - taxAmount) * 100) / 100;
  const closerCommission = Math.round(amountHT * CLOSER_RATE * 100) / 100;
  const setterCommission = hasSetterId ? Math.round(amountHT * SETTER_RATE * 100) / 100 : 0;
  return { amountHT, closerCommission, setterCommission };
}

describe("Commission arithmetic — rounding and precision", () => {
  it("typical €4000 HT sale: closer=€352, setter=€40", () => {
    const { closerCommission, setterCommission } = calcCommissions(4000, 0, true);
    expect(closerCommission).toBe(352);
    expect(setterCommission).toBe(40);
  });

  it("€3500 HT sale: closer=€308, setter=€35", () => {
    const { closerCommission, setterCommission } = calcCommissions(3500, 0, true);
    expect(closerCommission).toBe(308);
    expect(setterCommission).toBe(35);
  });

  it("€2400 HT sale: closer=€211.20, setter=€24", () => {
    const { closerCommission, setterCommission } = calcCommissions(2400, 0, true);
    expect(closerCommission).toBe(211.20);
    expect(setterCommission).toBe(24);
  });

  it("floating-point trap: 1.1 + 2.2 = 3.3 handled correctly", () => {
    // 1199.99 - 199.99 = 1000 exactly after rounding
    const { amountHT } = calcCommissions(1199.99, 199.99, false);
    expect(amountHT).toBeCloseTo(1000, 2);
  });

  it("commission sum never exceeds HT amount", () => {
    const amounts = [100, 500, 1000, 4000, 10000, 50000];
    for (const ht of amounts) {
      const { closerCommission, setterCommission } = calcCommissions(ht, 0, true);
      expect(closerCommission + setterCommission).toBeLessThan(ht);
    }
  });

  it("commissions are non-negative for any positive amount", () => {
    const { closerCommission, setterCommission } = calcCommissions(0.01, 0, true);
    expect(closerCommission).toBeGreaterThanOrEqual(0);
    expect(setterCommission).toBeGreaterThanOrEqual(0);
  });

  it("setter commission is exactly 0 when no setter", () => {
    const { setterCommission } = calcCommissions(4000, 0, false);
    expect(setterCommission).toBe(0);
  });

  it("zero-amount sale produces zero commissions", () => {
    const { closerCommission, setterCommission } = calcCommissions(0, 0, true);
    expect(closerCommission).toBe(0);
    expect(setterCommission).toBe(0);
  });

  it("with TVA: HT is correctly derived", () => {
    // 4800 TTC - 800 TVA = 4000 HT
    const { amountHT, closerCommission } = calcCommissions(4800, 800, false);
    expect(amountHT).toBe(4000);
    expect(closerCommission).toBe(352);
  });

  it("commissions are finite numbers for large amounts", () => {
    const { closerCommission, setterCommission } = calcCommissions(1_000_000, 0, true);
    expect(Number.isFinite(closerCommission)).toBe(true);
    expect(Number.isFinite(setterCommission)).toBe(true);
    expect(closerCommission).toBe(88_000);
    expect(setterCommission).toBe(10_000);
  });

  it("rates add up to 9.8% total (8.8% + 1.0%)", () => {
    expect(CLOSER_RATE + SETTER_RATE).toBeCloseTo(0.098, 3);
  });

  it("PIF bonus is exactly €50 per sale", () => {
    expect(PIF_BONUS_PER_SALE).toBe(50);
    // 10 PIF sales
    expect(PIF_BONUS_PER_SALE * 10).toBe(500);
  });
});

describe("Commission arithmetic — installment sales", () => {
  it("installment sale commission is calculated on full HT amount, not per installment", () => {
    // €4000 in 4 installments of €1000 each — commission is still on €4000
    const { closerCommission } = calcCommissions(4000, 0, false);
    expect(closerCommission).toBe(352); // 4000 × 8.8%
  });
});

describe("Commission arithmetic — refund/unpaid exclusion", () => {
  // These tests verify that refunded/impayé sales are properly excluded
  // from commission totals — critical for accurate payout calculations

  function sumValidatedCommissions(sales: Array<{
    amount: number; refunded: boolean; impaye: boolean;
  }>): number {
    return sales
      .filter(s => !s.refunded && !s.impaye)
      .reduce((sum, s) => sum + Math.round(s.amount * CLOSER_RATE * 100) / 100, 0);
  }

  it("excludes refunded sale from commission total", () => {
    const sales = [
      { amount: 1000, refunded: false, impaye: false }, // €88
      { amount: 1000, refunded: true,  impaye: false }, // should be excluded
    ];
    expect(sumValidatedCommissions(sales)).toBe(88);
  });

  it("excludes impayé sale from commission total", () => {
    const sales = [
      { amount: 1000, refunded: false, impaye: false }, // €88
      { amount: 2000, refunded: false, impaye: true  }, // should be excluded
    ];
    expect(sumValidatedCommissions(sales)).toBe(88);
  });

  it("all refunded returns zero commission", () => {
    const sales = [
      { amount: 4000, refunded: true, impaye: false },
      { amount: 3500, refunded: true, impaye: false },
    ];
    expect(sumValidatedCommissions(sales)).toBe(0);
  });

  it("mixed sales: only valid ones count", () => {
    const sales = [
      { amount: 4000, refunded: false, impaye: false }, // €352
      { amount: 4000, refunded: true,  impaye: false }, // excluded
      { amount: 4000, refunded: false, impaye: true  }, // excluded
      { amount: 4000, refunded: false, impaye: false }, // €352
    ];
    expect(sumValidatedCommissions(sales)).toBeCloseTo(704, 1);
  });
});
