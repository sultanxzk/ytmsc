// GET /api/stream?id=VIDEO_ID — resolve URL direta de mídia p/ app nativo (expo-av).
// Estratégia (em ordem):
//  1) Innertube via getBasicInfo (client ANDROID funciona; WEB/WEB_REMIX retornam UNPLAYABLE
//     no IP do datacenter da Vercel). Retorna googlevideo.com direto, sem depender de terceiros.
//  2) Fallback Invidious (instâncias públicas) — pode falhar se todas estiverem fora do ar.
//  3) Fallback Piped API.
import { handleOptions, sendJSON, setCors, getInnertube } from "../innertube.js";

const INVIDIOUS = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yewtu.be",
  "https://invidious.f5.si",
  "https://invidious.0011.lt",
  "https://iv.datura.network",
  "https://vid.puffyan.us",
  "https://invidious.emn178.win",
  "https://snopyta.org",
  "https://puffyan.us",
  "https://nerdvpn.de",
];

const PIPED = [
  "https://api.piped.private.coffee",
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
];

async function viaInnertube(id) {
  const it = await getInnertube();
  if (typeof it.getBasicInfo !== "function") return null;
  const bi = await it.getBasicInfo(id);
  if (bi.playability_status?.status && bi.playability_status.status !== "OK") return null;
  const sd = bi.streaming_data || {};
  // adaptiveFormats (nome padronizado pelo youtubei.js)
  const adapt = sd.adaptiveFormats || sd.adaptive_formats || [];
  const audio = adapt.find((f) => (f.mimeType || f.type || "").startsWith("audio/") && (f.url || f.cipher)) ||
    adapt.find((f) => f.url || f.cipher);
  if (audio) {
    if (audio.url) return audio.url;
    if (typeof audio.decipher === "function") {
      const d = await audio.decipher().catch(() => null);
      if (d?.url) return d.url;
    }
  }
  // formats (muxado mp4 com áudio+vídeo — serve para <audio>/expo-av)
  const mux = (sd.formats || []).find((f) => f.url);
  if (mux?.url) return mux.url;
  return null;
}

async function viaInvidious(id) {
  for (const instance of INVIDIOUS) {
    try {
      const response = await fetch(`${instance}/api/v1/videos/${id}`, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) continue;
      const data = await response.json();
      const adaptiveFormat = (data.adaptiveFormats || []).find(
        (format) => (format.type || "").startsWith("audio/") || format.container === "m4a"
      );
      if (adaptiveFormat?.url) return adaptiveFormat.url;
      const muxed = (data.formatStreams || []).find((f) => f.url);
      if (muxed?.url) return muxed.url;
    } catch {
      continue;
    }
  }
  return null;
}

async function viaPiped(id) {
  for (const base of PIPED) {
    try {
      const response = await fetch(`${base}/streams/${id}`, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) continue;
      const data = await response.json();
      const pick = (data.audioStreams || []).find((f) => f.url) ||
        (data.videoStreams || []).find((f) => /\.(mp4|webm)/i.test(f.url || "") && f.url);
      if (pick?.url) return pick.url;
    } catch {
      continue;
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);
  if (req.method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });

  const id = String(req.query?.id || "").trim();
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return sendJSON(res, 400, { error: "O parâmetro id (videoId) é obrigatório." });
  }

  try {
    const innertubeUrl = await viaInnertube(id).catch(() => null);
    if (innertubeUrl) return sendJSON(res, 200, { streamUrl: innertubeUrl, via: "innertube" });

    const invidiousUrl = await viaInvidious(id).catch(() => null);
    if (invidiousUrl) return sendJSON(res, 200, { streamUrl: invidiousUrl, via: "invidious" });

    const pipedUrl = await viaPiped(id).catch(() => null);
    if (pipedUrl) return sendJSON(res, 200, { streamUrl: pipedUrl, via: "piped" });

    return sendJSON(res, 404, { error: "Não foi possível extrair a stream de mídia para este ID." });
  } catch (error) {
    return sendJSON(res, 500, { error: "Erro interno ao processar a stream de mídia.", details: String(error?.message || error) });
  }
}
