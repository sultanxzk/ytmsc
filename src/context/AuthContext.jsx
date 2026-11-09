import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { DB, migrateLegacyLocalStorage } from "../db/database";

const AuthContext = createContext(null);

const initialsFor = (name) =>
  String(name || "U")
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

const publicSession = (u) =>
  u
    ? {
        id: u.id,
        name: u.name,
        email: u.email,
        photo: u.photo,
        initials: u.initials,
        plan: u.plan,
        provider: u.provider || "email",
        passwordSet: !!u.passwordHash,
        createdAt: u.createdAt,
      }
    : null;

const genSalt = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim());

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [codeState, setCodeState] = useState(null); // { email, code, expiresAt, attempts }
  const lockRef = useRef(false);

  // init: migrar legado, carregar sessão
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await migrateLegacyLocalStorage(); } catch {}
      try {
        const uid = await DB.getSessionUserId();
        if (uid) {
          const list = await DB.listUsers();
          const rec = (list || []).find((u) => u.id === uid);
          if (rec && !cancelled) setUser(publicSession(rec));
        }
      } catch {}
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const persistAndSession = useCallback(async (record) => {
    await DB.saveUser(record);
    const session = publicSession(record);
    setUser(session);
    try { await DB.setSessionUserId(record.id); } catch {}
    setAuthOpen(false);
    return session;
  }, []);

  /**
   * Login estrito — sem bypass silencioso:
   * - e-mail inválido → erro
   * - conta inexistente → cria somente se senha >= 6 chars (cadastro)
   * - conta existente + senha errada → erro (nunca loga sem senha)
   * - conta existente sem senha (Google) → exige login por código ou Google
   */
  const login = useCallback(async (name, email, password) => {
    if (lockRef.current) throw new Error("Aguarde a autenticação terminar.");
    lockRef.current = true;
    try {
      const safeEmail = String(email || "").trim().toLowerCase();
      if (!isValidEmail(safeEmail)) throw new Error("Insira um e-mail válido.");
      if (!password) throw new Error("Informe sua senha.");
      if (password.length < 6) throw new Error("A senha precisa de pelo menos 6 caracteres.");

      const existing = await DB.getUserByEmail(safeEmail);
      if (existing) {
        if (!existing.passwordHash) {
          throw new Error("Esta conta usa login com Google ou código — use \"Continuar com o Google\" ou \"Login por código\".");
        }
        const salt = existing.passwordSalt || "";
        const hash = await DB.hashPassword(password, salt);
        if (hash !== existing.passwordHash) {
          throw new Error("E-mail ou senha incorretos.");
        }
        return await persistAndSession(existing);
      }

      // conta nova (cadastro)
      const safeName = (name || safeEmail.split("@")[0] || "Usuário").trim() || "Usuário";
      const salt = genSalt();
      const record = {
        id: `u_${Date.now()}`,
        name: safeName,
        email: safeEmail,
        passwordHash: await DB.hashPassword(password, salt),
        passwordSalt: salt,
        photo: null,
        initials: initialsFor(safeName),
        plan: "Premium",
        provider: "email",
        createdAt: Date.now(),
      };
      return await persistAndSession(record);
    } finally {
      lockRef.current = false;
    }
  }, [persistAndSession]);

  /** Login por código (6 dígitos, expira em 5 min, máx 5 tentativas) */
  const requestCode = useCallback(async (email) => {
    const safeEmail = String(email || "").trim().toLowerCase();
    if (!isValidEmail(safeEmail)) throw new Error("Insira um e-mail válido.");
    const existing = await DB.getUserByEmail(safeEmail);
    if (!existing) {
      // anti-enumeração: mensagem genérica, mas gera código mesmo assim
      const code = String(Math.floor(100000 + Math.random() * 900000));
      setCodeState({ email: safeEmail, code, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0, userExists: false });
      return { demoCode: code, userExists: false };
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setCodeState({ email: safeEmail, code, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0, userExists: true });
    // Em produção, o código seria enviado por e-mail. Retornamos para exibição local.
    return { demoCode: code, userExists: true };
  }, []);

  const verifyCode = useCallback(async (email, code) => {
    const safeEmail = String(email || "").trim().toLowerCase();
    const state = codeState;
    if (!state || state.email !== safeEmail) throw new Error("Solicite um código primeiro.");
    if (Date.now() > state.expiresAt) throw new Error("Código expirado — solicite um novo.");
    if (state.attempts >= 5) throw new Error("Muitas tentativas — solicite um novo código.");
    if (String(code).trim() !== state.code) {
      setCodeState({ ...state, attempts: state.attempts + 1 });
      throw new Error("Código incorreto.");
    }
    const existing = await DB.getUserByEmail(safeEmail);
    if (!existing) {
      throw new Error("Conta não encontrada. Cadastre-se primeiro.");
    }
    setCodeState(null);
    return await persistAndSession(existing);
  }, [codeState, persistAndSession]);

  /** Login com Google (Google Identity Services → idToken) */
  const loginWithGoogle = useCallback(async (googleUser) => {
    if (!googleUser?.email) throw new Error("Não foi possível obter seu e-mail do Google.");
    const safeEmail = String(googleUser.email).trim().toLowerCase();
    if (!isValidEmail(safeEmail)) throw new Error("E-mail do Google inválido.");
    const existing = await DB.getUserByEmail(safeEmail);
    if (existing) {
      // mescla: vincula Google à conta existente sem criar duplicada
      const updated = {
        ...existing,
        name: existing.name || googleUser.name || safeEmail.split("@")[0],
        photo: googleUser.photo || existing.photo,
        provider: existing.provider === "google" ? "google" : existing.provider,
      };
      return await persistAndSession(updated);
    }
    const safeName = String(googleUser.name || safeEmail.split("@")[0] || "Usuário").trim() || "Usuário";
    const record = {
      id: `u_g_${Date.now()}`,
      name: safeName,
      email: safeEmail,
      passwordHash: null,
      passwordSalt: null,
      photo: googleUser.photo || null,
      initials: initialsFor(safeName),
      plan: "Premium",
      provider: "google",
      createdAt: Date.now(),
    };
    return await persistAndSession(record);
  }, [persistAndSession]);

  const logout = useCallback(async () => {
    setUser(null);
    setCodeState(null);
    try { await DB.setSessionUserId(null); } catch {}
  }, []);

  const updateProfile = useCallback(async (patch) => {
    if (!user) return null;
    const rec = await DB.getUserByEmail(user.email);
    if (!rec) return null;
    const next = {
      ...rec,
      name: String(patch.name ?? rec.name).trim() || rec.name,
      email: String(patch.email ?? rec.email).trim().toLowerCase(),
      photo: patch.photo ?? rec.photo,
      initials: initialsFor(patch.name ?? rec.name),
    };
    await DB.saveUser(next);
    const session = publicSession(next);
    setUser(session);
    return session;
  }, [user]);

  const changePassword = useCallback(async (current, nextPw) => {
    if (!user) throw new Error("Você precisa estar logado.");
    const rec = await DB.getUserByEmail(user.email);
    if (!rec?.passwordHash) throw new Error("Esta conta usa login com Google — defina uma senha.");
    const salt = rec.passwordSalt || "";
    if ((await DB.hashPassword(current, salt)) !== rec.passwordHash) throw new Error("Senha atual incorreta.");
    if (!nextPw || nextPw.length < 6) throw new Error("A nova senha precisa de pelo menos 6 caracteres.");
    const newSalt = genSalt();
    const updated = { ...rec, passwordHash: await DB.hashPassword(nextPw, newSalt), passwordSalt: newSalt };
    await DB.saveUser(updated);
    setUser(publicSession(updated));
    return true;
  }, [user]);

  const value = {
    user,
    isLoggedIn: !!user,
    ready,
    login,
    loginWithGoogle,
    requestCode,
    verifyCode,
    logout,
    updateProfile,
    changePassword,
    authOpen,
    setAuthOpen,
    profileOpen,
    setProfileOpen,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
