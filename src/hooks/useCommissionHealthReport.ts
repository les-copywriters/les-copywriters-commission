import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type CommissionHealthReport = {
  ok: boolean;
  generatedAt: string;
  monthlyRefunds: number;
  weeklyImpayes: number;
  discrepancyCounts: Record<string, number>;
  totalDiscrepancies: number;
  syncHealth: Record<string, {
    status: string;
    freshness: "fresh" | "aging" | "stale" | "missing";
    startedAt: string | null;
    finishedAt: string | null;
    rowsWritten: number;
    recordsSeen: number;
    ageMinutes: number | null;
    errorCount: number;
    lastError: string | null;
  }>;
  reconciliation: {
    jotform: {
      importedSales: number;
      uniqueSubmissionIds: number;
      duplicateSubmissionCount: number;
      missingSubmissionIdCount: number;
      latestImportedSaleDate: string | null;
    };
    aircall: {
      storedCallRecords: number;
      latestRunRecordsSeen: number;
      latestRunRowsWritten: number;
      latestRunStatus: string;
    };
    iclosed: {
      storedFunnelMetricRows: number;
      latestRunRecordsSeen: number;
      latestRunRowsWritten: number;
      latestRunStatus: string;
    };
    fathom: {
      importedMeetings: number;
      meetingsWithTranscript: number;
      pendingTranscriptCount: number;
      latestImportedAt: string | null;
    };
  };
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
