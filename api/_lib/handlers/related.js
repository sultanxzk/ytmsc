// GET /api/related?id=VIDEO_ID — YouTube Music related tracks via InnerTube
import { getInnertube, nodeToTrack, nodeToAlbum, nodeToPlaylist, panelVideoToTrack, toArray, handleOptions, sendJSON, setCors } from "../innertube.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);
  if (req.method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });

  const id = String(req.query?.id || "").trim();
  if (!id) return sendJSON(res, 400, { error: "Missing required query param: id" });

  try {
    const innertube = await getInnertube();
    const result = await innertube.music.getRelated(id);
    if (!result || result.type === "Message") return sendJSON(res, 200, { tracks: [], sections: [] });

    const tracks = [];
    const sections = [];
    const seen = new Set();

    for (const shelf of toArray(result.sections || result.contents || [])) {
      const title = shelf?.header?.title ? String(shelf.header.title).trim() : (shelf?.title ? String(shelf.title).trim() : "");
      const contents = toArray(shelf?.contents);
      if (!contents.length) continue;
      const items = [];
      for (const node of contents) {
        if (!node) continue;
        const n = node.primary || node;
        if (n.type === "MusicResponsiveListItem") {
          if (n.item_type === "album") {
            const a = nodeToAlbum(n);
            if (a) items.push(a);
          } else if (n.item_type === "playlist") {
            const a = nodeToPlaylist(n);
            if (a) items.push(a);
          } else {
            const t = nodeToTrack(n);
            if (t && t.videoId) {
              if (seen.has(t.videoId)) continue;
              seen.add(t.videoId);
              tracks.push(t);
              items.push(t);
            }
          }
        } else if (n.type === "MusicTwoRowItem") {
          const p = n.endpoint?.payload || {};
          const hasVideo = p.watchEndpoint?.videoId || (n.id && /^[A-Za-z0-9_-]{11}$/.test(String(n.id)));
          if (n.item_type === "playlist") {
            const a = nodeToPlaylist(n);
            if (a) items.push(a);
          } else if (hasVideo) {
            const t = nodeToTrack(n);
            if (t && t.videoId) {
              if (seen.has(t.videoId)) continue;
              seen.add(t.videoId);
              tracks.push(t);
              items.push(t);
            }
          } else if (n.id) {
            const a = nodeToAlbum(n);
            if (a) items.push(a);
          } else {
            const t = nodeToTrack(n);
            if (t) items.push(t);
          }
        } else if (n.video_id) {
          const t = panelVideoToTrack(n);
          if (t && t.videoId) {
            if (seen.has(t.videoId)) continue;
            seen.add(t.videoId);
            tracks.push(t);
            items.push(t);
          }
        } else if (n.type === "MusicMultiRowListItem") {
          const a = nodeToAlbum(n);
          if (a) items.push(a);
        }
      }
      if (items.length) sections.push({ title: title || "Relacionados", items });
    }

    return sendJSON(res, 200, { tracks, sections });
  } catch (e) {
    return sendJSON(res, 500, { error: "Related fetch failed", details: String(e?.message || e) });
  }
}
