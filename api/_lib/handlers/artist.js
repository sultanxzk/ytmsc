// GET /api/artist?id=UC... — YouTube Music artist page via InnerTube
import { getInnertube, nodeToTrack, nodeToAlbum, toArray, handleOptions, sendJSON, setCors } from "../innertube.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);
  if (req.method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });

  const id = String(req.query?.id || "").trim();
  if (!id) return sendJSON(res, 400, { error: "Missing required query param: id" });

  try {
    const innertube = await getInnertube();
    const artist = await innertube.music.getArtist(id);
    const header = artist.header;

    const name = header?.title ? String(header.title).trim() : "";
    let cover = null;
    try {
      const pick = (arr) => {
        if (!Array.isArray(arr) || !arr.length) return null;
        let best = arr[0];
        for (const t of arr) if ((t.height || 0) > (best.height || 0)) best = t;
        return best?.url || null;
      };
      cover = pick(header?.thumbnail?.contents) || pick(header?.channelThumbnail?.contents) || pick(header?.thumbnail) || pick(header?.channelThumbnail) || null;
    } catch {}
    cover = cover || "https://picsum.photos/seed/ytm/400/400";

    let monthlyAudience = null;
    try {
      const probe = [];
      if (header?.flexible_items) for (const f of toArray(header.flexible_items)) probe.push(f?.text?.toString?.() || f?.text || f?.title?.toString?.() || "");
      if (header?.description) probe.push(header.description.toString?.() || header.description.text || "");
      if (header?.subtitle) probe.push(header.subtitle.toString?.() || header.subtitle.text || "");
      for (const t of probe) {
        if (t && /monthly/i.test(t)) {
          const m = String(t).match(/[\d.,]+[KMB]?\s*?monthly/i);
          monthlyAudience = m ? m[0].trim() : String(t).trim();
          break;
        }
      }
    } catch {}

    const topSongs = [];
    const sections = [];
    try {
      for (const shelf of toArray(artist.sections)) {
        const rawTitle = shelf?.header?.title ? String(shelf.header.title).trim() : (shelf?.title ? String(shelf.title).trim() : "");
        const contents = toArray(shelf?.contents);
        if (!contents.length) continue;
        const items = [];
        let isSongsSection = false;
        const titleLower = (rawTitle || "").toLowerCase();
        if (!rawTitle || titleLower === "songs" || titleLower === "top songs" || titleLower === "músicas" || titleLower === "músicas populares" || titleLower === "popular songs") isSongsSection = true;
        // Heuristic: first section whose items are mostly playable songs/vids is the songs section
        const probeItems = contents.slice(0, 3).map((n) => n.type === "MusicResponsiveListItem" ? n.item_type : n.type);
        if (!rawTitle && probeItems.some((t) => t === "song" || t === "video")) isSongsSection = true;

        for (const node of contents) {
          if (!node) continue;
          if (node.type === "MusicResponsiveListItem") {
            if (node.item_type === "album") {
              const a = nodeToAlbum(node);
              if (a) items.push(a);
            } else if (node.item_type === "playlist") {
              const p = (await import("../innertube.js")).nodeToPlaylist(node);
              if (p) items.push(p);
            } else {
              const t = nodeToTrack(node);
              if (t && t.videoId) items.push(t);
            }
          } else if (node.type === "MusicTwoRowItem") {
            const p = node.endpoint?.payload || {};
            const hasVideo = p.watchEndpoint?.videoId || (node.id && /^[A-Za-z0-9_-]{11}$/.test(String(node.id)));
            if (node.item_type === "album" || (!hasVideo && node.id)) {
              const a = nodeToAlbum(node);
              if (a) items.push(a);
            } else if (node.item_type === "playlist") {
              const p2 = (await import("../innertube.js")).nodeToPlaylist(node);
              if (p2) items.push(p2);
            } else if (hasVideo) {
              const t = nodeToTrack(node);
              if (t) items.push(t);
            } else if (node.id) {
              const a = nodeToAlbum(node);
              if (a) items.push(a);
            }
          } else if (node.type === "MusicMultiRowListItem") {
            const a = nodeToAlbum(node);
            if (a) items.push(a);
          } else if (node.video_id) {
            const { panelVideoToTrack } = await import("../innertube.js");
            const t = panelVideoToTrack(node);
            if (t) items.push(t);
          }
        }
        if (!items.length) continue;
        if (isSongsSection && !topSongs.length) {
          topSongs.push(...items);
          continue;
        }
        sections.push({ title: rawTitle || "Destaques", items });
      }
    } catch {}

    return sendJSON(res, 200, {
      artist: { id, name: name || "Artista desconhecido", cover, monthlyAudience },
      topSongs,
      sections,
    });
  } catch (e) {
    return sendJSON(res, 500, { error: "Artist fetch failed", details: String(e?.message || e) });
  }
}
