/** Éléments d'interface partagés (monde « nuancier »). */
import type { ProductShade } from "@/lib/types";

export function Card({ children, className = "", flush = false, as: Tag = "section" }: { children: React.ReactNode; className?: string; flush?: boolean; as?: "section" | "div" | "article" }) {
  return <Tag className={`rounded-[14px] border border-line bg-paper ${flush ? "overflow-hidden" : "p-5"} ${className}`}>{children}</Tag>;
}

/** En-tête de carte : titre, sous-titre, action à droite. */
export function CardHead({ title, sub, children }: { title: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-[-0.01em]">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-ink-faint">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

/** En-tête de page : titre, ligne d'informations, actions. */
export function PageHeader({ title, meta, actions }: { title: React.ReactNode; meta?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] text-balance">{title}</h1>
        {meta && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-soft">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}

/** Champ sans largeur imposée (filtres en ligne). */
export const controlCls =
  "rounded-[10px] border border-line bg-paper px-3 py-2 text-sm placeholder:text-ink-faint transition-[border-color,box-shadow] duration-150 hover:border-[#cfd4dc] focus:border-night focus:outline-none focus:ring-3 focus:ring-night/10";

export const inputCls =
  "mt-1.5 w-full rounded-[10px] border border-line bg-paper px-3 py-2 text-sm placeholder:text-ink-faint transition-[border-color,box-shadow] duration-150 hover:border-[#cfd4dc] focus:border-night focus:outline-none focus:ring-3 focus:ring-night/10";

const btnBase = "press inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55";
export const btnPrimary = `${btnBase} bg-night text-white hover:bg-night-2`;
export const btnSecondary = `${btnBase} border border-line bg-paper text-ink hover:border-[#cfd4dc] hover:shadow-[0_2px_6px_rgb(19_35_63/0.07)]`;
export const btnAccent = `${btnBase} bg-amber text-night hover:bg-[#f5b257]`;
export const btnDanger = `${btnBase} border border-line bg-paper text-bad hover:border-bad/40`;

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-sm text-bad" role="alert">{children}</p>;
}

/** Onglets : chaque onglet affiche sa propre partie (pas de défilement entre sections). */
export function Tabs({ items, active, onSelect }: { items: { id: string; label: string; count?: number }[]; active: string; onSelect: (id: string) => void }) {
  return (
    <div role="tablist" aria-label="Sections" className="flex gap-6 overflow-x-auto border-b border-line">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={active === t.id}
          onClick={() => onSelect(t.id)}
          className={`-mb-px whitespace-nowrap border-b-2 py-2.5 text-sm font-semibold transition-colors duration-150 ${
            active === t.id ? "border-night text-ink" : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 font-medium text-ink-faint">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/**
 * Signature de Lookout : la bande des teintes réellement relevées sur la fiche.
 * Une teinte s'élargit au survol ; son nom s'affiche en infobulle.
 */
export function ShadeStrip({ shades, width = 200, height = 26, pending }: { shades: ProductShade[]; width?: number | string; height?: number; pending?: string }) {
  if (!shades.length) {
    return (
      <div
        className="flex items-center justify-center rounded-md text-[11.5px] text-ink-faint"
        style={{ width, height, background: "repeating-linear-gradient(135deg, #eef0f3 0 6px, #f8f9fa 6px 12px)" }}
      >
        {pending ?? "Aucune teinte"}
      </div>
    );
  }
  return (
    <div className="shade-strip flex overflow-hidden rounded-md shadow-[inset_0_0_0_1px_rgb(19_35_63/0.06)]" style={{ width, height }} role="img" aria-label={`${shades.length} teinte${shades.length > 1 ? "s" : ""} : ${shades.map((s) => s.name).join(", ")}`}>
      {shades.slice(0, 40).map((s, i) => (
        <i key={i} title={`${s.name}${s.family ? ` · ${s.family}` : ""}`} style={{ background: s.hex ?? "#d9dde3" }} />
      ))}
    </div>
  );
}

/** Pastille d'état avec point coloré. */
export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "wait" | "ok" | "bad" | "night"; children: React.ReactNode }) {
  const dot = { neutral: "bg-ink-faint", wait: "bg-amber", ok: "bg-ok", bad: "bg-bad", night: "bg-night" }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-paper px-2.5 py-0.5 text-[13px] font-medium text-ink">
      <i className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      {children}
    </span>
  );
}

/** État vide qui dit quoi faire. */
export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-[#d5d9e0] bg-paper px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

/** Chargement d'une page : squelette de titre et de contenu. */
export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement">
      <Skeleton className="h-8 w-80" />
      <Skeleton className="h-4 w-56" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}

/** Évolution en pourcentage, colorée. */
export function Delta({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-ink-faint">—</span>;
  const cls = value > 0 ? "text-ok" : value < 0 ? "text-bad" : "text-ink-faint";
  return <span className={cls}>{value > 0 ? "+" : value < 0 ? "−" : ""}{Math.abs(value)} %</span>;
}
