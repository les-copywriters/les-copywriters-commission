/**
 * Pure functions for setter ops business logic.
 * Extracted here so they can be unit-tested independently of React hooks and components.
 */

import type { SetterCallHistoryRow } from "@/hooks/useSetterDashboard";

// ── Phone normalisation ───────────────────────────────────────────────────────

/** Strip non-digits and keep the last 9 digits. Used for Aircall↔iClosed phone matching. */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-9);
}

// ── Call display status ───────────────────────────────────────────────────────

/**
 * Derives the single display status for a call row shown in the setter call history table.
 *
 * Priority (top wins):
 *  1. Not answered → pas_decroche
 *  2. cancelledBy = 'setter' → annule_setter
 *  3. noSaleReason = 'NO_SHOW' → no_show
 *  4. outcome = 'WON' → closed
 *  5. outcome in QUALIFIED / APPROVED / NO_SALE → valide
 *  6. Answered, no iClosed match → valide (optimistic)
 */
export function computeCallDisplayStatus({
  answered,
  cancelledBy,
  noSaleReason,
  outcome,
}: {
  answered: boolean;
  cancelledBy: string | null;
  noSaleReason: string | null;
  outcome: string | null;
}): SetterCallHistoryRow["displayStatus"] {
  if (!answered)                                             return "pas_decroche";
  if (cancelledBy === "setter")                              return "annule_setter";
  if (noSaleReason === "NO_SHOW")                           return "no_show";
  if (outcome === "WON")                                    return "closed";
  if (outcome && ["QUALIFIED", "APPROVED", "NO_SALE"].includes(outcome)) return "valide";
  return "valide"; // answered but no iClosed event matched
}

// ── KPI aggregation ───────────────────────────────────────────────────────────

export type SetterPerfRow = {
  dialed: number;
  pickup: number;
  validated: number;
  shows: number;
  noShows: number;
  closed: number;
  setterCancellations: number;
  totalEncaisse: number;
  avgDurationSeconds: number;
};

export type TeamTotals = SetterPerfRow & {
  pickupPct:  number;
  showPct:    number;
  closePct:   number;
  cancelPct:  number;
  eurPerVal:  number;
  avgDur:     number;
};

export function aggregateTeam(rows: SetterPerfRow[]): TeamTotals {
  const s = rows.reduce(
    (acc, r) => ({
      dialed:               acc.dialed + r.dialed,
      pickup:               acc.pickup + r.pickup,
      validated:            acc.validated + r.validated,
      shows:                acc.shows + r.shows,
      noShows:              acc.noShows + r.noShows,
      closed:               acc.closed + r.closed,
      setterCancellations:  acc.setterCancellations + r.setterCancellations,
      totalEncaisse:        acc.totalEncaisse + r.totalEncaisse,
      // weighted sum for average duration (weight = pickup count)
      wDur:                 acc.wDur + r.avgDurationSeconds * r.pickup,
    }),
    { dialed: 0, pickup: 0, validated: 0, shows: 0, noShows: 0, closed: 0, setterCancellations: 0, totalEncaisse: 0, wDur: 0 },
  );

  return {
    dialed:               s.dialed,
    pickup:               s.pickup,
    validated:            s.validated,
    shows:                s.shows,
    noShows:              s.noShows,
    closed:               s.closed,
    setterCancellations:  s.setterCancellations,
    totalEncaisse:        s.totalEncaisse,
    avgDurationSeconds:   s.pickup > 0 ? Math.round(s.wDur / s.pickup) : 0,
    pickupPct:  s.dialed > 0    ? (s.pickup / s.dialed) * 100 : 0,
    showPct:    s.validated > 0 ? (s.shows  / s.validated) * 100 : 0,
    closePct:   s.shows > 0     ? (s.closed / s.shows) * 100 : 0,
    // Cancel rate = setter cancellations / pickups (NOT / validated — per spec §9)
    cancelPct:  s.pickup > 0    ? (s.setterCancellations / s.pickup) * 100 : 0,
    eurPerVal:  s.validated > 0 ? s.totalEncaisse / s.validated : 0,
    avgDur:     s.pickup > 0    ? Math.round(s.wDur / s.pickup) : 0,
  };
}

// ── Name matching (for Auto-match Setter IDs) ─────────────────────────────────

export type ApiUser = { id: number | string; name: string; email: string | null };

/**
 * Normalise a display name for fuzzy matching.
 * Strips diacritics (é→e, ç→c), lowercases, collapses non-alphanumeric to spaces.
 */
export function normName(s: string): string {
  return s
    .normalize("NFD")        // decompose é → base-e + combining acute U+0301
    .replace(/\p{M}/gu, "")  // drop all Unicode combining marks (diacritics)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Match a setter profile name against a list of API users.
 * Returns the best match or null.
 *
 * Match tiers (first wins):
 *  1. Exact normalised full-name match
 *  2. First token of profile matches first token of API name (≥3 chars)
 *  3. Either name starts with the other's first token
 */
export function matchUser(profileName: string, users: ApiUser[]): ApiUser | null {
  const pn     = normName(profileName);
  const pFirst = pn.split(" ")[0];

  // 1. Exact
  const exact = users.find(u => normName(u.name) === pn);
  if (exact) return exact;

  // 2. First-name token match (guard against single-letter noise)
  if (pFirst.length >= 3) {
    const firstMatch = users.find(u => normName(u.name).split(" ")[0] === pFirst);
    if (firstMatch) return firstMatch;
  }

  // 3. Partial containment
  const partial = users.find(u => {
    const un = normName(u.name);
    const uFirst = un.split(" ")[0];
    return (uFirst.length >= 3 && pn.includes(uFirst)) ||
           (pFirst.length >= 3 && un.includes(pFirst));
  });
  return partial ?? null;
}
