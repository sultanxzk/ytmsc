// GET /api/music/stream?id=VIDEO_ID          → JSON { streamUrl (proxy), via }
// GET /api/music/stream?id=VIDEO_ID&proxy=1   → streams audio bytes directly (for ExoPlayer)
//
// Estratégia multi-client:
//  1) Innertube ANDROID_VR  → URLs diretas (itag 140 audio/mp4, itag 251 opus)
//  2) Innertube ANDROID     → muxado itag 18 (mp4 com áudio)
//  3) Fallback Piped API
//
// O modo proxy faz fetch no Vercel (mesmo IP que resolveu o stream) e encaminha
// os bytes diretamente ao ExoPlayer, eliminando o erro 403.
import { handleOptions, sendJSON, setCors, resolveBestAudio } from "../innertube.js";

const PIPED = [
  "https://api.piped.private.coffee",
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
];

async function viaPiped(id) {
  for (const base of PIPED) {
    try {
      const response = await fetch(`${base}/streams/${id}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) continue;
      const data = await response.json();
      const pick =
        (data.audioStreams || []).find((f) => f.url) ||
        (data.videoStreams || []).find(
          (f) => /\.(mp4|webm)/i.test(f.url || "") && f.url
        );
      if (pick?.url) return { url: pick.url, mimeType: pick.mimeType || "audio/mp4", userAgent: null, via: "piped" };
    } catch {
      continue;
    }
  }
  return null;
}

// Cache de resolução de áudio por videoId (TTL ~10 min em memória)
const _audioCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

async function resolveAudio(id) {
  const cached = _audioCache.get(id);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.result;

  let result = await resolveBestAudio(id).catch(() => null);
  if (!result) {
    result = await viaPiped(id).catch(() => null);
  }
  if (result) {
    _audioCache.set(id, { result, ts: Date.now() });
    // Limpa cache antigo periodicamente
    if (_audioCache.size > 200) {
      const now = Date.now();
      for (const [k, v] of _audioCache) {
        if (now - v.ts > CACHE_TTL) _audioCache.delete(k);
      }
    }
  }
  return result;
}

// Proxy streaming: busca os bytes do googlevideo.com no Vercel e encaminha ao cliente.
async function proxyStream(req, res, id) {
  const audio = await resolveAudio(id);
  if (!audio?.url) {
    return sendJSON(res, 404, { error: "Não foi possível resolver o stream de áudio." });
  }

  // Prepara headers para upstream
  const upstreamHeaders = {};
  if (audio.userAgent) upstreamHeaders["User-Agent"] = audio.userAgent;
  // YouTube frequently returns 403 for an unbounded request. ExoPlayer may
  // start without Range, so force a byte-range request and keep seeking working.
  upstreamHeaders["Range"] = req.headers.range || "bytes=0-";

  let upstream;
  try {
    upstream = await fetch(audio.url, {
      headers: upstreamHeaders,
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    // Se o URL expirou ou falhou, limpa cache e tenta novamente
    _audioCache.delete(id);
    const retry = await resolveAudio(id);
    if (!retry?.url) {
      return sendJSON(res, 502, { error: "Upstream stream indisponível.", details: e.message });
    }
    const retryHeaders = {};
    if (retry.userAgent) retryHeaders["User-Agent"] = retry.userAgent;
    if (req.headers.range) retryHeaders["Range"] = req.headers.range;
    try {
      upstream = await fetch(retry.url, {
        headers: retryHeaders,
        redirect: "follow",
        signal: AbortSignal.timeout(30000),
      });
    } catch (e2) {
      return sendJSON(res, 502, { error: "Upstream stream indisponível.", details: e2.message });
    }
  }

  if (!upstream.ok && upstream.status !== 206) {
    // Se 403, limpa cache e tenta com novo resolve
    if (upstream.status === 403) {
      _audioCache.delete(id);
      const retry = await resolveAudio(id);
      if (retry?.url) {
        const retryHeaders = {};
        if (retry.userAgent) retryHeaders["User-Agent"] = retry.userAgent;
        if (req.headers.range) retryHeaders["Range"] = req.headers.range;
        try {
          upstream = await fetch(retry.url, {
            headers: retryHeaders,
            redirect: "follow",
            signal: AbortSignal.timeout(30000),
          });
        } catch {}
      }
    }
    if (!upstream.ok && upstream.status !== 206) {
      return sendJSON(res, upstream.status || 502, {
        error: `Upstream retornou ${upstream.status}.`,
      });
    }
  }

  // Configura headers de resposta
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Range");
  res.setHeader("Access-Control-Expose-Headers", "Content-Range,Content-Length,Accept-Ranges");
  res.setHeader("Accept-Ranges", "bytes");

  const ct = upstream.headers.get("content-type") || audio.mimeType || "audio/mp4";
  res.setHeader("Content-Type", ct);

  if (upstream.headers.get("content-length")) {
    res.setHeader("Content-Length", upstream.headers.get("content-length"));
  }
  const clientRequestedRange = Boolean(req.headers.range);
  if (clientRequestedRange && upstream.headers.get("content-range")) {
    res.setHeader("Content-Range", upstream.headers.get("content-range"));
  }

  // When ExoPlayer starts without Range, present the complete proxied body as
  // a normal 200 response. Some ExoPlayer versions reject an initial 206 whose
  // Content-Range covers the whole file.
  res.statusCode = clientRequestedRange ? upstream.status : 200; // 200 or 206

  // Cache: permite cache no edge por 5 min
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");

  // status already set above; keep Content-Length from upstream.

  // Stream os bytes
  if (!upstream.body) {
    // fallback para ArrayBuffer se body stream não disponível
    try {
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.end(buf);
    } catch {
      res.end();
    }
    return;
  }

  // Node.js Readable from Web ReadableStream
  const reader = upstream.body.getReader();
  const pump = async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); return; }
        const ok = res.write(Buffer.from(value));
        if (!ok) {
          await new Promise((resolve) => res.once("drain", resolve));
        }
      }
    } catch {
      res.end();
    }
  };

  // Se o cliente desconectar, aborta o reader
  res.on("close", () => {
    reader.cancel().catch(() => {});
  });

  await pump();
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);
  if (req.method === "HEAD") {
    // HEAD para proxy também
    const isProxy = req.query?.proxy === "1" || req.query?.action === "stream";
    if (isProxy) {
      const id = String(req.query?.id || "").trim();
      if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
        res.statusCode = 400;
        return res.end();
      }
      const audio = await resolveAudio(id);
      if (!audio?.url) { res.statusCode = 404; return res.end(); }
      res.setHeader("Content-Type", audio.mimeType || "audio/mp4");
      res.setHeader("Accept-Ranges", "bytes");
      res.statusCode = 200;
      return res.end();
    }
  }
  if (req.method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });

  const id = String(req.query?.id || "").trim();
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return sendJSON(res, 400, { error: "O parâmetro id (videoId) é obrigatório." });
  }

  // Modo proxy: streams bytes diretamente ao ExoPlayer
  const isProxy = req.query?.proxy === "1" || req.query?.action === "stream";
  if (isProxy) {
    return proxyStream(req, res, id);
  }

  // Modo JSON: retorna URL do proxy para o app usar
  try {
    const audio = await resolveAudio(id);
    if (audio?.url) {
      // Retorna URL do proxy — o app mobile faz GET nessa URL e recebe os bytes
      const host = req.headers?.host || "ytmsc.vercel.app";
      const proto = req.headers?.["x-forwarded-proto"] || "https";
      const proxyUrl = `${proto}://${host}/api/music/stream?id=${encodeURIComponent(id)}&proxy=1`;
      return sendJSON(res, 200, {
        streamUrl: proxyUrl,
        directUrl: audio.url,
        via: audio.via || "innertube",
      });
    }

    return sendJSON(res, 404, {
      error: "Não foi possível extrair a stream de mídia para este ID.",
    });
  } catch (error) {
    return sendJSON(res, 500, {
      error: "Erro interno ao processar a stream de mídia.",
      details: String(error?.message || error),
    });
  }
}
