import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type AuditEntry = {
  id: string;
  saleId: string;
  clientName: string;
  changedByName: string;
  oldAmount: number;
  newAmount: number;
  changedAt: string;
};

export const useCommissionAuditLog = () =>
  useQuery({
    queryKey: ["commission_audit_log"],
    queryFn: async (): Promise<AuditEntry[]> => {
      const { data, error } = await supabase
        .from("commission_audit_log")
        .select(`
          id,
          sale_id,
          old_amount,
          new_amount,
          changed_at,
          sale:sales(client_name),
          changer:profiles!changed_by(name)
        `)
        .order("changed_at", { ascending: false })
        .limit(50);

      if (error) throw new Error(error.message);

      return (data ?? []).map((row: {
        id: string;
        sale_id: string;
        old_amount: number;
        new_amount: number;
        changed_at: string;
        sale: { client_name: string } | null;
        changer: { name: string } | null;
      }) => ({
        id: row.id,
        saleId: row.sale_id,
        clientName: row.sale?.client_name ?? row.sale_id,
        changedByName: row.changer?.name ?? "Unknown",
        oldAmount: row.old_amount,
        newAmount: row.new_amount,
        changedAt: row.changed_at,
      }));
    },
  });
