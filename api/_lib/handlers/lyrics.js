// GET /api/lyrics?id=VIDEO_ID — YouTube Music lyrics via InnerTube, fallback lrclib.net
import { getInnertube, handleOptions, sendJSON, setCors } from "../innertube.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);
  if (req.method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });

  const id = String(req.query?.id || "").trim();
  if (!id) return sendJSON(res, 400, { error: "Missing required query param: id" });

  // 1) Try InnerTube getLyrics
  try {
    const innertube = await getInnertube();
    const lyricsShelf = await innertube.music.getLyrics(id);
    const text = lyricsShelf?.description?.toString?.()?.trim() || "";
    if (text && text.length > 10) {
      return sendJSON(res, 200, { lyrics: text, source: "youtube" });
    }
  } catch {}

  // 2) Fallback: lrclib.net via video info (title + artist)
  try {
    const innertube = await getInnertube();
    const info = await innertube.getBasicInfo(id);
    const title = info?.basic_info?.title || "";
    const artist = info?.basic_info?.author || "";
    if (title && artist) {
      const url = `https://lrclib.net/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
      const r = await fetch(url, { headers: { accept: "application/json" } });
      if (r.ok) {
        const json = await r.json();
        const hit = Array.isArray(json) ? json.find((x) => x?.plainLyrics) : json;
        const lyrics = hit?.plainLyrics || hit?.syncedLyrics || "";
        if (lyrics) return sendJSON(res, 200, { lyrics, source: "lrclib" });
      }
    }
  } catch {}

  return sendJSON(res, 404, { lyrics: "", source: "none", error: "Lyrics not found" });
}
