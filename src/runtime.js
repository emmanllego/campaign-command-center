// Standalone replacement for the Claude Artifact runtime (`claude.use(...)`).
//   claude.use("db")        -> openDb():   workspace database behind /api/store
//   claude.use("sample")    -> ai():       Claude via the server route /api/ai
//   claude.use("downloads") -> download(): a normal browser file download
// Plus sign-in (boot / signOut), which the Artifact got from claude.ai.

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function api(path, opts = {}) {
  let r;
  try {
    r = await fetch(path, { credentials: "same-origin", ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } });
  } catch {
    const e = new Error("Couldn't reach the server. Check your connection and try again.");
    e.network = true;
    throw e;
  }
  const isJson = (r.headers.get("content-type") || "").includes("application/json");
  const j = isJson ? await r.json().catch(() => ({})) : {};
  if (!r.ok || !isJson) {
    const e = new Error(j.error || (r.status === 404 || !isJson ? "This deployment has no API server." : `Request failed (${r.status}).`));
    e.status = r.status;
    e.code = j.code;
    e.noApi = r.status === 404 || !isJson;
    throw e;
  }
  return j;
}

export let session = { authRequired: false, authed: true, db: false, ai: false, blocked: false, noApi: false };

export async function boot() {
  try {
    session = await api("/api/session");
  } catch (e) {
    // Static hosting without the API (e.g. `vite preview`): run browser-only, like the Artifact outside claude.ai.
    session = { authRequired: false, authed: true, db: false, ai: false, blocked: false, noApi: true };
    return session;
  }
  if (session.authRequired && !session.authed) {
    await loginScreen();
    session = await api("/api/session");
  }
  return session;
}

function loginScreen() {
  return new Promise(resolve => {
    const bg = document.createElement("div");
    bg.className = "modalbg";
    bg.innerHTML = `<div class="modal" role="dialog" aria-label="Sign in" style="max-width:400px">
      <div class="brand" style="padding:0 0 14px;color:var(--text)"><i>↗</i><span>CAMPAIGN<br>COMMAND CENTER</span></div>
      <h2 style="margin-bottom:4px">Sign in</h2><p class="mut" style="margin:0 0 14px">Enter the workspace password.</p>
      <form id="loginf"><label>Password<input type="password" name="password" autocomplete="current-password" required autofocus></label>
      <div id="loginerr" class="neg" style="min-height:20px;margin-top:8px;font-size:13px"></div>
      <div class="row" style="justify-content:flex-end;margin-top:6px"><button class="btn y" type="submit">Sign in</button></div></form></div>`;
    document.body.appendChild(bg);
    const f = bg.querySelector("#loginf");
    f.password.focus();
    f.onsubmit = async e => {
      e.preventDefault();
      const btn = f.querySelector("button");
      btn.disabled = true;
      bg.querySelector("#loginerr").textContent = "";
      try {
        await api("/api/session", { method: "POST", body: JSON.stringify({ password: f.password.value }) });
        bg.remove();
        resolve();
      } catch (err) {
        bg.querySelector("#loginerr").innerHTML = esc(err.message);
        f.password.select();
      }
      btn.disabled = false;
    };
  });
}

export async function signOut() {
  try { await api("/api/session", { method: "DELETE" }); } catch {}
  location.reload();
}

// Mirrors the Artifact db API used by the app: db.doc("ws/<key>").get() / .set({json}).
// All keys are fetched in one request at startup; writes go straight to the server.
export async function openDb() {
  if (!session.db) return null;
  const { data } = await api("/api/store");
  const cache = data || {};
  return {
    doc(p) {
      const k = p.replace(/^ws\//, "");
      return {
        async get() {
          const v = cache[k];
          return { exists: v != null, data: () => ({ json: v }) };
        },
        async set({ json }) {
          try {
            await api("/api/store", { method: "PUT", body: JSON.stringify({ key: k, json }) });
          } catch (e) {
            if (e.status === 401) e.message = "Your session expired. Reload the page to sign in again.";
            throw e;
          }
          cache[k] = json;
        },
      };
    },
  };
}

export async function ai(prompt, format) {
  if (session.noApi) throw new Error("AI isn't available: this deployment has no API server.");
  const r = await api("/api/ai", { method: "POST", body: JSON.stringify({ prompt, format }) });
  return format === "json" ? r.json : r.text;
}

const MIME = { csv: "text/csv;charset=utf-8", json: "application/json", pdf: "application/pdf" };
export async function download(filename, data) {
  const ext = filename.split(".").pop().toLowerCase();
  const blob = data instanceof Blob ? data : new Blob([data], { type: MIME[ext] || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
