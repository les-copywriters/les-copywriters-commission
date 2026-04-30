import { describe, it, expect } from "vitest";
import { CLOSER_RATE, SETTER_RATE } from "@/lib/commissionRates";

// Pure commission calculation logic extracted from useAddSale for unit testing.
// The mutation itself requires a live Supabase connection.
function computeCommissions(amountTTC: number, taxAmount: number, hasSetterId: boolean) {
  const amountHT = Math.round((amountTTC - taxAmount) * 100) / 100;
  const closerCommission = Math.round(amountHT * CLOSER_RATE * 100) / 100;
  const setterCommission = hasSetterId ? Math.round(amountHT * SETTER_RATE * 100) / 100 : 0;
  return { amountHT, closerCommission, setterCommission };
}

describe("useAddSale commission computation", () => {
  it("computes HT from TTC and tax correctly", () => {
    const { amountHT } = computeCommissions(1200, 200, false);
    expect(amountHT).toBe(1000);
  });

  it("rounds HT to 2 decimal places", () => {
    const { amountHT } = computeCommissions(1199.99, 199.99, false);
    expect(amountHT).toBeCloseTo(1000, 2);
  });

  it("computes closer commission at 8.8%", () => {
    const { closerCommission } = computeCommissions(1200, 200, false);
    expect(closerCommission).toBe(88);
  });

  it("computes setter commission at 1.0% when setter present", () => {
    const { setterCommission } = computeCommissions(1200, 200, true);
    expect(setterCommission).toBe(10);
  });

  it("setter commission is 0 when no setter", () => {
    const { setterCommission } = computeCommissions(1200, 200, false);
    expect(setterCommission).toBe(0);
  });

  it("handles zero tax (full amount is HT)", () => {
    const { amountHT, closerCommission } = computeCommissions(500, 0, false);
    expect(amountHT).toBe(500);
    expect(closerCommission).toBe(44);
  });

  it("commissions are non-negative even on edge amounts", () => {
    const { closerCommission, setterCommission } = computeCommissions(0.01, 0, true);
    expect(closerCommission).toBeGreaterThanOrEqual(0);
    expect(setterCommission).toBeGreaterThanOrEqual(0);
  });
});
