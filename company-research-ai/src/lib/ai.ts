const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Locked-in from live testing on the OpenRouter dashboard.
// Cohere North Mini: clean JSON output, lower reasoning-token overhead.
// Laguna XS: kept as an optional "deep analysis" choice, reasons heavily
// on every call (~200+ reasoning tokens even for trivial prompts), so
// it is NOT the default — too slow/risky for a serverless timeout.
export const DEFAULT_MODEL = "cohere/north-mini-code-20260617:free";
export const DEEP_MODEL = "poolside/laguna-xs-2.1-20260625:free";
export const FALLBACK_MODEL = "openrouter/free";

export interface ResearchResult {
  companyName: string;
  summary: string;
  products: string[];
  painPoints: string[];
  competitors: { name: string; website: string }[];
}

const SYSTEM_PROMPT = `You are a company research analyst.
Analyze the provided website content and search results.
Respond with ONLY valid JSON, no markdown fences, no explanation text before or after.
Required JSON shape:
{
  "companyName": string,
  "summary": string (2-3 sentences),
  "products": string[],
  "painPoints": string[] (3-5 AI-inferred business pain points),
  "competitors": [{"name": string, "website": string}] (3-5 competitors)
}`;

async function callModel(model: string, userContent: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Model ${model} responded with ${res.status}`);
    }

    const data = await res.json();

    // IMPORTANT: only ever read message.content. Reasoning models (e.g.
    // Laguna XS) attach chain-of-thought under `reasoning` /
    // `reasoning_details` — never parse those as the answer.
    const content = data?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      throw new Error(`Model ${model} returned no usable content`);
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Strip markdown fences if present, then attempt to extract the first
 * {...} block as a repair fallback if direct parsing fails.
 */
function parseModelJson(raw: string): ResearchResult {
  let cleaned = raw.trim();

  // Strip ```json ... ``` or ``` ... ``` fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");

  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    // Repair attempt: grab the first {...} block in case of stray text.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // continue to additional repair attempts
      }
    }

    const repaired = cleaned.replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(repaired);
    } catch {
      console.error("Could not parse model JSON output. Raw content:", raw);
      throw new Error("Could not parse or repair model JSON output");
    }
  }
}

/**
 * Run research analysis with automatic fallback: try the default model,
 * and if it fails or times out, retry once with the auto-router before
 * giving up entirely. This protects a live demo from a single model's
 * rate limit or outage.
 */
export async function runResearchAnalysis(
  userContent: string,
  model: string = DEFAULT_MODEL
): Promise<ResearchResult> {
  try {
    const raw = await callModel(model, userContent);
    return parseModelJson(raw);
  } catch (err) {
    console.warn(`Primary model (${model}) failed, falling back to ${FALLBACK_MODEL}`, err);
    const raw = await callModel(FALLBACK_MODEL, userContent);
    return parseModelJson(raw);
  }
}
