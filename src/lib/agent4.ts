/**
 * Rapport JSON de l'agent Holo « bench-dashboard-creation » (Agent 4), tel qu'il l'enregistre dans reports.data
 * via l'Edge Function save-report. Partagé serveur / navigateur : aucune dépendance serveur.
 * Chaque champ est lu prudemment : l'agent peut omettre une section ou l'enregistrer en plusieurs appels.
 */

export type Zone4 = "us" | "fr";

export interface MarketSize4 { fy25_top10: number | null; fy24_top10: number | null; evolution_pct: number | null; nb_products: number | null; nb_brands: number | null }
export interface Format4 { name: string; fy25: number | null; fy24: number | null; evolution_pct: number | null; share_pct: number | null }
export interface Brand4 { name: string; fy25: number | null; fy24: number | null; evolution_pct: number | null }
export interface Product4 { rank: number | null; brand: string; name: string; format: string; fy25: number | null; fy24: number | null; is_new: boolean }
export interface Shade4 { family: string; count: number | null; example: string; hex: string | null }
export interface Price4 { brand: string; name: string; price: number | null; currency: string; shade_count: number | null }
export interface Catalog4 { name: string; price: number | null; currency: string; format: string; shade_count: number | null; status: string }
export interface Reco4 { pillar: string; title: string; evidence: string }
export interface Opportunity4 { kind: string; title: string; score: number | null; priority: string }

export interface Agent4Data {
  meta: { category: string; zone: string; period: string; generated_at: string; sources: string[] };
  market_size: Partial<Record<Zone4, MarketSize4>>;
  formats: Partial<Record<Zone4, Format4[]>>;
  top_brands: Partial<Record<Zone4, Brand4[]>>;
  top_products: Partial<Record<Zone4, Product4[]>>;
  top_shades: Shade4[];
  competitor_prices: Price4[];
  catalog: Catalog4[];
  insights: string[];
  recommendations: Reco4[];
  opportunities: Opportunity4[];
}

const KEYS = ["meta", "market_size", "formats", "top_brands", "top_products", "top_shades", "competitor_prices", "catalog", "insights", "recommendations", "opportunities"];

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") as Raw[] : []);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/[\s%]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
const hex = (v: unknown) => {
  const s = str(v);
  if (!s) return null;
  const h = s.startsWith("#") ? s : `#${s}`;
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(h) ? h : null;
};

/** Vrai si reports.data ressemble au rapport de l'Agent 4 (au moins une de ses sections). */
export function isAgent4Data(data: unknown): boolean {
  const d = obj(data);
  return KEYS.some((k) => k !== "meta" && k in d) || ("meta" in d && "category" in obj(d.meta));
}

function byZone<T>(v: unknown, map: (x: Raw) => T): Partial<Record<Zone4, T>> {
  const o = obj(v);
  const out: Partial<Record<Zone4, T>> = {};
  for (const z of ["us", "fr"] as Zone4[]) {
    const key = Object.keys(o).find((k) => k.toLowerCase() === z || (z === "fr" && ["eu", "europe", "france"].includes(k.toLowerCase())));
    if (key) out[z] = map(o[key] as Raw);
  }
  return out;
}

/**
 * Unité des chiffres d'affaires. L'agent écrit parfois ses montants en millions (« 39.15 » pour 39,15 M) sans le dire :
 * meta.unit (« M », « K ») fait foi ; à défaut, des montants tous inférieurs à 10 000 sont lus comme des millions.
 */
function scaleOf(d: Raw): number {
  const unit = str(obj(d.meta).unit).toUpperCase();
  if (unit.startsWith("M")) return 1e6;
  if (unit.startsWith("K")) return 1e3;
  if (unit) return 1;
  const values: number[] = [];
  const collect = (v: unknown) => {
    for (const z of Object.values(obj(v))) for (const x of Array.isArray(z) ? z : [z]) for (const k of ["fy25", "fy24", "fy25_top10", "fy24_top10"]) {
      const n = num(obj(x)[k]);
      if (n !== null) values.push(Math.abs(n));
    }
  };
  ["market_size", "formats", "top_brands", "top_products"].forEach((k) => collect(d[k]));
  return values.length && Math.max(...values) < 10_000 ? 1e6 : 1;
}

/** Lit le JSON de l'Agent 4 en tolérant les champs absents ou mal typés. Les chiffres d'affaires sont rendus en unités réelles. */
export function parseAgent4(data: unknown): Agent4Data {
  const d = obj(data);
  const m = obj(d.meta);
  const k = scaleOf(d);
  const ca = (v: unknown) => { const n = num(v); return n === null ? null : n * k; };
  return {
    meta: {
      category: str(m.category),
      zone: str(m.zone),
      period: str(m.period),
      generated_at: str(m.generated_at),
      sources: Array.isArray(m.sources) ? m.sources.map(str).filter(Boolean) : [],
    },
    market_size: byZone(d.market_size, (x) => {
      const o = obj(x);
      return { fy25_top10: ca(o.fy25_top10), fy24_top10: ca(o.fy24_top10), evolution_pct: num(o.evolution_pct), nb_products: num(o.nb_products), nb_brands: num(o.nb_brands) };
    }),
    formats: byZone(d.formats, (x) => arr(x).map((f) => ({ name: str(f.name), fy25: ca(f.fy25), fy24: ca(f.fy24), evolution_pct: num(f.evolution_pct), share_pct: num(f.share_pct) }))),
    top_brands: byZone(d.top_brands, (x) => arr(x).map((b) => ({ name: str(b.name), fy25: ca(b.fy25), fy24: ca(b.fy24), evolution_pct: num(b.evolution_pct) }))),
    top_products: byZone(d.top_products, (x) => arr(x).map((p, i) => ({
      rank: num(p.rank) ?? i + 1, brand: str(p.brand), name: str(p.name), format: str(p.format), fy25: ca(p.fy25), fy24: ca(p.fy24), is_new: p.is_new === true,
    }))),
    top_shades: arr(d.top_shades).map((s) => ({ family: str(s.family), count: num(s.count), example: str(s.example), hex: hex(s.hex) })),
    competitor_prices: arr(d.competitor_prices).map((p) => ({ brand: str(p.brand), name: str(p.name), price: num(p.price), currency: str(p.currency), shade_count: num(p.shade_count) })),
    catalog: arr(d.catalog).map((c) => ({ name: str(c.name), price: num(c.price), currency: str(c.currency), format: str(c.format), shade_count: num(c.shade_count), status: str(c.status) })),
    insights: Array.isArray(d.insights) ? d.insights.map(str).filter(Boolean) : [],
    recommendations: arr(d.recommendations).map((r) => ({ pillar: str(r.pillar), title: str(r.title), evidence: str(r.evidence) })),
    opportunities: arr(d.opportunities).map((o) => ({ kind: str(o.kind), title: str(o.title), score: num(o.score), priority: str(o.priority) })),
  };
}

/** Sections présentes, pour signaler un rapport incomplet (enregistrement en plusieurs appels interrompu). */
export function missingSections(data: unknown): string[] {
  const d = obj(data);
  return KEYS.filter((k) => !(k in d));
}
