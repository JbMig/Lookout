"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, FileUp, Globe2, LayoutDashboard, Lightbulb, LogOut, Menu, Package, Radar, Settings2, ShieldCheck, Sparkles, Swords, UserRound, X, LineChart } from "lucide-react";
import { Logo } from "./Logo";
import { useSession } from "./Session";


const initials = (name: string) =>
  name.includes("@") ? name.slice(0, 2).toUpperCase() : name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/** Pages sans le rail : connexion, offres, rapport partagé. */
const BARE = ["/login", "/offres", "/share"];

function LogoChip({ className = "" }: { className?: string }) {
  return (
    <Link href="/" aria-label="Lookout, accueil" className={`press inline-flex rounded-[10px] bg-paper px-3.5 py-2.5 ${className}`}>
      <Logo className="h-8 w-auto" />
    </Link>
  );
}

function Rail({ onNavigate }: { onNavigate?: () => void }) {
  const { me, signOut } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await signOut();
    router.push("/login");
  }

  const groups: { title: string | null; links: { href: string; label: string; icon: typeof Settings2 }[] }[] = [
    {
      title: "Données",
      links: [
        { href: "/settings", label: "Réglages", icon: Settings2 },
        { href: "/import", label: "Import Circana", icon: FileUp },
        { href: "/catalog", label: "Votre catalogue", icon: Package },
        { href: "/market", label: "Marché", icon: BarChart3 },
        { href: "/competitors", label: "Concurrents", icon: Swords },
      ],
    },
    {
      title: "Résultats",
      links: [
        { href: "/analysis", label: "Analyse", icon: LineChart },
        { href: "/opportunities", label: "Opportunités", icon: Lightbulb },
        { href: "/dashboard", label: "Dashboards", icon: LayoutDashboard },
      ],
    },
    {
      title: "Veille",
      links: [
        { href: "/social", label: "Social listening", icon: Radar },
        { href: "/prisme", label: "Prisme", icon: Sparkles },
        { href: "/sites", label: "Sites suivis", icon: Globe2 },
        ...(me?.user.isStaff ? [{ href: "/admin", label: "Administration", icon: ShieldCheck }] : []),
      ],
    },
  ];
  const isOn = (href: string) => pathname === href || pathname.startsWith(`${href}/`) || (href === "/dashboard" && pathname.startsWith("/reports"));

  return (
    <div className="flex h-full flex-col gap-1 px-4 py-5 text-night-text">
      <LogoChip className="mb-6 self-start" />
      <nav aria-label="Navigation principale" className="-mx-1 flex flex-col gap-4 overflow-y-auto px-1">
        {groups.map((g, gi) => (
          <div key={gi} className="flex flex-col gap-0.5">
            {g.title && <p className="px-3 pb-1 text-xs font-semibold text-night-muted">{g.title}</p>}
            {g.links.map(({ href, label, icon: Icon }) => {
              const on = isOn(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={on ? "page" : undefined}
                  className={`press flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-semibold ${on ? "bg-night-3 text-white" : "hover:bg-night-2 hover:text-white"}`}
                >
                  <Icon size={17} strokeWidth={2} aria-hidden />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {me && (
        <div className="mt-auto border-t border-night-line pt-4">
          <Link href="/account" onClick={onNavigate} className="press flex items-center gap-3 rounded-[10px] px-3 py-2 hover:bg-night-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-night-3 text-xs font-semibold text-white" aria-hidden>
              {initials(me.user.fullName ?? me.user.email)}
            </span>
            <span className="min-w-0 text-[13px] leading-tight">
              <span className="block truncate font-semibold text-white">{me.user.fullName ?? "Mon compte"}</span>
              <span className="block truncate text-night-muted">{me.user.email}</span>
            </span>
            <UserRound size={15} className="ml-auto shrink-0 text-night-muted" aria-hidden />
          </Link>
          <button onClick={logout} className="press mt-1 flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-[13px] font-semibold hover:bg-night-2 hover:text-white">
            <LogOut size={15} aria-hidden /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { me } = useSession();
  const [open, setOpen] = useState(false);
  const bare = BARE.some((p) => pathname === p || pathname.startsWith(`${p}/`)) || !me;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (bare) {
    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <div className="hidden bg-night lg:block">
        <aside className="sticky top-0 h-screen">
          <Rail />
        </aside>
      </div>

      {/* Barre du haut et menu sur petit écran */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-night px-4 py-3 lg:hidden">
        <LogoChip />
        <button onClick={() => setOpen(true)} aria-expanded={open} aria-controls="menu-mobile" className="press rounded-[10px] p-2.5 text-white hover:bg-night-2" aria-label="Ouvrir le menu">
          <Menu size={22} />
        </button>
      </div>
      <div
        className={`fixed inset-0 z-40 bg-night/40 transition-opacity duration-200 lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <aside
        id="menu-mobile"
        className={`drawer fixed inset-y-0 left-0 z-50 w-[280px] bg-night lg:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}
        aria-hidden={!open}
        inert={!open}
      >
        <button onClick={() => setOpen(false)} className="press absolute right-3 top-4 rounded-[10px] p-2 text-white hover:bg-night-2" aria-label="Fermer le menu">
          <X size={20} />
        </button>
        <Rail onNavigate={() => setOpen(false)} />
      </aside>

      <div className="min-w-0">
        <main className="mx-auto w-full max-w-[1320px] px-5 py-7 sm:px-8 lg:px-10 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
