import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const SYSTEM_PROMPT = `You are an elite personal sales assistant embedded inside a sales dashboard.
You coach one closer at a time using only the provided dashboard context.
Your priority is post-call coaching and pattern recognition.
Rules:
- Use only the supplied context. Do not invent facts.
- Prefer specific coaching over generic motivation.
- When making a claim about past calls, cite the relevant call IDs provided in context.
- If context is missing, say so plainly.
- Return ONLY valid JSON.`;

type Citation = {
  call_id: string;
  call_title: string | null;
  call_date: string | null;
  reason: string;
};

type AssistantOutput = {
  answer: string;
  citations: Citation[];
};

type MessageRow = {
  id: string;
  content: string;
  role: "user" | "assistant";
  created_at: string;
  citations: Citation[] | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function compact(text: string, maxLength: number) {
  const normalized = text.trim().replace(/\s+/g, " ");
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function uniqueCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  const result: Citation[] = [];

  for (const citation of citations) {
    if (!citation.call_id || seen.has(citation.call_id)) continue;
    seen.add(citation.call_id);
    result.push({
      call_id: citation.call_id,
      call_title: citation.call_title ?? null,
      call_date: citation.call_date ?? null,
      reason: compact(citation.reason || "Referenced for coaching context.", 160),
    });
  }

  return result.slice(0, 4);
}

function normalizeAssistantOutput(value: unknown): AssistantOutput | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  const answer = typeof candidate.answer === "string" ? candidate.answer.trim() : "";
  if (!answer) return null;

  const citations = Array.isArray(candidate.citations)
    ? candidate.citations.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const citation = entry as Record<string, unknown>;
        return [{
          call_id: typeof citation.call_id === "string" ? citation.call_id : "",
          call_title: typeof citation.call_title === "string" ? citation.call_title : null,
          call_date: typeof citation.call_date === "string" ? citation.call_date : null,
          reason: typeof citation.reason === "string" ? citation.reason : "Referenced by the assistant.",
        }];
      })
    : [];

  return { answer, citations };
}

function serializeError(error: unknown) {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : JSON.stringify(error);
}

async function ensureThread(adminClient: ReturnType<typeof createClient>, closerId: string, actorId: string, threadId?: string, firstMessage?: string) {
  if (threadId) {
    const { data: existing, error } = await adminClient
      .from("assistant_threads")
      .select("*")
      .eq("id", threadId)
      .single();
    if (error || !existing) throw new Error("Conversation not found.");
    return existing;
  }

  const now = new Date().toISOString();
  const title = firstMessage ? (firstMessage.slice(0, 40) + (firstMessage.length > 40 ? "..." : "")) : "New Conversation";
  
  const { data: inserted, error: insertError } = await adminClient
    .from("assistant_threads")
    .insert({
      closer_id: closerId,
      created_by: actorId,
      title: title,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (insertError || !inserted) throw new Error(insertError?.message ?? "Unable to create assistant thread");
  return inserted;
}

async function generateSnapshotSummary(geminiKey: string, messages: MessageRow[]) {
  const transcript = messages
    .map((message) => `${message.role.toUpperCase()}: ${compact(message.content, 600)}`)
    .join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": geminiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text: "Summarize a coaching conversation into compact memory. Return plain text only.",
          }],
        },
        contents: [{
          role: "user",
          parts: [{
            text: `Summarize the following closer coaching conversation into a compact memory.\nFocus on recurring goals, advice already given, unresolved issues, and promises made.\nLimit to 10 bullet-style sentences in plain text.\n\n${transcript}`,
          }],
        }],
        generationConfig: {
          temperature: 0.2,
        },
      }),
    },
  );

  const payload = await response.json().catch(() => null) as
    | {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      }
    | null;

  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (response.ok && text) return compact(text, 2500);

  return compact(
    messages
      .slice(-12)
      .map((message) => `${message.role === "user" ? "User asked" : "Assistant advised"}: ${message.content}`)
      .join("\n"),
    2500,
  );
}

function buildCallArchive(calls: Array<Record<string, unknown>>, selectedCallId: string | null) {
  let remaining = 14000;
  const lines: string[] = [];

  for (const call of calls) {
    const id = String(call.id);
    if (selectedCallId && id === selectedCallId) continue;

    const feedback = (call.feedback ?? {}) as { summary?: string; strengths?: string[]; improvements?: string[] };
    const details = (call.analysis_details ?? {}) as {
      dominantObjections?: string[];
      coachTags?: string[];
      recommendedNextActions?: string[];
    };
    const line = [
      `Call ${id}`,
      `title=${call.call_title ?? "Untitled"}`,
      `date=${call.call_date ?? "unknown"}`,
      `score=${call.score ?? "n/a"}`,
      feedback.summary ? `summary=${compact(feedback.summary, 280)}` : null,
      feedback.improvements?.length ? `improvements=${feedback.improvements.slice(0, 2).join("; ")}` : null,
      details.dominantObjections?.length ? `objections=${details.dominantObjections.slice(0, 2).join("; ")}` : null,
      details.coachTags?.length ? `tags=${details.coachTags.slice(0, 3).join(", ")}` : null,
      details.recommendedNextActions?.length ? `next=${details.recommendedNextActions.slice(0, 2).join("; ")}` : null,
    ].filter(Boolean).join(" | ");

    if (line.length > remaining) break;
    remaining -= line.length;
    lines.push(line);
  }

  return lines.join("\n");
}

function buildPrompt(args: {
  closerName: string;
  userMessage: string;
  profile: Record<string, unknown> | null;
  framework: string | null;
  archive: string;
  selectedCall: Record<string, unknown> | null;
  memorySummary: string | null;
  recentMessages: MessageRow[];
}) {
  const selectedCallSection = args.selectedCall ? [
    `Selected call ID: ${args.selectedCall.id}`,
    `Selected call title: ${args.selectedCall.call_title ?? "Untitled"}`,
    `Selected call date: ${args.selectedCall.call_date ?? "unknown"}`,
    `Selected call score: ${args.selectedCall.score ?? "n/a"}`,
    `Selected call summary: ${((args.selectedCall.feedback ?? {}) as { summary?: string }).summary ?? "No feedback yet."}`,
    `Selected call analysis details: ${JSON.stringify(args.selectedCall.analysis_details ?? {})}`,
    `Selected call transcript:\n${compact(String(args.selectedCall.transcript ?? ""), 12000)}`,
  ].join("\n") : "No selected call.";

  const profileSection = args.profile
    ? JSON.stringify(args.profile)
    : "No compiled closer profile exists yet.";

  const recentConversation = args.recentMessages
    .slice(-8)
    .map((message) => `${message.role.toUpperCase()}: ${compact(message.content, 500)}`)
    .join("\n");

  return `Closer: ${args.closerName}

Compiled closer profile:
${profileSection}

Closer framework:
${args.framework ? compact(args.framework, 4000) : "No framework available yet."}

Assistant memory snapshot:
${args.memorySummary ?? "No long-term coaching summary yet."}

Recent assistant conversation:
${recentConversation || "No recent conversation yet."}

Historical analyzed call archive:
${args.archive || "No analyzed calls are available yet."}

Focused selected call:
${selectedCallSection}

User request:
${args.userMessage}

Return ONLY this JSON:
{
  "answer": "<concise coaching answer>",
  "citations": [
    {
      "call_id": "<real call id from context>",
      "call_title": "<title or null>",
      "call_date": "<date or null>",
      "reason": "<why this call supports the advice>"
    }
  ]
}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ ok: false, error: "Missing Authorization header" }, 401);

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return json({ ok: false, error: "GEMINI_API_KEY secret not set" }, 500);

  let body: { closer_id?: string; thread_id?: string; selected_call_id?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const message = body.message?.trim();
  if (!message) return json({ ok: false, error: "message is required" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ ok: false, error: "Missing Supabase environment variables." }, 500);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerUserData, error: callerUserError } = await callerClient.auth.getUser();
  if (callerUserError || !callerUserData.user) return json({ ok: false, error: "Unauthorized" }, 401);

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, name, role")
    .eq("id", callerUserData.user.id)
    .single();

  if (profileError || !callerProfile) return json({ ok: false, error: "Profile not found" }, 404);

  let closerId = callerProfile.id;
  if (callerProfile.role === "admin") {
    if (body.closer_id) {
      closerId = body.closer_id;
    } else if (body.selected_call_id) {
      const { data: selectedCallOwner } = await adminClient
        .from("call_analyses")
        .select("closer_id")
        .eq("id", body.selected_call_id)
        .maybeSingle();
      if (selectedCallOwner?.closer_id) closerId = selectedCallOwner.closer_id;
    } else {
      return json({ ok: false, error: "Admin requests must include closer_id or selected_call_id." }, 400);
    }
  }

  if (callerProfile.role !== "admin" && closerId !== callerProfile.id) {
    return json({ ok: false, error: "Forbidden" }, 403);
  }

  const { data: closerProfileRecord, error: closerLookupError } = await adminClient
    .from("profiles")
    .select("id, name")
    .eq("id", closerId)
    .single();

  if (closerLookupError || !closerProfileRecord) return json({ ok: false, error: "Closer not found" }, 404);

  try {
    const thread = await ensureThread(adminClient, closerId, callerProfile.id, body.thread_id, message);
    const now = new Date().toISOString();

    const { data: existingMessages, error: messagesError } = await adminClient
      .from("assistant_messages")
      .select("id, content, role, created_at, citations")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true });
    if (messagesError) throw new Error(messagesError.message);

    const { data: latestSnapshot, error: snapshotError } = await adminClient
      .from("assistant_memory_snapshots")
      .select("*")
      .eq("closer_id", closerId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (snapshotError) throw new Error(snapshotError.message);

    const messages = (existingMessages ?? []) as MessageRow[];
    let memorySnapshot = latestSnapshot;
    let memorySnapshotUsed = Boolean(memorySnapshot?.summary);
    const shouldSnapshot = messages.length >= 12 && (memorySnapshot?.message_count_covered ?? 0) < messages.length - 8;

    if (shouldSnapshot) {
      const coveredCount = Math.max(0, messages.length - 8);
      const summary = await generateSnapshotSummary(geminiKey, messages.slice(0, coveredCount));
      const { data: savedSnapshot, error: saveSnapshotError } = await adminClient
        .from("assistant_memory_snapshots")
        .insert({
          closer_id: closerId,
          summary,
          message_count_covered: coveredCount,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();
      if (saveSnapshotError) throw new Error(saveSnapshotError.message);
      memorySnapshot = savedSnapshot;
      memorySnapshotUsed = true;
    }

    const { data: selectedCall, error: selectedCallError } = body.selected_call_id
      ? await adminClient
          .from("call_analyses")
          .select("id, closer_id, call_title, call_date, score, feedback, analysis_details, transcript")
          .eq("id", body.selected_call_id)
          .single()
      : { data: null, error: null };

    if (selectedCallError) throw new Error(selectedCallError.message);
    if (selectedCall && selectedCall.closer_id !== closerId) {
      return json({ ok: false, error: "Selected call does not belong to this closer." }, 400);
    }

    const { data: frameworkRow, error: frameworkError } = await adminClient
      .from("closer_frameworks")
      .select("framework")
      .eq("closer_id", closerId)
      .maybeSingle();
    if (frameworkError) throw new Error(frameworkError.message);

    const { data: compiledProfile, error: compiledProfileError } = await adminClient
      .from("closer_profiles")
      .select("*")
      .eq("closer_id", closerId)
      .maybeSingle();
    if (compiledProfileError) throw new Error(compiledProfileError.message);

    const { data: analyzedCalls, error: callsError } = await adminClient
      .from("call_analyses")
      .select("id, call_title, call_date, score, feedback, analysis_details")
      .eq("closer_id", closerId)
      .eq("status", "done")
      .order("call_date", { ascending: false });
    if (callsError) throw new Error(callsError.message);

    const callLookup = new Map<string, Citation>();
    for (const call of analyzedCalls ?? []) {
      callLookup.set(String(call.id), {
        call_id: String(call.id),
        call_title: call.call_title ?? null,
        call_date: call.call_date ?? null,
        reason: "Referenced by the assistant.",
      });
    }
    if (selectedCall) {
      callLookup.set(String(selectedCall.id), {
        call_id: String(selectedCall.id),
        call_title: selectedCall.call_title ?? null,
        call_date: selectedCall.call_date ?? null,
        reason: "Selected call context.",
      });
    }

    const userSnapshot = {
      selected_call_id: body.selected_call_id ?? null,
      selected_call_title: selectedCall?.call_title ?? null,
      calls_analyzed: analyzedCalls?.length ?? 0,
      profile_available: Boolean(compiledProfile),
      framework_available: Boolean(frameworkRow?.framework),
    };

    const { error: userMessageError } = await adminClient
      .from("assistant_messages")
      .insert({
        thread_id: thread.id,
        closer_id: closerId,
        role: "user",
        content: message,
        citations: [],
        context_snapshot: userSnapshot,
        created_by: callerProfile.id,
        created_at: now,
      });
    if (userMessageError) throw new Error(userMessageError.message);

    const recentMessages = [...messages, {
      id: "current-user-message",
      role: "user" as const,
      content: message,
      created_at: now,
      citations: [],
    }];

    const prompt = buildPrompt({
      closerName: closerProfileRecord.name,
      userMessage: message,
      profile: compiledProfile,
      framework: frameworkRow?.framework ?? null,
      archive: buildCallArchive(analyzedCalls ?? [], body.selected_call_id ?? null),
      selectedCall,
      memorySummary: memorySnapshot?.summary ?? null,
      recentMessages,
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": geminiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents: [{
            role: "user",
            parts: [{ text: prompt }],
          }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.35,
          },
        }),
      },
    );

    const payload = await response.json().catch(() => null) as
      | {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
          error?: { message?: string };
        }
      | null;

    let parsed: AssistantOutput | null = null;
    if (response.ok) {
      const rawText = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
      try {
        parsed = normalizeAssistantOutput(JSON.parse(rawText));
      } catch {
        parsed = null;
      }
    }

    if (!parsed) {
      const fallbackAnswer = compiledProfile?.overview
        ? `${compiledProfile.overview} Start by reviewing the selected call against the top development priorities, then tighten the next-step language and objection handling.`
        : "I don’t have enough analyzed-call context yet to give a precise coaching answer. Analyze a few calls first, or ask me about the currently selected call.";
      parsed = {
        answer: fallbackAnswer,
        citations: body.selected_call_id && callLookup.has(body.selected_call_id)
          ? [callLookup.get(body.selected_call_id)!]
          : [],
      };
    }

    const citations = uniqueCitations(
      (parsed.citations ?? [])
        .map((citation) => ({
          call_id: String(citation.call_id ?? ""),
          call_title: citation.call_title ?? callLookup.get(String(citation.call_id ?? ""))?.call_title ?? null,
          call_date: citation.call_date ?? callLookup.get(String(citation.call_id ?? ""))?.call_date ?? null,
          reason: citation.reason ?? "Referenced by the assistant.",
        }))
        .filter((citation) => callLookup.has(citation.call_id)),
    );

    const safeAnswer = parsed.answer.trim();
    if (!safeAnswer) {
      throw new Error("Assistant produced an empty answer.");
    }

    const assistantSnapshot = {
      ...userSnapshot,
      memory_snapshot_used: memorySnapshotUsed,
      citation_count: citations.length,
    };

    const { data: assistantMessage, error: assistantMessageError } = await adminClient
      .from("assistant_messages")
      .insert({
        thread_id: thread.id,
        closer_id: closerId,
        role: "assistant",
        content: safeAnswer,
        citations,
        context_snapshot: assistantSnapshot,
        created_by: callerProfile.id,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (assistantMessageError || !assistantMessage) throw new Error(assistantMessageError?.message ?? "Failed to save assistant response");

    const { error: threadUpdateError } = await adminClient
      .from("assistant_threads")
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", thread.id);
    if (threadUpdateError) throw new Error(threadUpdateError.message);

    return json({
      answer: safeAnswer,
      citations,
      thread_id: thread.id,
      message_id: assistantMessage.id,
      context_meta: {
        calls_analyzed: analyzedCalls?.length ?? 0,
        selected_call_included: Boolean(selectedCall),
        framework_included: Boolean(frameworkRow?.framework),
        profile_included: Boolean(compiledProfile),
        memory_snapshot_used: memorySnapshotUsed,
      },
    });
  } catch (error) {
    console.error("[sales-assistant] uncaught:", error);
    return json({ ok: false, error: serializeError(error) }, 500);
  }
});
