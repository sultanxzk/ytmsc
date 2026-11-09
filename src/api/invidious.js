// Fallback de áudio via Invidious API (públicas, sem chave) + Piped.
// Quando o embed do YouTube bloqueia (101/150/100/2), pega o stream direto
// (.mp4/.webm) de uma instância e toca com <audio> nativo.
//
// Como as instâncias públicas caem/doam 403 frequentemente, tentamos várias
// em sequência (Invidious e Piped) antes de desistir e pular silencioso.

const INVIDIOUS = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yewtu.be",
  "https://invidious.f5.si",
  "https://invidious.0011.lt",
  "https://iv.datura.network",
  "https://vid.puffyan.us",
  "https://invidious.emn178.win",
];

const PIPED = [
  "https://adminforge.de", // pipedapi.adminforge.de redireciona para cá
  "https://api.piped.private.coffee",
  "https://pipedapi-libre.kavin.rocks",
];

const pickInvidiousAudio = (json) => {
  if (!json) return null;
  if (json.formatStreams?.length) {
    const mp4 = json.formatStreams.find((f) => (f.type || "").includes("audio/mp4") && f.url) ||
      json.formatStreams.find((f) => (f.type || "").includes("audio/") && f.url);
    if (mp4) return { url: mp4.url, type: mp4.type || "audio/mp4", via: "invidious" };
  }
  if (json.adaptiveFormats?.length) {
    const audio = json.adaptiveFormats.find((f) => (f.type || "").includes("audio/") && f.url);
    if (audio) return { url: audio.url, type: audio.type || "audio/mp4", via: "invidious" };
  }
  return null;
};

const pickPipedAudio = (json) => {
  if (!json) return null;
  const audioStreams = json.audioStreams || [];
  const videoStreams = json.videoStreams || [];
  // prefere opus/webm ou mp4
  const pick = audioStreams.find((f) => (f.mimeType || "").includes("audio/mp4") && f.url) ||
    audioStreams.find((f) => (f.mimeType || "").includes("audio/webm") && f.url) ||
    audioStreams.find((f) => (f.mimeType || "").includes("audio/") && f.url);
  if (pick) return { url: pick.url, type: pick.mimeType || "audio/mp4", via: "piped" };
  // último recurso: vídeo muxado (se tiver, usa a URL para o <audio>)
  const anyVideo = videoStreams.find((f) => f.url);
  if (anyVideo) return { url: anyVideo.url, type: anyVideo.mimeType || "video/mp4", via: "piped-video" };
  return null;
};

async function attempt(url, ctrl) {
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, signal: ctrl.signal });
    if (!res.ok) return null;
    const json = await res.json();
    return json;
  } catch {
    return null;
  }
}

export async function fetchInvidiousAudio(videoId, { signal } = {}) {
  const id = String(videoId || "").trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  const abort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) { clearTimeout(timer); return null; }
    signal.addEventListener("abort", abort, { once: true });
  }

  try {
    // 1) Invidious
    for (const base of INVIDIOUS) {
      const json = await attempt(`${base}/api/v1/videos/${id}`, ctrl);
      const stream = pickInvidiousAudio(json);
      if (stream?.url) return stream;
      if (signal?.aborted) return null;
    }
    // 2) Piped
    for (const base of PIPED) {
      const json = await attempt(`${base}/streams/${id}`, ctrl);
      const stream = pickPipedAudio(json);
      if (stream?.url) return stream;
      if (signal?.aborted) return null;
    }
    return null;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", abort);
  }
}

// Teste rápido: devolve a primeira instância que responde (para UI)
export async function findWorkingInstance() {
  for (const base of INVIDIOUS) {
    const json = await attempt(`${base}/api/v1/trending/music?region=BR`, { signal: new AbortController().signal });
    if (json) return { base, via: "invidious" };
  }
  return null;
}
