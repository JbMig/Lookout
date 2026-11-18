import { describe, expect, it } from "vitest";
import { CIRCANA_FIELDS, missingRequired, parseCsv, parseJson, suggestMapping, toCircanaRows, toNumber } from "@/lib/tabular";

const CSV = `Brand,Product,Market,Period,Dollar Sales
NARS,Blush Orgasm,US,2026-Q2,3120000
NARS,Blush Orgasm,US,2026-Q3,2950000
Dior,Rosy Glow,Europe,2026-Q3,"2,460,000"`;

describe("import Circana", () => {
  it("reconnaît les colonnes et regroupe les périodes par produit et zone", () => {
    const t = parseCsv(CSV);
    const m = suggestMapping(t.headers, CIRCANA_FIELDS);
    expect(m.brand).toBe("Brand");
    expect(m.salesValue).toBe("Dollar Sales");
    expect(missingRequired(m, CIRCANA_FIELDS)).toEqual([]);
    const rows = toCircanaRows(t.rows, m);
    expect(rows).toHaveLength(2);
    const nars = rows.find((r) => r.brand === "NARS")!;
    expect(nars.period).toBe("2026-Q3");
    expect(nars.salesValue).toBe(2950000);
    expect(nars.history).toHaveLength(2);
    expect(rows.find((r) => r.brand === "Dior")!.zone).toBe("EU");
  });

  it("lit les nombres au format français et anglais", () => {
    expect(toNumber("2,460,000")).toBe(2460000);
    expect(toNumber("29,50 €")).toBe(29.5);
    expect(toNumber("")).toBeUndefined();
  });

  it("lit un JSON avec un tableau imbriqué", () => {
    const t = parseJson(JSON.stringify({ data: [{ Brand: "A", Product: "B", Price: 3 }] }));
    expect(t.headers).toEqual(["Brand", "Product", "Price"]);
    expect(t.rows[0].Price).toBe("3");
  });

  it("signale les colonnes obligatoires manquantes", () => {
    const m = suggestMapping(["Marque", "Ventes"], CIRCANA_FIELDS);
    expect(missingRequired(m, CIRCANA_FIELDS)).toEqual(["Produit"]);
  });
});

describe("classeur Circana mis en forme", () => {
  const sheet = (name: string, title: string, unit: string, rows: (string | number)[][]) => ({
    name,
    rows: [
      [title], ["Données fictives."], [],
      ["Rang", "Produit", "Marque", "Teinte", `CA FY 2024 (${unit})`, `CA FY 2025 (${unit})`, "Évol."],
      ...rows.map((r) => r.map(String)),
    ],
  });
  const summary = { name: "Liquid Blush", rows: [["", "Liquid Blush | FY 2025 vs FY 2024"], [], ["", "Rang", "Marque", "CA FY 2024", "CA FY 2025"], ["", "1", "Dior", "947", "3489"]] };

  it("remet à plat les feuilles SKU : zone, segment, périodes et unités", async () => {
    const { normalizeCircanaSheets, suggestMapping, toCircanaRows, CIRCANA_FIELDS } = await import("@/lib/tabular");
    const t = normalizeCircanaSheets([
      summary,
      sheet("Top50 SKU US - Liquid", "Top 50 SKU — Liquid Blush — ÉTATS-UNIS | FY 2025 vs FY 2024", "K$", [
        [1, "Matte Beauty Blush Wand", "Charlotte Tilbury", "Pillow Pink", 16760, 16071, ""],
        [4, "Matte Beauty Blush Wand", "Charlotte Tilbury", "Hollywood Flush", 6650, 7762, ""],
        [2, "Dior Backstage Rosy Glow Liquid Blush", "Dior", "Ballet", 0, 10093, ""],
      ]),
      sheet("Top50 SKU FR - Liquid", "Top 50 SKU — Liquid Blush — FRANCE | FY 2025 vs FY 2024", "K€", [
        [1, "Dior Backstage Rosy Glow Liquid Blush", "Dior", "Bronze", 0, 688, ""],
      ]),
    ])!;
    expect(t).not.toBeNull();
    const m = suggestMapping(t.headers, CIRCANA_FIELDS);
    expect(m).toMatchObject({ brand: "Marque", product: "Produit", zone: "Zone", period: "Période", salesValue: "Ventes", currency: "Devise", shade: "Teinte", segment: "Segment" });
    const rows = toCircanaRows(t.rows, m);
    expect(rows).toHaveLength(3);
    const ct = rows.find((r) => r.brand === "Charlotte Tilbury")!;
    expect(ct).toMatchObject({ zone: "US", period: "FY 2025", salesValue: 23_833_000, currency: "USD", segment: "Liquid Blush", shades: ["Pillow Pink", "Hollywood Flush"] });
    expect(ct.history).toEqual([
      { period: "FY 2024", salesValue: 23_410_000, units: undefined },
      { period: "FY 2025", salesValue: 23_833_000, units: undefined },
    ]);
    const fr = rows.find((r) => r.zone === "EU")!;
    expect(fr).toMatchObject({ brand: "Dior", salesValue: 688_000, currency: "EUR" });
  });

  it("laisse les fichiers déjà à plat au lecteur habituel", async () => {
    const { normalizeCircanaSheets } = await import("@/lib/tabular");
    expect(normalizeCircanaSheets([{ name: "data", rows: [["Brand", "Product", "Market", "Period", "Dollar Sales"], ["NARS", "Blush", "US", "2026-Q3", "100"]] }])).toBeNull();
  });
});
