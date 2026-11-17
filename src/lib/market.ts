import "server-only";
import { repo } from "./repo";
import { embedOne } from "./matching";
import { missingFields } from "./product";
import { withFamilies } from "./shades";
import { siteByDomain } from "./sites";
import type {
  CircanaRow,
  CollectMethod,
  EnrichmentJobRow,
  MarketIngredientRow,
  MarketProductRow,
  MarketShadeRow,
  MarketStatus,
  ProductSheet,
} from "./types";

/* =======================================================================
   Produits du marché : market_products + market_shades + market_ingredients.
   Les fiches sont partagées entre toutes les analyses (une page produit = une ligne).
   La fiche complète est aussi gardée dans raw_data.sheet pour la relire d'un coup.
   ======================================================================= */

function fallbackUrl(row: CircanaRow, domain: string | null) {
  const q = encodeURIComponent(`${row.brand} ${row.product}`);
  return domain ? `https://www.${domain}/search?q=${q}` : `https://www.google.com/search?q=${q}`;
}

function splitInci(ingredients: string | null) {
  if (!ingredients) return [];
  const seen = new Set<string>();
  return ingredients
    .split(/,(?![^(]*\))/)
    .map((s) => s.replace(/\.$/, "").trim())
    .filter((s) => s.length > 1 && s.length < 200)
    .filter((s) => (seen.has(s.toLowerCase()) ? false : (seen.add(s.toLowerCase()), true)))
    .slice(0, 150);
}

export async function saveMarketProduct(opts: {
  sheet: ProductSheet | null;
  row: CircanaRow;
  domain: string | null;
  url: string | null;
  method: CollectMethod | null;
  category: string;
  existingId?: string | null;
}): Promise<string> {
  const db = repo();
  const { sheet, row, domain, method, category } = opts;
  const complete = sheet && !missingFields(sheet).length;
  const site = siteByDomain(domain);
  const sourceSite = domain ?? "inconnu";
  const productUrl = sheet?.sourceUrl ?? opts.url ?? fallbackUrl(row, domain);
  const status: MarketStatus = complete ? "enriched" : sheet ? "enriching" : "discovered";
  const fields = {
    brand: sheet?.brand || row.brand,
    name: sheet?.name || row.product,
    category: category || null,
    format: sheet?.formats[0]?.size ?? null,
    product_url: productUrl,
    source_site: sourceSite,
    country: site?.country ?? row.zone,
    currency: sheet?.currency ?? null,
    price: sheet?.price ?? null,
    shade_count: sheet ? sheet.shades.length : null,
    packshot_url: sheet?.imageUrl ?? null,
    description: sheet?.packaging ?? null,
    status,
    raw_data: { sheet: sheet ?? undefined, method: method ?? undefined, zone: row.zone },
    enriched_at: complete ? new Date().toISOString() : null,
  };

  let id = opts.existingId ?? null;
  if (!id) {
    const [found] = await db.select<MarketProductRow>("market_products", { eq: { source_site: sourceSite, product_url: productUrl } });
    id = found?.id ?? null;
  }
  if (id) await db.update("market_products", id, fields);
  else {
    try {
      id = (await db.insert<MarketProductRow>("market_products", [fields]))[0].id;
    } catch (e) {
      // Même page produit enregistrée en parallèle (contrainte unique source_site + product_url).
      const [again] = await db.select<MarketProductRow>("market_products", { eq: { source_site: sourceSite, product_url: productUrl } });
      if (!again) throw e;
      id = again.id;
      await db.update("market_products", id, fields);
    }
  }

  if (sheet) {
    await db.removeWhere("market_shades", { product_id: id });
    await db.insert<MarketShadeRow>(
      "market_shades",
      withFamilies(sheet.shades).map((s, position) => ({ product_id: id!, shade_name: s.name, hex_code: s.hex ?? null, family: s.family ?? null, position })),
    );
    await db.removeWhere("market_ingredients", { product_id: id });
    await db.insert<MarketIngredientRow>(
      "market_ingredients",
      splitInci(sheet.ingredients).map((inci_name, position) => ({ product_id: id!, inci_name, position })),
    );
  }
  // Embedding (768 dimensions) pour la fonction match_market_products, si Hugging Face est configuré.
  const embedding = await embedOne(`${fields.brand} ${fields.name}`);
  if (embedding) await db.update("market_products", id, { embedding: JSON.stringify(embedding) });
  return id;
}

export async function loadSheets(ids: string[]): Promise<Map<string, { sheet: ProductSheet | null; method: CollectMethod | null; row: MarketProductRow }>> {
  const out = new Map<string, { sheet: ProductSheet | null; method: CollectMethod | null; row: MarketProductRow }>();
  const unique = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 200) {
    const rows = await repo().select<MarketProductRow>("market_products", { in: ["id", unique.slice(i, i + 200)] });
    for (const r of rows) out.set(r.id, { sheet: r.raw_data?.sheet ?? null, method: r.raw_data?.method ?? null, row: r });
  }
  return out;
}

/* ---------------- File de l'équipe (enrichment_jobs) ---------------- */

export const OPEN_JOB: EnrichmentJobRow["status"][] = ["queued", "running"];

export async function openTeamJob(productId: string, error: string): Promise<string> {
  const db = repo();
  const existing = await db.select<EnrichmentJobRow>("enrichment_jobs", { eq: { target_type: "market_product", target_id: productId }, in: ["status", OPEN_JOB] });
  if (existing[0]) {
    await db.update("enrichment_jobs", existing[0].id, { error_message: error });
    return existing[0].id;
  }
  const [job] = await db.insert<EnrichmentJobRow>("enrichment_jobs", [
    { target_type: "market_product", target_id: productId, source: "team", status: "queued", error_message: error },
  ]);
  return job.id;
}

export async function openComputerUseJob(productId: string, sessionId: string, note: string): Promise<string> {
  const db = repo();
  const now = new Date().toISOString();
  const existing = await db.select<EnrichmentJobRow>("enrichment_jobs", { eq: { target_type: "market_product", target_id: productId }, in: ["status", OPEN_JOB] });
  const patch = { source: `hcompany:${sessionId}`, status: "running" as const, started_at: now, error_message: note };
  if (existing[0]) {
    await db.update("enrichment_jobs", existing[0].id, { ...patch, attempts: existing[0].attempts + 1 });
    return existing[0].id;
  }
  const [job] = await db.insert<EnrichmentJobRow>("enrichment_jobs", [{ target_type: "market_product", target_id: productId, attempts: 1, ...patch }]);
  return job.id;
}

export function sessionOf(job: EnrichmentJobRow | null | undefined) {
  return job?.source?.startsWith("hcompany:") ? job.source.slice("hcompany:".length) : null;
}
