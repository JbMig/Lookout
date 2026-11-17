import { handle } from "@/lib/http";
import { requireStaff } from "@/lib/auth";
import { repo } from "@/lib/repo";
import type { EnrichmentJobRow, MarketProductRow } from "@/lib/types";

function count<T>(rows: T[], key: (r: T) => string) {
  const out: Record<string, number> = {};
  for (const r of rows) out[key(r)] = (out[key(r)] ?? 0) + 1;
  return out;
}

/** Statistiques de collecte : fiches par méthode / statut / site, tâches par statut. */
export const GET = handle(async () => {
  await requireStaff();
  const db = repo();
  const products = await db.select<MarketProductRow>("market_products", { limit: 10000 });
  const jobs = await db.select<EnrichmentJobRow>("enrichment_jobs", { limit: 10000 });
  return {
    products: products.length,
    byMethod: count(products, (p) => p.raw_data?.method ?? "inconnue"),
    byStatus: count(products, (p) => p.status),
    bySite: count(products, (p) => p.source_site),
    jobsByStatus: count(jobs, (j) => j.status),
  };
});
