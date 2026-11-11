// GET /api/upnext?id=VIDEO_ID — YouTube Music automix / up next via InnerTube
import { getInnertube, panelVideoToTrack, toArray, handleOptions, sendJSON, setCors } from "../innertube.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);
  if (req.method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });

  const id = String(req.query?.id || "").trim();
  if (!id) return sendJSON(res, 400, { error: "Missing required query param: id" });

  try {
    const innertube = await getInnertube();
    const panel = await innertube.music.getUpNext(id, true);
    const tracks = [];
    const seen = new Set();
    for (const node of toArray(panel?.contents)) {
      const wrapper = node?.primary ? node : node;
      const t = panelVideoToTrack(wrapper?.primary ? wrapper : node);
      const track = t || panelVideoToTrack(node);
      if (!track || !track.videoId) continue;
      if (seen.has(track.videoId)) continue;
      seen.add(track.videoId);
      tracks.push(track);
    }
    return sendJSON(res, 200, { tracks });
  } catch (e) {
    return sendJSON(res, 500, { error: "Up next fetch failed", details: String(e?.message || e) });
  }
}
