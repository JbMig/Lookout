import "server-only";
import { CIRCANA_MARKET, CIRCANA_TOP50, selectAll } from "./repo";

/**
 * Lecture des tables Circana de l'Agent 1 (depuis le 19/11/2026) :
 *   circana_top50_sku_<us|fr>_<format> : Top 50 SKU (rang, produit, marque, teinte, ca_fy_AAAA en milliers, evol) ;
 *   circana_<format>_blush : blocs marché (taille du marché, top marques…) avec leur unité (M$, K€…).
 * Les lignes sont rendues au format de circana_sales (une ligne par SKU et par année), pour que les pages
 * et le dashboard n'aient qu'une seule forme de données à lire.
 */

type Raw = Record<string, unknown>;

const FORMAT: Record<string, string> = { liquid: "liquide", compact: "compact", creme: "creme", stick: "stick" };
const ZONE: Record<string, { country: string; region: string; currency: string }> = {
  us: { country: "US", region: "NA", currency: "USD" },
  fr: { country: "FR", region: "EU", currency: "EUR" },
};

export interface SkuSale {
  period: string;
  country: string;
  region: string;
  brand: string;
  product_name: string;
  segment: string;
  subsegment: string;
  revenue: number;
  currency: string;
  product_key: string;
  raw: { niveau: "sku"; rang: number | null; teinte: string | null; valeur_fichier: number; unite_fichier: "K"; periode_fichier: string; est_nouveaute: boolean; source: string };
}

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const num = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/** Années présentes dans une ligne (colonnes ca_fy_2024, ca_fy_2025…). */
const yearColumns = (row: Raw) =>
  Object.keys(row)
    .map((k) => /^ca_fy_(\d{4})$/.exec(k))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ key: m[0], year: Number(m[1]) }))
    .sort((a, b) => a.year - b.year);

export async function loadSkuSales(category = "blush"): Promise<SkuSale[]> {
  const tables = await Promise.all(CIRCANA_TOP50.map((t) => selectAll<Raw>(t).then((rows) => ({ t, rows }))));
  const out: SkuSale[] = [];
  for (const { t, rows } of tables) {
    const [, zone, format] = /^circana_top50_sku_([a-z]+)_([a-z]+)$/.exec(t)!;
    const z = ZONE[zone];
    for (const r of rows) {
      const brand = String(r.marque ?? "").trim();
      const product = String(r.produit ?? "").trim();
      if (!brand || !product) continue;
      const isNew = String(r.evol ?? "").toLowerCase().startsWith("nouveaut");
      for (const { key, year } of yearColumns(r)) {
        const v = num(r[key]);
        if (v === null) continue;
        out.push({
          period: `${year}-01-01`,
          country: z.country,
          region: z.region,
          brand,
          product_name: product,
          segment: category,
          subsegment: FORMAT[format] ?? format,
          revenue: Math.round(v * 1000 * 100) / 100,
          currency: z.currency,
          product_key: `${slug(brand)}__${slug(product)}`,
          raw: { niveau: "sku", rang: num(r.rang), teinte: (r.teinte as string) ?? null, valeur_fichier: v, unite_fichier: "K", periode_fichier: `FY ${year}`, est_nouveaute: isNew, source: t },
        });
      }
    }
  }
  return out;
}

export interface MarketTotal { zone: "US" | "EU"; country: string; format: string | "all"; year: number; value: number; currency: string }

const UNIT: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, Md: 1e9 };

/** Taille du marché par zone et format (bloc « Marché » des tables circana_<format>_blush), en unités monétaires. */
export async function loadMarketTotals(): Promise<MarketTotal[]> {
  const tables = await Promise.all(CIRCANA_MARKET.map((t) => selectAll<Raw>(t).then((rows) => ({ t, rows }))));
  const seen = new Set<string>();
  const out: MarketTotal[] = [];
  for (const { t, rows } of tables) {
    const format = FORMAT[/^circana_([a-z]+)_blush$/.exec(t)![1]];
    for (const r of rows) {
      if (String(r.bloc ?? "").toLowerCase() !== "marché" && String(r.bloc ?? "").toLowerCase() !== "marche") continue;
      const label = String(r.libelle ?? "").toLowerCase();
      const scope = /tous formats/.test(label) ? "all" : /cosm[ée]tique/.test(label) ? null : format;
      if (!scope) continue;
      const pays = String(r.pays ?? "").toUpperCase();
      const unit = String(r.unite ?? "");
      const factor = UNIT[unit.replace(/[^A-Za-z]/g, "").replace(/^(K|M|B|Md).*/, "$1")] ?? 1;
      const currency = unit.includes("€") ? "EUR" : unit.includes("$") ? "USD" : pays === "US" ? "USD" : "EUR";
      for (const { key, year } of yearColumns(r)) {
        const v = num(r[key]);
        const id = `${pays}|${scope}|${year}`;
        if (v === null || seen.has(id)) continue;
        seen.add(id);
        out.push({ zone: pays === "US" ? "US" : "EU", country: pays, format: scope, year, value: v * factor, currency });
      }
    }
  }
  return out;
}
