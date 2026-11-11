// GET /api/album?id=BROWSE_ID — get tracks of a YouTube Music album/playlist
import { getInnertube, nodeToTrack, toArray, handleOptions, sendJSON, setCors } from "../innertube.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);
  if (req.method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });

  const id = String(req.query?.id || "").trim();
  if (!id) return sendJSON(res, 400, { error: "Missing required query param: id" });

  try {
    const innertube = await getInnertube();
    const album = await innertube.music.getAlbum(id);
    const header = album.header;

    const title = header?.title ? String(header.title).trim() : "Álbum";
    const cover = header?.thumbnail?.contents?.[0]?.url || header?.thumbnail?.[0]?.url || album?.thumbnail?.[0]?.url || "https://picsum.photos/seed/ytm/400/400";
    let artist = "";
    let year = null;
    try {
      const subtitle = header?.subtitle?.toString?.() || header?.subtitle?.text || "";
      const parts = String(subtitle).split(" • ").map((s) => s.trim()).filter(Boolean);
      const typeParts = ["Album", "EP", "Single"];
      const filtered = parts.filter((p) => !typeParts.includes(p));
      for (const p of filtered) {
        if (/^\d{4}$/.test(p)) { year = parseInt(p, 10); continue; }
        if (!artist && p && p !== title && !/^BY /.test(p)) artist = p;
      }
      if (!artist) artist = parts[0] && !/^\d{4}$/.test(parts[0]) && !typeParts.includes(parts[0]) ? parts[0] : "";
    } catch {}
    try {
      const desc = header?.description?.description?.toString?.() || header?.description?.toString?.() || "";
      const m = String(desc).match(/\b(19|20)\d{2}\b/);
      if (!year && m) year = parseInt(m[0], 10);
    } catch {}
    if (!artist) artist = header?.authors?.[0]?.name || header?.artists?.[0]?.name || "";

    const tracks = [];
    const seen = new Set();
    for (const node of toArray(album.contents)) {
      const mapped = nodeToTrack(node);
      if (!mapped || !mapped.videoId) continue;
      if (seen.has(mapped.videoId)) continue;
      seen.add(mapped.videoId);
      tracks.push({ ...mapped, album: mapped.album || title, durationSec: mapped.durationSec || 0, artist: mapped.artist || artist });
    }

    return sendJSON(res, 200, {
      tracks,
      album: {
        id,
        title,
        artist: artist || "Artista desconhecido",
        cover,
        year,
      },
    });
  } catch (e) {
    return sendJSON(res, 500, { error: "Album fetch failed", details: String(e?.message || e) });
  }
}
