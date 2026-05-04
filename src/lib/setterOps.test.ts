import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  computeCallDisplayStatus,
  aggregateTeam,
  normName,
  matchUser,
  type ApiUser,
  type SetterPerfRow,
} from "./setterOps";

// ── normalizePhone ────────────────────────────────────────────────────────────

describe("normalizePhone", () => {
  it("strips all non-digits and keeps last 9", () => {
    expect(normalizePhone("+33 6 12 34 56 78")).toBe("612345678");
    expect(normalizePhone("06-12-34-56-78")).toBe("612345678");
    expect(normalizePhone("0612345678")).toBe("612345678");
  });

  it("handles short numbers without truncating", () => {
    expect(normalizePhone("123456")).toBe("123456");
  });

  it("returns empty string for empty input", () => {
    expect(normalizePhone("")).toBe("");
  });

  it("two numbers with different country codes but same local part match", () => {
    expect(normalizePhone("+33612345678")).toBe(normalizePhone("0612345678"));
  });
});

// ── computeCallDisplayStatus ──────────────────────────────────────────────────

describe("computeCallDisplayStatus", () => {
  it("returns pas_decroche when not answered", () => {
    expect(computeCallDisplayStatus({
      answered: false, cancelledBy: null, noSaleReason: null, outcome: null,
    })).toBe("pas_decroche");
  });

  it("pas_decroche even if iClosed outcome is present but call not answered", () => {
    expect(computeCallDisplayStatus({
      answered: false, cancelledBy: "setter", noSaleReason: null, outcome: "WON",
    })).toBe("pas_decroche");
  });

  it("returns annule_setter when cancelledBy is setter", () => {
    expect(computeCallDisplayStatus({
      answered: true, cancelledBy: "setter", noSaleReason: null, outcome: null,
    })).toBe("annule_setter");
  });

  it("annule_setter takes priority over no_show", () => {
    expect(computeCallDisplayStatus({
      answered: true, cancelledBy: "setter", noSaleReason: "NO_SHOW", outcome: null,
    })).toBe("annule_setter");
  });

  it("returns no_show when noSaleReason is NO_SHOW and not setter-cancelled", () => {
    expect(computeCallDisplayStatus({
      answered: true, cancelledBy: null, noSaleReason: "NO_SHOW", outcome: null,
    })).toBe("no_show");
  });

  it("no_show takes priority over WON outcome (defensive)", () => {
    expect(computeCallDisplayStatus({
      answered: true, cancelledBy: null, noSaleReason: "NO_SHOW", outcome: "WON",
    })).toBe("no_show");
  });

  it("returns closed when outcome is WON", () => {
    expect(computeCallDisplayStatus({
      answered: true, cancelledBy: null, noSaleReason: null, outcome: "WON",
    })).toBe("closed");
  });

  it("returns valide for QUALIFIED outcome", () => {
    expect(computeCallDisplayStatus({
      answered: true, cancelledBy: null, noSaleReason: null, outcome: "QUALIFIED",
    })).toBe("valide");
  });

  it("returns valide for APPROVED outcome", () => {
    expect(computeCallDisplayStatus({
      answered: true, cancelledBy: null, noSaleReason: null, outcome: "APPROVED",
    })).toBe("valide");
  });

  it("returns valide for NO_SALE outcome (showed up, didn't buy)", () => {
    expect(computeCallDisplayStatus({
      answered: true, cancelledBy: null, noSaleReason: null, outcome: "NO_SALE",
    })).toBe("valide");
  });

  it("returns valide when answered but no iClosed match (null outcome)", () => {
    expect(computeCallDisplayStatus({
      answered: true, cancelledBy: null, noSaleReason: null, outcome: null,
    })).toBe("valide");
  });

  it("ADMIN_CANCELLED in noSaleReason does NOT set annule_setter", () => {
    // Only cancelledBy='setter' triggers annule_setter — not noSaleReason
    const status = computeCallDisplayStatus({
      answered: true, cancelledBy: "admin", noSaleReason: "ADMIN_CANCELLED", outcome: null,
    });
    expect(status).not.toBe("annule_setter");
  });
});

// ── aggregateTeam ─────────────────────────────────────────────────────────────

const makeRow = (overrides: Partial<SetterPerfRow> = {}): SetterPerfRow => ({
  dialed: 0, pickup: 0, validated: 0, shows: 0, noShows: 0, closed: 0,
  setterCancellations: 0, totalEncaisse: 0, avgDurationSeconds: 0,
  ...overrides,
});

describe("aggregateTeam", () => {
  it("sums all counts across setters", () => {
    const rows = [
      makeRow({ dialed: 100, pickup: 40, validated: 20, shows: 16, noShows: 4, closed: 8, setterCancellations: 2, totalEncaisse: 5000 }),
      makeRow({ dialed: 200, pickup: 80, validated: 40, shows: 30, noShows: 10, closed: 12, setterCancellations: 4, totalEncaisse: 8000 }),
    ];
    const t = aggregateTeam(rows);
    expect(t.dialed).toBe(300);
    expect(t.pickup).toBe(120);
    expect(t.validated).toBe(60);
    expect(t.shows).toBe(46);
    expect(t.noShows).toBe(14);
    expect(t.closed).toBe(20);
    expect(t.setterCancellations).toBe(6);
    expect(t.totalEncaisse).toBe(13000);
  });

  it("calculates pickupPct correctly", () => {
    const t = aggregateTeam([makeRow({ dialed: 100, pickup: 38 })]);
    expect(t.pickupPct).toBeCloseTo(38);
  });

  it("calculates showPct correctly", () => {
    const t = aggregateTeam([makeRow({ validated: 34, shows: 28 })]);
    expect(t.showPct).toBeCloseTo(82.35, 1);
  });

  it("calculates closePct correctly", () => {
    const t = aggregateTeam([makeRow({ shows: 28, closed: 7 })]);
    expect(t.closePct).toBeCloseTo(25);
  });

  it("cancel rate uses pickup as denominator, not validated", () => {
    // spec §9: cancelRatePct = setterCancellations / pickup
    const t = aggregateTeam([makeRow({ pickup: 100, setterCancellations: 4, validated: 50 })]);
    expect(t.cancelPct).toBeCloseTo(4); // 4/100 = 4%, NOT 4/50 = 8%
  });

  it("eurPerVal = totalEncaisse / validated", () => {
    const t = aggregateTeam([makeRow({ totalEncaisse: 18200, validated: 34 })]);
    expect(t.eurPerVal).toBeCloseTo(535.29, 1);
  });

  it("returns 0 for all rates when denominators are zero", () => {
    const t = aggregateTeam([makeRow({ dialed: 0, pickup: 0, validated: 0, shows: 0 })]);
    expect(t.pickupPct).toBe(0);
    expect(t.showPct).toBe(0);
    expect(t.closePct).toBe(0);
    expect(t.cancelPct).toBe(0);
    expect(t.eurPerVal).toBe(0);
  });

  it("handles empty array without throwing", () => {
    const t = aggregateTeam([]);
    expect(t.dialed).toBe(0);
    expect(t.totalEncaisse).toBe(0);
  });

  it("computes weighted average duration across setters", () => {
    const rows = [
      makeRow({ pickup: 100, avgDurationSeconds: 300 }), // 100 calls × 300s
      makeRow({ pickup: 100, avgDurationSeconds: 180 }), // 100 calls × 180s
    ];
    const t = aggregateTeam(rows);
    expect(t.avgDur).toBe(240); // (30000 + 18000) / 200 = 240s
  });
});

// ── normName ──────────────────────────────────────────────────────────────────

describe("normName", () => {
  it("lowercases and collapses separators", () => {
    expect(normName("Andy Dupont")).toBe("andy dupont");
    // Accents are stripped: é→e, hyphens become spaces
    expect(normName("Céline-Marie")).toBe("celine marie");
  });

  it("trims surrounding whitespace", () => {
    expect(normName("  Jessica ")).toBe("jessica");
  });
});

// ── matchUser ─────────────────────────────────────────────────────────────────

const users: ApiUser[] = [
  { id: 111, name: "Andy Martin",    email: "andy@company.com"     },
  { id: 222, name: "Céline Dupont",  email: "celine@company.com"   },
  { id: 333, name: "Jessica Lemaire",email: "jessica@company.com"  },
  { id: 444, name: "Philippe Morel", email: "philippe@company.com" },
];

describe("matchUser", () => {
  it("exact match wins", () => {
    expect(matchUser("Andy Martin", users)?.id).toBe(111);
  });

  it("matches by first name when profile is first-name only", () => {
    expect(matchUser("Andy", users)?.id).toBe(111);
    expect(matchUser("Jessica", users)?.id).toBe(333);
    expect(matchUser("Philippe", users)?.id).toBe(444);
  });

  it("match is case-insensitive", () => {
    expect(matchUser("andy", users)?.id).toBe(111);
    expect(matchUser("CÉLINE", users)?.id).toBe(222);
  });

  it("returns null when no match exists", () => {
    expect(matchUser("Zara Unknown", users)).toBeNull();
  });

  it("does not match on single/two-char tokens to avoid false positives", () => {
    const shortUsers: ApiUser[] = [
      { id: 999, name: "Al Smith", email: null },
    ];
    expect(matchUser("Al", shortUsers)).toBeNull();
  });

  it("partial containment match works", () => {
    expect(matchUser("Andy M", users)?.id).toBe(111);
  });

  it("returns null for empty user list", () => {
    expect(matchUser("Andy", [])).toBeNull();
  });
});
