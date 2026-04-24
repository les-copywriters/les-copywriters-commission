import { SetterCallMetricDaily, SetterDashboardMetrics, SetterDashboardPoint, SetterDashboardSummary, SetterFunnelMetricDaily } from "@/types";

export type SetterDatePreset = "thisMonth" | "lastMonth" | "last3m" | "last6m" | "thisYear" | "allTime" | "custom";

export function computeSetterDateRange(preset: SetterDatePreset, customStart: string, customEnd: string) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  switch (preset) {
    case "thisMonth":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), end: today };
    case "lastMonth":
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10),
        end: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10),
      };
    case "last3m":
      return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10), end: today };
    case "last6m":
      return { start: new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10), end: today };
    case "thisYear":
      return { start: `${now.getFullYear()}-01-01`, end: today };
    case "allTime":
      return { start: "2000-01-01", end: today };
    case "custom":
      return { start: customStart || "2000-01-01", end: customEnd || today };
  }
}

export function safeRate(numerator: number, denominator: number) {
  if (!denominator || denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

export function formatTalkTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function computeSetterDashboardMetrics(
  callMetrics: SetterCallMetricDaily[],
  funnelMetrics: SetterFunnelMetricDaily[],
): SetterDashboardMetrics {
  const pointMap = new Map<string, SetterDashboardPoint>();

  const getPoint = (date: string) => {
    const existing = pointMap.get(date);
    if (existing) return existing;
    const next: SetterDashboardPoint = {
      date,
      callsMade: 0,
      callsAnswered: 0,
      talkTimeSeconds: 0,
      leadsValidated: 0,
      leadsCanceled: 0,
      showUps: 0,
      closes: 0,
    };
    pointMap.set(date, next);
    return next;
  };

  for (const metric of callMetrics) {
    const point = getPoint(metric.metricDate);
    point.callsMade += metric.callsMade;
    point.callsAnswered += metric.callsAnswered;
    point.talkTimeSeconds += metric.talkTimeSeconds;
  }

  for (const metric of funnelMetrics) {
    const point = getPoint(metric.metricDate);
    point.leadsValidated += metric.leadsValidated;
    point.leadsCanceled += metric.leadsCanceled;
    point.showUps += metric.showUps;
    point.closes += metric.closes;
  }

  const points = [...pointMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const summary = points.reduce<SetterDashboardSummary>((acc, point) => ({
    callsMade: acc.callsMade + point.callsMade,
    callsAnswered: acc.callsAnswered + point.callsAnswered,
    talkTimeSeconds: acc.talkTimeSeconds + point.talkTimeSeconds,
    leadsValidated: acc.leadsValidated + point.leadsValidated,
    leadsCanceled: acc.leadsCanceled + point.leadsCanceled,
    showUps: acc.showUps + point.showUps,
    closes: acc.closes + point.closes,
    showRate: 0,
    closeRate: 0,
  }), {
    callsMade: 0,
    callsAnswered: 0,
    talkTimeSeconds: 0,
    leadsValidated: 0,
    leadsCanceled: 0,
    showUps: 0,
    closes: 0,
    showRate: 0,
    closeRate: 0,
  });

  summary.showRate = safeRate(summary.showUps, summary.leadsValidated);
  summary.closeRate = safeRate(summary.closes, summary.showUps);

  return { summary, points };
}
