import { send, body, method } from "./_lib/http.js";
import { guard } from "./_lib/auth.js";
import { KEYS, backend, getAll, setKey } from "./_lib/store.js";

// GET /api/store              -> { data: { campaigns: "<json>" | null, ... } }
// PUT /api/store {key, json}  -> saves one workspace key (json is the serialized value)

const MAX = 4 * 1024 * 1024; // stays under Vercel's 4.5 MB request body limit

export default async function handler(req, res) {
  if (!method(req, res, ["GET", "PUT"])) return;
  if (!guard(req, res)) return;
  if (!backend()) return send(res, 501, { error: "No database configured on the server." });

  try {
    if (req.method === "GET") return send(res, 200, { data: await getAll() });

    const { key, json } = body(req);
    if (!KEYS.includes(key)) return send(res, 400, { error: "Unknown key." });
    if (typeof json !== "string") return send(res, 400, { error: "json must be a string." });
    if (json.length > MAX) return send(res, 413, { error: "Data too large.", code: "quota_exceeded" });
    try { JSON.parse(json); } catch { return send(res, 400, { error: "json is not valid JSON." }); }
    await setKey(key, json);
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return send(res, 502, { error: "Storage unavailable. Please try again." });
  }
}
