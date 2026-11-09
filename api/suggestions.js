// GET /api/suggestions?q=... — YouTube Music search suggestions via InnerTube
import { getInnertube, toArray, handleOptions, sendJSON, setCors } from "./_lib/innertube.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);
  if (req.method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });

  const q = String(req.query?.q || "").trim();
  if (!q) return sendJSON(res, 400, { error: "Missing required query param: q" });

  try {
    const innertube = await getInnertube();
    const result = await innertube.music.getSearchSuggestions(q);
    const suggestions = [];
    const seen = new Set();
    const push = (raw) => {
      const s = String(raw || "").trim();
      if (!s || s.toLowerCase() === q.toLowerCase()) return;
      if (seen.has(s.toLowerCase())) return;
      seen.add(s.toLowerCase());
      suggestions.push(s);
    };
    for (const section of toArray(result)) {
      const shelves = section?.suggestions || section?.contents || [];
      for (const item of toArray(shelves)) {
        push(item?.suggestion?.toString?.() || item?.suggestion?.text || item?.suggestion || item?.text?.toString?.() || item?.text || "");
      }
      if (suggestions.length >= 10) break;
    }
    return sendJSON(res, 200, { suggestions: suggestions.slice(0, 10) });
  } catch (e) {
    return sendJSON(res, 500, { error: "Suggestions fetch failed", details: String(e?.message || e) });
  }
}
