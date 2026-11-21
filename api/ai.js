import Anthropic from "@anthropic-ai/sdk";
import { send, body, method } from "./_lib/http.js";
import { guard } from "./_lib/auth.js";

// POST /api/ai { prompt: string, format: "json" | "text" }
//   -> { json: object }  or  { text: string }
// Replaces the Artifact's built-in `claude.use("sample")`. The API key stays on the server.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const EFFORT = process.env.ANTHROPIC_EFFORT || "medium";
let client;

function extractJson(text) {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try { return JSON.parse(t); } catch {}
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a > -1 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error("no json");
}

export default async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  if (!guard(req, res)) return;
  if (!process.env.ANTHROPIC_API_KEY) return send(res, 501, { error: "AI isn't configured on the server. Add ANTHROPIC_API_KEY to the environment." });

  const { prompt, format } = body(req);
  if (typeof prompt !== "string" || !prompt.trim()) return send(res, 400, { error: "Missing prompt." });
  if (prompt.length > 60000) return send(res, 413, { error: "Prompt too long." });
  const wantJson = format === "json";

  client ||= new Anthropic();
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: EFFORT },
      system: wantJson
        ? "You write marketing deliverables. Respond with a single valid JSON object only: no prose, no code fences."
        : "You write marketing deliverables. Respond with the requested text only.",
      messages: [{ role: "user", content: prompt }],
    });
    const msg = await stream.finalMessage();

    if (msg.stop_reason === "refusal") return send(res, 422, { error: "Claude declined this request. Try rewording the brief." });
    const text = msg.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
    if (!text) return send(res, 502, { error: "Claude returned an empty response. Please try again." });
    if (msg.stop_reason === "max_tokens" && wantJson) return send(res, 502, { error: "The response was cut off. Try a shorter brief." });

    if (!wantJson) return send(res, 200, { text });
    try { return send(res, 200, { json: extractJson(text) }); }
    catch { return send(res, 502, { error: "Claude's response wasn't valid JSON. Please try again." }); }
  } catch (e) {
    console.error("AI route error:", e?.status, e?.message);
    if (e instanceof Anthropic.AuthenticationError) return send(res, 500, { error: "The server's Anthropic API key was rejected." });
    if (e instanceof Anthropic.RateLimitError) return send(res, 429, { error: "AI is rate limited right now. Try again in a minute." });
    if (e instanceof Anthropic.BadRequestError) return send(res, 400, { error: "AI request was rejected: " + e.message });
    if (e instanceof Anthropic.APIError) return send(res, 502, { error: `AI service error (${e.status ?? "network"}). Please try again.` });
    return send(res, 500, { error: "Something went wrong. Please try again." });
  }
}
