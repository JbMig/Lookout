import Link from "next/link";
import { Logo } from "./Logo";

/** Barre des pages publiques (rapport partagé, offres). */
export function PublicTop({ children }: { children?: React.ReactNode }) {
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:px-10">
        <Link href="/" aria-label="Lookout, accueil" className="press inline-flex"><Logo className="h-12 w-auto" /></Link>
        <div className="flex items-center gap-3 text-sm text-ink-soft">{children}</div>
      </div>
    </header>
  );
}
