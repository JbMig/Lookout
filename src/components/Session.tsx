"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { SessionUser } from "@/lib/types";
import { PageSkeleton } from "./ui";

export interface Me {
  user: SessionUser;
}

const Ctx = createContext<{ me: Me | null; loading: boolean; refresh: () => Promise<void>; signOut: () => Promise<void> }>({
  me: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});

// Les liens de partage exigent un compte : ils affichent des ventes Circana sous licence du client.
const PUBLIC = ["/login", "/offres"];
const STORE = "lookout:me";

function readStored(): Me | null {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as Me) : null;
  } catch {
    return null;
  }
}
function writeStored(me: Me | null) {
  try {
    if (me) localStorage.setItem(STORE, JSON.stringify(me));
    else localStorage.removeItem(STORE);
  } catch {
    /* stockage indisponible : la session reste en mémoire */
  }
}

/**
 * Session de démonstration : une fois connecté, on le reste jusqu'au clic sur « Se déconnecter ».
 * La session est vérifiée une seule fois à l'ouverture de l'app (pas à chaque changement de page),
 * et gardée dans le navigateur.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMeState] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const setMe = useCallback((m: Me | null) => {
    setMeState(m);
    writeStored(m);
  }, []);

  /** Après une connexion : récupère l'utilisateur et le garde. */
  const refresh = useCallback(async () => {
    try {
      setMe(await api<Me>("/api/me"));
    } catch {
      /* on garde la session déjà connue */
    } finally {
      setLoading(false);
    }
  }, [setMe]);

  const signOut = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => null);
    setMe(null);
  }, [setMe]);

  // Une seule vérification, au chargement de l'app.
  useEffect(() => {
    let alive = true;
    Promise.resolve(readStored()).then((stored) => {
      if (!alive) return;
      if (stored) {
        setMeState(stored);
        setLoading(false);
        // Rafraîchit le nom affiché sans jamais déconnecter.
        api<Me>("/api/me").then((m) => alive && setMe(m)).catch(() => null);
        return;
      }
      api<Me>("/api/me")
        .then((m) => alive && setMe(m))
        .catch(() => alive && setMeState(null))
        .finally(() => alive && setLoading(false));
    });
    return () => {
      alive = false;
    };
  }, [setMe]);

  useEffect(() => {
    if (!loading && !me && !isPublic) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, me, isPublic, pathname, router]);

  return <Ctx.Provider value={{ me, loading, refresh, signOut }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);

/** Affiche le contenu seulement une fois la session chargée (pages privées). */
export function Private({ children, staff = false }: { children: React.ReactNode; staff?: boolean }) {
  const { me, loading } = useSession();
  if (loading || !me) return <PageSkeleton />;
  if (staff && !me.user.isStaff) return <p className="text-bad">Cette page est réservée à l&apos;équipe Lookout.</p>;
  return <>{children}</>;
}
