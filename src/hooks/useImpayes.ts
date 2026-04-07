import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Impaye } from "@/types";

type ImpayeRow = {
  id: string;
  sale_id: string;
  amount: number;
  date: string;
};

const fetchImpayes = async (): Promise<Impaye[]> => {
  const { data, error } = await supabase
    .from("impayes")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as ImpayeRow[]).map((row) => ({
    id: row.id,
    saleId: row.sale_id,
    amount: row.amount,
    date: row.date,
  }));
};

export const useImpayes = () =>
  useQuery({ queryKey: ["impayes"], queryFn: fetchImpayes });
