import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKeyboardShortcuts } from "./hook/useKeyboardShortcuts";
import { PlayerProvider, usePlayer } from "./context/PlayerContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LibraryProvider, useLibrary } from "./context/LibraryContext";
import { ToastProvider } from "./context/ToastContext";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import PlayerBar from "./components/PlayerBar";
import LoginModal from "./components/LoginModal";
import ProfileModal from "./components/ProfileModal";
import { ContextMenuProvider, useCtxMenu } from "./components/ContextMenu";
import { CoverCard, AlbumCard, ArtistCard, TrackRow, QuickPicksGrid } from "./components/TrackCard";
import { searchAllDetailed, searchTracks, fetchHome, getAlbumTracks, getArtist, getExplore, getPlaylistTracks, getBrowsePage, HOME_SECTIONS, MOOD_QUERIES, GENRES, EXPLORE_TABS } from "./api/musicApi";
import { FALLBACK_TRACKS } from "./data/tracks";
import { MOODS } from "./data/moods";
import { DB } from "./db/database";
import { Play, Search, Music2, Disc3, Compass, Radio, ChevronRight, ChevronLeft, ArrowLeft, Shuffle, ListMusic, RefreshCw, Users, Download, Clock } from "lucide-react";

// fallback em fatias distintas para cada seção (nunca vazio)
const FALLBACK_HOME = {
  late: FALLBACK_TRACKS.slice(0, 8),
  dreams: FALLBACK_TRACKS.slice(0, 8),
  artists: FALLBACK_TRACKS.slice(0, 8),
  quick: FALLBACK_TRACKS.slice(4, 12),
  trending: FALLBACK_TRACKS.slice(0, 8),
  weekend: FALLBACK_TRACKS.slice(0, 8),
  calm: FALLBACK_TRACKS.slice(4, 12),
  albums: [],
};

function Section({ title, subtitle, children, onPlayAll, onOpen }) {
  const ref = useRef(null);
  const scrollBy = (dir) => ref.current?.scrollBy({ left: dir * 560, behavior: "smooth" });
  // como no oficial: "Anterior" disabled na esquerda, "Avançar" na direita —
  // botões de seta no topo direito, sem "Ver tudo" nem "Próximo"
  return (
    <section className="px-4 md:px-6 py-6 fade-up">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-[24px] md:text-[28px] font-bold leading-tight tracking-tight">{title}</h2>
          {subtitle && <p className="text-[14px] text-[#AAAAAA] mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {onPlayAll && (
            <button onClick={onPlayAll} aria-label="Reproduzir tudo" className="flex items-center gap-2 rounded-full bg-white text-black px-4 py-2 text-[12px] font-medium hover:bg-white/85 mr-1">
              <Play size={13} fill="black" /> Tocar tudo
            </button>
          )}
          <button onClick={() => scrollBy(-1)} aria-label="Anterior" className="w-9 h-9 rounded-full bg-[rgba(255,255,255,0.1)] hover:bg-white/20 flex items-center justify-center transition duration-150"><ChevronLeft size={20} /></button>
          <button onClick={() => scrollBy(1)} aria-label="Avançar" className="w-9 h-9 rounded-full bg-[rgba(255,255,255,0.1)] hover:bg-white/20 flex items-center justify-center transition duration-150"><ChevronRight size={20} /></button>
        </div>
      </div>
      <div ref={ref} className="flex gap-4 overflow-x-auto pb-1 no-scrollbar scroll-smooth" role="list">{children}</div>
    </section>
  );
}

function SkeletonRow() {
  return (
    <div className="px-4 md:px-6 py-5">
      <div className="h-5 w-48 bg-white/10 rounded mb-4 animate-pulse" />
      <div className="flex gap-3.5">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="w-[168px] shrink-0"><div className="w-[168px] h-[168px] rounded-[10px] bg-white/10 animate-pulse" /><div className="h-3 w-3/4 bg-white/10 rounded mt-2 animate-pulse" /><div className="h-3 w-1/2 bg-white/10 rounded mt-1.5 animate-pulse" /></div>)}</div>
    </div>
  );
}

function Shell() {
  const p = usePlayer();
  useKeyboardShortcuts(p);
  const { user, isLoggedIn } = useAuth();
  const lib = useLibrary();
  const ctxMenu = useCtxMenu();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [activeMood, setActiveMood] = useState(null);
  const [activeView, setActiveView] = useState("home");
  const [filter, setFilter] = useState("songs");
  const [results, setResults] = useState([]);
  const [artistResults, setArtistResults] = useState([]);
  const [albumResults, setAlbumResults] = useState([]);
  const [playlistResults, setPlaylistResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [exploreData, setExploreData] = useState(null);
  const [browsePage, setBrowsePage] = useState(null);
  const [home, setHome] = useState({});
  const [loadingHome, setLoadingHome] = useState(true);
  const [exploreGenre, setExploreGenre] = useState(null);
  const [exploreTracks, setExploreTracks] = useState([]);
  const [loadingExplore, setLoadingExplore] = useState(false);
  const [openPl, setOpenPl] = useState(null);
  const [plTracks, setPlTracks] = useState([]);
  const [openAlbum, setOpenAlbum] = useState(null);
  const [albumTracks, setAlbumTracks] = useState([]);
  const [openArtist, setOpenArtist] = useState(null);
  const [artistData, setArtistData] = useState(null);
  const [likedTracks, setLikedTracks] = useState([]);
  const [historyTracks, setHistoryTracks] = useState([]);
  const [downloadTracks, setDownloadTracks] = useState([]);
  const [subArtists, setSubArtists] = useState([]);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef(null);
  const reqId = useRef(0);

  // ---- debounce da busca (300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // ---- atalho "/" foca na busca
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target?.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable) return;
        e.preventDefault();
        document.getElementById("ytm-search-input")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- busca YouTube Music (tipo unificado, como no YTM real)
  useEffect(() => {
    if (!debouncedQ && !activeMood) { setResults([]); setArtistResults([]); setAlbumResults([]); setPlaylistResults([]); setLoadingSearch(false); return; }
    const id = ++reqId.current;
    setLoadingSearch(true);
    const term = debouncedQ || MOOD_QUERIES[activeMood];
    searchAllDetailed(term).then((res) => {
      if (reqId.current !== id) return;
      setResults(res.tracks || []);
      setArtistResults(res.artists || []);
      setAlbumResults(res.albums || []);
      setPlaylistResults(res.playlists || []);
    }).catch(() => {
      setResults([]); setArtistResults([]); setAlbumResults([]); setPlaylistResults([]);
    }).finally(() => { if (reqId.current === id) setLoadingSearch(false); });
  }, [debouncedQ, activeMood]);

  // ---- home
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const homeRes = await fetchHome();
        if (cancelled) return;
        if (homeRes && (homeRes.tracks?.length || homeRes.trending?.length)) {
          setHome({
            late: homeRes.late?.length ? homeRes.late : homeRes.tracks.slice(0, 8),
            quick: homeRes.quick?.length ? homeRes.quick : homeRes.tracks.slice(4, 12),
            artists: homeRes.artists?.length ? homeRes.artists : homeRes.tracks.slice(8, 16),
            trending: homeRes.trending?.length ? homeRes.trending : homeRes.tracks.slice(0, 12),
            dreams: homeRes.dreams?.length ? homeRes.dreams : homeRes.tracks.slice(0, 8),
            weekend: homeRes.weekend?.length ? homeRes.weekend : homeRes.tracks.slice(0, 8),
            calm: homeRes.calm?.length ? homeRes.calm : homeRes.tracks.slice(4, 12),
            albums: homeRes.albums || [],
          });
        } else setHome(FALLBACK_HOME);
      } catch { if (!cancelled) setHome(FALLBACK_HOME); }
      finally { if (!cancelled) setLoadingHome(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // ---- Explorar: busca reais via /api/explore; gêneros abrem a página browse
  const loadGenre = useCallback(async (genre) => {
    setExploreGenre(genre);
    setLoadingExplore(true);
    try {
      const list = await searchTracks(genre, 24);
      setExploreTracks(list.length ? list : FALLBACK_TRACKS.filter((t) => t.genre === genre));
    } catch { setExploreTracks(FALLBACK_TRACKS.filter((t) => t.genre === genre)); }
    finally { setLoadingExplore(false); }
  }, []);

  useEffect(() => {
    if (activeView !== "explore") return;
    let cancelled = false;
    if (!exploreData) {
      getExplore().then((d) => { if (!cancelled) setExploreData(d); }).catch(() => {});
    }
    if (!exploreGenre) loadGenre("Sertanejo");
  }, [activeView, exploreGenre, exploreData, loadGenre]);

  const openBrowse = useCallback(async (item) => {
    const browseId = item?.browseId || item?.id;
    if (!browseId) return;
    if (item?.type === "album" || /^MPREb_/.test(String(browseId))) { openAlbumFn(item); return; }
    if (item?.type === "playlist" || /^VL|^PL/.test(String(browseId))) {
      setBrowsePage({ title: item.title, loading: true });
      setActiveView("browse");
      try {
        const page = await getBrowsePage(browseId);
        setBrowsePage({ ...page, title: page.title || item.title, loading: false });
      } catch { setBrowsePage({ title: item.title, tracks: [], loading: false }); }
      return;
    }
    try {
      const page = await getBrowsePage(browseId);
      setBrowsePage({ ...page, title: page.title || item.title, loading: false });
      setActiveView("browse");
    } catch { openAlbumFn(item); }
  }, []);

  const playTrack = useCallback((track) => {
    if (Array.isArray(track)) { p.playTracks(track, track[0]?.id || track[0]?.videoId); return; }
    p.playTrack(track);
  }, [p]);

  const playList = useCallback((list) => { if (list?.length) p.playTracks(list, list[0].id || list[0].videoId); }, [p]);

  const openAlbumFn = useCallback(async (album) => {
    const browseId = album.browseId || album.id;
    setOpenAlbum({ ...album, browseId }); setAlbumTracks([]); setActiveView("album");
    try { const tracks = await getAlbumTracks(browseId, album); setAlbumTracks(tracks); } catch { setAlbumTracks([]); }
  }, []);

  const openArtistFn = useCallback(async (artist) => {
    setOpenArtist(artist); setArtistData(null); setActiveView("artist");
    try { const data = await getArtist(artist.id); setArtistData(data); } catch { setArtistData(null); }
  }, []);

  const openPlaylist = useCallback(async (pl) => {
    if (pl.id === "liked") { setActiveView("liked"); setOpenPl(pl); return; }
    setOpenPl(pl); setActiveView("playlist"); setPlTracks([]);
    const ids = pl.trackIds || [];
    if (!ids.length) return;
    try {
      const cached = await DB.getCachedTracks(ids, user?.id);
      // mantém ordem da playlist; faixas recém-adicionadas via ContextMenu costumam estar em cache
      const byId = new Map(cached.map((t) => [String(t.videoId || t.id), t]));
      const ordered = ids.map((id) => byId.get(String(id))).filter(Boolean);
      setPlTracks(ordered.length ? ordered : cached);
    } catch { setPlTracks([]); }
  }, [user?.id]);

  // ---- liked tracks (resolvidas do cache escopado por conta)
  useEffect(() => {
    let c = false;
    if (!user?.id) { setLikedTracks([]); return; }
    (async () => {
      try {
        const cached = await DB.getCachedTracks(p.liked, user.id);
        if (!c) setLikedTracks(cached);
      } catch {}
    })();
    return () => { c = true; };
  }, [user?.id, p.liked]);

  // ---- histórico (isolado por conta)
  useEffect(() => {
    let c = false;
    if (!user?.id) { setHistoryTracks([]); return; }
    (async () => {
      try {
        const entries = await DB.getHistory(user.id, 100);
        if (c) return;
        const ids = entries.map((e) => e.videoId);
        const cached = await DB.getCachedTracks(ids, user.id);
        const byId = new Map(cached.map((t) => [String(t.videoId || t.id), t]));
        setHistoryTracks(ids.map((id) => byId.get(String(id))).filter(Boolean));
      } catch {}
    })();
    return () => { c = true; };
  }, [user?.id, activeView]);

  // ---- downloads (isolados por conta)
  useEffect(() => {
    let c = false;
    if (!user?.id) { setDownloadTracks([]); return; }
    (async () => {
      try {
        const ids = lib.downloads.map((d) => d.videoId);
        const cached = await DB.getCachedTracks(ids, user.id);
        if (!c) setDownloadTracks(cached);
      } catch {}
    })();
    return () => { c = true; };
  }, [user?.id, lib.downloads]);

  // ---- inscrições: resolver artistas
  useEffect(() => {
    let c = false;
    if (!user?.id) { setSubArtists([]); return; }
    (async () => {
      const list = [];
      for (const s of lib.subs.slice(0, 12)) {
        try {
          const data = await getArtist(s.id);
          if (data?.artist) list.push(data.artist);
        } catch {}
        if (c) return;
      }
      if (!c) setSubArtists(list);
    })();
    return () => { c = true; };
  }, [user?.id, lib.subs]);

  // ---- eventos do ContextMenu (play / radio / abrir menu do player)
  useEffect(() => {
    const onPlay = (e) => { const t = e.detail; if (t) p.playTrack(t, [t]); };
    const onRadio = async (e) => {
      const t = e.detail; if (!t) return;
      p.playTrack(t, [t]);
      try {
        const res = await fetch(`/api/upnext?id=${encodeURIComponent(String(t.videoId || t.id))}`, { headers: { accept: "application/json" } });
        const j = await res.json();
        const extra = Array.isArray(j?.tracks) ? j.tracks : [];
        if (extra.length) {
          const nextQueue = [t, ...extra];
          p.playTracks(nextQueue, t.videoId || t.id);
        }
      } catch {}
    };
    const onCtxOpen = (e) => ctxMenu?.open(e.detail.x, e.detail.y, e.detail.track);
    const onShuffle = (e) => {
      const list = [...e.detail];
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      p.playTracks(list, list[0]?.id || list[0]?.videoId);
    };
    window.addEventListener("ytm-ctx-play", onPlay);
    window.addEventListener("ytm-ctx-radio", onRadio);
    window.addEventListener("ytm-ctx-open", onCtxOpen);
    window.addEventListener("ytm-ctx-shuffle", onShuffle);
    return () => { window.removeEventListener("ytm-ctx-play", onPlay); window.removeEventListener("ytm-ctx-radio", onRadio); window.removeEventListener("ytm-ctx-open", onCtxOpen); window.removeEventListener("ytm-ctx-shuffle", onShuffle); };
  }, [p, ctxMenu]);

  // ---- nome da apresentação (fallback: visível no drawer quando logado)
  const searching = debouncedQ !== "" || activeMood !== null;
  const moodLabel = activeMood ? MOODS.find((m) => m.id === activeMood)?.label : null;

  const onScroll = useCallback((e) => setScrolled(e.currentTarget.scrollTop > 8), []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  }, []);

  // gradiente dinâmico
  useEffect(() => {
    const cover = p.currentTrack?.cover || home.quick?.[0]?.cover;
    if (!cover) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        const size = 40;
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4 * 37) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
        if (n) {
          const col = `rgba(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)},0.06)`;
          document.documentElement.style.setProperty("--dyn", `linear-gradient(180deg, ${col} 0%, rgba(19,19,19,0) 460px)`);
        }
        // o oficial tem fundo plano rgb(19,19,19) — sem gradiente por capa
      } catch {}
    };
    img.src = cover;
    return () => { cancelled = true; };
  }, [p.currentTrack?.cover, home.quick]);

  const pickSuggestion = useCallback((track) => {
    if (!track) return;
    setQuery(track.title);
    setActiveMood(null);
    setResults([track]);
    setFilter("songs");
  }, []);

  const goHome = () => { setActiveView("home"); setOpenPl(null); setOpenAlbum(null); setOpenArtist(null); };

  return (
    <div className="h-screen flex flex-col bg-[#131313] text-white overflow-hidden">
      <div className="flex flex-1 min-h-0">
        <Sidebar
          collapsed={collapsed} setCollapsed={setCollapsed}
          activeView={activeView} setActiveView={(v) => { setActiveView(v); if (v !== "playlist") setOpenPl(null); if (v !== "album") setOpenAlbum(null); if (v !== "artist") setOpenArtist(null); }}
          openPlaylist={openPlaylist}
        />
        <main className="flex-1 flex flex-col min-w-0 relative">
          <Topbar
            query={query} setQuery={setQuery}
            activeMood={activeMood} setActiveMood={setActiveMood}
            collapsed={collapsed} setCollapsed={setCollapsed}
            filter={filter} setFilter={setFilter}
            suggestions={results}
            onPickSuggestion={pickSuggestion}
            scrolled={scrolled}
            onGoHome={goHome}
          />
          <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto pb-32">
            {activeView === "browse" && browsePage ? (
              <ListView
                title={browsePage.title || "Playlist"}
                subtitle={`${browsePage.tracks?.length || 0} músicas • YouTube Music`}
                tracks={browsePage.tracks || []}
                empty={browsePage.loading ? "Carregando faixas..." : "Nenhuma faixa encontrada."}
                onBack={goHome} onPlay={playTrack} onPlayAll={() => playList(browsePage.tracks)}
              />
            ) : activeView === "album" && openAlbum ? (
              <AlbumView album={openAlbum} tracks={albumTracks} onBack={goHome} onPlay={playTrack} onPlayAll={() => playList(albumTracks)} />
            ) : activeView === "artist" && openArtist ? (
              <ArtistView artist={openArtist} data={artistData} onBack={goHome} onPlay={playTrack} onPlayAll={(t) => playList(t || artistData?.topSongs || [])} onOpenAlbum={openAlbumFn} onOpenArtist={openArtistFn} />
            ) : activeView === "liked" ? (
              <ListView
                title="Músicas curtidas" subtitle={`${likedTracks.length} músicas • sincronizado com o coração`}
                tracks={likedTracks}
                empty="Nenhuma música curtida ainda — clique no coração de uma faixa."
                onBack={goHome} onPlay={playTrack} onPlayAll={() => playList(likedTracks)}
              />
            ) : activeView === "playlist" && openPl ? (
              <ListView
                title={openPl.name} subtitle={`${plTracks.length} músicas`}
                tracks={plTracks}
                empty="Playlist vazia — adicione músicas a partir de uma faixa."
                onBack={goHome} onPlay={playTrack} onPlayAll={() => playList(plTracks)}
              />
            ) : activeView === "history" ? (
              <ListView
                title="Histórico" subtitle="Tocadas recentemente neste dispositivo"
                tracks={historyTracks}
                empty="Nenhum histórico ainda — toque uma música para começar."
                onBack={goHome} onPlay={playTrack} onPlayAll={() => playList(historyTracks)}
                extraActions={user?.id ? (<button onClick={() => lib.clearHistory().then(() => setHistoryTracks([]))} className="flex items-center gap-2 border border-white/20 rounded-full px-4 py-2 text-[13px] hover:bg-white/10"><RefreshCw size={15} /> Limpar</button>) : null}
              />
            ) : activeView === "downloads" ? (
              <ListView
                title="Downloads" subtitle="Disponíveis para ouvir off-line"
                tracks={downloadTracks}
                empty="Nenhum download ainda — baixe uma faixa a partir do menu (3 pontos)."
                onBack={goHome} onPlay={playTrack} onPlayAll={() => playList(downloadTracks)}
              />
            ) : activeView === "subscriptions" ? (
              <div className="yt-home-grad min-h-full px-4 md:px-6 pt-6">
                <h1 className="text-[24px] md:text-[28px] font-bold tracking-tight flex items-center gap-2"><Users size={28} /> Inscrições</h1>
                <p className="text-[14px] text-[#AAAAAA] mt-1">{subArtists.length} artista(s) que você segue</p>
                {subArtists.length === 0 ? (
                  <p className="text-white/50 text-sm mt-8">Nenhuma inscrição ainda — abra um artista e toque em “Inscrever-se”.</p>
                ) : (
                  <div className="flex gap-4 overflow-x-auto no-scrollbar py-6">
                    {subArtists.map((a) => <ArtistCard key={a.id} artist={a} onOpen={openArtistFn} />)}
                  </div>
                )}
              </div>
            ) : activeView === "library" ? (
              <LibraryView
                liked={likedTracks} playlists={lib.playlists} downloads={downloadTracks}
                onOpenLiked={() => openPlaylist({ id: "liked", name: "Músicas curtidas", trackIds: p.liked })}
                onOpenPlaylist={openPlaylist} onPlay={playTrack} onPlayAll={(t) => playList(t)} onBack={goHome}
              />
            ) : searching ? (
              <SearchView
                query={debouncedQ} moodLabel={moodLabel} loading={loadingSearch}
                songs={results} artists={artistResults} albums={albumResults} playlists={playlistResults}
                filter={filter}
                onPlay={playTrack} onPlayAll={() => playList(results)}
                onOpenAlbum={openAlbumFn} onOpenArtist={openArtistFn} onOpenBrowse={openBrowse}
              />
            ) : activeView === "explore" ? (
              <ExploreView
                genres={GENRES} activeGenre={exploreGenre} tracks={exploreTracks} loading={loadingExplore}
                data={exploreData}
                onSelectGenre={loadGenre} onPlay={playTrack} onPlayAll={() => playList(exploreTracks)}
                onOpenAlbum={openAlbumFn} onOpenArtist={openArtistFn} onOpenBrowse={openBrowse}
              />
            ) : (
              <HomeView greeting={greeting} loading={loadingHome} home={home} onPlay={playTrack} onOpenAlbum={openAlbumFn} onOpenArtist={openArtistFn} userName={user?.name} />
            )}
          </div>
        </main>
      </div>
      <PlayerBar />
    </div>
  );
}

function HomeView({ greeting, loading, home, onPlay, onOpenAlbum, onOpenArtist, userName }) {
  if (loading) return <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>;
  const quick = home.quick || [];

  return (
    <div className="yt-home-grad min-h-full">
      {HOME_SECTIONS.map((sec) => {
        if (sec.key === "quick") {
          if (!quick.length) return null;
          return (
            <section key={sec.key} className="px-4 md:px-6 pt-5 pb-3 fade-up">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[20px] md:text-[24px] font-bold tracking-tight">{sec.title}</h2>
                <button onClick={() => onPlay(quick.slice(0, 12))} aria-label="Reproduzir tudo" className="flex items-center gap-2 rounded-full bg-white text-black px-4 py-2 text-[12px] font-medium hover:bg-white/85">
                  <Play size={13} fill="black" /> Tocar tudo
                </button>
              </div>
              <QuickPicksGrid tracks={quick.slice(0, 12)} onPlay={onPlay} />
            </section>
          );
        }
        const items = home[sec.key] || [];
        if (!items.length) return null;
        const isArtistsPrompt = sec.key === "artists";
        if (isArtistsPrompt) {
          return (
            <section key={sec.key} className="px-4 md:px-6 py-6 fade-up">
              <h2 className="text-[24px] md:text-[28px] font-bold leading-tight tracking-tight mb-2">{sec.title}</h2>
              <p className="text-[14px] text-[#AAAAAA] mb-4">Criaremos uma experiência personalizada para você</p>
              <button onClick={() => onPlay(items)} className="rounded-full border border-white/30 px-5 py-2.5 text-[13px] hover:bg-white/10">Vamos lá</button>
            </section>
          );
        }
        return (
          <Section key={sec.key} title={sec.title}>
            {items.map((t) => <CoverCard key={t.id || t.videoId} track={t} onPlay={onPlay} />)}
          </Section>
        );
      })}
    </div>
  );
}

function SearchView({ query, moodLabel, loading, songs, artists, albums, playlists, filter, onPlay, onPlayAll, onOpenAlbum, onOpenArtist, onOpenBrowse }) {
  const nothing = !songs.length && !artists.length && !albums.length && !(playlists?.length);
  const ff = filter || "featured";
  return (
    <div className="yt-home-grad min-h-full">
      <div className="px-4 md:px-6 pt-4 pb-1">
        <span className="text-white/50 text-sm">{loading ? "Pesquisando..." : `${(songs.length + artists.length + albums.length + (playlists?.length || 0))} resultados`}</span>
      </div>
      {loading ? <SkeletonRow /> : nothing ? (
        <div className="px-6 py-16 text-center">
          <Music2 size={40} className="mx-auto text-white/30 mb-3" />
          <p className="text-white/60">Nenhum resultado encontrado. Tente outro termo.</p>
        </div>
      ) : (
        <>
          {(ff === "featured" || ff === "artists") && artists.length > 0 && (
            <Section title="Artistas">
              {artists.map((a) => <ArtistCard key={a.id} artist={a} onOpen={onOpenArtist} />)}
            </Section>
          )}
          {(ff === "featured" || ff === "albums") && albums.length > 0 && (
            <Section title="Álbuns">
              {albums.map((a) => <AlbumCard key={a.id || a.browseId} album={a} onOpen={onOpenAlbum} />)}
            </Section>
          )}
          {(ff === "featured" || ff === "playlists") && playlists?.length > 0 && (
            <Section title="Playlists">
              {playlists.map((pl) => <AlbumCard key={pl.id || pl.browseId} album={pl} onOpen={onOpenBrowse} />)}
            </Section>
          )}
          {(ff === "featured" || ff === "songs" || ff === "videos") && songs.length > 0 && (
            <section className="px-4 md:px-6 py-4 fade-up">
              <h2 className="text-[24px] md:text-[28px] font-bold tracking-tight mb-4">Músicas</h2>
              <div className="space-y-0.5">{songs.map((t, i) => <TrackRow key={t.id || t.videoId} index={i} track={t} onPlay={onPlay} />)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ExploreView({ genres, activeGenre, tracks, loading, onSelectGenre, onPlay, onPlayAll, data, onOpenAlbum, onOpenArtist, onOpenBrowse }) {
  const sections = data?.sections || [];
  const [tab, setTab] = useState("new");
  // seções com títulos oficiais (pt-BR) — o feed InnerTube pode vir em inglês
  const officialSections = ["Novos álbuns e singles", "Momentos e gêneros", "Episódios favoritos", "Em alta", "Novos vídeos"];
  const mapped = sections.map((sec, i) => ({ ...sec, title: officialSections[i] || sec.title || "Em alta" }));
  const visible = tab === "moods" ? mapped.filter((s) => s.title === "Momentos e gêneros") : mapped;
  return (
    <div className="yt-home-grad min-h-full">
      <div className="px-4 md:px-6 pt-4 flex gap-2 overflow-x-auto no-scrollbar border-b border-white/10">
        {EXPLORE_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-4 py-3 text-[14px] border-b-2 -mb-px transition ${tab === t.id ? "border-white text-white font-medium" : "border-transparent text-white/60 hover:text-white"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "moods" ? (
        <section className="px-4 md:px-6 py-6">
          <h2 className="text-[20px] md:text-[24px] font-bold tracking-tight mb-4">Momentos e gêneros</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {genres.map((g) => (
              <button
                key={g}
                onClick={() => onSelectGenre(g)}
                className="text-left rounded-xl bg-[rgba(255,255,255,0.08)] hover:bg-white/[0.14] px-4 py-5 text-[14px] font-medium transition"
              >
                {g}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          {loading && !tracks.length ? <><SkeletonRow /><SkeletonRow /></> : (
            <>
              {visible.map((sec, i) => (
                <Section key={i} title={sec.title}>
                  {sec.items.slice(0, 12).map((it, j) => it.type === "album" || it.type === "playlist"
                    ? <AlbumCard key={j} album={it} onOpen={onOpenBrowse || onOpenAlbum} />
                    : it.type === "artist"
                      ? <ArtistCard key={j} artist={it} onOpen={onOpenArtist} />
                      : <CoverCard key={j} track={it} onPlay={onPlay} />)}
                </Section>
              ))}
              {tab === "charts" && tracks.length > 0 && (
                <section className="px-4 md:px-6 py-4">
                  <h2 className="text-[24px] md:text-[28px] font-bold tracking-tight mb-4">{activeGenre ? `Em alta: ${activeGenre}` : "Em alta"}</h2>
                  <div className="space-y-0.5">{tracks.map((t, i) => <TrackRow key={t.id || t.videoId} index={i} track={t} onPlay={onPlay} />)}</div>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function AlbumView({ album, tracks, onBack, onPlay, onPlayAll }) {
  return (
    <div className="yt-home-grad">
      <div className="px-4 md:px-6 pt-6">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-white/60 hover:text-white mb-5"><ArrowLeft size={16} /> Voltar</button>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
          <img src={album.cover} alt="" className="w-44 h-44 md:w-56 md:h-56 rounded-xl object-cover shadow-2xl shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-white/50">Álbum</p>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight tracking-tight mt-1">{album.title}</h1>
            <p className="text-[14px] text-[#AAAAAA] mt-2">{album.artist}{album.year ? ` • ${album.year}` : ""}{tracks.length ? ` • ${tracks.length} faixas` : ""}</p>
            <div className="flex items-center gap-3 mt-5">
              <button onClick={onPlayAll} disabled={!tracks.length} className="flex items-center gap-2 bg-white text-black rounded-full px-6 py-3 text-sm font-medium hover:scale-105 transition shadow disabled:opacity-40">
                <Play size={18} fill="black" /> Tocar álbum
              </button>
              <button onClick={() => playShuffled(tracks)} disabled={!tracks.length} className="flex items-center gap-2 border border-white/20 rounded-full px-5 py-3 text-sm hover:bg-white/10 disabled:opacity-40">
                <Shuffle size={16} /> Aleatório
              </button>
            </div>
          </div>
        </div>
      </div>
      <section className="px-4 md:px-6 py-6">
        {tracks.length === 0 ? <p className="text-white/50 text-sm">Carregando faixas...</p> :
          <div className="space-y-0.5">{tracks.map((t, i) => <TrackRow key={t.id || t.videoId} index={i} track={t} onPlay={onPlay} />)}</div>}
      </section>
    </div>
  );
}

function playShuffled(list) {
  if (!list?.length) return;
  // a fila embaralhada é delegada via evento para o Shell (que tem acesso ao player)
  window.dispatchEvent(new CustomEvent("ytm-ctx-shuffle", { detail: list }));
}

function ArtistView({ artist, data, onBack, onPlay, onPlayAll, onOpenAlbum, onOpenArtist }) {
  const lib = useLibrary();
  const { isLoggedIn, setAuthOpen } = useAuth();
  const a = data?.artist || artist;
  const top = data?.topSongs || [];
  const sections = data?.sections || [];
  const subscribed = lib.isSubscribed(a.id);
  const loading = !data;
  return (
    <div className="yt-home-grad min-h-full">
      <div className="px-4 md:px-6 pt-6">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-white/60 hover:text-white mb-5"><ArrowLeft size={16} /> Voltar</button>
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
          <img src={a.cover} alt="" className="w-44 h-44 md:w-56 md:h-56 rounded-full object-cover shadow-2xl shrink-0" />
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-[11px] uppercase tracking-widest text-white/50">Artista</p>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight tracking-tight mt-1">{a.name}</h1>
            <p className="text-[14px] text-[#AAAAAA] mt-2">{a.monthlyAudience ? `${a.monthlyAudience} ouvintes mensais` : "YouTube Music"}</p>
            <div className="flex items-center gap-3 mt-5 justify-center sm:justify-start">
              <button onClick={() => onPlayAll()} disabled={!top.length} className="flex items-center gap-2 bg-white text-black rounded-full px-6 py-3 text-sm font-medium hover:scale-105 transition shadow disabled:opacity-40">
                <Play size={18} fill="black" /> Tocar
              </button>
              <button onClick={() => onPlayAll(top)} disabled={!top.length} className="flex items-center gap-2 border border-white/20 rounded-full px-5 py-3 text-sm hover:bg-white/10 disabled:opacity-40">
                <Shuffle size={16} /> Aleatório
              </button>
              <button
                onClick={() => (isLoggedIn ? lib.toggleSubscribe(a) : setAuthOpen(true))}
                className={`rounded-full px-5 py-3 text-sm font-medium transition ${subscribed ? "bg-[rgba(255,255,255,0.1)] border border-white/20" : "bg-[#FF0000] hover:bg-[#cc0000] text-white"}`}
              >
                {subscribed ? "Inscrito ✓" : "Inscrever-se"}
              </button>
            </div>
          </div>
        </div>
      </div>
      {loading ? <SkeletonRow /> : (
        <>
          {top.length > 0 && (
            <section className="px-4 md:px-6 py-6">
              <h2 className="text-[24px] md:text-[28px] font-bold tracking-tight mb-4">Músicas</h2>
              <div className="space-y-0.5">{top.map((t, i) => <TrackRow key={t.id || t.videoId} index={i} track={t} onPlay={onPlay} />)}</div>
            </section>
          )}
          {sections.map((sec, i) => (
            <Section key={i} title={sec.title || "Mais"}>
              {sec.items.slice(0, 12).map((it, j) => it.type === "album"
                ? <AlbumCard key={j} album={it} onOpen={onOpenAlbum} />
                : it.type === "artist"
                  ? <ArtistCard key={j} artist={it} onOpen={onOpenArtist} />
                  : <CoverCard key={j} track={it} onPlay={onPlay} />)}
            </Section>
          ))}
        </>
      )}
    </div>
  );
}

function LibraryView({ liked, playlists, downloads, onOpenLiked, onOpenPlaylist, onPlay, onPlayAll, onBack }) {
  return (
    <div className="yt-home-grad min-h-full px-4 md:px-6 pt-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-white/60 hover:text-white mb-5"><ArrowLeft size={16} /> Voltar</button>
      <h1 className="text-[24px] md:text-[28px] font-bold tracking-tight">Biblioteca</h1>
      <p className="text-[14px] text-[#AAAAAA] mt-1">Suas curtidas, playlists e downloads</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
        <button onClick={onOpenLiked} className="group text-left">
          <div className="aspect-square rounded-xl bg-gradient-to-br from-[#3ea6ff] to-[#7a2bff] flex items-center justify-center shadow">
            <Play size={44} fill="white" className="text-white/90 group-hover:scale-110 transition" />
          </div>
          <p className="mt-2 text-[14px] font-medium truncate">Músicas curtidas</p>
          <p className="text-[12px] text-white/50">{liked.length} músicas</p>
        </button>
        {playlists.map((pl) => (
          <button key={pl.id} onClick={() => onOpenPlaylist(pl)} className="group text-left">
            <div className="aspect-square rounded-xl bg-gradient-to-br from-[#3ea6ff] to-[#FF0000] flex items-center justify-center shadow">
              <ListMusic size={44} className="text-white/90" />
            </div>
            <p className="mt-2 text-[14px] font-medium truncate">{pl.name}</p>
            <p className="text-[12px] text-white/50">{pl.trackIds?.length ?? 0} músicas</p>
          </button>
        ))}
        <button onClick={() => onPlayAll(downloads)} className="group text-left">
          <div className="aspect-square rounded-xl bg-[#212121] flex items-center justify-center shadow">
            <Download size={44} className="text-white/80 group-hover:scale-110 transition" />
          </div>
          <p className="mt-2 text-[14px] font-medium truncate">Downloads</p>
          <p className="text-[12px] text-white/50">{downloads.length} faixas off-line</p>
        </button>
      </div>
      <div className="mt-10 flex items-center gap-2 text-white/40 text-sm">
        <Clock size={16} /> {liked.length + downloads.length} faixas salvas neste dispositivo
      </div>
    </div>
  );
}

function ListView({ title, subtitle, tracks, empty, onBack, onPlay, onPlayAll, extraActions }) {
  return (
    <div className="yt-home-grad min-h-full px-4 md:px-6 pt-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-white/60 hover:text-white mb-5"><ArrowLeft size={16} /> Voltar</button>
      <div className="flex items-end gap-6 mb-6">
        <div className="w-36 h-36 md:w-44 md:h-44 rounded-xl bg-gradient-to-br from-[#3ea6ff] to-[#FF0000] flex items-center justify-center shrink-0 shadow-2xl"><Disc3 size={56} className="text-white/90" /></div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-white/50">Playlist</p>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight mt-1">{title}</h1>
          <p className="text-[14px] text-[#AAAAAA] mt-1">{subtitle}</p>
          <div className="flex items-center gap-3 mt-4">
            <button onClick={onPlayAll} disabled={!tracks.length} className="flex items-center gap-2 bg-white text-black rounded-full px-5 py-2.5 text-sm font-medium hover:scale-105 transition disabled:opacity-40">
              <Play size={18} fill="black" /> Tocar tudo
            </button>
            <button onClick={() => onPlayAll(tracks)} disabled={!tracks.length} className="flex items-center gap-2 border border-white/20 rounded-full px-5 py-2.5 text-sm hover:bg-white/10 disabled:opacity-40">
              <Shuffle size={16} /> Aleatório
            </button>
            {extraActions}
          </div>
        </div>
      </div>
      {tracks.length === 0 ? <p className="text-white/50 text-sm">{empty}</p> :
        <div className="space-y-0.5 pb-6">{tracks.map((t, i) => <TrackRow key={t.id || t.videoId} index={i} track={t} onPlay={onPlay} />)}</div>}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PlayerProvider>
        <ToastProvider>
          <LibraryProvider>
            <ContextMenuProvider>
              <Shell />
              <LoginModal />
              <ProfileModal />
            </ContextMenuProvider>
          </LibraryProvider>
        </ToastProvider>
      </PlayerProvider>
    </AuthProvider>
  );
}
