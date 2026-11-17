import { describe, expect, it } from "vitest";
import { parseProductHtml } from "@/lib/agents/scraper";
import { missingFields } from "@/lib/product";

const HTML = `<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product","name":"Soft Pinch Liquid Blush 7.5 ml",
"brand":{"@type":"Brand","name":"Rare Beauty"},"image":["https://example.com/p.jpg"],
"hasVariant":[{"@type":"Product","name":"Soft Pinch Liquid Blush - Joy","color":"Joy","offers":{"price":"30.00","priceCurrency":"USD"}},
{"@type":"Product","name":"Soft Pinch Liquid Blush - Hope","color":"Hope"}]}]}</script>
</head><body><h1>Soft Pinch</h1>
<div><h3>Ingredients</h3><p>Water, Dimethicone, Propanediol, Glycerin, Isododecane, Mica, CI 15850</p></div>
</body></html>`;

describe("scraper", () => {
  it("extrait une fiche complète depuis le JSON-LD et le HTML", () => {
    const p = parseProductHtml(HTML, "https://www.sephora.com/product/x")!;
    expect(p.brand).toBe("Rare Beauty");
    expect(p.price).toBe(30);
    expect(p.currency).toBe("USD");
    expect(p.imageUrl).toBe("https://example.com/p.jpg");
    expect(p.shades.map((s) => s.name)).toEqual(["Joy", "Hope"]);
    expect(p.ingredients).toContain("Dimethicone");
    expect(p.formats[0].size).toBe("7.5 ml");
    expect(missingFields(p)).toEqual([]);
  });

  it("renvoie null sans produit identifiable", () => {
    expect(parseProductHtml("<html><body></body></html>", "https://x.y")).toBeNull();
  });
});
