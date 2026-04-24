import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { AssistantCitation, AssistantMessage, AssistantThread, SalesAssistantResponse } from "@/types";

type AssistantThreadRow = {
  id: string;
  closer_id: string;
  title: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  share_id: string | null;
  created_by: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

type AssistantMessageRow = {
  id: string;
  thread_id: string;
  closer_id: string;
  role: "user" | "assistant";
  content: string;
  citations: unknown;
  context_snapshot: unknown;
  created_by: string | null;
  created_at: string;
};

const mapCitation = (value: unknown): AssistantCitation[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const citation = entry as Record<string, unknown>;
    const callId = typeof citation.call_id === "string" ? citation.call_id : "";
    if (!callId) return [];

    return [{
      callId,
      callTitle: typeof citation.call_title === "string" ? citation.call_title : null,
      callDate: typeof citation.call_date === "string" ? citation.call_date : null,
      reason: typeof citation.reason === "string" ? citation.reason : "Referenced by the assistant.",
    }];
  });
};

const mapThread = (row: AssistantThreadRow): AssistantThread => ({
  id: row.id,
  closerId: row.closer_id,
  title: row.title ?? "New Conversation",
  isPinned: row.is_pinned,
  isArchived: row.is_archived,
  shareId: row.share_id,
  createdBy: row.created_by,
  lastMessageAt: row.last_message_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapMessage = (row: AssistantMessageRow): AssistantMessage => ({
  id: row.id,
  threadId: row.thread_id,
  closerId: row.closer_id,
  role: row.role,
  content: row.content,
  citations: mapCitation(row.citations),
  contextSnapshot: (row.context_snapshot && typeof row.context_snapshot === "object")
    ? row.context_snapshot as Record<string, unknown>
    : {},
  createdBy: row.created_by,
  createdAt: row.created_at,
});

export const useAssistantThreads = (closerId: string | null) =>
  useQuery({
    queryKey: ["assistant_threads", closerId],
    queryFn: async (): Promise<AssistantThread[]> => {
      if (!closerId) return [];

      const { data, error } = await supabase
        .from("assistant_threads")
        .select("*")
        .eq("closer_id", closerId)
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data as AssistantThreadRow[]).map(mapThread);
    },
    enabled: !!closerId,
  });

export const useAssistantMessages = (threadId: string | null) =>
  useQuery({
    queryKey: ["assistant_messages", threadId],
    queryFn: async (): Promise<AssistantMessage[]> => {
      if (!threadId) return [];

      const { data, error } = await supabase
        .from("assistant_messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (error) throw new Error(error.message);
      return (data as AssistantMessageRow[]).map(mapMessage);
    },
    enabled: !!threadId,
  });

export const useSalesAssistant = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { closerId?: string; threadId?: string; selectedCallId?: string; message: string }): Promise<SalesAssistantResponse> => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        throw new Error(sessionError.message);
      }

      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const { data, error } = await supabase.functions.invoke("sales-assistant", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          closer_id: payload.closerId,
          thread_id: payload.threadId,
          selected_call_id: payload.selectedCallId,
          message: payload.message,
        },
      });

      if (error) {
        const normalizedMessage = error.message.toLowerCase();
        const ctx = error as { context?: { json?: () => Promise<{ error?: string }>; text?: () => Promise<string> } };
        const body = await ctx.context?.json?.().catch(() => null);
        const text = !body ? await ctx.context?.text?.().catch(() => null) : null;
        const serverError = (body as { error?: string })?.error
          ?? (() => {
            if (!text) return null;
            try {
              return (JSON.parse(text) as { error?: string })?.error ?? text;
            } catch {
              return text;
            }
          })();

        if (serverError) {
          throw new Error(serverError);
        }

        if (normalizedMessage.includes("failed to send a request to the edge function")) {
          throw new Error(
            "Could not reach the `sales-assistant` Edge Function. Deploy the new Supabase functions and confirm the project has the required secrets like GEMINI_API_KEY.",
          );
        }

        throw new Error(error.message);
      }

      const result = data as {
        answer: string;
        citations: Array<{
          call_id: string;
          call_title: string | null;
          call_date: string | null;
          reason: string;
        }>;
        thread_id: string;
        message_id: string;
        context_meta: {
          calls_analyzed: number;
          selected_call_included: boolean;
          framework_included: boolean;
          profile_included: boolean;
          memory_snapshot_used: boolean;
        };
      };

      return {
        answer: result.answer,
        citations: result.citations.map((citation) => ({
          callId: citation.call_id,
          callTitle: citation.call_title,
          callDate: citation.call_date,
          reason: citation.reason,
        })),
        threadId: result.thread_id,
        messageId: result.message_id,
        contextMeta: {
          callsAnalyzed: result.context_meta.calls_analyzed,
          selectedCallIncluded: result.context_meta.selected_call_included,
          frameworkIncluded: result.context_meta.framework_included,
          profileIncluded: result.context_meta.profile_included,
          memorySnapshotUsed: result.context_meta.memory_snapshot_used,
        },
      };
    },
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ["assistant_threads", variables.closerId ?? null] });
      qc.invalidateQueries({ queryKey: ["assistant_messages"] });
    },
  });
};

export const useDeleteAssistantThread = (closerId: string | null) => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await supabase
        .from("assistant_threads")
        .delete()
        .eq("id", threadId);

      if (error) throw new Error(error.message);
      return threadId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assistant_threads", closerId] });
      qc.invalidateQueries({ queryKey: ["assistant_messages"] });
    },
  });
};

export const useUpdateAssistantThread = (closerId: string | null) => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ threadId, ...updates }: { threadId: string } & Partial<AssistantThreadRow>) => {
      const { error } = await supabase
        .from("assistant_threads")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", threadId);

      if (error) throw new Error(error.message);
      return { threadId, ...updates };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assistant_threads", closerId] });
    },
  });
};
