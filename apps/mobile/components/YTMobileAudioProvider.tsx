import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Track } from '../lib/api';
import { resolveStream } from '../lib/api';
import {
  addHistory, clearHistory, getDislikes, getLikes, getPrefs, getPlaylists,
  savePlaylists, setDislikes, setLikes, setPrefs, getLibAlbums, setLibAlbums,
  type Playlist, type Prefs,
} from '../lib/store';

export type RepeatMode = 'off' | 'all' | 'one';

interface AudioContextType {
  currentTrack: Track | null;
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  rate: number;
  sleepTimerMin: number | null;
  likes: string[];
  dislikes: string[];
  playlists: Playlist[];
  libAlbums: string[];
  downloadProgress: { [key: string]: number };
  downloadedTracks: string[];
  loadingId: string | null;
  playTrack: (track: Track, queue?: Track[]) => Promise<void>;
  playTracks: (tracks: Track[], startId?: string) => Promise<void>;
  togglePlay: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (t: number) => Promise<void>;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setVolumeState: (v: number) => Promise<void>;
  setRateState: (r: number) => Promise<void>;
  setSleepTimer: (min: number | null) => Promise<void>;
  toggleLike: (track: Track) => Promise<void>;
  toggleDislike: (track: Track) => Promise<void>;
  addToQueue: (track: Track) => void;
  moveInQueue: (from: number, to: number) => void;
  removeFromQueue: (index: number) => void;
  playQueueAt: (index: number) => Promise<void>;
  clearQueue: () => void;
  createPlaylist: (name: string) => Promise<Playlist>;
  addTrackToPlaylist: (playlistId: string, track: Track) => Promise<void>;
  removeFromPlaylist: (playlistId: string, videoId: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  toggleAlbumInLibrary: (browseId: string) => Promise<void>;
  clearHistoryAll: () => Promise<void>;
  downloadTrackOffline: (track: Track) => Promise<void>;
  deleteOfflineTrack: (trackId: string) => Promise<void>;
  getOfflineTrack: (id: string) => Promise<Track | null>;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function YTMobileAudioProvider({ children }: { children: React.ReactNode }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const sleepRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [volume, setVolume] = useState(0.85);
  const [rate, setRate] = useState(1);
  const [sleepTimerMin, setSleepTimerMin] = useState<number | null>(null);
  const [likes, setLikesState] = useState<string[]>([]);
  const [dislikes, setDislikesState] = useState<string[]>([]);
  const [playlists, setPlaylistsState] = useState<Playlist[]>([]);
  const [libAlbums, setLibAlbumsState] = useState<string[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: number }>({});
  const [downloadedTracks, setDownloadedTracks] = useState<string[]>([]);

  const queueRef = useRef(queue);
  const idxRef = useRef(currentIndex);
  const shuffleRef = useRef(shuffle);
  const repeatRef = useRef(repeat);
  const prefsRef = useRef<Prefs>({ volume: 0.85, rate: 1, sleepTimerMin: null, quality: 'high' });
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { idxRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);

  useEffect(() => {
    loadAll();
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      if (sleepRef.current) clearTimeout(sleepRef.current);
    };
  }, []);

  const loadAll = async () => {
    const [prefs, l, d, pls, albums] = await Promise.all([
      getPrefs(), getLikes(), getDislikes(), getPlaylists(), getLibAlbums(),
    ]);
    prefsRef.current = prefs;
    setVolume(prefs.volume);
    setRate(prefs.rate);
    setSleepTimerMin(prefs.sleepTimerMin);
    setLikesState(l);
    setDislikesState(d);
    setPlaylistsState(pls);
    setLibAlbumsState(albums);
    // offline
    try {
      const stored = await AsyncStorage.getItem('@yt_offline_tracks');
      if (stored) setDownloadedTracks(JSON.parse(stored));
    } catch {}
  };

  const persistPrefs = async (patch: Partial<Prefs>) => {
    const next = { ...prefsRef.current, ...patch };
    prefsRef.current = next;
    await setPrefs(next);
  };

  const scheduleSleep = (min: number | null) => {
    if (sleepRef.current) { clearTimeout(sleepRef.current); sleepRef.current = null; }
    if (min == null) return;
    sleepRef.current = setTimeout(async () => {
      if (soundRef.current) {
        await soundRef.current.pauseAsync().catch(() => {});
        setIsPlaying(false);
      }
      setSleepTimerMin(null);
      await persistPrefs({ sleepTimerMin: null });
    }, min * 60 * 1000);
  };

  const getOfflineTrack = async (id: string): Promise<Track | null> => {
    try {
      const raw = await AsyncStorage.getItem(`@track_offline_${id}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  const loadTrack = useCallback(async (track: Track) => {
    console.log('[PLAYER] loadTrack:', track.title, track.videoId);

    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(track.durationSec || 0);
    setLoadingId(track.videoId);
    addHistory(track).catch(() => {});

    let uri: string | null = null;

    // 1) Verifica offline
    try {
      const offline = await getOfflineTrack(track.videoId);
      uri = offline?.localUri || track.localUri || track.videoUrl || null;
    } catch {}

    // 2) Resolve via API (proxy)
    if (!uri) {
      try {
        uri = await resolveStream(track.videoId);
      } catch {}
    }

    // 3) Retry uma vez
    if (!uri) {
      try {
        uri = await resolveStream(track.videoId);
      } catch {}
    }

    setLoadingId(null);
    if (!uri) {
      console.error('[PLAYER] ❌ SEM STREAM URL para', track.videoId);
      Alert.alert('Erro ao carregar', 'Não foi possível obter o stream de áudio para esta música.');
      setIsPlaying(false);
      return;
    }

    console.log('[PLAYER] ✅ Stream URL obtida, criando player...');
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      console.log('[PLAYER] ✅ Player criado com sucesso!');
      soundRef.current = sound;
      setIsPlaying(true);

      const p = prefsRef.current;
      await sound.setVolumeAsync(p.volume).catch(() => {});
      await sound.setRateAsync(p.rate, true).catch(() => {});

      sound.setOnPlaybackStatusUpdate(async (status) => {
        if (!status.isLoaded) return;
        setCurrentTime((status.positionMillis || 0) / 1000);
        if (status.durationMillis) setDuration(status.durationMillis / 1000);
        if (status.isPlaying !== undefined) setIsPlaying(!!status.isPlaying);
        if (status.didJustFinish) {
          if (repeatRef.current === 'one') {
            await sound.setPositionAsync(0);
            await sound.playAsync();
            return;
          }
          await nextRef.current();
        }
      });
    } catch (e) {
      console.error('[PLAYER] ❌ createAsync falhou:', e);
      Alert.alert('Erro no player', `Não foi possível reproduzir esta música. Tente novamente.`);
      setIsPlaying(false);
    }
  }, []);

  const playTrack = useCallback(async (track: Track, q?: Track[]) => {
    const list = q && q.length ? q : queueRef.current.length ? queueRef.current : [track];
    const idx = Math.max(0, list.findIndex((t) => t.videoId === track.videoId));
    setQueue(list); setCurrentIndex(idx);
    queueRef.current = list; idxRef.current = idx;
    await loadTrack(list[idx] || track);
  }, [loadTrack]);

  const playTracks = useCallback(async (tracks: Track[], startId?: string) => {
    if (!tracks.length) return;
    const idx = startId ? Math.max(0, tracks.findIndex((t) => t.videoId === startId)) : 0;
    setQueue(tracks); setCurrentIndex(idx);
    queueRef.current = tracks; idxRef.current = idx;
    await loadTrack(tracks[idx]);
  }, [loadTrack]);

  const next = useCallback(async () => {
    const q = queueRef.current;
    if (!q.length) return;
    const idx = idxRef.current;
    if (repeatRef.current === 'off' && idx >= q.length - 1) { setIsPlaying(false); return; }
    const nextIdx = shuffleRef.current ? Math.floor(Math.random() * q.length) : (idx + 1) % q.length;
    setCurrentIndex(nextIdx); idxRef.current = nextIdx;
    await loadTrack(q[nextIdx]);
  }, [loadTrack]);

  const prev = useCallback(async () => {
    if (currentTime > 3 && soundRef.current) { await soundRef.current.setPositionAsync(0); return; }
    const q = queueRef.current;
    if (!q.length) return;
    const prevIdx = (idxRef.current - 1 + q.length) % q.length;
    setCurrentIndex(prevIdx); idxRef.current = prevIdx;
    await loadTrack(q[prevIdx]);
  }, [loadTrack, currentTime]);

  const nextRef = useRef(next);
  useEffect(() => { nextRef.current = next; }, [next]);

  const togglePlay = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    if (isPlaying) { await s.pauseAsync(); setIsPlaying(false); }
    else { await s.playAsync(); setIsPlaying(true); }
  }, [isPlaying]);

  const seek = useCallback(async (t: number) => {
    const s = soundRef.current;
    if (!s) return;
    await s.setPositionAsync(Math.round(t * 1000));
    setCurrentTime(t);
  }, []);

  const toggleShuffle = useCallback(() => setShuffle((v) => !v), []);
  const cycleRepeat = useCallback(() => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')), []);

  const setVolumeState = useCallback(async (v: number) => {
    const vol = Math.min(1, Math.max(0, v));
    setVolume(vol);
    if (soundRef.current) await soundRef.current.setVolumeAsync(vol).catch(() => {});
    await persistPrefs({ volume: vol });
  }, []);

  const setRateState = useCallback(async (r: number) => {
    setRate(r);
    if (soundRef.current) await soundRef.current.setRateAsync(r, true).catch(() => {});
    await persistPrefs({ rate: r });
  }, []);

  const setSleepTimer = useCallback(async (min: number | null) => {
    setSleepTimerMin(min);
    scheduleSleep(min);
    await persistPrefs({ sleepTimerMin: min });
  }, []);

  const toggleLike = useCallback(async (track: Track) => {
    const id = track.videoId;
    let nextLikes = likes.includes(id) ? likes.filter((x) => x !== id) : [...likes, id];
    let nextDislikes = nextLikes.includes(id) ? dislikes.filter((x) => x !== id) : dislikes;
    setLikesState(nextLikes); await setLikes(nextLikes);
    setDislikesState(nextDislikes); await setDislikes(nextDislikes);
  }, [likes, dislikes]);

  const toggleDislike = useCallback(async (track: Track) => {
    const id = track.videoId;
    let nextDislikes = dislikes.includes(id) ? dislikes.filter((x) => x !== id) : [...dislikes, id];
    let nextLikes = nextDislikes.includes(id) ? likes.filter((x) => x !== id) : likes;
    setDislikesState(nextDislikes); await setDislikes(nextDislikes);
    setLikesState(nextLikes); await setLikes(nextLikes);
  }, [likes, dislikes]);

  const addToQueue = useCallback((track: Track) => {
    const next = [...queueRef.current, track];
    setQueue(next); queueRef.current = next;
  }, []);

  const moveInQueue = useCallback((from: number, to: number) => {
    const next = [...queueRef.current];
    const [item] = next.splice(from, 1);
    if (!item) return;
    next.splice(to, 0, item);
    setQueue(next); queueRef.current = next;
    if (idxRef.current === from) { setCurrentIndex(to); idxRef.current = to; }
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    const next = queueRef.current.filter((_, i) => i !== index);
    setQueue(next); queueRef.current = next;
    if (index < idxRef.current) { setCurrentIndex(idxRef.current - 1); idxRef.current -= 1; }
    if (index === idxRef.current && next.length) {
      const newIdx = Math.min(idxRef.current, next.length - 1);
      setCurrentIndex(newIdx); idxRef.current = newIdx;
      loadTrack(next[newIdx]).catch(() => {});
    }
  }, [loadTrack]);

  const playQueueAt = useCallback(async (index: number) => {
    const q = queueRef.current;
    if (!q[index]) return;
    setCurrentIndex(index); idxRef.current = index;
    await loadTrack(q[index]);
  }, [loadTrack]);

  const clearQueue = useCallback(() => {
    setQueue([]); queueRef.current = [];
    setCurrentIndex(-1); idxRef.current = -1;
  }, []);

  const createPlaylist = useCallback(async (name: string): Promise<Playlist> => {
    const pl: Playlist = {
      id: `pl_${Date.now()}`, name: name.trim() || 'Nova playlist',
      trackIds: [], tracks: [], createdAt: Date.now(), updatedAt: Date.now(),
    };
    const next = [pl, ...playlists];
    setPlaylistsState(next); await savePlaylists(next);
    return pl;
  }, [playlists]);

  const addTrackToPlaylist = useCallback(async (playlistId: string, track: Track) => {
    const pl = playlists.find((x) => x.id === playlistId);
    if (!pl || pl.trackIds.includes(track.videoId)) return;
    const next = playlists.map((x) => x.id === playlistId ? {
      ...x,
      trackIds: [...x.trackIds, track.videoId],
      tracks: [...x.tracks, track],
      updatedAt: Date.now(),
    } : x);
    setPlaylistsState(next); await savePlaylists(next);
  }, [playlists]);

  const removeFromPlaylist = useCallback(async (playlistId: string, videoId: string) => {
    const next = playlists.map((x) => x.id === playlistId ? {
      ...x, trackIds: x.trackIds.filter((id) => id !== videoId),
      tracks: x.tracks.filter((t) => t.videoId !== videoId),
      updatedAt: Date.now(),
    } : x);
    setPlaylistsState(next); await savePlaylists(next);
  }, [playlists]);

  const deletePlaylist = useCallback(async (id: string) => {
    const next = playlists.filter((x) => x.id !== id);
    setPlaylistsState(next); await savePlaylists(next);
  }, [playlists]);

  const renamePlaylist = useCallback(async (id: string, name: string) => {
    const next = playlists.map((x) => x.id === id ? { ...x, name: name.trim() || x.name, updatedAt: Date.now() } : x);
    setPlaylistsState(next); await savePlaylists(next);
  }, [playlists]);

  const toggleAlbumInLibrary = useCallback(async (browseId: string) => {
    const exists = libAlbums.includes(browseId);
    const next = exists ? libAlbums.filter((x) => x !== browseId) : [...libAlbums, browseId];
    setLibAlbumsState(next); await setLibAlbums(next);
  }, [libAlbums]);

  const clearHistoryAll = useCallback(async () => { await clearHistory(); }, []);

  const downloadTrackOffline = useCallback(async (track: Track) => {
    const videoUrl = track.videoUrl || (await resolveStream(track.videoId));
    if (!videoUrl) return;
    const filename = `${track.videoId}.m4a`;
    const localUri = FileSystem.documentDirectory! + filename;
    try {
      const dl = FileSystem.createDownloadResumable(
        videoUrl, localUri, {},
        (p) => {
          const v = p.totalBytesExpectedToWrite ? p.totalBytesWritten / p.totalBytesExpectedToWrite : 0;
          setDownloadProgress((prev) => ({ ...prev, [track.videoId]: v }));
        }
      );
      const result = await dl.downloadAsync();
      if (result) {
        await AsyncStorage.setItem(`@track_offline_${track.videoId}`, JSON.stringify({ ...track, localUri: result.uri }));
        setDownloadedTracks((prev) => {
          const nextList = prev.includes(track.videoId) ? prev : [...prev, track.videoId];
          AsyncStorage.setItem('@yt_offline_tracks', JSON.stringify(nextList)).catch(() => {});
          return nextList;
        });
      }
    } catch {}
  }, []);

  const deleteOfflineTrack = useCallback(async (trackId: string) => {
    try {
      await FileSystem.deleteAsync(FileSystem.documentDirectory! + `${trackId}.m4a`, { idempotent: true });
      await AsyncStorage.removeItem(`@track_offline_${trackId}`);
      setDownloadedTracks((prev) => {
        const nextList = prev.filter((id) => id !== trackId);
        AsyncStorage.setItem('@yt_offline_tracks', JSON.stringify(nextList)).catch(() => {});
        return nextList;
      });
    } catch {}
  }, []);

  return (
    <AudioContext.Provider
      value={{
        currentTrack, queue, currentIndex, isPlaying, currentTime, duration,
        shuffle, repeat, volume, rate, sleepTimerMin, likes, dislikes,
        playlists, libAlbums, downloadProgress, downloadedTracks, loadingId,
        playTrack, playTracks, togglePlay, next, prev, seek,
        toggleShuffle, cycleRepeat, setVolumeState, setRateState, setSleepTimer,
        toggleLike, toggleDislike, addToQueue, moveInQueue, removeFromQueue,
        playQueueAt, clearQueue, createPlaylist, addTrackToPlaylist,
        removeFromPlaylist, deletePlaylist, renamePlaylist,
        toggleAlbumInLibrary, clearHistoryAll,
        downloadTrackOffline, deleteOfflineTrack, getOfflineTrack,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export const useAudio = () => {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudio precisa ser usado dentro de YTMobileAudioProvider');
  return ctx;
};
