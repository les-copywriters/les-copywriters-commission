import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { useSyncSetterDashboard } from "./useSetterDashboard";

const mockInvoke = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

const makeWrapper = (queryClient: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };

describe("useSyncSetterDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes the sync function with the expected payload", async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, results: [] }, error: null });
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useSyncSetterDashboard(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        source: "aircall",
        profileId: "setter-1",
        startDate: "2026-04-01",
        endDate: "2026-04-20",
      });
    });

    expect(mockInvoke).toHaveBeenCalledWith("sync-setter-dashboard", {
      body: {
        source: "aircall",
        profile_id: "setter-1",
        start_date: "2026-04-01",
        end_date: "2026-04-20",
      },
    });
  });
});
