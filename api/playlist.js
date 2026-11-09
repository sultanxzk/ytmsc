// GET /api/playlist?id=PL... (or VL...) — YouTube Music playlist via InnerTube
import { getInnertube, nodeToTrack, toArray, handleOptions, sendJSON, setCors } from "./_lib/innertube.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);
  if (req.method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });

  const id = String(req.query?.id || "").trim();
  if (!id) return sendJSON(res, 400, { error: "Missing required query param: id" });

  try {
    const innertube = await getInnertube();
    const playlist = await innertube.music.getPlaylist(id);
    const header = playlist.header;

    const title = header?.title ? String(header.title).trim() : (header?.subtitle ? String(header.subtitle).trim() : "Playlist");
    const cover = header?.thumbnail?.contents?.[0]?.url || header?.thumbnail?.contents?.[0]?.url || "https://picsum.photos/seed/ytm/400/400";
    let author = "";
    try {
      const sub = header?.subtitle?.toString?.() || header?.subtitle?.text || "";
      const parts = String(sub).split(" • ").map((s) => s.trim()).filter(Boolean);
      const yearRe = /^\d{4}$/;
      author = parts.filter((p) => p !== "Playlist" && !yearRe.test(p) && !/^\d[\d.,]* (songs|videos)$/.test(p))[0] || "";
      // A year-only subtitle (e.g. from related playlists) is not an author — leave empty
      if (author && yearRe.test(author)) author = "";
      if (!author && header?.author?.name) author = header.author.name;
    } catch {}

    const tracks = [];
    const seen = new Set();
    for (const node of toArray(playlist.contents)) {
      const wrapper = node?.primary ? node : node;
      let t = null;
      if (node?.primary || node?.video_id) {
        const { panelVideoToTrack } = await import("./_lib/innertube.js");
        t = panelVideoToTrack(wrapper?.primary ? wrapper : node);
      }
      if (!t) t = nodeToTrack(node);
      if (!t || !t.videoId) continue;
      if (seen.has(t.videoId)) continue;
      seen.add(t.videoId);
      tracks.push(t);
    }

    return sendJSON(res, 200, {
      playlist: { id, title, author: author || "YouTube Music", cover },
      tracks,
    });
  } catch (e) {
    return sendJSON(res, 500, { error: "Playlist fetch failed", details: String(e?.message || e) });
  }
}
