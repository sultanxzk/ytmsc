import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Track } from './api';

const K = {
  likes: '@yt_likes',
  dislikes: '@yt_dislikes',
  history: '@yt_history',
  playlists: '@yt_playlists',
  albums: '@yt_lib_albums',
  prefs: '@yt_prefs',
};

async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
async function setJSON(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export async function getLikes(): Promise<string[]> {
  return getJSON<string[]>(K.likes, []);
}
export async function setLikes(ids: string[]) {
  await setJSON(K.likes, ids);
}
export async function getDislikes(): Promise<string[]> {
  return getJSON<string[]>(K.dislikes, []);
}
export async function setDislikes(ids: string[]) {
  await setJSON(K.dislikes, ids);
}

export interface HistoryEntry {
  track: Track;
  playedAt: number;
}
export async function getHistory(limit = 100): Promise<HistoryEntry[]> {
  return getJSON<HistoryEntry[]>(K.history, []).then((h) => h.slice(0, limit));
}
export async function addHistory(track: Track) {
  const h = await getJSON<HistoryEntry[]>(K.history, []);
  const entry = { track, playedAt: Date.now() };
  const next = [entry, ...h.filter((e) => e.track.videoId !== track.videoId)].slice(0, 200);
  await setJSON(K.history, next);
}
export async function clearHistory() {
  await setJSON(K.history, []);
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
}
export async function getPlaylists(): Promise<Playlist[]> {
  return getJSON<Playlist[]>(K.playlists, []);
}
export async function savePlaylists(pls: Playlist[]) {
  await setJSON(K.playlists, pls);
}

export async function getLibAlbums(): Promise<string[]> {
  return getJSON<string[]>(K.albums, []);
}
export async function setLibAlbums(ids: string[]) {
  await setJSON(K.albums, ids);
}

export interface Prefs {
  volume: number;
  rate: number;
  sleepTimerMin: number | null;
  quality: 'high' | 'medium';
}
export const defaultPrefs: Prefs = { volume: 0.85, rate: 1, sleepTimerMin: null, quality: 'high' };
export async function getPrefs(): Promise<Prefs> {
  return { ...defaultPrefs, ...(await getJSON<Partial<Prefs>>(K.prefs, {})) };
}
export async function setPrefs(p: Prefs) {
  await setJSON(K.prefs, p);
}
