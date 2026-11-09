import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fetchLyrics } from "../api/musicApi";
import { fetchInvidiousAudio } from "../api/invidious";
import { useAuth } from "./AuthContext";
import { DB } from "../db/database";

const PlayerContext = createContext(null);

// Load YouTube IFrame Player API once
let ytApiPromise = null;
function loadYTApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (ytApiPromise) return ytApiPromise;
  if (window.YT?.Player) return Promise.resolve(window.YT);
  ytApiPromise = new Promise((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => reject(new Error("Failed to load YouTube API"));
    document.head.appendChild(tag);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try { prev && prev(); } catch {}
      resolve(window.YT);
    };
    setTimeout(() => {
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube API timeout"));
    }, 15000);
  });
  return ytApiPromise;
}

const FALLBACK_COVER = (seed) => `https://picsum.photos/seed/ytm${seed}/400/400`;

function toFrontendTrack(t) {
  if (!t) return null;
  const videoId = t.videoId || t.id || "";
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(String(videoId))) return null;
  const durationSec = Number(t.durationSec) || 0;
  const s = Math.max(0, Math.round(durationSec));
  return {
    id: String(videoId),
    videoId: String(videoId),
    source: "youtube",
    title: t.title || "Sem título",
    artist: t.artist || t.author || "Artista desconhecido",
    album: t.album || "YouTube Music",
    cover: t.cover || t.thumbnail || FALLBACK_COVER(videoId),
    src: "",
    durationSec,
    duration: t.duration || `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`,
    genre: t.genre || "",
    year: t.year || null,
    explicit: false,
    mood: [],
    lyrics: "",
  };
}

const safePersist = (p) => { try { p && typeof p.catch === "function" && p.catch(() => {}); } catch {} };

export function PlayerProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id || null;

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [playerError, setPlayerError] = useState(null);
  const [liked, setLiked] = useState([]);
  const [disliked, setDisliked] = useState([]);
  const [lyrics, setLyrics] = useState("");
  const [loadingLyrics, setLoadingLyrics] = useState(false);

  // New fields
  const [radioMode, setRadioMode] = useState(true);
  const [sleepTimer, setSleepTimerState] = useState(null); // seconds | "end" | null
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(null); // seconds | null
  const [speed, setSpeedState] = useState(1);

  const currentTrack = queue[currentIndex] || null;

  // ----- YouTube IFrame Player -----
  const ytRef = useRef(null); // YT.Player instance
  const hostRef = useRef(null); // div host
  const stateRef = useRef({});
  // Keep every state value available without re-binding callbacks (poll, YT events, sleep timer).
  Object.assign(stateRef.current, {
    queue, currentIndex, shuffle, repeat, volume, muted, currentTrack,
    radioMode, speed, sleepTimer, isPlaying, userId, liked, disliked,
  });

  const pollRef = useRef(null);
  const readyRef = useRef(false);
  const pendingVideoRef = useRef(null); // { videoId, autoplay, seekTo }
  const settingsLoadedRef = useRef(false);
  const loadedUserRef = useRef(undefined); // undefined = not loaded yet
  const settingsTimerRef = useRef(null);
  const resumeSaveTimerRef = useRef(null);
  const lastSettingsSaveRef = useRef(null);
  const lastLikesSaveRef = useRef(null);
  const lastDislikesSaveRef = useRef(null);
  const pendingPositionRef = useRef(null);
  const sleepDeadlineRef = useRef(null);
  const sleepTickRef = useRef(null);
  const automixFetchRef = useRef(0);
  const audioElRef = useRef(null); // <audio> nativo para o fallback Invidious
  const fallbackActiveRef = useRef(false); // true → carregando via Invidious
  const fallbackFetchRef = useRef(0);
  const pollInvidiousRef = useRef(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const startPoll = useCallback(() => {
    stopPoll();
    pollRef.current = setInterval(() => {
      const yt = ytRef.current;
      if (!yt || typeof yt.getCurrentTime !== "function") return;
      try {
        const cur = yt.getCurrentTime();
        const dur = yt.getDuration();
        if (isFinite(cur)) setCurrentTime(cur);
        if (isFinite(dur) && dur > 0) setDuration(dur);
      } catch {}
    }, 500);
  }, [stopPoll]);

  const applyVideo = useCallback((videoId, autoplay = true, seekTo = null) => {
    const yt = ytRef.current;
    if (!videoId) return;
    if (!yt || !readyRef.current) { pendingVideoRef.current = { videoId, autoplay, seekTo }; return; }
    setPlayerError(null);
    // volta ao modo IFrame — desliga o fallback Invidious se estava ativo
    if (fallbackActiveRef.current) {
      try { audioElRef.current?.pause?.(); } catch {}
      fallbackActiveRef.current = false;
      document.body.removeAttribute("data-invidious-fallback");
    }
    try {
      yt.loadVideoById({ videoId, startSeconds: seekTo || 0 });
      if (!autoplay) yt.pauseVideo();
    } catch {
      try { yt.cueVideoById({ videoId, startSeconds: seekTo || 0 }); } catch {}
    }
  }, []);

  const getPosition = useCallback(() => {
    const yt = ytRef.current;
    try {
      if (yt && readyRef.current && isFinite(yt.getCurrentTime())) return yt.getCurrentTime();
    } catch {}
    return stateRef.current.currentTime || 0;
  }, []);

  const persistLikeSet = useCallback((nextLiked, nextDisliked, uid = stateRef.current.userId) => {
    if (!uid) return;
    lastLikesSaveRef.current = { key: `${uid}`, liked: nextLiked, disliked: nextDisliked };
    safePersist(DB.setLikes(uid, nextLiked));
    safePersist(
      DB.saveSettings(uid, {
        volume: stateRef.current.volume,
        muted: stateRef.current.muted,
        shuffle: stateRef.current.shuffle,
        repeat: stateRef.current.repeat,
        radioMode: stateRef.current.radioMode,
        speed: stateRef.current.speed,
        disliked: nextDisliked,
      })
    );
  }, []);

  const saveSettingsNow = useCallback((overrides = {}) => {
    const s = stateRef.current;
    const uid = s.userId;
    if (!uid) return Promise.resolve(false);
    const data = {
      volume: s.volume, muted: s.muted, shuffle: s.shuffle, repeat: s.repeat,
      radioMode: s.radioMode, speed: s.speed,
      disliked: overrides.disliked ?? s.disliked ?? [],
      lastVideoId: overrides.lastVideoId !== undefined ? overrides.lastVideoId : (s.currentTrack?.videoId || s.currentTrack?.id || null),
      lastPosition: overrides.lastPosition !== undefined ? overrides.lastPosition : getPosition(),
      queue: overrides.queue !== undefined ? overrides.queue : s.queue.map((t) => t.videoId || t.id),
      currentIndex: overrides.currentIndex !== undefined ? overrides.currentIndex : s.currentIndex,
    };
    lastSettingsSaveRef.current = { uid, volume: data.volume, muted: data.muted, shuffle: data.shuffle, repeat: data.repeat, radioMode: data.radioMode, speed: data.speed, disliked: data.disliked };
    return DB.saveSettings(uid, data).catch(() => false);
  }, [getPosition]);

  const queueSettingsSave = useCallback(() => {
    if (!stateRef.current.userId) return;
    if (!settingsLoadedRef.current) return;
    if (settingsTimerRef.current) clearTimeout(settingsTimerRef.current);
    settingsTimerRef.current = setTimeout(() => { safePersist(saveSettingsNow()); }, 300);
  }, [saveSettingsNow]);

  const saveResumeNow = useCallback(() => { safePersist(saveSettingsNow()); }, [saveSettingsNow]);
  const scheduleResumeSave = useCallback(() => {
    if (!stateRef.current.userId) return;
    if (!settingsLoadedRef.current) return;
    if (resumeSaveTimerRef.current) clearTimeout(resumeSaveTimerRef.current);
    resumeSaveTimerRef.current = setTimeout(() => { safePersist(saveSettingsNow()); }, 500);
  }, [saveSettingsNow]);

  const recordHistory = useCallback((videoId) => {
    const { userId: uid } = stateRef.current;
    if (!uid || !videoId) return;
    safePersist(DB.addHistory(uid, String(videoId)));
  }, []);

  const cacheTracks = useCallback((tracks) => {
    if (!tracks?.length) return;
    safePersist(DB.cacheTracks(tracks, stateRef.current.userId));
  }, []);

  const clearSleepTimerInternal = useCallback(() => {
    if (sleepTickRef.current) { clearInterval(sleepTickRef.current); sleepTickRef.current = null; }
    sleepDeadlineRef.current = null;
    setSleepTimerRemaining(null);
  }, []);

  const clearSleepTimer = useCallback(() => {
    clearSleepTimerInternal();
    setSleepTimerState(null);
    stateRef.current.sleepTimer = null;
  }, [clearSleepTimerInternal]);

  const setSleepTimer = useCallback((value) => {
    clearSleepTimerInternal();
    if (value == null || value === "off") {
      setSleepTimerState(null);
      stateRef.current.sleepTimer = null;
      return;
    }
    setSleepTimerState(value);
    stateRef.current.sleepTimer = value;
    if (value === "end") { setSleepTimerRemaining(null); return; }
    const secs = Number(value);
    if (!isFinite(secs) || secs <= 0) { setSleepTimerState(null); stateRef.current.sleepTimer = null; return; }
    const seconds = Math.round(secs);
    sleepDeadlineRef.current = Date.now() + seconds * 1000;
    setSleepTimerRemaining(seconds);
    // tick for consumers that want a countdown
    sleepTickRef.current = setInterval(() => {
      const remain = Math.max(0, Math.round((sleepDeadlineRef.current - Date.now()) / 1000));
      setSleepTimerRemaining(remain);
      if (remain <= 0) {
        try { ytRef.current?.pauseVideo?.(); } catch {}
        clearSleepTimer();
      }
    }, 500);
  }, [clearSleepTimer, clearSleepTimerInternal]);

  const setSpeed = useCallback((r) => {
    const rate = Number(r);
    if (!isFinite(rate) || rate <= 0) return;
    setSpeedState(rate);
    stateRef.current.speed = rate;
    try { ytRef.current?.setPlaybackRate?.(rate); } catch {}
    queueSettingsSave();
  }, [queueSettingsSave]);

  // ----- public exposed setters that also persist settings -----
  const setVolumePersisted = useCallback((v) => {
    setVolume(v); stateRef.current.volume = v; queueSettingsSave();
    try {
      const a = audioElRef.current;
      if (a) { a.volume = muted ? 0 : v; a.muted = muted; }
    } catch {}
  }, [muted, queueSettingsSave]);
  const setMutedPersisted = useCallback((v) => {
    setMuted(v); stateRef.current.muted = v; queueSettingsSave();
    try {
      const a = audioElRef.current;
      if (a) { a.muted = v; a.volume = v ? 0 : (stateRef.current.volume ?? 0.85); }
    } catch {}
  }, [queueSettingsSave]);
  const setShufflePersisted = useCallback((v) => {
    setShuffle(v); stateRef.current.shuffle = v; queueSettingsSave();
  }, [queueSettingsSave]);
  const setRepeatPersisted = useCallback((v) => {
    setRepeat(v); stateRef.current.repeat = v; queueSettingsSave();
  }, [queueSettingsSave]);
  const setRadioModePersisted = useCallback((v) => {
    setRadioMode(v); stateRef.current.radioMode = v; queueSettingsSave();
  }, [queueSettingsSave]);

  const fetchAutomix = useCallback(async (seedVideoId) => {
    const token = ++automixFetchRef.current;
    if (!seedVideoId) return [];
    try {
      const res = await fetch(`/api/upnext?id=${encodeURIComponent(String(seedVideoId))}`, { headers: { accept: "application/json" } });
      if (!res.ok) return [];
      const json = await res.json();
      if (token !== automixFetchRef.current) return [];
      const raw = Array.isArray(json?.tracks) ? json.tracks : [];
      const tracks = raw.map(toFrontendTrack).filter(Boolean);
      return tracks;
    } catch {
      return [];
    }
  }, []);

  const onYTStateChange = useCallback((event) => {
    const st = event?.data;
    if (st === 1) {
      setIsPlaying(true);
      startPoll();
    } else if (st === 2 || st === 5) {
      setIsPlaying(false);
      if (!document.hidden) saveResumeNow();
    } else if (st === 0) {
      const { queue: q, currentIndex: ci, repeat: rp, shuffle: sh, sleepTimer: stTimer, radioMode: rm } = stateRef.current;
      if (stTimer === "end") {
        try { ytRef.current?.pauseVideo?.(); } catch {}
        setIsPlaying(false);
        clearSleepTimer();
        saveResumeNow();
        return;
      }
      if (rp === 2) { applyVideo(q[ci]?.videoId || q[ci]?.id, true); return; }
      const atLast = ci >= q.length - 1;
      if (sh && q.length > 1) {
        const ni = Math.floor(Math.random() * q.length);
        setCurrentIndex(ni); setIsPlaying(true); setCurrentTime(0);
        const t = q[ni];
        applyVideo(t?.videoId || t?.id, true);
        if (t) { recordHistory(t.videoId || t.id); scheduleResumeSave(); }
        return;
      }
      if (!atLast) {
        const ni = ci + 1;
        const t = q[ni];
        setCurrentIndex(ni); setIsPlaying(true); setCurrentTime(0);
        applyVideo(t?.videoId || t?.id, true);
        if (t) { recordHistory(t.videoId || t.id); scheduleResumeSave(); }
        return;
      }
      // end of queue
      if (rm) {
        const seedId = q[ci]?.videoId || q[ci]?.id;
        fetchAutomix(seedId).then((extra) => {
          if (!extra?.length) { setIsPlaying(false); return; }
          const nextQueue = [...stateRef.current.queue, ...extra];
          const ni = nextQueue.length - extra.length;
          setQueue(nextQueue);
          setCurrentIndex(ni);
          setIsPlaying(true);
          setCurrentTime(0);
          const t = nextQueue[ni];
          setDuration(t?.durationSec || 0);
          applyVideo(t?.videoId || t?.id, true);
          recordHistory(t?.videoId || t?.id);
          cacheTracks(extra);
          scheduleResumeSave();
        }).catch(() => { setIsPlaying(false); });
      } else {
        setIsPlaying(false);
      }
    } else if (st === 3) {
      // buffering
    }
  }, [applyVideo, startPoll, fetchAutomix, recordHistory, cacheTracks, scheduleResumeSave, clearSleepTimer, saveResumeNow]);

  const onYTError = useCallback((event) => {
    const code = event?.data;
    // Vídeo com restrição do dono (101/150) ou não encontrado (100/2):
    // tenta o fallback Invidious (<audio> com stream direto) — a música toca mesmo assim.
    // Depois tenta /api/resolve; se nada resolver, pula silencioso para a próxima.
    if (code === 101 || code === 150 || code === 100 || code === 2) {
      setPlayerError(null);
      const s = stateRef.current;
      const track = s.queue?.[s.currentIndex];
      if (!track) { setIsPlaying(false); return; }
      const id = String(track.videoId || track.id || "");
      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) { setIsPlaying(false); return; }

      // garante um <audio> nativo
      try {
        if (!audioElRef.current) {
          const a = document.createElement("audio");
          a.preload = "auto";
          a.setAttribute("playsinline", "");
          a.id = "ytm-invidious-audio";
          document.body.appendChild(a);
          audioElRef.current = a;
          // sincroniza progresso
          const onTime = () => { try { if (isFinite(a.currentTime)) { setCurrentTime(a.currentTime); if (isFinite(a.duration) && a.duration > 0) setDuration(a.duration); } } catch {} };
          a.addEventListener("timeupdate", onTime);
          a.addEventListener("ended", () => { fallbackActiveRef.current = false; });
          a.addEventListener("play", () => setIsPlaying(true));
          a.addEventListener("pause", () => setIsPlaying(false));
        }
      } catch {}

      const token = ++fallbackFetchRef.current;
      const audio = audioElRef.current;

      const startInvidious = async () => {
        try {
          const stream = await fetchInvidiousAudio(id);
          if (!stream?.url || token !== fallbackFetchRef.current) return false;
          try {
            if (audio.src !== stream.url) { audio.src = stream.url; audio.type = stream.type || "audio/mp4"; audio.load(); }
            audio.volume = stateRef.current.muted ? 0 : (stateRef.current.volume ?? 0.85);
            fallbackActiveRef.current = true;
            document.body.setAttribute("data-invidious-fallback", "1");
            await audio.play().catch(() => {});
            setIsPlaying(true);
            return true;
          } catch { return false; }
        } catch { return false; }
      };

      const tryResolve = () =>
        fetch(`/api/resolve?id=${encodeURIComponent(id)}&title=${encodeURIComponent(String(track.title || ""))}&artist=${encodeURIComponent(String(track.artist || ""))}`, { headers: { accept: "application/json" } })
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => {
            if (j?.ok && j.videoId && String(j.videoId) !== id) {
              try {
                const q = stateRef.current.queue.map((t, i) =>
                  i === stateRef.current.currentIndex ? { ...t, videoId: j.videoId, id: j.videoId } : t
                );
                setQueue(q);
                applyVideo(j.videoId, true);
              } catch {
                applyVideo(j.videoId, true);
              }
            } else {
              // sem substituto → pula silencioso
              try {
                const s2 = stateRef.current;
                const nextIdx = Math.min(s2.currentIndex + 1, (s2.queue || []).length - 1);
                if (nextIdx !== s2.currentIndex && s2.queue?.[nextIdx]) {
                  const t = s2.queue[nextIdx];
                  applyVideo(t.videoId || t.id, true);
                } else {
                  setIsPlaying(false);
                }
              } catch { setIsPlaying(false); }
            }
          })
          .catch(() => {
            try {
              const s2 = stateRef.current;
              const nextIdx = Math.min(s2.currentIndex + 1, (s2.queue || []).length - 1);
              if (nextIdx !== s2.currentIndex && s2.queue?.[nextIdx]) {
                const t = s2.queue[nextIdx];
                applyVideo(t.videoId || t.id, true);
              } else setIsPlaying(false);
            } catch { setIsPlaying(false); }
          });

      // 1) Invidious primeiro (toca a faixa original); 2) /api/resolve (substituto)
      startInvidious().then((ok) => { if (!ok) tryResolve(); });
      return;
    }
    if (code === 5) {
      setPlayerError("Erro de HTML5 no player do YouTube.");
    } else {
      setPlayerError("Não foi possível carregar o vídeo do YouTube.");
    }
    setIsPlaying(false);
  }, [applyVideo]);

  const onYTReady = useCallback((event) => {
    readyRef.current = true;
    const yt = event.target;
    ytRef.current = yt;
    try {
      const v = stateRef.current.muted ? 0 : stateRef.current.volume * 100;
      yt.setVolume(Math.round(v));
      if (stateRef.current.muted) yt.mute(); else yt.unMute();
      try { yt.setPlaybackRate?.(stateRef.current.speed || 1); } catch {}
    } catch {}
    const p = pendingVideoRef.current;
    if (p) { pendingVideoRef.current = null; applyVideo(p.videoId, p.autoplay, p.seekTo); }
  }, [applyVideo]);

  // init player once host mounts — music.youtube.com
  // O player do YTM usa o mesmo IFrame API mas com parâmetros do Music (origin do YTM + playsinline + fs)
  useEffect(() => {
    let cancelled = false;
    if (!hostRef.current) return;
    loadYTApi()
      .then((YT) => {
        if (cancelled || ytRef.current) return;
        new YT.Player(hostRef.current, {
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            enablejsapi: 1,
            // usa o mesmo host do YTM para reduzir rejeição de embed em faixas Music
            origin: "https://music.youtube.com",
            // força o player em modo "music" (áudio) quando disponível
            mode: "music",
          },
          events: { onReady: onYTReady, onStateChange: onYTStateChange, onError: onYTError },
        });
      })
      .catch(() => {
        if (!cancelled) setPlayerError("Não foi possível carregar a API do YouTube. Verifique a conexão.");
      });
    return () => { cancelled = true; };
  }, [onYTReady, onYTStateChange, onYTError]);

  useEffect(() => { return stopPoll; }, [stopPoll]);

  useEffect(() => {
    const yt = ytRef.current;
    if (!yt || !readyRef.current) return;
    try {
      yt.setVolume(Math.round((muted ? 0 : volume) * 100));
      if (muted) yt.mute(); else yt.unMute();
    } catch {}
  }, [volume, muted]);

  // fetch lyrics when currentTrack changes
  useEffect(() => {
    const vid = currentTrack?.videoId || currentTrack?.id;
    if (!vid || !/^[A-Za-z0-9_-]{11}$/.test(String(vid))) { setLyrics(""); return; }
    let cancelled = false;
    setLoadingLyrics(true);
    fetchLyrics(String(vid))
      .then((text) => { if (!cancelled) setLyrics(text || ""); })
      .catch(() => { if (!cancelled) setLyrics(""); })
      .finally(() => { if (!cancelled) setLoadingLyrics(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.videoId || currentTrack?.id]);

  // ----- persistence: likes + settings + resume restore on user change -----
  useEffect(() => {
    let cancelled = false;
    settingsLoadedRef.current = false;
    const uid = userId;
    (async () => {
      try {
        if (!uid) {
          if (!cancelled) { setLiked([]); setDisliked([]); }
          loadedUserRef.current = null;
          settingsLoadedRef.current = true;
          return;
        }
        const [likes, settings] = await Promise.all([
          DB.getLikes(uid).catch(() => []),
          DB.getSettings(uid).catch(() => null),
        ]);
        if (cancelled) return;
        const likesArr = Array.isArray(likes) ? likes.map(String) : [];
        const dislikedArr = Array.isArray(settings?.disliked) ? settings.disliked.map(String) : [];
        lastLikesSaveRef.current = { key: `${uid}:loaded`, liked: likesArr, disliked: dislikedArr };
        setLiked(likesArr);
        setDisliked(dislikedArr);
        stateRef.current.liked = likesArr;
        stateRef.current.disliked = dislikedArr;
        if (settings) {
          if (isFinite(settings.volume)) { setVolume(settings.volume); stateRef.current.volume = settings.volume; }
          if (typeof settings.muted === "boolean") { setMuted(settings.muted); stateRef.current.muted = settings.muted; }
          if (typeof settings.shuffle === "boolean") { setShuffle(settings.shuffle); stateRef.current.shuffle = settings.shuffle; }
          if (settings.repeat === 0 || settings.repeat === 1 || settings.repeat === 2) { setRepeat(settings.repeat); stateRef.current.repeat = settings.repeat; }
          if (settings.speed && isFinite(settings.speed) && settings.speed > 0) {
            setSpeedState(settings.speed); stateRef.current.speed = settings.speed;
            try { ytRef.current?.setPlaybackRate?.(settings.speed); } catch {}
          }
          if (typeof settings.radioMode === "boolean") { setRadioMode(settings.radioMode); stateRef.current.radioMode = settings.radioMode; }
          if (Array.isArray(settings.queue) && settings.queue.length && settings.lastVideoId) {
            try {
              const cached = await DB.getCachedTracks(settings.queue, uid).catch(() => []);
              if (!cancelled && cached?.length) {
                const byId = new Map(cached.map((t) => [String(t.videoId || t.id), t]));
                const ordered = [];
                for (const vid of settings.queue) {
                  const hit = byId.get(String(vid));
                  if (hit) ordered.push(toFrontendTrack(hit));
                }
                const idx = settings.lastVideoId
                  ? ordered.findIndex((t) => String(t.videoId || t.id) === String(settings.lastVideoId))
                  : 0;
                if (ordered.length) {
                  setQueue(ordered);
                  setCurrentIndex(idx >= 0 ? idx : 0);
                  setIsPlaying(false);
                  setCurrentTime(0);
                  setDuration(ordered[idx >= 0 ? idx : 0]?.durationSec || 0);
                  pendingPositionRef.current = isFinite(settings.lastPosition) && settings.lastPosition > 0 ? settings.lastPosition : null;
                  settingsLoadedRef.current = true;
                  loadedUserRef.current = uid;
                  return;
                }
              }
            } catch {}
          }
        }
        settingsLoadedRef.current = true;
        loadedUserRef.current = uid;
      } catch {
        if (!cancelled) { settingsLoadedRef.current = true; loadedUserRef.current = uid; }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ----- persistence: save settings when they change (debounced) -----
  useEffect(() => {
    if (!userId) return;
    if (!settingsLoadedRef.current) return;
    if (loadedUserRef.current !== userId) return;
    const prev = lastSettingsSaveRef.current;
    if (prev) {
      const key = `${userId}`;
      if (prev.uid === key && prev.volume === volume && prev.muted === muted && prev.shuffle === shuffle && prev.repeat === repeat && prev.radioMode === radioMode && prev.speed === speed) return;
    }
    queueSettingsSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, volume, muted, shuffle, repeat, radioMode, speed]);

  // ----- persistence: save resume position periodically + on pause -----
  useEffect(() => {
    if (!isPlaying) return;
    const t = setInterval(() => { if (settingsLoadedRef.current) saveResumeNow(); }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    const onVis = () => {
      if (document.hidden && settingsLoadedRef.current) saveResumeNow();
      else if (!document.hidden) scheduleResumeSave();
    };
    const onUnload = () => {
      if (!settingsLoadedRef.current) return;
      safePersist(saveSettingsNow());
      try {
        const yt = ytRef.current;
        if (yt && readyRef.current) { try { lastPosRef.current.set("unload", yt.getCurrentTime()); } catch {} }
      } catch {}
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onUnload);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onUnload);
      window.removeEventListener("beforeunload", onUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // ----- persistence: restore pending resume position when YT ready -----
  useEffect(() => {
    const check = setInterval(() => {
      if (pendingPositionRef.current != null && readyRef.current && ytRef.current) {
        const pos = pendingPositionRef.current;
        pendingPositionRef.current = null;
        const playingNow = stateRef.current.isPlaying;
        applyVideo(stateRef.current.currentTrack?.videoId || stateRef.current.currentTrack?.id, !!playingNow, pos);
        setCurrentTime(pos);
      }
    }, 400);
    return () => clearInterval(check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- queue / transport -----
  const lastPosRef = useRef(new Map());

  const loadAt = useCallback((list, idx) => {
    const track = list[idx];
    if (!track) return;
    const videoId = track.videoId || track.id;
    const isYT = /^[A-Za-z0-9_-]{11}$/.test(String(videoId || ""));
    if (!videoId || !isYT) { setPlayerError("Faixa sem videoId do YouTube."); return; }
    const yt = ytRef.current;
    const prevTrack = stateRef.current.queue[stateRef.current.currentIndex];
    try {
      if (yt && readyRef.current && isFinite(yt.getCurrentTime()) && yt.getCurrentTime() > 0 && prevTrack) {
        lastPosRef.current.set(String(prevTrack.videoId || prevTrack.id), yt.getCurrentTime());
      }
    } catch {}
    setQueue(list);
    setCurrentIndex(idx);
    setCurrentTime(0);
    setDuration(track.durationSec || 0);
    setIsPlaying(true);
    const resumeAt = lastPosRef.current.get(String(videoId)) || null;
    applyVideo(String(videoId), true, resumeAt);
    recordHistory(String(videoId));
    scheduleResumeSave();
  }, [applyVideo, recordHistory, scheduleResumeSave]);

  const playTracks = useCallback((tracks, startId) => {
    if (!tracks?.length) return;
    const list = tracks.filter((t) => t.videoId || t.id);
    if (!list.length) return;
    cacheTracks(list);
    const idx = startId ? list.findIndex((t) => String(t.videoId || t.id) === String(startId)) : 0;
    loadAt(list, idx >= 0 ? idx : 0);
  }, [loadAt, cacheTracks]);

  const playTrack = useCallback((track, contextList) => {
    if (!track) return;
    if (contextList?.length) return playTracks(contextList, track.videoId || track.id);
    const existing = stateRef.current.queue.findIndex((t) => String(t.videoId || t.id) === String(track.videoId || track.id));
    if (existing !== -1) { loadAt(stateRef.current.queue, existing); return; }
    cacheTracks([track]);
    loadAt([track], 0);
  }, [playTracks, loadAt, cacheTracks]);

  const togglePlay = useCallback(() => {
    // modo fallback Invidious: controla o <audio> nativo
    if (fallbackActiveRef.current) {
      try {
        const a = audioElRef.current;
        if (a) {
          if (a.paused) { a.play().catch(() => {}); setIsPlaying(true); }
          else { a.pause(); setIsPlaying(false); }
        }
      } catch {}
      return;
    }
    const yt = ytRef.current;
    if (!yt || !readyRef.current) {
      const t = stateRef.current.queue[stateRef.current.currentIndex];
      if (t) {
        const resumeAt = pendingPositionRef.current;
        pendingPositionRef.current = null;
        applyVideo(t.videoId || t.id, true, resumeAt);
        setIsPlaying(true);
      }
      return;
    }
    try {
      const st = yt.getPlayerState();
      if (st === 1) { yt.pauseVideo(); saveResumeNow(); }
      else yt.playVideo();
    } catch {}
  }, [applyVideo, saveResumeNow]);

  const playNext = useCallback(() => {
    const { queue: q, currentIndex: ci, shuffle: sh } = stateRef.current;
    if (!q.length) return;
    let ni;
    if (sh && q.length > 1) { do { ni = Math.floor(Math.random() * q.length); } while (ni === ci); }
    else ni = (ci + 1) % q.length;
    const t = q[ni];
    if (t) { setCurrentIndex(ni); setIsPlaying(true); setCurrentTime(0); setDuration(t.durationSec || 0); applyVideo(t.videoId || t.id, true); recordHistory(t.videoId || t.id); scheduleResumeSave(); }
  }, [applyVideo, recordHistory, scheduleResumeSave]);

  const playPrev = useCallback(() => {
    const { queue: q, currentIndex: ci } = stateRef.current;
    if (fallbackActiveRef.current) {
      try { const a = audioElRef.current; if (a && a.currentTime > 3) { a.currentTime = 0; return; } } catch {}
    }
    const yt = ytRef.current;
    try {
      if (yt && isFinite(yt.getCurrentTime()) && yt.getCurrentTime() > 3) { yt.seekTo(0, true); return; }
    } catch {}
    if (!q.length) return;
    const ni = (ci - 1 + q.length) % q.length;
    const t = q[ni];
    if (t) { setCurrentIndex(ni); setIsPlaying(true); setCurrentTime(0); setDuration(t.durationSec || 0); applyVideo(t.videoId || t.id, true); recordHistory(t.videoId || t.id); scheduleResumeSave(); }
  }, [applyVideo, recordHistory, scheduleResumeSave]);

  const seek = useCallback((t) => {
    if (fallbackActiveRef.current) {
      try { const a = audioElRef.current; if (a) a.currentTime = t; } catch {}
    } else {
      const yt = ytRef.current;
      if (yt && readyRef.current) { try { yt.seekTo(t, true); } catch {} }
    }
    setCurrentTime(t);
  }, []);

  const jumpTo = useCallback((i) => {
    const { queue: q } = stateRef.current;
    if (!q.length || i < 0 || i >= q.length) return;
    const t = q[i];
    if (t) { setCurrentIndex(i); setIsPlaying(true); setCurrentTime(0); setDuration(t.durationSec || 0); applyVideo(t.videoId || t.id, true); recordHistory(t.videoId || t.id); scheduleResumeSave(); }
  }, [applyVideo, recordHistory, scheduleResumeSave]);

  const toggleLike = useCallback((id) => {
    const sid = String(id);
    const isLiked = stateRef.current.liked?.includes(sid);
    const nextLiked = isLiked ? stateRef.current.liked.filter((x) => x !== sid) : [...(stateRef.current.liked || []), sid];
    const nextDisliked = stateRef.current.disliked || [];
    setLiked(nextLiked);
    stateRef.current.liked = nextLiked;
    if (!isLiked && nextDisliked.includes(sid)) {
      const nd = nextDisliked.filter((x) => x !== sid);
      setDisliked(nd);
      stateRef.current.disliked = nd;
      persistLikeSet(nextLiked, nd);
    } else {
      persistLikeSet(nextLiked, nextDisliked);
    }
  }, [persistLikeSet]);

  const toggleDislike = useCallback((id) => {
    const sid = String(id);
    const isDisliked = stateRef.current.disliked?.includes(sid);
    const nextDisliked = isDisliked ? stateRef.current.disliked.filter((x) => x !== sid) : [...(stateRef.current.disliked || []), sid];
    const nextLiked = stateRef.current.liked || [];
    setDisliked(nextDisliked);
    stateRef.current.disliked = nextDisliked;
    if (!isDisliked && nextLiked.includes(sid)) {
      const nl = nextLiked.filter((x) => x !== sid);
      setLiked(nl);
      stateRef.current.liked = nl;
      persistLikeSet(nl, nextDisliked);
    } else {
      persistLikeSet(nextLiked, nextDisliked);
    }
  }, [persistLikeSet]);

  const cycleRepeat = useCallback(() => {
    const next = (stateRef.current.repeat + 1) % 3;
    setRepeat(next); stateRef.current.repeat = next; queueSettingsSave();
  }, [queueSettingsSave]);

  const toggleShuffle = useCallback(() => {
    const next = !stateRef.current.shuffle;
    setShuffle(next); stateRef.current.shuffle = next; queueSettingsSave();
  }, [queueSettingsSave]);

  const value = useMemo(() => ({
    ytRef, hostRef, queue, currentIndex, isPlaying, volume, muted, currentTime, duration,
    shuffle, repeat, showQueue, showLyrics, expanded, liked, currentTrack, playerError,
    lyrics, loadingLyrics,
    // New fields
    disliked, toggleDislike, radioMode, setRadioMode: setRadioModePersisted,
    sleepTimer, setSleepTimer, sleepTimerRemaining,
    speed, setSpeed,
    playTracks, playTrack, togglePlay, playNext, playPrev, seek, jumpTo, toggleLike,
    cycleRepeat, toggleShuffle,
    setVolume: setVolumePersisted, setMuted: setMutedPersisted,
    setCurrentTime, setDuration, setIsPlaying,
    setShowQueue, setShowLyrics, setExpanded, setQueue, setCurrentIndex,
    setShuffle: setShufflePersisted, setRepeat: setRepeatPersisted,
  }), [queue, currentIndex, isPlaying, volume, muted, currentTime, duration, shuffle, repeat, showQueue, showLyrics, expanded, liked, disliked, currentTrack, playerError, lyrics, loadingLyrics,
    playTracks, playTrack, togglePlay, playNext, playPrev, seek, jumpTo, toggleLike, toggleDislike, cycleRepeat, toggleShuffle,
    radioMode, sleepTimer, sleepTimerRemaining, speed, setSpeed, setSleepTimer,
    setVolumePersisted, setMutedPersisted, setRadioModePersisted, setShufflePersisted, setRepeatPersisted]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export const usePlayer = () => useContext(PlayerContext);
export { loadYTApi };
