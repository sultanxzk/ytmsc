// GET /api/resolve?id=VIDEO_ID[&title=&artist=] — tenta conseguir um vídeo tocável
// quando o videoId original falha com 100/2/101/150 no IFrame Player.
// Estratégia: 1) o próprio ID via upnext (se responder, está vivo); 2) busca por
// "título + artista" no InnerTube e retorna a primeira música tocável found.
import { getInnertube, nodeToTrack, toArray, panelVideoToTrack, handleOptions, sendJSON, setCors } from "../innertube.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);
  if (req.method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });

  const id = String(req.query?.id || "").trim();
  const title = String(req.query?.title || "").trim();
  const artist = String(req.query?.artist || "").trim();
  if (!id && !title) return sendJSON(res, 400, { error: "Missing id or title" });

  try {
    const innertube = await getInnertube();

    // 1) Se há ID, tenta o upnext dele — se vier com tracks, o ID está vivo/tocável
    if (id) {
      try {
        const panel = await innertube.music.getUpNext(id, true);
        const tracks = [];
        const seen = new Set();
        for (const node of toArray(panel?.contents)) {
          const wrapper = node?.primary ? node : node;
          const t = panelVideoToTrack(wrapper?.primary ? wrapper : node) || panelVideoToTrack(node);
          if (!t || !t.videoId || seen.has(t.videoId)) continue;
          seen.add(t.videoId);
          tracks.push(t);
          if (tracks.length >= 12) break;
        }
        if (tracks.length) {
          return sendJSON(res, 200, { ok: true, videoId: id, tracks, via: "upnext" });
        }
      } catch {}
    }

    // 2) Fallback por busca título+artista
    const q = `${title} ${artist}`.trim();
    if (!q) return sendJSON(res, 200, { ok: false, reason: "no query" });

    const search = await innertube.music.search(q, { type: "song" }).catch(() => null);
    const tracks = [];
    const seen = new Set();
    for (const node of toArray(search?.contents || search?.items || [])) {
      const n = node?.primary || node;
      if (n?.type === "MusicResponsiveListItem") {
        const t = nodeToTrack(n);
        if (!t || !t.videoId || seen.has(t.videoId)) continue;
        seen.add(t.videoId);
        tracks.push(t);
        if (tracks.length >= 12) break;
      }
    }

    if (!tracks.length && search?.results) {
      for (const node of toArray(search.results)) {
        const t = nodeToTrack(node);
        if (!t || !t.videoId || seen.has(t.videoId)) continue;
        seen.add(t.videoId);
        tracks.push(t);
        if (tracks.length >= 12) break;
      }
    }

    return sendJSON(res, 200, { ok: tracks.length > 0, videoId: tracks[0]?.videoId || null, tracks, via: "search" });
  } catch (e) {
    return sendJSON(res, 500, { error: "Resolve failed", details: String(e?.message || e) });
  }
}
