"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { auth as authApi, ApiError, type Profile } from "./api";

type AuthState = {
  user: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    authApi
      .me()
      .then((p) => alive && setUser(p))
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) console.error(e);
        if (alive) setUser(null);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    await authApi.logout().catch(() => {});
    setUser(null);
    window.location.href = "/signin";
  }, []);

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
