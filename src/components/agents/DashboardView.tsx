"use client";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, Download, FileDown, Link2, Loader2 } from "lucide-react";
import { api } from "@/lib/client";
import { FilterBar, Kpi, NO_FILTERS, Packshot, Shaderange, TrendPill, growthPct, money, namesOf, revenue, useEur, useFiltered, type Filters } from "./kit";
import { OpportunityCard, oppZone, type OpportunityRow } from "./Opportunity";
import { Card, CardHead, Delta, Empty, Tabs, btnSecondary } from "@/components/ui";
import { FAMILY_COLORS, FORMATS, ZONE_LABEL, familyOf, formatLabel, placeLabel, strip } from "@/lib/normalize";
import { aggregateBrands, aggregateProducts } from "@/lib/market-view";
import type { DashboardBundle } from "@/lib/dashboards";

const NIGHT = "#13233F";
const AMBER = "#F2A33A";
const GRID = "#eef0f3";
const TICK = { fontSize: 12, fill: "#6f7b8e" };
const TOOLTIP = { contentStyle: { borderRadius: 10, border: "1px solid #e4e6eb", fontSize: 13 }, cursor: { fill: "rgb(19 35 63 / 0.04)" } };
const legendText = (v: string) => <span style={{ color: "#4f5d73", fontSize: 13 }}>{v}</span>;
const eurFmt = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 }).format(v);

const TABS = [
  { id: "marche", label: "Marché" },
  { id: "catalogue", label: "Votre catalogue" },
  { id: "top", label: "Top produits et prix" },
  { id: "variantes", label: "Variantes" },
  { id: "composition", label: "Composition" },
  { id: "opportunites", label: "Opportunités" },
];

function useHashTab() {
  const [tab, setTab] = useState("marche");
  useEffect(() => {
    const read = () => { const h = window.location.hash.slice(1); if (TABS.some((t) => t.id === h)) setTab(h); };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return [tab, (id: string) => { setTab(id); history.replaceState(null, "", `#${id}`); }] as const;
}

/** Export HTML autonome : le dashboard entier (tous les onglets), styles inclus. */
function exportHtml(title: string) {
  const root = document.getElementById("dashboard-root");
  if (!root) return;
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[hidden]").forEach((el) => el.removeAttribute("hidden"));
  clone.querySelectorAll(".no-print, [role=tablist]").forEach((el) => el.remove());
  let css = "";
  for (const sheet of Array.from(document.styleSheets)) {
    try { css += Array.from(sheet.cssRules).map((r) => r.cssText).join("\n"); } catch { /* feuille externe */ }
  }
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title.replace(/</g, "&lt;")}</title><style>${css}</style></head><body style="background:#f4f5f7"><main style="max-width:1280px;margin:0 auto;padding:32px">${clone.outerHTML}</main></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${strip(title).replace(/ /g, "-") || "dashboard"}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function ShareButton({ id, initial }: { id: string; initial: string | null }) {
  const [token, setToken] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${token}` : null;
  async function share() {
    setBusy(true);
    try {
      const t = token ?? (await api<{ token: string }>(`/api/reports/${id}/share`, { method: "POST" })).token;
      setToken(t);
      await navigator.clipboard?.writeText(`${window.location.origin}/share/${t}`).catch(() => undefined);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={share} disabled={busy} className={btnSecondary}>
        {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : copied ? <Check size={15} aria-hidden /> : <Link2 size={15} aria-hidden />}
        {copied ? "Lien copié" : "Partager"}
      </button>
      {link && <a href={link} target="_blank" rel="noreferrer" className="max-w-[300px] truncate text-[12px] text-ink-faint underline-offset-4 hover:underline">{link}</a>}
    </div>
  );
}

export function DashboardActions({ bundle }: { bundle: DashboardBundle }) {
  return (
    <div className="no-print flex flex-wrap items-start gap-2">
      <ShareButton id={bundle.report.id} initial={bundle.report.shareSlug} />
      <button type="button" onClick={() => window.print()} className={btnSecondary}><FileDown size={15} aria-hidden />PDF</button>
      <button type="button" onClick={() => exportHtml(bundle.report.title)} className={btnSecondary}><Download size={15} aria-hidden />HTML</button>
    </div>
  );
}

export function DashboardView({ bundle, publicView = false }: { bundle: DashboardBundle; publicView?: boolean }) {
  const u = bundle.universe;
  const eur = useEur();
  const [tab, setTab] = useHashTab();
  const [filters, setFilters] = useState<Filters>(() => ({ ...NO_FILTERS, ...((bundle.report.config.filters as Partial<Filters>) ?? {}) }));
  const names = useMemo(() => namesOf(u), [u]);

  const allProducts = useMemo(() => aggregateProducts(u.sales, u.market, u.years), [u]);
  const products = useFiltered(allProducts, filters);
  const market = useFiltered(u.market, filters);
  const catalog = useFiltered(u.catalog, { ...filters, brand: "all" });
  const brandsList = useMemo(() => [...new Set(allProducts.map((p) => p.brand).concat(u.market.map((m) => m.brand)))].sort(), [allProducts, u.market]);
  const toEur = (v: number | null, c: string | null) => (v === null ? null : eur(v, c));

  /* Marché */
  const size = products.reduce((a, p) => a + (toEur(p.cur, p.salesCurrency) ?? 0), 0);
  const sizePrev = products.reduce((a, p) => a + (toEur(p.prev, p.salesCurrency) ?? 0), 0);
  const brands = aggregateBrands(products, (v, c) => toEur(v, c), u.config.brand);
  const ranked = [...products].sort((a, b) => (toEur(b.cur, b.salesCurrency) ?? 0) - (toEur(a.cur, a.salesCurrency) ?? 0));

  /* Prix médian par format (euros), marché vs catalogue */
  const priceByFormat = FORMATS.filter((f) => f.id !== "autre").map((f) => {
    const med = (xs: number[]) => { const s = xs.sort((a, b) => a - b); return s.length ? Math.round(s[Math.floor(s.length / 2)] * 10) / 10 : null; };
    const m = market.filter((x) => !x.isClient && x.format === f.id).map((x) => toEur(x.price, x.currency)).filter((x): x is number => x !== null);
    const c = catalog.filter((x) => x.format === f.id).map((x) => toEur(x.price, x.currency)).filter((x): x is number => x !== null);
    return { format: f.label, Marché: med(m), "Votre catalogue": med(c) };
  }).filter((r) => r.Marché !== null || r["Votre catalogue"] !== null);

  /* Variantes */
  const famCount = (shades: { family: string | null; name: string }[]) => {
    const m = new Map<string, number>();
    for (const s of shades) { const f = familyOf(s.family, s.name); m.set(f, (m.get(f) ?? 0) + 1); }
    return m;
  };
  const famMarket = famCount(market.filter((m) => !m.isClient).flatMap((m) => m.shades));
  const famClient = famCount(catalog.flatMap((c) => c.shades));
  const famRows = [...new Set([...famMarket.keys(), ...famClient.keys()])].map((f) => {
    const tm = [...famMarket.values()].reduce((a, b) => a + b, 0) || 1;
    const tc = [...famClient.values()].reduce((a, b) => a + b, 0) || 1;
    return { famille: f, Marché: Math.round(((famMarket.get(f) ?? 0) / tm) * 100), "Votre catalogue": Math.round(((famClient.get(f) ?? 0) / tc) * 100) };
  }).sort((a, b) => b.Marché - a.Marché);
  const bySales = [...market].sort((a, b) => (toEur(b.salesCur, b.salesCurrency) ?? 0) - (toEur(a.salesCur, a.salesCurrency) ?? 0));
  const topShades = bySales.filter((m) => !m.isClient).flatMap((m) => (m.shades.filter((s) => s.bestseller).length ? m.shades.filter((s) => s.bestseller) : m.shades.slice(0, 1)).map((s) => ({ ...s, product: `${m.brand} ${m.name}` }))).slice(0, 10);

  /* Composition */
  const ing = new Map<string, { name: string; n: number }>();
  const rivals = market.filter((m) => !m.isClient && m.inci.length);
  for (const m of rivals) {
    const keys = m.inci.filter((i) => i.key);
    for (const i of keys.length ? keys : m.inci.slice(0, 6)) {
      const k = strip(i.name);
      if (!k || ["aqua", "water", "eau", "parfum", "fragrance"].includes(k)) continue;
      ing.set(k, { name: i.name, n: (ing.get(k)?.n ?? 0) + 1 });
    }
  }
  const clientText = strip(catalog.map((c) => [c.composition, ...c.keyIngredients].join(" ")).join(" "));
  const ingRows = [...ing.entries()].map(([k, v]) => ({ ...v, share: v.n / (rivals.length || 1), client: clientText.includes(k) })).sort((a, b) => b.n - a.n).slice(0, 15);

  const opps = (bundle.opportunities as unknown as OpportunityRow[]).filter((o) => filters.zone === "all" || !oppZone(o) || oppZone(o) === filters.zone || (filters.zone === "FR" && oppZone(o) === "EU"));
  const counts: Record<string, number> = { catalogue: catalog.length, top: ranked.length, opportunites: opps.length };

  const panel = (id: string, children: React.ReactNode) => (
    <section id={`panel-${id}`} role="tabpanel" aria-label={TABS.find((t) => t.id === id)!.label} hidden={tab !== id} className="dash-panel space-y-6">
      <h2 className="hidden text-lg font-semibold print:block">{TABS.find((t) => t.id === id)!.label}</h2>
      {children}
    </section>
  );

  return (
    <div id="dashboard-root" className="space-y-6">
      <div className="no-print"><FilterBar value={filters} onChange={setFilters} brands={brandsList} show={["zone", "format", "brand", "price"]} /></div>
      <Tabs items={TABS.map((t) => ({ ...t, count: counts[t.id] }))} active={tab} onSelect={setTab} />

      {panel("marche", <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label={`Taille du marché ${u.years.cur ?? ""}`} value={eurFmt(size)} sub="ventes Circana, en euros" />
          <Kpi label="Évolution sur un an" value={<Delta value={growthPct(sizePrev, size)} />} sub={`${eurFmt(sizePrev)} en ${u.years.prev ?? "N-1"}`} />
          <Kpi label="Marques" value={brands.length} />
          <Kpi label="Produits" value={products.length} />
        </div>
        <Card>
          <CardHead title="Top marques" sub={`Chiffre d'affaires ${u.years.prev ?? "N-1"} et ${u.years.cur ?? "N"}, en euros`} />
          {brands.length ? (
            <div className="h-[340px]">
              <ResponsiveContainer>
                <BarChart data={brands.slice(0, 10).map((b) => ({ marque: b.brand, [String(u.years.prev ?? "N-1")]: Math.round(b.prev), [String(u.years.cur ?? "N")]: Math.round(b.cur) }))} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="marque" tick={TICK} interval={0} angle={-25} textAnchor="end" height={70} />
                  <YAxis tick={TICK} tickFormatter={eurFmt} width={70} />
                  <Tooltip {...TOOLTIP} formatter={(v) => eurFmt(Number(v))} />
                  <Legend formatter={legendText} />
                  <Bar dataKey={String(u.years.prev ?? "N-1")} fill="#b8c2d3" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey={String(u.years.cur ?? "N")} fill={NIGHT} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty title="Aucune vente pour ces filtres" />}
        </Card>
        <Card>
          <CardHead title="Top produits" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {ranked.slice(0, 10).map((p, i) => (
              <div key={p.key} className="flex items-center gap-3 rounded-[10px] border border-line-soft p-2.5">
                <span className="w-5 text-right text-[13px] tabular-nums text-ink-faint">{i + 1}</span>
                <Packshot src={p.market?.packshot ?? null} alt={p.product} size={44} />
                <div className="min-w-0 text-[13px]"><p className="truncate font-medium">{p.product}</p><p className="truncate text-ink-faint">{p.brand} · {revenue(p.cur, p.salesCurrency)}</p></div>
              </div>
            ))}
          </div>
        </Card>
      </>)}

      {panel("catalogue", catalog.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {catalog.map((c) => (
            <Card key={c.id} as="article" className="flex gap-4">
              <Packshot src={c.image} alt={c.name} size={72} />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="font-semibold leading-snug">{c.name}</p><p className="text-[13px] text-ink-soft">{formatLabel(c.format)}{c.texture ? ` · ${c.texture}` : ""} · {c.zone ? ZONE_LABEL[c.zone] : "—"}</p></div>
                  <p className="font-semibold tabular-nums">{money(c.price, c.currency)}</p>
                </div>
                <Shaderange shades={c.shades} max={16} size={16} />
                {c.keyIngredients.length > 0 && <p className="text-[12.5px] text-ink-soft">{c.keyIngredients.join(" · ")}</p>}
                <div className="flex flex-wrap items-center gap-3 text-[13px]"><TrendPill trend={c.trend} /><span className="tabular-nums text-ink-soft">{revenue(c.salesPrev, c.salesCurrency)} → {revenue(c.salesCur, c.salesCurrency)}</span></div>
              </div>
            </Card>
          ))}
        </div>
      ) : <Empty title="Aucun produit du catalogue pour ces filtres" />)}

      {panel("top", <>
        {priceByFormat.length > 0 && (
          <Card>
            <CardHead title="Prix médian par format" sub="En euros, au taux du jour" />
            <div className="h-[260px]">
              <ResponsiveContainer>
                <BarChart data={priceByFormat}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="format" tick={TICK} />
                  <YAxis tick={TICK} tickFormatter={(v) => `${v} €`} width={50} />
                  <Tooltip {...TOOLTIP} formatter={(v) => (v === null ? "—" : `${v} €`)} />
                  <Legend formatter={legendText} />
                  <Bar dataKey="Marché" fill={NIGHT} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="Votre catalogue" fill={AMBER} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
        <Card flush>
          <div className="px-5 pt-5"><CardHead title="Classement par chiffre d'affaires" /></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-[12.5px] text-ink-faint"><tr><th className="py-2 pl-5 font-medium">#</th><th className="font-medium">Produit</th><th className="font-medium">Format · zone</th><th className="text-right font-medium">CA {u.years.prev}</th><th className="text-right font-medium">CA {u.years.cur}</th><th className="text-right font-medium">Évol.</th><th className="pr-5 text-right font-medium">Prix</th></tr></thead>
              <tbody>
                {ranked.slice(0, 30).map((p, i) => (
                  <tr key={p.key} className="border-t border-line">
                    <td className="py-2 pl-5 tabular-nums text-ink-faint">{i + 1}</td>
                    <td className="py-2"><div className="flex items-center gap-3"><Packshot src={p.market?.packshot ?? null} alt={p.product} size={32} /><span><span className="block font-medium leading-tight">{p.product}</span><span className="text-[12.5px] text-ink-faint">{p.brand}</span></span></div></td>
                    <td className="text-ink-soft">{formatLabel(p.format)} · {p.zone ? (p.country ?? ZONE_LABEL[p.zone]) : "—"}</td>
                    <td className="text-right tabular-nums">{revenue(p.prev, p.salesCurrency)}</td>
                    <td className="text-right tabular-nums">{revenue(p.cur, p.salesCurrency)}</td>
                    <td className="text-right tabular-nums"><Delta value={growthPct(p.prev, p.cur)} /></td>
                    <td className="pr-5 text-right tabular-nums">{money(p.price, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </>)}

      {panel("variantes", <>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Card>
            <CardHead title="Familles de teintes" sub="Part des teintes de chaque famille" />
            {famRows.length ? (
              <div className="h-[300px]">
                <ResponsiveContainer>
                  <BarChart data={famRows} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid horizontal={false} stroke={GRID} />
                    <XAxis type="number" tick={TICK} tickFormatter={(v) => `${v} %`} />
                    <YAxis type="category" dataKey="famille" tick={TICK} width={120} />
                    <Tooltip {...TOOLTIP} formatter={(v) => `${v} %`} />
                    <Legend formatter={legendText} />
                    <Bar dataKey="Marché" fill={NIGHT} radius={[0, 4, 4, 0]} isAnimationActive={false} />
                    <Bar dataKey="Votre catalogue" fill={AMBER} radius={[0, 4, 4, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <Empty title="Aucune teinte relevée" />}
          </Card>
          <Card>
            <CardHead title="Répartition du marché" />
            {famMarket.size > 0 && (
              <div className="h-[300px]">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={[...famMarket.entries()].map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={1} isAnimationActive={false}>
                      {[...famMarket.keys()].map((f) => <Cell key={f} fill={FAMILY_COLORS[f] ?? "#B8BEC8"} />)}
                    </Pie>
                    <Tooltip {...TOOLTIP} />
                    <Legend formatter={legendText} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
        <Card>
          <CardHead title="Top 10 teintes" sub="Teintes best-sellers des produits qui vendent le plus" />
          {topShades.length ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {topShades.map((s, i) => (
                <li key={i} className="overflow-hidden rounded-[10px] border border-line">
                  <div className="h-16" style={{ background: s.hex ?? "#CCCCCC" }} />
                  <div className="p-2.5 text-[12.5px]"><p className="font-medium">{s.name || "—"}</p><p className="font-mono text-ink-faint">{s.hex ?? "—"}</p><p className="truncate text-ink-faint">{s.product}</p></div>
                </li>
              ))}
            </ul>
          ) : <Empty title="Aucune teinte relevée" />}
        </Card>
        <Card>
          <CardHead title="Shaderanges" sub="Gammes de teintes des produits les plus vendus" />
          <ul className="divide-y divide-line">
            {[...catalog.map((c) => ({ id: c.id, label: c.name, brand: u.config.brand || c.brand, img: c.image, shades: c.shades, client: true })),
              ...bySales.filter((m) => !m.isClient && m.shades.length).slice(0, 12).map((m) => ({ id: m.id, label: m.name, brand: `${m.brand} · ${placeLabel(m.zone, m.country)}`, img: m.packshot, shades: m.shades, client: false }))].map((r) => (
              <li key={r.id} className="grid items-center gap-3 py-2.5 sm:grid-cols-[minmax(0,260px)_1fr]">
                <div className="flex min-w-0 items-center gap-3"><Packshot src={r.img} alt={r.label} size={36} /><p className="min-w-0 text-[13px]"><span className={`block truncate font-medium ${r.client ? "text-amber-dark" : ""}`}>{r.label}</span><span className="text-ink-faint">{r.brand}{r.client ? " · votre catalogue" : ""}</span></p></div>
                <Shaderange shades={r.shades} max={24} size={18} />
              </li>
            ))}
          </ul>
        </Card>
      </>)}

      {panel("composition", <>
        <Card>
          <CardHead title="Ingrédients clés du marché" sub={`Sur ${rivals.length} produits concurrents dont l'INCI est relevé`} />
          {ingRows.length ? (
            <ul className="space-y-2">
              {ingRows.map((i) => (
                <li key={i.name} className="grid grid-cols-[minmax(0,220px)_1fr_auto] items-center gap-3 text-sm">
                  <span className="truncate">{i.name}</span>
                  <span className="h-2.5 rounded-full bg-line-soft"><span className="block h-full rounded-full bg-night" style={{ width: `${Math.round(i.share * 100)}%` }} /></span>
                  <span className={`w-[130px] text-right text-[12.5px] ${i.client ? "text-ok" : "text-amber-dark"}`}>{Math.round(i.share * 100)} % · {i.client ? "chez vous" : "absent chez vous"}</span>
                </li>
              ))}
            </ul>
          ) : <Empty title="Aucune composition relevée" />}
        </Card>
        <Card flush>
          <div className="px-5 pt-5"><CardHead title="Comparaison des compositions" sub="Vos produits face aux meilleures ventes du même format" /></div>
          <ul className="divide-y divide-line">
            {catalog.map((c) => {
              const rival = bySales.find((m) => !m.isClient && m.format === c.format && m.inci.length);
              return (
                <li key={c.id} className="grid gap-4 px-5 py-4 md:grid-cols-2">
                  <div><p className="font-medium">{c.name}</p><p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{c.keyIngredients.length ? <><b>Clés :</b> {c.keyIngredients.join(", ")}<br /></> : null}{c.composition ?? "Composition non relevée"}</p></div>
                  <div>{rival ? <><p className="font-medium">{rival.brand} {rival.name}</p><p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{rival.inci.filter((i) => i.key).length ? <><b>Clés :</b> {rival.inci.filter((i) => i.key).map((i) => i.name).join(", ")}<br /></> : null}{rival.inci.map((i) => i.name).join(", ")}</p></> : <p className="text-[13px] text-ink-faint">Pas de concurrent comparable avec INCI.</p>}</div>
                </li>
              );
            })}
          </ul>
        </Card>
      </>)}

      {panel("opportunites", opps.length ? (
        <div className="space-y-3">{opps.map((o) => <OpportunityCard key={o.id} o={o} names={names} links={!publicView} />)}</div>
      ) : <Empty title="Aucune opportunité">Lancez l&apos;analyse avant de générer le dashboard pour y inclure les opportunités.</Empty>)}
    </div>
  );
}
