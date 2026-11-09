// GET /api/search?q=TERMO&type=song|artist|album|playlist|all — YouTube Music search via InnerTube
import { getInnertube, nodeToTrack, nodeToArtist, nodeToAlbum, nodeToPlaylist, toArray, handleOptions, sendJSON, setCors } from "./_lib/innertube.js";

async function searchSongs(innertube, q) {
  const result = await innertube.music.search(q, { type: "song" });
  const tracks = [];
  const seen = new Set();
  const pushAll = (contents) => {
    for (const node of toArray(contents)) {
      const mapped = nodeToTrack(node);
      if (!mapped || !mapped.videoId) continue;
      if (seen.has(mapped.videoId)) continue;
      seen.add(mapped.videoId);
      tracks.push({ ...mapped, src: "" });
    }
  };
  if (result.songs?.contents) pushAll(result.songs.contents);
  if (!tracks.length && result.contents) {
    for (const shelf of toArray(result.contents)) pushAll(shelf.contents);
  }
  return tracks;
}

async function searchArtists(innertube, q) {
  const result = await innertube.music.search(q, { type: "artist" });
  const artists = [];
  const seen = new Set();
  const pushAll = (contents) => {
    for (const node of toArray(contents)) {
      if (!node) continue;
      if (node.type !== "MusicResponsiveListItem" && node.item_type !== "artist" && node.type !== "MusicTwoRowItem") continue;
      if (node.type === "MusicResponsiveListItem" && node.item_type !== "artist" && node.item_type !== "library_artist") continue;
      const mapped = nodeToArtist(node);
      if (!mapped || !mapped.id) continue;
      if (seen.has(mapped.id)) continue;
      seen.add(mapped.id);
      artists.push(mapped);
    }
  };
  if (result.artists?.contents) pushAll(result.artists.contents);
  if (!artists.length && result.contents) {
    for (const shelf of toArray(result.contents)) {
      const items = shelf.contents ?? shelf;
      pushAll(items);
    }
  }
  return artists;
}

async function searchAlbums(innertube, q) {
  const result = await innertube.music.search(q, { type: "album" });
  const albums = [];
  const seen = new Set();
  const pushAll = (contents) => {
    for (const node of toArray(contents)) {
      if (!node) continue;
      if (node.type === "MusicResponsiveListItem" && node.item_type !== "album") continue;
      const mapped = nodeToAlbum(node);
      if (!mapped || !mapped.id) continue;
      if (seen.has(mapped.id)) continue;
      seen.add(mapped.id);
      albums.push(mapped);
    }
  };
  if (result.albums?.contents) pushAll(result.albums.contents);
  if (!albums.length && result.contents) {
    for (const shelf of toArray(result.contents)) pushAll(shelf.contents);
  }
  return albums;
}

async function searchPlaylists(innertube, q) {
  const result = await innertube.music.search(q, {});
  const playlists = [];
  const seen = new Set();
  const pushAll = (contents) => {
    for (const node of toArray(contents)) {
      if (!node) continue;
      const n = node.primary || node;
      const id = n?.id || n?.endpoint?.payload?.browseId || n?.endpoint?.payload?.browseEndpoint?.browseId || "";
      const looksPlaylist = (n.type === "MusicTwoRowItem" && (n.item_type === "playlist" || String(id).startsWith("PL") || String(id).startsWith("VL")))
        || (n.type === "MusicResponsiveListItem" && n.item_type === "playlist");
      if (!looksPlaylist) continue;
      const mapped = nodeToPlaylist(n);
      if (!mapped || !mapped.id) continue;
      if (seen.has(mapped.id)) continue;
      seen.add(mapped.id);
      playlists.push(mapped);
    }
  };
  if (result.playlists?.contents) pushAll(result.playlists.contents);
  if (!playlists.length && result.contents) {
    for (const shelf of toArray(result.contents)) pushAll(shelf.contents);
  }
  return playlists;
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);
  if (req.method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });

  const q = String(req.query?.q || "").trim();
  if (!q) return sendJSON(res, 400, { error: "Missing required query param: q" });
  const type = String(req.query?.type || "song").toLowerCase();
  const valid = ["song", "artist", "album", "playlist", "all"];
  const t = valid.includes(type) ? type : "song";

  try {
    const innertube = await getInnertube();

    if (t === "song") {
      const tracks = await searchSongs(innertube, q);
      return sendJSON(res, 200, { tracks, query: q });
    }
    if (t === "artist") {
      const artists = await searchArtists(innertube, q);
      return sendJSON(res, 200, { artists, query: q });
    }
    if (t === "album") {
      const albums = await searchAlbums(innertube, q);
      return sendJSON(res, 200, { albums, query: q });
    }
    if (t === "playlist") {
      const playlists = await searchPlaylists(innertube, q);
      return sendJSON(res, 200, { playlists, query: q });
    }
    // all
    const [songs, artists, albums] = await Promise.all([
      searchSongs(innertube, q).catch(() => []),
      searchArtists(innertube, q).catch(() => []),
      searchAlbums(innertube, q).catch(() => []),
    ]);
    return sendJSON(res, 200, { tracks: songs, artists, albums, query: q });
  } catch (e) {
    return sendJSON(res, 500, { error: "Search failed", details: String(e?.message || e) });
  }
}
