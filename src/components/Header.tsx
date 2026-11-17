"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { useSession } from "./Session";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

export function Header() {
  const { me, refresh } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [demo, setDemo] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    api<{ demoLogin: boolean }>("/api/status")
      .then((s) => setDemo(s.demoLogin))
      .catch(() => null);
  }, []);

  /** Mode démo : le bouton Connexion connecte directement au compte de démonstration. */
  async function quickLogin() {
    setConnecting(true);
    try {
      await api("/api/auth/demo", { method: "POST" });
      await api("/api/me"); // session bien retrouvée ? sinon on bascule vers la page de connexion
      await refresh();
      router.push("/");
    } catch {
      router.push("/login");
    } finally {
      setConnecting(false);
    }
  }
  const links = me
    ? [
        { href: "/", label: "Rapports" },
        { href: "/catalogue", label: "Catalogues" },
        { href: "/account", label: "Compte" },
        ...(me.user.isStaff ? [{ href: "/admin", label: "Administration" }] : []),
      ]
    : [{ href: "/offres", label: "Offres" }];

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    await refresh();
    router.push("/login");
  }

  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-3" aria-label="Lookout, accueil">
          <Logo className="h-9 w-auto" />
          <span className="hidden text-sm text-ink-soft lg:inline">La veille qui ne dort jamais</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-2 hover:bg-cream ${pathname === l.href ? "font-medium text-ink" : "text-ink-soft"}`}
            >
              {l.label}
            </Link>
          ))}
          {me ? (
            <>
              <Link href="/new" className="ml-2 rounded-md bg-ink px-4 py-2 font-medium text-white hover:bg-ink/90">
                Nouvelle analyse
              </Link>
              <button onClick={logout} className="rounded-md px-3 py-2 text-ink-soft hover:bg-cream" title={me.user.email}>
                Déconnexion
              </button>
            </>
          ) : (
            demo ? (
              <button onClick={quickLogin} disabled={connecting} className="ml-2 rounded-md bg-ink px-4 py-2 font-medium text-white disabled:opacity-60">
                {connecting ? "Connexion…" : "Connexion"}
              </button>
            ) : (
              <Link href="/login" className="ml-2 rounded-md bg-ink px-4 py-2 font-medium text-white">Connexion</Link>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
