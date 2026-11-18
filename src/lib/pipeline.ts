import "server-only";
import { repo } from "./repo";
import { isDemo } from "./config";
import { discoverUrl, domainOf } from "./agents/discovery";
import { scrape } from "./agents/scraper";
import { linkupExtract } from "./agents/extractor";
import { pollNavigator, startNavigator } from "./agents/navigator";
import { demoResists, demoSheet } from "./agents/demo";
import { mergeSheets, missingFields } from "./product";
import { toEur } from "./currency";
import { withFamilies } from "./shades";
import { ensureSite, recordSuccess, sitesFor, siteByDomain } from "./sites";
import { computeCatalog, computeStats, writeAnalysis } from "./analysis";
import { computeTrends } from "./trends";
import { loadSheets, openComputerUseJob, openTeamJob, saveMarketProduct, sessionOf } from "./market";
import { itemViews } from "./reports";
import { toClientProduct } from "./imports";
import { logRun } from "./runs";
import type {
  AnalysisRow,
  CatalogInsights,
  CatalogProductRow,
  EnrichmentJobRow,
  GrowthOpportunityRow,
  ProductSheet,
  ReportDbRow,
  StoredItem,
} from "./types";

/**
 * Pipeline d'une analyse, avancé par petites étapes (/api/reports/[id]/step).
 * Les lignes à enrichir vivent dans reports.data.items ; les fiches dans market_products ;
 * les produits que le scraping ne sait pas traiter partent dans enrichment_jobs (file de l'équipe).
 *
 *   pending ─► Découverte Linkup ─► Scraping direct ─► Extraction Linkup ─► done
 *                                                             │ incomplet
 *                    site avec parcours (sites.ts) ◄──────────┤
 *                    navigating (H Company)              awaiting_team (enrichment_jobs)
 */

const BATCH = 3;
const STALE_MS = 3 * 60_000;

async function finishSheet(sheet: ProductSheet | null): Promise<ProductSheet | null> {
  if (!sheet) return null;
  return { ...sheet, shades: withFamilies(sheet.shades), priceEur: await toEur(sheet.price, sheet.currency) };
}

function touch(item: StoredItem, patch: Partial<StoredItem>) {
  Object.assign(item, patch, { updatedAt: new Date().toISOString() });
}

async function saveData(report: ReportDbRow, patch: Partial<ReportDbRow["data"]>, extra: Partial<ReportDbRow> = {}) {
  report.data = { ...report.data, ...patch };
  Object.assign(report, extra);
  await repo().update("reports", report.id, { data: report.data, ...extra });
}

/* ---------------- Collecte d'une ligne ---------------- */

async function collectItem(report: ReportDbRow, item: StoredItem) {
  const row = item.circana;
  const category = report.config.category;
  const sites = await sitesFor(row.zone, report.config.params.siteIds ?? []);
  const domains = sites.map((s) => s.domain);

  if (isDemo.linkup) {
    const url = await discoverUrl(row, domains);
    const domain = domainOf(url);
    const resists = demoResists(row);
    const sheet = await finishSheet(demoSheet(row, !resists));
    const productId = await saveMarketProduct({ sheet, row, domain, url, method: "demo", category });
    if (resists) {
      const jobId = await openTeamJob(productId, "Scraping incomplet (composition, formats)");
      touch(item, { status: "awaiting_team", method: "demo", siteDomain: domain, marketProductId: productId, jobId, error: "Scraping incomplet : signalé à l'équipe" });
    } else {
      touch(item, { status: "done", method: "demo", siteDomain: domain, marketProductId: productId, error: null });
    }
    return;
  }

  let url: string | null = null;
  let sheet: ProductSheet | null = null;
  const notes: string[] = [];

  try {
    url = await discoverUrl(row, domains);
    logRun("linkup", "discovery", !!url, report.id);
  } catch (e) {
    notes.push(`Découverte : ${(e as Error).message}`);
    logRun("linkup", "discovery", false, report.id);
  }
  let domain = domainOf(url);
  const site = await siteByDomain(domain);

  if (url && site?.method !== "computer_use") {
    try {
      sheet = await scrape(url);
      logRun("scraping", "page", !!sheet, report.id);
      if (sheet && !missingFields(sheet).length) {
        const productId = await saveMarketProduct({ sheet: await finishSheet(sheet), row, domain, url, method: "scraping", category });
        touch(item, { status: "done", method: "scraping", siteDomain: domain, marketProductId: productId, error: null });
        return;
      }
    } catch (e) {
      notes.push(`Scraping : ${(e as Error).message}`);
      logRun("scraping", "page", false, report.id);
    }
  }

  if (site?.method !== "computer_use") {
    try {
      sheet = mergeSheets(sheet, await linkupExtract(row, url, domains));
      logRun("linkup", "extraction", !!sheet, report.id);
      if (sheet && !missingFields(sheet).length) {
        domain = domainOf(sheet.sourceUrl) ?? domain;
        const productId = await saveMarketProduct({ sheet: await finishSheet(sheet), row, domain, url, method: "linkup", category });
        touch(item, { status: "done", method: "linkup", siteDomain: domain, marketProductId: productId, error: null });
        return;
      }
    } catch (e) {
      notes.push(`Extraction : ${(e as Error).message}`);
      logRun("linkup", "extraction", false, report.id);
    }
  }

  const missing = missingFields(sheet);
  domain = domain ?? domains[0] ?? null;
  const productId = await saveMarketProduct({ sheet: await finishSheet(sheet), row, domain, url, method: null, category });

  // Parcours enregistré dans sites.ts : computer use lancé automatiquement.
  if (site?.method === "computer_use" && site.cuInstructions) {
    try {
      const sessionId = await startNavigator({ row, url, domain, instructions: site.cuInstructions, missing });
      logRun("hcompany", "session", true, report.id);
      const jobId = await openComputerUseJob(productId, sessionId, `Parcours automatique (${missing.join(", ")})`);
      touch(item, { status: "navigating", method: "hcompany", siteDomain: domain, marketProductId: productId, jobId, error: null });
      return;
    } catch (e) {
      notes.push(`H Company : ${(e as Error).message}`);
      logRun("hcompany", "session", false, report.id);
    }
  }

  const error = [`Champs manquants : ${missing.join(", ")}`, ...notes].join(" · ");
  const jobId = await openTeamJob(productId, error);
  touch(item, { status: "awaiting_team", siteDomain: domain, marketProductId: productId, jobId, error });
}

/* ---------------- Sessions H Company et file de l'équipe ---------------- */

/** Interroge une session H Company en cours ; met à jour la fiche et la tâche. Renvoie true si terminée. */
export async function pollJob(job: EnrichmentJobRow): Promise<boolean> {
  const sessionId = sessionOf(job);
  if (job.status !== "running" || !sessionId) return false;
  const db = repo();
  const [product] = (await loadSheets([job.target_id])).values();
  if (!product) return false;
  const zone = product.row.raw_data?.zone ?? "EU";
  const row = { brand: product.row.brand, product: product.row.name, zone };
  try {
    const poll = await pollNavigator(sessionId, row);
    if (!poll.done) return false;
    logRun("hcompany", "result", !!poll.sheet);
    const merged = await finishSheet(mergeSheets(poll.sheet, product.sheet));
    await saveMarketProduct({
      sheet: merged, row, domain: product.row.source_site, url: product.row.product_url, method: "hcompany",
      category: product.row.category ?? "", existingId: job.target_id,
    });
    const missing = missingFields(merged);
    if (merged && !missing.length) await recordSuccess(product.row.source_site, "hcompany").catch(() => null);
    await db.update("enrichment_jobs", job.id, {
      status: merged ? "completed" : "failed",
      finished_at: new Date().toISOString(),
      error_message: poll.error ?? (missing.length ? `Champs manquants : ${missing.join(", ")}` : null),
    });
  } catch (e) {
    await db.update("enrichment_jobs", job.id, { status: "queued", source: "team", error_message: (e as Error).message });
  }
  return true;
}

/** Répercute l'état des tâches de l'équipe sur les lignes du rapport. Renvoie true si quelque chose a changé. */
async function reconcile(report: ReportDbRow): Promise<boolean> {
  const items = (report.data.items ?? []).filter((i) => i.jobId && ["awaiting_team", "navigating"].includes(i.status));
  if (!items.length) return false;
  const jobs = await repo().select<EnrichmentJobRow>("enrichment_jobs", { in: ["id", items.map((i) => i.jobId!)] });
  for (const j of jobs.filter((x) => x.status === "running")) await pollJob(j);
  const fresh = await repo().select<EnrichmentJobRow>("enrichment_jobs", { in: ["id", items.map((i) => i.jobId!)] });
  const sheets = await loadSheets(items.map((i) => i.marketProductId ?? ""));
  let changed = false;
  for (const item of items) {
    const job = fresh.find((j) => j.id === item.jobId);
    if (!job) continue;
    const p = item.marketProductId ? sheets.get(item.marketProductId) : undefined;
    if (job.status === "completed") {
      const missing = missingFields(p?.sheet ?? null);
      touch(item, { status: missing.length ? "partial" : "done", method: p?.method ?? item.method, error: missing.length ? job.error_message : null });
      changed = true;
    } else if (job.status === "failed") {
      touch(item, { status: "failed", error: job.error_message ?? "Écarté par l'équipe" });
      changed = true;
    } else if (job.status === "running" && item.status !== "navigating") {
      touch(item, { status: "navigating", method: "hcompany" });
      changed = true;
    } else if (job.status === "queued" && item.status !== "awaiting_team") {
      touch(item, { status: "awaiting_team", error: job.error_message });
      changed = true;
    }
  }
  return changed;
}

/* ---------------- Finalisation ---------------- */

async function catalogFor(report: ReportDbRow) {
  const ids = report.config.catalogProductIds ?? [];
  if (!ids.length) return [];
  return (await repo().select<CatalogProductRow>("catalog_products", { in: ["id", ids] })).map(toClientProduct);
}

async function saveOpportunities(analysisId: string, catalog: CatalogInsights) {
  const db = repo();
  await db.removeWhere("growth_opportunities", { analysis_id: analysisId });
  const rows: Partial<GrowthOpportunityRow>[] = [];
  for (const p of catalog.products) {
    const name = `${p.client.brand} ${p.client.name}`;
    if (p.priceGapPct !== null && Math.abs(p.priceGapPct) > 10) {
      rows.push({
        analysis_id: analysisId, kind: "price_gap", score: Math.abs(p.priceGapPct),
        title: `${name} : ${p.priceGapPct > 0 ? "+" : ""}${p.priceGapPct} % vs prix moyen du marché`,
        description: p.priceGapPct > 0 ? "Positionné au-dessus du marché : vérifier la valeur perçue." : "Positionné sous le marché : marge de hausse possible.",
        refs: { product: name, matched: p.matchName },
      });
    }
    if (p.shadesGap !== null && p.shadesGap <= -1) {
      rows.push({
        analysis_id: analysisId, kind: "shade_gap", score: Math.abs(p.shadesGap),
        title: `${name} : ${Math.abs(p.shadesGap)} teintes de moins que les best-sellers`,
        description: "Élargir la gamme de teintes pour s'aligner sur les meilleures ventes.",
        refs: { product: name },
      });
    }
  }
  if (rows.length) await db.insert<GrowthOpportunityRow>("growth_opportunities", rows);
}

/** Calcule (ou recalcule) statistiques, tendances, audit du catalogue et analyse. */
export async function finalize(report: ReportDbRow) {
  const db = repo();
  await saveData(report, { phase: "analyzing" }, { status: "generating" });
  try {
    const items = await itemViews(report);
    const trends = report.data.trends ?? (await computeTrends(report.config.category));
    const stats = computeStats(items);
    const catalog = await computeCatalog(items, await catalogFor(report));
    const analysis = await writeAnalysis(report.config.category, stats, items, trends, catalog);
    if (!isDemo.hf) logRun("huggingface", "analysis", true, report.id);

    // Analyses enregistrées dans la table analyses (réutilisées à chaque recalcul).
    const now = new Date().toISOString();
    const existing = report.analysis_ids?.length ? await db.select<AnalysisRow>("analyses", { in: ["id", report.analysis_ids] }) : [];
    const upsert = async (type: AnalysisRow["type"], result: Record<string, unknown>) => {
      const found = existing.find((a) => a.type === type);
      const fields = { type, status: "completed" as const, params: { reportId: report.id, ...report.config.params }, result, completed_at: now };
      if (found) {
        await db.update("analyses", found.id, fields);
        return found.id;
      }
      return (await db.insert<AnalysisRow>("analyses", [{ ...fields, started_at: now }]))[0].id;
    };
    const ids = [await upsert("market_comparison", { stats, analysis, trends: { ...trends, fromTable: undefined } })];
    if (catalog) {
      const auditId = await upsert("catalog_audit", { catalog });
      ids.push(auditId);
      await saveOpportunities(auditId, catalog);
    }

    const { fromTable: _ignored, ...trendsToStore } = trends as typeof trends & { fromTable?: boolean };
    void _ignored;
    await saveData(report, { phase: undefined, stats, trends: trendsToStore, catalog, analysis }, { status: "ready", analysis_ids: ids, error_message: null });
  } catch (e) {
    await saveData(report, { phase: undefined }, { status: "failed", error_message: (e as Error).message });
  }
}

/* ---------------- Étape ---------------- */

export async function step(report: ReportDbRow) {
  if (report.status === "failed") return report;
  if (report.status === "generating" && report.data.phase === "analyzing") return report;

  const items = report.data.items ?? [];

  // Rapport prêt : on suit seulement le travail de l'équipe et les sessions H Company.
  if (report.status === "ready") {
    if (await reconcile(report)) {
      await saveData(report, { items });
      await finalize(report);
    }
    return report;
  }

  const now = Date.now();
  for (const i of items) if (i.status === "collecting" && now - new Date(i.updatedAt).getTime() > STALE_MS) touch(i, { status: "pending" });

  const batch = items.filter((i) => i.status === "pending").sort((a, b) => a.position - b.position).slice(0, BATCH);
  for (const i of batch) touch(i, { status: "collecting" });
  await saveData(report, { items, phase: "collecting" }, { status: "generating" });

  await Promise.all(batch.map((i) => collectItem(report, i).catch((e) => touch(i, { status: "failed", error: (e as Error).message }))));
  // Sites rencontrés : ajoutés à la liste s'ils sont nouveaux, et dernier succès enregistré.
  for (const i of batch) {
    await ensureSite(i.siteDomain, i.circana.zone).catch(() => null);
    if (i.status === "done") await recordSuccess(i.siteDomain, i.method).catch(() => null);
  }
  await reconcile(report);
  await saveData(report, { items });

  if (!items.some((i) => ["pending", "collecting"].includes(i.status))) await finalize(report);
  return report;
}

/** Après une action de l'équipe : met à jour tous les rapports qui contiennent ce produit. */
export async function refreshReportsFor(productId: string) {
  const reports = await repo().select<ReportDbRow>("reports", { eq: { type: "dashboard" }, order: ["created_at", "desc"], limit: 200 });
  for (const r of reports) {
    if (!(r.data?.items ?? []).some((i) => i.marketProductId === productId)) continue;
    if (await reconcile(r)) {
      await saveData(r, { items: r.data.items });
      if (r.status === "ready") await finalize(r);
    }
  }
}
