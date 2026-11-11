// Single serverless function para contas + sync (auth + sync).
// Formato: /api/account/auth  e  /api/account/sync
// Conta como 1 function no plano Hobby da Vercel.
import { sendJSON, setCors, handleOptions } from "./_lib/innertube.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const parts = url.pathname.replace(/^\//, "").split("/");
    let which = parts[1] || url.searchParams.get("kind") || "";
    // compat: /api/auth e /api/sync também passam por aqui via rewrites
    if (which === "auth" || which === "sync") {
      const mod = await import(`./_lib/handlers/${which}.js`);
      req.query = { ...Object.fromEntries(url.searchParams.entries()), ...(req.query || {}) };
      if (!req.body) req.body = {};
      return mod.default(req, res);
    }
    return sendJSON(res, 404, { error: "Not found", which });
  } catch (e) {
    return sendJSON(res, 500, { error: "Internal", details: String(e?.message || e) });
  }
}
