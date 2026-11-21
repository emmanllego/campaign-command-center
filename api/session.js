import { send, body, method } from "./_lib/http.js";
import { authRequired, blockedInProduction, isAuthed, checkPassword, setSession, clearSession } from "./_lib/auth.js";
import { backend } from "./_lib/store.js";

// GET    /api/session  -> what this deployment offers and whether you're signed in
// POST   /api/session  -> { password } sign in
// DELETE /api/session  -> sign out

const attempts = new Map(); // best-effort brute-force brake (per warm instance)

export default async function handler(req, res) {
  if (!method(req, res, ["GET", "POST", "DELETE"])) return;

  if (req.method === "GET") {
    const authed = isAuthed(req);
    return send(res, 200, {
      authRequired: authRequired(),
      blocked: blockedInProduction(),
      authed,
      db: !!backend() && authed,
      ai: !!process.env.ANTHROPIC_API_KEY && authed,
    });
  }

  if (req.method === "DELETE") {
    clearSession(res);
    return send(res, 200, { ok: true });
  }

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
  const now = Date.now();
  const a = attempts.get(ip) || { n: 0, t: now };
  if (now - a.t > 15 * 60 * 1000) { a.n = 0; a.t = now; }
  if (a.n >= 10) return send(res, 429, { error: "Too many attempts. Try again in 15 minutes." });

  const { password } = body(req);
  if (!authRequired()) return send(res, 400, { error: "This deployment has no password configured." });
  if (typeof password !== "string" || !checkPassword(password)) {
    a.n++; attempts.set(ip, a);
    await new Promise(r => setTimeout(r, 400));
    return send(res, 401, { error: "Wrong password." });
  }
  attempts.delete(ip);
  setSession(res);
  return send(res, 200, { ok: true });
}
