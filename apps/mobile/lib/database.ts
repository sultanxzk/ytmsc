// Camada de persistência mobile — AsyncStorage (sem dependências externas).
// Mesma forma do web src/db/database.js (IndexedDB), porém adaptada para RN.
// Stores: users/session/playlists/likes/history/settings/subscriptions/libraryAlbums/trackCache
// Hash SHA-256 via crypto.subtle quando disponível, fallback FNV-1a (igual web).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type StoreName =
  | 'users'
  | 'session'
  | 'playlists'
  | 'likes'
  | 'history'
  | 'settings'
  | 'subscriptions'
  | 'libraryAlbums'
  | 'trackCache';

const STORES: StoreName[] = [
  'users',
  'session',
  'playlists',
  'likes',
  'history',
  'settings',
  'subscriptions',
  'libraryAlbums',
  'trackCache',
];

const HISTORY_CAP = 500;
const KEY_PREFIX = '@yt_db_';

function key(store: StoreName, id: string) {
  return `${KEY_PREFIX}${store}_${id}`;
}
function idxKey(store: StoreName, index: string, value: string) {
  return `${KEY_PREFIX}${store}_idx_${index}_${value}`;
}

async function getJSON<T>(k: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
async function setJSON(k: string, v: unknown) {
  try {
    await AsyncStorage.setItem(k, JSON.stringify(v));
  } catch {}
}
async function removeKey(k: string) {
  try {
    await AsyncStorage.removeItem(k);
  } catch {}
}

// Índice auxiliar (listagem por userId sem getAllKeys varredura pesada na web)
async function addToIndex(store: StoreName, index: string, value: string, id: string) {
  const k = idxKey(store, index, value);
  const cur = (await getJSON<string[]>(k)) || [];
  if (!cur.includes(id)) {
    await setJSON(k, [...cur, id]);
  }
}
async function removeFromIndex(store: StoreName, index: string, value: string, id: string) {
  const k = idxKey(store, index, value);
  const cur = (await getJSON<string[]>(k)) || [];
  await setJSON(k, cur.filter((x) => x !== id));
}

function structuredCloneSafe<T>(value: T): T {
  try {
    // RN tem performance mais baixa com structuredClone em alguns casos, usa JSON
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return value;
  }
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function hashPassword(password: string, salt?: string): Promise<string> {
  const secret = `${salt || ''}::${password}`;
  // RN 0.76 tem expo-crypto — tentamos Web Crypto (web), senão FNV-1a de 64 bits
  try {
    // @ts-ignore — globalCrypto pode não existir em RN antigo
    if (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.subtle) {
      const buf = await (globalThis as any).crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
      return [...new Uint8Array(buf)].map((b: number) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {}
  // fallback FNV-1a 64 bits (2 x 32 bits) — mesma ideia do web
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < secret.length; i++) {
    const c = secret.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 16777619) >>> 0;
  }
  return `fb_${h1.toString(16)}_${h2.toString(16)}`;
}

export const hashEmail = (email?: string | null) => String(email || '').trim().toLowerCase();

export interface DBUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  passwordSalt: string | null;
  photo: string | null;
  initials: string;
  plan: string;
  provider: 'email' | 'google';
  createdAt: number;
}

export const DB = {
  async init() {
    // noop — AsyncStorage já pronto
  },

  // ----- users -----
  async listUsers(): Promise<DBUser[]> {
    return safe(async () => {
      // No RN não há scan de todas as chaves de forma confiável entre versões.
      // Mantemos um índice @yt_db_users_list
      const ids = (await getJSON<string[]>(`${KEY_PREFIX}users_list`)) || [];
      const out: DBUser[] = [];
      for (const id of ids) {
        const u = await getJSON<DBUser>(key('users', id));
        if (u) out.push(u);
      }
      return out;
    }, []);
  },
  async getUserByEmail(email: string): Promise<DBUser | null> {
    const safeEmail = hashEmail(email);
    return safe(async () => {
      const users = await this.listUsers();
      return users.find((u) => hashEmail(u.email) === safeEmail) ?? null;
    }, null);
  },
  async saveUser(user: DBUser) {
    if (!user?.id) return null;
    return safe(async () => {
      await setJSON(key('users', user.id), structuredCloneSafe(user));
      const ids = (await getJSON<string[]>(`${KEY_PREFIX}users_list`)) || [];
      if (!ids.includes(user.id)) await setJSON(`${KEY_PREFIX}users_list`, [...ids, user.id]);
      return user;
    }, null);
  },
  async deleteUser(id: string) {
    return safe(async () => {
      await removeKey(key('users', id));
      const ids = (await getJSON<string[]>(`${KEY_PREFIX}users_list`)) || [];
      await setJSON(`${KEY_PREFIX}users_list`, ids.filter((x) => x !== id));
      return true;
    }, false);
  },
  async hashPassword(password: string, salt?: string) {
    return hashPassword(password, salt);
  },

  // ----- session -----
  async getSessionUserId(): Promise<string | null> {
    return safe(async () => {
      const rec = await getJSON<{ id: string; userId: string }>(key('session', 'current'));
      return rec?.userId ?? null;
    }, null);
  },
  async setSessionUserId(userId: string | null) {
    return safe(async () => {
      if (userId == null) await removeKey(key('session', 'current'));
      else await setJSON(key('session', 'current'), { id: 'current', userId });
      return true;
    }, false);
  },

  // ----- likes -----
  async getLikes(userId: string): Promise<string[]> {
    if (!userId) return [];
    return safe(async () => {
      const rec = await getJSON<{ trackIds: string[] }>(key('likes', userId));
      return Array.isArray(rec?.trackIds) ? rec.trackIds : [];
    }, []);
  },
  async setLikes(userId: string, ids: string[]) {
    if (!userId) return false;
    return safe(async () => {
      await setJSON(key('likes', userId), { id: userId, trackIds: Array.isArray(ids) ? ids : [] });
      return true;
    }, false);
  },

  // ----- playlists -----
  async listPlaylists(userId: string) {
    if (!userId) return [];
    return safe(async () => {
      const ids = (await getJSON<string[]>(idxKey('playlists', 'userId', userId))) || [];
      const out = [];
      for (const id of ids) {
        const pl = await getJSON<any>(key('playlists', id));
        if (pl && pl.userId === userId) out.push(pl);
      }
      return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }, []);
  },
  async savePlaylist(pl: any) {
    if (!pl?.id) return null;
    return safe(async () => {
      const prev = await getJSON<any>(key('playlists', pl.id));
      if (prev?.userId && prev.userId !== pl.userId) {
        // troca de dono — atualiza índices
        await removeFromIndex('playlists', 'userId', prev.userId, pl.id);
      }
      await setJSON(key('playlists', pl.id), structuredCloneSafe(pl));
      await addToIndex('playlists', 'userId', pl.userId, pl.id);
      return pl;
    }, null);
  },
  async deletePlaylist(id: string, userId?: string) {
    return safe(async () => {
      const rec = await getJSON<any>(key('playlists', id));
      if (!rec) return false;
      if (userId && rec.userId !== userId) return false;
      await removeKey(key('playlists', id));
      if (rec.userId) await removeFromIndex('playlists', 'userId', rec.userId, id);
      return true;
    }, false);
  },

  // ----- history -----
  async getHistory(userId: string, limit?: number) {
    if (!userId) return [];
    return safe(async () => {
      const rec = await getJSON<{ entries: Array<{ videoId: string; playedAt: number }> }>(key('history', userId));
      const entries = Array.isArray(rec?.entries) ? rec.entries : [];
      return typeof limit === 'number' ? entries.slice(0, limit) : entries;
    }, []);
  },
  async addHistory(userId: string, videoId: string) {
    if (!userId || !videoId) return false;
    return safe(async () => {
      const rec = await getJSON<{ entries: Array<{ videoId: string; playedAt: number }> }>(key('history', userId));
      const entries = Array.isArray(rec?.entries) ? rec.entries : [];
      const next = [
        { videoId, playedAt: Date.now() },
        ...entries.filter((e) => e?.videoId !== videoId),
      ].slice(0, HISTORY_CAP);
      await setJSON(key('history', userId), { id: userId, entries: next });
      return true;
    }, false);
  },
  async clearHistory(userId: string) {
    if (!userId) return false;
    return safe(async () => {
      await removeKey(key('history', userId));
      return true;
    }, false);
  },

  // ----- settings -----
  async getSettings(userId: string) {
    if (!userId) return null;
    return safe(async () => {
      const rec = await getJSON<{ data: any }>(key('settings', userId));
      return rec?.data ?? null;
    }, null);
  },
  async saveSettings(userId: string, data: any) {
    if (!userId) return false;
    return safe(async () => {
      await setJSON(key('settings', userId), { id: userId, data: data ?? {} });
      return true;
    }, false);
  },

  // ----- subscriptions -----
  async getSubs(userId: string) {
    if (!userId) return [];
    return safe(async () => {
      const rec = await getJSON<{ list: any[] }>(key('subscriptions', userId));
      return Array.isArray(rec?.list) ? rec.list : [];
    }, []);
  },
  async setSubs(userId: string, list: any[]) {
    if (!userId) return false;
    return safe(async () => {
      await setJSON(key('subscriptions', userId), { id: userId, list: Array.isArray(list) ? list : [] });
      return true;
    }, false);
  },

  // ----- libraryAlbums -----
  async getLibraryAlbums(userId: string) {
    if (!userId) return [];
    return safe(async () => {
      const rec = await getJSON<{ ids: string[] }>(key('libraryAlbums', userId));
      return Array.isArray(rec?.ids) ? rec.ids : [];
    }, []);
  },
  async setLibraryAlbums(userId: string, ids: string[]) {
    if (!userId) return false;
    return safe(async () => {
      await setJSON(key('libraryAlbums', userId), { id: userId, ids: Array.isArray(ids) ? ids : [] });
      return true;
    }, false);
  },

  // ----- trackCache -----
  async cacheTracks(tracks: any[], userId?: string | null) {
    const list = Array.isArray(tracks) ? tracks : [];
    return safe(async () => {
      for (const t of list) {
        const videoId = t?.videoId || t?.id;
        if (!videoId || typeof t !== 'object') continue;
        const scope = userId || t.userId || 'public';
        const record = { ...structuredCloneSafe(t), id: `${scope}:${videoId}`, userId: scope, videoId: String(videoId) };
        await setJSON(key('trackCache', `${scope}:${videoId}`), record);
      }
      return true;
    }, false);
  },
  async getCachedTrack(videoId: string, userId?: string | null) {
    if (!videoId) return null;
    return safe(async () => {
      const scope = userId || 'public';
      return (await getJSON(key('trackCache', `${scope}:${videoId}`))) ?? (await getJSON(key('trackCache', String(videoId)))) ?? null;
    }, null);
  },
};
