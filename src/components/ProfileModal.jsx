import { useEffect, useRef, useState } from "react";
import { X, Camera, Save, Check, AlertCircle, Eye, EyeOff, Lock, Trash2, ShieldCheck, LogOut, RefreshCw, ListMusic, Download, Heart } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLibrary } from "../context/LibraryContext";

export default function ProfileModal() {
  const { user, isLoggedIn, updateProfile, changePassword, profileOpen, setProfileOpen, logout, setAuthOpen } = useAuth();
  const lib = useLibrary();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState(null);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (profileOpen && user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setPhoto(user.photo || null);
      setMsg("");
      setError("");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    }
  }, [profileOpen, user]);

  if (!profileOpen || !isLoggedIn || !user) return null;

  const readFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Selecione uma imagem válida.");
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!name.trim()) return setError("O nome não pode ficar vazio.");
    if (!email.includes("@")) return setError("Insira um e-mail válido.");
    if (newPw) {
      if (newPw.length < 6) return setError("A nova senha precisa de pelo menos 6 caracteres.");
      if (newPw !== confirmPw) return setError("As senhas novas não conferem.");
      if (!currentPw) return setError("Informe a senha atual para trocar.");
    }
    await updateProfile({ name: name.trim(), email: email.trim().toLowerCase(), photo });
    if (newPw) {
      try {
        await changePassword(currentPw, newPw);
      } catch (err) {
        return setError(err.message);
      }
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    }
    setMsg("Perfil salvo com sucesso!");
    setTimeout(() => setProfileOpen(false), 800);
  };

  const handleLogoutAndSwitch = () => {
    logout();
    setProfileOpen(false);
    setAuthOpen(true);
  };

  const howConnected = user.provider === "google" ? "Google" : "E-mail/senha";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setProfileOpen(false)} />
      <div className="relative w-full max-w-[460px] bg-[#0f0f0f] border border-white/10 rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* cabeçalho estilo YTM */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <h2 className="text-[20px] font-bold">Conta e perfil</h2>
          <button onClick={() => setProfileOpen(false)} className="p-2 rounded-full hover:bg-white/10 text-white/70" aria-label="Fechar"><X size={20} /></button>
        </div>

        {/* resumo da conta (dono) */}
        <div className="px-6 pb-4 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-[#3ea6ff] to-[#FF0000] flex items-center justify-center text-xl font-bold shrink-0">
            {user.photo ? <img src={user.photo} alt="" className="w-full h-full object-cover" /> : user.initials}
          </div>
          <div className="min-w-0">
            <p className="text-[16px] font-semibold truncate">{user.name}</p>
            <p className="text-[12px] text-white/50 truncate">{user.email}</p>
            <p className="text-[11px] text-white/40 mt-0.5 flex items-center gap-1">
              <ShieldCheck size={11} /> Conectado via {howConnected}
            </p>
          </div>
        </div>

        {/* resumo YTM: playlists / downloads / curtidas */}
        <div className="px-6 pb-5 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/[0.06] border border-white/10 px-3 py-3 text-center">
            <ListMusic size={16} className="mx-auto text-white/60 mb-1" />
            <p className="text-[16px] font-bold leading-none">{lib?.playlists?.length ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1">Playlists</p>
          </div>
          <div className="rounded-2xl bg-white/[0.06] border border-white/10 px-3 py-3 text-center">
            <Download size={16} className="mx-auto text-white/60 mb-1" />
            <p className="text-[16px] font-bold leading-none">{lib?.downloads?.length ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1">Downloads</p>
          </div>
          <div className="rounded-2xl bg-white/[0.06] border border-white/10 px-3 py-3 text-center">
            <Heart size={16} className="mx-auto text-white/60 mb-1" />
            <p className="text-[16px] font-bold leading-none">{lib?.likedCount ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1">Curtidas</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="px-6 pb-6 space-y-4">
          <div className="flex flex-col items-center">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-[#3ea6ff] to-[#FF0000] flex items-center justify-center text-2xl font-bold">
                {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : user.initials}
              </div>
              <button type="button" onClick={() => fileRef.current?.click()} className="absolute inset-0 rounded-full bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-medium gap-1.5 transition">
                <Camera size={16} /> Trocar
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
            </div>
            <p className="mt-2 text-[12px] text-white/40">Clique na foto para trocar</p>
          </div>

          <div>
            <label className="text-[12px] uppercase tracking-wider text-white/50">Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 w-full h-11 bg-[#212121] border border-white/10 rounded-full px-4 text-[14px] outline-none focus:border-white/40 transition" />
          </div>

          <div>
            <label className="text-[12px] uppercase tracking-wider text-white/50">E-mail</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-1.5 w-full h-11 bg-[#212121] border border-white/10 rounded-full px-4 text-[14px] outline-none focus:border-white/40 transition" />
          </div>

          <div className="space-y-3">
            <label className="text-[12px] uppercase tracking-wider text-white/50 flex items-center gap-1.5"><Lock size={12} /> Alterar senha (opcional)</label>
            <div className="relative">
              <input value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Senha atual" type={showPw ? "text" : "password"} className="w-full h-11 bg-[#212121] border border-white/10 rounded-full px-4 pr-11 text-[14px] outline-none focus:border-white/40 placeholder:text-white/35 transition" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white/50 hover:text-white">{showPw ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            <input value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Nova senha" type="password" className="w-full h-11 bg-[#212121] border border-white/10 rounded-full px-4 text-[14px] outline-none focus:border-white/40 placeholder:text-white/35 transition" />
            <input value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Confirmar nova senha" type="password" className="w-full h-11 bg-[#212121] border border-white/10 rounded-full px-4 text-[14px] outline-none focus:border-white/40 placeholder:text-white/35 transition" />
          </div>

          {error && <p className="flex items-center gap-2 text-[12px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2"><AlertCircle size={14} /> {error}</p>}
          {msg && <p className="flex items-center gap-2 text-[12px] text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2"><Check size={14} /> {msg}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setProfileOpen(false)} className="flex-1 h-11 rounded-full border border-white/20 text-[14px] hover:bg-white/10">Cancelar</button>
            <button type="submit" className="flex-1 h-11 rounded-full bg-[#FF0000] hover:bg-[#cc0000] text-white text-[14px] font-semibold flex items-center justify-center gap-2"><Save size={16} /> Salvar</button>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={handleLogoutAndSwitch} className="flex-1 flex items-center justify-center gap-2 h-10 rounded-full border border-white/20 text-[13px] hover:bg-white/10">
              <RefreshCw size={14} /> Trocar de conta
            </button>
            <button type="button" onClick={() => { logout(); setProfileOpen(false); }} className="flex-1 flex items-center justify-center gap-2 h-10 rounded-full border border-red-500/30 text-red-400 text-[13px] hover:bg-red-500/10">
              <LogOut size={14} /> Sair da conta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
