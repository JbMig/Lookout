"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { SessionUser } from "@/lib/types";
import { PageSkeleton } from "./ui";

export interface Me {
  user: SessionUser;
}

const Ctx = createContext<{ me: Me | null; loading: boolean; refresh: () => Promise<void> }>({
  me: null,
  loading: true,
  refresh: async () => {},
});

const PUBLIC = ["/login", "/offres", "/share"];

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const refresh = useCallback(async () => {
    try {
      setMe(await api<Me>("/api/me"));
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    api<Me>("/api/me")
      .then((m) => alive && setMe(m))
      .catch(() => alive && setMe(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (!loading && !me && !isPublic) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, me, isPublic, pathname, router]);

  return <Ctx.Provider value={{ me, loading, refresh }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);

/** Affiche le contenu seulement une fois la session chargée (pages privées). */
export function Private({ children, staff = false }: { children: React.ReactNode; staff?: boolean }) {
  const { me, loading } = useSession();
  if (loading || !me) return <PageSkeleton />;
  if (staff && !me.user.isStaff) return <p className="text-bad">Cette page est réservée à l&apos;équipe Lookout.</p>;
  return <>{children}</>;
}
