/**
 * Agent 3 (moteur intégré) : compare le catalogue client au marché et en tire des opportunités.
 * Fonction pure : prend l'univers normalisé, renvoie l'analyse et les opportunités à enregistrer.
 */
import { formatLabel, ZONE_LABEL, strip, type Format, type Zone } from "./normalize";
import type { CatalogItem, MarketItem, Universe } from "./universe";

export type OpportunityKind = "price_gap" | "format_gap" | "shade_gap" | "ingredient_gap";
export type Priority = "haute" | "moyenne" | "basse";

export const KIND_LABEL: Record<OpportunityKind, string> = {
  price_gap: "Prix",
  format_gap: "Format",
  shade_gap: "Teintes",
  ingredient_gap: "Ingrédient",
};

export const priorityOf = (score: number): Priority => (score >= 0.7 ? "haute" : score >= 0.4 ? "moyenne" : "basse");

export interface OpportunityDraft {
  kind: OpportunityKind;
  title: string;
  description: string;
  score: number;
  estimated_impact: { priorite: Priority; confiance: number; [k: string]: unknown };
  refs: { produit_client_ids: string[]; produit_concurrent_ids: string[]; zone: string | null; format: Format | null };
}

export interface ComparisonRow {
  id: string;
  name: string;
  format: Format;
  zone: Zone | null;
  price: number | null;
  currency: string | null;
  marketMedian: number | null;
  priceGapPct: number | null;
  shadeCount: number;
  marketShades: number | null;
  competitors: number;
  trend: CatalogItem["trend"];
}

export interface FormatRow { format: Format; zone: Zone; salesPrev: number; salesCur: number; growth: number | null; currency: string; clientPresent: boolean }

export interface GrowthAnalysis {
  summary: string;
  period: { prev: number | null; cur: number | null };
  comparison: ComparisonRow[];
  formats: FormatRow[];
  ingredients: { name: string; share: number; client: boolean }[];
  families: { family: string; market: number; client: number }[];
  counts: { catalog: number; market: number; sales: number };
}

const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const fmtPct = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 100)} %`;

/** Concurrents comparables : même format et même zone, hors marque cliente. */
function peers(market: MarketItem[], p: { format: Format; zone: Zone | null }) {
  return market.filter((m) => !m.isClient && m.format === p.format && (!p.zone || m.zone === p.zone));
}

const bySales = (a: MarketItem, b: MarketItem) => (b.salesCur ?? 0) - (a.salesCur ?? 0);

export function computeGrowth(u: Universe, zoneFilter?: string | null): { analysis: GrowthAnalysis; opportunities: OpportunityDraft[] } {
  const zoneOk = (z: Zone | null, country?: string | null) =>
    !zoneFilter || zoneFilter === "all" ? true : zoneFilter === "FR" ? country === "FR" || z === "EU" : z === zoneFilter;
  const catalog = u.catalog.filter((c) => zoneOk(c.zone, c.country));
  const market = u.market.filter((m) => zoneOk(m.zone, m.country));
  const opportunities: OpportunityDraft[] = [];
  const comparison: ComparisonRow[] = [];

  /* 1. Prix et teintes, produit par produit. */
  for (const c of catalog) {
    const all = peers(market, c);
    const sameCur = all.filter((m) => m.price !== null && m.currency === c.currency);
    const med = median(sameCur.map((m) => m.price!));
    const gap = c.price !== null && med ? (c.price - med) / med : null;
    const top = [...all].sort(bySales).slice(0, 5);
    const topShades = top.filter((m) => m.shadeCount > 0);
    const avgShades = topShades.length ? topShades.reduce((a, m) => a + m.shadeCount, 0) / topShades.length : null;
    comparison.push({
      id: c.id, name: c.name, format: c.format, zone: c.zone, price: c.price, currency: c.currency,
      marketMedian: med, priceGapPct: gap === null ? null : round(gap * 100, 1), shadeCount: c.shadeCount,
      marketShades: avgShades === null ? null : round(avgShades, 1), competitors: all.length, trend: c.trend,
    });
    const confidence = round(clamp(sameCur.length / 10), 2);
    const where = c.zone ? ZONE_LABEL[c.zone] : "tous marchés";
    if (gap !== null && Math.abs(gap) >= 0.15 && sameCur.length >= 2) {
      const score = round(clamp(Math.abs(gap) / 0.6) * 0.7 + (c.trend === "declin" ? 0.3 : c.trend === "stable" ? 0.15 : 0.05));
      opportunities.push({
        kind: "price_gap",
        title: `${c.name} : ${fmtPct(gap)} vs le prix médian ${formatLabel(c.format).toLowerCase()} (${where})`,
        description: gap > 0
          ? `Prix au-dessus de ${sameCur.length} produits comparables${c.trend === "declin" ? ", alors que les ventes reculent" : ""}. Vérifier la valeur perçue (taille, teintes, soin) ou ajuster le prix.`
          : `Prix sous le marché : marge de manœuvre possible pour monter en gamme sans sortir de la fourchette concurrente.`,
        score,
        estimated_impact: { priorite: priorityOf(score), confiance: confidence, ecart_prix_pct: round(gap * 100, 1), prix_median: med, devise: c.currency },
        refs: { produit_client_ids: [c.id], produit_concurrent_ids: sameCur.sort(bySales).slice(0, 5).map((m) => m.id), zone: c.zone, format: c.format },
      });
    }
    if (avgShades !== null && avgShades - c.shadeCount >= 2) {
      const diff = avgShades - c.shadeCount;
      const score = round(clamp(diff / 10) * 0.8 + (c.trend === "declin" ? 0.2 : 0.05));
      opportunities.push({
        kind: "shade_gap",
        title: `${c.name} : ${Math.round(diff)} teintes de moins que les meilleures ventes`,
        description: `Les ${topShades.length} produits ${formatLabel(c.format).toLowerCase()} les plus vendus (${where}) proposent ${round(avgShades, 1)} teintes en moyenne, contre ${c.shadeCount}.`,
        score,
        estimated_impact: { priorite: priorityOf(score), confiance: round(clamp(topShades.length / 5), 2), ecart_teintes: round(-diff, 1) },
        refs: { produit_client_ids: [c.id], produit_concurrent_ids: topShades.map((m) => m.id), zone: c.zone, format: c.format },
      });
    }
  }

  /* 2. Formats en croissance absents du catalogue. */
  const formats: FormatRow[] = [];
  const groups = new Map<string, FormatRow>();
  for (const s of u.sales) {
    if (!s.zone || !zoneOk(s.zone, s.country) || s.format === "autre") continue;
    const k = `${s.zone}|${s.format}|${s.currency}`;
    if (!groups.has(k)) groups.set(k, { format: s.format, zone: s.zone, salesPrev: 0, salesCur: 0, growth: null, currency: s.currency, clientPresent: false });
    const g = groups.get(k)!;
    if (s.year === u.years.cur) g.salesCur += s.revenue;
    if (s.year === u.years.prev) g.salesPrev += s.revenue;
  }
  const zoneTotal = new Map<string, number>();
  for (const g of groups.values()) {
    g.growth = g.salesPrev ? round((g.salesCur - g.salesPrev) / g.salesPrev, 3) : null;
    g.clientPresent = u.catalog.some((c) => c.format === g.format && (!c.zone || c.zone === g.zone));
    zoneTotal.set(g.zone, (zoneTotal.get(g.zone) ?? 0) + g.salesCur);
    formats.push(g);
  }
  for (const g of formats) {
    if (g.clientPresent || (g.growth ?? 0) <= 0) continue;
    const share = g.salesCur / (zoneTotal.get(g.zone) || 1);
    const score = round(clamp(share * 1.5 + (g.growth ?? 0) * 1.5));
    const leaders = market.filter((m) => !m.isClient && m.format === g.format && m.zone === g.zone).sort(bySales).slice(0, 5);
    opportunities.push({
      kind: "format_gap",
      title: `Format ${formatLabel(g.format).toLowerCase()} absent du catalogue (${ZONE_LABEL[g.zone]}, ${fmtPct(g.growth ?? 0)})`,
      description: `Ce format pèse ${Math.round(share * 100)} % des ventes suivies en ${ZONE_LABEL[g.zone]} et progresse de ${fmtPct(g.growth ?? 0)} sur un an. Aucun produit du catalogue ne s'y positionne.`,
      score,
      estimated_impact: { priorite: priorityOf(score), confiance: round(clamp(leaders.length / 5), 2), part_de_marche: round(share, 3), croissance: g.growth, ventes_n: g.salesCur, devise: g.currency },
      refs: { produit_client_ids: [], produit_concurrent_ids: leaders.map((m) => m.id), zone: g.zone, format: g.format },
    });
  }

  /* 3. Ingrédients clés des concurrents en croissance, absents du catalogue. */
  const growing = market.filter((m) => !m.isClient && m.trend === "croissance" && m.inci.length);
  const clientText = strip(u.catalog.map((c) => [c.composition, ...c.keyIngredients].join(" ")).join(" "));
  const counts = new Map<string, { name: string; ids: string[] }>();
  for (const m of growing) {
    const keys = m.inci.filter((i) => i.key);
    for (const i of keys.length ? keys : m.inci.slice(0, 5)) {
      const k = strip(i.name);
      if (!k || ["aqua", "water", "eau", "parfum", "fragrance"].includes(k)) continue;
      if (!counts.has(k)) counts.set(k, { name: i.name, ids: [] });
      if (!counts.get(k)!.ids.includes(m.id)) counts.get(k)!.ids.push(m.id);
    }
  }
  const ingredients = [...counts.entries()]
    .map(([k, v]) => ({ name: v.name, share: growing.length ? round(v.ids.length / growing.length, 2) : 0, client: clientText.includes(k), ids: v.ids }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 15);
  for (const i of ingredients.filter((x) => !x.client && x.share >= 0.3).slice(0, 4)) {
    const score = round(clamp(i.share * 0.9));
    opportunities.push({
      kind: "ingredient_gap",
      title: `${i.name} : présent dans ${Math.round(i.share * 100)} % des produits concurrents en croissance`,
      description: `Ingrédient mis en avant par ${i.ids.length} produits dont les ventes progressent, absent de la composition de votre catalogue.`,
      score,
      estimated_impact: { priorite: priorityOf(score), confiance: round(clamp(growing.length / 15), 2), part: i.share },
      refs: { produit_client_ids: [], produit_concurrent_ids: i.ids.slice(0, 5), zone: zoneFilter && zoneFilter !== "all" ? zoneFilter : null, format: null },
    });
  }

  /* 4. Familles de teintes des best-sellers. */
  const famMarket = new Map<string, number>();
  for (const m of [...market].filter((x) => !x.isClient).sort(bySales).slice(0, 30)) for (const s of m.shades) if (s.family) famMarket.set(s.family, (famMarket.get(s.family) ?? 0) + 1);
  const famClient = new Map<string, number>();
  for (const c of catalog) for (const s of c.shades) if (s.family) famClient.set(strip(s.family), (famClient.get(strip(s.family)) ?? 0) + 1);
  const families = [...famMarket.entries()]
    .map(([family, n]) => ({ family, market: n, client: famClient.get(strip(family)) ?? 0 }))
    .sort((a, b) => b.market - a.market)
    .slice(0, 10);

  const byScore = opportunities.sort((a, b) => b.score - a.score);
  const high = byScore.filter((o) => o.estimated_impact.priorite === "haute").length;
  const declining = catalog.filter((c) => c.trend === "declin").length;
  const summary = [
    `${catalog.length} produits du catalogue comparés à ${market.filter((m) => !m.isClient).length} produits concurrents.`,
    u.years.cur ? `Ventes Circana ${u.years.prev ?? "?"} → ${u.years.cur} : ${declining} produit${declining > 1 ? "s" : ""} du catalogue en déclin.` : "Aucune vente Circana importée : les tendances ne sont pas calculées.",
    `${byScore.length} opportunité${byScore.length > 1 ? "s" : ""} identifiée${byScore.length > 1 ? "s" : ""}, dont ${high} de priorité haute.`,
  ].join(" ");

  return {
    analysis: { summary, period: u.years, comparison, formats, ingredients: ingredients.map((i) => ({ name: i.name, share: i.share, client: i.client })), families, counts: { catalog: catalog.length, market: market.length, sales: u.sales.length } },
    opportunities: byScore,
  };
}
