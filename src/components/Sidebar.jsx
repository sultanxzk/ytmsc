import { Home, Compass, LibraryBig, X, Menu, CircleUserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const MENU = [
  { id: "home", label: "Início", icon: Home },
  { id: "explore", label: "Explorar", icon: Compass },
  { id: "library", label: "Biblioteca", icon: LibraryBig },
];

export function YTLogo({ compact = false }) {
  return (
    <span className="flex items-center gap-1.5 select-none">
      <svg width="30" height="30" viewBox="0 0 28 28" className="shrink-0">
        <circle cx="14" cy="14" r="12.5" fill="#ff0033" />
        <path d="M11 9.5v9l7-4.5z" fill="#fff" />
      </svg>
      <span className="text-[18px] leading-none tracking-tight">
        <span className="font-normal">YouTube</span> <span className="font-medium">Music</span>
        {!compact && <sup className="text-[9px] text-white/50 ml-0.5">Premium</sup>}
      </span>
      <span className="sr-only">YouTube Music</span>
    </span>
  );
}

export default function Sidebar({ collapsed, setCollapsed, setActiveView, activeView }) {
  const { isLoggedIn, setAuthOpen } = useAuth();

  const onNav = (id) => {
    if (!isLoggedIn && id === "library") {
      setAuthOpen(true);
      return;
    }
    setActiveView(id);
  };

  if (collapsed) {
    return (
      <aside className="w-[72px] shrink-0 bg-[#131313] flex flex-col items-center py-2 gap-0.5 z-30">
        <button onClick={() => setCollapsed(false)} className="p-2.5 hover:bg-white/10 rounded-full mb-1" aria-label="Expandir menu"><Menu size={20} /></button>
        {MENU.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => onNav(id)} className={`flex flex-col items-center gap-1.5 w-full py-3 text-[10px] ${activeView === id ? "text-white" : "text-white/70 hover:text-white"}`}>
            <Icon size={20} /><span>{label}</span>
          </button>
        ))}
        <button onClick={() => setAuthOpen(true)} className="flex flex-col items-center gap-1.5 w-full py-3 text-[10px] text-white/70 hover:text-white">
          <CircleUserRound size={20} /><span>Login</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[240px] shrink-0 bg-[#131313] flex flex-col h-full overflow-y-auto no-scrollbar z-30">
      <div className="flex items-center justify-between px-4 h-[56px] shrink-0">
        <YTLogo />
        <button onClick={() => setCollapsed(true)} className="p-1.5 hover:bg-white/10 rounded-full" aria-label="Recolher menu"><X size={20} /></button>
      </div>

      <nav className="px-3 mt-2 space-y-0.5">
        {MENU.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNav(id)}
            className={`group relative w-full flex items-center gap-6 px-3 py-3 rounded-full transition-all ${activeView === id ? "bg-white/[0.12] hover:bg-white/[0.16] text-white font-bold" : "text-white/90 hover:text-white hover:bg-white/[0.06]"}`}
          >
            <Icon size={22} strokeWidth={activeView === id ? 2.2 : 1.8} className="group-hover:scale-110 transition" />{label}
          </button>
        ))}
      </nav>

      {!isLoggedIn && (
        <div className="px-6 mt-8 space-y-4">
          <button onClick={() => setAuthOpen(true)} className="w-full h-10 rounded-full bg-white text-black text-[14px] font-medium hover:bg-white/85">Fazer login</button>
          <p className="text-[12px] leading-[1.45] text-[#AAAAAA]">Sign in to create & share playlists, get personalized recommendations, and more.</p>
        </div>
      )}
    </aside>
  );
}
