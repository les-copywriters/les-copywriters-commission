import { describe, it, expect } from "vitest";
import { parseSyncResult, isMigrationMissing } from "./utils";

// ── parseSyncResult ───────────────────────────────────────────────────────────

describe("parseSyncResult", () => {
  it("handles null / undefined gracefully", () => {
    expect(parseSyncResult(null).hasErrors).toBe(false);
    expect(parseSyncResult(undefined).hasErrors).toBe(false);
    expect(parseSyncResult(null).message).toBeTruthy();
  });

  it("handles non-object input", () => {
    expect(parseSyncResult("string").hasErrors).toBe(false);
    expect(parseSyncResult(42).hasErrors).toBe(false);
  });

  it("handles empty results array", () => {
    const { message, hasErrors } = parseSyncResult({ ok: true, results: [] });
    expect(hasErrors).toBe(false);
    expect(message).toBeTruthy();
  });

  it("formats a successful sync result", () => {
    const { message, hasErrors } = parseSyncResult({
      ok: true,
      results: [
        { source: "aircall", records_seen: 312, rows_written: 47, status: "success", errors: [] },
        { source: "iclosed", records_seen: 89,  rows_written: 12, status: "success", errors: [] },
      ],
    });
    expect(hasErrors).toBe(false);
    expect(message).toContain("312");
    expect(message).toContain("47");
    expect(message).toContain("89");
    expect(message).toContain("12");
  });

  it("sets hasErrors true and surfaces the first error message", () => {
    const { message, hasErrors } = parseSyncResult({
      ok: false,
      results: [
        { source: "aircall", records_seen: 0, rows_written: 0, status: "error", errors: ["Missing API token"] },
        { source: "iclosed", records_seen: 50, rows_written: 8, status: "success", errors: [] },
      ],
    });
    expect(hasErrors).toBe(true);
    expect(message).toContain("Missing API token");
  });

  it("hasErrors is false when errors array is empty", () => {
    const { hasErrors } = parseSyncResult({
      results: [{ source: "aircall", records_seen: 10, rows_written: 10, status: "success", errors: [] }],
    });
    expect(hasErrors).toBe(false);
  });

  it("hasErrors is false when errors array contains empty strings", () => {
    const { hasErrors } = parseSyncResult({
      results: [{ source: "aircall", records_seen: 10, rows_written: 10, status: "success", errors: ["", "  "] }],
    });
    expect(hasErrors).toBe(false);
  });

  it("source label is uppercased in the message", () => {
    const { message } = parseSyncResult({
      results: [{ source: "aircall", records_seen: 1, rows_written: 1, status: "success", errors: [] }],
    });
    expect(message).toContain("AIRCALL");
  });

  it("multiple sources are separated by ·", () => {
    const { message } = parseSyncResult({
      results: [
        { source: "aircall", records_seen: 1, rows_written: 1, status: "success", errors: [] },
        { source: "iclosed", records_seen: 1, rows_written: 1, status: "success", errors: [] },
      ],
    });
    expect(message).toContain("·");
  });
});

// ── isMigrationMissing ────────────────────────────────────────────────────────

describe("isMigrationMissing", () => {
  it("detects 'relation does not exist' errors", () => {
    expect(isMigrationMissing('relation "iclosed_event_records" does not exist')).toBe(true);
  });

  it("detects 'function does not exist' errors", () => {
    expect(isMigrationMissing("function setter_performance_range does not exist")).toBe(true);
  });

  it("detects generic 'does not exist'", () => {
    expect(isMigrationMissing("table does not exist")).toBe(true);
  });

  it("detects schema cache errors", () => {
    expect(isMigrationMissing("Could not find the schema cache entry")).toBe(true);
    expect(isMigrationMissing("schema cache miss")).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isMigrationMissing("Network error: connection refused")).toBe(false);
    expect(isMigrationMissing("Invalid API key")).toBe(false);
    expect(isMigrationMissing("Permission denied")).toBe(false);
    expect(isMigrationMissing("")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isMigrationMissing("RELATION DOES NOT EXIST")).toBe(true);
  });
});
