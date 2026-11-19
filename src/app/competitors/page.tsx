"use client";
import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Private } from "@/components/Session";
import { FilterBar, NO_FILTERS, Packshot, Shaderange, TrendPill, money, useFiltered, useHashScroll, useUniverse } from "@/components/agents/kit";
import { Card, Empty, ErrorText, PageHeader, PageSkeleton, btnSecondary } from "@/components/ui";
import { ZONE_LABEL, formatLabel } from "@/lib/normalize";
import type { MarketItem } from "@/lib/universe";

const PAGE = 30;

function Competitor({ m }: { m: MarketItem }) {
  const key = m.inci.filter((i) => i.key);
  return (
    <Card as="article" className="grid gap-4 md:grid-cols-[96px_minmax(0,1fr)_minmax(0,1.1fr)]">
      <Packshot src={m.packshot} alt={`${m.brand} ${m.name}`} size={96} />
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.04em] text-ink-faint">{m.brand}</p>
        <h3 className="font-semibold leading-snug">{m.name}</h3>
        <p className="mt-1 text-[13px] text-ink-soft">{[formatLabel(m.format), m.texture, m.zone ? (m.country ?? ZONE_LABEL[m.zone]) : null].filter(Boolean).join(" · ")}</p>
        <p className="mt-2 text-lg font-semibold tabular-nums">{money(m.price, m.currency)} <span className="text-[12.5px] font-normal text-ink-faint">{m.currency ?? ""}</span></p>
        <div className="mt-2 flex flex-wrap items-center gap-2"><TrendPill trend={m.trend} />{m.url && <a href={m.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium underline-offset-4 hover:underline">{m.sourceSite ?? "Fiche"}<ExternalLink size={12} aria-hidden /></a>}</div>
      </div>
      <div className="min-w-0 space-y-3">
        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-ink-faint">Top 10 teintes · {m.shadeCount} au total</p>
          <Shaderange shades={m.shades} max={10} size={20} />
          {m.shades.length > 0 && <p className="mt-1.5 truncate font-mono text-[11.5px] text-ink-faint">{m.shades.slice(0, 10).map((s) => s.hex ?? "—").join(" ")}</p>}
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-ink-soft">INCI · {m.inci.length ? `${m.inci.length} ingrédients` : "non relevé"}</summary>
          {key.length > 0 && <p className="mt-2 text-[13px]"><b>Clés :</b> {key.map((i) => i.name).join(", ")}</p>}
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{m.inci.map((i) => i.name).join(", ") || "—"}</p>
        </details>
      </div>
    </Card>
  );
}

function Competitors() {
  const { data, error } = useUniverse();
  const [filters, setFilters] = useState(NO_FILTERS);
  const [shown, setShown] = useState(() => (typeof window !== "undefined" && window.location.hash ? 100_000 : PAGE));
  const competitors = useMemo(
    () => (data?.market ?? []).filter((m) => !m.isClient && (m.status === "enriched" || m.enrichedAt || m.shades.length || m.inci.length)).sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name)),
    [data],
  );
  const list = useFiltered(competitors, filters);
  const brands = useMemo(() => [...new Set(competitors.map((m) => m.brand))].sort(), [competitors]);
  useHashScroll(!!data);
  if (!data) return error ? <ErrorText>{error}</ErrorText> : <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Concurrents" meta={<span>{competitors.length} produits enrichis par les agents 2 et 2.5 · prix en devise d&apos;origine</span>} />
      <FilterBar value={filters} onChange={(f) => { setFilters(f); setShown(PAGE); }} brands={brands} show={["zone", "format", "brand", "price"]} />
      {!competitors.length ? (
        <Empty title="Aucun produit concurrent enrichi">Lancez l&apos;enrichissement depuis la page Marché.</Empty>
      ) : !list.length ? (
        <Empty title="Aucun produit ne correspond aux filtres" />
      ) : (
        <>
          <p className="text-[13px] text-ink-faint">{list.length} produit{list.length > 1 ? "s" : ""}</p>
          <div className="space-y-3">{list.slice(0, shown).map((m) => <div key={m.id} id={`c-${m.id}`} className="scroll-mt-24"><Competitor m={m} /></div>)}</div>
          {list.length > shown && <button type="button" onClick={() => setShown(shown + PAGE)} className={btnSecondary}>Voir {Math.min(PAGE, list.length - shown)} produits de plus</button>}
        </>
      )}
    </div>
  );
}

export default function CompetitorsPage() {
  return <Private><Competitors /></Private>;
}
