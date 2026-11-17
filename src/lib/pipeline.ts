import "server-only";
import { repo } from "./repo";
import { isDemo } from "./config";
import { discoverUrl, domainOf } from "./agents/discovery";
import { scrape } from "./agents/scraper";
import { linkupExtract } from "./agents/extractor";
import { startNavigator, pollNavigator } from "./agents/navigator";
import { demoResists, demoSheet } from "./agents/demo";
import { mergeSheets, missingFields } from "./product";
import { toEur } from "./currency";
import { withFamilies } from "./shades";
import { computeCatalog, computeStats, writeAnalysis } from "./analysis";
import { computeTrends } from "./trends";
import { logRun } from "./runs";
import type { ClientProductRow, ProductSheet, ReportItemRow, ReportRow, SiteRow, Zone } from "./types";

/**
 * Pipeline d'une analyse, avancé par petites étapes (/api/reports/[id]/step) :
 *
 *   pending ─► Découverte Linkup ─► Scraping direct ─► Extraction Linkup
 *                                        │ complet            │ complet
 *                                        ▼                    ▼
 *                                       done                 done
 *                                                             │ incomplet
 *                           site avec parcours enregistré ◄───┤
 *                                   │                          ▼
 *                              navigating (H Company)   awaiting_team (file de l'équipe)
 *
 * Le rapport est finalisé dès qu'il ne reste rien d'automatique à faire ;
 * il est recalculé à chaque fois que l'équipe débloque un produit.
 */

const BATCH = 3;
const STALE_MS = 3 * 60_000;

async function finishSheet(sheet: ProductSheet | null): Promise<ProductSheet | null> {
  if (!sheet) return null;
  return { ...sheet, shades: withFamilies(sheet.shades), priceEur: await toEur(sheet.price, sheet.currency) };
}

export async function sitesFor(report: ReportRow, zone: Zone): Promise<SiteRow[]> {
  const all = await repo().select<SiteRow>("sites", { eq: { zone } });
  const usable = all.filter((s) => !["blocked", "requested"].includes(s.status));
  const chosen = report.params.siteIds?.length ? usable.filter((s) => report.params.siteIds.includes(s.id)) : usable;
  return chosen.length ? chosen : usable;
}

async function markSite(domain: string | null, patch: Partial<SiteRow>) {
  if (!domain) return;
  const [site] = await repo().select<SiteRow>("sites", { eq: { domain } });
  if (site) await repo().update("sites", site.id, patch);
}

async function setItem(id: string, patch: Partial<ReportItemRow>) {
  await repo().update("report_items", id, { ...patch, updated_at: new Date().toISOString() });
}

async function collectItem(report: ReportRow, item: ReportItemRow) {
  const ctx = { orgId: report.org_id, reportId: report.id };
  await setItem(item.id, { status: "collecting" });
  const row = item.circana;
  const sites = await sitesFor(report, row.zone);
  const domains = sites.map((s) => s.domain);

  // Mode démo : simule le parcours complet sans appel externe.
  if (isDemo.linkup) {
    const url = await discoverUrl(row, domains);
    const domain = domainOf(url);
    if (demoResists(row)) {
      await setItem(item.id, {
        status: "awaiting_team", method: "demo", site_domain: domain,
        product: await finishSheet(demoSheet(row, false)),
        error: "Scraping incomplet (composition, formats) : signalé à l'équipe",
      });
    } else {
      await setItem(item.id, { status: "done", method: "demo", site_domain: domain, product: await finishSheet(demoSheet(row, true)), error: null });
    }
    return;
  }

  let url: string | null = null;
  let sheet: ProductSheet | null = null;
  const notes: string[] = [];

  // 1. Découverte
  try {
    url = await discoverUrl(row, domains);
    await logRun("linkup", "discovery", !!url, ctx);
  } catch (e) {
    notes.push(`Découverte : ${(e as Error).message}`);
    await logRun("linkup", "discovery", false, ctx);
  }
  const domain = domainOf(url);
  const site = sites.find((s) => s.domain === domain) ?? null;

  // 2. Scraping direct
  if (url && site?.status !== "computer_use") {
    try {
      sheet = await scrape(url);
      await logRun("scraping", "page", !!sheet, ctx);
      if (sheet && !missingFields(sheet).length) {
        await setItem(item.id, { status: "done", method: "scraping", site_domain: domain, product: await finishSheet(sheet), error: null });
        if (site && site.status === "untested") await markSite(domain, { status: "scraping", last_success_at: new Date().toISOString() });
        else await markSite(domain, { last_success_at: new Date().toISOString() });
        return;
      }
    } catch (e) {
      notes.push(`Scraping : ${(e as Error).message}`);
      await logRun("scraping", "page", false, ctx);
    }
  }

  // 3. Extraction Linkup
  if (site?.status !== "computer_use") {
    try {
      sheet = mergeSheets(sheet, await linkupExtract(row, url, domains));
      await logRun("linkup", "extraction", !!sheet, ctx);
      if (sheet && !missingFields(sheet).length) {
        const d = domainOf(sheet.sourceUrl) ?? domain;
        await setItem(item.id, { status: "done", method: "linkup", site_domain: d, product: await finishSheet(sheet), error: null });
        if (site && ["untested", "needs_review"].includes(site.status)) await markSite(d, { status: "linkup", last_success_at: new Date().toISOString() });
        return;
      }
    } catch (e) {
      notes.push(`Extraction : ${(e as Error).message}`);
      await logRun("linkup", "extraction", false, ctx);
    }
  }

  const missing = missingFields(sheet);

  // 4a. Parcours de computer use déjà enregistré pour ce site : lancement automatique.
  if (site?.status === "computer_use" && site.cu_instructions) {
    try {
      const sessionId = await startNavigator({ row, url, domain, instructions: site.cu_instructions, missing });
      await logRun("hcompany", "session", true, ctx);
      await setItem(item.id, {
        status: "navigating", method: "hcompany", site_domain: domain, session_id: sessionId,
        product: await finishSheet(sheet), error: `Parcours H Company en cours (${missing.join(", ")})`,
      });
      return;
    } catch (e) {
      notes.push(`H Company : ${(e as Error).message}`);
      await logRun("hcompany", "session", false, ctx);
    }
  }

  // 4b. Sinon : signalé à l'équipe, qui créera le parcours de computer use.
  await setItem(item.id, {
    status: "awaiting_team",
    site_domain: domain ?? domains[0] ?? null,
    product: await finishSheet(sheet),
    error: [`Champs manquants : ${missing.join(", ")}`, ...notes].join(" · "),
  });
  if (site && site.status === "untested") await markSite(domain, { status: "needs_review" });
}

export async function checkNavigator(item: ReportItemRow, reportId: string, orgId: string) {
  try {
    const poll = await pollNavigator(item.session_id!, item.circana);
    if (!poll.done) return false;
    await logRun("hcompany", "result", !!poll.sheet, { orgId, reportId });
    const merged = await finishSheet(mergeSheets(poll.sheet, item.product));
    const missing = missingFields(merged);
    await setItem(item.id, {
      status: merged ? (missing.length ? "partial" : "done") : "awaiting_team",
      method: "hcompany",
      product: merged,
      error: poll.error ?? (missing.length ? `Champs manquants : ${missing.join(", ")}` : null),
    });
    if (merged && !missing.length) await markSite(item.site_domain, { last_success_at: new Date().toISOString() });
    return true;
  } catch (e) {
    await setItem(item.id, { status: "awaiting_team", error: (e as Error).message });
    return true;
  }
}

/** Calcule (ou recalcule) statistiques, tendances, audit du catalogue et analyse. */
export async function finalize(reportId: string) {
  const db = repo();
  const report = await db.get<ReportRow>("reports", reportId);
  if (!report) return;
  await db.update("reports", reportId, { status: "analyzing" });
  try {
    const items = await db.select<ReportItemRow>("report_items", { eq: { report_id: reportId }, order: ["position", "asc"] });
    const clientProducts = await db.select<ClientProductRow>("client_products", { eq: { report_id: reportId } });
    const trends = report.trends ?? (await computeTrends(report.category));
    const stats = computeStats(items);
    const { insights, matches } = await computeCatalog(items, clientProducts);
    for (const m of matches) await db.update("client_products", m.id, { match_item_id: m.itemId, match_score: m.score });
    const analysis = await writeAnalysis(report.category, stats, items, trends, insights);
    if (!isDemo.hf) await logRun("huggingface", "analysis", true, { orgId: report.org_id, reportId });
    await db.update("reports", reportId, { status: "done", stats, trends, catalog: insights, analysis, error: null });
  } catch (e) {
    await db.update("reports", reportId, { status: "failed", error: (e as Error).message });
  }
}

export async function step(reportId: string) {
  const db = repo();
  const report = await db.get<ReportRow>("reports", reportId);
  if (!report) throw new Error("Rapport introuvable");
  if (report.status === "failed" || report.status === "analyzing") return report;

  const items = await db.select<ReportItemRow>("report_items", { eq: { report_id: reportId } });

  // Rapport déjà finalisé : on suit seulement les sessions H Company encore ouvertes.
  if (report.status === "done") {
    const results = await Promise.all(
      items.filter((i) => i.status === "navigating").map((i) => checkNavigator(i, reportId, report.org_id)),
    );
    if (results.some(Boolean)) await finalize(reportId);
    return (await db.get<ReportRow>("reports", reportId))!;
  }

  const now = Date.now();
  for (const i of items.filter((x) => x.status === "collecting" && now - new Date(x.updated_at).getTime() > STALE_MS)) {
    await setItem(i.id, { status: "pending" });
    i.status = "pending";
  }

  const navigating = items.filter((i) => i.status === "navigating");
  const pending = items.filter((i) => i.status === "pending").sort((a, b) => a.position - b.position).slice(0, BATCH);
  await Promise.all([
    ...navigating.map((i) => checkNavigator(i, reportId, report.org_id)),
    ...pending.map((i) => collectItem(report, i)),
  ]);

  const after = await db.select<ReportItemRow>("report_items", { eq: { report_id: reportId } });
  const automaticWorkLeft = after.some((i) => ["pending", "collecting"].includes(i.status));
  if (!automaticWorkLeft) await finalize(reportId);
  return (await db.get<ReportRow>("reports", reportId))!;
}
