import { describe, expect, it } from "vitest";
import { isAgent4Data, missingSections, parseAgent4 } from "../src/lib/agent4";

describe("rapport de l'Agent 4", () => {
  const data = {
    meta: { category: "blush", zone: "global", period: "FY 2025 vs FY 2024", generated_at: "2026-11-19", sources: ["circana_sales"] },
    market_size: { us: { fy25_top10: 1200000, fy24_top10: 1000000, evolution_pct: 20, nb_products: 40, nb_brands: 12 } },
    formats: { FR: [{ name: "Liquid Blush", fy25: "500", fy24: 400, evolution_pct: "25%", share_pct: 41.7 }] },
    top_shades: [{ family: "rose", count: 12, example: "Pink Up", hex: "E58FA0" }],
    insights: ["Le liquide progresse de 25 %."],
  };
  it("reconnaît le format et tolère les champs mal typés", () => {
    expect(isAgent4Data(data)).toBe(true);
    expect(isAgent4Data({ generatedAt: "x" })).toBe(false);
    const r = parseAgent4(data);
    expect(r.market_size.us?.evolution_pct).toBe(20);
    expect(r.formats.fr?.[0]).toMatchObject({ fy25: 500, evolution_pct: 25 });
    expect(r.top_shades[0].hex).toBe("#E58FA0");
    expect(r.top_products).toEqual({});
  });
  it("liste les sections manquantes", () => {
    expect(missingSections(data)).toEqual(["top_brands", "top_products", "competitor_prices", "catalog", "recommendations", "opportunities"]);
  });
});
