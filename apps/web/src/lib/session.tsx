"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, tokens, type Me, type Realm } from "./api";

type Session = { me: Me | null; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void> };
const Ctx = createContext<Session>({ me: null, loading: true, refresh: async () => {}, logout: async () => {} });

/** Wrap a protected area. Redirects to loginPath when there is no valid token for the realm. */
export function SessionProvider({ realm, loginPath, children }: { realm: Realm; loginPath: string; children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokens.get(realm)) {
      router.replace(loginPath);
      return;
    }
    try {
      const { user } = await api<{ user: Me }>("/auth/me", { realm });
      setMe(user);
    } catch {
      tokens.clear(realm);
      router.replace(loginPath);
    } finally {
      setLoading(false);
    }
  }, [realm, loginPath, router]);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST", realm }).catch(() => {});
    tokens.clear(realm);
    router.replace(loginPath);
  }, [realm, loginPath, router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ me, loading, refresh, logout }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
