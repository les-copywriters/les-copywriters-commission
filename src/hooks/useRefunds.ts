import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Refund } from "@/types";

type RefundRow = {
  id: string;
  sale_id: string;
  amount: number;
  date: string;
  status: "pending" | "approved" | "refused";
};

const mapRefund = (row: RefundRow): Refund => ({
  id: row.id,
  saleId: row.sale_id,
  amount: row.amount,
  date: row.date,
  status: row.status,
});

const fetchRefunds = async (): Promise<Refund[]> => {
  const { data, error } = await supabase
    .from("refunds")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as RefundRow[]).map(mapRefund);
};

export const useRefunds = () =>
  useQuery({ queryKey: ["refunds"], queryFn: fetchRefunds });

export const useUpdateRefundStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      saleId,
      status,
    }: {
      id: string;
      saleId: string;
      status: "approved" | "refused" | "pending";
    }) => {
      // Prefer server-side atomic update when RPC is available.
      const { error: rpcError } = await supabase.rpc("set_refund_status", {
        p_refund_id: id,
        p_status: status,
      });

      if (!rpcError) {
        return;
      }

      const rpcNotAvailable =
        rpcError.message.includes("Could not find the function") ||
        rpcError.message.includes("does not exist");

      if (!rpcNotAvailable) {
        throw new Error(rpcError.message);
      }

      // Backward-compatible fallback: perform a best-effort two-step update
      // and roll back refund status if sales update fails.
      const { data: currentRefund, error: currentRefundError } = await supabase
        .from("refunds")
        .select("status")
        .eq("id", id)
        .single();
      if (currentRefundError) throw new Error(currentRefundError.message);

      const previousStatus = currentRefund.status;

      const { error: refundError } = await supabase
        .from("refunds")
        .update({ status })
        .eq("id", id);
      if (refundError) throw new Error(refundError.message);

      const { error: saleError } = await supabase
        .from("sales")
        .update({ refunded: status === "approved" })
        .eq("id", saleId);

      if (saleError) {
        await supabase
          .from("refunds")
          .update({ status: previousStatus })
          .eq("id", id);
        throw new Error(saleError.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["refunds"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
  });
};
