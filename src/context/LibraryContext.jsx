import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { DB } from "../db/database";
import { useToast } from "./ToastContext";

const LibraryContext = createContext(null);

export function LibraryProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast?.();
  const userId = user?.id || null;
  const [playlists, setPlaylists] = useState([]);
  const [downloads, setDownloads] = useState([]); // [{videoId, cover, title, savedAt}]
  const [subs, setSubsState] = useState([]);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [libAlbums, setLibAlbums] = useState([]);
  const [likedCount, setLikedCount] = useState(0);

  // carregar tudo ao logar — cada conta só vê os seus dados
  useEffect(() => {
    let c = false;
    if (!userId) { setPlaylists([]); setDownloads([]); setSubsState([]); setHistoryEntries([]); setLibAlbums([]); setLikedCount(0); return; }
    (async () => {
      try {
        const [pls, s, h, la, likes] = await Promise.all([
          DB.listPlaylists(userId).catch(() => []),
          DB.getSubs(userId).catch(() => []),
          DB.getHistory(userId, 100).catch(() => []),
          DB.getLibraryAlbums(userId).catch(() => []),
          DB.getLikes(userId).catch(() => []),
        ]);
        if (c) return;
        setPlaylists(Array.isArray(pls) ? pls : []);
        setSubsState(Array.isArray(s) ? s : []);
        setHistoryEntries(Array.isArray(h) ? h : []);
        setLibAlbums(Array.isArray(la) ? la : []);
        setLikedCount(Array.isArray(likes) ? likes.length : 0);
      } catch {}
    })();
    return () => { c = true; };
  }, [userId]);

  // downloads persistidos em settings.data.downloads (por usuário)
  useEffect(() => {
    let c = false;
    if (!userId) { setDownloads([]); return; }
    (async () => {
      try {
        const s = await DB.getSettings(userId).catch(() => null);
        const d = Array.isArray(s?.downloads) ? s.downloads : [];
        if (!c) setDownloads(d);
      } catch {}
    })();
    return () => { c = true; };
  }, [userId]);

  const persistSettings = useCallback(async (patch) => {
    if (!userId) return;
    try {
      const cur = (await DB.getSettings(userId).catch(() => null)) || {};
      await DB.saveSettings(userId, { ...cur, ...patch });
    } catch {}
  }, [userId]);

  const refreshPlaylists = useCallback(async () => {
    if (!userId) return;
    try { setPlaylists(await DB.listPlaylists(userId)); } catch {}
  }, [userId]);

  const addPlaylist = useCallback(async (name) => {
    if (!userId) return null;
    const pl = { id: `pl_${Date.now()}`, userId, name: String(name || "").trim() || "Nova playlist", description: "", trackIds: [], createdAt: Date.now(), updatedAt: Date.now() };
    await DB.savePlaylist(pl).catch(() => {});
    setPlaylists((p) => [pl, ...p]);
    try { toast?.push(`Playlist “${pl.name}” criada`); } catch {}
    return pl;
  }, [userId]);

  const renamePlaylist = useCallback(async (id, name) => {
    if (!userId) return;
    const pl = playlists.find((x) => String(x.id) === String(id));
    if (!pl) return;
    const next = { ...pl, name: String(name || "").trim() || pl.name, updatedAt: Date.now() };
    await DB.savePlaylist(next).catch(() => {});
    setPlaylists((p) => p.map((x) => (String(x.id) === String(id) ? next : x)));
  }, [playlists, userId]);

  const deletePlaylist = useCallback(async (id) => {
    if (!userId) return;
    await DB.deletePlaylist(id, userId).catch(() => {});
    setPlaylists((p) => p.filter((x) => String(x.id) !== String(id)));
    try { toast?.push("Playlist excluída"); } catch {}
  }, [userId]);

  const addToPlaylist = useCallback(async (playlistId, track) => {
    if (!userId || !track) return;
    const videoId = String(track.videoId || track.id || "");
    if (!videoId) return;
    const pl = playlists.find((x) => String(x.id) === String(playlistId));
    if (!pl) return;
    if ((pl.trackIds || []).includes(videoId)) { try { toast?.push("Já está nessa playlist"); } catch {}; return; }
    const next = { ...pl, trackIds: [...(pl.trackIds || []), videoId], updatedAt: Date.now() };
    await DB.savePlaylist(next).catch(() => {});
    setPlaylists((p) => p.map((x) => (String(x.id) === String(playlistId) ? next : x)));
    try { await DB.cacheTracks([track], userId); } catch {}
    try { toast?.push(`Adicionada a “${pl.name}”`); } catch {}
  }, [playlists, userId]);

  const toggleSubscribe = useCallback(async (artist) => {
    if (!userId || !artist?.id) return;
    const id = String(artist.id);
    const exists = subs.some((s) => String(s.id) === id);
    const next = exists ? subs.filter((s) => String(s.id) !== id) : [...subs, { id, name: artist.name || artist.title || "Artista" }];
    setSubsState(next);
    await DB.setSubs(userId, next).catch(() => {});
    try { toast?.push(exists ? "Inscrição removida" : `Inscrito em ${artist.name || "artista"}`); } catch {}
  }, [subs, userId]);

  const isSubscribed = useCallback((id) => subs.some((s) => String(s.id) === String(id)), [subs]);

  const toggleAlbumInLibrary = useCallback(async (album) => {
    if (!userId || !album?.browseId) return;
    const id = String(album.browseId);
    const exists = libAlbums.includes(id);
    const next = exists ? libAlbums.filter((x) => x !== id) : [...libAlbums, id];
    setLibAlbums(next);
    await DB.setLibraryAlbums(userId, next).catch(() => {});
  }, [libAlbums, userId]);

  const toggleDownload = useCallback(async (track) => {
    if (!userId || !track?.videoId) return;
    const videoId = String(track.videoId);
    const exists = downloads.some((d) => String(d.videoId) === videoId);
    const next = exists
      ? downloads.filter((d) => String(d.videoId) !== videoId)
      : [...downloads, { videoId, cover: track.cover || "", title: track.title || "", savedAt: Date.now() }];
    setDownloads(next);
    await persistSettings({ downloads: next });
    if (!exists) { try { await DB.cacheTracks([track], userId); } catch {} }
    try { toast?.push(exists ? "Removido dos downloads" : "Baixada para off-line"); } catch {}
  }, [downloads, persistSettings, userId]);

  const refreshHistory = useCallback(async () => {
    if (!userId) return;
    try { setHistoryEntries(await DB.getHistory(userId, 100)); } catch {}
  }, [userId]);

  const clearHistory = useCallback(async () => {
    if (!userId) return;
    await DB.clearHistory(userId).catch(() => {});
    setHistoryEntries([]);
  }, [userId]);

  // contagem de curtidas sincronizada (para o perfil)
  useEffect(() => {
    let c = false;
    if (!userId) { setLikedCount(0); return; }
    DB.getLikes(userId).then((ids) => { if (!c) setLikedCount(ids?.length || 0); }).catch(() => {});
    return () => { c = true; };
  }, [userId]);

  const value = {
    playlists, addPlaylist, renamePlaylist, deletePlaylist, addToPlaylist, refreshPlaylists,
    downloads, toggleDownload,
    subs, toggleSubscribe, isSubscribed,
    historyEntries, refreshHistory, clearHistory,
    libAlbums, toggleAlbumInLibrary,
    likedCount,
  };
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export const useLibrary = () => useContext(LibraryContext);
