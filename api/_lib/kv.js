// Driver KV — Upstash Redis (REST) com fallback em memória.
// Import dinâmico para nunca quebrar a function se a dep estiver faltando no runtime.
let _redis = null;
let _warned = false;
let _redisFailed = false;

async function getRedis() {
  if (_redis) return _redis;
  if (_redisFailed) return null;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!_warned) {
      _warned = true;
      console.warn("[kv] UPSTASH_REDIS_REST_URL/TOKEN não configurados — usando memória (NÃO persiste entre deploys).");
    }
    return null;
  }
  try {
    const { Redis } = await import("@upstash/redis");
    _redis = new Redis({ url, token });
    return _redis;
  } catch (e) {
    _redisFailed = true;
    console.warn("[kv] @upstash/redis falhou, usando memória:", String(e?.message || e));
    return null;
  }
}

// mapa global para sobrevivência entre invocations do mesmo processo
const mem = globalThis.__ytm_kv_mem ?? (globalThis.__ytm_kv_mem = new Map());

export async function kvGet(key) {
  const r = await getRedis();
  if (r) {
    try { return await r.get(key); } catch { return mem.has(key) ? mem.get(key) : null; }
  }
  return mem.has(key) ? mem.get(key) : null;
}

export async function kvSet(key, value, opts = {}) {
  mem.set(key, value);
  const r = await getRedis();
  if (r) {
    try {
      if (opts.ex) return await r.set(key, value, { ex: opts.ex });
      return await r.set(key, value);
    } catch {}
  }
  return "OK";
}

export async function kvDel(key) {
  mem.delete(key);
  const r = await getRedis();
  if (r) { try { return await r.del(key); } catch {} }
  return 1;
}

export async function kvKeys(pattern) {
  const r = await getRedis();
  if (r) {
    try { return await r.keys(pattern); } catch {}
  }
  const re = new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  return [...mem.keys()].filter((k) => re.test(k));
}
