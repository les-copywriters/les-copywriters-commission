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
        const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } })
          .context
          ?.json
          ?.()
          .catch?.(() => null);
        throw new Error(body?.error ?? error.message);
      }

      if (!data || typeof data !== "object") {
        throw new Error("Invalid sync response.");
      }

      const result = data as SyncResult & { ok?: boolean; error?: string };
      if (!result.ok) throw new Error(result.error ?? "Sync failed");

      return {
        total: result.total ?? 0,
        imported: result.imported ?? 0,
        updated: result.updated ?? 0,
        errors: Array.isArray(result.errors) ? result.errors : [],
      };
    },
    onSuccess: (data) => {
      // Always refetch sales post-sync to keep admin views deterministic.
      qc.invalidateQueries({ queryKey: ["sales"] });
      if ((data.updated ?? 0) > 0) {
        qc.invalidateQueries({ queryKey: ["profiles"] });
      }
    },
  });
};
