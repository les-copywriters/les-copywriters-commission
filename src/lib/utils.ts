import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parses the result of a sync-setter-dashboard invocation and returns a
 * human-readable summary string + whether there were errors.
 * The edge function returns { ok, results: [{ source, records_seen, rows_written, status, errors }] }.
 */
export function parseSyncResult(data: unknown): { message: string; hasErrors: boolean } {
  if (!data || typeof data !== "object") return { message: "Sync complete.", hasErrors: false };
  const d = data as { ok?: boolean; results?: Array<{ source?: string; records_seen?: number; rows_written?: number; status?: string; errors?: string[] }> };
  const results = d.results ?? [];
  if (!results.length) return { message: "Sync complete — no results returned.", hasErrors: false };

  const lines: string[] = [];
  let hasErrors = false;
  for (const r of results) {
    const src = String(r.source ?? "").toUpperCase();
    const seen = Number(r.records_seen ?? 0);
    const written = Number(r.rows_written ?? 0);
    const errs = Array.isArray(r.errors) ? r.errors.filter((e: unknown) => typeof e === "string" && e.trim()) : [];
    if (errs.length) {
      hasErrors = true;
      lines.push(`${src}: ${errs[0]}`);
    } else {
      lines.push(`${src}: ${seen} records seen, ${written} rows written`);
    }
  }
  return { message: lines.join(" · "), hasErrors };
}

/**
 * Returns true if an error message indicates a missing Supabase DB object
 * (table or function not yet created — migrations not applied).
 */
export function isMigrationMissing(message: string): boolean {
  return /does not exist|relation .* does not exist|function .* does not exist|schema cache/i.test(message);
}

/** Safe localStorage helpers — never throw (quota exceeded, private browsing, SSR). */
export const ls = {
  get: (key: string, fallback = ""): string => {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  },
  set: (key: string, value: string): void => {
    try { localStorage.setItem(key, value); } catch { /* ignore quota/private-mode errors */ }
  },
};
