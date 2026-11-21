import fs from "node:fs/promises";
import path from "node:path";

// Workspace storage. Same shape as the original Artifact database: one JSON string per key.
//  1. Upstash Redis (REST) when KV_REST_API_URL/KV_REST_API_TOKEN or
//     UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are set (Vercel Marketplace → Upstash).
//  2. A local JSON file (.data/workspace.json) when running outside Vercel (npm run dev).
//  3. Otherwise none: the browser falls back to localStorage, as the Artifact did.

export const KEYS = ["campaigns", "content", "tasks", "team", "comments", "activity", "notifs", "metrics", "integrations", "settings", "recs"];
const PREFIX = process.env.STORE_PREFIX || "ccc:ws:";

function redisConf() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function redis(cmd) {
  const { url, token } = redisConf();
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error("Database error: " + (j.error || r.status));
  return j.result;
}

const FILE = path.join(process.cwd(), ".data", "workspace.json");
async function readFile() {
  try { return JSON.parse(await fs.readFile(FILE, "utf8")); } catch { return {}; }
}

export function backend() {
  if (redisConf()) return "redis";
  if (!process.env.VERCEL) return "file";
  return null;
}

export async function getAll() {
  const b = backend();
  if (b === "redis") {
    const vals = await redis(["MGET", ...KEYS.map(k => PREFIX + k)]);
    return Object.fromEntries(KEYS.map((k, i) => [k, vals[i] ?? null]));
  }
  if (b === "file") {
    const d = await readFile();
    return Object.fromEntries(KEYS.map(k => [k, d[k] ?? null]));
  }
  throw new Error("No database configured.");
}

let fileQueue = Promise.resolve();
export async function setKey(key, json) {
  const b = backend();
  if (b === "redis") return redis(["SET", PREFIX + key, json]);
  if (b === "file") {
    // Serialize writes so concurrent saves don't clobber each other.
    fileQueue = fileQueue.then(async () => {
      const d = await readFile();
      d[key] = json;
      await fs.mkdir(path.dirname(FILE), { recursive: true });
      await fs.writeFile(FILE, JSON.stringify(d));
    });
    return fileQueue;
  }
  throw new Error("No database configured.");
}
