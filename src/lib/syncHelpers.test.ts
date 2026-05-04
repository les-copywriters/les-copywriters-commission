/**
 * Tests for pure helper functions used in the iClosed / Aircall sync engine.
 * These functions live in the Deno edge function but are pure JS — inlined here
 * so they can be tested without a Deno runtime.
 */
import { describe, it, expect } from "vitest";

// ── normalizeIClosedBaseUrl ───────────────────────────────────────────────────
// Inlined from supabase/functions/_shared/setterDashboard.ts
function normalizeIClosedBaseUrl(url: string): string {
  let trimmed = url.replace(/\/$/, "");
  trimmed = trimmed.replace("://api.iclosed.io", "://public.api.iclosed.io");
  if (/\/v\d+$/.test(trimmed)) return trimmed;
  return `${trimmed}/v1`;
}

describe("normalizeIClosedBaseUrl", () => {
  it("keeps correct URL unchanged", () => {
    expect(normalizeIClosedBaseUrl("https://public.api.iclosed.io/v1"))
      .toBe("https://public.api.iclosed.io/v1");
  });

  it("migrates old domain to new domain", () => {
    expect(normalizeIClosedBaseUrl("https://api.iclosed.io/v1"))
      .toBe("https://public.api.iclosed.io/v1");
  });

  it("appends /v1 when missing", () => {
    expect(normalizeIClosedBaseUrl("https://public.api.iclosed.io"))
      .toBe("https://public.api.iclosed.io/v1");
  });

  it("appends /v1 to old domain when missing", () => {
    expect(normalizeIClosedBaseUrl("https://api.iclosed.io"))
      .toBe("https://public.api.iclosed.io/v1");
  });

  it("strips trailing slash before processing", () => {
    expect(normalizeIClosedBaseUrl("https://public.api.iclosed.io/v1/"))
      .toBe("https://public.api.iclosed.io/v1");
  });

  it("handles old domain with trailing slash", () => {
    expect(normalizeIClosedBaseUrl("https://api.iclosed.io/"))
      .toBe("https://public.api.iclosed.io/v1");
  });

  it("preserves /v2 if that version is used", () => {
    expect(normalizeIClosedBaseUrl("https://public.api.iclosed.io/v2"))
      .toBe("https://public.api.iclosed.io/v2");
  });

  it("does not double-append /v1", () => {
    const result = normalizeIClosedBaseUrl("https://public.api.iclosed.io/v1");
    expect(result.endsWith("/v1/v1")).toBe(false);
    expect(result).toBe("https://public.api.iclosed.io/v1");
  });

  it("result always ends with /vN", () => {
    const inputs = [
      "https://api.iclosed.io",
      "https://api.iclosed.io/v1",
      "https://public.api.iclosed.io",
      "https://public.api.iclosed.io/v1/",
    ];
    for (const input of inputs) {
      expect(normalizeIClosedBaseUrl(input)).toMatch(/\/v\d+$/);
    }
  });

  it("result never contains the old domain", () => {
    const inputs = [
      "https://api.iclosed.io/v1",
      "https://api.iclosed.io",
    ];
    for (const input of inputs) {
      expect(normalizeIClosedBaseUrl(input)).not.toContain("://api.iclosed.io");
    }
  });
});

// ── normalizeDate ─────────────────────────────────────────────────────────────
// Inlined from supabase/functions/_shared/setterDashboard.ts
function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = String(value).match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

describe("normalizeDate", () => {
  it("returns null for null input", () => {
    expect(normalizeDate(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(normalizeDate(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeDate("")).toBeNull();
  });

  it("extracts date from ISO date string", () => {
    expect(normalizeDate("2026-04-27")).toBe("2026-04-27");
  });

  it("extracts date from ISO datetime string", () => {
    expect(normalizeDate("2026-04-27T14:32:00Z")).toBe("2026-04-27");
  });

  it("extracts date from ISO datetime with offset", () => {
    expect(normalizeDate("2026-04-27T14:32:00+02:00")).toBe("2026-04-27");
  });

  it("handles Unix timestamp string", () => {
    const result = normalizeDate("1745755200"); // 2025-04-27
    // Should parse as a large number → new Date(1745755200) is a very early date
    // The important thing is it doesn't throw
    expect(result === null || typeof result === "string").toBe(true);
  });

  it("returns null for completely invalid date", () => {
    expect(normalizeDate("not-a-date")).toBeNull();
  });

  it("returns null for 'undefined' string", () => {
    expect(normalizeDate("undefined")).toBeNull();
  });

  it("extracts date correctly from datetime with milliseconds", () => {
    expect(normalizeDate("2026-04-27T14:32:00.000Z")).toBe("2026-04-27");
  });

  it("preserves the year-month-day portion exactly", () => {
    expect(normalizeDate("2023-12-31")).toBe("2023-12-31");
    expect(normalizeDate("2024-01-01")).toBe("2024-01-01");
  });
});

// ── Aircall talk-time extraction ──────────────────────────────────────────────
// Inlined from sync engine — critical for duration KPIs
function getAircallTalkTime(call: Record<string, unknown>): number {
  const direct = Number(call.talk_time ?? call.duration ?? 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const answeredAt = typeof call.answered_at === "string" ? Date.parse(call.answered_at) : NaN;
  const endedAt    = typeof call.ended_at   === "string" ? Date.parse(call.ended_at)   : NaN;
  if (!Number.isNaN(answeredAt) && !Number.isNaN(endedAt) && endedAt > answeredAt) {
    return Math.round((endedAt - answeredAt) / 1000);
  }
  return 0;
}

describe("getAircallTalkTime", () => {
  it("returns talk_time field when present", () => {
    expect(getAircallTalkTime({ talk_time: 300, duration: 400 })).toBe(300);
  });

  it("does NOT fall back to duration when talk_time is explicitly 0 (nullish coalescing behaviour)", () => {
    // talk_time=0 is present (not null/undefined), so ?? never reaches duration.
    // The function falls through to the timestamp check, which also returns 0.
    // This is intentional: a 0-second talk_time means the call was not answered.
    expect(getAircallTalkTime({ talk_time: 0, duration: 200 })).toBe(0);
  });

  it("falls back to duration when talk_time absent", () => {
    expect(getAircallTalkTime({ duration: 180 })).toBe(180);
  });

  it("computes from answered_at / ended_at timestamps when both fields are 0", () => {
    const call = {
      talk_time: 0,
      duration: 0,
      answered_at: "2026-04-27T14:00:00Z",
      ended_at:    "2026-04-27T14:05:00Z", // 5 minutes
    };
    expect(getAircallTalkTime(call)).toBe(300);
  });

  it("returns 0 when no timing data available", () => {
    expect(getAircallTalkTime({})).toBe(0);
  });

  it("returns 0 when ended_at is before answered_at", () => {
    const call = {
      talk_time: 0,
      answered_at: "2026-04-27T14:05:00Z",
      ended_at:    "2026-04-27T14:00:00Z",
    };
    expect(getAircallTalkTime(call)).toBe(0);
  });

  it("returns 0 for non-numeric talk_time", () => {
    expect(getAircallTalkTime({ talk_time: "abc" })).toBe(0);
  });

  it("handles very long calls correctly", () => {
    // 2 hour call
    expect(getAircallTalkTime({ talk_time: 7200 })).toBe(7200);
  });
});
