import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type SyncResult = {
  total:    number;
  imported: number;
  updated:  number;
  errors:   string[];
};

export const useSyncJotform = () => {
  const qc = useQueryClient();
  return useMutation<SyncResult, Error>({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-jotform");

      if (error) {
        // supabase-js wraps the real response body — extract it
        const body = await (error as any).context?.json?.().catch?.(() => null);
        throw new Error(body?.error ?? error.message);
      }

      if (!data?.ok) throw new Error(data?.error ?? "Sync failed");
      return data as SyncResult;
    },
    onSuccess: (data) => {
      // Invalidate whenever anything changed (new imports OR setter updates)
      if (data.imported > 0 || (data.updated ?? 0) > 0) {
        qc.invalidateQueries({ queryKey: ["sales"] });
      }
    },
  });
};
