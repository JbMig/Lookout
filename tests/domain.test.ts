import { describe, expect, it } from "vitest";
import { familyFromHex, shadeFamily } from "@/lib/shades";
import { tokenSimilarity } from "@/lib/matching";
import { mergeSheets, missingFields, toProductSheet } from "@/lib/product";

describe("familles de teintes", () => {
  it("classe par couleur", () => {
    expect(familyFromHex("#F08AA0")).toBe("Rose");
    expect(familyFromHex("#F4A07E")).toBe("Pêche / corail");
    expect(familyFromHex("#7E2F55")).toBe("Baie / prune");
    expect(familyFromHex("#B98667")).toBe("Nude / brun");
  });
  it("classe par nom quand la couleur manque", () => {
    expect(shadeFamily({ name: "Berry Crush" })).toBe("Baie / prune");
    expect(shadeFamily({ name: "Coral Kiss" })).toBe("Pêche / corail");
  });
});

describe("fiches produits", () => {
  it("lit une réponse d'agent en texte contenant du JSON", () => {
    const p = toProductSheet('Voici : {"found":true,"name":"X","brand":"Y","price":"12.5","currency":"usd","formats":[{"size":"5 g"}]}', { brand: "Y", name: "X" })!;
    expect(p.price).toBe(12.5);
    expect(p.currency).toBe("USD");
    expect(missingFields(p)).toEqual(["composition"]);
  });
  it("ignore found=false", () => {
    expect(toProductSheet({ found: false }, { brand: "a", name: "b" })).toBeNull();
  });
  it("complète une fiche avec une autre", () => {
    const a = toProductSheet({ found: true, name: "X", brand: "Y", price: 10, currency: "EUR" }, { brand: "Y", name: "X" });
    const b = toProductSheet({ found: true, ingredients: "Aqua, Glycerin", formats: [{ size: "5 g" }] }, { brand: "Y", name: "X" });
    expect(missingFields(mergeSheets(a, b))).toEqual([]);
  });
});

describe("rapprochement", () => {
  it("rapproche des noms proches", () => {
    expect(tokenSimilarity("Benefit Benetint Cheek & Lip Stain", "Benefit Benetint Cheek Lip Stain 6ml")).toBeGreaterThan(0.6);
    expect(tokenSimilarity("NARS Orgasm", "Dior Rosy Glow")).toBe(0);
  });
});

describe("familles de teintes (cas limites)", () => {
  it("distingue rouge, baie et corail", () => {
    expect(familyFromHex("#C23B3B")).toBe("Rouge");
    expect(familyFromHex("#A8435B")).toBe("Baie / prune");
    expect(familyFromHex("#EE7A6A")).toBe("Pêche / corail");
    expect(familyFromHex("#E86A7A")).toBe("Rose");
  });
});
