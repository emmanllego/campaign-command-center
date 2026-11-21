// Small helpers shared by the API routes. They work with Vercel's Node runtime
// (which pre-parses JSON bodies into req.body) and with the local Vite dev
// adapter in vite.config.js (which does the same).

export function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

export function body(req) {
  const b = req.body;
  if (b && typeof b === "object") return b;
  if (typeof b === "string" && b) {
    try { return JSON.parse(b); } catch { return {}; }
  }
  return {};
}

export function method(req, res, allowed) {
  if (allowed.includes(req.method)) return true;
  res.setHeader("Allow", allowed.join(", "));
  send(res, 405, { error: "Method not allowed" });
  return false;
}
