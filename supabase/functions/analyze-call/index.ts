import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { refreshCloserProfile } from "../_shared/closerProfile.ts";

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

const SYSTEM_PROMPT = `You are an expert sales coach specializing in high-ticket closing.
Your task is to analyze a sales call transcript and provide structured feedback.
You MUST respond with ONLY a valid JSON object — no markdown, no explanation, just the JSON.`;
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

type ParsedFeedback = {
  score: number;
  feedback: {
    summary: string;
    strengths: string[];
    improvements: string[];
  };
  analysis_details: {
    rapportScore: number;
    discoveryScore: number;
    pitchScore: number;
    objectionHandlingScore: number;
    closingScore: number;
    confidenceScore: number;
    nextStepClarityScore: number;
    dominantObjections: string[];
    buyerSignals: string[];
    coachTags: string[];
    missedOpportunities: string[];
    recommendedNextActions: string[];
  };
};

function buildUserPrompt(transcript: string, framework: string | null): string {
  const frameworkSection = framework
    ? `\n\n## Closer's Established Sales Framework\nUse this as the benchmark for evaluation:\n${framework}`
    : "\n\n## Framework\nNo personal framework available yet. Evaluate based on universal high-ticket sales best practices.";

  return `${frameworkSection}

## Sales Call Transcript
${transcript}

## Instructions
Analyze the transcript and return ONLY this JSON structure (no extra text):
{
  "score": <integer 0-100>,
  "feedback": {
    "summary": "<2-3 sentence overview of the call>",
    "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
    "improvements": ["<specific area to improve 1>", "<specific area to improve 2>", "<specific area to improve 3>"]
  },
  "analysis_details": {
    "rapportScore": <integer 0-100>,
    "discoveryScore": <integer 0-100>,
    "pitchScore": <integer 0-100>,
    "objectionHandlingScore": <integer 0-100>,
    "closingScore": <integer 0-100>,
    "confidenceScore": <integer 0-100>,
    "nextStepClarityScore": <integer 0-100>,
    "dominantObjections": ["<objection 1>", "<objection 2>"],
    "buyerSignals": ["<signal 1>", "<signal 2>"],
    "coachTags": ["<tag 1>", "<tag 2>", "<tag 3>"],
    "missedOpportunities": ["<missed opportunity 1>", "<missed opportunity 2>"],
    "recommendedNextActions": ["<action 1>", "<action 2>", "<action 3>"]
  }
}

Scoring guide: 90-100 = exceptional, 70-89 = solid, 50-69 = average, 30-49 = needs work, 0-29 = significant issues.`;
}

function clampScore(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function uniqueStrings(values: string[], minimum: string[] = [], limit = 3) {
  const seen = new Set<string>();
  const items = [...values, ...minimum]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  return items.slice(0, limit);
}

function buildFallbackAnalysis(transcript: string): ParsedFeedback {
  const normalized = transcript.toLowerCase();
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

  const indicators = {
    questions: (transcript.match(/\?/g) ?? []).length,
    pricing: /(price|pricing|investment|cost|budget|payment|pay|euro|€|usd|\$)/i.test(normalized),
    objections: /(but|concern|worry|hesitat|not sure|too expensive|need to think|later)/i.test(normalized),
    urgency: /(today|now|this week|deadline|spot|close|next step|calendar|book)/i.test(normalized),
    rapport: /(thanks|thank you|appreciate|great question|absolutely|totally|get that)/i.test(normalized),
    confidence: /(definitely|absolutely|for sure|confident|recommend|best fit)/i.test(normalized),
  };

  let score = 52;
  if (wordCount > 500) score += 8;
  if (indicators.questions >= 6) score += 10;
  if (indicators.pricing) score += 8;
  if (indicators.objections) score += 8;
  if (indicators.urgency) score += 6;
  if (indicators.rapport) score += 4;
  if (indicators.confidence) score += 4;
  score = clampScore(score, 35, 82);

  const strengths: string[] = [];
  const improvements: string[] = [];
  const objections: string[] = [];
  const buyerSignals: string[] = [];
  const coachTags: string[] = [];
  const missedOpportunities: string[] = [];
  const nextActions: string[] = [];

  if (indicators.questions >= 6) {
    strengths.push("The call appears discovery-led, with multiple questions used to uncover context and needs.");
    buyerSignals.push("Prospect stayed engaged long enough to support a layered discovery conversation.");
    coachTags.push("discovery");
  } else {
    improvements.push("Ask more layered discovery questions to better surface pain points, urgency, and buying context.");
    missedOpportunities.push("Discovery stayed too shallow before moving toward recommendation.");
    coachTags.push("qualification");
  }

  if (indicators.rapport) {
    strengths.push("The tone suggests rapport-building language that can help the prospect feel understood.");
    coachTags.push("rapport");
  } else {
    improvements.push("Spend more time validating the prospect's situation so the conversation feels more consultative.");
    missedOpportunities.push("Rapport and emotional labeling could have been stronger early in the call.");
  }

  if (indicators.pricing) {
    strengths.push("The conversation seems to reach concrete commercial topics instead of staying too high-level.");
    buyerSignals.push("Commercial topics surfaced, which suggests at least some buying intent.");
    coachTags.push("offer");
  } else {
    improvements.push("Move the conversation toward clearer commitment and investment language before the call ends.");
    missedOpportunities.push("The call did not transition cleanly into investment and commitment language.");
  }

  if (indicators.objections) {
    strengths.push("Objections or hesitation points show that real decision-making topics surfaced during the conversation.");
    improvements.push("Handle objections with tighter reframing and clearer transitions into next steps or commitment.");
    objections.push("Price or timing hesitation surfaced and required stronger reframing.");
    coachTags.push("objection-handling");
  } else {
    improvements.push("Pressure-test the decision more directly so hidden objections come out before the end of the call.");
    missedOpportunities.push("Hidden objections may have remained unspoken.");
  }

  if (indicators.urgency) {
    strengths.push("There are signs of next-step or urgency language, which helps move the deal forward.");
    buyerSignals.push("The prospect heard next-step language, which indicates movement toward a decision.");
    nextActions.push("Keep using clear next-step framing and tighten the close with exact commitments.");
    coachTags.push("closing");
  } else {
    improvements.push("Create a clearer next-step moment with timeline, urgency, and explicit commitment language.");
    nextActions.push("End future calls with a concrete timeline, ownership, and a booked next step.");
    missedOpportunities.push("The close lacked enough urgency or commitment framing.");
  }

  while (strengths.length < 3) {
    strengths.push("The transcript provides enough structure to evaluate the call flow and coaching opportunities.");
  }
  while (improvements.length < 3) {
    improvements.push("Tighten the transition from discovery into recommendation and close with a firmer next step.");
  }
  while (objections.length < 2) {
    objections.push("No explicit objection was clearly surfaced; hidden objections likely remained.");
  }
  while (buyerSignals.length < 2) {
    buyerSignals.push("Buyer intent signals were present but not converted into a firmer commitment.");
  }
  while (missedOpportunities.length < 2) {
    missedOpportunities.push("The call could have used a clearer bridge from pain to urgency to close.");
  }
  while (nextActions.length < 3) {
    nextActions.push("Review the transcript and script a sharper objection-handling and closing sequence.");
  }

  const summary = [
    "This fallback analysis was generated from transcript heuristics because the live AI model was unavailable.",
    indicators.questions >= 6
      ? "The call appears reasonably consultative, with some evidence of discovery and prospect engagement."
      : "The call appears to need stronger discovery and qualification depth before moving toward the offer.",
    indicators.urgency
      ? "There are signs of momentum toward a next step, but objection handling and closing precision can still improve."
      : "The clearest coaching opportunity is to improve commitment language and create a firmer close.",
  ].join(" ");

  return {
    score,
    feedback: {
      summary,
      strengths: strengths.slice(0, 3),
      improvements: improvements.slice(0, 3),
    },
    analysis_details: {
      rapportScore: clampScore(55 + (indicators.rapport ? 20 : -5)),
      discoveryScore: clampScore(50 + (indicators.questions >= 6 ? 22 : -8)),
      pitchScore: clampScore(52 + (indicators.pricing ? 18 : -6)),
      objectionHandlingScore: clampScore(50 + (indicators.objections ? 14 : -4)),
      closingScore: clampScore(50 + (indicators.urgency ? 18 : -10)),
      confidenceScore: clampScore(52 + (indicators.confidence ? 16 : -4)),
      nextStepClarityScore: clampScore(50 + (indicators.urgency ? 20 : -8)),
      dominantObjections: uniqueStrings(objections, [], 2),
      buyerSignals: uniqueStrings(buyerSignals, [], 3),
      coachTags: uniqueStrings(coachTags, ["post-call-review"], 4),
      missedOpportunities: uniqueStrings(missedOpportunities, [], 3),
      recommendedNextActions: uniqueStrings(nextActions, [], 3),
    },
  };
}

function sanitizeParsedFeedback(input: ParsedFeedback): ParsedFeedback {
  return {
    score: clampScore(input.score ?? 0),
    feedback: {
      summary: input.feedback?.summary?.trim() || "No summary returned.",
      strengths: uniqueStrings(input.feedback?.strengths ?? [], ["The call showed enough structure to review and coach."], 3),
      improvements: uniqueStrings(input.feedback?.improvements ?? [], ["Clarify the close and next step more explicitly."], 3),
    },
    analysis_details: {
      rapportScore: clampScore(input.analysis_details?.rapportScore ?? 0),
      discoveryScore: clampScore(input.analysis_details?.discoveryScore ?? 0),
      pitchScore: clampScore(input.analysis_details?.pitchScore ?? 0),
      objectionHandlingScore: clampScore(input.analysis_details?.objectionHandlingScore ?? 0),
      closingScore: clampScore(input.analysis_details?.closingScore ?? 0),
      confidenceScore: clampScore(input.analysis_details?.confidenceScore ?? 0),
      nextStepClarityScore: clampScore(input.analysis_details?.nextStepClarityScore ?? 0),
      dominantObjections: uniqueStrings(input.analysis_details?.dominantObjections ?? [], [], 3),
      buyerSignals: uniqueStrings(input.analysis_details?.buyerSignals ?? [], [], 4),
      coachTags: uniqueStrings(input.analysis_details?.coachTags ?? [], ["post-call-review"], 5),
      missedOpportunities: uniqueStrings(input.analysis_details?.missedOpportunities ?? [], [], 3),
      recommendedNextActions: uniqueStrings(input.analysis_details?.recommendedNextActions ?? [], ["Review this call and rewrite the close."], 3),
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  let body: { call_id: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.call_id) return json({ error: "call_id is required" }, 400);

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return json({ error: "GEMINI_API_KEY secret not set" }, 500);

  try {
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

    const { data: callerProfile } = await adminClient
      .from("profiles").select("id, role").eq("id", callerUserData.user.id).single();
    if (!callerProfile) return json({ error: "Profile not found" }, 404);

    const { data: callRecord, error: callError } = await adminClient
      .from("call_analyses")
      .select("*")
      .eq("id", body.call_id)
      .single();

    if (callError || !callRecord) return json({ error: "Call not found" }, 404);

    if (callerProfile.role !== "admin" && callRecord.closer_id !== callerProfile.id) {
      return json({ error: "Forbidden" }, 403);
    }

    if (!callRecord.transcript) {
      return json({ error: "This call has no transcript to analyze." }, 400);
    }

    await adminClient
      .from("call_analyses")
      .update({ status: "analyzing", updated_at: new Date().toISOString() })
      .eq("id", body.call_id);

    const { data: frameworkRow } = await adminClient
      .from("closer_frameworks")
      .select("framework")
      .eq("closer_id", callRecord.closer_id)
      .maybeSingle();

    const framework = frameworkRow?.framework ?? null;

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
          contents: [
            {
              role: "user",
              parts: [{ text: buildUserPrompt(callRecord.transcript, framework) }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.3,
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

    let parsed: ParsedFeedback;

    if (!geminiResponse.ok) {
      const message = geminiJson?.error?.message ?? `Gemini API ${geminiResponse.status}`;
      const quotaOrCapacityIssue =
        geminiResponse.status === 429 ||
        geminiResponse.status === 503 ||
        /quota|rate limit|high demand|overloaded|unavailable/i.test(message);

      if (!quotaOrCapacityIssue) {
        throw new Error(message);
      }

      parsed = buildFallbackAnalysis(callRecord.transcript);
    } else {
      const rawText = geminiJson?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "";

      try {
        parsed = sanitizeParsedFeedback(JSON.parse(rawText) as ParsedFeedback);
      } catch {
        parsed = buildFallbackAnalysis(callRecord.transcript);
      }
    }

    const score = clampScore(parsed.score ?? 0);
    const analysisDetails = sanitizeParsedFeedback(parsed).analysis_details;
    const feedback = sanitizeParsedFeedback(parsed).feedback;

    await adminClient
      .from("call_analyses")
      .update({
        score,
        feedback,
        analysis_details: analysisDetails,
        status: "done",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.call_id);

    await refreshCloserProfile(adminClient, callRecord.closer_id);

    console.log(`[analyze-call] done — call ${body.call_id}, score: ${score}`);
    return json({ ok: true, score, feedback, analysis_details: analysisDetails });
  } catch (err) {
    console.error("[analyze-call] uncaught:", err);
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase
        .from("call_analyses")
        .update({ status: "error", error_message: String(err), updated_at: new Date().toISOString() })
        .eq("id", body.call_id);
    } catch {
      // best effort only
    }

    return json({ ok: false, error: String(err) }, 500);
  }
});
