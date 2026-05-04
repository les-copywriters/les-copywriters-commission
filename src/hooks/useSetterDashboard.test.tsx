import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  useSyncSetterDashboard,
  useSetterPerformance,
  useSetterDailyActivity,
  useSetterCallHistory,
} from "./useSetterDashboard";

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockRpc    = vi.fn();
const mockFrom   = vi.fn();
const mockInvoke = vi.fn();

/** Build a fluent query chain that resolves to { data, error } at the end. */
function makeChain(resolved: { data: unknown; error: unknown }) {
  const c: Record<string, unknown> = {};
  const self = () => c;
  c.select = (..._a: unknown[]) => c;
  c.eq     = (..._a: unknown[]) => c;
  c.gte    = (..._a: unknown[]) => c;
  c.lte    = (..._a: unknown[]) => c;
  c.order  = (..._a: unknown[]) => c;
  c.limit  = (..._a: unknown[]) => Promise.resolve(resolved);
  // allow direct .then() in Promise.all
  c.then   = (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve);
  void self; // suppress unused warning
  return c;
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc:       (...args: unknown[]) => mockRpc(...args),
    // from() returns whatever mockFrom() returns — lets individual tests configure chains
    from:      (...args: unknown[]) => mockFrom(...args),
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

// ── Wrapper ───────────────────────────────────────────────────────────────────

const makeWrapper = (qc: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };

const freshClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

// ── useSyncSetterDashboard ────────────────────────────────────────────────────

describe("useSyncSetterDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }));
  });

  it("invokes sync-setter-dashboard with the correct payload shape", async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, results: [] }, error: null });
    const { result } = renderHook(() => useSyncSetterDashboard(), {
      wrapper: makeWrapper(freshClient()),
    });

    await act(async () => {
      await result.current.mutateAsync({
        source: "aircall",
        profileId: "setter-uuid-1",
        startDate: "2026-04-01",
        endDate:   "2026-04-30",
      });
    });

    expect(mockInvoke).toHaveBeenCalledWith("sync-setter-dashboard", {
      body: {
        source:      "aircall",
        profile_id:  "setter-uuid-1",
        start_date:  "2026-04-01",
        end_date:    "2026-04-30",
      },
    });
  });

  it("defaults source to 'all' when not provided", async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, results: [] }, error: null });
    const { result } = renderHook(() => useSyncSetterDashboard(), {
      wrapper: makeWrapper(freshClient()),
    });

    await act(async () => {
      await result.current.mutateAsync({});
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      "sync-setter-dashboard",
      expect.objectContaining({ body: expect.objectContaining({ source: "all" }) }),
    );
  });

  it("throws when the edge function returns an error", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: "Unauthorized", context: null } });
    const { result } = renderHook(() => useSyncSetterDashboard(), {
      wrapper: makeWrapper(freshClient()),
    });

    await expect(
      act(async () => { await result.current.mutateAsync({ source: "all" }); })
    ).rejects.toThrow();
  });
});

// ── useSetterPerformance ──────────────────────────────────────────────────────

describe("useSetterPerformance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }));
  });

  it("calls setter_performance_range RPC with correct date params", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(
      () => useSetterPerformance("2026-04-01", "2026-04-30"),
      { wrapper: makeWrapper(freshClient()) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith("setter_performance_range", {
      date_from: "2026-04-01",
      date_to:   "2026-04-30",
    });
  });

  it("maps RPC snake_case fields to camelCase correctly", async () => {
    mockRpc.mockResolvedValue({
      data: [{
        profile_id:           "uuid-1",
        full_name:            "Andy Martin",
        dialed:               312,
        pickup:               119,
        pickup_rate_pct:      38.1,
        validated:            34,
        shows:                28,
        no_shows:             6,
        show_rate_pct:        82.4,
        setter_cancellations: 4,
        cancel_rate_pct:      3.4,
        closed:               7,
        close_rate_pct:       25.0,
        total_encaisse:       18200,
        eur_per_validated:    535.3,
        avg_duration_seconds: 292,
      }],
      error: null,
    });

    const { result } = renderHook(
      () => useSetterPerformance("2026-04-01", "2026-04-30"),
      { wrapper: makeWrapper(freshClient()) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const row = result.current.data?.[0];
    expect(row?.profileId).toBe("uuid-1");
    expect(row?.fullName).toBe("Andy Martin");
    expect(row?.dialed).toBe(312);
    expect(row?.pickup).toBe(119);
    expect(row?.validated).toBe(34);
    expect(row?.shows).toBe(28);
    expect(row?.noShows).toBe(6);
    expect(row?.setterCancellations).toBe(4);
    expect(row?.cancelRatePct).toBe(3.4);
    expect(row?.closed).toBe(7);
    expect(row?.totalEncaisse).toBe(18200);
    expect(row?.eurPerValidated).toBe(535.3);
    expect(row?.avgDurationSeconds).toBe(292);
  });

  it("returns empty array when RPC returns no rows", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(
      () => useSetterPerformance("2026-04-01", "2026-04-30"),
      { wrapper: makeWrapper(freshClient()) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("exposes error when RPC fails", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "relation does not exist" } });

    const { result } = renderHook(
      () => useSetterPerformance("2026-04-01", "2026-04-30"),
      { wrapper: makeWrapper(freshClient()) },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("does not exist");
  });
});

// ── useSetterDailyActivity ────────────────────────────────────────────────────

describe("useSetterDailyActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }));
  });

  it("calls setter_daily_activity with null profileId when none provided", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(
      () => useSetterDailyActivity("2026-04-01", "2026-04-07"),
      { wrapper: makeWrapper(freshClient()) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith("setter_daily_activity", {
      date_from:    "2026-04-01",
      date_to:      "2026-04-07",
      p_profile_id: null,
    });
  });

  it("passes profileId when provided", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(
      () => useSetterDailyActivity("2026-04-01", "2026-04-07", "setter-uuid-1"),
      { wrapper: makeWrapper(freshClient()) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith("setter_daily_activity", {
      date_from:    "2026-04-01",
      date_to:      "2026-04-07",
      p_profile_id: "setter-uuid-1",
    });
  });

  it("maps activity_date and counts correctly", async () => {
    mockRpc.mockResolvedValue({
      data: [
        { profile_id: "uuid-1", activity_date: "2026-04-01", dialed: 47, pickup: 18, validated: 5 },
        { profile_id: "uuid-1", activity_date: "2026-04-02", dialed: 53, pickup: 20, validated: 6 },
      ],
      error: null,
    });

    const { result } = renderHook(
      () => useSetterDailyActivity("2026-04-01", "2026-04-02", "uuid-1"),
      { wrapper: makeWrapper(freshClient()) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0]).toMatchObject({ date: "2026-04-01", dialed: 47, pickup: 18, validated: 5 });
    expect(result.current.data?.[1]).toMatchObject({ date: "2026-04-02", dialed: 53, pickup: 20, validated: 6 });
  });
});

// ── useSetterCallHistory ──────────────────────────────────────────────────────

describe("useSetterCallHistory", () => {
  beforeEach(() => vi.clearAllMocks());

  const callsData = [
    {
      id: 1, profile_id: "uuid-1",
      started_at: "2026-04-01T14:32:00Z", duration_seconds: 434, talk_time_seconds: 434,
      contact_name: "Marc Lefèvre", contact_phone: "+33612345678",
      recording_url: "https://recordings.aircall.io/abc123",
      status: "answered", raw_payload: {},
    },
    {
      id: 2, profile_id: "uuid-1",
      started_at: "2026-04-01T16:45:00Z", duration_seconds: 22, talk_time_seconds: 0,
      contact_name: "Karim Benali", contact_phone: "+33698765432",
      recording_url: null,
      status: "missed", raw_payload: {},
    },
    {
      id: 3, profile_id: "uuid-1",
      started_at: "2026-04-01T18:22:00Z", duration_seconds: 312, talk_time_seconds: 312,
      contact_name: "Hugo Dervil", contact_phone: "+33611111111",
      recording_url: "https://recordings.aircall.io/def456",
      status: "answered", raw_payload: {},
    },
    {
      id: 4, profile_id: "uuid-1",
      started_at: "2026-04-01T15:20:00Z", duration_seconds: 363, talk_time_seconds: 363,
      contact_name: "Lucie Marchand", contact_phone: "+33622222222",
      recording_url: "https://recordings.aircall.io/ghi789",
      status: "done", raw_payload: {},
    },
    {
      id: 5, profile_id: "uuid-1",
      started_at: "2026-04-01T10:12:00Z", duration_seconds: 258, talk_time_seconds: 258,
      contact_name: "Antoine Roy", contact_phone: "+33633333333",
      recording_url: "https://recordings.aircall.io/jkl012",
      status: "answered", raw_payload: {},
    },
  ];

  const eventsData = [
    { id: 10, profile_id: "uuid-1", iclosed_event_id: "ev-10", phone_number: "+33612345678", date_time: "2026-04-01T14:00:00Z", outcome: "WON",       no_sale_reason: null,    cancelled_by: null,     amount_collected: 2800 },
    { id: 11, profile_id: "uuid-1", iclosed_event_id: "ev-11", phone_number: "+33611111111", date_time: "2026-04-01T18:00:00Z", outcome: null,        no_sale_reason: null,    cancelled_by: "setter", amount_collected: 0    },
    { id: 12, profile_id: "uuid-1", iclosed_event_id: "ev-12", phone_number: "+33622222222", date_time: "2026-04-01T15:00:00Z", outcome: "NO_SALE",   no_sale_reason: "NO_SHOW", cancelled_by: null,   amount_collected: 0    },
    { id: 13, profile_id: "uuid-1", iclosed_event_id: "ev-13", phone_number: "+33633333333", date_time: "2026-04-01T10:00:00Z", outcome: "WON",       no_sale_reason: null,    cancelled_by: null,     amount_collected: 2400 },
  ];

  // Return calls data for setter_call_records, events data for iclosed_event_records
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation((table: string) => {
      const resolved = table === "setter_call_records"
        ? { data: callsData, error: null }
        : { data: eventsData, error: null };
      return makeChain(resolved);
    });
  });

  it("queries setter_call_records and iclosed_event_records", async () => {
    const { result } = renderHook(
      () => useSetterCallHistory("uuid-1", "2026-04-01", "2026-04-30"),
      { wrapper: makeWrapper(freshClient()) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith("setter_call_records");
    expect(mockFrom).toHaveBeenCalledWith("iclosed_event_records");
  });

  it("maps a WON outcome to 'closed' status with correct amount", async () => {
    const { result } = renderHook(
      () => useSetterCallHistory("uuid-1", "2026-04-01", "2026-04-30"),
      { wrapper: makeWrapper(freshClient()) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const marcRow = result.current.data?.find(r => r.contactName === "Marc Lefèvre");
    expect(marcRow?.displayStatus).toBe("closed");
    expect(marcRow?.amountCollected).toBe(2800);
    expect(marcRow?.recordingUrl).toBe("https://recordings.aircall.io/abc123");
  });

  it("maps missed call (not answered) to 'pas_decroche'", async () => {
    const { result } = renderHook(
      () => useSetterCallHistory("uuid-1", "2026-04-01", "2026-04-30"),
      { wrapper: makeWrapper(freshClient()) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const karimRow = result.current.data?.find(r => r.contactName === "Karim Benali");
    expect(karimRow?.displayStatus).toBe("pas_decroche");
    expect(karimRow?.recordingUrl).toBeNull();
  });

  it("maps cancelledBy=setter to 'annule_setter'", async () => {
    const { result } = renderHook(
      () => useSetterCallHistory("uuid-1", "2026-04-01", "2026-04-30"),
      { wrapper: makeWrapper(freshClient()) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const hugoRow = result.current.data?.find(r => r.contactName === "Hugo Dervil");
    expect(hugoRow?.displayStatus).toBe("annule_setter");
    expect(hugoRow?.amountCollected).toBe(0);
  });

  it("maps NO_SHOW to 'no_show'", async () => {
    const { result } = renderHook(
      () => useSetterCallHistory("uuid-1", "2026-04-01", "2026-04-30"),
      { wrapper: makeWrapper(freshClient()) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const lucieRow = result.current.data?.find(r => r.contactName === "Lucie Marchand");
    expect(lucieRow?.displayStatus).toBe("no_show");
  });

  it("maps WON to 'closed' with amount for Antoine Roy", async () => {
    const { result } = renderHook(
      () => useSetterCallHistory("uuid-1", "2026-04-01", "2026-04-30"),
      { wrapper: makeWrapper(freshClient()) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const antoineRow = result.current.data?.find(r => r.contactName === "Antoine Roy");
    expect(antoineRow?.displayStatus).toBe("closed");
    expect(antoineRow?.amountCollected).toBe(2400);
  });

  it("returns correct total row count", async () => {
    const { result } = renderHook(
      () => useSetterCallHistory("uuid-1", "2026-04-01", "2026-04-30"),
      { wrapper: makeWrapper(freshClient()) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(5);
  });
});
