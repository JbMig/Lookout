import type { ReportItemRow } from "@/lib/types";
import { StatusBadge } from "../StatusBadge";
import { fmtMoney } from "@/lib/client";

const METHOD = { scraping: "scraping direct", linkup: "Linkup", hcompany: "H Company (computer use)", manual: "saisie de l'équipe", demo: "démo" } as const;

export function ProductCard({ item, isClient }: { item: ReportItemRow; isClient?: boolean }) {
  const p = item.product;
  const c = item.circana;
  return (
    <article className={`flex flex-col overflow-hidden rounded-xl border bg-paper ${isClient ? "border-amber" : "border-line"}`}>
      <div className="relative flex h-44 items-center justify-center bg-cream">
        {p?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imageUrl} alt={`Packshot ${c.brand} ${c.product}`} className="h-full w-full object-contain p-3" loading="lazy" />
        ) : (
          <span className="text-xs text-ink-soft">Packshot non disponible</span>
        )}
        <span className="absolute left-3 top-3 flex gap-1">
          <span className="rounded bg-ink px-2 py-0.5 text-xs font-medium text-white">{c.zone}</span>
          {isClient && <span className="rounded bg-amber px-2 py-0.5 text-xs font-medium text-ink">Votre marque</span>}
        </span>
        {item.status !== "done" && <span className="absolute right-3 top-3"><StatusBadge status={item.status} /></span>}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-soft">{p?.brand || c.brand}</p>
          <h3 className="font-medium leading-snug">{p?.name || c.product}</h3>
        </div>

        <div className="flex items-baseline justify-between text-sm">
          <span className="text-lg font-semibold">{fmtMoney(p?.price, p?.currency)}</span>
          {p?.priceEur != null && p.currency !== "EUR" && <span className="text-ink-soft">≈ {fmtMoney(p.priceEur)}</span>}
        </div>

        {c.salesValue !== undefined && (
          <p className="text-xs text-ink-soft">
            Circana {c.period ?? ""} : {new Intl.NumberFormat("fr-FR").format(c.salesValue)} $
            {c.units ? ` · ${new Intl.NumberFormat("fr-FR").format(c.units)} unités` : ""}
            {c.history && c.history.length > 1 && (() => {
              const h = c.history!;
              const prev = h[h.length - 2].salesValue, last = h[h.length - 1].salesValue;
              if (!prev || last === undefined) return null;
              const pct = Math.round(((last - prev) / prev) * 100);
              return <span className={pct >= 0 ? "text-ok" : "text-bad"}> · {pct >= 0 ? "+" : ""}{pct} % vs {h[h.length - 2].period}</span>;
            })()}
          </p>
        )}

        {p && p.formats.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {p.formats.map((f, i) => (
              <span key={i} className="rounded-full border border-line px-2 py-0.5 text-xs">
                {f.size}{f.price ? ` · ${fmtMoney(f.price, f.currency)}` : ""}
              </span>
            ))}
          </div>
        )}

        {p && p.shades.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-ink-soft">Gamme de {p.shades.length} teinte{p.shades.length > 1 ? "s" : ""}</p>
            <div className="flex flex-wrap gap-1">
              {p.shades.map((s, i) => (
                <span key={i} title={`${s.name}${s.family ? ` · ${s.family}` : ""}`} className="h-5 w-5 rounded-full border border-line" style={{ background: s.hex ?? "#e3e0d8" }} />
              ))}
            </div>
          </div>
        )}

        {p?.packaging && <p className="text-xs"><span className="text-ink-soft">Packaging : </span>{p.packaging}</p>}

        {p?.ingredients && (
          <details className="text-xs">
            <summary className="cursor-pointer text-ink-soft">Composition INCI</summary>
            <p className="mt-1 leading-relaxed">{p.ingredients}</p>
          </details>
        )}

        {item.status === "awaiting_team" && <p className="text-xs text-amber-dark">Ce site demande un traitement manuel : l&apos;équipe Lookout s&apos;en occupe, la fiche se complètera automatiquement.</p>}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3 text-xs">
          <span className="text-ink-soft">{item.method ? `Via ${METHOD[item.method]}` : "En attente"}</span>
          {p?.sourceUrl && (
            <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
              Voir la source
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
