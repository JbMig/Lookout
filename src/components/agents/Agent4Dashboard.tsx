"use client";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { missingSections, parseAgent4, type Zone4 } from "@/lib/agent4";
import { kindLabel } from "@/components/agents/Opportunity";
import { Card, CardHead, Delta, Pill, Tabs } from "@/components/ui";

/** Rendu du rapport JSON de l'Agent 4 (agent Holo « bench-dashboard-creation »), section par section. */

const FY24 = "#c9b8a6";
const FY25 = "#1b1411";
const GRID = "#efe7de";
const TICK = { fontSize: 12, fill: "#7a6a5f" };
const TOOLTIP = {
  contentStyle: { borderRadius: 10, border: "1px solid #e6dccf", boxShadow: "0 8px 20px -12px rgb(27 20 17 / .35)", fontSize: 13 },
  cursor: { fill: "rgb(27 20 17 / 0.04)" },
};
const ZONES: Record<Zone4, { label: string; currency: string }> = { us: { label: "États-Unis", currency: "USD" }, fr: { label: "France", currency: "EUR" } };

const money = (v: number | null, cur: string, compact = true) =>
  v === null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: cur || "EUR", notation: compact ? "compact" : "standard", maximumFractionDigits: compact ? 1 : 2 }).format(v);
const pct = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
const dash = (v: string) => v || "—";

function None({ children = "Aucune donnée dans le rapport." }: { children?: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-ink-faint">{children}</p>;
}

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-line bg-paper p-4">
      <p className="text-[13px] text-ink-faint">{label}</p>
      <p className="mt-1 font-display text-[30px] font-semibold leading-none">{value}</p>
      {sub && <p className="mt-1.5 text-[13px]">{sub}</p>}
    </div>
  );
}

function Table({ head, rows, align }: { head: string[]; rows: React.ReactNode[][]; align?: ("l" | "r")[] }) {
  if (!rows.length) return <None />;
  const cls = (i: number) => (align?.[i] === "r" ? "text-right tabular-nums" : "text-left");
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-line text-[12.5px] text-ink-faint">{head.map((h, i) => <th key={h} scope="col" className={`px-3 py-2 font-medium ${cls(i)}`}>{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {rows.map((r, j) => <tr key={j}>{r.map((c, i) => <td key={i} className={`px-3 py-2 ${cls(i)}`}>{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

function FyChart({ data, cur, horizontal = false }: { data: { name: string; fy24: number | null; fy25: number | null }[]; cur: string; horizontal?: boolean }) {
  if (!data.length) return <None />;
  const fmt = (v: number) => money(v, cur);
  return (
    <ResponsiveContainer width="100%" height={horizontal ? Math.max(220, data.length * 34) : 280}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 4, right: 12, left: horizontal ? 8 : -4, bottom: 4 }} barGap={2}>
        <CartesianGrid stroke={GRID} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={TICK} tickFormatter={fmt} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={TICK} width={130} axisLine={false} tickLine={false} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={TICK} axisLine={false} tickLine={false} />
            <YAxis tick={TICK} tickFormatter={fmt} axisLine={false} tickLine={false} width={70} />
          </>
        )}
        <Tooltip {...TOOLTIP} formatter={(v) => money(Number(v), cur, false)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="fy24" name="FY 2024" fill={FY24} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} />
        <Bar dataKey="fy25" name="FY 2025" fill={FY25} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Agent4Dashboard({ data }: { data: unknown }) {
  const r = useMemo(() => parseAgent4(data), [data]);
  const missing = useMemo(() => missingSections(data), [data]);
  const zones = (["us", "fr"] as Zone4[]).filter((z) => r.market_size[z] || r.formats[z]?.length || r.top_brands[z]?.length || r.top_products[z]?.length);
  const [zone, setZone] = useState<Zone4>(zones[0] ?? "us");
  const cur = ZONES[zone].currency;
  const size = r.market_size[zone];
  const formats = r.formats[zone] ?? [];
  const brands = r.top_brands[zone] ?? [];
  const products = r.top_products[zone] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
        {r.meta.category && <Pill tone="night">{r.meta.category}</Pill>}
        {r.meta.zone && <Pill>Zone : {r.meta.zone}</Pill>}
        {r.meta.period && <Pill>{r.meta.period}</Pill>}
        {r.meta.generated_at && <span>Généré le {r.meta.generated_at}</span>}
        {r.meta.sources.length > 0 && <span className="text-ink-faint">Sources : {r.meta.sources.join(", ")}</span>}
      </div>

      {missing.length > 0 && missing.length < 11 && (
        <p className="rounded-[10px] border border-line bg-amber-wash px-4 py-2.5 text-sm" role="status">
          Rapport incomplet : l&apos;agent n&apos;a pas enregistré {missing.length > 1 ? "les sections" : "la section"} {missing.join(", ")}.
        </p>
      )}

      {zones.length > 1 && (
        <Tabs items={zones.map((z) => ({ id: z, label: ZONES[z].label }))} active={zone} onSelect={(id) => setZone(id as Zone4)} />
      )}

      <section aria-label="Taille du marché" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="CA du top 10, FY 2025" value={money(size?.fy25_top10 ?? null, cur)} sub={<>FY 2024 : {money(size?.fy24_top10 ?? null, cur)}</>} />
        <Kpi label="Évolution" value={<Delta value={pct(size?.evolution_pct ?? null)} />} sub={<span className="text-ink-faint">FY 2025 vs FY 2024</span>} />
        <Kpi label="Produits concurrents suivis" value={size?.nb_products ?? "—"} />
        <Kpi label="Marques" value={size?.nb_brands ?? "—"} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHead title="Formats" sub={`Chiffre d'affaires par format, ${ZONES[zone].label}`} />
          <FyChart data={formats} cur={cur} />
          <Table
            head={["Format", "FY 2024", "FY 2025", "Évolution", "Part"]}
            align={["l", "r", "r", "r", "r"]}
            rows={formats.map((f) => [f.name, money(f.fy24, cur), money(f.fy25, cur), <Delta key="d" value={pct(f.evolution_pct)} />, f.share_pct === null ? "—" : `${pct(f.share_pct)} %`])}
          />
        </Card>
        <Card>
          <CardHead title="Marques" sub={`Top marques par chiffre d'affaires, ${ZONES[zone].label}`} />
          <FyChart data={brands} cur={cur} horizontal />
          <Table
            head={["Marque", "FY 2024", "FY 2025", "Évolution"]}
            align={["l", "r", "r", "r"]}
            rows={brands.map((b) => [b.name, money(b.fy24, cur), money(b.fy25, cur), <Delta key="d" value={pct(b.evolution_pct)} />])}
          />
        </Card>
      </div>

      <Card flush>
        <div className="px-5 pt-5"><CardHead title="Produits best-sellers" sub={`Top produits, ${ZONES[zone].label}`} /></div>
        <div className="px-2 pb-3">
          <Table
            head={["Rang", "Marque", "Produit", "Format", "FY 2024", "FY 2025", ""]}
            align={["r", "l", "l", "l", "r", "r", "l"]}
            rows={products.map((p) => [p.rank ?? "—", p.brand, <span key="n" className="font-medium">{p.name}</span>, dash(p.format), money(p.fy24, cur), money(p.fy25, cur), p.is_new ? <Pill key="new" tone="wait">Nouveauté</Pill> : ""])}
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <CardHead title="Teintes les plus présentes" sub="Familles de teintes chez les concurrents" />
          {r.top_shades.length ? (
            <ul className="space-y-3">
              {r.top_shades.map((s) => (
                <li key={`${s.family}-${s.example}`} className="flex items-center gap-3">
                  <span className="h-9 w-9 shrink-0 rounded-full border border-line" style={{ background: s.hex ?? "repeating-linear-gradient(45deg,#efe7de,#efe7de 4px,#fff 4px,#fff 8px)" }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{s.family || "—"}</span>
                    <span className="text-[13px] text-ink-faint">{s.example ? `Ex. ${s.example}` : "Pas d'exemple"}{s.hex ? ` · ${s.hex}` : ""}</span>
                  </span>
                  <span className="tabular-nums text-ink-soft">{s.count ?? "—"}</span>
                </li>
              ))}
            </ul>
          ) : <None />}
        </Card>
        <Card flush>
          <div className="px-5 pt-5"><CardHead title="Prix des concurrents" /></div>
          <div className="px-2 pb-3">
            <Table
              head={["Marque", "Produit", "Prix", "Teintes"]}
              align={["l", "l", "r", "r"]}
              rows={r.competitor_prices.map((p) => [p.brand, p.name, p.price === null ? "—" : money(p.price, p.currency, false), p.shade_count ?? "—"])}
            />
          </div>
        </Card>
      </div>

      <Card flush>
        <div className="px-5 pt-5"><CardHead title="Votre catalogue" /></div>
        <div className="px-2 pb-3">
          <Table
            head={["Produit", "Format", "Prix", "Teintes", "Statut"]}
            align={["l", "l", "r", "r", "l"]}
            rows={r.catalog.map((c) => [<span key="n" className="font-medium">{c.name}</span>, dash(c.format), c.price === null ? "—" : money(c.price, c.currency, false), c.shade_count ?? "—", c.status === "inactive" ? <Pill key="s">Inactif</Pill> : c.status ? <Pill key="s" tone="ok">Actif</Pill> : "—"])}
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHead title="Constats" sub="Chaque constat s'appuie sur un chiffre de Supabase" />
          {r.insights.length ? <ul className="list-disc space-y-2 pl-5 text-sm">{r.insights.map((t, i) => <li key={i}>{t}</li>)}</ul> : <None />}
        </Card>
        <Card>
          <CardHead title="Recommandations" />
          {r.recommendations.length ? (
            <ul className="space-y-3">
              {r.recommendations.map((x, i) => (
                <li key={i} className="rounded-[10px] border border-line-soft bg-ground px-4 py-3">
                  {x.pillar && <p className="text-[12.5px] font-medium text-terracotta">{x.pillar}</p>}
                  <p className="font-medium">{x.title || "—"}</p>
                  {x.evidence && <p className="mt-0.5 text-[13px] text-ink-soft">{x.evidence}</p>}
                </li>
              ))}
            </ul>
          ) : <None />}
        </Card>
      </div>

      <Card>
        <CardHead title="Opportunités" />
        {r.opportunities.length ? (
          <ul className="divide-y divide-line">
            {r.opportunities.map((o, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3 py-2.5">
                {o.kind && <span className="rounded-full bg-night px-2.5 py-0.5 text-[12.5px] font-medium text-white">{kindLabel(o.kind)}</span>}
                <span className="min-w-0 flex-1">{o.title || "—"}</span>
                {o.priority && <Pill tone={/haute|high/i.test(o.priority) ? "bad" : /moyenne|medium/i.test(o.priority) ? "wait" : "neutral"}>{o.priority}</Pill>}
                <span className="w-14 text-right tabular-nums text-ink-soft">{o.score ?? "—"}</span>
              </li>
            ))}
          </ul>
        ) : <None />}
      </Card>
    </div>
  );
}
