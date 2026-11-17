import type { CircanaRow, ProductSheet } from "../types";

/**
 * Données fictives pour le mode démo (aucune clé d'API renseignée).
 * Elles sont déterministes : le même produit donne toujours la même fiche.
 */
function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Math.abs(h);
}

const SHADE_SETS = [
  [{ name: "Joy", hex: "#E86A7A" }, { name: "Hope", hex: "#D9827A" }, { name: "Grace", hex: "#B8505E" }, { name: "Lucky", hex: "#F29C8F" }],
  [{ name: "Peach Glow", hex: "#F4A07E" }, { name: "Berry", hex: "#A8435B" }, { name: "Coral", hex: "#EE7A6A" }],
  [{ name: "Pink", hex: "#F08AA0" }, { name: "Rosewood", hex: "#B5656A" }, { name: "Terracotta", hex: "#C66B4E" }, { name: "Plum", hex: "#8A3D5A" }, { name: "Nude", hex: "#D9A08A" }],
];

const INCI = [
  "Dimethicone, Isododecane, Trimethylsiloxysilicate, Polysilicone-11, Glycerin, Tocopherol, Mica, CI 15850, CI 77491",
  "Talc, Mica, Zinc Stearate, Dimethicone, Octyldodecyl Stearoyl Stearate, Squalane, Niacinamide, CI 77891, CI 15850",
  "Aqua, Glycerin, Propanediol, Caprylic/Capric Triglyceride, Hyaluronic Acid, Sodium Hyaluronate, Squalane, CI 15985, CI 77491",
];

const PACKAGING = ["Flacon avec applicateur mousse", "Boîtier poudre aimanté", "Stick rétractable", "Tube souple à embout"];

/** En démo, ~1 produit sur 4 « résiste » au scraping pour montrer la file de l'équipe. */
export function demoResists(row: CircanaRow) {
  return hash(`${row.brand}|${row.product}|${row.zone}`) % 4 === 0;
}

export function demoSheet(row: CircanaRow, complete: boolean): ProductSheet {
  const h = hash(`${row.brand}|${row.product}`);
  const currency = row.zone === "US" ? "USD" : "EUR";
  const price = row.avgPrice ?? 20 + (h % 25);
  const domain = row.zone === "US" ? "https://www.sephora.com/search?keyword=" : "https://www.sephora.fr/recherche?q=";
  return {
    name: row.product,
    brand: row.brand,
    price,
    currency,
    priceEur: null,
    ingredients: complete ? INCI[h % INCI.length] : null,
    formats: complete
      ? [
          { size: h % 2 ? "7.5 ml" : "4.5 g", price, currency },
          ...(h % 3 === 0 ? [{ size: "Mini", price: Math.round(price * 0.55 * 100) / 100, currency }] : []),
        ]
      : [],
    shades: SHADE_SETS[h % SHADE_SETS.length],
    packaging: PACKAGING[h % PACKAGING.length],
    imageUrl: null,
    sourceUrl: domain + encodeURIComponent(`${row.brand} ${row.product}`),
  };
}
