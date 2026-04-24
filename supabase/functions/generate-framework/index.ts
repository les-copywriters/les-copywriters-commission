import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `You are a world-class sales coach and trainer.
Your job is to extract a personalised, reusable sales framework from real call transcripts.
Return your response in clean Markdown — no preamble, just the framework document.`;
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

function buildPrompt(transcripts: { title: string; content: string }[]): string {
  const callsBlock = transcripts
    .map((t, i) => `### Call ${i + 1}: ${t.title}\n\n${t.content}`)
    .join("\n\n---\n\n");

  return `Analyze the following ${transcripts.length} sales call transcript(s) from the same closer and extract their personal selling style and best practices into a structured framework.

${callsBlock}

---

Create a Markdown document titled "# [Closer's] Sales Framework" with the following sections:

## Opening & Rapport Building
Describe how they open calls, establish trust, and build rapport.

## Discovery & Qualification
How do they uncover pain points, goals, and qualify the prospect?

## Presentation & Value Proposition
How do they pitch the offer, what language do they use, what do they emphasize?

## Objection Handling
What objections come up, and how do they handle them?

## Closing Techniques
What closing language and techniques do they use?

## Key Strengths & Patterns
What makes this closer unique and effective?

## Areas to Develop
What patterns suggest room for improvement?

Be specific, use examples from the transcripts, and write in a coaching tone.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  let body: { closer_id: string; call_ids: string[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.closer_id) return json({ error: "closer_id is required" }, 400);
  if (!Array.isArray(body.call_ids) || body.call_ids.length === 0) {
    return json({ error: "call_ids must be a non-empty array" }, 400);
  }
  if (body.call_ids.length > 10) {
    return json({ error: "Maximum 10 calls per framework generation" }, 400);
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return json({ error: "GEMINI_API_KEY secret not set" }, 500);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: callerProfile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    if (callerProfile?.role !== "admin") return json({ error: "Admin access required" }, 403);

    // Fetch the selected call transcripts
    const { data: calls, error: callsError } = await supabase
      .from("call_analyses")
      .select("id, call_title, transcript, fathom_meeting_id")
      .in("id", body.call_ids)
      .eq("closer_id", body.closer_id);

    if (callsError) return json({ error: callsError.message }, 500);

    const withTranscripts = (calls ?? []).filter((c) => c.transcript && c.transcript.length > 100);
    if (withTranscripts.length === 0) {
      return json({ error: "None of the selected calls have a transcript. Sync calls first." }, 400);
    }

    console.log(`[generate-framework] generating for closer ${body.closer_id} from ${withTranscripts.length} calls`);

    // Call Gemini
    const geminiResponse = await fetch(
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
            parts: [{
              text: buildPrompt(
                withTranscripts.map((c) => ({
                  title: c.call_title ?? c.fathom_meeting_id ?? "Untitled",
                  content: c.transcript!,
                })),
              ),
            }],
          }],
          generationConfig: {
            temperature: 0.4,
          },
        }),
      },
    );

    const geminiJson = await geminiResponse.json().catch(() => null) as
      | {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
          error?: { message?: string };
        }
      | null;

    if (!geminiResponse.ok) {
      return json({ error: geminiJson?.error?.message ?? `Gemini API ${geminiResponse.status}` }, 500);
    }

    const framework = geminiJson?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";
    if (!framework) return json({ error: "Gemini returned an empty framework" }, 500);

    const usedMeetingIds = withTranscripts
      .map((c) => c.fathom_meeting_id)
      .filter(Boolean) as string[];

    // Upsert framework (one per closer)
    const { error: upsertError } = await supabase
      .from("closer_frameworks")
      .upsert({
        closer_id: body.closer_id,
        framework,
        generated_from_calls: usedMeetingIds,
        updated_at: new Date().toISOString(),
      }, { onConflict: "closer_id" });

    if (upsertError) return json({ error: upsertError.message }, 500);

    console.log(`[generate-framework] done — framework saved for closer ${body.closer_id}`);
    return json({ ok: true, framework, calls_used: withTranscripts.length });

  } catch (err) {
    console.error("[generate-framework] uncaught:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});
