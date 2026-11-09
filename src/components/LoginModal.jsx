import { useEffect, useRef, useState } from "react";
import { X, Mail, Lock, User, Eye, EyeOff, KeyRound, AlertCircle, CheckCircle2, ShieldCheck, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLibrary } from "../context/LibraryContext";

const GOOGLE_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID || "";

function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36 39.6 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
  );
}

export default function LoginModal() {
  const { authOpen, setAuthOpen, login, loginWithGoogle, requestCode, verifyCode } = useAuth();
  const lib = useLibrary();
  const [mode, setMode] = useState("password"); // password | code
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const gBtnRef = useRef(null);

  useEffect(() => {
    if (!authOpen) return;
    setError("");
    setOk("");
    setDemoCode(null);
    setCode("");
  }, [authOpen]);

  // Google Identity Services
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !authOpen) return;
    let cancelled = false;
    const init = () => {
      if (cancelled || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp) => {
          if (!resp?.credential) return;
          try {
            const payload = JSON.parse(atob(resp.credential.split(".")[1]));
            loginWithGoogle({
              email: payload.email,
              name: payload.name,
              photo: payload.picture || null,
            }).then(() => {}).catch((e) => setError(e.message || "Falha no login do Google."));
          } catch {
            setError("Falha ao processar a resposta do Google.");
          }
        },
      });
      setGoogleReady(true);
      if (gBtnRef.current) {
        gBtnRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(gBtnRef.current, { theme: "outline", size: "large", width: 368, text: "continue_with" });
      }
    };
    if (window.google?.accounts?.id) init();
    else {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = init;
      document.head.appendChild(s);
      return () => { cancelled = true; document.head.removeChild(s); };
    }
    return () => { cancelled = true; };
  }, [authOpen, loginWithGoogle]);

  if (!authOpen) return null;

  const close = () => { setAuthOpen(false); setError(""); setOk(""); };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    if (!email.includes("@")) return setError("Insira um e-mail válido.");
    if (mode === "password" && !password) return setError("Informe sua senha.");
    setLoading(true);
    try {
      await login(name, email, password);
    } catch (err) {
      setError(err.message || "Falha no login.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCode = async () => {
    setError("");
    setOk("");
    if (!email.includes("@")) return setError("Insira um e-mail válido.");
    setLoading(true);
    try {
      const res = await requestCode(email);
      setDemoCode(res.demoCode);
      setOk("Código enviado. Em produção, ele chega por e-mail.");
    } catch (err) {
      setError(err.message || "Falha ao enviar código.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    if (!code.trim()) return setError("Insira o código de 6 dígitos.");
    setLoading(true);
    try {
      await verifyCode(email, code);
    } catch (err) {
      setError(err.message || "Código inválido.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m) => { setMode(m); setError(""); setOk(""); setDemoCode(null); setCode(""); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-[400px] bg-[#0f0f0f] border border-white/10 rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* topo — identidade YTM (vermelho #FF0000) */}
        <div className="px-6 pt-7 pb-5 text-center bg-gradient-to-b from-[#212121] to-transparent relative">
          <button onClick={close} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/70" aria-label="Fechar">
            <X size={20} />
          </button>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FF0000] shadow-[0_12px_32px_rgba(255,0,0,0.35)]">
            <svg width="34" height="34" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="12" fill="white"/><path d="M11 9.5v9l7-4.5z" fill="#FF0000"/></svg>
          </div>
          <h2 className="mt-4 text-[22px] font-bold leading-tight">YouTube Music</h2>
          <p className="mt-1 text-[13px] text-white/50">Entre para ouvir sem parar</p>
          {lib && (
            <p className="mt-2 text-[11px] text-white/30">
              Suas playlists, downloads e curtidas ficam só na sua conta.
            </p>
          )}
        </div>

        <div className="px-6 pb-6 space-y-3">
          {/* Google real */}
          {GOOGLE_CLIENT_ID ? (
            <div ref={gBtnRef} className="w-full flex justify-center" aria-label="Continuar com o Google" />
          ) : (
            <div className="w-full h-11 rounded-full bg-white/10 border border-white/10 flex items-center justify-center gap-3 text-white/50 text-[13px]">
              <GoogleIcon size={16} /> Google não configurado
              <span className="text-[11px] text-white/30">— defina VITE_GOOGLE_CLIENT_ID no .env.local</span>
            </div>
          )}

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] uppercase tracking-wider text-white/40">ou</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          {/* abas senha / código */}
          <div className="flex gap-2">
            <button type="button" onClick={() => switchMode("password")} className={`flex-1 h-9 rounded-full text-[13px] flex items-center justify-center gap-2 transition ${mode === "password" ? "bg-white text-black font-semibold" : "bg-[rgba(255,255,255,0.08)] text-white/80 hover:bg-white/[0.14]"}`}>
              <LogIn size={14} /> Senha
            </button>
            <button type="button" onClick={() => switchMode("code")} className={`flex-1 h-9 rounded-full text-[13px] flex items-center justify-center gap-2 transition ${mode === "code" ? "bg-white text-black font-semibold" : "bg-[rgba(255,255,255,0.08)] text-white/80 hover:bg-white/[0.14]"}`}>
              <KeyRound size={14} /> Código de login
            </button>
          </div>

          {mode === "password" ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome (só no cadastro)" className="w-full h-11 bg-[#212121] border border-white/10 rounded-full pl-11 pr-4 text-[14px] outline-none focus:border-white/40 placeholder:text-white/35 transition" />
              </div>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" type="email" className="w-full h-11 bg-[#212121] border border-white/10 rounded-full pl-11 pr-4 text-[14px] outline-none focus:border-white/40 placeholder:text-white/35 transition" />
              </div>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" type={showPw ? "text" : "password"} className="w-full h-11 bg-[#212121] border border-white/10 rounded-full pl-11 pr-11 text-[14px] outline-none focus:border-white/40 placeholder:text-white/35 transition" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white/50 hover:text-white" aria-label="Mostrar senha">{showPw ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
              {error && <p className="flex items-start gap-2 text-[12px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2"><AlertCircle size={14} className="mt-0.5 shrink-0" />{error}</p>}
              <button type="submit" disabled={loading} className="w-full h-11 rounded-full bg-[#FF0000] hover:bg-[#cc0000] text-white text-[14px] font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2">
                <UserPlus size={16} /> {loading ? "Entrando..." : "Entrar / Criar conta"}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" type="email" className="w-full h-11 bg-[#212121] border border-white/10 rounded-full pl-11 pr-4 text-[14px] outline-none focus:border-white/40 placeholder:text-white/35 transition" />
              </div>
              {demoCode && (
                <p className="flex items-start gap-2 text-[12px] text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                  <span>Código de demonstração: <strong className="tracking-widest">{demoCode}</strong></span>
                </p>
              )}
              <form onSubmit={handleVerifyCode} className="space-y-3">
                <div className="relative">
                  <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                  <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código de 6 dígitos" inputMode="numeric" className="w-full h-11 bg-[#212121] border border-white/10 rounded-full pl-11 pr-4 text-[14px] tracking-widest outline-none focus:border-white/40 placeholder:text-white/35 transition" />
                </div>
                {error && <p className="flex items-start gap-2 text-[12px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2"><AlertCircle size={14} className="mt-0.5 shrink-0" />{error}</p>}
                {ok && <p className="flex items-start gap-2 text-[12px] text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0" />{ok}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={handleRequestCode} disabled={loading} className="flex-1 h-11 rounded-full border border-white/20 text-[13px] hover:bg-white/10 disabled:opacity-50">Enviar código</button>
                  <button type="submit" disabled={loading} className="flex-1 h-11 rounded-full bg-[#FF0000] hover:bg-[#cc0000] text-white text-[14px] font-semibold disabled:opacity-50">Entrar</button>
                </div>
              </form>
            </div>
          )}

          <p className="text-center text-[11px] leading-relaxed text-white/30 pt-2 flex items-center justify-center gap-1.5">
            <ShieldCheck size={12} /> Contas isoladas por e-mail — nada vaza entre contas.
          </p>
          <p className="text-center text-[11px] leading-relaxed text-white/30">
            Ao continuar, você concorda com os Termos de Serviço e a Política de Privacidade do YouTube Music.
          </p>
        </div>
      </div>
    </div>
  );
}
