import { ArrowUpRight, ImageOff } from "lucide-react";
import type { ItemView } from "@/lib/types";
import { StatusBadge } from "../StatusBadge";
import { Delta, ShadeStrip } from "../ui";
import { fmtMoney } from "@/lib/client";
import { growthOf, isNew, salesSymbol } from "./ReportView";

const METHOD = { scraping: "scraping direct", linkup: "Linkup", hcompany: "computer use H Company", manual: "saisie de l'équipe", demo: "démo" } as const;

export function ProductCard({ item, isClient }: { item: ItemView; isClient?: boolean }) {
  const p = item.product;
  const c = item.circana;
  return (
    <article className={`flex flex-col overflow-hidden rounded-[14px] border bg-paper ${isClient ? "border-amber ring-1 ring-amber/40" : "border-line"}`}>
      <div className={`relative flex items-center justify-center bg-ground ${p?.imageUrl ? "h-44" : "h-14"}`}>
        {p?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imageUrl} alt={`Packshot ${c.brand} ${c.product}`} className="h-full w-full object-contain p-4 mix-blend-multiply" loading="lazy" />
        ) : (
          item.status === "done" && <span className="flex items-center gap-1.5 pl-24 text-xs text-ink-faint"><ImageOff size={14} aria-hidden />Pas de packshot</span>
        )}
        <span className={`absolute left-3 flex gap-1.5 ${p?.imageUrl ? "top-3" : "top-1/2 -translate-y-1/2"}`}>
          <span className="rounded-md bg-night px-2 py-0.5 text-xs font-semibold text-white">{c.zone}</span>
          {isClient && <span className="rounded-md bg-amber px-2 py-0.5 text-xs font-semibold text-night">Votre marque</span>}
        </span>
        {item.status !== "done" && <span className={`absolute right-3 ${p?.imageUrl ? "top-3" : "top-1/2 -translate-y-1/2"}`}><StatusBadge status={item.status} /></span>}
      </div>

      <ShadeStrip shades={p?.shades ?? []} width="100%" height={14} pending={item.status === "done" ? "aucune teinte" : "teintes à venir"} />

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-[13px] font-semibold text-ink-soft">{p?.brand || c.brand}</p>
          <h3 className="font-semibold leading-snug">{p?.name || c.product}</h3>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-lg font-semibold">{fmtMoney(p?.price, p?.currency)}</span>
          {p?.priceEur != null && p.currency !== "EUR" && <span className="text-sm text-ink-soft">≈ {fmtMoney(p.priceEur)}</span>}
        </div>

        {c.salesValue !== undefined && (
          <p className="text-[13px] text-ink-soft">
            Circana {c.period ?? ""} : {new Intl.NumberFormat("fr-FR").format(c.salesValue)} {salesSymbol(c.currency)}
            {isNew(item) ? <> · <span className="font-semibold text-ok">Nouveauté</span></> : growthOf(item) !== null && <> · <Delta value={growthOf(item)} /></>}
          </p>
        )}

        {p && p.formats.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {p.formats.map((f, i) => (
              <span key={i} className="rounded-full border border-line px-2.5 py-0.5 text-xs">
                {f.size}{f.price ? ` · ${fmtMoney(f.price, f.currency)}` : ""}
              </span>
            ))}
          </div>
        )}

        {p && p.shades.length > 0 && <p className="text-[13px] text-ink-soft">{p.shades.length} teinte{p.shades.length > 1 ? "s" : ""} : {p.shades.slice(0, 4).map((s) => s.name).join(", ")}{p.shades.length > 4 ? "…" : ""}</p>}

        {p?.packaging && <p className="text-[13px]"><span className="text-ink-faint">Packaging : </span>{p.packaging}</p>}

        {p?.ingredients && (
          <details className="group text-[13px]">
            <summary className="cursor-pointer font-semibold text-ink-soft hover:text-ink">Composition INCI</summary>
            <p className="mt-1.5 leading-relaxed text-ink-soft">{p.ingredients}</p>
          </details>
        )}

        {item.status === "awaiting_team" && <p className="rounded-lg bg-amber-wash px-3 py-2 text-[13px] text-amber-dark">L&apos;équipe Lookout complète cette fiche ; le rapport se mettra à jour seul.</p>}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line-soft pt-3 text-[13px]">
          <span className="text-ink-faint">{item.method ? `Via ${METHOD[item.method]}` : "En attente"}</span>
          {p?.sourceUrl && (
            <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold hover:underline">
              Voir la source <ArrowUpRight size={14} aria-hidden />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
