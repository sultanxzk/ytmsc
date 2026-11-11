// GET /api/sync → todos os stores do usuário autenticado (Bearer)
// PUT /api/sync { store, data } → salva um store
// Stores sincronizados: likes, playlists, history, settings, subscriptions, libraryAlbums, trackCache
import { kvGet, kvSet } from "../kv.js";
import { handleOptions, sendJSON, setCors } from "../innertube.js";
import { userIdFromToken } from "./auth.js";

const STORES = ["likes", "playlists", "history", "settings", "subscriptions", "libraryAlbums", "trackCache", "downloads"];
const CAPS = { trackCache: 200, history: 500 };

function cap(store, data) {
  const c = CAPS[store];
  if (!c) return data;
  if (Array.isArray(data)) return data.slice(0, c);
  if (data && Array.isArray(data.entries)) return { ...data, entries: data.entries.slice(0, c) };
  if (data && typeof data === "object") {
    const keys = Object.keys(data);
    if (keys.length > c) return Object.fromEntries(keys.slice(0, c).map((k) => [k, data[k]]));
  }
  return data;
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);

  const userId = await userIdFromToken(req);
  if (!userId) return sendJSON(res, 401, { error: "Não autenticado." });

  try {
    if (req.method === "GET") {
      const store = String(req.query?.store || "");
      if (store) {
        if (!STORES.includes(store)) return sendJSON(res, 400, { error: "Store inválida." });
        const data = (await kvGet(`sync:${userId}:${store}`)) ?? null;
        return sendJSON(res, 200, { store, data });
      }
      const out = {};
      for (const s of STORES) out[s] = (await kvGet(`sync:${userId}:${s}`)) ?? null;
      return sendJSON(res, 200, out);
    }

    if (req.method === "PUT") {
      const { store, data } = req.body || {};
      if (!STORES.includes(String(store))) return sendJSON(res, 400, { error: "Store inválida." });
      await kvSet(`sync:${userId}:${store}`, cap(store, data ?? null));
      return sendJSON(res, 200, { ok: true, store });
    }

    return sendJSON(res, 405, { error: "Method Not Allowed" });
  } catch (e) {
    return sendJSON(res, 500, { error: "Erro de sincronização.", details: String(e?.message || e) });
  }
}
