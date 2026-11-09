import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Volume2, VolumeX, Heart, ChevronsDown, ChevronUp, X, MoreVertical, ThumbsDown, Share2, RotateCcw, RotateCw } from "lucide-react";
import { usePlayer } from "../context/PlayerContext";
import { useLyricSync } from "../hook/useLyricSync";
import { useEffect, useRef, useState, useCallback } from "react";

const fmt = (s) => {
  if (!isFinite(s) || s == null) return "0:00";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

function Progress({ p, track, compact = false }) {
  const ref = useRef(null);
  const [seeking, setSeeking] = useState(false);
  const [hoverRatio, setHoverRatio] = useState(null);
  const pctBar = p.duration ? (p.currentTime / p.duration) * 100 : 0;
  const onMove = (e) => {
    const el = ref.current;
    if (!el || !p.duration) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverRatio(ratio);
    if (seeking) p.seek(ratio * p.duration);
  };
  const onDown = (e) => {
    const el = ref.current;
    if (!el || !p.duration) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setSeeking(true);
    p.seek(ratio * p.duration);
  };
  return (
    <div
      ref={ref}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={() => setSeeking(false)}
      onMouseLeave={() => { setSeeking(false); setHoverRatio(null); }}
      className={`group relative cursor-pointer transition-all duration-150 ${compact ? "h-[3px] hover:h-[6px] bg-white/15" : "h-1.5 hover:h-2.5 bg-white/20 rounded-full"}`}
    >
      {hoverRatio != null && !seeking && (
        <div className="absolute inset-y-[-6px] left-0 right-0 pointer-events-none">
          <span className="absolute -top-6 px-2 py-0.5 rounded-full bg-white text-black text-[11px] tabular-nums whitespace-nowrap -translate-x-1/2" style={{ left: `${hoverRatio * 100}%` }}>
            {fmt(hoverRatio * (p.duration || 0))}
          </span>
        </div>
      )}
      <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#ff0033] to-[#ff3366] rounded-full shadow-[0_0_12px_rgba(255,0,51,0.5)]" style={{ width: `${pctBar}%` }} />
      <div className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg ${seeking || hoverRatio != null ? "opacity-100" : "opacity-0 group-hover:opacity-100"} -translate-x-1/2 pointer-events-none`} style={{ left: `${pctBar}%` }} />
    </div>
  );
}

export default function PlayerBar() {
  const p = usePlayer();
  const track = p.currentTrack;
  const { parsed: lyricLines, activeIdx: activeLyric } = useLyricSync(p.lyrics, p.currentTime, p.duration || track?.durationSec);
  const speed = p.speed || 1;
  const isLiked = track && p.liked.includes(String(track.id || track.videoId));
  const isDisliked = track && (p.disliked || []).includes(String(track.id || track.videoId));
  const [ntab, setNtab] = useState("queue"); // queue | lyrics | related
  const [related, setRelated] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [liking, setLiking] = useState(false);
  const like = () => { setLiking(true); p.toggleLike(track?.id || track?.videoId); setTimeout(() => setLiking(false), 400); };
  const seekBy = useCallback((sec) => { p.seek(Math.max(0, Math.min(p.duration || 0, (p.currentTime || 0) + sec))); }, [p]);

  // relacionadas quando a aba abre
  useEffect(() => {
    if (ntab !== "related" || !track?.videoId) return;
    let c = false;
    setLoadingRelated(true);
    fetch(`/api/related?id=${encodeURIComponent(String(track.videoId))}`, { headers: { accept: "application/json" } })
      .then((r) => r.json())
      .then((j) => { if (!c) setRelated(Array.isArray(j?.tracks) ? j.tracks : []); })
      .catch(() => { if (!c) setRelated([]); })
      .finally(() => { if (!c) setLoadingRelated(false); });
    return () => { c = true; };
  }, [ntab, track?.videoId]);

  const hiddenHost = (
    <div
      ref={p.hostRef}
      aria-hidden="true"
      style={{ position: "fixed", left: 0, bottom: 0, width: "1px", height: "1px", opacity: 0.01, pointerEvents: "none", zIndex: -1, overflow: "hidden" }}
    />
  );

  if (!track) {
    return (
      <>
        {hiddenHost}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#212121]/95 backdrop-blur border-t border-[rgba(255,255,255,0.12)] h-[72px] flex items-center justify-center text-[14px] text-white/90">
          Selecione uma música para começar — YouTube Music
        </div>
      </>
    );
  }

  const pct = p.duration ? (p.currentTime / p.duration) * 100 : 0;

  return (
    <>
      {hiddenHost}

      {/* banner de erro removido: faixa com restrição/indisponível é resolvida ou pula automaticamente */}
      {p.playerError && !p.playerError.includes("restrição do dono") && !p.playerError.includes("não encontrado") && !p.playerError.includes("indisponível") && (
        <div className="fixed bottom-[72px] left-0 right-0 z-[59] bg-[#772222] text-white text-sm px-4 py-2 text-center">
          {p.playerError}
        </div>
      )}

      {/* ===== Tela "Tocando Agora" em tela cheia ===== */}
      {p.expanded && (
        <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[#131313] now-playing-enter">
          <img src={track.cover} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 blur-[90px] brightness-[0.45]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" />
          <div className="relative flex items-center justify-between px-5 md:px-8 py-4">
            <button onClick={() => p.setExpanded(false)} className="p-2.5 hover:bg-white/10 rounded-full" aria-label="Recolher"><ChevronsDown size={26} /></button>
            <div className="flex items-center gap-2 bg-black/40 rounded-full p-1 border border-white/10">
              {["Música", "Vídeo"].map((mode) => (
                <button
                  key={mode}
                  className={`px-4 py-1.5 rounded-full text-xs transition duration-150 ${mode === "Música" ? "bg-white text-black font-medium" : "text-white/80 hover:text-white"}`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button className="p-2.5 hover:bg-white/10 rounded-full" aria-label="Compartilhar" onClick={() => track.videoId && window.open(`https://www.youtube.com/watch?v=${track.videoId}`, "_blank")}><Share2 size={20} /></button>
              <button className="p-2.5 hover:bg-white/10 rounded-full" aria-label="Mais" onClick={() => p.setShowQueue(true)}><MoreVertical size={20} /></button>
            </div>
          </div>

          <div className="relative flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center px-5 md:px-8 py-2 min-h-0 overflow-y-auto no-scrollbar">
            {/* esquerda: capa grande / vídeo */}
            <div className="w-full max-w-[480px] mx-auto lg:mx-0 lg:justify-self-end">
              <img src={track.cover} alt="" className="w-full aspect-square rounded-2xl object-cover shadow-[0_24px_64px_rgba(0,0,0,0.7)]" />
              <div className="mt-7 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-[22px] md:text-[28px] font-bold leading-tight truncate">{track.title}</h2>
                  <p className="text-[#AAAAAA] mt-1 truncate">{track.artist}{track.album ? ` • ${track.album}` : ""}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 mt-1">
                  <button onClick={like} className={`p-2 hover:bg-white/10 rounded-full ${liking ? "heart-pop" : ""}`} aria-label="Curtir"><Heart size={22} className={isLiked ? "text-[#ff0033]" : ""} fill={isLiked ? "#ff0033" : "none"} /></button>
                  <button onClick={() => p.toggleDislike?.(track.id || track.videoId)} className={`p-2 hover:bg-white/10 rounded-full ${isDisliked ? "text-[#ff0033]" : "text-white/80"}`} aria-label="Não gostei"><ThumbsDown size={20} fill={isDisliked ? "#ff0033" : "none"} /></button>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3 text-xs text-white/50">
                <span className="tabular-nums">{fmt(p.currentTime)}</span>
                <div className="flex-1"><Progress p={p} track={track} /></div>
                <span className="tabular-nums">{fmt(p.duration || track.durationSec)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    const next = speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : speed === 1.5 ? 2 : speed === 2 ? 0.5 : 1;
                    p.setSpeed?.(next);
                  }}
                  className="h-9 px-3 rounded-full border border-white/20 text-[12px] hover:bg-white/10 tabular-nums"
                >{speed}×</button>
                <div className="flex items-center gap-5 md:gap-7">
                  <button onClick={p.toggleShuffle} className={p.shuffle ? "text-[#ff0033]" : "text-white/70 hover:text-white"} aria-label="Aleatório"><Shuffle size={22} /></button>
                  <button onClick={p.playPrev} aria-label="Anterior"><SkipBack size={34} fill="currentColor" /></button>
                  <button onClick={p.togglePlay} className="w-[68px] h-[68px] rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition duration-200 shadow-2xl" aria-label={p.isPlaying ? "Pausar" : "Tocar"}>
                    {p.isPlaying ? <Pause size={30} fill="black" /> : <Play size={30} fill="black" className="ml-1" />}
                  </button>
                  <button onClick={p.playNext} aria-label="Próxima"><SkipForward size={34} fill="currentColor" /></button>
                  <button onClick={p.cycleRepeat} className={p.repeat ? "text-[#ff0033]" : "text-white/70 hover:text-white"} aria-label="Repetir">{p.repeat === 2 ? <Repeat1 size={22} /> : <Repeat size={22} />}</button>
                </div>
                <button onClick={() => p.setShowLyrics(!p.showLyrics)} className={`h-9 px-3 rounded-full border text-[12px] ${p.showLyrics ? "border-[#ff0033] text-[#ff0033]" : "border-white/20 hover:bg-white/10"}`}>Letras</button>
              </div>
            </div>

            {/* direita: abas A SEGUIR / LETRA / RELACIONADAS */}
            <div className="w-full max-w-[480px] mx-auto lg:mx-0 lg:justify-self-start min-h-0 flex flex-col">
              <div className="flex items-center gap-2 border-b border-white/10">
                {[
                  { id: "queue", label: "A SEGUIR" },
                  { id: "lyrics", label: "LETRA" },
                  { id: "related", label: "RELACIONADAS" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setNtab(tab.id);
                      if (tab.id === "queue") { p.setShowQueue(true); p.setShowLyrics(false); }
                      else if (tab.id === "lyrics") { p.setShowLyrics(true); p.setShowQueue(false); }
                    }}
                    className={`px-4 py-3 text-[13px] font-medium tracking-wide border-b-2 -mb-px transition duration-150 ${ntab === tab.id ? "border-white text-white" : "border-transparent text-white/50 hover:text-white"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto py-4 min-h-[200px]">
                {ntab === "lyrics" ? (
                  <div className="text-[16px] leading-loose">
                    {p.loadingLyrics ? <p className="text-white/50">Carregando letra…</p> : lyricLines.length ? (
                      <div className="space-y-1">
                        {lyricLines.map((line, i) => (
                          <p
                            key={i}
                            className={`transition-all duration-300 ${i === activeLyric ? "text-white font-medium translate-x-1" : i < activeLyric ? "text-white/85" : "text-white/40"}`}
                          >
                            {line.text}
                          </p>
                        ))}
                      </div>
                    ) : <p className="text-white/50">Letra indisponível para esta faixa.</p>}
                  </div>
                ) : ntab === "related" ? (
                  <div className="space-y-0.5">
                    {loadingRelated && <p className="p-4 text-sm text-white/50">Carregando relacionadas…</p>}
                    {related.map((t, i) => (
                      <div key={String(t.videoId || t.id) + i} onClick={() => p.playTrack(t, related)} className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition duration-150 hover:bg-[rgba(255,255,255,0.1)]">
                        <img src={t.cover} alt="" className="w-9 h-9 rounded-sm object-cover" />
                        <div className="min-w-0 flex-1"><p className="text-[14px] font-medium truncate text-white">{t.title}</p><p className="text-[14px] text-[#AAAAAA] truncate">{t.artist}</p></div>
                        <span className="text-[12px] text-white/40 tabular-nums">{t.duration}</span>
                      </div>
                    ))}
                    {!loadingRelated && related.length === 0 && <p className="p-4 text-sm text-white/40">Nenhuma relacionada encontrada.</p>}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {p.queue.map((t, i) => {
                      const active = i === p.currentIndex;
                      return (
                        <div key={String(t.videoId || t.id) + i} onClick={() => p.jumpTo(i)} className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition duration-150 ${active ? "bg-[rgba(255,255,255,0.1)]" : "hover:bg-[rgba(255,255,255,0.1)]"}`}>
                          <img src={t.cover} alt="" className="w-9 h-9 rounded-sm object-cover" />
                          <div className="min-w-0 flex-1"><p className={`text-[14px] font-medium truncate ${active ? "text-[#ff0033]" : "text-white"}`}>{t.title}</p><p className="text-[14px] text-[#AAAAAA] truncate">{t.artist}</p></div>
                          {active && <span className="flex items-end gap-[2px] h-3">{[0,1,2].map((j) => <span key={j} className="eq-bar w-[3px] h-full bg-[#ff0033] rounded-full" style={{ animationPlayState: p.isPlaying ? "running" : "paused" }} />)}</span>}
                        </div>
                      );
                    })}
                    {p.queue.length === 0 && <p className="p-4 text-sm text-white/40">Fila vazia</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== barra fixa 72px ===== */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#212121]/95 backdrop-blur-md border-t border-[rgba(255,255,255,0.12)]">
        <Progress p={p} track={track} compact />
        <div className="flex items-center gap-3 px-3 md:px-4 h-[72px]">
          {/* esquerda: controles — ordem exata do oficial: Anterior, Voltar 10s, Tocar, Avançar 30s, Avançar */}
          <div className="flex items-center gap-1 w-[340px] shrink-0">
            <button onClick={p.playPrev} className="p-2 text-white/85 hover:text-white hover:bg-white/10 rounded-full" aria-label="Anterior"><SkipBack size={22} fill="currentColor" /></button>
            <button onClick={() => seekBy(-10)} className="p-2 text-white/85 hover:text-white hover:bg-white/10 rounded-full relative" aria-label="Voltar 10 segundos">
              <RotateCcw size={20} /><span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">10</span>
            </button>
            <button onClick={p.togglePlay} className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition duration-200 shadow" aria-label={p.isPlaying ? "Pausar" : "Tocar"}>
              {p.isPlaying ? <Pause size={22} fill="black" /> : <Play size={22} fill="black" className="ml-0.5" />}
            </button>
            <button onClick={() => seekBy(30)} className="p-2 text-white/85 hover:text-white hover:bg-white/10 rounded-full relative" aria-label="Avançar 30 segundos">
              <RotateCw size={20} /><span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">30</span>
            </button>
            <button onClick={p.playNext} className="p-2 text-white/85 hover:text-white hover:bg-white/10 rounded-full" aria-label="Avançar"><SkipForward size={22} fill="currentColor" /></button>
            <span className="text-[12px] text-white/50 ml-2 hidden md:inline tabular-nums whitespace-nowrap">{fmt(p.currentTime)} / {fmt(p.duration || track.durationSec)}</span>
          </div>

          {/* centro: capa + título + like/dislike/3pts — como o oficial */}
          <div className="flex-1 flex items-center justify-center gap-3 min-w-0 cursor-pointer px-2" onClick={() => p.setExpanded(true)}>
            <img src={track.cover} alt="" className="w-10 h-10 rounded-sm object-cover shrink-0" />
            <div className="min-w-0 text-center">
              <p className="text-[14px] font-medium truncate">{track.title}</p>
              <p className="text-[14px] text-[#AAAAAA] truncate">{track.artist}{track.album ? ` • ${track.album}` : ""}</p>
            </div>
          </div>
          <div className="flex items-center shrink-0">
            <button onClick={like} className={`p-2 hover:bg-white/10 rounded-full ${isLiked ? "text-[#ff0033]" : "text-white/70 hover:text-white"} ${liking ? "heart-pop" : ""}`} aria-label="Gostei">
              <Heart size={18} fill={isLiked ? "#ff0033" : "none"} />
            </button>
            <button onClick={() => p.toggleDislike?.(track.id || track.videoId)} className={`p-2 hover:bg-white/10 rounded-full ${isDisliked ? "text-[#ff0033]" : "text-white/70 hover:text-white"}`} aria-label="Não gostei"><ThumbsDown size={18} fill={isDisliked ? "#ff0033" : "none"} /></button>
            <button onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("ytm-ctx-open", { detail: { x: e.clientX, y: e.clientY - 220, track } })); }} className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white" aria-label="Menu de ações"><MoreVertical size={18} /></button>
          </div>

          {/* direita: volume, repetir, aleatório, expandir */}
          <div className="flex items-center gap-1 w-[300px] justify-end shrink-0">
            <span className="text-[11px] text-white/50 mr-1 hidden lg:inline tabular-nums">{fmt(p.currentTime)} / {fmt(p.duration || track.durationSec)}</span>
            <button onClick={() => p.setMuted(!p.muted)} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full" aria-label="Desativar som">{p.muted || p.volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
            <input type="range" min="0" max="1" step="0.01" value={p.muted ? 0 : p.volume} onChange={(e) => { p.setVolume(parseFloat(e.target.value)); p.setMuted(false); }} className="w-20 accent-white hidden lg:block" aria-label="Volume" />
            <div className="relative">
              <button onClick={() => { setShowSpeed((v) => !v); setShowMore(false); }} className="p-2 hover:bg-white/10 rounded-full text-[11px] tabular-nums text-white/70 hover:text-white" aria-label="Velocidade da reprodução">{speed}×</button>
              {showSpeed && (
                <div className="absolute bottom-full right-0 mb-2 w-40 bg-[#121212] border border-white/10 rounded-2xl shadow-2xl p-1.5 z-[70]">
                  {[0.5, 1, 1.25, 1.5, 2].map((s) => (
                    <button key={s} onClick={() => { p.setSpeed?.(s); setShowSpeed(false); }} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 text-[12px] ${speed === s ? "text-[#ff0033]" : ""}`}>
                      <span>{s}×</span>{speed === s && <span>●</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={p.cycleRepeat} className={`p-2 hover:bg-white/10 rounded-full ${p.repeat ? "text-[#ff0033]" : "text-white/70 hover:text-white"}`} aria-label={p.repeat === 2 ? "Repetir faixa" : "Repetição desativada"}>{p.repeat === 2 ? <Repeat1 size={18} /> : <Repeat size={18} />}</button>
            <button onClick={p.toggleShuffle} className={`p-2 hover:bg-white/10 rounded-full ${p.shuffle ? "text-[#ff0033]" : "text-white/70 hover:text-white"}`} aria-label="Ordem aleatória"><Shuffle size={18} /></button>
            <div className="relative">
              <button onClick={() => { setShowMore((v) => !v); setShowSpeed(false); }} className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white" aria-label="Mais controles do player"><MoreVertical size={18} /></button>
              {showMore && (
                <div className="absolute bottom-full right-0 mb-2 w-52 bg-[#121212] border border-white/10 rounded-2xl shadow-2xl p-1.5 z-[70]">
                  <button onClick={() => { p.setExpanded(true); setShowMore(false); }} className="w-full px-3 py-2 rounded-xl hover:bg-white/10 text-[12px] text-left">Abrir a página do player</button>
                  <button onClick={() => { p.setShowQueue(!p.showQueue); setShowMore(false); }} className="w-full px-3 py-2 rounded-xl hover:bg-white/10 text-[12px] text-left">Fila de reprodução</button>
                  <button onClick={() => { p.setShowLyrics(!p.showLyrics); setShowMore(false); }} className="w-full px-3 py-2 rounded-xl hover:bg-white/10 text-[12px] text-left">Letras</button>
                  <div className="relative">
                    <button onClick={() => setShowTimer((v) => !v)} className="w-full px-3 py-2 rounded-xl hover:bg-white/10 text-[12px] text-left">Timer de sono</button>
                    {showTimer && (
                      <div className="absolute bottom-0 right-full mr-1 w-40 bg-[#121212] border border-white/10 rounded-2xl shadow-2xl p-1.5 z-[71]">
                        {[{ v: null, l: "Desativado" }, { v: 300, l: "5 min" }, { v: 600, l: "10 min" }, { v: 900, l: "15 min" }, { v: 1800, l: "30 min" }, { v: 2700, l: "45 min" }, { v: 3600, l: "1 hora" }, { v: "end", l: "Fim da faixa" }].map((o) => (
                          <button key={o.l} onClick={() => { p.setSleepTimer?.(o.v); setShowTimer(false); setShowMore(false); }} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 text-[12px] ${p.sleepTimer === o.v || (o.v === null && !p.sleepTimer) ? "text-[#ff0033]" : ""}`}>
                            <span>{o.l}</span>{p.sleepTimer === o.v && <span>●</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => p.setExpanded(!p.expanded)} className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white" aria-label={p.expanded ? "Recolher" : "Abrir a página do player"}>
              {p.expanded ? <ChevronsDown size={20} /> : <ChevronUp size={20} />}
            </button>
          </div>
        </div>

        {(p.showQueue || p.showLyrics) && !p.expanded && (
          <div className="absolute bottom-full right-3 mb-2 w-[380px] max-w-[92vw] bg-[#121212] border border-white/10 rounded-2xl shadow-2xl max-h-[65vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="font-medium text-sm">{p.showQueue ? "Fila de reprodução" : "Letras"}</span>
              <button onClick={() => { p.setShowQueue(false); p.setShowLyrics(false); }} className="p-1 hover:bg-white/10 rounded-full"><X size={18} /></button>
            </div>
            <div className="flex gap-2 px-4 pt-3">
              <button onClick={() => { p.setShowQueue(true); p.setShowLyrics(false); }} className={`rounded-full px-3 py-1.5 text-xs ${p.showQueue ? "bg-white text-black font-medium" : "bg-[rgba(255,255,255,0.1)] hover:bg-white/20"}`}>Fila</button>
              <button onClick={() => { p.setShowLyrics(true); p.setShowQueue(false); }} className={`rounded-full px-3 py-1.5 text-xs ${p.showLyrics ? "bg-white text-black font-medium" : "bg-[rgba(255,255,255,0.1)] hover:bg-white/20"}`}>Letras</button>
            </div>
            {p.showQueue ? (
              <div className="overflow-y-auto p-2">
                {p.queue.map((t, i) => {
                  const active = i === p.currentIndex;
                  return (
                    <div key={String(t.videoId || t.id) + i} onClick={() => p.jumpTo(i)} className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition duration-150 ${active ? "bg-[rgba(255,255,255,0.1)]" : "hover:bg-[rgba(255,255,255,0.1)]"}`}>
                      <img src={t.cover} alt="" className="w-9 h-9 rounded-sm object-cover" />
                      <div className="min-w-0 flex-1"><p className={`text-[14px] font-medium truncate ${active ? "text-[#ff0033]" : "text-white"}`}>{t.title}</p><p className="text-[14px] text-[#AAAAAA] truncate">{t.artist}</p></div>
                      {active && <span className="flex items-end gap-[2px] h-3">{[0,1,2].map((j) => <span key={j} className="eq-bar w-[3px] h-full bg-[#ff0033] rounded-full" style={{ animationPlayState: p.isPlaying ? "running" : "paused" }} />)}</span>}
                    </div>
                  );
                })}
                {p.queue.length === 0 && <p className="p-4 text-sm text-white/40">Fila vazia</p>}
              </div>
            ) : (
              <div className="overflow-y-auto p-4 text-sm leading-relaxed">
                <p className="font-medium mb-2">{track.title} — {track.artist}</p>
                {p.loadingLyrics ? <p className="text-white/50">Carregando letra…</p> : lyricLines.length ? (
                  <div className="space-y-1 text-[14px]">
                    {lyricLines.map((line, i) => (
                      <p key={i} className={`${i === activeLyric ? "text-white font-medium" : "text-white/45"}`}>{line.text}</p>
                    ))}
                  </div>
                ) : <p className="text-white/50">Letra indisponível para esta faixa — a música completa está tocando via YouTube. 🎵</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
