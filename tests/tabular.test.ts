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
