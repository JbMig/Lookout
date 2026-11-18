import { handle } from "@/lib/http";
import { requireStaff } from "@/lib/auth";
import { repo } from "@/lib/repo";
import { loadSheets, OPEN_JOB, sessionOf } from "@/lib/market";
import { listSites } from "@/lib/sites";
import type { EnrichmentJobRow, ReportDbRow } from "@/lib/types";

/** File de l'équipe : tâches enrichment_jobs ouvertes (scraping incomplet, computer use en cours). */
export const GET = handle(async () => {
  await requireStaff();
  const db = repo();
  const jobs = await db.select<EnrichmentJobRow>("enrichment_jobs", {
    eq: { target_type: "market_product" }, in: ["status", OPEN_JOB], order: ["created_at", "asc"], limit: 300,
  });
  const products = await loadSheets(jobs.map((j) => j.target_id));
  const sites = await listSites();
  const reports = await db.select<ReportDbRow>("reports", { eq: { type: "dashboard" }, order: ["created_at", "desc"], limit: 200 });
  return {
    jobs: jobs.map((j) => {
      const p = products.get(j.target_id);
      const usedIn = reports.filter((r) => (r.data?.items ?? []).some((i) => i.marketProductId === j.target_id));
      return {
        id: j.id,
        status: j.status,
        attempts: j.attempts,
        error: j.error_message,
        sessionId: sessionOf(j),
        created_at: j.created_at,
        productId: j.target_id,
        brand: p?.row.brand ?? "?",
        name: p?.row.name ?? "?",
        url: p?.row.product_url ?? null,
        zone: p?.row.raw_data?.zone ?? null,
        product: p?.sheet ?? null,
        site: sites.find((s) => p?.row.source_site === s.domain || p?.row.source_site?.endsWith(`.${s.domain}`)) ?? null,
        siteDomain: p?.row.source_site ?? null,
        reports: usedIn.map((r) => ({ id: r.id, name: r.title })),
      };
    }),
  };
});
