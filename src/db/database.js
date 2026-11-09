// Camada de persistência — IndexedDB (sem dependências externas).
// Fallback em memória (Map) quando IndexedDB não está disponível
// (SSR, modo privado, navegador antigo), para o app nunca quebrar.

const DB_NAME = "ytm-database";
const DB_VERSION = 2;

const STORES = [
  "users",
  "session",
  "playlists",
  "likes",
  "history",
  "settings",
  "subscriptions",
  "libraryAlbums",
  "trackCache",
];

const HISTORY_CAP = 500;

function structuredCloneSafe(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value ?? null));
  }
}

// ---------------------------------------------------------------------------
// Backend em memória (fallback)
// ---------------------------------------------------------------------------

function createMemoryBackend() {
  const data = new Map(STORES.map((name) => [name, new Map()]));

  const getStore = (name) => {
    if (!data.has(name)) data.set(name, new Map());
    return data.get(name);
  };

  return {
    async get(store, key) {
      return getStore(store).get(key) ?? null;
    },
    async put(store, record) {
      getStore(store).set(record.id, structuredCloneSafe(record));
      return record.id;
    },
    async delete(store, key) {
      getStore(store).delete(key);
    },
    async getAll(store) {
      return [...getStore(store).values()].map((v) => structuredCloneSafe(v));
    },
    async getAllByIndex(store, indexName, value) {
      const all = [...getStore(store).values()];
      return all.filter((v) => v?.[indexName] === value).map((v) => structuredCloneSafe(v));
    },
    async close() {},
  };
}

// ---------------------------------------------------------------------------
// Backend IndexedDB
// ---------------------------------------------------------------------------

function createIndexedDBBackend() {
  let dbPromise = null;

  const openDB = () => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          for (const store of STORES) {
            if (!db.objectStoreNames.contains(store)) {
              const os = db.createObjectStore(store, { keyPath: "id" });
              if (store === "playlists") os.createIndex("userId", "userId", { unique: false });
            }
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error("IndexedDB bloqueado"));
      });
      dbPromise.catch(() => {
        dbPromise = null;
      });
    }
    return dbPromise;
  };

  const withStore = async (storeName, mode, fn) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      let request;
      try {
        request = fn(tx.objectStore(storeName));
      } catch (err) {
        reject(err);
        return;
      }
      let settled = false;
      tx.oncomplete = () => {
        if (!settled) {
          settled = true;
          resolve(request?.result);
        }
      };
      tx.onerror = () => {
        if (!settled) {
          settled = true;
          reject(tx.error);
        }
      };
      tx.onabort = () => {
        if (!settled) {
          settled = true;
          reject(tx.error || new Error("Transação abortada"));
        }
      };
    });
  };

  return {
    async get(store, key) {
      return withStore(store, "readonly", (s) => s.get(key));
    },
    async put(store, record) {
      await withStore(store, "readwrite", (s) => s.put(record));
      return record.id;
    },
    async delete(store, key) {
      await withStore(store, "readwrite", (s) => s.delete(key));
    },
    async getAll(store) {
      return withStore(store, "readonly", (s) => s.getAll());
    },
    async getAllByIndex(store, indexName, value) {
      const all = await withStore(store, "readonly", (s) => {
        if (indexName === "userId" && s.indexNames.contains("userId")) {
          return s.index("userId").getAll(value);
        }
        return s.getAll();
      });
      const list = Array.isArray(all) ? all : [];
      if (indexName === "userId" && list.some((v) => v && typeof v === "object" && "userId" in v)) {
        return list.filter((v) => v.userId === value);
      }
      return list;
    },
    async close() {
      if (!dbPromise) return;
      try {
        const db = await dbPromise;
        db.close();
      } catch {}
      dbPromise = null;
    },
  };
}

// ---------------------------------------------------------------------------
// Seleção do backend
// ---------------------------------------------------------------------------

let backend = null;
let backendPromise = null;

function getBackend() {
  if (backend) return Promise.resolve(backend);
  if (backendPromise) return backendPromise;
  backendPromise = (async () => {
    if (typeof indexedDB !== "undefined" && indexedDB) {
      try {
        const idb = createIndexedDBBackend();
        await idb.getAll("users");
        backend = idb;
      } catch {
        backend = createMemoryBackend();
      }
    } else {
      backend = createMemoryBackend();
    }
    return backend;
  })();
  return backendPromise;
}

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Hash de senha (SHA-256 via Web Crypto, com fallback simples)
// ---------------------------------------------------------------------------

async function hashPassword(password, salt) {
  const secret = `${salt || ""}::${password}`;
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {}
  // fallback não-criptográfico (navegador muito antigo) — ainda oculta a senha
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < secret.length; i++) {
    const c = secret.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 16777619) >>> 0;
  }
  return `fb_${h1.toString(16)}_${h2.toString(16)}`;
}

export const hashEmail = (email) => String(email || "").trim().toLowerCase();

// ---------------------------------------------------------------------------
// API pública — DB
// ---------------------------------------------------------------------------

export const DB = {
  async init() {
    await getBackend();
  },

  // ----- users (senha sempre hasheada; nunca em claro) -----
  async listUsers() {
    return safe(async () => (await (await getBackend()).getAll("users")) ?? [], []);
  },
  async getUserByEmail(email) {
    const safeEmail = hashEmail(email);
    return safe(async () => {
      const users = await (await getBackend()).getAll("users");
      return users.find((u) => hashEmail(u?.email) === safeEmail) ?? null;
    }, null);
  },
  async saveUser(user) {
    if (!user?.id) return null;
    return safe(async () => {
      await (await getBackend()).put("users", user);
      return user;
    }, null);
  },
  async deleteUser(id) {
    return safe(async () => {
      await (await getBackend()).delete("users", id);
      return true;
    }, false);
  },
  async hashPassword(password, salt) {
    return hashPassword(password, salt);
  },

  // ----- session -----
  async getSessionUserId() {
    return safe(async () => {
      const rec = await (await getBackend()).get("session", "current");
      return rec?.userId ?? null;
    }, null);
  },
  async setSessionUserId(userId) {
    return safe(async () => {
      const b = await getBackend();
      if (userId == null) await b.delete("session", "current");
      else await b.put("session", { id: "current", userId });
      return true;
    }, false);
  },

  // ----- likes (isolado por userId) -----
  async getLikes(userId) {
    if (!userId) return [];
    return safe(async () => {
      const rec = await (await getBackend()).get("likes", userId);
      return Array.isArray(rec?.trackIds) ? rec.trackIds : [];
    }, []);
  },
  async setLikes(userId, ids) {
    if (!userId) return false;
    return safe(async () => {
      await (await getBackend()).put("likes", { id: userId, trackIds: Array.isArray(ids) ? ids : [] });
      return true;
    }, false);
  },

  // ----- playlists (isolado por userId) -----
  async listPlaylists(userId) {
    if (!userId) return [];
    return safe(async () => {
      const b = await getBackend();
      const all = await b.getAllByIndex("playlists", "userId", userId);
      return [...all].sort((a, b2) => (b2.updatedAt || 0) - (a.updatedAt || 0));
    }, []);
  },
  async savePlaylist(pl) {
    if (!pl?.id) return null;
    return safe(async () => {
      await (await getBackend()).put("playlists", pl);
      return pl;
    }, null);
  },
  async deletePlaylist(id, userId) {
    // apaga só se a playlist pertencer ao usuário (isolamento entre contas)
    return safe(async () => {
      const b = await getBackend();
      const rec = await b.get("playlists", id);
      if (!rec) return false;
      if (userId && rec.userId !== userId) return false;
      await b.delete("playlists", id);
      return true;
    }, false);
  },

  // ----- history (isolado por userId) -----
  async getHistory(userId, limit) {
    if (!userId) return [];
    return safe(async () => {
      const rec = await (await getBackend()).get("history", userId);
      const entries = Array.isArray(rec?.entries) ? rec.entries : [];
      return typeof limit === "number" ? entries.slice(0, limit) : entries;
    }, []);
  },
  async addHistory(userId, videoId) {
    if (!userId || !videoId) return false;
    return safe(async () => {
      const b = await getBackend();
      const rec = await b.get("history", userId);
      const entries = Array.isArray(rec?.entries) ? rec.entries : [];
      const next = [
        { videoId, playedAt: Date.now() },
        ...entries.filter((e) => e?.videoId !== videoId),
      ].slice(0, HISTORY_CAP);
      await b.put("history", { id: userId, entries: next });
      return true;
    }, false);
  },
  async clearHistory(userId) {
    if (!userId) return false;
    return safe(async () => {
      await (await getBackend()).delete("history", userId);
      return true;
    }, false);
  },

  // ----- settings / downloads (isolado por userId) -----
  async getSettings(userId) {
    if (!userId) return null;
    return safe(async () => {
      const rec = await (await getBackend()).get("settings", userId);
      return rec?.data ?? null;
    }, null);
  },
  async saveSettings(userId, data) {
    if (!userId) return false;
    return safe(async () => {
      await (await getBackend()).put("settings", { id: userId, data: data ?? {} });
      return true;
    }, false);
  },

  // ----- subscriptions (isolado por userId) -----
  async getSubs(userId) {
    if (!userId) return [];
    return safe(async () => {
      const rec = await (await getBackend()).get("subscriptions", userId);
      return Array.isArray(rec?.list) ? rec.list : [];
    }, []);
  },
  async setSubs(userId, list) {
    if (!userId) return false;
    return safe(async () => {
      await (await getBackend()).put("subscriptions", { id: userId, list: Array.isArray(list) ? list : [] });
      return true;
    }, false);
  },

  // ----- library albums (isolado por userId) -----
  async getLibraryAlbums(userId) {
    if (!userId) return [];
    return safe(async () => {
      const rec = await (await getBackend()).get("libraryAlbums", userId);
      return Array.isArray(rec?.ids) ? rec.ids : [];
    }, []);
  },
  async setLibraryAlbums(userId, ids) {
    if (!userId) return false;
    return safe(async () => {
      await (await getBackend()).put("libraryAlbums", { id: userId, ids: Array.isArray(ids) ? ids : [] });
      return true;
    }, false);
  },

  // ----- track cache (escopado por usuário: `${userId}:${videoId}`) -----
  async cacheTracks(tracks, userId) {
    const list = Array.isArray(tracks) ? tracks : [];
    return safe(async () => {
      const b = await getBackend();
      for (const t of list) {
        const videoId = t?.videoId || t?.id;
        if (!videoId || typeof t !== "object") continue;
        const scope = userId || t.userId || "public";
        const record = { ...t, id: `${scope}:${videoId}`, userId: scope, videoId: String(videoId) };
        await b.put("trackCache", record);
      }
      return true;
    }, false);
  },
  async getCachedTrack(videoId, userId) {
    if (!videoId) return null;
    return safe(async () => {
      const b = await getBackend();
      const scope = userId || "public";
      return (await b.get("trackCache", `${scope}:${videoId}`)) ?? (await b.get("trackCache", String(videoId))) ?? null;
    }, null);
  },
  async getCachedTracks(videoIds, userId) {
    const ids = Array.isArray(videoIds) ? videoIds : [];
    return safe(async () => {
      const b = await getBackend();
      const out = [];
      const scope = userId || "public";
      for (const id of ids) {
        const t = (await b.get("trackCache", `${scope}:${id}`)) ?? (await b.get("trackCache", String(id)));
        if (t) out.push(t);
      }
      return out;
    }, []);
  },
};

// ---------------------------------------------------------------------------
// Migração de localStorage legado (uma vez, idempotente)
// ---------------------------------------------------------------------------

const readLegacyJSON = (key) => {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export async function migrateLegacyLocalStorage() {
  try {
    if (typeof localStorage === "undefined") return;

    const b = await getBackend();

    const migratedRec = await b.get("session", "migrated");
    if (migratedRec?.value === true) return;

    const now = Date.now();

    // ytm-users → users
    const legacyUsers = readLegacyJSON("ytm-users");
    const users = Array.isArray(legacyUsers) ? legacyUsers : [];
    for (const u of users) {
      if (!u?.id) continue;
      await b.put("users", {
        id: u.id,
        name: u.name || "",
        email: u.email || "",
        password: "",
        passwordSalt: "",
        photo: u.photo ?? null,
        initials: u.initials || "",
        plan: u.plan || "Premium",
        createdAt: u.createdAt || now,
      });
    }

    // ytm-user → session
    const legacySession = readLegacyJSON("ytm-user");
    if (legacySession?.id) {
      await b.put("session", { id: "current", userId: legacySession.id });
    }

    // ytm-playlists → playlists
    const legacyPlaylists = readLegacyJSON("ytm-playlists");
    if (Array.isArray(legacyPlaylists)) {
      for (const pl of legacyPlaylists) {
        if (pl == null) continue;
        const id = pl.id != null ? String(pl.id) : `pl_${now}_${Math.random().toString(36).slice(2, 8)}`;
        await b.put("playlists", {
          id,
          userId: pl.userId || legacySession?.id || "local",
          name: pl.name || "Sem nome",
          description: pl.description || "",
          cover: pl.cover || null,
          trackIds: Array.isArray(pl.trackIds) ? pl.trackIds : [],
          createdAt: pl.createdAt || now,
          updatedAt: pl.updatedAt || now,
        });
      }
    }

    // ytm-liked → likes (do usuário da sessão legada, se houver)
    const legacyLiked = readLegacyJSON("ytm-liked");
    if (Array.isArray(legacyLiked) && legacyLiked.length) {
      const ownerId = legacySession?.id || users[0]?.id || "local";
      await b.put("likes", { id: ownerId, trackIds: legacyLiked });
    }

    await b.put("session", { id: "migrated", value: true });
    for (const key of ["ytm-users", "ytm-user", "ytm-playlists", "ytm-liked"]) {
      try {
        localStorage.removeItem(key);
      } catch {}
    }
  } catch {}
}
