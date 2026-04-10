import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act } from "@testing-library/react";
import { useUpdateRefundStatus } from "./useRefunds";
import { ReactNode } from "react";

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const makeWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useUpdateRefundStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses RPC when available", async () => {
    mockRpc.mockResolvedValue({ error: null });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateRefundStatus(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: "refund-id",
        saleId: "sale-id",
        status: "approved",
      });
    });

    expect(mockRpc).toHaveBeenCalledWith("set_refund_status", {
      p_refund_id: "refund-id",
      p_status: "approved",
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("bubbles rpc errors that are not fallback-safe", async () => {
    mockRpc.mockResolvedValue({ error: { message: "permission denied for function set_refund_status" } });

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useUpdateRefundStatus(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          id: "refund-id",
          saleId: "sale-id",
          status: "approved",
        });
      }),
    ).rejects.toThrow("permission denied for function set_refund_status");
  });
});
