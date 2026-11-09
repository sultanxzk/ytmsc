// Driver KV — Upstash Redis (REST) com fallback em memória para dev local.
// Em produção (Vercel) configure: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// (criar grátis em https://upstash.com/redis e colar nas env vars da Vercel).
import { Redis } from "@upstash/redis";

let _redis = null;
let _warned = false;

function getRedis() {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    _redis = new Redis({ url, token });
    return _redis;
  }
  if (!_warned) {
    _warned = true;
    console.warn("[kv] UPSTASH_REDIS_REST_URL/TOKEN não configurados — usando memória (NÃO persiste entre deploys). Configure no Vercel para sync cross-device.");
  }
  return null;
}

const mem = globalThis.__ytm_kv_mem ?? (globalThis.__ytm_kv_mem = new Map());

export async function kvGet(key) {
  const r = getRedis();
  if (r) return r.get(key);
  return mem.has(key) ? mem.get(key) : null;
}

export async function kvSet(key, value, opts = {}) {
  const r = getRedis();
  if (r) {
    if (opts.ex) return r.set(key, value, { ex: opts.ex });
    return r.set(key, value);
  }
  mem.set(key, value);
  return "OK";
}

export async function kvDel(key) {
  const r = getRedis();
  if (r) return r.del(key);
  mem.delete(key);
  return 1;
}

export async function kvKeys(pattern) {
  const r = getRedis();
  if (r) return r.keys(pattern);
  const re = new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  return [...mem.keys()].filter((k) => re.test(k));
}
