#!/usr/bin/env node
// Import a workspace exported from the original Claude Artifact (Settings → "Export all data (JSON)")
// into a running Campaign Command Center deployment.
//
//   APP_PASSWORD=yourpassword node scripts/import-workspace.mjs export.json https://your-app.vercel.app
//
// The URL defaults to http://localhost:5173. Existing data for each key in the file is replaced.

import fs from "node:fs/promises";

const KEYS = ["campaigns", "content", "tasks", "team", "comments", "activity", "notifs", "metrics", "integrations", "settings", "recs"];
const [file, url = "http://localhost:5173"] = process.argv.slice(2);
if (!file) {
  console.error("Usage: APP_PASSWORD=... node scripts/import-workspace.mjs <export.json> [app-url]");
  process.exit(1);
}

const data = JSON.parse(await fs.readFile(file, "utf8"));
const base = url.replace(/\/$/, "");
let cookie = "";

const session = await (await fetch(base + "/api/session")).json();
if (session.authRequired) {
  if (!process.env.APP_PASSWORD) { console.error("This deployment needs a password: set APP_PASSWORD in your shell."); process.exit(1); }
  const r = await fetch(base + "/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: process.env.APP_PASSWORD }) });
  if (!r.ok) { console.error("Sign-in failed:", (await r.json().catch(() => ({}))).error || r.status); process.exit(1); }
  cookie = (r.headers.get("set-cookie") || "").split(";")[0];
}

let n = 0;
for (const key of KEYS) {
  if (!(key in data)) continue;
  const r = await fetch(base + "/api/store", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ key, json: JSON.stringify(data[key]) }),
  });
  if (!r.ok) { console.error(`Failed on "${key}":`, (await r.json().catch(() => ({}))).error || r.status); process.exit(1); }
  console.log(`✓ ${key}`);
  n++;
}
console.log(`Imported ${n} keys. Reload the app to see them.`);
