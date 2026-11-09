import { useEffect, useRef } from "react";
import { fetchInvidiousAudio } from "../api/invidious";

// Hook: quando o IFrame falha (101/150/100/2), tenta tocar o áudio via
// <audio> nativo com o stream direto do Invidious, mantendo os controles
// do player sincronizados (play/pause/seek/volume/timeupdate).
export function useInvidiousFallback({ audioRef, currentTrack, isPlaying, volume, muted }) {
  const elRef = useRef(null);
  const trackIdRef = useRef(null);

  useEffect(() => {
    let audio = audioRef?.current || elRef.current || null;
    if (!audio) {
      audio = document.createElement("audio");
      audio.preload = "auto";
      audio.setAttribute("playsinline", "");
      document.body.appendChild(audio);
      elRef.current = audio;
    }
    if (!audio) return () => {};

    const id = currentTrack?.videoId || currentTrack?.id || null;
    if (!id) return () => {};

    let cancelled = false;
    (async () => {
      // só usa o fallback se o caminho normal não conseguiu tocar
      // (o caller seta `fallbackNeeded` via data-attribute no body)
      if (document.body.getAttribute("data-invidious-fallback") !== "1") return;
      try {
        const stream = await fetchInvidiousAudio(id);
        if (cancelled || !stream?.url) return;
        if (audio.src !== stream.url) {
          audio.src = stream.url;
          audio.type = stream.type || "audio/mp4";
        }
        audio.volume = muted ? 0 : (volume ?? 0.85);
        if (isPlaying) {
          await audio.play().catch(() => {});
        }
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [currentTrack?.videoId, currentTrack?.id, isPlaying]);

  // sincroniza volume/mute/play do <audio> com o estado do app
  useEffect(() => {
    const audio = elRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : (volume ?? 0.85);
    if (isPlaying && audio.paused) audio.play().catch(() => {});
    if (!isPlaying && !audio.paused) audio.pause();
  }, [isPlaying, volume, muted]);

  // limpa a flag quando a faixa muda
  useEffect(() => {
    const id = currentTrack?.videoId || currentTrack?.id;
    if (trackIdRef.current !== id) {
      trackIdRef.current = id;
      // quando volta para o modo IFrame, limpa
      if (document.body.getAttribute("data-invidious-fallback") === "1") {
        document.body.removeAttribute("data-invidious-fallback");
        const audio = elRef.current;
        if (audio) { try { audio.pause(); audio.removeAttribute("src"); audio.load(); } catch {} }
      }
    }
  }, [currentTrack?.videoId, currentTrack?.id]);

  return { audioEl: elRef.current };
}
