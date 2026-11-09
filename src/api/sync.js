// Sync web ↔ mobile — mesmo contrato HTTP do mobile (apps/mobile/lib/api.ts).
// Usa VITE_API_URL como base, igual src/api/musicApi.js.
const API_BASE = (import.meta.env?.VITE_API_URL || "").replace(/\/$/, "");
const api = (path) => `${API_BASE}${path}`;

const TOKEN_KEY = "ytm_auth_token";

const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
};
export const getTokenSync = getToken;

async function fetchJSON(url, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: { accept: "application/json", ...(opts.headers || {}) },
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}`);
  return json;
}

export async function authFetch(action, payload = {}) {
  const json = await fetchJSON(api("/api/auth"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  if (json?.token) setToken(json.token);
  return json;
}

export async function me() {
  const token = getToken();
  if (!token) return null;
  try {
    const json = await fetchJSON(api("/api/auth"), { headers: { authorization: `Bearer ${token}` } });
    return json?.user || null;
  } catch {
    setToken(null);
    return null;
  }
}

export async function logoutFetch() {
  const token = getToken();
  setToken(null);
  if (!token) return;
  try {
    await fetch(api("/api/auth"), { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
  } catch {}
}

export async function syncGet(store) {
  const token = getToken();
  if (!token) return null;
  try {
    const json = await fetchJSON(api(`/api/sync?store=${encodeURIComponent(store)}`), { headers: { authorization: `Bearer ${token}` } });
    return json?.data ?? null;
  } catch {
    return null;
  }
}

export async function syncPut(store, data) {
  const token = getToken();
  if (!token) return false;
  try {
    await fetchJSON(api("/api/sync"), {
      method: "PUT",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ store, data }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function syncAll() {
  const token = getToken();
  if (!token) return null;
  try {
    const json = await fetchJSON(api("/api/sync"), { headers: { authorization: `Bearer ${token}` } });
    return json;
  } catch {
    return null;
  }
}
