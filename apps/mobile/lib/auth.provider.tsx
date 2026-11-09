import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DB } from './database';
import { authFetch, me, logoutFetch } from './auth.server';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  photo: string | null;
  initials: string;
  plan: string;
  provider: 'email' | 'google';
  passwordSet: boolean;
  createdAt: number;
}

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [codeState, setCodeState] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1) tenta servidor (conta compartilhada web ↔ mobile)
      const remote = await me().catch(() => null);
      if (remote && !cancelled) { setUser(remote); setReady(true); return; }
      // 2) fallback offline: sessão local
      try {
        const uid = await DB.getSessionUserId();
        if (uid) {
          const list = await DB.listUsers();
          const rec: any = list.find((u: any) => u.id === uid);
          if (rec && !cancelled) {
            setUser({
              id: rec.id, name: rec.name, email: rec.email, photo: rec.photo,
              initials: rec.initials, plan: rec.plan, provider: rec.provider,
              passwordSet: !!rec.passwordHash, createdAt: rec.createdAt,
            });
          }
        }
      } catch {}
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (name: string, email: string, password: string) => {
    const json = await authFetch('login', { name, email, password });
    setUser(json.user);
    setAuthOpen(false);
    return json.user;
  }, []);

  const requestCode = useCallback(async (email: string) => {
    const json = await authFetch('requestCode', { email });
    setCodeState({ email, code: json.demoCode, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0, userExists: json.userExists });
    return json;
  }, []);

  const verifyCode = useCallback(async (email: string, code: string) => {
    const json = await authFetch('verifyCode', { email, code });
    setUser(json.user);
    setCodeState(null);
    setAuthOpen(false);
    return json.user;
  }, []);

  const loginWithGoogle = useCallback(async (googleUser: { email: string; name?: string; photo?: string }) => {
    const json = await authFetch('google', { googleUser });
    setUser(json.user);
    setAuthOpen(false);
    return json.user;
  }, []);

  const logout = useCallback(async () => {
    await logoutFetch();
    setUser(null);
    setCodeState(null);
    try { await DB.setSessionUserId(null); } catch {}
  }, []);

  const updateProfile = useCallback(async (patch: { name?: string; email?: string; photo?: string | null }) => {
    if (!user) return null;
    // em produção faria PUT /api/auth/me — hoje atualiza local + servidor via novo login
    // mantém compat: salva local (o backend /api/sync cuida dos dados do usuário)
    const rec = await DB.getUserByEmail(user.email);
    if (rec) {
      await DB.saveUser({
        ...rec,
        name: String(patch.name ?? rec.name).trim() || rec.name,
        email: String(patch.email ?? rec.email).trim().toLowerCase(),
        photo: patch.photo ?? rec.photo,
      } as any);
    }
    const next = { ...user, name: patch.name ?? user.name, email: patch.email ?? user.email, photo: patch.photo ?? user.photo };
    setUser(next as any);
    return next;
  }, [user]);

  const changePassword = useCallback(async (_current: string, _nextPw: string) => {
    throw new Error('Alteração de senha no servidor chegará via PUT /api/auth/me (em breve).');
  }, []);

  const value = useMemo(() => ({
    user, isLoggedIn: !!user, ready,
    login, loginWithGoogle, requestCode, verifyCode, logout, updateProfile, changePassword,
    authOpen, setAuthOpen, profileOpen, setProfileOpen,
  }), [user, ready, login, loginWithGoogle, requestCode, verifyCode, logout, updateProfile, changePassword, authOpen, profileOpen]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
