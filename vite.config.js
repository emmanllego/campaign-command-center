import { defineConfig, loadEnv } from "vite";

// In production, Vercel serves /api/*.js as serverless functions.
// In `npm run dev`, this plugin mounts the same handlers on the Vite dev server,
// so the full app (database + AI + sign-in) works locally with one command.
function devApi() {
  return {
    name: "dev-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const m = req.url.match(/^\/api\/([a-z-]+)(?:\?|$)/);
        if (!m) return next();
        try {
          const chunks = [];
          for await (const c of req) chunks.push(c);
          const raw = Buffer.concat(chunks).toString("utf8");
          try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = raw; }
          const mod = await server.ssrLoadModule(`/api/${m[1]}.js`);
          await mod.default(req, res);
        } catch (e) {
          if (/Failed to load url|does not exist/i.test(String(e?.message))) { res.statusCode = 404; return res.end('{"error":"Not found"}'); }
          console.error(e);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Dev server error" }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Expose .env / .env.local values to the API handlers (server side only).
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    plugins: [devApi()],
    build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 900 },
  };
});
