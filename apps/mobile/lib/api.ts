// Cliente da API serverless do web (Vercel + Vite dev)
// WEB: VITE_API_URL no root; MOBILE: EXPO_PUBLIC_API_URL
export const API_BASE =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) || 'https://ytmsc.vercel.app';

export interface Track {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  album?: string;
  cover: string;
  durationSec?: number;
  duration?: string;
  browseId?: string;
  videoUrl?: string;
  localUri?: string;
}

const FALLBACK_COVER = (seed: string) => `https://picsum.photos/seed/ytm${seed}/400/400`;

export const fmtSec = (s?: number) => {
  s = Math.max(0, Math.round(s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function mapTrack(t: any): Track | null {
  if (!t) return null;
  const videoId = t.videoId || t.id || '';
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(String(videoId))) return null;
  return {
    id: String(videoId),
    videoId: String(videoId),
    title: t.title || 'Sem título',
    artist: t.artist || t.author || 'Artista desconhecido',
    album: t.album || 'YouTube Music',
    cover: t.cover || t.thumbnail || FALLBACK_COVER(videoId),
    durationSec: Number(t.durationSec) || 0,
    duration: t.duration || fmtSec(Number(t.durationSec) || 0),
  };
}

async function fetchJSON(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchHome() {
  const json = await fetchJSON('/api/music/home');
  const tracks = (json?.tracks || []).map(mapTrack).filter(Boolean) as Track[];
  return {
    tracks,
    sections: (json?.sections || []).map((s: any) => ({
      title: s.title || '',
      items: (s.items || []).map(mapTrack).filter(Boolean) as Track[],
    })),
    albums: (json?.albums || []).map((a: any) => ({
      id: a.browseId || a.id,
      browseId: a.browseId || a.id,
      title: a.title,
      artist: a.artist || '',
      cover: a.cover || FALLBACK_COVER(a.id || a.title),
    })),
    quick: (json?.quick || tracks.slice(4, 12)).map(mapTrack).filter(Boolean) as Track[],
  };
}

export async function resolveStream(videoId: string): Promise<string | null> {
  try {
    const json = await fetchJSON(`/api/music/stream?id=${encodeURIComponent(videoId)}`);
    return json?.streamUrl || null;
  } catch {
    return null;
  }
}

export async function searchTracks(q: string, limit = 30): Promise<Track[]> {
  const term = String(q || '').trim();
  if (!term) return [];
  const json = await fetchJSON(`/api/music/search?q=${encodeURIComponent(term)}`);
  return ((json?.tracks || json || []) as any[]).map(mapTrack).filter(Boolean).slice(0, limit) as Track[];
}

export async function fetchLyrics(videoId: string): Promise<string> {
  try {
    const json = await fetchJSON(`/api/music/lyrics?id=${encodeURIComponent(videoId)}`);
    return json?.lyrics || '';
  } catch {
    return '';
  }
}

export async function getBrowsePage(browseId: string) {
  const isAlbumish = /^MPREb_/.test(String(browseId));
  if (isAlbumish) {
    const json = await fetchJSON(`/api/music/album?id=${encodeURIComponent(browseId)}`);
    return { title: json?.album?.title || '', tracks: (json?.tracks || []).map(mapTrack).filter(Boolean) as Track[] };
  }
  const json = await fetchJSON(`/api/music/playlist?id=${encodeURIComponent(browseId)}`);
  return { title: json?.playlist?.title || '', tracks: (json?.tracks || []).map(mapTrack).filter(Boolean) as Track[] };
}

export async function getUpNext(videoId: string): Promise<Track[]> {
  try {
    const json = await fetchJSON(`/api/music/upnext?id=${encodeURIComponent(videoId)}`);
    return (json?.tracks || []).map(mapTrack).filter(Boolean) as Track[];
  } catch {
    return [];
  }
}
