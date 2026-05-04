import { describe, it, expect } from "vitest";
import { formatCurrency } from "./formatCurrency";

describe("formatCurrency", () => {
  // ── French locale ─────────────────────────────────────────────────────────
  it("formats whole euros in FR locale", () => {
    const result = formatCurrency(1000, "fr");
    expect(result).toContain("1");
    expect(result).toContain("000");
    expect(result).toContain("€");
  });

  it("formats cents correctly in FR locale", () => {
    const result = formatCurrency(88.50, "fr");
    expect(result).toContain("88");
    expect(result).toContain("50");
  });

  it("formats zero in FR locale", () => {
    const result = formatCurrency(0, "fr");
    expect(result).toContain("0");
    expect(result).toContain("€");
  });

  // ── English locale ────────────────────────────────────────────────────────
  it("formats whole euros in EN locale", () => {
    const result = formatCurrency(1000, "en");
    expect(result).toContain("1,000");
    expect(result).toContain("€");
  });

  it("formats fractional amount in EN locale", () => {
    const result = formatCurrency(88.50, "en");
    expect(result).toContain("88");
    expect(result).toContain("50");
  });

  // ── Rounding ──────────────────────────────────────────────────────────────
  it("rounds to 2 decimal places", () => {
    const result = formatCurrency(88.888, "en");
    // Should round to 88.89
    expect(result).toContain("88.89");
  });

  it("does not show more than 2 decimal places", () => {
    const result = formatCurrency(100.1, "en");
    // "€100.10" — no 3rd decimal
    expect(result).not.toMatch(/\.\d{3}/);
  });

  // ── Edge values ───────────────────────────────────────────────────────────
  it("handles very large amounts", () => {
    const result = formatCurrency(1_000_000, "en");
    expect(result).toContain("1,000,000");
    expect(result).toContain("€");
  });

  it("handles negative amounts", () => {
    const result = formatCurrency(-500, "en");
    expect(result).toContain("500");
    expect(result).toContain("€");
  });

  it("returns a string in both locales", () => {
    expect(typeof formatCurrency(100, "fr")).toBe("string");
    expect(typeof formatCurrency(100, "en")).toBe("string");
  });

  // ── Commission-specific amounts ───────────────────────────────────────────
  it("formats typical closer commission correctly (€88.00)", () => {
    const result = formatCurrency(88, "en");
    expect(result).toContain("88");
    expect(result).toContain("€");
  });

  it("formats typical sale amount correctly (€4000)", () => {
    const result = formatCurrency(4000, "en");
    expect(result).toContain("4,000");
  });
});
