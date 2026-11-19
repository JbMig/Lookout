/** Noms de marque normalisés : « YSL Beauty », « Yves Saint Laurent » et « YSL » sont la même marque. */
const ALIAS: Record<string, string> = {
  "yves saint laurent": "YSL", "ysl beauty": "YSL", "ysl beauté": "YSL", "ysl": "YSL",
  "giorgio armani": "Armani", "giorgio armani beauty": "Armani", "armani beauty": "Armani", "armani": "Armani",
  "dior beauty": "Dior", "christian dior": "Dior", "dior": "Dior",
  "l'oreal": "L'Oréal Paris", "loreal": "L'Oréal Paris", "l'oréal": "L'Oréal Paris", "l'oréal paris": "L'Oréal Paris", "loreal paris": "L'Oréal Paris",
  "nars cosmetics": "NARS", "nars": "NARS", "rare beauty by selena gomez": "Rare Beauty", "chanel beauty": "Chanel", "lancome": "Lancôme",
  "fenty": "Fenty Beauty", "rhode skin": "Rhode", "maybelline new york": "Maybelline", "nyx professional makeup": "NYX", "nyx cosmetics": "NYX",
  "prada beauty": "Prada", "valentino beauty": "Valentino", "e.l.f.": "e.l.f.", "elf": "e.l.f.", "elf cosmetics": "e.l.f.", "e.l.f. cosmetics": "e.l.f.",
  "charlotte tilbury beauty": "Charlotte Tilbury", "patrickta": "Patrick Ta", "patrick ta beauty": "Patrick Ta", "patrick ta": "Patrick Ta", "huda beauty": "Huda Beauty", "sheglam": "SHEGLAM",
};
export function marqueCanon(nom: unknown): string {
  const s = String(nom ?? "").replace(/[’‘`]/g, "'").trim();
  const k = s.toLowerCase();
  if (ALIAS[k]) return ALIAS[k];
  const sans = k.replace(/\b(beauty|beauté|cosmetics|paris|makeup|official)\b/g, "").replace(/\s+/g, " ").trim();
  if (ALIAS[sans]) return ALIAS[sans];
  // « Tarte Cosmetics » -> « Tarte » : on retire le suffixe générique en gardant la casse d'origine
  const court = s.replace(/\s+(cosmetics|beauty|beauté|makeup|paris|official)$/i, "").trim() || s;
  return court === court.toLowerCase() ? court.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : court;
}

/** Revendeurs, sites et mots qui ne sont pas des marques : exclus des graphiques « marques ». */
const PAS_MARQUE = /(\.(fr|com|net|co\.uk)$)|^(sephora|nocibé|nocibe|douglas|marionnaud|amazon|primor|ulta|boots|notino|lookfantastic|aliexpress|shein|temu|action|carrefour|monoprix|inconnu|unknown|n\/a|autre|autres|divers)$/i;
export function estMarque(nom: unknown): boolean {
  const s = String(nom ?? "").trim();
  return s.length >= 2 && !PAS_MARQUE.test(s);
}

/** Marques du groupe L'Oréal (liste officielle loreal-finance.com, lue le 18/11/2026). */
const LOREAL = ["l'oréal", "loreal", "maybelline", "nyx", "garnier", "essie", "3ce", "mixa", "lancôme", "lancome", "ysl", "yves saint laurent", "armani",
  "valentino", "prada", "urban decay", "it cosmetics", "kiehl", "helena rubinstein", "biotherm", "shu uemura", "mugler", "azzaro", "aesop", "takami",
  "youth to the people", "la roche-posay", "vichy", "cerave", "skinceuticals", "kérastase", "kerastase", "redken", "carita", "miu miu", "maison margiela", "medik8"];
export function estLoreal(nom: unknown): boolean {
  const s = String(nom ?? "").toLowerCase();
  return LOREAL.some((b) => s.includes(b));
}

/** Positionnement prestige / luxe (pour comparer une marque à des concurrents de même gamme de prix). Liste établie à la main. */
const LUXE = /\b(ysl|yves saint laurent|lanc[oô]me|armani|prada|valentino|helena rubinstein|mugler|shu uemura|dior|chanel|charlotte tilbury|rare( beauty)?|fenty|nars|hourglass|rhode|patrick ta|makeup by mario|westman|tom ford|guerlain|givenchy|est[ée]e lauder|clarins|sisley|gucci|herm[eè]s|benefit|huda|pat mcgrath|natasha denona|kosas|ilia|merit|saie|haus labs|too faced|bobbi brown|laura mercier|clinique|r\.e\.m\.?|r\.e\.m beauty|summer fridays|glossier)\b/i;
export function estLuxe(nom: unknown): boolean {
  return LUXE.test(String(nom ?? ""));
}
