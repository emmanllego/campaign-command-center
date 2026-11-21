import Anthropic from "@anthropic-ai/sdk";
import { send, body, method } from "./_lib/http.js";
import { guard } from "./_lib/auth.js";

// POST /api/ai { prompt: string, format: "json" | "text" }
//   -> { json: object }  or  { text: string }
// Replaces the Artifact's built-in `claude.use("sample")`. API keys stay on the server.
//
// Provider: AI_PROVIDER ("anthropic" | "openai") if set; otherwise whichever key exists,
// Anthropic first. Errors are returned as { error } with a message the UI shows as-is.

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const ANTHROPIC_EFFORT = process.env.ANTHROPIC_EFFORT || "medium";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-6-astra";
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");

const SYSTEM_JSON = "You write marketing deliverables. Respond with a single valid JSON object only: no prose, no code fences.";
const SYSTEM_TEXT = "You write marketing deliverables. Respond with the requested text only.";

export function aiProvider() {
  const want = (process.env.AI_PROVIDER || "").toLowerCase();
  if (want === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (want === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

class AIError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function extractJson(text) {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try { return JSON.parse(t); } catch {}
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a > -1 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error("no json");
}

let anthropic;
async function callAnthropic(prompt, wantJson) {
  anthropic ||= new Anthropic();
  try {
    const stream = anthropic.beta.messages.stream({
      model: ANTHROPIC_MODEL,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: ANTHROPIC_EFFORT },
      system: wantJson ? SYSTEM_JSON : SYSTEM_TEXT,
      messages: [{ role: "user", content: prompt }],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new AIError(422, "Claude declined this request. Try rewording the brief.");
    const text = msg.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
    if (!text) throw new AIError(502, "Claude returned an empty response. Please try again.");
    if (msg.stop_reason === "max_tokens" && wantJson) throw new AIError(502, "The response was cut off. Try a shorter brief.");
    return text;
  } catch (e) {
    if (e instanceof AIError) throw e;
    console.error("Anthropic error:", e?.status, e?.message);
    if (e instanceof Anthropic.AuthenticationError) throw new AIError(500, "The server's Anthropic API key was rejected.");
    if (e instanceof Anthropic.RateLimitError) throw new AIError(429, "AI is rate limited right now. Try again in a minute.");
    if (e instanceof Anthropic.BadRequestError) throw new AIError(400, "AI request was rejected: " + e.message);
    if (e instanceof Anthropic.APIError) throw new AIError(502, `AI service error (${e.status ?? "network"}). Please try again.`);
    throw new AIError(500, "Something went wrong. Please try again.");
  }
}

// OpenAI Responses API (POST /v1/responses), called with fetch so no extra dependency is needed.
async function callOpenAI(prompt, wantJson) {
  let r;
  try {
    r = await fetch(`${OPENAI_BASE_URL}/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          { role: "system", content: wantJson ? SYSTEM_JSON : SYSTEM_TEXT },
          { role: "user", content: prompt },
        ],
        max_output_tokens: 32000,
        ...(wantJson ? { text: { format: { type: "json_object" } } } : {}),
      }),
      signal: AbortSignal.timeout(280000),
    });
  } catch (e) {
    console.error("OpenAI network error:", e?.message);
    throw new AIError(502, "Couldn't reach the AI service. Please try again.");
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const detail = j?.error?.message || "";
    console.error("OpenAI error:", r.status, detail);
    if (r.status === 401) throw new AIError(500, "The server's OpenAI API key was rejected.");
    if (r.status === 429) throw new AIError(429, "AI is rate limited or out of credit right now. Try again later.");
    if (r.status === 400 || r.status === 404) throw new AIError(400, "AI request was rejected: " + (detail || r.status));
    throw new AIError(502, `AI service error (${r.status}). Please try again.`);
  }
  const parts = (j.output || []).filter(o => o.type === "message").flatMap(o => o.content || []);
  if (parts.some(p => p.type === "refusal")) throw new AIError(422, "The AI declined this request. Try rewording the brief.");
  const text = (typeof j.output_text === "string" ? j.output_text : parts.filter(p => p.type === "output_text").map(p => p.text).join("")).trim();
  if (j.status === "incomplete" && wantJson) throw new AIError(502, "The response was cut off. Try a shorter brief.");
  if (!text) throw new AIError(502, "The AI returned an empty response. Please try again.");
  return text;
}

export default async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  if (!guard(req, res)) return;
  const provider = aiProvider();
  if (!provider) return send(res, 501, { error: "AI isn't configured on the server. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to the environment." });

  const { prompt, format } = body(req);
  if (typeof prompt !== "string" || !prompt.trim()) return send(res, 400, { error: "Missing prompt." });
  if (prompt.length > 60000) return send(res, 413, { error: "Prompt too long." });
  const wantJson = format === "json";

  try {
    const text = provider === "openai" ? await callOpenAI(prompt, wantJson) : await callAnthropic(prompt, wantJson);
    if (!wantJson) return send(res, 200, { text });
    try { return send(res, 200, { json: extractJson(text) }); }
    catch { return send(res, 502, { error: "The AI's response wasn't valid JSON. Please try again." }); }
  } catch (e) {
    if (e instanceof AIError) return send(res, e.status, { error: e.message });
    console.error("AI route error:", e);
    return send(res, 500, { error: "Something went wrong. Please try again." });
  }
}
