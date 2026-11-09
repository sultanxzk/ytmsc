import { useState } from "react";
import { Play, Pause, Heart, ThumbsDown, MoreVertical, Music2 } from "lucide-react";
import { usePlayer } from "../context/PlayerContext";
import { useTrackMenu } from "./ContextMenu";

// Card oficial: 226x226 (ytmusic-two-row-item-renderer, w226-h226), overlay bottom-right
// no hover, título + subtitle em 2 linhas, botões "Reproduzir X" / "Menu de ações" via aria

function Eq({ playing, white = false }) {
  return (
    <span className={`flex items-end gap-[2.5px] h-3.5 ${white ? "eq-white" : ""}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`eq-bar w-[3px] h-full rounded-full ${white ? "bg-white" : "bg-[#ff0033]"}`}
          style={{ animationPlayState: playing ? "running" : "paused" }}
        />
      ))}
    </span>
  );
}

export function CoverCard({ track, onPlay, compact }) {
  const { currentTrack, isPlaying, liked, toggleLike, disliked, toggleDislike } = usePlayer();
  const menu = useTrackMenu(track);
  const [liking, setLiking] = useState(false);
  const active = currentTrack && String(currentTrack.id || currentTrack.videoId) === String(track.id || track.videoId);
  const isLiked = liked.includes(String(track.id || track.videoId));
  const isDisliked = (disliked || []).includes(String(track.id || track.videoId));
  const like = (e) => { e.stopPropagation(); setLiking(true); toggleLike(track.id || track.videoId); setTimeout(() => setLiking(false), 400); };
  const size = compact ? 132 : 226;
  return (
    <div
      role="listitem"
      aria-label={`Reproduzir ${track.title} Menu de ações`}
      className="group shrink-0 cursor-pointer fade-up"
      style={{ width: size }}
      onClick={() => onPlay(track)}
    >
      <div
        className="relative overflow-hidden bg-[#212121]"
        style={{ width: size, height: size }}
      >
        <img src={track.cover} alt="" width={size} height={size} className="w-full h-full object-cover" loading="lazy" />
        {/* overlay inferior-direito no hover — como o oficial */}
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-150 ${active ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5), rgba(0,0,0,0) 40%)" }} />
          <div className="absolute right-2 bottom-2 flex items-center gap-1.5 pointer-events-auto">
            <button
              onClick={(e) => { e.stopPropagation(); onPlay(track); }}
              aria-label={`Reproduzir ${track.title}`}
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-105 transition"
            >
              {active && isPlaying ? <Pause size={18} fill="black" /> : <Play size={18} fill="black" className="ml-0.5" />}
            </button>
            <button onClick={menu} aria-label="Menu de ações" className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center">
              <MoreVertical size={20} />
            </button>
          </div>
        </div>
        {active && (
          <span className="absolute bottom-2.5 right-2.5 bg-black/60 rounded-full px-2 py-1">
            <Eq playing={isPlaying} white />
          </span>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className={`text-[14px] font-medium truncate ${active ? "text-[#ff0033]" : "text-white"}`}>{track.title}</p>
        <p className="text-[14px] text-[#AAAAAA] truncate mt-0.5">{track.artist}{track.viewsLabel ? ` • ${track.viewsLabel}` : track.album ? ` • ${track.album}` : ""}</p>
      </div>
    </div>
  );
}

export function AlbumCard({ album, onOpen }) {
  const size = 226;
  return (
    <div
      role="listitem"
      aria-label={`Reproduzir ${album.title} Menu de ações`}
      className="group shrink-0 cursor-pointer fade-up"
      style={{ width: size }}
      onClick={() => onOpen(album)}
    >
      <div className="relative overflow-hidden bg-[#212121]" style={{ width: size, height: size }}>
        <img src={album.cover} alt="" width={size} height={size} className="w-full h-full object-cover" loading="lazy" />
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5), rgba(0,0,0,0) 40%)" }} />
          <div className="absolute right-2 bottom-2 flex items-center gap-1.5 pointer-events-auto">
            <button aria-label={`Reproduzir ${album.title}`} className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-105 transition">
              <Play size={18} fill="black" className="ml-0.5" />
            </button>
          </div>
        </div>
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-[14px] font-medium truncate">{album.title}</p>
        <p className="text-[14px] text-[#AAAAAA] truncate mt-0.5">{album.artist}{album.year ? ` • ${album.year}` : ""}{album.viewsLabel ? ` • ${album.viewsLabel}` : ""}</p>
      </div>
    </div>
  );
}

export function ArtistCard({ artist, onOpen }) {
  const size = 226;
  return (
    <div
      role="listitem"
      className="group shrink-0 cursor-pointer fade-up text-center"
      style={{ width: size }}
      onClick={() => onOpen(artist)}
    >
      <div className="relative rounded-full overflow-hidden bg-[#212121]" style={{ width: size, height: size }}>
        <img src={artist.cover} alt="" width={size} height={size} className="w-full h-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition duration-150">
          <span className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow group-hover:scale-110 transition-transform duration-200"><Play size={20} fill="black" className="ml-0.5" /></span>
        </div>
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-[14px] font-medium truncate">{artist.name}</p>
        <p className="text-[14px] text-[#AAAAAA] truncate mt-0.5">Artista{artist.monthlyAudience ? ` • ${artist.monthlyAudience}` : ""}</p>
      </div>
    </div>
  );
}

export function TrackRow({ track, onPlay, index }) {
  const { currentTrack, isPlaying, liked, toggleLike, disliked, toggleDislike } = usePlayer();
  const menu = useTrackMenu(track);
  const [liking, setLiking] = useState(false);
  const active = currentTrack && String(currentTrack.id || currentTrack.videoId) === String(track.id || track.videoId);
  const isLiked = liked.includes(String(track.id || track.videoId));
  const isDisliked = (disliked || []).includes(String(track.id || track.videoId));
  const like = (e) => { e.stopPropagation(); setLiking(true); toggleLike(track.id || track.videoId); setTimeout(() => setLiking(false), 400); };
  return (
    <div
      onClick={() => onPlay(track)}
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition duration-150 ${active ? "bg-[rgba(255,255,255,0.12)] track-active" : "hover:bg-[rgba(255,255,255,0.1)]"}`}
    >
      <span className="w-6 shrink-0 text-center text-[13px] text-white/40">
        {active ? (
          isPlaying ? <Eq playing={isPlaying} /> : <span className="text-[#ff0033]"><Music2 size={14} className="inline" /></span>
        ) : (
          <>
            <span className="group-hover:hidden tabular-nums">{index + 1}</span>
            <Play size={13} className="hidden group-hover:inline ml-1.5" fill="white" />
          </>
        )}
      </span>
      <img src={track.cover} alt="" className="w-10 h-10 rounded-[6px] object-cover shrink-0" loading="lazy" />
      <div className="min-w-0 flex-1">
        <p className={`text-[14px] font-medium truncate ${active ? "text-[#ff0033]" : "text-white"}`}>{track.title}{track.explicit && <span className="ml-1.5 inline-block text-[9px] bg-white/20 rounded px-1 py-0.5 align-middle leading-none">E</span>}</p>
        <p className="text-[14px] text-[#AAAAAA] truncate">{track.artist}{track.viewsLabel ? ` • ${track.viewsLabel}` : ""}</p>
      </div>
      <span className="hidden md:block text-[12px] text-white/40 truncate max-w-[220px]">{track.album}</span>
      <span className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition duration-150">
        <button onClick={like} className={`p-1.5 hover:bg-white/10 rounded-full ${liking ? "heart-pop" : ""}`} aria-label="Marcar como Gostei">
          <Heart size={16} className={isLiked ? "text-[#ff0033]" : "text-white/70"} fill={isLiked ? "#ff0033" : "none"} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); toggleDislike?.(track.id || track.videoId); }} className="p-1.5 hover:bg-white/10 rounded-full" aria-label="Marcar como Não gostei">
          <ThumbsDown size={16} className={isDisliked ? "text-[#ff0033]" : "text-white/70"} fill={isDisliked ? "#ff0033" : "none"} />
        </button>
        <button onClick={menu} className="p-1.5 hover:bg-white/10 rounded-full text-white/70" aria-label="Menu de ações">
          <MoreVertical size={16} />
        </button>
      </span>
      <span className="text-[12px] text-white/40 w-10 text-right shrink-0 tabular-nums">{track.duration}</span>
    </div>
  );
}

/* Quick Picks — como o oficial: 3 colunas × 4 linhas, sem paginação, capa 48×48,
   linha 2 com "• Tocou X vezes • Álbum", botões "Marcar como Gostei/Não gostei/Menu de ações" */
export function QuickPickCard({ track, onPlay }) {
  const { currentTrack, isPlaying, liked, toggleLike, disliked, toggleDislike } = usePlayer();
  const menu = useTrackMenu(track);
  const [liking, setLiking] = useState(false);
  const active = currentTrack && String(currentTrack.id || currentTrack.videoId) === String(track.id || track.videoId);
  const isLiked = liked.includes(String(track.id || track.videoId));
  const isDisliked = (disliked || []).includes(String(track.id || track.videoId));
  const like = (e) => { e.stopPropagation(); setLiking(true); toggleLike(track.id || track.videoId); setTimeout(() => setLiking(false), 400); };
  return (
    <div
      role="listitem"
      onClick={() => onPlay(track)}
      className={`group flex items-center gap-3 px-2 py-1.5 rounded-lg cursor-pointer transition duration-150 min-w-0 ${active ? "bg-[rgba(255,255,255,0.12)] track-active" : "hover:bg-[rgba(255,255,255,0.1)]"}`}
    >
      <span className="relative w-[48px] h-[48px] rounded-sm overflow-hidden shrink-0 bg-[#212121]">
        <img src={track.cover} alt="" className="w-full h-full object-cover" loading="lazy" width="48" height="48" />
        <span className={`absolute inset-0 bg-black/50 items-center justify-center ${active ? "flex" : "hidden group-hover:flex"}`}>
          {active && isPlaying ? <Eq playing={isPlaying} white /> : <Play size={18} fill="white" className="ml-0.5" />}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[14px] font-medium truncate leading-snug ${active ? "text-[#ff0033]" : "text-white"}`}>{track.title}</span>
        <span className="block text-[14px] text-[#AAAAAA] truncate">
          {track.artist}
          {track.playCountLabel ? ` • ${track.playCountLabel} • ` : track.album ? ` • ` : ""}
          {track.album || ""}
        </span>
      </span>
      <span className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition duration-150">
        <button
          onClick={like}
          className={`p-1.5 hover:bg-white/10 rounded-full ${liking ? "heart-pop" : ""}`}
          aria-label="Marcar como Gostei"
        >
          <Heart size={16} className={isLiked ? "text-[#ff0033]" : "text-white/70"} fill={isLiked ? "#ff0033" : "none"} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); toggleDislike?.(track.id || track.videoId); }}
          className="p-1.5 hover:bg-white/10 rounded-full"
          aria-label="Marcar como Não gostei"
        >
          <ThumbsDown size={16} className={isDisliked ? "text-[#ff0033]" : "text-white/70"} fill={isDisliked ? "#ff0033" : "none"} />
        </button>
        <button
          onClick={menu}
          className="p-1.5 hover:bg-white/10 rounded-full text-white/70"
          aria-label="Menu de ações"
        >
          <MoreVertical size={16} />
        </button>
      </span>
    </div>
  );
}

export function QuickPicksGrid({ tracks, onPlay }) {
  const chunk = (tracks || []).slice(0, 12);
  const cols = [0, 1, 2].map((c) => chunk.filter((_, i) => i % 3 === c));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-4 gap-y-1" role="list">
      {cols.map((col, ci) => (
        <div key={ci} className="space-y-1 min-w-0">
          {col.map((t) => <QuickPickCard key={t.id || t.videoId} track={t} onPlay={onPlay} />)}
        </div>
      ))}
    </div>
  );
}
