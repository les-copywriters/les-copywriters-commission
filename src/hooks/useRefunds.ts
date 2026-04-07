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
      const { error: refundError } = await supabase
        .from("refunds")
        .update({ status })
        .eq("id", id);
      if (refundError) throw new Error(refundError.message);

      // Keep the sale's refunded flag in sync with the refund status
      const { error: saleError } = await supabase
        .from("sales")
        .update({ refunded: status === "approved" })
        .eq("id", saleId);
      if (saleError) throw new Error(saleError.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["refunds"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
  });
};
