"use client";
import { useState } from "react";
import { ExternalLink, Sparkles } from "lucide-react";
import { Private } from "@/components/Session";
import { AgentButton, FilterBar, Kpi, NO_FILTERS, NeedsSettings, Packshot, Shaderange, TrendPill, growthPct, money, revenue, useFiltered, useHashScroll, useUniverse } from "@/components/agents/kit";
import { Card, Delta, Empty, ErrorText, PageHeader, PageSkeleton } from "@/components/ui";
import { formatLabel, placeLabel } from "@/lib/normalize";
import type { CatalogItem } from "@/lib/universe";

function ProductCard({ p, years }: { p: CatalogItem; years: { prev: number | null; cur: number | null } }) {
  return (
    <Card as="article" className="lift flex flex-col gap-4">
      <div className="flex gap-4">
        <Packshot src={p.image} alt={p.name} size={84} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {p.isNew && <span className="inline-flex items-center gap-1 rounded-full bg-amber-wash px-2 py-0.5 text-[12px] font-medium text-amber-dark"><Sparkles size={12} aria-hidden />Nouveauté</span>}
            <TrendPill trend={p.trend} />
          </div>
          <h3 className="mt-1.5 font-semibold leading-snug">{p.name}</h3>
          <p className="text-[13px] text-ink-soft">{[formatLabel(p.format), p.texture, p.zone ? placeLabel(p.zone, p.country) : null].filter(Boolean).join(" · ")}</p>
        </div>
        <p className="shrink-0 text-right font-semibold tabular-nums">{money(p.price, p.currency)}</p>
      </div>
      <div>
        <p className="mb-1.5 text-[12.5px] font-medium text-ink-faint">{p.shadeCount} teinte{p.shadeCount > 1 ? "s" : ""}</p>
        <Shaderange shades={p.shades} max={20} />
      </div>
      <dl className="grid grid-cols-3 gap-2 rounded-[10px] bg-ground px-3 py-2.5 text-sm">
        <div><dt className="text-[12px] text-ink-faint">Ventes {years.prev ?? "N-1"}</dt><dd className="tabular-nums">{revenue(p.salesPrev, p.salesCurrency)}</dd></div>
        <div><dt className="text-[12px] text-ink-faint">Ventes {years.cur ?? "N"}</dt><dd className="tabular-nums">{revenue(p.salesCur, p.salesCurrency)}</dd></div>
        <div><dt className="text-[12px] text-ink-faint">Évolution</dt><dd className="tabular-nums"><Delta value={growthPct(p.salesPrev, p.salesCur)} /></dd></div>
      </dl>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-ink-soft">Teintes et ingrédients</summary>
        {p.keyIngredients.length > 0 && (
          <div className="mt-3">
            <p className="text-[12.5px] font-medium text-ink-faint">Ingrédients clés</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">{p.keyIngredients.map((k) => <li key={k} className="rounded-full border border-line px-2.5 py-0.5 text-[12.5px]">{k}</li>)}</ul>
          </div>
        )}
        {p.shades.length > 0 && (
          <table className="mt-3 w-full text-left text-[13px]">
            <thead className="text-ink-faint"><tr><th className="py-1 font-medium">Teinte</th><th className="font-medium">Hex</th><th className="font-medium">Famille</th><th className="font-medium">Dispo</th></tr></thead>
            <tbody>
              {p.shades.map((s, i) => (
                <tr key={i} className="border-t border-line-soft">
                  <td className="py-1.5"><span className="mr-2 inline-block h-3.5 w-3.5 rounded-full align-[-2px] shadow-[inset_0_0_0_1px_rgb(19_35_63/0.12)]" style={{ background: s.hex ?? "#CCCCCC" }} aria-hidden />{s.name}</td>
                  <td className="font-mono text-[12px] text-ink-soft">{s.hex ?? "—"}</td>
                  <td className="text-ink-soft">{s.family ?? "—"}</td>
                  <td>{s.available === undefined ? "—" : s.available ? "Oui" : <span className="text-ink-faint">Non</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium underline-offset-4 hover:underline">Fiche sur le site<ExternalLink size={13} aria-hidden /></a>}
      </details>
    </Card>
  );
}

function Catalog() {
  const { data, error, reload } = useUniverse();
  const [filters, setFilters] = useState(NO_FILTERS);
  const list = useFiltered(data?.catalog ?? [], filters);
  useHashScroll(!!data);
  if (!data) return error ? <ErrorText>{error}</ErrorText> : <PageSkeleton />;
  const cfg = data.config;
  const missing = [!cfg.brand && "la marque", !cfg.startUrl && "l'URL de départ"].filter(Boolean) as string[];
  const growing = list.filter((p) => p.trend === "croissance").length;
  const declining = list.filter((p) => p.trend === "declin").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Votre catalogue"
        meta={<span>{cfg.brand || "Marque à définir"} · {cfg.category} · fiches produites par l&apos;audit du catalogue</span>}
        actions={<AgentButton agent="0" label="Lancer l'audit" disabled={missing.length ? "Complétez les réglages pour lancer l'audit." : null} onDone={() => void reload()} />}
      />
      <NeedsSettings missing={missing} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Produits" value={list.length} sub={`sur ${data.catalog.length} au catalogue`} />
        <Kpi label="Teintes" value={list.reduce((a, p) => a + p.shadeCount, 0)} />
        <Kpi label="En croissance" value={growing} sub={data.years.cur ? `${data.years.prev} → ${data.years.cur}` : "ventes non importées"} />
        <Kpi label="En déclin" value={declining} />
      </div>
      <FilterBar value={filters} onChange={setFilters} />
      {!data.catalog.length ? (
        <Empty title="Le catalogue est vide">Lancez l&apos;audit : l&apos;Agent 0 parcourt le site de la marque et enregistre chaque fiche produit.</Empty>
      ) : !list.length ? (
        <Empty title="Aucun produit ne correspond aux filtres" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{list.map((p) => <div key={p.id} id={`p-${p.id}`} className="scroll-mt-24"><ProductCard p={p} years={data.years} /></div>)}</div>
      )}
    </div>
  );
}

export default function CatalogPage() {
  return <Private><Catalog /></Private>;
}
