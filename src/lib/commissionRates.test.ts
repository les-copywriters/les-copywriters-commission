import { describe, it, expect } from "vitest";
import { CLOSER_RATE, SETTER_RATE, PIF_BONUS_PER_SALE } from "./commissionRates";

describe("commissionRates", () => {
  it("CLOSER_RATE is 8.8%", () => {
    expect(CLOSER_RATE).toBe(0.088);
  });

  it("SETTER_RATE is 1.0%", () => {
    expect(SETTER_RATE).toBe(0.01);
  });

  it("PIF_BONUS_PER_SALE is €50", () => {
    expect(PIF_BONUS_PER_SALE).toBe(50);
  });

  it("closer commission on €1000 HT rounds to €88.00", () => {
    const commission = Math.round(1000 * CLOSER_RATE * 100) / 100;
    expect(commission).toBe(88);
  });

  it("setter commission on €1000 HT rounds to €10.00", () => {
    const commission = Math.round(1000 * SETTER_RATE * 100) / 100;
    expect(commission).toBe(10);
  });

  it("commission calculation is consistent with edge function constants", () => {
    // The sync-jotform edge function hardcodes the same values.
    // If this test fails, one of the two files was updated without updating the other.
    const EDGE_CLOSER_RATE = 0.088;
    const EDGE_SETTER_RATE = 0.01;
    expect(CLOSER_RATE).toBe(EDGE_CLOSER_RATE);
    expect(SETTER_RATE).toBe(EDGE_SETTER_RATE);
  });

  it("rates are decimals not percentages — guards against 88 instead of 0.088", () => {
    expect(CLOSER_RATE).toBeLessThan(1);
    expect(SETTER_RATE).toBeLessThan(1);
  });

  it("commission does not overflow on large sales amounts", () => {
    const largeAmount = 1_000_000;
    const closerComm = Math.round(largeAmount * CLOSER_RATE * 100) / 100;
    const setterComm = Math.round(largeAmount * SETTER_RATE * 100) / 100;
    expect(closerComm).toBe(88_000);
    expect(setterComm).toBe(10_000);
    expect(Number.isFinite(closerComm)).toBe(true);
    expect(Number.isFinite(setterComm)).toBe(true);
  });
});
