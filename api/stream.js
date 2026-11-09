// GET /api/stream?id=VIDEO_ID — resolve URL direta de áudio (Invidious) p/ app nativo (expo-av / expo-file-system).
// Adaptado para o padrão serverless do projeto (sem Express): handler (req, res) como os demais endpoints.
import { handleOptions, sendJSON, setCors } from "./_lib/innertube.js";

const INVIDIOUS = [
  "https://snopyta.org",
  "https://yewtu.be",
  "https://puffyan.us",
  "https://nerdvpn.de",
  // extras do src/api/invidious.js que já usamos no web
  "https://inv.nadeko.net",
  "https://invidious.f5.si",
  "https://invidious.0011.lt",
  "https://invidious.emn178.win",
];

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);
  if (req.method !== "GET") return sendJSON(res, 405, { error: "Method Not Allowed" });

  const id = String(req.query?.id || "").trim();
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return sendJSON(res, 400, { error: "O parâmetro id (videoId) é obrigatório." });
  }

  try {
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
        if (adaptiveFormat?.url) {
          return sendJSON(res, 200, { streamUrl: adaptiveFormat.url, via: instance });
        }
        // fallback: formatStreams (muxado mp4) também serve pro expo-av
        const muxed = (data.formatStreams || []).find((f) => f.url);
        if (muxed?.url) {
          return sendJSON(res, 200, { streamUrl: muxed.url, via: `${instance} (muxed)` });
        }
      } catch {
        continue; // próxima instância
      }
    }
    return sendJSON(res, 404, { error: "Não foi possível extrair a stream de áudio para este ID." });
  } catch (error) {
    return sendJSON(res, 500, { error: "Erro interno ao processar a stream de mídia.", details: String(error?.message || error) });
  }
}
