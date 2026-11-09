import AsyncStorage from '@react-native-async-storage/async-storage';
import { DB, hashEmail, type DBUser } from './database';
import { API_BASE } from './api';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  photo: string | null;
  initials: string;
  plan: string;
  provider: 'email' | 'google';
  passwordSet: boolean;
  createdAt: number;
}

const TOKEN_KEY = '@ytm_auth_token';
const initialsFor = (name?: string | null) =>
  String(name || 'U').trim().split(/\s+/).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
const genSalt = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

async function fetchJSON(url: string, opts: RequestInit = {}) {
  const r = await fetch(url, { ...opts, headers: { accept: 'application/json', ...(opts.headers || {}) } });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}`);
  return json;
}

export async function getToken() {
  try { return await AsyncStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export async function setToken(t: string | null) {
  try {
    if (t) await AsyncStorage.setItem(TOKEN_KEY, t);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export async function authFetch(action: string, payload: Record<string, any> = {}) {
  const json = await fetchJSON(`${API_BASE}/api/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  if (json?.token) await setToken(json.token);
  // espelha no banco local para o app continuar offline
  if (json?.user?.id && json?.user?.email) {
    await DB.saveUser({
      id: json.user.id,
      name: json.user.name,
      email: json.user.email,
      passwordHash: json.user.passwordSet ? 'remote' : null,
      passwordSalt: null,
      photo: json.user.photo || null,
      initials: json.user.initials || initialsFor(json.user.name),
      plan: json.user.plan || 'Premium',
      provider: json.user.provider || 'email',
      createdAt: json.user.createdAt || Date.now(),
    } as DBUser);
    await DB.setSessionUserId(json.user.id);
  }
  return json;
}

export async function me() {
  const token = await getToken();
  if (!token) return null;
  try {
    const json = await fetchJSON(`${API_BASE}/api/auth`, { headers: { authorization: `Bearer ${token}` } });
    return json?.user || null;
  } catch {
    await setToken(null);
    return null;
  }
}

export async function logoutFetch() {
  const token = await getToken();
  await setToken(null);
  if (token) {
    try {
      await fetch(`${API_BASE}/api/auth`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
    } catch {}
  }
}

export async function syncGet(store: string) {
  const token = await getToken();
  if (!token) return null;
  try {
    const json = await fetchJSON(`${API_BASE}/api/sync?store=${encodeURIComponent(store)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    return json?.data ?? null;
  } catch { return null; }
}

export async function syncPut(store: string, data: any) {
  const token = await getToken();
  if (!token) return false;
  try {
    await fetchJSON(`${API_BASE}/api/sync`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ store, data }),
    });
    return true;
  } catch { return false; }
}

export async function syncAll() {
  const token = await getToken();
  if (!token) return null;
  try {
    return await fetchJSON(`${API_BASE}/api/sync`, { headers: { authorization: `Bearer ${token}` } });
  } catch { return null; }
}

// Compat: o provider usava DB local — agora tudo passa pelo servidor salvo offline
export { DB, hashEmail };
export { initialsFor, isValidEmail, genSalt };
