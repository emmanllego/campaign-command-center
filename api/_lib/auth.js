import crypto from "node:crypto";
import { send } from "./http.js";

// Workspace access control.
// - APP_PASSWORD set      -> every API call needs a signed session cookie (login with that password).
// - APP_PASSWORD unset    -> open access, but ONLY outside Vercel production. In production the
//                            database and AI routes refuse to run, so a deploy without a password
//                            can never expose your data or spend your Anthropic credits.

const COOKIE = "ccc_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

const password = () => process.env.APP_PASSWORD || "";
const secret = () => process.env.SESSION_SECRET || password();

export function authRequired() {
  return !!password();
}

export function blockedInProduction() {
  return !password() && process.env.VERCEL_ENV === "production";
}

function sign(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return "";
}

export function isAuthed(req) {
  if (!authRequired()) return !blockedInProduction();
  const v = readCookie(req, COOKIE);
  const [exp, sig] = v.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, sign(exp));
}

export function checkPassword(attempt) {
  // Hash both sides so the comparison is constant-time regardless of length.
  const h = s => crypto.createHash("sha256").update(String(s)).digest();
  return authRequired() && crypto.timingSafeEqual(h(attempt), h(password()));
}

function cookieAttrs() {
  const secure = process.env.VERCEL || process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function setSession(res) {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  res.setHeader("Set-Cookie", `${COOKIE}=${exp}.${sign(exp)}; Max-Age=${MAX_AGE}; ${cookieAttrs()}`);
}

export function clearSession(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Max-Age=0; ${cookieAttrs()}`);
}

// Returns true when the request may proceed; otherwise writes the error response.
export function guard(req, res) {
  if (blockedInProduction()) {
    send(res, 503, { error: "This deployment has no APP_PASSWORD set, so data and AI routes are disabled. Add APP_PASSWORD in Vercel → Settings → Environment Variables and redeploy." });
    return false;
  }
  if (!isAuthed(req)) {
    send(res, 401, { error: "Sign in required." });
    return false;
  }
  return true;
}
