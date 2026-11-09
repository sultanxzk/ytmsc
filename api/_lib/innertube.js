// Shared Innertube helper — cached across serverless invocations in this process.
import { Innertube } from "youtubei.js";

// Vercel serverless: /var/task é read-only, então NÃO usar UniversalCache (tenta
// mkdir em node_modules/.cache e quebra com ENOENT). Cache do cliente em memória basta.
export class MemoryCache {
  constructor() { this.m = new Map(); }
  async get(k) { return this.m.get(k) ?? null; }
  async set(k, v) { this.m.set(k, v); }
  async remove(k) { this.m.delete(k); }
  async clear() { this.m.clear(); }
  async getAll() { return Object.fromEntries(this.m.entries()); }
  async has(k) { return this.m.has(k); }
}

let _client = null;
let _promise = null;

// Silencia o warning TextBadge not found! — o parser JIT gera a classe na hora,
// mas a function não deve falhar por isso.
const _origWarn = console.warn;
let _warnPatched = false;
function patchParserWarn() {
  if (_warnPatched) return;
  _warnPatched = true;
  console.warn = (...args) => {
    const msg = String(args[0] || "");
    if (msg.includes("TextBadge not found") || msg.includes("[YOUTUBEJS][Parser]")) return;
    _origWarn(...args);
  };
}

export async function getInnertube() {
  if (_client) return _client;
  if (_promise) return _promise;
  patchParserWarn();
  _promise = Innertube.create({
    client_type: "WEB_REMIX",
    cache: new MemoryCache(),
    retrieve_player: false,
  })
    .then((c) => ((_client = c), c))
    .catch((e) => {
      _promise = null;
      throw e;
    });
  return _promise;
}

const FALLBACK_COVER = "https://picsum.photos/seed/ytm/400/400";
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function pickThumb(thumbs) {
  if (!Array.isArray(thumbs) || !thumbs.length) return null;
  let best = thumbs[0];
  for (const t of thumbs) {
    if ((t.height || 0) > (best.height || 0)) best = t;
  }
  return best?.url || null;
}

function parseDuration(text, seconds) {
  const secs = Number(seconds);
  if (isFinite(secs) && secs > 0) {
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return { durationSec: secs, duration: `${m}:${String(s).padStart(2, "0")}` };
  }
  if (!text) return { durationSec: 0, duration: "0:00" };
  const parts = String(text).split(":").map(Number);
  let sec = 0;
  if (parts.every((n) => !isNaN(n))) {
    if (parts.length === 2) sec = parts[0] * 60 + parts[1];
    else if (parts.length === 3) sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else sec = parts[0] || 0;
  }
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return { durationSec: sec, duration: `${m}:${String(s).padStart(2, "0")}` };
}

// Extract a best-effort duration from flex columns (songs: "Artist • Album • 2:01" or dedicated fixed column)
function extractDurationFromColumns(node) {
  // fixed columns often hold duration
  const fixedTexts = (node.fixed_columns || []).map((c) => c.title?.toString?.() || c.text || "").filter(Boolean);
  for (const t of fixedTexts) {
    if (/^\d+(:[0-5]\d)+$/.test(t)) return t;
  }
  // flex column 1 may contain " • 2:01" suffix
  const col1 = node.flex_columns?.[1]?.title?.toString?.() || "";
  const m = col1.match(/(\d+:\d{2})\s*$/);
  if (m) return m[1];
  // node.duration (parsed)
  if (node.duration) return node.duration.text;
  return "";
}

function hiResCover(node, videoId) {
  // Prefer maxres thumbnail for songs when we have a videoId (higher resolution than the tiny artist avatar)
  const parsed = pickThumb(node.thumbnails);
  if (videoId && VIDEO_ID_RE.test(videoId)) {
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }
  return parsed || FALLBACK_COVER;
}

// Returns null unless node is a *playable* song/video (item_type song|video|non_music_track) with a valid videoId.
export function nodeToTrack(node) {
  if (!node) return null;

  if (node.type === "MusicResponsiveListItem") {
    // Only playable items — skip artist/album/playlist/browse-only rows
    const allowed = ["song", "video", "non_music_track"];
    const t = node.item_type;
    // When item_type is known and not in allowed -> not playable
    if (t && !allowed.includes(t)) return null;
    // When item_type undefined, only accept if title present and id looks like a videoId
    let videoId = null;
    const ep = node.endpoint;
    if (ep?.payload?.watchEndpoint?.videoId) videoId = ep.payload.watchEndpoint.videoId;
    if (!videoId && node.id && VIDEO_ID_RE.test(String(node.id))) videoId = String(node.id);
    // endpoint watch payload may be nested as payload.videoId (some browse contexts)
    if (!videoId && ep?.payload?.videoId && VIDEO_ID_RE.test(String(ep.payload.videoId))) videoId = String(ep.payload.videoId);
    if (!videoId) return null;
    if (t && !allowed.includes(t)) return null;

    const title = node.title || node.flex_columns?.[0]?.title?.toString?.() || "Sem título";
    const artist =
      (node.artists?.length ? node.artists.map((a) => a.name).filter(Boolean).join(", ") : "") ||
      node.authors?.[0]?.name ||
      // flex_columns[1] holds "Artist • Album • Duration" for song searches
      (() => {
        const col1 = node.flex_columns?.[1]?.title?.toString?.() || "";
        const parts = col1.split(" • ").map((s) => s.trim()).filter(Boolean);
        return parts[0] || "Artista desconhecido";
      })();

    const albumName =
      node.album?.name ||
      (() => {
        const col1 = node.flex_columns?.[1]?.title?.toString?.() || "";
        const parts = col1.split(" • ").map((s) => s.trim()).filter(Boolean);
        // parts: [Artist, Album, Duration] or [Artist, Duration]
        if (parts.length >= 2 && !/^\d+:\d{2}$/.test(parts[1])) return parts[1];
        return "YouTube Music";
      })();

    const durText = extractDurationFromColumns(node) || node.duration?.text || "";
    const { durationSec, duration } = parseDuration(durText, node.duration?.seconds || 0);
    const cover = hiResCover(node, videoId);

    return {
      id: videoId,
      videoId,
      source: "youtube",
      title: String(title || "Sem título").trim(),
      artist: String(artist || "Artista desconhecido").trim(),
      album: albumName ? String(albumName).trim() : "YouTube Music",
      cover,
      durationSec,
      duration,
      type: "song",
    };
  }

  if (node.type === "MusicTwoRowItem") {
    let videoId = null;
    let browseId = null;
    const ep = node.endpoint;
    const payload = ep?.payload || {};
    if (payload.watchEndpoint?.videoId) {
      videoId = payload.watchEndpoint.videoId;
      browseId = payload.watchEndpoint.playlistId || null;
    } else if (payload.browseEndpoint?.browseId) {
      browseId = payload.browseEndpoint.browseId;
      if (VIDEO_ID_RE.test(browseId)) videoId = browseId;
    } else if (payload.browseId) {
      browseId = payload.browseId;
      if (VIDEO_ID_RE.test(browseId)) videoId = browseId;
    } else if (payload.watchEndpoint) {
      videoId = payload.watchEndpoint.videoId || null;
    } else {
      try {
        const url = ep?.toURL?.();
        if (url) {
          const u = new URL(url, "https://www.youtube.com");
          const v = u.searchParams.get("v");
          if (v) videoId = v;
          const list = u.searchParams.get("list");
          if (list) browseId = list;
        }
      } catch {}
    }
    if (!videoId && node.id && VIDEO_ID_RE.test(String(node.id))) videoId = String(node.id);
    const title = node.title ? String(node.title).trim() : "Sem título";
    const artist = node.artists?.[0]?.name || node.author?.name || "";
    const thumbs = node.thumbnail || [];
    const cover = hiResCover({ thumbnails: thumbs }, videoId) || pickThumb(thumbs) || FALLBACK_COVER;
    const url = ep?.toURL?.() || "";
    return {
      id: videoId || browseId || title,
      videoId: videoId || null,
      browseId: browseId || null,
      isAlbum: !videoId && !!browseId,
      source: "youtube",
      title,
      artist: String(artist || "").trim(),
      album: "",
      cover,
      durationSec: 0,
      duration: "0:00",
      type: !videoId && browseId ? "album" : "song",
      url,
    };
  }

  return null;
}

export function toArray(observed) {
  try {
    if (!observed) return [];
    if (Array.isArray(observed)) return observed;
    if (typeof observed.toArray === "function") return observed.toArray() || [];
    if (typeof observed[Symbol.iterator] === "function") return Array.from(observed);
    return [observed];
  } catch {
    return [];
  }
}

function hdrThumb(header) {
  try { return pickThumb(header?.thumbnail?.contents || header?.thumbnail || header?.strapline_thumbnail?.contents || header?.strapline_thumbnail || []); } catch { return null; }
}

function browseFromPayload(payload) {
  try {
    if (!payload) return null;
    return payload.browseEndpoint?.browseId || payload.browseId || payload.watchEndpoint?.playlistId || payload.watchEndpoint?.browseEndpoint?.browseId || null;
  } catch { return null; }
}

function browseFromEndpoint(node) {
  try {
    const payload = node?.endpoint?.payload;
    if (!payload) return null;
    if (payload.browseEndpoint?.browseId) return payload.browseEndpoint.browseId;
    if (payload.browseId) return payload.browseId;
    if (payload.watchEndpoint?.playlistId) return payload.watchEndpoint.playlistId;
    if (payload.browseEndpoint?.browseEndpoint?.browseId) return payload.browseEndpoint.browseEndpoint.browseId;
    try {
      const url = node.endpoint.toURL?.();
      if (url) {
        const u = new URL(url, "https://www.youtube.com");
        const list = u.searchParams.get("list");
        const channel = u.searchParams.get("channel");
        const b = u.searchParams.get("browse");
        const v = u.searchParams.get("v");
        if (list) return list;
        if (channel) return channel;
        if (b) return b;
        if (v && VIDEO_ID_RE.test(v)) return v;
      }
    } catch {}
    return null;
  } catch { return null; }
}

export function nodeToAlbum(node) {
  try {
    if (!node) return null;
    let id = null;
    if (node.type === "MusicResponsiveListItem") {
      id = node.id || browseFromPayload(node.endpoint?.payload) || browseFromEndpoint(node);
      if (!id && node.album?.id) id = node.album.id;
    } else {
      id = node.id || browseFromPayload(node.endpoint?.payload) || browseFromEndpoint(node);
    }
    if (node?.album?.id && !id) id = node.album.id;
    if (!id) return null;
    const title = node.title ? String(node.title).trim() : (node.flex_columns?.[0]?.title?.toString?.() || "").trim();
    if (!title) return null;
    let artist = "";
    if (node.type === "MusicTwoRowItem") {
      artist = node.artists?.[0]?.name || node.author?.name || "";
      if (!artist && node.subtitle) {
        const parts = String(node.subtitle).split(" • ").map((s) => s.trim()).filter(Boolean);
        for (const p of parts) {
          if (p === "Album" || p === "EP" || p === "Single" || /^\d{4}$/.test(p) || /^BY /.test(p) || /^Channel:/.test(p)) continue;
          artist = p; break;
        }
      }
    } else if (node.type === "MusicResponsiveListItem") {
      artist = (node.artists?.length ? node.artists.map((a) => a.name).filter(Boolean).join(", ") : "") || node.authors?.[0]?.name || "";
      if (!artist) {
        const col1 = node.flex_columns?.[1]?.title?.toString?.() || "";
        const parts = col1.split(" • ").map((s) => s.trim()).filter(Boolean);
        const filtered = parts.filter((p) => p !== "Album" && p !== "EP" && p !== "Single" && !/^\d{4}$/.test(p));
        artist = filtered[0] || "";
      }
    }
    let cover = null;
    if (node.type === "MusicTwoRowItem") cover = pickThumb(node.thumbnail || []);
    else cover = pickThumb(node.thumbnails || node.thumbnail?.contents || node.thumbnail || []);
    const thumbs = node.type === "MusicTwoRowItem" ? (node.thumbnail || []) : (node.thumbnails || node.thumbnail?.contents || node.thumbnail || []);
    cover = cover || pickThumb(thumbs) || FALLBACK_COVER;
    let year = null;
    if (node.year) { const y = parseInt(node.year, 10); if (Number.isFinite(y) && y > 1900) year = y; }
    if (!year && node.type === "MusicTwoRowItem" && node.subtitle) {
      const m = String(node.subtitle).match(/\b(19|20)\d{2}\b/);
      if (m) year = parseInt(m[0], 10);
    }
    if (!year && node.type === "MusicResponsiveListItem") {
      const col1 = node.flex_columns?.[1]?.title?.toString?.() || "";
      const m = col1.match(/\b(19|20)\d{2}\b/);
      if (m) year = parseInt(m[0], 10);
    }
    return { id, browseId: id, title, artist: artist ? String(artist).trim() : "Artista desconhecido", cover, year, type: "album" };
  } catch { return null; }
}

function monthlyFromText(text) {
  try {
    if (!text) return null;
    const s = String(text);
    if (!/monthly/i.test(s)) return null;
    const m = s.match(/[\d.,]+[KMB]?\s*?monthly/i);
    return m ? m[0].trim() : s.trim();
  } catch { return null; }
}

export function nodeToArtist(node) {
  try {
    if (!node) return null;
    let id = node.id || null;
    if (!id) id = browseFromPayload(node.endpoint?.payload) || browseFromEndpoint(node);
    if (!id && node.artists?.[0]?.channel_id) id = node.artists[0].channel_id;
    if (!id && node.author?.channel_id) id = node.author.channel_id;
    if (!id) return null;
    let name = "";
    if (node.type === "MusicTwoRowItem") {
      name = node.title ? String(node.title).trim() : (node.author?.name || node.artists?.[0]?.name || "");
    } else if (node.type === "MusicResponsiveListItem") {
      name = node.title || node.flex_columns?.[0]?.title?.toString?.() || node.name || "";
      if (!name && node.name) name = node.name;
      if (!name) name = node.artists?.[0]?.name || "";
    } else {
      name = node.title ? String(node.title).trim() : (node.name ? String(node.name).trim() : "");
      if (!name && node.subtitle) name = String(node.subtitle).trim();
    }
    name = String(name || "").trim() || "Artista desconhecido";
    let cover = null;
    if (node.type === "MusicTwoRowItem") cover = pickThumb(node.thumbnail || []);
    else cover = pickThumb(node.thumbnails || node.thumbnail?.contents || node.thumbnail || []);
    if (!cover && node.channelThumbnail) cover = pickThumb(node.channelThumbnail.contents || node.channelThumbnail || []);
    if (!cover && node.thumbnail) cover = pickThumb(node.thumbnail.contents || node.thumbnail || []);
    cover = cover || FALLBACK_COVER;
    let monthlyAudience = null;
    try {
      for (const col of (node.flex_columns || [])) {
        const t = col.title?.toString?.() || col.text || "";
        const m = monthlyFromText(t);
        if (m) { monthlyAudience = m; break; }
      }
      if (!monthlyAudience && node.description) monthlyAudience = monthlyFromText(node.description.toString?.() || node.description.text || "");
      if (!monthlyAudience && node.subtitle) monthlyAudience = monthlyFromText(node.subtitle.toString?.() || node.subtitle.text || "");
      if (!monthlyAudience && node.subscribers) monthlyAudience = String(node.subscribers).trim() || null;
    } catch {}
    return { id, name, cover, monthlyAudience, type: "artist" };
  } catch { return null; }
}

export function nodeToPlaylist(node) {
  try {
    if (!node) return null;
    let id = node.id || null;
    if (!id) id = browseFromPayload(node.endpoint?.payload) || browseFromEndpoint(node);
    if (!id) return null;
    const title = node.title ? String(node.title).trim() : (node.flex_columns?.[0]?.title?.toString?.() || "").trim();
    if (!title) return null;
    let author = "";
    if (node.type === "MusicTwoRowItem") {
      author = node.author?.name || node.artists?.[0]?.name || "";
      if (!author && node.subtitle) {
        const parts = String(node.subtitle).split(" • ").map((s) => s.trim()).filter(Boolean);
        const filtered = parts.filter((p) => p !== "Playlist" && !/^\d[\d.,]* songs?$/.test(p) && !/^\d+$/.test(p));
        author = filtered[0] || "";
      }
    } else if (node.type === "MusicResponsiveListItem") {
      author = node.author?.name || (node.artists?.length ? node.artists.map((a) => a.name).filter(Boolean).join(", ") : "");
      if (!author) {
        const col1 = node.flex_columns?.[1]?.title?.toString?.() || "";
        const parts = col1.split(" • ").map((s) => s.trim()).filter(Boolean);
        author = parts.filter((p) => p !== "Playlist")[0] || "";
      }
    }
    let cover = null;
    if (node.type === "MusicTwoRowItem") cover = pickThumb(node.thumbnail || []);
    else cover = pickThumb(node.thumbnails || node.thumbnail?.contents || node.thumbnail || []);
    cover = cover || FALLBACK_COVER;
    return { id, title, author: author ? String(author).trim() : "YouTube Music", cover, type: "playlist" };
  } catch { return null; }
}

export function panelVideoToTrack(node) {
  try {
    if (!node) return null;
    const n = node.primary || node;
    let videoId = n.video_id || n.videoId || null;
    if (!videoId && n.endpoint) {
      try {
        const url = n.endpoint.toURL?.();
        if (url) { const u = new URL(url, "https://www.youtube.com"); videoId = u.searchParams.get("v"); }
      } catch {}
    }
    if (!videoId && n.id && VIDEO_ID_RE.test(String(n.id))) videoId = String(n.id);
    if (!videoId) return null;
    const title = n.title ? String(n.title).trim() : "Sem título";
    let artist = "";
    if (Array.isArray(n.artists) && n.artists.length) artist = n.artists.map((a) => a.name).filter(Boolean).join(", ");
    else if (Array.isArray(n.authors) && n.authors.length) artist = n.authors.map((a) => a.name).filter(Boolean).join(", ");
    else if (n.author) artist = typeof n.author === "string" ? n.author : (n.author.name || "");
    else if (Array.isArray(n.author) && n.author.length) artist = n.author.map((a) => a.name || a).filter(Boolean).join(", ");
    artist = String(artist || "").trim() || "Artista desconhecido";
    const albumName = n.album ? String(n.album.name || n.album || "").trim() : "";
    const cover = pickThumb(n.thumbnail || []) || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : FALLBACK_COVER);
    const dur = (n.duration && typeof n.duration === "object") ? { text: n.duration.text, seconds: n.duration.seconds } : { text: typeof n.duration === "string" ? n.duration : "", seconds: 0 };
    const { durationSec, duration } = parseDuration(dur.text || "", dur.seconds || 0);
    return { id: videoId, videoId, title, artist, album: albumName || "YouTube Music", cover, durationSec, duration, type: "song" };
  } catch { return null; }
}

export function nodeToGenre(node) {
  try {
    if (!node) return null;
    const label = node.button_text || node.title || node.subtitle || "";
    const payload = node.endpoint?.payload;
    let browseId = browseFromPayload(payload) || browseFromEndpoint(node);
    if (!browseId && payload) {
      try {
        const url = node.endpoint.toURL?.();
        if (url) { const u = new URL(url, "https://www.youtube.com"); browseId = u.searchParams.get("browse") || u.searchParams.get("list") || u.pathname; }
      } catch {}
    }
    if (!label) return null;
    return { id: browseId || String(label), label: String(label).trim(), browseId: browseId || null };
  } catch { return null; }
}

function nodeText(node) {
  try { return node?.title ? String(node.title).trim() : (node?.flex_columns?.[0]?.title?.toString?.() || "").trim(); } catch { return ""; }
}

function unwrapNode(node) {
  try { return node?.primary || node?.musicResponsiveListItem || node?.musicTwoRowItem || node?.musicNavigationButton || node; } catch { return node; }
}

function shelfTitle(shelf) {
  try { return String(shelf?.header?.title || "").trim() || String(shelf?.title || "").trim(); } catch { return ""; }
}

export function shelfToItems(shelf) {
  try {
    const items = [];
    for (const raw of toArray(shelf?.contents)) {
      const node = unwrapNode(raw);
      if (!node) continue;
      if (node.type === "MusicNavigationButton") {
        const g = nodeToGenre(node);
        if (g) items.push(g);
        continue;
      }
      if (node.type === "MusicResponsiveListItem") {
        if (node.item_type === "album") {
          const a = nodeToAlbum(node);
          if (a) items.push(a);
          continue;
        }
        if (node.item_type === "playlist") {
          const a = nodeToPlaylist(node);
          if (a) items.push(a);
          continue;
        }
        if (node.item_type === "artist" || node.item_type === "library_artist") {
          const a = nodeToArtist(node);
          if (a) items.push(a);
          continue;
        }
        const t = nodeToTrack(node);
        if (t) items.push(t);
        continue;
      }
      if (node.type === "MusicTwoRowItem") {
        if (node.item_type === "artist") {
          const a = nodeToArtist(node);
          if (a) items.push(a);
          continue;
        }
        if (node.item_type === "playlist") {
          const a = nodeToPlaylist(node);
          if (a) items.push(a);
          continue;
        }
        if (node.item_type === "album") {
          const a = nodeToAlbum(node);
          if (a) items.push(a);
          continue;
        }
        const p = node.endpoint?.payload || {};
        const hasVideo = p.watchEndpoint?.videoId || (node.id && VIDEO_ID_RE.test(String(node.id)));
        if (hasVideo) {
          const t = nodeToTrack(node);
          if (t) items.push(t);
          continue;
        }
        const id = browseFromEndpoint(node) || node.id || "";
        if (id) {
          const a = nodeToAlbum(node);
          if (a) items.push(a);
          continue;
        }
        const t = nodeToTrack(node);
        if (t) items.push(t);
        continue;
      }
      if (node.type === "PlaylistPanelVideo" || node.video_id) {
        const t = panelVideoToTrack(node);
        if (t) items.push(t);
        continue;
      }
      if (node.type === "MusicMultiRowListItem") {
        const ep = node.on_tap || node.endpoint;
        const bid = browseFromPayload(ep?.payload) || ep?.payload?.browseEndpoint?.browseId || "";
        if (bid) {
          const a = nodeToAlbum(node);
          if (a) items.push(a);
        }
        continue;
      }
    }
    return items;
  } catch { return []; }
}

export { FALLBACK_COVER as _FALLBACK_COVER, VIDEO_ID_RE as _VIDEO_ID_RE, pickThumb as _pickThumb, parseDuration as _parseDuration, extractDurationFromColumns as _extractDurationFromColumns, hiResCover as _hiResCover, monthlyFromText as _monthlyFromText, shelfTitle as _shelfTitle, nodeText as _nodeText };

export function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=120, stale-while-revalidate=120");
}

export function sendJSON(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function handleOptions(req, res) {
  if (req.method === "OPTIONS") {
    setCors(res);
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}
