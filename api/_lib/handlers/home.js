// GET /api/home — YouTube Music home feed via InnerTube (MUSIC client)
import { getInnertube, nodeToTrack, handleOptions, sendJSON, setCors } from "../innertube.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);
  if (req.method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });

  try {
    const innertube = await getInnertube();
    const home = await innertube.music.getHomeFeed();

    const sections = [];
    const tracks = [];
    const albums = [];
    const seen = new Set();

    for (const shelf of home.sections || []) {
      const title = shelf.header?.title ? String(shelf.header.title).trim() : "";
      const contents = shelf.contents?.toArray?.() || shelf.contents || [];
      const items = [];
      for (const node of contents) {
        // For MusicTwoRowItem (albums) we must NOT filter by videoId — browseId alone is enough
        let mapped = null;
        if (node.type === "MusicTwoRowItem") {
          // inline mapping that keeps albums
          const t = nodeToTrack(node);
          if (!t) continue;
          if (t.videoId && (t.type === "album" || t.isAlbum)) {
            // has both — treat as album browse
            albums.push({ ...t, type: "album" });
            items.push({ ...t, type: "album" });
            continue;
          }
          if (!t.videoId && t.browseId) {
            albums.push(t);
            items.push(t);
            continue;
          }
          if (t.videoId) {
            const key = t.videoId;
            if (seen.has(key)) continue;
            seen.add(key);
            tracks.push(t);
            items.push(t);
            continue;
          }
          continue;
        }
        mapped = nodeToTrack(node);
        if (!mapped || !mapped.videoId) continue;
        const key = mapped.videoId;
        if (seen.has(key)) continue;
        seen.add(key);
        tracks.push(mapped);
        items.push(mapped);
      }
      if (items.length) {
        const t = title || sections[sections.length - 1]?.title || "Recomendados";
        sections.push({ title: t, items });
      }
    }

    if (!tracks.length && sections.length) {
      for (const s of sections) for (const it of s.items) if (it?.videoId) tracks.push(it);
    }
    const again = tracks.slice(0, 12);
    const quick = tracks.slice(4, 16).length ? tracks.slice(4, 16) : tracks.slice(0, 8);
    const trending = tracks.slice(0, 12);
    // seções com títulos oficiais (pt-BR) — ordem exata capturada do oficial
    const officialTitles = ["Clássicos da madrugada", "Bons sonhos", "De quais artistas você gosta?", "Escolha a dedo", "Playlists da comunidade em alta", "Perfeitas para o fim de semana", "Calminhas"];
    const looksOfficial = officialTitles.some((t) => t.toLowerCase() === String(sections[0]?.title || "").toLowerCase());
    const mappedSections = sections.map((s, i) => ({
      title: looksOfficial ? s.title : (officialTitles[i] || s.title),
      items: s.items,
    }));

    return sendJSON(res, 200, {
      sections: mappedSections,
      tracks,
      albums,
      again,
      quick,
      trending,
      late: tracks.slice(0, 8),
      artists: tracks.slice(8, 16),
      dreams: tracks.slice(0, 8),
      weekend: tracks.slice(0, 8),
      calm: tracks.slice(4, 12),
    });
  } catch (e) {
    return sendJSON(res, 500, { error: "Failed to fetch home feed", details: String(e?.message || e) });
  }
}
