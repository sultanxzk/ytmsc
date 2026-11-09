import { useEffect, useRef } from "react";

// Cria um <audio> nativo reutilizável para o fallback Invidious.
// O elemento vive fora do React (append no body) e é controlado pelo
// PlayerContext via eventos globais, não por props.
export function useAudioElement() {
  const ref = useRef(null);

  useEffect(() => {
    let audio = ref.current;
    if (!audio) {
      audio = document.createElement("audio");
      audio.preload = "auto";
      audio.setAttribute("playsinline", "");
      audio.id = "ytm-invidious-audio";
      document.body.appendChild(audio);
      ref.current = audio;
    }

    const onPlay = () => { audio.play().catch(() => {}); };
    const onPause = () => { try { audio.pause(); } catch {} };
    const onSeek = (e) => { try { audio.currentTime = e.detail?.t ?? audio.currentTime; } catch {} };
    const onVolume = (e) => { try { audio.volume = e.detail?.v ?? audio.volume; audio.muted = e.detail?.muted ?? audio.muted; } catch {} };

    window.addEventListener("ytm-invidious-play", onPlay);
    window.addEventListener("ytm-invidious-pause", onPause);
    window.addEventListener("ytm-invidious-seek", onSeek);
    window.addEventListener("ytm-invidious-volume", onVolume);

    return () => {
      window.removeEventListener("ytm-invidious-play", onPlay);
      window.removeEventListener("ytm-invidious-pause", onPause);
      window.removeEventListener("ytm-invidious-seek", onSeek);
      window.removeEventListener("ytm-invidious-volume", onVolume);
      try { audio.pause(); } catch {}
    };
  }, []);

  return ref;
}
