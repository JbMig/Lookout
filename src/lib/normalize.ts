/**
 * Normalisation des valeurs écrites par les agents (pays, formats, marques, périodes),
 * qui arrivent sous des formes variées : « États-Unis », « US », « NA » ; « 7.5 ml », « Liquid Blush »…
 * Fonctions pures, partagées entre le serveur et le navigateur.
 */

export type Zone = "US" | "EU" | "CN" | "KR";
export type Format = "liquide" | "compact" | "creme" | "stick" | "autre";

export const FORMATS: { id: Format; label: string }[] = [
  { id: "liquide", label: "Liquide" },
  { id: "compact", label: "Compact (poudre)" },
  { id: "creme", label: "Crème" },
  { id: "stick", label: "Stick" },
  { id: "autre", label: "Autre" },
];

export const formatLabel = (f: Format | null | undefined) => FORMATS.find((x) => x.id === f)?.label ?? "—";

export const ZONE_LABEL: Record<string, string> = { US: "États-Unis", EU: "Europe", FR: "France", CN: "Chine", KR: "Corée" };

export const strip = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const COUNTRY: Record<string, string> = {
  us: "US", usa: "US", "etats unis": "US", "united states": "US", na: "US", "north america": "US",
  fr: "FR", france: "FR",
  de: "DE", allemagne: "DE", germany: "DE",
  uk: "UK", gb: "UK", "royaume uni": "UK", "united kingdom": "UK",
  it: "IT", italie: "IT", italy: "IT", es: "ES", espagne: "ES", spain: "ES",
  eu: "EU", europe: "EU",
  cn: "CN", chine: "CN", china: "CN", apac: "CN",
  kr: "KR", coree: "KR", korea: "KR",
};

/** Pays (US, FR, DE, UK…) à partir d'un libellé libre ; la devise sert de repli. */
export function countryOf(value: string | null | undefined, currency?: string | null): string | null {
  const c = COUNTRY[strip(value)];
  if (c) return c;
  if (currency === "USD") return "US";
  if (currency === "GBP") return "UK";
  if (currency === "EUR") return "EU";
  return null;
}

export function zoneOf(country: string | null): Zone | null {
  if (!country) return null;
  if (country === "US") return "US";
  if (country === "CN") return "CN";
  if (country === "KR") return "KR";
  return "EU";
}

/** Vrai si l'élément correspond au filtre de zone (« FR » = la France seule, « EU » = toute l'Europe). */
export function inZone(item: { zone: Zone | null; country: string | null }, filter: string): boolean {
  if (!filter || filter === "all") return true;
  if (filter === "FR") return item.country === "FR";
  return item.zone === filter;
}

/** Format (liquide, compact, crème, stick) déduit de tous les indices disponibles. */
export function formatOf(...hints: (string | null | undefined)[]): Format {
  const s = strip(hints.filter(Boolean).join(" "));
  if (!s) return "autre";
  if (/\bstick|baton|balm stick\b/.test(s)) return "stick";
  if (/\bliquid|liquide|fluid|fluide|drops?|serum|tint|wand|gel|mousse|bottle|flacon|tube\b/.test(s)) return "liquide";
  if (/\bcream|creme|cream to|balm|baume|souffle\b/.test(s)) return "creme";
  if (/\bpowder|poudre|compact|pressed|baked|cuit|duo|palette|boitier\b/.test(s)) return "compact";
  return "autre";
}

const BRAND_FIX: Record<string, string> = { lancome: "lancome", "estee lauder": "estee lauder", "ysl": "yves saint laurent", "ysl beaute": "yves saint laurent", armani: "giorgio armani", "armani beauty": "giorgio armani" };

/** Clé de marque comparable (accents, casse, alias connus). */
export function brandKey(brand: string | null | undefined, aliases: Record<string, string> = {}): string {
  const b = strip(brand);
  return aliases[b] ?? BRAND_FIX[b] ?? b;
}

/** Clé de produit comparable : sans la marque, sans les mots génériques. */
export function productKey(brand: string | null | undefined, name: string | null | undefined, aliases: Record<string, string> = {}): string {
  const b = brandKey(brand, aliases);
  let n = strip(name);
  for (const w of new Set([b, strip(brand)])) if (w) n = n.replace(new RegExp(`\\b${w}\\b`, "g"), " ");
  return n
    .split(" ")
    .filter((w) => w && !["the", "le", "la", "les", "de", "du", "blush", "blusher", "fard", "joues", "a", "for"].includes(w))
    .join(" ");
}

/** Proximité de deux noms de produits (Jaccard sur les mots), 0..1. */
export function nameSimilarity(a: string, b: string): number {
  const A = new Set(a.split(" ").filter(Boolean));
  const B = new Set(b.split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export type Trend = "croissance" | "stable" | "declin";

export function trendOf(prev: number | null, cur: number | null): Trend | null {
  if (!prev || cur === null) return null;
  const g = (cur - prev) / prev;
  if (g > 0.05) return "croissance";
  if (g < -0.05) return "declin";
  return "stable";
}

export const TREND_LABEL: Record<Trend, string> = { croissance: "En croissance", stable: "Stable", declin: "En déclin" };

/** Hex valide (#RRGGBB) ou null, comme dans la base. */
export function hexOrNull(v: unknown): string | null {
  return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toUpperCase() : null;
}

const FAMILIES: [RegExp, string][] = [
  [/peach|peche|coral|corail|apricot|abricot/, "Pêche / corail"],
  [/berry|baie|plum|prune|wine|cassis/, "Baie / prune"],
  [/mauve|lilac|lilas|violet|purple/, "Mauve"],
  [/\bred\b|rouge|cherry/, "Rouge"],
  [/orange/, "Orange"],
  [/nude|beige|neutral|neutre/, "Nude / beige"],
  [/brown|brun|bronze|terracotta|mocha|caramel|\btan\b/, "Brun / terracotta"],
  [/pink|rose|fuchsia|magenta/, "Rose"],
];

/** Famille de teinte harmonisée (les agents écrivent en anglais ou en français). */
export function familyOf(family: string | null | undefined, name?: string | null): string {
  const s = strip(family) || strip(name);
  for (const [re, label] of FAMILIES) if (re.test(s)) return label;
  return "Autre";
}

export const FAMILY_COLORS: Record<string, string> = {
  Rose: "#E58BA6",
  "Pêche / corail": "#F2A07B",
  "Baie / prune": "#8E3B5E",
  Mauve: "#B07BA8",
  Rouge: "#C83A3A",
  Orange: "#E8803A",
  "Nude / beige": "#D9B59A",
  "Brun / terracotta": "#9A5B3F",
  Autre: "#B8BEC8",
};

const COUNTRY_LABEL: Record<string, string> = { US: "États-Unis", FR: "France", DE: "Allemagne", UK: "Royaume-Uni", IT: "Italie", ES: "Espagne", CN: "Chine", KR: "Corée" };

/** Libellé de lieu : le pays quand il est connu, sinon la zone. */
export const placeLabel = (zone: string | null, country: string | null) =>
  (country && COUNTRY_LABEL[country]) || (zone && ZONE_LABEL[zone]) || "—";
