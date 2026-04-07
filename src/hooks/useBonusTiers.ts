import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { BonusTier } from "@/lib/bonusCalculation";

const fetchTiers = async (): Promise<BonusTier[]> => {
  const { data, error } = await supabase
    .from("bonus_tiers")
    .select("id, min_sales, bonus_amount")
    .order("min_sales");
  if (error) throw new Error(error.message);
  return data.map(r => ({ id: r.id, minSales: r.min_sales, bonusAmount: r.bonus_amount }));
};

export const useBonusTiers = () =>
  useQuery({ queryKey: ["bonus_tiers"], queryFn: fetchTiers });

export const useAddBonusTier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ minSales, bonusAmount }: { minSales: number; bonusAmount: number }) => {
      const { error } = await supabase
        .from("bonus_tiers")
        .insert({ min_sales: minSales, bonus_amount: bonusAmount });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bonus_tiers"] }),
  });
};

export const useDeleteBonusTier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bonus_tiers").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bonus_tiers"] }),
  });
};
