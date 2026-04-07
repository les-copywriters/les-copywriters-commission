import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Sale } from "@/types";
import { CLOSER_RATE, SETTER_RATE } from "@/lib/commissionRates";

type SaleRow = {
  id: string;
  date: string;
  client_name: string;
  client_email: string;
  product: string;
  closer_id: string;
  setter_id: string;
  amount: number;
  amount_ttc: number | null;
  tax_amount: number | null;
  closer_commission: number;
  setter_commission: number;
  bonus: number | null;
  refunded: boolean;
  impaye: boolean;
  payment_platform: string | null;
  payment_type: "pif" | "installments";
  num_installments: number | null;
  installment_amount: number | null;
  first_payment_date: string | null;
  call_recording_link: string | null;
  notes: string | null;
  jotform_submission_id: string | null;
  closer_profile: { id: string; name: string } | null;
  setter_profile: { id: string; name: string } | null;
};

const mapSale = (row: SaleRow): Sale => ({
  id: row.id,
  date: row.date,
  clientName: row.client_name,
  clientEmail: row.client_email,
  product: row.product,
  closer: row.closer_profile?.name ?? row.closer_id,
  setter: row.setter_profile?.name ?? row.setter_id,
  closerId: row.closer_id,
  setterId: row.setter_id,
  amount: row.amount,
  amountTTC: row.amount_ttc ?? undefined,
  taxAmount: row.tax_amount ?? undefined,
  closerCommission: row.closer_commission,
  setterCommission: row.setter_commission,
  bonus: row.bonus ?? undefined,
  refunded: row.refunded,
  impaye: row.impaye,
  paymentType: row.payment_type,
  numInstallments: row.num_installments ?? undefined,
  installmentAmount: row.installment_amount ?? undefined,
  firstPaymentDate: row.first_payment_date ?? undefined,
  paymentPlatform: row.payment_platform ?? undefined,
  callRecordingLink: row.call_recording_link ?? undefined,
  notes: row.notes ?? undefined,
  jotformSubmissionId: row.jotform_submission_id ?? undefined,
});

const fetchSales = async (): Promise<Sale[]> => {
  const { data, error } = await supabase
    .from("sales")
    .select(`
      *,
      closer_profile:profiles!closer_id(id, name),
      setter_profile:profiles!setter_id(id, name)
    `)
    .order("date", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as SaleRow[]).map(mapSale);
};

export const useSales = () =>
  useQuery({ queryKey: ["sales"], queryFn: fetchSales });

export type NewSaleInput = {
  date: string;
  clientName: string;
  clientEmail: string;
  product: string;
  closerId: string;
  setterId: string;
  amountTTC: number;
  taxAmount: number;
  paymentPlatform: string;
  paymentType: "pif" | "installments";
  notes?: string;
};


export const useAddSale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewSaleInput) => {
      const amountHT = Math.round((input.amountTTC - input.taxAmount) * 100) / 100;
      const { error } = await supabase.from("sales").insert({
        date: input.date,
        client_name: input.clientName,
        client_email: input.clientEmail,
        product: input.product,
        closer_id: input.closerId,
        setter_id: input.setterId,
        amount: amountHT,
        amount_ttc: input.amountTTC,
        tax_amount: input.taxAmount,
        closer_commission: Math.round(amountHT * CLOSER_RATE * 100) / 100,
        setter_commission: Math.round(amountHT * SETTER_RATE * 100) / 100,
        refunded: false,
        impaye: false,
        payment_platform: input.paymentPlatform || null,
        payment_type: input.paymentType,
        notes: input.notes || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales"] }),
  });
};

export const useUpdateCommission = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, closerCommission }: { id: string; closerCommission: number }) => {
      const { error } = await supabase
        .from("sales")
        .update({ closer_commission: closerCommission })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales"] }),
  });
};

export const useDeleteSale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales"] }),
  });
};
