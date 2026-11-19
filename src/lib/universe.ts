import "server-only";
import { repo, selectAll } from "./repo";
import { getAgentConfig, type AgentConfig } from "./settings";
import {
  brandKey,
  countryOf,
  formatOf,
  hexOrNull,
  nameSimilarity,
  productKey,
  strip,
  trendOf,
  zoneOf,
  type Format,
  type Trend,
  type Zone,
} from "./normalize";

/**
 * Toutes les données produites par les agents, normalisées pour l'affichage :
 * catalogue (Agent 0), ventes Circana (Agent 1), marché enrichi (Agents 2 et 2.5).
 * Les volumes restent faibles (quelques milliers de lignes) : tout est chargé puis filtré côté navigateur.
 */

export interface Shade { name: string; hex: string | null; family: string | null; available?: boolean; bestseller?: boolean }
export interface Ingredient { name: string; key: boolean; fn: string | null }

interface Located { zone: Zone | null; country: string | null; format: Format }

export interface SalesFigures { salesPrev: number | null; salesCur: number | null; salesCurrency: string | null; trend: Trend | null }

export interface CatalogItem extends Located, SalesFigures {
  id: string;
  name: string;
  brand: string;
  rangeName: string | null;
  formatRaw: string | null;
  texture: string | null;
  price: number | null;
  currency: string | null;
  shadeCount: number;
  shades: Shade[];
  keyIngredients: string[];
  composition: string | null;
  isNew: boolean;
  image: string | null;
  url: string | null;
  status: string | null;
}

export interface MarketItem extends Located, SalesFigures {
  id: string;
  brand: string;
  name: string;
  texture: string | null;
  price: number | null;
  currency: string | null;
  shadeCount: number;
  shades: Shade[];
  inci: Ingredient[];
  packshot: string | null;
  url: string | null;
  sourceSite: string | null;
  status: string | null;
  isClient: boolean;
  enrichedAt: string | null;
}

export interface SalesLine extends Located {
  brand: string;
  product: string;
  year: number;
  revenue: number;
  units: number | null;
  currency: string;
}

export interface Universe {
  config: AgentConfig;
  years: { prev: number | null; cur: number | null };
  catalog: CatalogItem[];
  market: MarketItem[];
  sales: SalesLine[];
  enrichment: { total: number; done: number; queued: number; failed: number; running: number };
  duplicatesRemoved: number;
  generatedAt: string;
}

type Raw = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function salesIndex(sales: SalesLine[], aliases: Record<string, string>) {
  const byBrand = new Map<string, Map<string, SalesLine[]>>();
  for (const s of sales) {
    const b = brandKey(s.brand, aliases);
    const p = productKey(s.brand, s.product, aliases);
    if (!byBrand.has(b)) byBrand.set(b, new Map());
    const m = byBrand.get(b)!;
    if (!m.has(p)) m.set(p, []);
    m.get(p)!.push(s);
  }
  return byBrand;
}

/** Ventes N-1 et N d'un produit, rapprochées par marque + nom (et zone quand elle est connue). */
function figuresFor(
  index: ReturnType<typeof salesIndex>,
  years: Universe["years"],
  brand: string,
  name: string,
  zone: Zone | null,
  aliases: Record<string, string>,
): SalesFigures & { format: Format | null } {
  const none = { salesPrev: null, salesCur: null, salesCurrency: null, trend: null, format: null };
  const products = index.get(brandKey(brand, aliases));
  if (!products) return none;
  const key = productKey(brand, name, aliases);
  let best: SalesLine[] | null = null;
  let bestScore = 0;
  for (const [k, lines] of products) {
    const s = k === key ? 1 : nameSimilarity(k, key);
    if (s > bestScore) { bestScore = s; best = lines; }
  }
  if (!best || bestScore < 0.5) return none;
  const lines = zone && best.some((l) => l.zone === zone) ? best.filter((l) => l.zone === zone) : best;
  const sum = (y: number | null) => (y === null ? null : lines.filter((l) => l.year === y).reduce((a, l) => a + l.revenue, 0) || null);
  const salesPrev = sum(years.prev);
  const salesCur = sum(years.cur);
  return { salesPrev, salesCur, salesCurrency: lines[0]?.currency ?? null, trend: trendOf(salesPrev, salesCur), format: lines[0]?.format ?? null };
}

export async function loadUniverse(): Promise<Universe> {
  const [config, catalogRows, marketRows, shadeRows, ingRows, salesRows, jobRows, aliasRows] = await Promise.all([
    getAgentConfig(),
    selectAll<Raw>("catalog_products"),
    selectAll<Raw>("market_products"),
    selectAll<Raw>("market_shades", { order: ["position", "asc"] }),
    selectAll<Raw>("market_ingredients", { order: ["position", "asc"] }),
    selectAll<Raw>("circana_sales", { order: ["created_at", "desc"] }),
    selectAll<Raw>("enrichment_jobs"),
    repo().select<Raw>("brand_aliases").catch(() => [] as Raw[]),
  ]);

  const aliases: Record<string, string> = {};
  for (const a of aliasRows) if (str(a.alias) && str(a.canonical)) aliases[strip(String(a.alias))] = strip(String(a.canonical));

  /* Ventes : un même produit (zone, format, année) importé par plusieurs fichiers n'est compté qu'une fois :
     les lignes de l'import le plus récent gagnent (elles peuvent être au niveau teinte). */
  const owner = new Map<string, unknown>();
  const sales: SalesLine[] = [];
  let duplicatesRemoved = 0;
  for (const r of salesRows) {
    const brand = str(r.brand);
    const product = str(r.product_name);
    const period = str(r.period);
    const revenue = num(r.revenue);
    if (!brand || !product || !period || revenue === null) continue;
    const country = countryOf(str(r.country) ?? str(r.region), str(r.currency));
    const zone = zoneOf(country);
    const format = formatOf(str(r.subsegment), str(r.segment) === "blush" ? null : str(r.segment), product);
    const year = Number(period.slice(0, 4));
    const key = [brandKey(brand, aliases), productKey(brand, product, aliases), zone, format, year].join("|");
    if (!owner.has(key)) owner.set(key, r.import_id ?? null);
    if (owner.get(key) !== (r.import_id ?? null)) { duplicatesRemoved++; continue; }
    sales.push({ brand, product, year, revenue, units: num(r.units), currency: str(r.currency) ?? "EUR", zone, country: country === "EU" ? null : country, format });
  }
  const allYears = [...new Set(sales.map((s) => s.year))].sort();
  const years = { cur: allYears.at(-1) ?? null, prev: allYears.length > 1 ? allYears.at(-2)! : null };
  const index = salesIndex(sales, aliases);
  const client = brandKey(config.brand, aliases);

  const catalog: CatalogItem[] = catalogRows.map((r) => {
    const raw = (r.raw_data ?? {}) as Raw;
    const variants = (Array.isArray(r.variants) ? r.variants : Array.isArray(raw.variants) ? raw.variants : []) as Raw[];
    const currency = str(r.currency);
    const country = countryOf(str(r.country), currency);
    const zone = zoneOf(country);
    const name = String(r.name ?? "");
    const brand = String(r.brand ?? config.brand);
    const figures = figuresFor(index, years, brand, name, zone, aliases);
    const shades: Shade[] = variants.map((v) => ({
      name: String(v.name ?? v.shade_name ?? ""),
      hex: hexOrNull(v.hex_code ?? v.hex),
      family: str(v.color_family ?? v.family),
      available: v.available === undefined ? undefined : Boolean(v.available),
    }));
    return {
      id: String(r.id),
      name,
      brand,
      rangeName: str(r.range_name) ?? str(raw.range_name),
      format: ((f) => (f === "autre" ? figures.format ?? f : f))(formatOf(str(r.format), str(r.texture), name)),
      formatRaw: str(r.format),
      texture: str(r.texture),
      price: num(r.price),
      currency,
      zone,
      country: country === "EU" ? null : country,
      shadeCount: num(r.shade_count) ?? shades.length,
      shades,
      keyIngredients: (Array.isArray(r.key_components) ? r.key_components : []) as string[],
      composition: str(r.full_composition),
      isNew: Boolean(r.is_new),
      image: str(r.image_url),
      url: str(r.product_url),
      status: str(r.status),
      salesPrev: figures.salesPrev,
      salesCur: figures.salesCur,
      salesCurrency: figures.salesCurrency,
      trend: figures.trend,
    };
  });

  const shadesBy = new Map<string, Shade[]>();
  for (const s of shadeRows) {
    const id = String(s.product_id);
    if (!shadesBy.has(id)) shadesBy.set(id, []);
    shadesBy.get(id)!.push({ name: String(s.shade_name ?? ""), hex: hexOrNull(s.hex_code), family: str(s.family), bestseller: Boolean(s.is_bestseller) });
  }
  const ingBy = new Map<string, Ingredient[]>();
  for (const i of ingRows) {
    const id = String(i.product_id);
    if (!ingBy.has(id)) ingBy.set(id, []);
    ingBy.get(id)!.push({ name: String(i.inci_name ?? ""), key: Boolean(i.is_key_ingredient), fn: str(i.function) });
  }

  const market: MarketItem[] = marketRows.map((r) => {
    const currency = str(r.currency);
    const country = countryOf(str(r.country), currency);
    const zone = zoneOf(country);
    const brand = String(r.brand ?? "");
    const name = String(r.name ?? "");
    const figures = figuresFor(index, years, brand, name, zone, aliases);
    const guess = formatOf(str(r.format), str(r.subcategory), str(r.texture), name);
    const shades = (shadesBy.get(String(r.id)) ?? []).sort((a, b) => Number(b.bestseller) - Number(a.bestseller));
    return {
      id: String(r.id),
      brand,
      name,
      format: guess === "autre" && figures.format ? figures.format : guess,
      texture: str(r.texture),
      price: num(r.price),
      currency,
      zone,
      country: country === "EU" ? null : country,
      shadeCount: num(r.shade_count) ?? shades.length,
      shades,
      inci: ingBy.get(String(r.id)) ?? [],
      packshot: str(r.packshot_url),
      url: str(r.product_url),
      sourceSite: str(r.source_site),
      status: str(r.status),
      isClient: !!client && brandKey(brand, aliases) === client,
      enrichedAt: str(r.enriched_at),
      salesPrev: figures.salesPrev,
      salesCur: figures.salesCur,
      salesCurrency: figures.salesCurrency,
      trend: figures.trend,
    };
  });

  const count = (st: string[]) => jobRows.filter((j) => st.includes(String(j.status))).length;
  return {
    config,
    years,
    catalog,
    market,
    sales,
    enrichment: {
      total: jobRows.length,
      done: count(["completed", "done", "succeeded"]),
      queued: count(["queued", "pending"]),
      running: count(["running", "processing", "in_progress"]),
      failed: count(["failed", "error"]),
    },
    duplicatesRemoved,
    generatedAt: new Date().toISOString(),
  };
}
