import type { ProductShade, ShadeFamily } from "./types";

/**
 * Regroupe les teintes par famille, pour comparer les gammes entre marques
 * et entre marchés même quand les noms sont traduits ou inventés.
 * Priorité à la couleur (hex), puis aux mots du nom.
 */

function hsl(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue *= 60;
  return { h: hue, s, l };
}

export function familyFromHex(hex: string): ShadeFamily {
  const { h, s, l } = hsl(hex);
  if (s < 0.22) return "Nude / brun";
  if (h >= 270 && h < 330) return l < 0.45 ? "Baie / prune" : "Mauve";
  if (h >= 330 || h < 12) {
    if ((h < 10 || h > 352) && s > 0.5 && l < 0.55) return "Rouge";
    if (h >= 3 && h < 12 && l > 0.6) return "Pêche / corail";
    if (l < 0.5) return "Baie / prune";
    return "Rose";
  }
  if (h < 45) return l < 0.42 || s < 0.45 ? "Nude / brun" : "Pêche / corail";
  if (h < 70) return "Nude / brun";
  return "Autre";
}

const WORDS: [RegExp, ShadeFamily][] = [
  [/berry|plum|wine|prune|baie|bordeaux|burgundy|grape|fig/i, "Baie / prune"],
  [/mauve|lilac|lavender|violet|purple/i, "Mauve"],
  [/red|cherry|rouge|crimson|scarlet|ruby/i, "Rouge"],
  [/peach|coral|apricot|pêche|corail|orange|tangerine|papaya|mango/i, "Pêche / corail"],
  [/nude|brown|bronze|terra|caramel|beige|tan|mocha|cinnamon|sand|toffee/i, "Nude / brun"],
  [/pink|rose|blush|petal|candy|flamingo|strawberry|fuchsia/i, "Rose"],
];

export function shadeFamily(s: ProductShade): ShadeFamily {
  if (s.hex) return familyFromHex(s.hex);
  return WORDS.find(([re]) => re.test(s.name))?.[1] ?? "Autre";
}

export function withFamilies(shades: ProductShade[]): ProductShade[] {
  return shades.map((s) => ({ ...s, family: shadeFamily(s) }));
}
