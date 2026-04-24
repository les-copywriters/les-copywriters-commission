import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type GlobalSetting = {
  key: string;
  value: string | null;
  description: string | null;
  isSecret: boolean;
  updatedAt: string;
};

export const useGlobalSettings = () =>
  useQuery({
    queryKey: ["global_settings"],
    queryFn: async (): Promise<GlobalSetting[]> => {
      const { data, error } = await supabase
        .from("global_settings")
        .select("*")
        .order("key");

      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        key: row.key,
        value: row.value,
        description: row.description,
        isSecret: row.is_secret,
        updatedAt: row.updated_at,
      }));
    },
  });

export const useUpdateGlobalSetting = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string | null }) => {
      const { error } = await supabase
        .from("global_settings")
        .update({ value, updated_at: new Date().toISOString() })
        .eq("key", key);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["global_settings"] });
    },
  });
};
