import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act } from "@testing-library/react";
import { ReactNode } from "react";
import { useSyncJotform } from "./useSyncJotform";

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

describe("useSyncJotform", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when function response shape is invalid", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useSyncJotform(), {
      wrapper: makeWrapper(queryClient),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync();
      }),
    ).rejects.toThrow("Invalid sync response.");
  });

  it("invalidates sales and profiles after successful sync with updates", async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: true, total: 4, imported: 1, updated: 2, errors: [] },
      error: null,
    });

    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSyncJotform(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["sales"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["profiles"] });
  });
});
