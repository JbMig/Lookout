"use client";
import { useMemo, useState } from "react";
import { Private } from "@/components/Session";
import { AgentButton, FilterBar, SettingsBanner, Kpi, NO_FILTERS, Packshot, growthPct, revenue, useEur, useFiltered, useUniverse } from "@/components/agents/kit";
import { Card, CardHead, Delta, Empty, ErrorText, PageHeader, PageSkeleton } from "@/components/ui";
import { ZONE_LABEL, formatLabel } from "@/lib/normalize";
import { aggregateBrands, aggregateProducts } from "@/lib/market-view";
import type { Universe } from "@/lib/universe";

function Progress({ u }: { u: Universe }) {
  const enriched = u.market.filter((m) => m.status === "enriched" || m.enrichedAt).length;
  const pct = u.market.length ? Math.round((enriched / u.market.length) * 100) : 0;
  const j = u.enrichment;
  return (
    <Card>
      <CardHead title="Progression de l'enrichissement" sub="Produits concurrents traités par les agents 2 et 2.5." />
      <div className="flex items-baseline justify-between text-sm">
        <span><b className="text-[22px] tabular-nums">{enriched}</b> / {u.market.length} produits enrichis</span>
        <span className="tabular-nums text-ink-soft">{pct} %</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line-soft" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Produits enrichis">
        <div className="h-full rounded-full bg-night transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 text-[13px] text-ink-soft">
        File d&apos;enrichissement : {j.done} terminés · {j.running} en cours · {j.queued} en attente{j.failed ? ` · ${j.failed} en échec` : ""}
      </p>
    </Card>
  );
}

function Market() {
  const { data, error, reload } = useUniverse();
  const [filters, setFilters] = useState(NO_FILTERS);
  const eur = useEur();
  const products = useMemo(() => (data ? aggregateProducts(data.sales, data.market, data.years) : []), [data]);
  const list = useFiltered(products, filters);
  if (!data) return error ? <ErrorText>{error}</ErrorText> : <PageSkeleton />;

  const toEur = (v: number, c: string) => eur(v, c);
  // Taille du marché : chiffre publié par Circana quand les filtres le permettent, sinon la somme du Top 50 SKU.
  const official = (year: number | null) => {
    if (year === null || filters.min || filters.max || filters.brand !== "all") return null;
    const rows = data.marketTotals.filter(
      (t) => t.year === year && t.format === (filters.format === "all" ? "all" : filters.format) &&
        (filters.zone === "all" || (filters.zone === "US" ? t.country === "US" : t.country !== "US")),
    );
    if (!rows.length) return null;
    return rows.reduce((a, t) => a + (toEur(t.value, t.currency) ?? 0), 0);
  };
  const officialCur = official(data.years.cur);
  const officialPrev = official(data.years.prev);
  const top50Cur = list.reduce((a, p) => a + (toEur(p.cur, p.salesCurrency) ?? 0), 0);
  const top50Prev = list.reduce((a, p) => a + (toEur(p.prev, p.salesCurrency) ?? 0), 0);
  const size = officialCur ?? top50Cur;
  const sizePrev = officialCur !== null ? officialPrev ?? 0 : top50Prev;
  const brands = aggregateBrands(list, toEur, data.config.brand);
  const top = [...list].sort((a, b) => (toEur(b.cur, b.salesCurrency) ?? 0) - (toEur(a.cur, a.salesCurrency) ?? 0)).slice(0, 15);
  const maxBrand = brands[0]?.cur || 1;
  const priced = list.filter((p) => p.price !== null).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marché"
        meta={<span>{data.config.category} · ventes Circana {data.years.prev ?? "?"} → {data.years.cur ?? "?"}, montants convertis en euros au taux du jour</span>}
        actions={
          <div className="flex flex-wrap gap-6">
            <AgentButton agent="2.5" label="Enrichir via les sites web" onDone={() => void reload()} />
            <AgentButton agent="2" label="Lancer l'enrichissement" onDone={() => void reload()} />
          </div>
        }
      />
      <SettingsBanner />
      <Progress u={data} />
      <FilterBar value={filters} onChange={setFilters} />
      {(filters.min || filters.max) && <p className="text-[13px] text-ink-faint">Filtre de prix : seuls les {priced} produits dont le prix est connu sont comptés.</p>}
      {!data.sales.length ? (
        <Empty title="Aucune vente importée">Importez un fichier Circana pour mesurer la taille du marché.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label={`Taille du marché ${data.years.cur ?? ""}`} value={revenue(size, "EUR")} sub={officialCur !== null ? `Circana · dont Top 50 SKU : ${revenue(top50Cur, "EUR")}` : "somme du Top 50 SKU Circana"} />
            <Kpi label="Évolution sur un an" value={<Delta value={growthPct(sizePrev, size)} />} sub={sizePrev ? `${revenue(sizePrev, "EUR")} en ${data.years.prev ?? "N-1"}` : "année précédente non importée"} />
            <Kpi label="Marques" value={brands.length} />
            <Kpi label="Produits" value={list.length} />
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Card>
              <CardHead title="Top marques" sub={`Chiffre d'affaires ${data.years.cur ?? ""}, en euros`} />
              <ol className="space-y-2.5">
                {brands.slice(0, 12).map((b) => (
                  <li key={b.brand} className="grid grid-cols-[minmax(0,110px)_minmax(48px,1fr)_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,140px)_1fr_auto]">
                    <span className={`truncate ${b.isClient ? "font-semibold" : ""}`}>{b.brand}</span>
                    <span className="h-2.5 rounded-full bg-line-soft"><span className={`block h-full rounded-full ${b.isClient ? "bg-amber" : "bg-night"}`} style={{ width: `${Math.max(2, (b.cur / maxBrand) * 100)}%` }} /></span>
                    <span className="text-right tabular-nums sm:w-[120px]">{revenue(b.cur, "EUR")} <span className="text-[12px]"><Delta value={growthPct(b.prev, b.cur)} /></span></span>
                  </li>
                ))}
              </ol>
            </Card>
            <Card flush>
              <div className="px-5 pt-5"><CardHead title="Top produits" sub="Classés par chiffre d'affaires" /></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-[12.5px] text-ink-faint"><tr><th className="py-2 pl-5 font-medium">#</th><th className="font-medium">Produit</th><th className="font-medium">Format</th><th className="font-medium">Zone</th><th className="text-right font-medium">CA {data.years.cur}</th><th className="pr-5 text-right font-medium">Évol.</th></tr></thead>
                  <tbody>
                    {top.map((p, i) => (
                      <tr key={p.key} className="border-t border-line">
                        <td className="py-2 pl-5 tabular-nums text-ink-faint">{i + 1}</td>
                        <td className="py-2"><div className="flex items-center gap-3"><Packshot src={p.market?.packshot ?? null} alt={p.product} size={36} /><span><span className="block font-medium leading-tight">{p.product}</span><span className="text-[12.5px] text-ink-faint">{p.brand}</span></span></div></td>
                        <td>{formatLabel(p.format)}</td>
                        <td>{p.zone ? (p.country ?? ZONE_LABEL[p.zone]) : "—"}</td>
                        <td className="text-right tabular-nums">{revenue(p.cur, p.salesCurrency)}</td>
                        <td className="pr-5 text-right tabular-nums"><Delta value={growthPct(p.prev, p.cur)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export default function MarketPage() {
  return <Private><Market /></Private>;
}
