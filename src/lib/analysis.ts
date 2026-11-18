import { chat } from "./hf";
import { bestMatches, MATCH_THRESHOLD } from "./matching";
import { withFamilies } from "./shades";
import type { CatalogInsights, CatalogProductInsight, ClientProduct, ItemView, ReportStats, ShadeFamily, Trends, Zone } from "./types";

/** Nombre au format français (virgule décimale). */
const fr = (v: number, digits: number) => v.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : 0);

/* ---------- Statistiques du marché (calculées, jamais inventées par le LLM) ---------- */

export function computeStats(items: ItemView[]): ReportStats {
  const withProduct = items.filter((i) => i.product);
  const avgPriceEur: Partial<Record<Zone, number>> = {};
  for (const zone of ["US", "EU"] as Zone[]) {
    const prices = withProduct.filter((i) => i.circana.zone === zone && i.product!.priceEur !== null).map((i) => i.product!.priceEur!);
    if (prices.length) avgPriceEur[zone] = avg(prices);
  }

  const formatCount = new Map<string, number>();
  for (const i of withProduct) {
    const key = i.product!.packaging || i.product!.formats[0]?.size || "Non précisé";
    formatCount.set(key, (formatCount.get(key) ?? 0) + 1);
  }

  const byBrand = new Map<string, Partial<Record<ShadeFamily, number>>>();
  for (const i of withProduct) {
    const fam = byBrand.get(i.circana.brand) ?? {};
    for (const s of withFamilies(i.product!.shades)) fam[s.family!] = (fam[s.family!] ?? 0) + 1;
    byBrand.set(i.circana.brand, fam);
  }

  const methods: ReportStats["methods"] = {};
  for (const i of items) if (i.method) methods[i.method] = (methods[i.method] ?? 0) + 1;

  return {
    productCount: items.length,
    completeCount: items.filter((i) => i.status === "done").length,
    awaitingTeam: items.filter((i) => i.status === "awaiting_team" || i.status === "navigating").length,
    avgPriceEur,
    shadeCountAvg: avg(withProduct.map((i) => i.product!.shades.length)),
    formats: [...formatCount.entries()].map(([format, count]) => ({ format, count })).sort((a, b) => b.count - a.count),
    shadeFamilies: [...byBrand.entries()].map(([brand, families]) => ({ brand, families })),
    methods,
  };
}

/* ---------- Audit du catalogue client ---------- */

function salesTrend(item: ItemView): CatalogProductInsight["trend"] {
  const h = (item.circana.history ?? []).filter((x) => x.salesValue !== undefined);
  if (h.length < 2) return "inconnu";
  const prev = h[h.length - 2].salesValue!, last = h[h.length - 1].salesValue!;
  if (!prev) return "inconnu";
  const change = (last - prev) / prev;
  return change > 0.05 ? "progresse" : change < -0.05 ? "décline" : "stable";
}

export async function computeCatalog(items: ItemView[], clientProducts: ClientProduct[]): Promise<CatalogInsights | null> {
  if (!clientProducts.length) return null;

  const candidates = items.map((i) => `${i.circana.brand} ${i.product?.name ?? i.circana.product}`);
  const results = await bestMatches(clientProducts.map((c) => `${c.brand} ${c.name}`), candidates);

  const bestSellers = [...items].sort((a, b) => (b.circana.salesValue ?? 0) - (a.circana.salesValue ?? 0)).slice(0, 5);
  const bestShades = avg(bestSellers.filter((i) => i.product).map((i) => i.product!.shades.length));

  const products: CatalogProductInsight[] = clientProducts.map((cp, idx) => {
    const r = results[idx];
    const match = r.index >= 0 && r.score >= MATCH_THRESHOLD ? items[r.index] : null;
    const zone = cp.zone ?? match?.circana.zone;
    const zonePrices = items.filter((i) => (!zone || i.circana.zone === zone) && i.product?.priceEur != null).map((i) => i.product!.priceEur!);
    const market = avg(zonePrices);
    const clientPrice = cp.price ?? match?.product?.priceEur ?? null;
    const shades = cp.shadesCount ?? match?.product?.shades.length ?? null;
    return {
      client: cp,
      matchName: match ? `${match.circana.brand} ${match.product?.name ?? match.circana.product}` : null,
      matchScore: match ? Math.round(r.score * 100) / 100 : null,
      priceGapPct: clientPrice !== null && market ? Math.round(((clientPrice - market) / market) * 100) : null,
      shadesGap: shades !== null && bestShades ? Math.round((shades - bestShades) * 10) / 10 : null,
      trend: match ? salesTrend(match) : "inconnu",
    };
  });

  const up = products.filter((p) => p.trend === "progresse").length;
  const down = products.filter((p) => p.trend === "décline").length;
  const above = products.filter((p) => (p.priceGapPct ?? 0) > 10).length;
  return {
    clientBrands: [...new Set(clientProducts.map((c) => c.brand))],
    products,
    summary:
      `${products.length} produits de votre catalogue analysés, ${products.filter((p) => p.matchName).length} retrouvés dans les données du marché. ` +
      `${up} progressent, ${down} déclinent d'après Circana. ${above} sont positionnés plus de 10 % au-dessus du prix moyen de leur marché.`,
  };
}

/* ---------- Analyse rédigée ---------- */

export async function writeAnalysis(
  category: string,
  stats: ReportStats,
  items: ItemView[],
  trends: Trends | null,
  catalog: CatalogInsights | null,
) {
  const top = [...items]
    .filter((i) => i.circana.salesValue)
    .sort((a, b) => (b.circana.salesValue ?? 0) - (a.circana.salesValue ?? 0))
    .slice(0, 5)
    .map((i) => ({
      marque: i.circana.brand,
      produit: i.circana.product,
      zone: i.circana.zone,
      ventes: i.circana.salesValue,
      prix_eur: i.product?.priceEur,
      teintes: i.product?.shades.length,
      formats: i.product?.formats.map((f) => f.size),
    }));

  const facts = {
    categorie: category,
    produits_analyses: stats.productCount,
    fiches_completes: stats.completeCount,
    en_attente_equipe: stats.awaitingTeam,
    prix_moyen_eur_par_zone: stats.avgPriceEur,
    nombre_moyen_de_teintes: stats.shadeCountAvg,
    formats_et_packagings: stats.formats.slice(0, 6),
    meilleures_ventes_circana: top,
    tendances_sociales: trends?.items.slice(0, 6).map((t) => `${t.label} (${t.type}, ${Math.round(t.share * 100)} % des publications)`),
    catalogue_client: catalog?.products.slice(0, 15).map((p) => ({
      produit: `${p.client.brand} ${p.client.name}`,
      ecart_prix_pct: p.priceGapPct,
      ecart_teintes: p.shadesGap,
      tendance: p.trend,
    })),
  };

  const text = await chat(
    "Tu es analyste marché beauté. Tu écris en français, de façon factuelle et concise, pour une équipe marketing. " +
      "N'utilise QUE les chiffres fournis, n'en invente aucun. Pas de titre ni de liste : 3 ou 4 courts paragraphes " +
      "(1. état du marché et best-sellers, 2. écarts de prix, de formats et de teintes entre US et Europe, " +
      "3. position du catalogue du client s'il est fourni, 4. tendances et recommandations concrètes).",
    `Données du rapport (JSON) :\n${JSON.stringify(facts, null, 2)}`,
    900,
  );
  if (text) return text;

  const us = stats.avgPriceEur.US, eu = stats.avgPriceEur.EU;
  const leader = top[0];
  return [
    `Sur la catégorie ${category || "analysée"}, ${stats.productCount} références ont été enrichies, dont ${stats.completeCount} avec une fiche complète` +
      (stats.awaitingTeam ? ` (${stats.awaitingTeam} encore en traitement par l'équipe).` : ".") +
      (leader ? ` La meilleure vente est ${leader.marque} ${leader.produit} (${leader.zone}).` : ""),
    us && eu
      ? `Le prix moyen constaté est de ${fr(us, 2)} € aux États-Unis contre ${fr(eu, 2)} € en Europe, soit un écart de ${Math.round(((eu - us) / us) * 100)} %. Les produits proposent en moyenne ${fr(stats.shadeCountAvg, 1)} teintes.`
      : `Les prix moyens par zone seront comparés dès que les deux zones contiendront des fiches complètes.`,
    catalog ? catalog.summary : "",
    trends?.items.length
      ? `Côté réseaux sociaux, les signaux les plus cités sont ${trends.items.slice(0, 3).map((t) => t.label.toLowerCase()).join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
