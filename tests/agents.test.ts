import { describe, expect, it } from "vitest";
import { countryOf, familyOf, formatOf, inZone, productKey, trendOf, zoneOf } from "@/lib/normalize";
import { computeGrowth } from "@/lib/growth";
import { aggregateProducts } from "@/lib/market-view";
import type { CatalogItem, MarketItem, SalesLine, Universe } from "@/lib/universe";

describe("normalisation des données des agents", () => {
  it("reconnaît les pays et les zones écrits de plusieurs façons", () => {
    expect(countryOf("États-Unis")).toBe("US");
    expect(countryOf("NA")).toBe("US");
    expect(countryOf("Royaume-Uni")).toBe("UK");
    expect(countryOf(null, "EUR")).toBe("EU");
    expect(zoneOf("DE")).toBe("EU");
    expect(inZone({ zone: "EU", country: "FR" }, "FR")).toBe(true);
    expect(inZone({ zone: "EU", country: "DE" }, "FR")).toBe(false);
  });

  it("déduit le format", () => {
    expect(formatOf("7.5 ml", null, "Unreal Liquid Blush")).toBe("liquide");
    expect(formatOf("Powder")).toBe("compact");
    expect(formatOf(null, null, "Backstage Rosy Glow Stick")).toBe("stick");
    expect(formatOf("creme")).toBe("creme");
    expect(formatOf("4.5 g")).toBe("autre");
  });

  it("rapproche les noms de produits sans la marque", () => {
    expect(productKey("Dior", "Dior Backstage Rosy Glow Blush")).toBe(productKey("DIOR", "Backstage Rosy Glow"));
  });

  it("classe les tendances et les familles", () => {
    expect(trendOf(100, 120)).toBe("croissance");
    expect(trendOf(100, 102)).toBe("stable");
    expect(trendOf(100, 80)).toBe("declin");
    expect(trendOf(null, 80)).toBeNull();
    expect(familyOf("Peach / Coral")).toBe("Pêche / corail");
    expect(familyOf("Berry / Plum")).toBe("Baie / prune");
    expect(familyOf(null, "Pink oh la la")).toBe("Rose");
  });
});

const base = { zone: "US" as const, country: "US", currency: "USD", salesCurrency: "USD", trend: null, salesPrev: null, salesCur: null };
const mk = (id: string, brand: string, name: string, price: number, shades: number, extra: Partial<MarketItem> = {}): MarketItem => ({
  ...base, id, brand, name, format: "liquide", texture: null, price, shadeCount: shades,
  shades: Array.from({ length: shades }, (_, i) => ({ name: `S${i}`, hex: "#E58BA6", family: "Rose" })),
  inci: [], packshot: null, url: null, sourceSite: null, status: "enriched", isClient: false, enrichedAt: null, ...extra,
});

describe("Agent 3 intégré", () => {
  const catalog: CatalogItem[] = [{
    ...base, id: "c1", name: "Juicy Liquid Blush", brand: "Lancome", rangeName: null, format: "liquide", formatRaw: "Liquid", texture: null,
    price: 60, shadeCount: 4, shades: [], keyIngredients: ["Niacinamide"], composition: null, isNew: false, image: null, url: null, status: "active", trend: "declin",
  }];
  const market = [
    mk("m1", "Rare Beauty", "Soft Pinch Liquid Blush", 25, 12, { salesCur: 900, trend: "croissance", inci: [{ name: "Squalane", key: true, fn: null }] }),
    mk("m2", "Charlotte Tilbury", "Beauty Light Wand", 42, 10, { salesCur: 800, trend: "croissance", inci: [{ name: "Squalane", key: true, fn: null }] }),
    mk("m3", "Fenty", "Cheeks Out Liquid", 30, 8, { salesCur: 500 }),
  ];
  const sales: SalesLine[] = [
    { brand: "Rare Beauty", product: "Soft Pinch Liquid Blush", year: 2024, revenue: 100, units: null, currency: "USD", zone: "US", country: "US", format: "liquide" },
    { brand: "Rare Beauty", product: "Soft Pinch Liquid Blush", year: 2025, revenue: 150, units: null, currency: "USD", zone: "US", country: "US", format: "liquide" },
    { brand: "Rare Beauty", product: "Pressed Powder", year: 2024, revenue: 50, units: null, currency: "USD", zone: "US", country: "US", format: "compact" },
    { brand: "Rare Beauty", product: "Pressed Powder", year: 2025, revenue: 80, units: null, currency: "USD", zone: "US", country: "US", format: "compact" },
  ];
  const u: Universe = {
    config: { brand: "Lancome", zone: "US", category: "blush", formats: ["liquide"], startUrl: "" },
    years: { prev: 2024, cur: 2025 }, catalog, market, sales,
    enrichment: { total: 0, done: 0, queued: 0, failed: 0, running: 0 }, duplicatesRemoved: 0, generatedAt: "",
  };

  it("trouve les écarts de prix, de teintes, de formats et d'ingrédients", () => {
    const { analysis, opportunities } = computeGrowth(u);
    const kinds = opportunities.map((o) => o.kind);
    expect(kinds).toContain("price_gap");
    expect(kinds).toContain("shade_gap");
    expect(kinds).toContain("format_gap");
    expect(kinds).toContain("ingredient");
    for (const o of opportunities) {
      expect(o.score).toBeGreaterThanOrEqual(0);
      expect(o.score).toBeLessThanOrEqual(1);
    }
    expect(opportunities.find((o) => o.kind === "price_gap")!.refs.produit_client_ids).toEqual(["c1"]);
    expect(analysis.comparison[0].marketMedian).toBe(30);
    expect([...opportunities].map((o) => o.score)).toEqual([...opportunities].map((o) => o.score).sort((a, b) => b - a));
  });

  it("agrège les ventes par produit et y rattache le prix de la fiche", () => {
    const rows = aggregateProducts(sales, market, u.years);
    const soft = rows.find((r) => r.product === "Soft Pinch Liquid Blush")!;
    expect(soft.cur).toBe(150);
    expect(soft.prev).toBe(100);
    expect(soft.price).toBe(25);
  });
});
