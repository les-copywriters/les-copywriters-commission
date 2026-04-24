import { computeSetterDashboardMetrics, formatTalkTime, safeRate } from "./setterDashboard";

describe("setterDashboard utils", () => {
  it("handles zero denominators for rates", () => {
    expect(safeRate(3, 0)).toBe(0);
  });

  it("aggregates call and funnel metrics without double counting categories", () => {
    const result = computeSetterDashboardMetrics(
      [
        {
          profileId: "setter-1",
          metricDate: "2026-04-18",
          source: "aircall",
          callsMade: 10,
          callsAnswered: 7,
          talkTimeSeconds: 1800,
        },
      ],
      [
        {
          profileId: "setter-1",
          metricDate: "2026-04-18",
          source: "pipedrive",
          leadsValidated: 5,
          leadsCanceled: 1,
          showUps: 4,
          closes: 2,
        },
      ],
    );

    expect(result.summary.callsMade).toBe(10);
    expect(result.summary.callsAnswered).toBe(7);
    expect(result.summary.talkTimeSeconds).toBe(1800);
    expect(result.summary.leadsValidated).toBe(5);
    expect(result.summary.leadsCanceled).toBe(1);
    expect(result.summary.showUps).toBe(4);
    expect(result.summary.closes).toBe(2);
    expect(result.summary.showRate).toBe(80);
    expect(result.summary.closeRate).toBe(50);
    expect(result.points).toHaveLength(1);
  });

  it("formats talk time into readable buckets", () => {
    expect(formatTalkTime(3900)).toBe("1h 5m");
    expect(formatTalkTime(1200)).toBe("20m");
  });
});
