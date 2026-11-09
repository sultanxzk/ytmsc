import { useEffect, useRef, useState } from "react";
import { Search, X, Menu, Settings, HelpCircle, LogOut, Play, TrendingUp, Cast } from "lucide-react";
import { MOODS } from "../data/moods";
import { useAuth } from "../context/AuthContext";
import { getSuggestions } from "../api/musicApi";

const FILTERS = [
  { id: "featured", label: "Playlists em destaque" },
  { id: "artists", label: "Artistas" },
  { id: "songs", label: "Músicas" },
  { id: "videos", label: "Vídeos" },
  { id: "playlists", label: "Playlists da comunidade" },
  { id: "profiles", label: "Perfis" },
  { id: "albums", label: "Álbuns" },
  { id: "podcasts", label: "Podcasts" },
];

export default function Topbar({ query, setQuery, activeMood, setActiveMood, collapsed, setCollapsed, filter, setFilter, suggestions = [], onPickSuggestion, scrolled = false, onGoHome }) {
  const { user, isLoggedIn, logout, setAuthOpen, setProfileOpen } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showSearchMenu, setShowSearchMenu] = useState(false);
  const [textSuggestions, setTextSuggestions] = useState([]);
  const menuRef = useRef(null);
  const didInit = useRef(false);

  // hydrate from localStorage/defaults on mount
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    try {
      const s = localStorage.getItem("ytm-settings");
      if (s) {
        const parsed = JSON.parse(s);
        if (typeof parsed.query === "string") setQuery(parsed.query);
        if (parsed.activeMood) setActiveMood(parsed.activeMood);
        if (parsed.filter) setFilter(parsed.filter);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const close = () => { setShowMenu(false); setShowSearchMenu(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  // sugestões de texto instantâneas
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setTextSuggestions([]); return; }
    const t = setTimeout(() => {
      getSuggestions(q).then(setTextSuggestions).catch(() => setTextSuggestions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const persist = (patch) => {
    try {
      const cur = JSON.parse(localStorage.getItem("ytm-settings") || "{}");
      localStorage.setItem("ytm-settings", JSON.stringify({ ...cur, ...patch }));
    } catch {}
  };

  const q = query.trim();
  const showSuggest = showSearchMenu && q.length > 1 && (suggestions.length > 0 || textSuggestions.length > 0);

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-200 ${scrolled ? "bg-[#131313]/80 backdrop-blur-md" : "bg-transparent"}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 px-4 h-16">
        {/* Guide — como no oficial (botão Guide [pressed] + link Início) */}
        <button
          onClick={() => { onGoHome?.(); }}
          aria-pressed={true}
          aria-label="Guide"
          className="p-2 hover:bg-white/10 rounded-full shrink-0"
          title="Guide"
        >
          <Menu size={20} />
        </button>
        <button
          onClick={() => { onGoHome?.(); }}
          className="hidden sm:flex items-center gap-1.5 select-none shrink-0"
          aria-label="Início"
        >
          <svg width="28" height="28" viewBox="0 0 28 28" className="shrink-0">
            <circle cx="14" cy="14" r="12.5" fill="#ff0033" />
            <path d="M11 9.5v9l7-4.5z" fill="#fff" />
          </svg>
          <span className="text-[16px] leading-none tracking-tight hidden lg:inline">
            <span className="font-normal">YouTube</span> <span className="font-medium">Music</span>
          </span>
        </button>

        {/* busca central estilo pílula — como no oficial */}
        <div className="flex-1 max-w-[600px] mx-auto relative">
          <div className="relative flex items-center">
            <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-1" aria-label="Iniciar pesquisa">
              <Search size={20} />
            </button>
            <input
              ref={(el) => { if (el) el.id = "ytm-search-input"; }}
              value={query}
              onChange={(e) => { const v = e.target.value; setQuery(v); persist({ query: v }); setShowSearchMenu(true); }}
              onFocus={() => setShowSearchMenu(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setShowSearchMenu(false);
                if (e.key === "Escape") { setQuery(""); persist({ query: "" }); setShowSearchMenu(false); e.currentTarget.blur(); }
              }}
              placeholder="Pesquise músicas, álbuns, artistas e podcasts"
              aria-label="Pesquise músicas, álbuns, artistas e podcasts"
              className="w-full bg-[rgba(255,255,255,0.1)] border border-white/10 hover:border-white/20 focus:border-white/30 focus:bg-white/[0.14] rounded-full h-10 pl-11 pr-10 text-[14px] outline-none placeholder:text-white/50 transition"
            />
            {query && (
              <button onClick={() => { setQuery(""); persist({ query: "" }); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full text-white/60" aria-label="Limpar"><X size={18} /></button>
            )}
            {showSuggest && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#212121] border border-white/10 rounded-2xl shadow-2xl p-1.5 z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
                {suggestions.slice(0, 5).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { onPickSuggestion?.(t); setShowSearchMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 text-left"
                  >
                    <img src={t.cover} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] truncate">{t.title}</span>
                      <span className="block text-[11px] text-white/50 truncate">{t.artist}</span>
                    </span>
                    <Play size={14} className="text-white/50" fill="white" />
                  </button>
                ))}
                {textSuggestions.filter((s) => !suggestions.some((t) => t.title === s)).slice(0, 8).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setQuery(s); persist({ query: s }); setShowSearchMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 text-left"
                  >
                    <TrendingUp size={15} className="text-white/40 shrink-0" />
                    <span className="text-[13px] truncate">{s}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button className="p-2 rounded-full hover:bg-white/10 text-white/80 hidden sm:block" aria-label="Conectar a um dispositivo" title="Conectar a um dispositivo"><Cast size={20} /></button>

          {isLoggedIn ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-[#3ea6ff] to-[#ff0033] hover:opacity-90 flex items-center justify-center text-sm font-semibold text-white"
                aria-label={user.name}
              >
                {user.photo ? <img src={user.photo} alt="" className="w-full h-full object-cover" /> : user.initials}
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#212121] border border-white/10 rounded-2xl shadow-2xl p-2 z-50">
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <span className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#3ea6ff] to-[#ff0033] flex items-center justify-center text-sm font-semibold">
                      {user.photo ? <img src={user.photo} alt="" className="w-full h-full object-cover" /> : user.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium truncate">{user.name}</p>
                      <p className="text-[12px] text-white/50 truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="h-px bg-white/10 my-1" />
                  <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-[13px]"><span className="text-white/70">★</span> YouTube Music Premium</button>
                  <button onClick={() => { setShowMenu(false); setProfileOpen(true); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-[13px]"><Settings size={16} /> Editar perfil / conta</button>
                  <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-[13px]"><HelpCircle size={16} /> Ajuda</button>
                  <div className="h-px bg-white/10 my-1" />
                  <button onClick={() => { logout(); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-[13px] text-red-400"><LogOut size={16} /> Sair</button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => setAuthOpen(true)} className="h-9 px-4 rounded-full bg-white text-black text-[13px] font-medium whitespace-nowrap hover:bg-white/85">Fazer login</button>
          )}
        </div>
      </div>

      {/* chips de mood como tab no oficial — ordem exata + role tab */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-3" role="tablist" aria-label="Momentos">
        {MOODS.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={activeMood === m.id}
            onClick={() => { const next = activeMood === m.id ? null : m.id; setActiveMood(next); persist({ activeMood: next }); }}
            className={`shrink-0 rounded-full px-4 h-8 text-[13px] transition ${activeMood === m.id ? "bg-white text-black font-medium" : "bg-[rgba(255,255,255,0.1)] hover:bg-white/[0.16] text-white"}`}
          >
            {m.label}
          </button>
        ))}
        {q && FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => { setFilter?.(f.id); persist({ filter: f.id }); }}
            className={`shrink-0 rounded-full px-3.5 h-8 text-[13px] ${filter === f.id ? "bg-white text-black font-medium" : "bg-[rgba(255,255,255,0.1)] border border-white/10 text-white/80 hover:bg-white/20"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </header>
  );
}
