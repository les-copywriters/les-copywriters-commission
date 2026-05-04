import { describe, it, expect } from "vitest";
import { computeSetterDashboardMetrics, formatTalkTime, safeRate } from "./setterDashboard";

// ── safeRate ──────────────────────────────────────────────────────────────────

describe("safeRate", () => {
  it("returns 0 for zero denominator", () => {
    expect(safeRate(3, 0)).toBe(0);
  });

  it("returns 0 for negative denominator", () => {
    expect(safeRate(3, -1)).toBe(0);
  });

  it("computes percentage correctly", () => {
    expect(safeRate(4, 5)).toBe(80);
  });

  it("returns 100 when numerator equals denominator", () => {
    expect(safeRate(10, 10)).toBe(100);
  });

  it("returns 0 when numerator is 0", () => {
    expect(safeRate(0, 100)).toBe(0);
  });

  it("handles fractional result", () => {
    expect(safeRate(1, 3)).toBeCloseTo(33.33, 1);
  });

  it("result is always finite", () => {
    expect(Number.isFinite(safeRate(0, 0))).toBe(true);
    expect(Number.isFinite(safeRate(100, 0))).toBe(true);
  });
});

// ── formatTalkTime ────────────────────────────────────────────────────────────

describe("formatTalkTime", () => {
  it("formats sub-hour as minutes only", () => {
    expect(formatTalkTime(1200)).toBe("20m");
    expect(formatTalkTime(3540)).toBe("59m");
  });

  it("formats exactly one hour", () => {
    expect(formatTalkTime(3600)).toBe("1h 0m");
  });

  it("formats hours and minutes", () => {
    expect(formatTalkTime(3900)).toBe("1h 5m");
    expect(formatTalkTime(7260)).toBe("2h 1m");
  });

  it("formats zero seconds", () => {
    expect(formatTalkTime(0)).toBe("0m");
  });

  it("formats seconds below one minute as 0m", () => {
    expect(formatTalkTime(59)).toBe("0m");
  });

  it("handles very long talk time (8 hours)", () => {
    expect(formatTalkTime(28800)).toBe("8h 0m");
  });

  it("always returns a string", () => {
    expect(typeof formatTalkTime(0)).toBe("string");
    expect(typeof formatTalkTime(3600)).toBe("string");
  });
});

// ── computeSetterDashboardMetrics ─────────────────────────────────────────────

describe("computeSetterDashboardMetrics", () => {
  it("handles empty inputs without throwing", () => {
    const result = computeSetterDashboardMetrics([], []);
    expect(result.summary.callsMade).toBe(0);
    expect(result.summary.showRate).toBe(0);
    expect(result.summary.closeRate).toBe(0);
    expect(result.points).toHaveLength(0);
  });

  it("aggregates multi-day call metrics correctly", () => {
    const result = computeSetterDashboardMetrics(
      [
        { profileId: "s1", metricDate: "2026-04-01", source: "aircall", callsMade: 10, callsAnswered: 7, talkTimeSeconds: 1800 },
        { profileId: "s1", metricDate: "2026-04-02", source: "aircall", callsMade: 15, callsAnswered: 12, talkTimeSeconds: 2700 },
      ],
      [],
    );
    expect(result.summary.callsMade).toBe(25);
    expect(result.summary.callsAnswered).toBe(19);
    expect(result.summary.talkTimeSeconds).toBe(4500);
    expect(result.points).toHaveLength(2);
  });

  it("showRate = showUps / leadsValidated × 100", () => {
    const result = computeSetterDashboardMetrics(
      [],
      [{ profileId: "s1", metricDate: "2026-04-01", source: "iclosed", leadsValidated: 10, leadsCanceled: 0, showUps: 8, closes: 4 }],
    );
    expect(result.summary.showRate).toBe(80);
  });

  it("closeRate = closes / showUps × 100", () => {
    const result = computeSetterDashboardMetrics(
      [],
      [{ profileId: "s1", metricDate: "2026-04-01", source: "iclosed", leadsValidated: 10, leadsCanceled: 0, showUps: 4, closes: 2 }],
    );
    expect(result.summary.closeRate).toBe(50);
  });

  it("showRate is 0 when no leadsValidated", () => {
    const result = computeSetterDashboardMetrics(
      [],
      [{ profileId: "s1", metricDate: "2026-04-01", source: "iclosed", leadsValidated: 0, leadsCanceled: 0, showUps: 0, closes: 0 }],
    );
    expect(result.summary.showRate).toBe(0);
  });

  it("closeRate is 0 when no showUps", () => {
    const result = computeSetterDashboardMetrics(
      [],
      [{ profileId: "s1", metricDate: "2026-04-01", source: "iclosed", leadsValidated: 5, leadsCanceled: 0, showUps: 0, closes: 0 }],
    );
    expect(result.summary.closeRate).toBe(0);
  });

  it("merges call and funnel metrics for the same date into one point", () => {
    const result = computeSetterDashboardMetrics(
      [{ profileId: "s1", metricDate: "2026-04-01", source: "aircall", callsMade: 10, callsAnswered: 7, talkTimeSeconds: 1800 }],
      [{ profileId: "s1", metricDate: "2026-04-01", source: "iclosed", leadsValidated: 5, leadsCanceled: 1, showUps: 4, closes: 2 }],
    );
    expect(result.points).toHaveLength(1);
    expect(result.points[0].callsMade).toBe(10);
    expect(result.points[0].leadsValidated).toBe(5);
  });

  it("sorts points chronologically", () => {
    const result = computeSetterDashboardMetrics(
      [
        { profileId: "s1", metricDate: "2026-04-03", source: "aircall", callsMade: 5, callsAnswered: 3, talkTimeSeconds: 600 },
        { profileId: "s1", metricDate: "2026-04-01", source: "aircall", callsMade: 8, callsAnswered: 6, talkTimeSeconds: 900 },
        { profileId: "s1", metricDate: "2026-04-02", source: "aircall", callsMade: 3, callsAnswered: 2, talkTimeSeconds: 300 },
      ],
      [],
    );
    expect(result.points[0].date).toBe("2026-04-01");
    expect(result.points[1].date).toBe("2026-04-02");
    expect(result.points[2].date).toBe("2026-04-03");
  });

  it("accumulates metrics across multiple setters on the same date", () => {
    const result = computeSetterDashboardMetrics(
      [
        { profileId: "s1", metricDate: "2026-04-01", source: "aircall", callsMade: 10, callsAnswered: 8, talkTimeSeconds: 1200 },
        { profileId: "s2", metricDate: "2026-04-01", source: "aircall", callsMade: 15, callsAnswered: 10, talkTimeSeconds: 1800 },
      ],
      [],
    );
    // Both setters contribute to the same date point
    expect(result.summary.callsMade).toBe(25);
    expect(result.summary.callsAnswered).toBe(18);
  });
});
