import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type CommissionHealthReport = {
  ok: boolean;
  generatedAt: string;
  monthlyRefunds: number;
  weeklyImpayes: number;
  discrepancyCounts: Record<string, number>;
  totalDiscrepancies: number;
  slackNotified: boolean;
};

export const useCommissionHealthReport = () =>
  useMutation<CommissionHealthReport, Error, { notifySlack?: boolean }>({
    mutationFn: async ({ notifySlack = false } = {}) => {
      const { data, error } = await supabase.functions.invoke("commission-health-report", {
        body: { notifySlack },
      });

      if (error) {
        const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } })
          .context
          ?.json
          ?.()
          .catch?.(() => null);
        throw new Error(body?.error ?? error.message);
      }

      if (!data || typeof data !== "object" || !("ok" in data)) {
        throw new Error("Invalid health report response.");
      }

      const report = data as CommissionHealthReport & { error?: string };
      if (!report.ok) {
        throw new Error(report.error ?? "Health report failed.");
      }

      return report;
    },
  });
