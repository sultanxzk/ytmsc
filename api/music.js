// Single serverless function para todas as rotas de música (Innertube/Invidious).
// Formato: /api/music/:route → dispatch para ./_lib/handlers/<route>.js
// Necessário para respeitar o limite de 12 functions no plano Hobby da Vercel.
import { sendJSON, setCors, handleOptions } from "./_lib/innertube.js";

const ROUTES = [
  "home", "search", "lyrics", "album", "artist", "upnext", "related",
  "playlist", "suggestions", "explore", "resolve", "stream",
];

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const parts = url.pathname.replace(/^\//, "").split("/");
    // /api/music/<route>  ou  /api/music?route=<route>
    // parts = ["api", "music", "stream"] → índice 2
    let route = parts[2] || url.searchParams.get("route") || "";
    route = route.replace(/\.js$/, "");
    if (!ROUTES.includes(route)) {
      return sendJSON(res, 404, { error: "Not found", route, debug: parts });
    }
    const mod = await import(`./_lib/handlers/${route}.js`);
    // handlers migrados esperam req.query e req.body — normaliza
    req.query = { ...Object.fromEntries(url.searchParams.entries()), ...(req.query || {}) };
    if (!req.body) req.body = {};
    return mod.default(req, res);
  } catch (e) {
    return sendJSON(res, 500, { error: "Internal", details: String(e?.message || e) });
  }
}
