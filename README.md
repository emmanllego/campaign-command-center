# Campaign Command Center

A standalone web app for planning, running and measuring marketing campaigns: dashboard, campaigns with an approval workflow, AI Campaign Builder, content calendar (drag-to-reschedule), AI Content Studio, analytics with CSV import, reports with CSV/PDF export, team and roles, integrations, and settings.

It was converted from a Claude Artifact. The interface and all features are carried over unchanged; only the parts that depended on the Claude runtime were replaced (see **What changed from the Artifact**).

## Stack

| Part | Choice |
| --- | --- |
| Frontend | Vite 8, vanilla JavaScript (the Artifact's own architecture, kept as-is), Chart.js 4.4.1, jsPDF 2.5.1 |
| Backend | Vercel serverless functions in `api/` (Node) |
| AI | Anthropic API through `@anthropic-ai/sdk`, server-side only (`api/ai.js`) |
| Database | Upstash Redis via its REST API (one JSON value per workspace key, same shape the Artifact used) |
| Access | Shared workspace password, then a signed HttpOnly session cookie |

**Why not React?** The Artifact is about 700 lines of vanilla JS that renders HTML strings. Rewriting it in React would mean re-implementing every view, with a real risk of changing behaviour, and it would gain nothing for users. Keeping the original code inside a Vite build gives a production bundle with npm-managed dependencies while preserving the Artifact exactly.

## Project structure

```
index.html              App shell (same markup as the Artifact)
src/main.js             The Artifact's app code (views, state, business logic)
src/runtime.js          Replaces claude.use("db" | "sample" | "downloads") and adds sign-in
src/styles.css          The Artifact's styles
public/favicon.svg
api/session.js          GET status · POST sign in · DELETE sign out
api/store.js            GET all workspace keys · PUT one key
api/ai.js               POST prompt → Claude (JSON or text)
api/_lib/               Shared helpers: auth, storage, http (not deployed as routes)
scripts/import-workspace.mjs   Imports a JSON export from the original Artifact
vite.config.js          Build config, plus a dev middleware that serves api/ locally
vercel.json             Function timeouts and security headers
.env.example            Every environment variable, documented
```

## Run locally

Requires Node.js 20 or newer (`node -v` to check; install from https://nodejs.org).

```bash
npm install
```

```bash
cp .env.example .env.local
```

Edit `.env.local`: set `APP_PASSWORD`, and `ANTHROPIC_API_KEY` if you want the AI features. Leave the database variables empty to use a local file store (`.data/workspace.json`).

```bash
npm run dev
```

Open http://localhost:5173. `npm run dev` serves the frontend and the `api/` routes together, so sign-in, the database and AI all work locally. On first load the workspace is filled with clearly labelled demo data; use **Clear demo data & start fresh** in the yellow banner to remove it.

Production build check:

```bash
npm run build
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_PASSWORD` | **Yes in production** | Workspace password. Without it, a Vercel production deployment refuses all data and AI requests, so an unprotected deploy can't leak data or spend your credits. |
| `SESSION_SECRET` | Recommended | Signs session cookies. Defaults to `APP_PASSWORD`; generate one with `openssl rand -base64 32`. Changing it signs everyone out. |
| `ANTHROPIC_API_KEY` | For AI features | Get one at https://platform.claude.com → API keys. Stays on the server. |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-opus-5-5`. |
| `ANTHROPIC_EFFORT` | No | `low` / `medium` (default) / `high`. Higher is slower, more thorough and costs more. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | For shared storage | Upstash Redis REST credentials. Added automatically when you connect Upstash from Vercel. `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` also work. |
| `STORE_PREFIX` | No | Redis key prefix (default `ccc:ws:`), so several deployments can share one database. |

Never commit `.env.local`; `.gitignore` already excludes it.

## Push to GitHub

1. Create an empty repository on https://github.com/new (no README, no .gitignore).
2. In this folder:

```bash
git init -b main
```

```bash
git add -A
```

```bash
git commit -m "Campaign Command Center: standalone app"
```

```bash
git remote add origin https://github.com/YOUR-USER/campaign-command-center.git
```

```bash
git push -u origin main
```

Run `git status` before committing and check that no `.env*` file (other than `.env.example`), `.data/` or `node_modules/` is listed.

## Deploy to Vercel

1. Go to https://vercel.com/new and import the GitHub repository. Vercel detects Vite from `vercel.json`; keep the defaults (build `npm run build`, output `dist`).
2. **Add the database:** Project → **Storage** → **Create** → **Upstash for Redis** (free tier is enough) → connect it to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
3. **Add the variables:** Project → **Settings** → **Environment Variables**: `APP_PASSWORD`, `SESSION_SECRET` and `ANTHROPIC_API_KEY` (Production, plus Preview if you use preview deploys).
4. **Deploy** (or redeploy after adding variables; changes apply only to new deployments).
5. **Verify:**
   - Open the URL. You should get the sign-in screen; sign in with `APP_PASSWORD`.
   - The sidebar should read **● Saved to workspace database**. If it reads "Saved in this browser only", the Redis variables are missing.
   - Create a campaign, reload in another browser and sign in. The campaign should still be there.
   - In AI Content Studio, generate something. An error naming `ANTHROPIC_API_KEY` means the key isn't set.
   - `https://YOUR-APP.vercel.app/api/session` should return JSON with `"authRequired": true`.

AI requests can take a minute or more; `vercel.json` allows up to 300 seconds for `api/ai.js`. Vercel plans with a lower function limit cap it at their maximum.

### Bring over data from the original Artifact

In the Artifact, open **Settings → Export all data (JSON)**. Then:

```bash
APP_PASSWORD='your-password' node scripts/import-workspace.mjs campaign-command-center-export.json https://YOUR-APP.vercel.app
```

This replaces the deployed workspace's data with the export.

## What changed from the Artifact

| Artifact (Claude runtime) | Standalone app |
| --- | --- |
| `claude.use("db")`: shared workspace storage | `api/store.js` → Upstash Redis (or `.data/` file locally). Same keys and JSON. Falls back to browser `localStorage` when no database is configured, as the Artifact did. |
| `claude.use("sample")`: Claude on the viewer's account | `api/ai.js` → Anthropic API with your key, model `claude-opus-5-5`, server-side refusal fallback enabled. JSON responses are requested by instruction and parsed on the server. |
| `claude.use("downloads")`: Claude's save dialog | A normal browser download (CSV, PDF, JSON). |
| claude.ai sharing and access control | A workspace password plus a signed HttpOnly cookie (14 days), with a basic brute-force delay. |
| Chart.js / jsPDF from a CDN | The same versions installed from npm and bundled. |

Small additions and fixes:

- **Sign-in screen** and a **Sign out** button in the sidebar (shown only when a password is set).
- **Calendar on phones:** in the Artifact, long post titles stretched the columns so Wed–Sat were cut off below about 860px. Columns are now fixed to equal widths (`repeat(7, minmax(0,1fr))`).
- **Copy:** a few help texts that mentioned "this preview has no server", a "setup guide" or a Supabase schema (none of which exist here) now describe the actual setup.

## Known limits (same as the Artifact unless noted)

- **One shared login, not per-user accounts.** Roles (Admin / Manager / Editor / Viewer) are a preview chosen in "Viewing as" and are enforced in the interface only. Anyone with the password can act as any role. Server-enforced roles need real per-user auth (for example Supabase Auth or Clerk), with the role checked in `api/store.js`.
- **Last write wins.** Each workspace key is saved as a whole. If two people edit the same area at the same moment, the later save wins, and others see changes after reloading. This is the same model the Artifact used.
- **Ad-platform integrations are not live.** Meta, Google, TikTok and the other connectors have demo toggles only, and the webhook URL is stored but never called, as in the Artifact. A live connector needs an OAuth app with each provider and a server route that stores tokens and pulls metrics into `metrics`. Until then, use **Analytics → Import CSV**.
- **Storage size:** each key is limited to about 4 MB (Vercel's request limit). The free Upstash tier is fine for thousands of metric rows.
- **AI cost:** AI calls are billed to your Anthropic account. Lower `ANTHROPIC_EFFORT` to `low` to cut cost and latency.
