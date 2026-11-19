/**
 * Vues agrégées du marché à partir des ventes Circana (une ligne par produit et zone),
 * complétées par le prix et les visuels des fiches enrichies. Pur : utilisé dans le navigateur.
 */
import { brandKey, nameSimilarity, productKey, type Format, type Zone } from "./normalize";
import type { MarketItem, SalesLine } from "./universe";

export interface ProductAgg {
  key: string;
  brand: string;
  product: string;
  zone: Zone | null;
  country: string | null;
  format: Format;
  /** Devise des ventes. */
  salesCurrency: string;
  prev: number;
  cur: number;
  /** Prix public relevé sur la fiche enrichie, dans sa devise (currency). */
  price: number | null;
  currency: string | null;
  market: MarketItem | null;
}

export function aggregateProducts(sales: SalesLine[], market: MarketItem[], years: { prev: number | null; cur: number | null }): ProductAgg[] {
  const groups = new Map<string, ProductAgg>();
  for (const s of sales) {
    const k = [brandKey(s.brand), productKey(s.brand, s.product), s.zone, s.format, s.currency].join("|");
    if (!groups.has(k)) {
      groups.set(k, { key: k, brand: s.brand, product: s.product, zone: s.zone, country: s.country, format: s.format, salesCurrency: s.currency, prev: 0, cur: 0, price: null, currency: null, market: null });
    }
    const g = groups.get(k)!;
    if (s.year === years.cur) g.cur += s.revenue;
    if (s.year === years.prev) g.prev += s.revenue;
  }
  const byBrand = new Map<string, MarketItem[]>();
  for (const m of market) {
    const b = brandKey(m.brand);
    if (!byBrand.has(b)) byBrand.set(b, []);
    byBrand.get(b)!.push(m);
  }
  for (const g of groups.values()) {
    const key = productKey(g.brand, g.product);
    let best: MarketItem | null = null;
    let score = 0;
    for (const m of byBrand.get(brandKey(g.brand)) ?? []) {
      const s = nameSimilarity(productKey(m.brand, m.name), key) + (m.zone === g.zone ? 0.05 : 0) + (m.price !== null ? 0.01 : 0);
      if (s > score) { score = s; best = m; }
    }
    if (best && score >= 0.5) {
      g.market = best;
      g.price = best.price;
      g.currency = best.currency;
    }
  }
  return [...groups.values()];
}

export interface BrandAgg { brand: string; cur: number; prev: number; products: number; isClient: boolean }

/** Totaux par marque, en euros (conversion fournie par l'appelant). */
export function aggregateBrands(products: ProductAgg[], eur: (v: number, cur: string) => number | null, clientBrand: string): BrandAgg[] {
  const map = new Map<string, BrandAgg>();
  const client = brandKey(clientBrand);
  for (const p of products) {
    const k = brandKey(p.brand);
    if (!map.has(k)) map.set(k, { brand: p.brand, cur: 0, prev: 0, products: 0, isClient: !!client && k === client });
    const b = map.get(k)!;
    b.cur += eur(p.cur, p.salesCurrency) ?? 0;
    b.prev += eur(p.prev, p.salesCurrency) ?? 0;
    b.products++;
  }
  return [...map.values()].sort((a, b) => b.cur - a.cur);
}
