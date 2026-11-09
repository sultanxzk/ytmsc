// Harmonia via YouTube Music (InnerTube + YouTube IFrame Player API).
// Frontend calls same-origin /api/*: VITE_API_URL points to the deployed API when static-hosted.
const API_BASE = (import.meta.env?.VITE_API_URL || "").replace(/\/$/, "");
export const apiUrl = (path) => `${API_BASE}${path}`;
const api = apiUrl;

const FALLBACK_COVER = (seed) => `https://picsum.photos/seed/ytm${seed}/400/400`;

export const fmtSec = (s) => {
  s = Math.max(0, Math.round(s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

async function fetchJSON(url, { timeout = 20000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

function mapTrack(t) {
  if (!t) return null;
  const videoId = t.videoId || t.id || "";
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(String(videoId))) return null;
  const durationSec = Number(t.durationSec) || 0;
  return {
    id: String(videoId),
    videoId: String(videoId),
    source: "youtube",
    title: t.title || "Sem título",
    artist: t.artist || t.author || "Artista desconhecido",
    album: t.album || "YouTube Music",
    cover: t.cover || t.thumbnail || FALLBACK_COVER(videoId),
    src: "",
    durationSec,
    duration: t.duration || fmtSec(durationSec),
    genre: t.genre || "",
    year: t.year || null,
    explicit: false,
    mood: [],
    lyrics: "",
  };
}

export async function searchTracks(query, limit = 40) {
  const term = String(query || "").trim();
  if (!term) return [];
  const json = await fetchJSON(api(`/api/search?q=${encodeURIComponent(term)}`));
  const list = (json?.tracks || json || []).map(mapTrack).filter(Boolean);
  return list.slice(0, limit);
}

export async function searchAllDetailed(query) {
  const term = String(query || "").trim();
  if (!term) return { tracks: [], artists: [], albums: [], playlists: [] };
  const [all, pl] = await Promise.allSettled([
    fetchJSON(api(`/api/search?q=${encodeURIComponent(term)}&type=all`)),
    fetchJSON(api(`/api/search?q=${encodeURIComponent(term)}&type=playlist`)),
  ]);
  const a = all.status === "fulfilled" ? all.value : {};
  const p = pl.status === "fulfilled" ? pl.value : {};
  return {
    tracks: (a?.tracks || []).map(mapTrack).filter(Boolean),
    artists: (a?.artists || []).map(mapArtist).filter(Boolean),
    albums: (a?.albums || []).map(mapAlbum).filter(Boolean),
    playlists: (p?.playlists || a?.playlists || []).map(mapPlaylist).filter(Boolean),
  };
}

function mapPlaylist(pl) {
  if (!pl) return null;
  const id = pl.browseId || pl.id || "";
  if (!id) return null;
  return {
    id: String(id),
    browseId: String(id),
    title: pl.title || "Playlist",
    artist: pl.author || pl.artist || "YouTube Music",
    songCount: pl.songCount || null,
    cover: pl.cover || pl.thumbnail || FALLBACK_COVER(id),
    type: "playlist",
  };
}

export async function searchPlaylists(query, limit = 20) {
  const term = String(query || "").trim();
  if (!term) return [];
  const json = await fetchJSON(api(`/api/search?q=${encodeURIComponent(term)}&type=playlist`));
  return (json?.playlists || []).map(mapPlaylist).filter(Boolean).slice(0, limit);
}

export async function getBrowsePage(browseId) {
  if (!browseId) return { title: "", tracks: [] };
  const isAlbumish = /^MPREb_/.test(String(browseId));
  if (isAlbumish) {
    const json = await fetchJSON(api(`/api/album?id=${encodeURIComponent(browseId)}`));
    return { title: json?.album?.title || "", tracks: (json?.tracks || []).map(mapTrack).filter(Boolean), album: json?.album };
  }
  const json = await fetchJSON(api(`/api/playlist?id=${encodeURIComponent(browseId)}`));
  return { title: json?.playlist?.title || "", tracks: (json?.tracks || []).map(mapTrack).filter(Boolean), playlist: json?.playlist };
}

export async function fetchHome() {
  const json = await fetchJSON(api("/api/home"));
  const tracks = (json?.tracks || []).map(mapTrack).filter(Boolean);
  const mapList = (arr) => (arr || []).map(mapTrack).filter(Boolean);
  return {
    tracks,
    albums: (json?.albums || []).map((a) => ({
      id: a.browseId || a.id,
      browseId: a.browseId || a.id,
      title: a.title,
      artist: a.artist || "",
      cover: a.cover || FALLBACK_COVER(a.id || a.title),
      year: a.year || null,
    })).filter((x) => x.browseId),
    again: mapList(json?.again || tracks.slice(0, 8)),
    quick: mapList(json?.quick || tracks.slice(4, 12)),
    trending: mapList(json?.trending || tracks.slice(0, 12)),
    late: mapList(json?.late || tracks.slice(0, 8)),
    artists: mapList(json?.artists || tracks.slice(8, 16)),
    dreams: mapList(json?.dreams || tracks.slice(0, 8)),
    weekend: mapList(json?.weekend || tracks.slice(0, 8)),
    calm: mapList(json?.calm || tracks.slice(4, 12)),
    sections: json?.sections || [],
  };
}

export async function fetchTrending(_genre, limit = 20) {
  try {
    const home = await fetchHome();
    return (home.trending || home.tracks || []).slice(0, limit);
  } catch {
    return [];
  }
}

export async function getAlbumTracks(browseId, album) {
  if (!browseId) return [];
  const json = await fetchJSON(api(`/api/album?id=${encodeURIComponent(browseId)}`));
  const list = (json?.tracks || []).map(mapTrack).filter(Boolean);
  return list.map((t) => ({ ...t, album: t.album && t.album !== "YouTube Music" ? t.album : (album?.title || t.album) }));
}

export async function fetchLyrics(videoId) {
  try {
    const json = await fetchJSON(api(`/api/lyrics?id=${encodeURIComponent(videoId)}`));
    return json?.lyrics || "";
  } catch {
    return "";
  }
}

function mapAlbum(a) {
  if (!a) return null;
  const id = a.browseId || a.id || "";
  if (!id) return null;
  return {
    id: String(id),
    browseId: String(id),
    title: a.title || "Álbum",
    artist: a.artist || a.author || "Artista desconhecido",
    cover: a.cover || a.thumbnail || FALLBACK_COVER(id),
    year: a.year || null,
    type: "album",
  };
}

function mapArtist(a) {
  if (!a) return null;
  const id = a.id || a.browseId || "";
  if (!id) return null;
  return {
    id: String(id),
    name: a.name || a.title || "Artista desconhecido",
    cover: a.cover || a.thumbnail || FALLBACK_COVER(id),
    monthlyAudience: a.monthlyAudience || null,
    type: "artist",
  };
}

export async function searchArtists(query, limit = 20) {
  const term = String(query || "").trim();
  if (!term) return [];
  const json = await fetchJSON(api(`/api/search?q=${encodeURIComponent(term)}&type=artist`));
  return (json?.artists || []).map(mapArtist).filter(Boolean).slice(0, limit);
}

export async function searchAlbums(query, limit = 20) {
  const term = String(query || "").trim();
  if (!term) return [];
  const json = await fetchJSON(api(`/api/search?q=${encodeURIComponent(term)}&type=album`));
  return (json?.albums || []).map(mapAlbum).filter(Boolean).slice(0, limit);
}

export async function searchAll(query) {
  const term = String(query || "").trim();
  if (!term) return { tracks: [], artists: [], albums: [] };
  const json = await fetchJSON(api(`/api/search?q=${encodeURIComponent(term)}&type=all`));
  return {
    tracks: (json?.tracks || []).map(mapTrack).filter(Boolean),
    artists: (json?.artists || []).map(mapArtist).filter(Boolean),
    albums: (json?.albums || []).map(mapAlbum).filter(Boolean),
  };
}

export async function getArtist(id) {
  if (!id) throw new Error("Missing artist id");
  const json = await fetchJSON(api(`/api/artist?id=${encodeURIComponent(id)}`));
  const artist = json?.artist || {};
  return {
    artist: {
      id: artist.id || id,
      name: artist.name || "Artista desconhecido",
      cover: artist.cover || FALLBACK_COVER(id),
      monthlyAudience: artist.monthlyAudience || null,
      type: "artist",
    },
    topSongs: (json?.topSongs || []).map(mapTrack).filter(Boolean),
    sections: (json?.sections || []).map((s) => ({
      title: s.title || "",
      items: (s.items || []).map((it) => {
        if (it.type === "album") return mapAlbum(it);
        if (it.type === "artist") return mapArtist(it);
        return mapTrack(it);
      }).filter(Boolean),
    })),
  };
}

export async function getUpNext(videoId) {
  if (!videoId) return [];
  const json = await fetchJSON(api(`/api/upnext?id=${encodeURIComponent(videoId)}`));
  return (json?.tracks || []).map(mapTrack).filter(Boolean);
}

export async function getRelated(videoId) {
  if (!videoId) return { tracks: [], sections: [] };
  const json = await fetchJSON(api(`/api/related?id=${encodeURIComponent(videoId)}`));
  const mapItem = (it) => (it.type === "album" ? mapAlbum(it) : it.type === "artist" ? mapArtist(it) : mapTrack(it));
  return {
    tracks: (json?.tracks || []).map(mapTrack).filter(Boolean),
    sections: (json?.sections || []).map((s) => ({ title: s.title || "", items: (s.items || []).map(mapItem).filter(Boolean) })),
  };
}

export async function getPlaylistTracks(id) {
  if (!id) return { playlist: null, tracks: [] };
  const json = await fetchJSON(api(`/api/playlist?id=${encodeURIComponent(id)}`));
  return {
    playlist: json?.playlist ? {
      id: json.playlist.id,
      title: json.playlist.title || "Playlist",
      author: json.playlist.author || "YouTube Music",
      cover: json.playlist.cover || FALLBACK_COVER(json.playlist.id),
    } : null,
    tracks: (json?.tracks || []).map(mapTrack).filter(Boolean),
  };
}

export async function getSuggestions(query) {
  const term = String(query || "").trim();
  if (!term) return [];
  const json = await fetchJSON(api(`/api/suggestions?q=${encodeURIComponent(term)}`));
  return Array.isArray(json?.suggestions) ? json.suggestions : [];
}

export async function getExplore() {
  const json = await fetchJSON(api("/api/explore"));
  return {
    genres: (json?.genres || []).map((g) => ({
      id: g.id || g.browseId,
      label: g.label || "",
      browseId: g.browseId || g.id,
    })),
    sections: (json?.sections || []).map((s) => ({
      title: s.title || "",
      items: (s.items || []).map((it) => (it.type === "album" ? mapAlbum(it) : it.type === "artist" ? mapArtist(it) : mapTrack(it))).filter(Boolean),
    })),
  };
}

export const searchSongs = searchTracks;
export const browse = (genreOrTerm, limit = 12) => fetchTrending("", limit);

export const getArtistTop = (artistName, limit = 10) => searchTracks(artistName, limit);

export const HOME_SECTIONS = [
  { key: "late", title: "Clássicos da madrugada", kind: "songs" },
  { key: "dreams", title: "Bons sonhos", kind: "songs" },
  { key: "artists", title: "De quais artistas você gosta?", kind: "songs" },
  { key: "quick", title: "Escolha a dedo", kind: "songs" },
  { key: "trending", title: "Playlists da comunidade em alta", kind: "songs" },
  { key: "weekend", title: "Perfeitas para o fim de semana", kind: "songs" },
  { key: "calm", title: "Calminhas", kind: "songs" },
];

export const GENRES = [
  "Clima alegre", "Em trânsito", "Energia", "Festa", "Foco", "Games",
  "Músicas para relaxar", "Romance", "Sono", "Treino", "Triste",
  "África", "Árabe", "Axé", "Blues", "Country", "Dance e eletrônico",
  "Datas especiais", "Décadas", "Família", "Forró", "Funk", "Gospel",
  "Hip-hop", "Índia/Bollywood", "J-Pop", "Jazz", "K-Pop", "Latina",
  "Metal", "MPB", "Música clássica", "Música folk e acústica",
  "Música indie e alternativa", "Pop", "Pop BR", "R&B e soul",
  "Rap e trap BR", "Reggae e Caribe", "Rock", "Rock brasileiro",
  "Samba e pagode", "Sertanejo", "Trilhas sonoras e musicais",
];

export const EXPLORE_TABS = [
  { id: "new", label: "Lançamentos" },
  { id: "charts", label: "Paradas" },
  { id: "moods", label: "Momentos e gêneros" },
  { id: "podcasts", label: "Podcasts" },
];

export const MOOD_QUERIES = {
  energia: "pop energia hits",
  relaxar: "chill relax acoustic",
  treino: "workout treino",
  foco: "lofi focus concentração",
  transito: "driving road trip música",
  romance: "romantic love song",
  podcasts: "podcast",
  dormir: "sleep calm music",
  positividade: "feel good positive",
  festa: "party dance hits",
  triste: "sad melancholy",
};
