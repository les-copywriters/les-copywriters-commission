/**
 * Stress tests for the date-range computation functions used by all dashboard
 * pages. Wrong date ranges silently show incorrect data to users, making these
 * high-priority to cover.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { computeSetterDateRange } from "./setterDashboard";

// Pin "today" to a fixed date so assertions are deterministic
const FIXED_TODAY = new Date("2026-05-02T12:00:00Z");

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED_TODAY); });
afterEach(() => { vi.useRealTimers(); });

describe("computeSetterDateRange", () => {
  // ── thisMonth ─────────────────────────────────────────────────────────────
  it("thisMonth starts on the 1st of current month", () => {
    const { start } = computeSetterDateRange("thisMonth", "", "");
    expect(start).toBe("2026-05-01");
  });

  it("thisMonth ends today", () => {
    const { end } = computeSetterDateRange("thisMonth", "", "");
    expect(end).toBe("2026-05-02");
  });

  // ── lastMonth ─────────────────────────────────────────────────────────────
  it("lastMonth starts on the 1st of the previous month", () => {
    const { start } = computeSetterDateRange("lastMonth", "", "");
    expect(start).toBe("2026-04-01");
  });

  it("lastMonth ends on the last day of the previous month", () => {
    const { end } = computeSetterDateRange("lastMonth", "", "");
    expect(end).toBe("2026-04-30");
  });

  it("lastMonth is correct when current month is January (crosses year)", () => {
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
    const { start, end } = computeSetterDateRange("lastMonth", "", "");
    expect(start).toBe("2025-12-01");
    expect(end).toBe("2025-12-31");
  });

  // ── last3m ────────────────────────────────────────────────────────────────
  it("last3m starts on the 1st, 2 months before current", () => {
    const { start } = computeSetterDateRange("last3m", "", "");
    expect(start).toBe("2026-03-01");
  });

  it("last3m ends today", () => {
    const { end } = computeSetterDateRange("last3m", "", "");
    expect(end).toBe("2026-05-02");
  });

  // ── last6m ────────────────────────────────────────────────────────────────
  it("last6m starts on the 1st, 5 months before current", () => {
    const { start } = computeSetterDateRange("last6m", "", "");
    expect(start).toBe("2025-12-01");
  });

  it("last6m ends today", () => {
    const { end } = computeSetterDateRange("last6m", "", "");
    expect(end).toBe("2026-05-02");
  });

  // ── thisYear ──────────────────────────────────────────────────────────────
  it("thisYear starts on Jan 1st of current year", () => {
    const { start } = computeSetterDateRange("thisYear", "", "");
    expect(start).toBe("2026-01-01");
  });

  it("thisYear ends today", () => {
    const { end } = computeSetterDateRange("thisYear", "", "");
    expect(end).toBe("2026-05-02");
  });

  // ── lastYear ──────────────────────────────────────────────────────────────
  it("lastYear starts on Jan 1 of previous year", () => {
    const { start } = computeSetterDateRange("lastYear", "", "");
    expect(start).toBe("2025-01-01");
  });

  it("lastYear ends on Dec 31 of previous year", () => {
    const { end } = computeSetterDateRange("lastYear", "", "");
    expect(end).toBe("2025-12-31");
  });

  // ── allTime ───────────────────────────────────────────────────────────────
  it("allTime starts from 2023 (business start, not 2000)", () => {
    const { start } = computeSetterDateRange("allTime", "", "");
    expect(start).toBe("2023-01-01");
    // Critical: must NOT be the old "2000-01-01" which caused chart distortion
    expect(start).not.toBe("2000-01-01");
  });

  it("allTime ends today", () => {
    const { end } = computeSetterDateRange("allTime", "", "");
    expect(end).toBe("2026-05-02");
  });

  // ── custom ────────────────────────────────────────────────────────────────
  it("custom uses provided start and end", () => {
    const { start, end } = computeSetterDateRange("custom", "2026-01-15", "2026-03-31");
    expect(start).toBe("2026-01-15");
    expect(end).toBe("2026-03-31");
  });

  it("custom defaults to 2023 start when no customStart provided", () => {
    const { start } = computeSetterDateRange("custom", "", "2026-03-31");
    expect(start).toBe("2023-01-01");
  });

  it("custom defaults to today when no customEnd provided", () => {
    const { end } = computeSetterDateRange("custom", "2026-01-01", "");
    expect(end).toBe("2026-05-02");
  });

  // ── Invariants ────────────────────────────────────────────────────────────
  it("start is always before or equal to end for all presets", () => {
    const presets = ["thisMonth", "lastMonth", "last3m", "last6m", "thisYear", "lastYear", "allTime"] as const;
    for (const preset of presets) {
      const { start, end } = computeSetterDateRange(preset, "", "");
      expect(start <= end).toBe(true);
    }
  });

  it("all date strings match YYYY-MM-DD format", () => {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const presets = ["thisMonth", "lastMonth", "last3m", "last6m", "thisYear", "lastYear", "allTime"] as const;
    for (const preset of presets) {
      const { start, end } = computeSetterDateRange(preset, "", "");
      expect(start).toMatch(datePattern);
      expect(end).toMatch(datePattern);
    }
  });
});
