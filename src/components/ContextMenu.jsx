import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Play, Plus, Trash2, Download, Share2, ListMusic, Radio, X, Check } from "lucide-react";
import { useLibrary } from "../context/LibraryContext";
import { DB } from "../db/database";

const Ctx = createContext(null);
export const useCtxMenu = () => useContext(Ctx);

export function ContextMenuProvider({ children }) {
  const [state, setState] = useState(null); // {x,y,track}
  const [picking, setPicking] = useState(false); // modo "adicionar a playlist"
  const [newName, setNewName] = useState("");
  const lib = useLibrary();
  const ref = useRef(null);

  const open = useCallback((x, y, track) => {
    setPicking(false);
    setNewName("");
    setState({ x, y, track });
  }, []);

  // ponte para componentes fora da árvore (PlayerBar usa eventos)
  useEffect(() => {
    const onOpen = (e) => open(e.detail.x, e.detail.y, e.detail.track);
    window.addEventListener("ytm-ctx-open", onOpen);
    return () => window.removeEventListener("ytm-ctx-open", onOpen);
  }, [open]);

  const close = useCallback(() => { setState(null); setPicking(false); }, []);

  useEffect(() => {
    if (!state) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [state, close]);

  const track = state?.track;
  const videoId = track ? String(track.videoId || track.id || "") : "";
  const isDownloaded = videoId ? lib.downloads.some((d) => String(d.videoId) === videoId) : false;

  const onPlay = () => { close(); window.dispatchEvent(new CustomEvent("ytm-ctx-play", { detail: track })); };
  const onPlayRadio = () => { close(); window.dispatchEvent(new CustomEvent("ytm-ctx-radio", { detail: track })); };
  const onShare = () => {
    const url = `https://music.youtube.com/watch?v=${videoId}`;
    try { navigator.clipboard?.writeText(url); } catch {}
    close();
  };
  const onDownload = async () => { if (track) { await lib.toggleDownload(track); } close(); };
  const onAdd = async (plId) => {
    if (track) { await lib.addToPlaylist(plId, track); }
    close();
  };
  const onCreateAndAdd = async () => {
    if (!newName.trim()) return;
    const pl = await lib.addPlaylist(newName.trim());
    if (pl && track) await lib.addToPlaylist(pl.id, track);
    close();
  };

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {state && (
        <div ref={ref} className="fixed z-[120] w-64 bg-[#212121] border border-white/10 rounded-2xl shadow-2xl p-1.5 fade-up"
          style={{ left: Math.min(state.x, window.innerWidth - 270), top: Math.min(state.y, window.innerHeight - 340) }}>
          {!picking ? (
            <>
              <button onClick={onPlay} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-[13px]"><Play size={16} /> Tocar</button>
              <button onClick={onPlayRadio} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-[13px]"><Radio size={16} /> Iniciar rádio</button>
              <button onClick={() => setPicking(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-[13px]"><Plus size={16} /> Adicionar à playlist</button>
              <button onClick={onDownload} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-[13px]">
                <Download size={16} /> {isDownloaded ? "Remover dos downloads" : "Baixar para ouvir off-line"}
              </button>
              <button onClick={onShare} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-[13px]"><Share2 size={16} /> Compartilhar</button>
              <div className="h-px bg-white/10 my-1" />
              <button onClick={close} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-[13px] text-white/60"><X size={16} /> Fechar</button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[13px] font-medium">Adicionar a</span>
                <button onClick={close} className="p-1 hover:bg-white/10 rounded-full"><X size={16} /></button>
              </div>
              <div className="max-h-44 overflow-y-auto">
                {lib.playlists.map((pl) => {
                  const has = (pl.trackIds || []).includes(videoId);
                  return (
                    <button key={pl.id} onClick={() => onAdd(pl.id)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 text-[13px] text-left">
                      <ListMusic size={16} className="shrink-0 text-white/60" />
                      <span className="truncate flex-1">{pl.name}</span>
                      {has && <Check size={15} className="text-[#FF0000] shrink-0" />}
                    </button>
                  );
                })}
                {lib.playlists.length === 0 && <p className="px-3 py-2 text-[12px] text-white/40">Nenhuma playlist ainda — crie a primeira abaixo.</p>}
              </div>
              <div className="flex items-center gap-2 px-2 pt-2">
                <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onCreateAndAdd()}
                  placeholder="Nova playlist" className="flex-1 min-w-0 bg-white/10 rounded-full px-3 py-2 text-[13px] outline-none" />
                <button onClick={onCreateAndAdd} className="h-8 px-3 rounded-full bg-white text-black text-xs font-medium hover:bg-white/90">Criar</button>
              </div>
            </>
          )}
        </div>
      )}
    </Ctx.Provider>
  );
}

// Helper usado por TrackCard: abre menu no positionX/Y
export function useTrackMenu(track) {
  const ctx = useCtxMenu();
  return useCallback((e) => {
    e?.stopPropagation?.();
    const x = e?.clientX ?? window.innerWidth / 2;
    const y = e?.clientY ?? window.innerHeight / 2;
    ctx?.open(x, y, track);
  }, [ctx, track]);
}
