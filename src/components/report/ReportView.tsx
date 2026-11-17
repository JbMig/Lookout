"use client";
import { useMemo, useState } from "react";
import type { ReportBundle, Zone } from "@/lib/types";
import { Card, Kpi } from "../ui";
import { ProductCard } from "./ProductCard";
import { FormatsChart, PriceByBrandChart, SalesByBrandChart, ShadeFamiliesChart } from "./Charts";
import { fmtEur } from "@/lib/client";

export type Bundle = ReportBundle;

const TYPE_LABEL = { actif: "Actifs", format: "Formats", teinte: "Teintes", finition: "Finitions" } as const;
const TREND = {
  progresse: { label: "Progresse", cls: "text-ok" },
  décline: { label: "Décline", cls: "text-bad" },
  stable: { label: "Stable", cls: "text-ink-soft" },
  inconnu: { label: "—", cls: "text-ink-soft" },
} as const;

export function ReportView({ bundle }: { bundle: Bundle }) {
  const { report, items } = bundle;
  const s = report.stats;
  const [zone, setZone] = useState<"all" | Zone>("all");
  const [fmt, setFmt] = useState("all");
  const [brand, setBrand] = useState("all");
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [q, setQ] = useState("");

  const clientBrands = useMemo(() => new Set((report.catalog?.clientBrands ?? []).map((b) => b.toLowerCase())), [report.catalog]);
  const formats = useMemo(() => [...new Set(items.map((i) => i.product?.packaging || i.product?.formats[0]?.size).filter(Boolean) as string[])].sort(), [items]);
  const brands = useMemo(() => [...new Set(items.map((i) => i.circana.brand))].sort(), [items]);
  const priceCeil = useMemo(() => Math.ceil(Math.max(0, ...items.map((i) => i.product?.priceEur ?? 0))), [items]);

  const filtered = items.filter(
    (i) =>
      (zone === "all" || i.circana.zone === zone) &&
      (brand === "all" || i.circana.brand === brand) &&
      (fmt === "all" || (i.product?.packaging || i.product?.formats[0]?.size) === fmt) &&
      (maxPrice === null || (i.product?.priceEur ?? 0) <= maxPrice) &&
      (!q || `${i.circana.brand} ${i.circana.product} ${i.product?.ingredients ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );

  const sections = [
    { id: "synthese", label: "Synthèse" },
    ...(report.catalog ? [{ id: "catalogue", label: "Mon catalogue" }] : []),
    { id: "marche", label: "Marché" },
    ...(report.trends ? [{ id: "tendances", label: "Tendances" }] : []),
    { id: "fiches", label: "Fiches produits" },
  ];

  return (
    <div className="space-y-8">
      <nav aria-label="Sections du rapport" className="sticky top-0 z-10 -mx-2 flex gap-1 overflow-x-auto bg-cream/95 px-2 py-2 text-sm backdrop-blur">
        {sections.map((x) => (
          <a key={x.id} href={`#${x.id}`} className="whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-paper">{x.label}</a>
        ))}
      </nav>

      <section id="synthese" className="scroll-mt-16 space-y-4">
        {s && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi label="Produits analysés" value={String(s.productCount)} hint={s.awaitingTeam ? `${s.awaitingTeam} en traitement par l'équipe` : undefined} />
            <Kpi label="Fiches complètes" value={`${s.completeCount} / ${s.productCount}`} />
            <Kpi label="Prix moyen US" value={fmtEur(s.avgPriceEur.US)} />
            <Kpi label="Prix moyen Europe" value={fmtEur(s.avgPriceEur.EU)} />
            <Kpi label="Teintes par produit" value={String(s.shadeCountAvg)} hint="moyenne" />
          </div>
        )}
        {report.analysis && (
          <Card className="p-6">
            <h2 className="mb-3 text-lg font-semibold">Analyse du marché</h2>
            <div className="space-y-3 leading-relaxed">{report.analysis.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>
            <p className="mt-4 text-xs text-ink-soft">Rédigée par un LLM Hugging Face à partir des chiffres calculés du rapport.</p>
          </Card>
        )}
      </section>

      {report.catalog && (
        <section id="catalogue" className="scroll-mt-16">
          <Card className="p-6">
            <h2 className="text-lg font-semibold">Audit de votre catalogue</h2>
            <p className="mt-1 text-sm text-ink-soft">{report.catalog.summary}</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-ink-soft">
                  <tr>
                    <th className="py-2 font-medium">Produit</th>
                    <th className="py-2 font-medium">Statut</th>
                    <th className="py-2 font-medium">Ventes Circana</th>
                    <th className="py-2 font-medium">Prix vs marché</th>
                    <th className="py-2 font-medium">Teintes vs best-sellers</th>
                    <th className="py-2 font-medium">Correspondance</th>
                  </tr>
                </thead>
                <tbody>
                  {report.catalog.products.map((p, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="py-2"><span className="font-medium">{p.client.name}</span> <span className="text-ink-soft">{p.client.brand}{p.client.zone ? ` · ${p.client.zone}` : ""}</span></td>
                      <td className="py-2">{p.client.status ?? "—"}</td>
                      <td className={`py-2 ${TREND[p.trend].cls}`}>{TREND[p.trend].label}</td>
                      <td className={`py-2 ${p.priceGapPct === null ? "" : p.priceGapPct > 10 ? "text-bad" : p.priceGapPct < -10 ? "text-ok" : ""}`}>
                        {p.priceGapPct === null ? "—" : `${p.priceGapPct > 0 ? "+" : ""}${p.priceGapPct} %`}
                      </td>
                      <td className="py-2">{p.shadesGap === null ? "—" : `${p.shadesGap > 0 ? "+" : ""}${p.shadesGap}`}</td>
                      <td className="py-2 text-xs text-ink-soft">{p.matchName ? `${p.matchName} (${Math.round((p.matchScore ?? 0) * 100)} %)` : "Non trouvé sur le marché"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

      <section id="marche" className="grid scroll-mt-16 gap-4 lg:grid-cols-2">
        <Card><h2 className="mb-2 font-semibold">Prix constaté par marque (€)</h2><PriceByBrandChart items={items} /></Card>
        <Card><h2 className="mb-2 font-semibold">Ventes Circana par marque</h2><SalesByBrandChart items={items} /></Card>
        {s && <Card><h2 className="mb-2 font-semibold">Gammes de teintes par famille</h2><ShadeFamiliesChart stats={s} /></Card>}
        {s && <Card><h2 className="mb-2 font-semibold">Formats et packagings</h2><FormatsChart stats={s} /></Card>}
      </section>

      {report.trends && (
        <section id="tendances" className="scroll-mt-16">
          <Card className="p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">Tendances sociales</h2>
              <span className="text-xs text-ink-soft">{report.trends.postsAnalyzed} publications · {report.trends.source}</span>
            </div>
            <p className="mt-2 leading-relaxed">{report.trends.summary}</p>
            <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {(Object.keys(TYPE_LABEL) as (keyof typeof TYPE_LABEL)[]).map((type) => {
                const list = report.trends!.items.filter((t) => t.type === type).slice(0, 6);
                return (
                  <div key={type}>
                    <h3 className="mb-2 text-sm font-medium text-ink-soft">{TYPE_LABEL[type]}</h3>
                    {!list.length && <p className="text-xs text-ink-soft">Aucune mention</p>}
                    <ul className="space-y-2">
                      {list.map((t) => (
                        <li key={t.label} className="text-sm">
                          <div className="flex justify-between"><span>{t.label}</span><span>{Math.round(t.share * 100)} %</span></div>
                          <div className="mt-1 h-1.5 rounded-full bg-cream">
                            <div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(4, t.share * 100)}%` }} />
                          </div>
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

      <section id="fiches" className="scroll-mt-16">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-lg font-semibold">Fiches produits ({filtered.length})</h2>
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col">
              <span className="text-xs text-ink-soft">Recherche</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Produit, ingrédient…" className="rounded-md border border-line bg-paper px-2 py-1.5" />
            </label>
            <label className="flex flex-col">
              <span className="text-xs text-ink-soft">Zone</span>
              <select value={zone} onChange={(e) => setZone(e.target.value as "all" | Zone)} className="rounded-md border border-line bg-paper px-2 py-1.5">
                <option value="all">Toutes</option><option value="US">États-Unis</option><option value="EU">Europe</option>
              </select>
            </label>
            <label className="flex flex-col">
              <span className="text-xs text-ink-soft">Marque</span>
              <select value={brand} onChange={(e) => setBrand(e.target.value)} className="rounded-md border border-line bg-paper px-2 py-1.5">
                <option value="all">Toutes</option>
                {brands.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <label className="flex flex-col">
              <span className="text-xs text-ink-soft">Format</span>
              <select value={fmt} onChange={(e) => setFmt(e.target.value)} className="max-w-48 rounded-md border border-line bg-paper px-2 py-1.5">
                <option value="all">Tous</option>
                {formats.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            {priceCeil > 0 && (
              <label className="flex flex-col">
                <span className="text-xs text-ink-soft">Prix max : {maxPrice ?? priceCeil} €</span>
                <input type="range" min={0} max={priceCeil} value={maxPrice ?? priceCeil} onChange={(e) => setMaxPrice(Number(e.target.value))} />
              </label>
            )}
          </div>
        </div>
        {!filtered.length && <p className="rounded-xl border border-dashed border-line bg-paper p-8 text-center text-ink-soft">Aucun produit ne correspond aux filtres.</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => <ProductCard key={item.id} item={item} isClient={clientBrands.has(item.circana.brand.toLowerCase())} />)}
        </div>
      </section>
    </div>
  );
}
