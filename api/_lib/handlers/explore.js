// GET /api/explore — YouTube Music explore via InnerTube
import { getInnertube, nodeToTrack, nodeToAlbum, nodeToPlaylist, nodeToGenre, toArray, handleOptions, sendJSON, setCors } from "../innertube.js";

function genreFromButton(node) {
  try {
    const g = nodeToGenre(node);
    if (g && (g.browseId || g.id)) return g;
    const url = node?.endpoint?.toURL?.() || "";
    if (url) {
      try {
        const u = new URL(url, "https://www.youtube.com");
        const bid = u.searchParams.get("browse") || u.searchParams.get("list") || u.pathname;
        const label = node.button_text || node.title || node.subtitle || "";
        if (label) return { id: bid || String(label), label: String(label).trim(), browseId: bid || null };
      } catch {}
    }
    return null;
  } catch { return null; }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);
  if (req.method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });

  try {
    const innertube = await getInnertube();
    const explore = await innertube.music.getExplore();

    const genres = [];
    const genreSeen = new Set();
    const pushGenre = (g) => {
      if (!g || !g.browseId) return;
      const key = g.browseId;
      if (genreSeen.has(key)) return;
      genreSeen.add(key);
      genres.push(g);
    };

    for (const btn of toArray(explore.top_buttons)) {
      const g = genreFromButton(btn);
      if (g) pushGenre(g);
    }

    const sections = [];
    for (const shelf of toArray(explore.sections)) {
      const title = shelf?.header?.title ? String(shelf.header.title).trim() : (shelf?.title ? String(shelf.title).trim() : "");
      const contents = toArray(shelf?.contents);
      if (!contents.length) continue;
      const items = [];
      for (const node of contents) {
        if (!node) continue;
        const n = node.primary || node;
        if (n.type === "MusicNavigationButton") {
          const g = genreFromButton(n);
          if (g) pushGenre(g);
          continue;
        }
        if (n.type === "MusicResponsiveListItem") {
          if (n.item_type === "album") {
            const a = nodeToAlbum(n);
            if (a) items.push(a);
          } else if (n.item_type === "playlist") {
            const a = nodeToPlaylist(n);
            if (a) items.push(a);
          } else {
            const t = nodeToTrack(n);
            if (t && t.videoId) items.push(t);
          }
        } else if (n.type === "MusicTwoRowItem") {
          const p = n.endpoint?.payload || {};
          const hasVideo = p.watchEndpoint?.videoId || (n.id && /^[A-Za-z0-9_-]{11}$/.test(String(n.id)));
          if (n.item_type === "playlist") {
            const a = nodeToPlaylist(n);
            if (a) items.push(a);
          } else if (hasVideo) {
            const t = nodeToTrack(n);
            if (t) items.push(t);
          } else if (n.id) {
            const a = nodeToAlbum(n);
            if (a) items.push(a);
          } else {
            const t = nodeToTrack(n);
            if (t) items.push(t);
          }
        } else if (n.type === "MusicMultiRowListItem") {
          const a = nodeToAlbum(n);
          if (a) items.push(a);
        } else if (n.video_id) {
          const { panelVideoToTrack } = await import("../innertube.js");
          const t = panelVideoToTrack(n);
          if (t) items.push(t);
        }
      }
      if (items.length) sections.push({ title: title || "Em alta", items });
    }

    return sendJSON(res, 200, { genres, sections });
  } catch (e) {
    return sendJSON(res, 500, { error: "Explore fetch failed", details: String(e?.message || e) });
  }
}
