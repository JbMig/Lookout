"use client";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { ItemView, ReportBundle, ShadeFamily, Zone } from "@/lib/types";
import { Card, CardHead, Delta, Empty, ShadeStrip, Tabs, btnSecondary, controlCls } from "../ui";
import { ProductCard } from "./ProductCard";
import { FAMILY_COLORS, FormatsChart, PriceByBrandChart, SalesByBrandChart } from "./Charts";
import { fmtEur } from "@/lib/client";

export type Bundle = ReportBundle;

const TYPE_LABEL = { actif: "Actifs", format: "Formats", teinte: "Teintes", finition: "Finitions" } as const;
const TREND = {
  progresse: { label: "Progresse", cls: "text-ok" },
  décline: { label: "Décline", cls: "text-bad" },
  stable: { label: "Stable", cls: "text-ink-soft" },
  inconnu: { label: "—", cls: "text-ink-faint" },
} as const;
const ZONE = { US: "États-Unis", EU: "Europe" } as const;

/** Évolution entre les deux dernières périodes Circana, en %. */
export function growthOf(i: ItemView): number | null {
  const h = i.circana.history;
  if (!h || h.length < 2) return null;
  const prev = h[h.length - 2].salesValue, last = h[h.length - 1].salesValue;
  if (!prev || last === undefined) return null;
  return Math.round(((last - prev) / prev) * 100);
}

/** Symbole de la devise des ventes Circana (dollar par défaut). */
export const salesSymbol = (currency?: string) => (currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$");

const fmtSales = (v?: number, currency?: string) => {
  if (v === undefined) return "—";
  const sym = salesSymbol(currency);
  return v >= 100_000
    ? `${(v / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M${sym}`
    : `${Math.round(v / 1_000).toLocaleString("fr-FR")} k${sym}`;
};

/** Produit absent de la période précédente (ventes à zéro) : nouveauté. */
export function isNew(i: ItemView): boolean {
  const h = i.circana.history;
  if (!h || h.length < 2) return false;
  return h[h.length - 2].salesValue === 0 && (h[h.length - 1].salesValue ?? 0) > 0;
}

function Growth({ item }: { item: ItemView }) {
  if (isNew(item)) return <span className="font-semibold text-ok">Nouveauté</span>;
  return <Delta value={growthOf(item)} />;
}

/** Onglet actif, gardé dans l'adresse (#marche…) pour le partage et le bouton retour. */
function useTab(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      setActive(ids.includes(h) ? h : ids[0]);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [ids]);
  const select = (id: string) => {
    setActive(id);
    if (window.location.hash.slice(1) !== id) window.history.pushState(null, "", `#${id}`);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };
  return [active, select] as const;
}

/** Tableau principal : chaque produit avec ses ventes, son prix et sa bande de teintes. */
function RangeTable({ items, isClient }: { items: ItemView[]; isClient: (b: string) => boolean }) {
  const [sort, setSort] = useState<"sales" | "growth" | "price" | "shades">("sales");
  const sorted = useMemo(() => {
    const key = (i: ItemView) =>
      sort === "sales" ? i.circana.salesValue ?? -1 : sort === "growth" ? growthOf(i) ?? -999 : sort === "price" ? i.product?.priceEur ?? -1 : i.product?.shades.length ?? -1;
    return [...items].sort((a, b) => key(b) - key(a));
  }, [items, sort]);
  const [all, setAll] = useState(false);
  const TOP = 15;
  const shown = all ? sorted : sorted.slice(0, TOP);
  const th = (id: typeof sort, label: string) => (
    <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">
      <button onClick={() => setSort(id)} className={`press rounded px-1 ${sort === id ? "text-ink" : "hover:text-ink"}`} aria-sort={sort === id ? "descending" : undefined}>
        {label}{sort === id ? " ↓" : ""}
      </button>
    </th>
  );
  const period = items.find((i) => i.circana.period)?.circana.period;
  return (
    <Card flush>
      <div className="px-5 pt-5">
        <CardHead title="Les gammes du marché" sub={`Ventes Circana${period ? ` ${period}` : ""} et teintes relevées sur chaque fiche`} />
      </div>
      <ul className="divide-y divide-line-soft border-t border-line-soft md:hidden">
        {shown.map((i) => {
          const mine = isClient(i.circana.brand);
          return (
            <li key={i.id} className={`px-5 py-3.5 ${mine ? "bg-amber-wash/60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{i.product?.brand || i.circana.brand}{mine && <span className="ml-2 rounded-full bg-amber/25 px-2 py-px text-[11px] font-semibold text-amber-dark">Votre marque</span>}</div>
                  <div className="text-[13px] text-ink-soft">{i.product?.name || i.circana.product} · {i.circana.zone}</div>
                </div>
                <span className="shrink-0 text-sm font-semibold">{i.product?.priceEur != null ? fmtEur(i.product.priceEur) : "—"}</span>
              </div>
              <div className="mt-1 text-[13px] text-ink-soft">{fmtSales(i.circana.salesValue, i.circana.currency)} · <Growth item={i} /></div>
              <div className="mt-2"><ShadeStrip shades={i.product?.shades ?? []} width="100%" height={18} pending={i.status === "done" ? "aucune teinte" : "teintes à venir"} /></div>
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-y border-line-soft text-[12.5px] text-ink-faint">
            <tr>
              <th className="py-2.5 pl-5 pr-3 text-left font-semibold">Produit</th>
              <th className="px-3 py-2.5 text-left font-semibold">Zone</th>
              {th("sales", "Ventes")}
              {th("growth", "Évolution")}
              {th("price", "Prix")}
              <th className="py-2.5 pl-3 pr-5 text-left font-semibold">
                <button onClick={() => setSort("shades")} className={`press rounded px-1 ${sort === "shades" ? "text-ink" : "hover:text-ink"}`}>
                  Teintes{sort === "shades" ? " ↓" : ""}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((i) => {
              const mine = isClient(i.circana.brand);
              const shades = i.product?.shades ?? [];
              return (
                <tr key={i.id} className={`border-b border-line-soft last:border-0 ${mine ? "bg-amber-wash/60" : ""}`}>
                  <td className="py-2.5 pl-5 pr-3">
                    <div className="font-semibold">
                      {i.product?.brand || i.circana.brand}
                      {mine && <span className="ml-2 rounded-full bg-amber/25 px-2 py-px text-[11px] font-semibold text-amber-dark">Votre marque</span>}
                    </div>
                    <div className="text-[13px] text-ink-soft">{i.product?.name || i.circana.product}</div>
                  </td>
                  <td className="px-3">{i.circana.zone}</td>
                  <td className="whitespace-nowrap px-3 text-right">{fmtSales(i.circana.salesValue, i.circana.currency)}</td>
                  <td className="whitespace-nowrap px-3 text-right"><Growth item={i} /></td>
                  <td className="px-3 text-right">{i.product?.priceEur != null ? fmtEur(i.product.priceEur) : "—"}</td>
                  <td className="py-2.5 pl-3 pr-5">
                    <div className="flex items-center gap-2">
                      <ShadeStrip
                        shades={shades}
                        width={190}
                        pending={i.status === "awaiting_team" || i.status === "navigating" ? "chez l'équipe" : ["pending", "collecting"].includes(i.status) ? "collecte en cours" : "aucune teinte"}
                      />
                      {shades.length > 0 && <span className="text-[12.5px] text-ink-faint">{shades.length}</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sorted.length > TOP && (
        <div className="no-print border-t border-line-soft px-5 py-3 text-center">
          <button type="button" onClick={() => setAll(!all)} className="press text-sm font-semibold text-ink-soft hover:text-ink">
            {all ? `Afficher les ${TOP} premiers` : `Voir les ${sorted.length} produits`}
          </button>
        </div>
      )}
    </Card>
  );
}

/** Audit du catalogue du client (onglet « Votre catalogue »). */
function CatalogAudit({ catalog }: { catalog: NonNullable<ReportBundle["report"]["catalog"]> }) {
  const n = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  return (
    <section id="catalogue">
      <Card flush>
        <div className="px-5 pt-5"><CardHead title="Audit de votre catalogue" sub="Vos produits comparés aux prix et aux gammes du marché" /></div>
        <ul className="divide-y divide-line-soft border-t border-line-soft md:hidden">
          {catalog.products.map((p, i) => (
            <li key={i} className="px-5 py-3 text-sm">
              <div className="font-semibold">{p.client.name}</div>
              <div className="text-[13px] text-ink-soft">{p.client.brand}{p.client.zone ? ` · ${p.client.zone}` : ""}{p.client.status ? ` · ${p.client.status}` : ""}</div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                <span className={TREND[p.trend].cls}>Ventes : {TREND[p.trend].label}</span>
                <span>Prix : <Delta value={p.priceGapPct} /></span>
                <span>Teintes : {p.shadesGap === null ? "—" : `${p.shadesGap > 0 ? "+" : p.shadesGap < 0 ? "−" : ""}${n(Math.abs(p.shadesGap))}`}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="border-y border-line-soft text-[12.5px] text-ink-faint">
              <tr>
                <th className="py-2.5 pl-5 pr-3 text-left font-semibold">Produit</th>
                <th className="px-3 text-left font-semibold">Statut</th>
                <th className="px-3 text-left font-semibold">Ventes</th>
                <th className="px-3 text-right font-semibold">Prix vs marché</th>
                <th className="px-3 text-right font-semibold">Teintes vs best-sellers</th>
                <th className="py-2.5 pl-3 pr-5 text-left font-semibold">Trouvé sur le marché</th>
              </tr>
            </thead>
            <tbody>
              {catalog.products.map((p, i) => (
                <tr key={i} className="border-b border-line-soft last:border-0">
                  <td className="py-2.5 pl-5 pr-3"><div className="font-semibold">{p.client.name}</div><div className="text-[13px] text-ink-soft">{p.client.brand}{p.client.zone ? ` · ${p.client.zone}` : ""}</div></td>
                  <td className="px-3">{p.client.status ?? "—"}</td>
                  <td className={`px-3 ${TREND[p.trend].cls}`}>{TREND[p.trend].label}</td>
                  <td className="px-3 text-right"><Delta value={p.priceGapPct} /></td>
                  <td className="px-3 text-right">{p.shadesGap === null ? "—" : `${p.shadesGap > 0 ? "+" : p.shadesGap < 0 ? "−" : ""}${n(Math.abs(p.shadesGap))}`}</td>
                  <td className="py-2.5 pl-3 pr-5 text-[13px] text-ink-soft">{p.matchName ? `${p.matchName} (${Math.round((p.matchScore ?? 0) * 100)} %)` : "Non trouvé"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

export function ReportView({ bundle }: { bundle: Bundle }) {
  const { report, items } = bundle;
  const s = report.stats;
  const [zone, setZone] = useState<"all" | Zone>("all");
  const [fmt, setFmt] = useState("all");
  const [brand, setBrand] = useState("all");
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const PAGE = 24;
  const [limit, setLimit] = useState(PAGE);

  const clientBrands = useMemo(() => new Set((report.catalog?.clientBrands ?? []).map((b) => b.toLowerCase())), [report.catalog]);
  const isClient = (b: string) => clientBrands.has(b.toLowerCase());
  const formats = useMemo(() => [...new Set(items.map((i) => i.product?.packaging || i.product?.formats[0]?.size).filter(Boolean) as string[])].sort(), [items]);
  const brands = useMemo(() => [...new Set(items.map((i) => i.circana.brand))].sort(), [items]);
  const priceCeil = useMemo(() => Math.ceil(Math.max(0, ...items.map((i) => i.product?.priceEur ?? 0))), [items]);

  const families = useMemo(() => {
    const total: Partial<Record<ShadeFamily, number>> = {};
    for (const b of s?.shadeFamilies ?? []) for (const [f, n] of Object.entries(b.families)) total[f as ShadeFamily] = (total[f as ShadeFamily] ?? 0) + (n ?? 0);
    const sum = Object.values(total).reduce((a, b) => a + (b ?? 0), 0);
    return (Object.entries(total) as [ShadeFamily, number][])
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, n]) => ({ name, share: Math.round((n / sum) * 100) }));
  }, [s]);

  const filtered = items.filter(
    (i) =>
      (zone === "all" || i.circana.zone === zone) &&
      (brand === "all" || i.circana.brand === brand) &&
      (fmt === "all" || (i.product?.packaging || i.product?.formats[0]?.size) === fmt) &&
      (maxPrice === null || (i.product?.priceEur ?? 0) <= maxPrice) &&
      (!q || `${i.circana.brand} ${i.circana.product} ${i.product?.ingredients ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );

  const sections = useMemo(
    () => [
      { id: "synthese", label: "Synthèse" },
      ...(report.catalog ? [{ id: "catalogue", label: "Votre catalogue" }] : []),
      { id: "marche", label: "Marché" },
      ...(report.trends ? [{ id: "tendances", label: "Tendances" }] : []),
      { id: "fiches", label: "Fiches produits", count: items.length },
    ],
    [report.catalog, report.trends, items.length],
  );
  const ids = useMemo(() => sections.map((x) => x.id), [sections]);
  const [active, setActive] = useTab(ids);
  /** Un seul onglet visible à l'écran ; tous sont imprimés dans l'export PDF. */
  const panel = (id: string) => (active === id ? "" : "hidden print:block");

  return (
    <div className="space-y-8">
      <div className="no-print sticky top-[60px] z-20 -mx-5 bg-ground/95 px-5 backdrop-blur-sm sm:-mx-8 sm:px-8 lg:top-0 lg:-mx-10 lg:px-10">
        <Tabs items={sections} active={active} onSelect={setActive} />
      </div>

      <section id="synthese" role="tabpanel" aria-label="Synthèse" className={`print-full grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px] ${panel("synthese")}`}>
        <RangeTable items={items} isClient={isClient} />

        <div className="flex flex-col gap-6">
          <Card>
            <CardHead title="En deux minutes" />
            {report.analysis ? (
              <div className="space-y-3 leading-relaxed text-ink-soft">{report.analysis.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>
            ) : (
              <p className="text-sm text-ink-faint">L&apos;analyse rédigée apparaîtra à la fin de la collecte.</p>
            )}
            {s && (
              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line-soft pt-4 text-sm">
                <div><dt className="text-ink-faint">Prix moyen US</dt><dd className="font-semibold">{fmtEur(s.avgPriceEur.US)}</dd></div>
                <div><dt className="text-ink-faint">Prix moyen Europe</dt><dd className="font-semibold">{fmtEur(s.avgPriceEur.EU)}</dd></div>
                <div><dt className="text-ink-faint">Teintes par produit</dt><dd className="font-semibold">{s.shadeCountAvg.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</dd></div>
                <div><dt className="text-ink-faint">Fiches complètes</dt><dd className="font-semibold">{s.completeCount} sur {s.productCount}</dd></div>
              </dl>
            )}
            {report.analysis && <p className="mt-4 text-xs text-ink-faint">Rédigée par un modèle Hugging Face à partir des chiffres du rapport.</p>}
          </Card>

          {families.length > 0 && (
            <Card>
              <CardHead title="Familles de teintes" sub="Part des teintes relevées sur les fiches" />
              <div className="grid grid-cols-2 gap-2.5">
                {families.map((f, idx) => (
                  <div key={f.name} className={`lift overflow-hidden rounded-[10px] border border-line ${families.length % 2 && idx === families.length - 1 ? "col-span-2" : ""}`}>
                    <div className="h-12" style={{ background: FAMILY_COLORS[f.name] }} />
                    <div className="px-2.5 py-1.5 text-[13px] leading-tight">
                      <span className="block font-semibold">{f.name}</span>
                      <span className="text-ink-soft">{f.share} %</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

        </div>
      </section>

      {report.catalog && (
        <div role="tabpanel" aria-label="Votre catalogue" className={panel("catalogue")}>
          <CatalogAudit catalog={report.catalog} />
        </div>
      )}

      <section id="marche" role="tabpanel" aria-label="Marché" className={`grid gap-6 lg:grid-cols-2 ${panel("marche")}`}>
        <Card><CardHead title="Prix constaté par marque" sub="En euros, après conversion" /><PriceByBrandChart items={items} /></Card>
        <Card><CardHead
            title="Ventes Circana par marque"
            sub={new Set(items.map((i) => i.circana.currency ?? "USD")).size > 1 ? "En millions, dans la devise du fichier (États-Unis : $, Europe : €)" : `En millions de ${salesSymbol(items[0]?.circana.currency) === "€" ? "euros" : "dollars"}`}
          /><SalesByBrandChart items={items} /></Card>
        {s && <Card className="lg:col-span-2"><CardHead title="Formats et packagings" sub="Nombre de produits par format relevé" /><FormatsChart stats={s} /></Card>}
      </section>

      {report.trends && (
        <section id="tendances" role="tabpanel" aria-label="Tendances" className={panel("tendances")}>
          <Card>
            <CardHead title="Tendances sociales" sub={`${report.trends.postsAnalyzed} publications · ${report.trends.source}`} />
            <p className="max-w-3xl leading-relaxed text-ink-soft">{report.trends.summary}</p>
            <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {(Object.keys(TYPE_LABEL) as (keyof typeof TYPE_LABEL)[]).map((type) => {
                const list = report.trends!.items.filter((t) => t.type === type).slice(0, 6);
                return (
                  <div key={type}>
                    <h3 className="mb-2 text-sm font-semibold">{TYPE_LABEL[type]}</h3>
                    {!list.length && <p className="text-[13px] text-ink-faint">Aucune mention relevée</p>}
                    <ul className="space-y-2.5">
                      {list.map((t) => (
                        <li key={t.label} className="text-sm">
                          <div className="flex justify-between gap-2"><span className="truncate">{t.label}</span><span className="text-ink-soft">{Math.round(t.share * 100)} %</span></div>
                          <div className="mt-1 h-1.5 rounded-full bg-line-soft"><div className="h-full rounded-full bg-night" style={{ width: `${Math.max(4, t.share * 100)}%` }} /></div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
      )}

      <section id="fiches" role="tabpanel" aria-label="Fiches produits" className={panel("fiches")}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-[-0.01em]">Fiches produits <span className="font-medium text-ink-faint">{filtered.length}</span></h2>
          <div className="no-print flex flex-wrap items-end gap-3 text-sm">
            <label className="relative block">
              <span className="sr-only">Rechercher</span>
              <Search size={15} className="pointer-events-none absolute left-3 top-[11px] text-ink-faint" aria-hidden />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Produit, ingrédient…" className={`${controlCls} w-56 pl-9`} />
            </label>
            <select aria-label="Zone" value={zone} onChange={(e) => setZone(e.target.value as "all" | Zone)} className={`${controlCls}`}>
              <option value="all">Toutes les zones</option><option value="US">{ZONE.US}</option><option value="EU">{ZONE.EU}</option>
            </select>
            <select aria-label="Marque" value={brand} onChange={(e) => setBrand(e.target.value)} className={`${controlCls}`}>
              <option value="all">Toutes les marques</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select aria-label="Format" value={fmt} onChange={(e) => setFmt(e.target.value)} className={`${controlCls} max-w-52`}>
              <option value="all">Tous les formats</option>
              {formats.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            {priceCeil > 0 && (
              <label className="flex flex-col pb-1">
                <span className="text-xs text-ink-faint">Prix max : {maxPrice ?? priceCeil} €</span>
                <input type="range" min={0} max={priceCeil} value={maxPrice ?? priceCeil} onChange={(e) => setMaxPrice(Number(e.target.value))} className="mt-1.5 w-36" />
              </label>
            )}
          </div>
        </div>
        {!filtered.length ? (
          <Empty title="Aucune fiche ne correspond aux filtres">Élargissez la zone, la marque ou le prix maximum.</Empty>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.slice(0, limit).map((item) => <ProductCard key={item.id} item={item} isClient={isClient(item.circana.brand)} />)}
          </div>
        )}
        {filtered.length > limit && (
          <div className="no-print mt-6 flex flex-col items-center gap-2">
            <p className="text-[13px] text-ink-faint">{limit} fiches affichées sur {filtered.length}</p>
            <button type="button" onClick={() => setLimit(limit + PAGE)} className={btnSecondary}>Afficher {Math.min(PAGE, filtered.length - limit)} fiches de plus</button>
          </div>
        )}
      </section>
    </div>
  );
}

